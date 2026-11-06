import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActivityService, XP_REWARDS } from './activity.service';
import { MISTAKE_PATTERNS, isPattern, patternFor, type MistakePattern } from './mistakes';
import { NEW_CARD, type Rating } from './srs';
import { DEFAULT_RETENTION, isRetention, previewAll, recallNow, retrievability, review as fsrsReview, RETENTION_OPTIONS, type ReviewState } from './fsrs';
import { cardState, cardUpdate, wordState, wordUpdate } from './review.memory';

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

export type CorrectionSource = 'voice' | 'chat' | 'ai' | 'pronunciation' | 'grammar' | 'dictation' | 'writing';

export interface CorrectionInput {
  source: CorrectionSource;
  /** The correction's own id, so the same correction never makes two cards */
  sourceId: string;
  original: string;
  corrected: string;
  note?: string | null;
  /** A person's label (grammar, spelling, pronunciation...) when there is one */
  category?: string | null;
  /** The mistake type when the source already knows it (a grammar lesson does), instead of guessing from the words */
  pattern?: MistakePattern | null;
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
  /** The chance (0-100) of remembering it right now; null for a card never reviewed */
  recall: number | null;
}

/** Days in the review forecast */
export const FORECAST_DAYS = 14;

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
          pattern: isPattern(input.pattern) ? input.pattern : patternFor(original, corrected, input.category),
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

  /**
   * Puts a word from a vocabulary pack into the review deck, due right away. Never throws, and saving the
   * same word twice does nothing the second time.
   */
  async addWordCard(
    userId: string,
    input: { source: 'pack'; sourceId: string; word: string; meaning: string; example?: string | null },
  ): Promise<{ created: boolean } | null> {
    try {
      const word = clean(input.word, 120);
      const meaning = clean(input.meaning, 300);
      if (!userId || !word || !meaning) return { created: false };
      await this.prisma.language.upsert({ where: { code: 'en' }, create: { code: 'en', name: 'English' }, update: {} });
      await this.prisma.flashcard.create({
        data: {
          userId,
          language: 'en',
          front: word,
          back: meaning,
          kind: 'word',
          source: input.source,
          sourceId: input.sourceId,
          note: clean(input.example, 300) || null,
          reviews: {
            create: { userId, easeFactor: NEW_CARD.easeFactor, interval: 0, reviewCount: 0, lastReviewedAt: null, dueAt: new Date() },
          },
        },
      });
      return { created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { created: false };
      this.logger.warn(`Could not save a ${input.source} word card for ${userId}: ${(error as Error)?.message}`);
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
    const retention = await this.getRetention(userId);
    const percent = (state: ReviewState) => {
      const r = recallNow(state, now);
      return r === null ? null : Math.round(r * 100);
    };

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
        const state = cardState(r);
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
          preview: previewAll(state, now, retention),
          recall: percent(state),
        };
      }),
      ...words.map((w): ReviewItem => {
        const state = wordState(w);
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
          preview: previewAll(state, now, retention),
          recall: percent(state),
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

  // ---------------- memory settings and stats ----------------

  /** The share of cards the learner wants to remember when they come back */
  async getRetention(userId: string): Promise<number> {
    const settings = await this.prisma.settings.findUnique({ where: { userId }, select: { desiredRetention: true } });
    const value = settings?.desiredRetention;
    return isRetention(value) ? Number(value) : DEFAULT_RETENTION;
  }

  async setRetention(userId: string, value: unknown) {
    if (!isRetention(value)) throw new BadRequestException(`Choose one of ${RETENTION_OPTIONS.map((r) => `${r * 100}%`).join(', ')}`);
    const desiredRetention = Number(value);
    await this.prisma.settings.upsert({ where: { userId }, create: { userId, desiredRetention }, update: { desiredRetention } });
    return this.getStats(userId);
  }

  /**
   * How the deck is doing: cards by stage, the average chance of remembering what you have learned, reviews due
   * each day for the next two weeks, and how much you really remembered over the last 30 days.
   */
  async getStats(userId: string, now = new Date()) {
    await this.ensureReviews(userId);
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const [retention, cards, words, logs] = await Promise.all([
      this.getRetention(userId),
      this.prisma.flashcardReview.findMany({
        where: { userId, flashcard: { userId } },
        select: { stability: true, difficulty: true, easeFactor: true, interval: true, reviewCount: true, lapses: true, lastReviewedAt: true, dueAt: true },
      }),
      this.prisma.voiceSavedWord.findMany({
        where: { userId },
        select: { stability: true, difficulty: true, box: true, dueAt: true, reviewCount: true, lapses: true, interval: true, lastReviewedAt: true },
      }),
      // Same-day repeats (relearning a card a few minutes later) say little about long-term memory
      this.prisma.reviewLog.findMany({
        where: { userId, reviewedAt: { gte: since }, elapsedDays: { gte: 1 } },
        select: { rating: true },
      }),
    ]);

    const items = [...cards.map((c) => ({ state: cardState(c), dueAt: c.dueAt })), ...words.map((w) => ({ state: wordState(w), dueAt: w.dueAt }))];
    const counts = { total: items.length, new: 0, learning: 0, review: 0 };
    const recalls: number[] = [];
    const today = startOfDay(now).getTime();
    // Local calendar dates (toISOString would give yesterday's date east of UTC)
    const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const forecast = Array.from({ length: FORECAST_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return { day: localDay(d), due: 0 };
    });
    let dueNow = 0;
    for (const { state, dueAt } of items) {
      if (state.reviewCount === 0) counts.new++;
      else if (state.interval <= 0) counts.learning++;
      else counts.review++;
      const r = recallNow(state, now);
      if (r !== null) recalls.push(r);
      if (dueAt.getTime() <= now.getTime()) dueNow++;
      // Anything overdue counts on day one
      const index = Math.max(0, Math.floor((startOfDay(dueAt).getTime() - today) / DAY_MS));
      if (index < FORECAST_DAYS) forecast[index].due++;
    }
    const remembered = logs.filter((l) => l.rating !== 'again').length;

    return {
      retention,
      retentionOptions: RETENTION_OPTIONS,
      counts,
      dueNow,
      averageRecall: recalls.length ? Math.round((recalls.reduce((a, b) => a + b, 0) / recalls.length) * 100) : null,
      forecast,
      last30: { reviews: logs.length, remembered, retention: logs.length ? Math.round((remembered / logs.length) * 100) : null },
    };
  }

  /** One line per answer: what the memory was and became */
  private async logReview(
    userId: string,
    itemType: 'card' | 'word',
    itemId: string,
    rating: Rating,
    before: ReviewState,
    after: { stability: number; difficulty: number },
    now: Date,
  ) {
    const elapsedDays = before.lastReviewedAt ? (now.getTime() - before.lastReviewedAt.getTime()) / DAY_MS : null;
    const r = before.memory && elapsedDays !== null ? retrievability(elapsedDays, before.memory.stability) : null;
    try {
      await this.prisma.reviewLog.create({
        data: { userId, itemType, itemId, rating, elapsedDays, retrievability: r, stability: after.stability, difficulty: after.difficulty, reviewedAt: now },
      });
    } catch (error) {
      this.logger.warn(`Could not log a review for ${userId}: ${(error as Error)?.message}`);
    }
  }

  // ---------------- answering ----------------

  async answer(userId: string, input: { type: 'card' | 'word'; id: string; rating: Rating }) {
    const now = new Date();
    const retention = await this.getRetention(userId);

    if (input.type === 'word') {
      const word = await this.prisma.voiceSavedWord.findFirst({ where: { id: input.id, userId } });
      if (!word) throw new NotFoundException('Word not found');
      const before = wordState(word);
      const next = fsrsReview(before, input.rating, now, retention);
      const updated = await this.prisma.voiceSavedWord.update({ where: { id: word.id }, data: wordUpdate(next, now, input.rating, word.box) });
      await this.logReview(userId, 'word', word.id, input.rating, before, next.memory, now);
      if (input.rating !== 'again') await this.activity.recordCappedActivity(userId, XP_REWARDS.flashcardReview, 'FLASHCARD_REVIEW', REVIEW_XP_DAILY_CAP);
      return { key: `word:${word.id}`, dueAt: next.dueAt, intervalDays: next.interval, stability: next.memory.stability, word: updated };
    }

    const card = await this.prisma.flashcard.findFirst({ where: { id: input.id, userId }, select: { id: true } });
    if (!card) throw new NotFoundException('Card not found');
    const review = await this.prisma.flashcardReview.findFirst({ where: { flashcardId: card.id, userId } });

    const before: ReviewState = review ? cardState(review) : { memory: null, lastReviewedAt: null, reviewCount: 0, lapses: 0, interval: 0 };
    const next = fsrsReview(before, input.rating, now, retention);
    const data = cardUpdate(next, now);
    const saved = review
      ? await this.prisma.flashcardReview.update({ where: { id: review.id }, data })
      : await this.prisma.flashcardReview.create({ data: { ...data, easeFactor: NEW_CARD.easeFactor, flashcardId: card.id, userId } });
    await this.logReview(userId, 'card', card.id, input.rating, before, next.memory, now);

    if (input.rating !== 'again') {
      await this.activity.recordCappedActivity(userId, XP_REWARDS.flashcardReview, 'FLASHCARD_REVIEW', REVIEW_XP_DAILY_CAP);
    }
    return { key: `card:${card.id}`, dueAt: next.dueAt, intervalDays: next.interval, stability: next.memory.stability, review: saved };
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
