import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActivityService, XP_REWARDS } from './activity.service';
import { MISTAKE_PATTERNS, isPattern, patternFor, type MistakePattern } from './mistakes';
import { NEW_CARD, previewMinutes, schedule, type CardState, type Rating } from './srs';
import { dueAfter, nextBox } from '../voice/coach/coach.engine';

/** Corrections that arrive faster than this in a day stop making cards, so one chatty room can't bury the deck */
export const AUTO_CARDS_PER_DAY = 30;
/** Reviewing earns a little XP, capped so it stays about learning */
export const REVIEW_XP_DAILY_CAP = 60;
export const QUEUE_DEFAULT = 30;
const QUEUE_MAX = 100;
const SYNC_WINDOW_DAYS = 90;
const SYNC_MAX_PER_SOURCE = 100;
const SYNC_THROTTLE_MS = 10 * 60 * 1000;
/** A card remembered for this many days counts as learned in the mistakes report */
const LEARNED_AFTER_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CorrectionSource = 'voice' | 'chat' | 'ai' | 'pronunciation';

export interface CorrectionInput {
  source: CorrectionSource;
  /** The correction's own id, so the same correction never makes two cards */
  sourceId: string;
  original: string;
  corrected: string;
  note?: string | null;
  /** A person's label (grammar, spelling, pronunciation...) when there is one */
  category?: string | null;
  /** When the correction was made (for history imports) */
  createdAt?: Date;
}

export type ReviewKind = 'correction' | 'word';

export interface ReviewItem {
  key: string;
  type: 'card' | 'word';
  id: string;
  kind: ReviewKind;
  front: string;
  back: string;
  note: string | null;
  pattern: MistakePattern | null;
  patternLabel: string | null;
  isNew: boolean;
  dueAt: Date;
  /** Minutes until the card returns for each answer, to label the buttons */
  preview: Record<Rating, number>;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const clean = (value: unknown, max: number): string => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const same = (a: string, b: string) => a.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').trim() === b.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').trim();

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private readonly lastSync = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  // ---------------- cards from corrections ----------------

  /**
   * Turns a correction into a flashcard that is due right away. Safe to call from anywhere:
   * it never throws (a failure here must not break chat or a voice room), and calling it twice
   * for the same correction does nothing the second time.
   */
  async addCorrectionCard(
    userId: string,
    input: CorrectionInput,
    options: { ignoreDailyLimit?: boolean } = {},
  ): Promise<{ created: boolean } | null> {
    try {
      const original = clean(input.original, 300);
      const corrected = clean(input.corrected, 300);
      if (!userId || !original || !corrected || same(original, corrected)) return { created: false };

      if (!options.ignoreDailyLimit) {
        const today = await this.prisma.flashcard.count({
          where: { userId, kind: 'correction', createdAt: { gte: startOfDay(new Date()) } },
        });
        if (today >= AUTO_CARDS_PER_DAY) return { created: false };
      }

      await this.prisma.language.upsert({
        where: { code: 'en' },
        create: { code: 'en', name: 'English' },
        update: {},
      });
      await this.prisma.flashcard.create({
        data: {
          userId,
          language: 'en',
          front: original,
          back: corrected,
          kind: 'correction',
          source: input.source,
          sourceId: input.sourceId,
          pattern: patternFor(original, corrected, input.category),
          note: clean(input.note, 300) || null,
          ...(input.createdAt ? { createdAt: input.createdAt } : {}),
          reviews: {
            create: { userId, easeFactor: NEW_CARD.easeFactor, interval: 0, reviewCount: 0, lastReviewedAt: null, dueAt: new Date() },
          },
        },
      });
      return { created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { created: false };
      this.logger.warn(`Could not make a card from a ${input.source} correction for ${userId}: ${(error as Error)?.message}`);
      return null;
    }
  }

  /** The learner dismissed the correction, so its card goes too */
  async removeCorrectionCard(userId: string, source: CorrectionSource, sourceId: string) {
    try {
      await this.prisma.flashcard.deleteMany({ where: { userId, source, sourceId } });
    } catch (error) {
      this.logger.warn(`Could not remove a ${source} correction card for ${userId}: ${(error as Error)?.message}`);
    }
  }

  /**
   * Brings corrections received before this feature existed into the deck (the last 90 days).
   * Safe to repeat: corrections that already have a card are skipped.
   */
  async syncHistory(userId: string, options: { force?: boolean } = {}): Promise<{ added: number }> {
    const last = this.lastSync.get(userId) ?? 0;
    if (!options.force && Date.now() - last < SYNC_THROTTLE_MS) return { added: 0 };
    this.lastSync.set(userId, Date.now());

    const since = new Date(Date.now() - SYNC_WINDOW_DAYS * DAY_MS);
    const [voice, chat] = await Promise.all([
      this.prisma.voiceCorrection.findMany({
        where: { targetUserId: userId, status: { not: 'dismissed' }, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: SYNC_MAX_PER_SOURCE,
        select: { id: true, original: true, corrected: true, note: true, category: true, createdAt: true },
      }),
      this.prisma.message.findMany({
        where: { type: 'CORRECTION', createdAt: { gte: since }, replyTo: { senderId: userId } },
        orderBy: { createdAt: 'desc' },
        take: SYNC_MAX_PER_SOURCE,
        select: { id: true, content: true, metadata: true, createdAt: true, replyTo: { select: { content: true } } },
      }),
    ]);

    let added = 0;
    for (const c of voice) {
      const r = await this.addCorrectionCard(
        userId,
        { source: 'voice', sourceId: c.id, original: c.original, corrected: c.corrected, note: c.note, category: c.category, createdAt: c.createdAt },
        { ignoreDailyLimit: true },
      );
      if (r?.created) added++;
    }
    for (const m of chat) {
      const original = m.replyTo?.content;
      if (!original) continue;
      const note = (m.metadata as { note?: unknown } | null)?.note;
      const r = await this.addCorrectionCard(
        userId,
        { source: 'chat', sourceId: m.id, original, corrected: m.content ?? '', note: typeof note === 'string' ? note : null, createdAt: m.createdAt },
        { ignoreDailyLimit: true },
      );
      if (r?.created) added++;
    }
    return { added };
  }

  // ---------------- the review queue ----------------

  async getQueue(
    userId: string,
    options: { all?: boolean; kind?: ReviewKind; pattern?: string; language?: string; limit?: number } = {},
  ) {
    const now = new Date();
    const limit = Math.min(Math.max(Math.floor(options.limit ?? QUEUE_DEFAULT) || QUEUE_DEFAULT, 1), QUEUE_MAX);
    await this.ensureReviews(userId);

    const cardFilter: Prisma.FlashcardWhereInput = {
      userId,
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.pattern && isPattern(options.pattern) ? { pattern: options.pattern } : {}),
      ...(options.language ? { language: options.language } : {}),
    };
    const dueFilter = options.all ? {} : { dueAt: { lte: now } };
    // Saved words (from English conversations) are only part of the queue when nothing narrows it to a
    // mistake pattern, to corrections or to another language
    const includeWords = !options.pattern && options.kind !== 'correction' && (!options.language || options.language === 'en');

    const [reviews, words, dueCorrections, dueCardWords, dueBankWords] = await Promise.all([
      this.prisma.flashcardReview.findMany({
        where: { userId, flashcard: cardFilter, ...dueFilter },
        include: { flashcard: true },
        orderBy: { dueAt: 'asc' },
        take: limit,
      }),
      includeWords
        ? this.prisma.voiceSavedWord.findMany({ where: { userId, ...dueFilter }, orderBy: { dueAt: 'asc' }, take: limit })
        : Promise.resolve([]),
      this.prisma.flashcardReview.count({ where: { userId, dueAt: { lte: now }, flashcard: { userId, kind: 'correction' } } }),
      this.prisma.flashcardReview.count({ where: { userId, dueAt: { lte: now }, flashcard: { userId, kind: 'word' } } }),
      this.prisma.voiceSavedWord.count({ where: { userId, dueAt: { lte: now } } }),
    ]);

    const items: ReviewItem[] = [
      ...reviews.map((r): ReviewItem => {
        const pattern = isPattern(r.flashcard.pattern) ? r.flashcard.pattern : null;
        return {
          key: `card:${r.flashcardId}`,
          type: 'card',
          id: r.flashcardId,
          kind: r.flashcard.kind === 'correction' ? 'correction' : 'word',
          front: r.flashcard.front,
          back: r.flashcard.back,
          note: r.flashcard.note,
          pattern,
          patternLabel: pattern ? MISTAKE_PATTERNS[pattern].label : null,
          isNew: r.reviewCount === 0,
          dueAt: r.dueAt,
          preview: previewMinutes(this.stateOf(r)),
        };
      }),
      ...words.map((w): ReviewItem => {
        const knew = dueAfter(nextBox(w.box, true), now).getTime() - now.getTime();
        const forgot = dueAfter(0, now).getTime() - now.getTime();
        const toMinutes = (ms: number) => Math.round(ms / 60_000);
        return {
          key: `word:${w.id}`,
          type: 'word',
          id: w.id,
          kind: 'word',
          front: w.word,
          back: w.meaning || 'No meaning saved yet',
          note: w.sentence,
          pattern: null,
          patternLabel: null,
          isNew: w.reviewCount === 0,
          dueAt: w.dueAt,
          preview: { again: toMinutes(forgot), hard: toMinutes(knew), good: toMinutes(knew), easy: toMinutes(knew) },
        };
      }),
    ]
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, limit);

    return {
      items,
      due: { corrections: dueCorrections, words: dueCardWords + dueBankWords, total: dueCorrections + dueCardWords + dueBankWords },
    };
  }

  /** Cards made before every card had a review row (or made by hand) count as new and due now */
  private async ensureReviews(userId: string) {
    const missing = await this.prisma.flashcard.findMany({
      where: { userId, reviews: { none: { userId } } },
      select: { id: true },
      take: 500,
    });
    if (!missing.length) return;
    await this.prisma.flashcardReview.createMany({
      data: missing.map((c) => ({ flashcardId: c.id, userId, easeFactor: NEW_CARD.easeFactor, interval: 0, reviewCount: 0, lastReviewedAt: null, dueAt: new Date() })),
      skipDuplicates: true,
    });
  }

  private stateOf(review: { easeFactor: number; interval: number; reviewCount: number; lapses: number }): CardState {
    return { easeFactor: review.easeFactor, interval: review.interval, reviewCount: review.reviewCount, lapses: review.lapses };
  }

  // ---------------- answering ----------------

  async answer(userId: string, input: { type: 'card' | 'word'; id: string; rating: Rating }) {
    const now = new Date();

    if (input.type === 'word') {
      const word = await this.prisma.voiceSavedWord.findFirst({ where: { id: input.id, userId } });
      if (!word) throw new NotFoundException('Word not found');
      const knew = input.rating !== 'again';
      const box = nextBox(word.box, knew);
      const dueAt = dueAfter(box, now);
      await this.prisma.voiceSavedWord.update({
        where: { id: word.id },
        data: { box, dueAt, reviewCount: { increment: 1 } },
      });
      if (knew) await this.activity.recordCappedActivity(userId, XP_REWARDS.flashcardReview, 'FLASHCARD_REVIEW', REVIEW_XP_DAILY_CAP);
      return { key: `word:${word.id}`, dueAt, intervalDays: Math.round((dueAt.getTime() - now.getTime()) / DAY_MS) };
    }

    const card = await this.prisma.flashcard.findFirst({ where: { id: input.id, userId }, select: { id: true } });
    if (!card) throw new NotFoundException('Card not found');
    const review = await this.prisma.flashcardReview.findFirst({ where: { flashcardId: card.id, userId } });

    const next = schedule(review ? this.stateOf(review) : NEW_CARD, input.rating, now);
    const data = {
      easeFactor: next.easeFactor,
      interval: next.interval,
      reviewCount: next.reviewCount,
      lapses: next.lapses,
      lastReviewedAt: now,
      dueAt: next.dueAt,
    };
    if (review) await this.prisma.flashcardReview.update({ where: { id: review.id }, data });
    else await this.prisma.flashcardReview.create({ data: { ...data, flashcardId: card.id, userId } });

    if (input.rating !== 'again') {
      await this.activity.recordCappedActivity(userId, XP_REWARDS.flashcardReview, 'FLASHCARD_REVIEW', REVIEW_XP_DAILY_CAP);
    }
    return { key: `card:${card.id}`, dueAt: next.dueAt, intervalDays: next.interval };
  }

  // ---------------- the mistakes report ----------------

  /** Which kinds of mistake keep coming back, from the corrections you received in the last `days` days */
  async getMistakesReport(userId: string, days = 30) {
    const span = Math.min(Math.max(Math.floor(days) || 30, 7), 180);
    const now = Date.now();
    const cards = await this.prisma.flashcard.findMany({
      where: { userId, kind: 'correction', createdAt: { gte: new Date(now - span * DAY_MS) } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        pattern: true,
        front: true,
        back: true,
        note: true,
        createdAt: true,
        reviews: { where: { userId }, select: { interval: true }, take: 1 },
      },
    });

    interface Group {
      count: number;
      last7: number;
      prev7: number;
      learned: number;
      examples: Array<{ original: string; corrected: string; note: string | null }>;
    }
    const groups = new Map<MistakePattern, Group>();
    for (const c of cards) {
      const pattern: MistakePattern = isPattern(c.pattern) ? c.pattern : 'OTHER';
      const g = groups.get(pattern) ?? { count: 0, last7: 0, prev7: 0, learned: 0, examples: [] };
      const age = now - c.createdAt.getTime();
      g.count++;
      if (age < 7 * DAY_MS) g.last7++;
      else if (age < 14 * DAY_MS) g.prev7++;
      if ((c.reviews[0]?.interval ?? 0) >= LEARNED_AFTER_DAYS) g.learned++;
      if (g.examples.length < 3) g.examples.push({ original: c.front, corrected: c.back, note: c.note });
      groups.set(pattern, g);
    }

    const patterns = [...groups.entries()]
      .map(([pattern, g]) => ({
        pattern,
        label: MISTAKE_PATTERNS[pattern].label,
        tip: MISTAKE_PATTERNS[pattern].tip,
        count: g.count,
        last7: g.last7,
        prev7: g.prev7,
        trend: g.last7 > g.prev7 ? ('up' as const) : g.last7 < g.prev7 ? ('down' as const) : ('same' as const),
        learned: g.learned,
        /** Three or more in the period: a habit worth fixing */
        repeating: g.count >= 3,
        examples: g.examples,
      }))
      .sort((a, b) => b.count - a.count);

    return { days: span, total: cards.length, patterns };
  }
}
