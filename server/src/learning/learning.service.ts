import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
 
import { CreateFlashcardDto, ReviewFlashcardDto } from './dto/flashcard.dto';
import { NEW_CARD, isRating, type Rating } from './srs';
import { ReviewService } from './review.service';
import { PrismaService } from '../prisma.service';
import { addDays, dayIn, learnerZone, startOfDayKey } from '../common/learner-day';
import { ActivityService, DAILY_XP_GOAL } from './activity.service';
import { GRAMMAR } from '../grammar/grammar.content';

@Injectable()
export class LearningService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private review: ReviewService,
  ) {}

  // ============ VOCABULARY ============
  async getVocabulary(params: {
    language?: string;
    difficulty?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { language, difficulty, search } = params;
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 100);
    const offset = Math.max(Number(params.offset) || 0, 0);

    const where: any = {};
    if (language) where.language = language;
    if (difficulty) where.difficulty = difficulty;
    if (search) {
      where.OR = [
        { word: { contains: search, mode: 'insensitive' } },
        { translation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.vocabulary.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { word: 'asc' },
      }),
      this.prisma.vocabulary.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  // ============ FLASHCARDS ============
  async getFlashcards(
    userId: string,
    params: { language?: string; dueOnly?: boolean },
  ) {
    const { language, dueOnly } = params;

    const where: any = {
      userId,
    };

    if (language) {
      where.flashcard = { language };
    }

    if (dueOnly) {
      where.dueAt = { lte: new Date() };
    }

    return this.prisma.flashcardReview.findMany({
      where,
      include: {
        flashcard: true,
        vocabulary: true,
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  async createFlashcard(userId: string, data: CreateFlashcardDto) {
    // Flashcards reference Language; make sure the code exists (e.g. first card saved from chat)
    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', bn: 'Bengali', hi: 'Hindi', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', pt: 'Portuguese', ru: 'Russian' };
    await this.prisma.language.upsert({
      where: { code: data.language },
      create: { code: data.language, name: LANGUAGE_NAMES[data.language] ?? data.language },
      update: {},
    });

    // A card needs its review row to appear in the deck; new cards are due straight away
    return this.prisma.flashcard.create({
      data: {
        front: data.front,
        back: data.back,
        language: data.language,
        userId,
        reviews: {
          create: { userId, easeFactor: NEW_CARD.easeFactor, interval: 0, reviewCount: 0, lastReviewedAt: null, dueAt: new Date() },
        },
      },
    });
  }

  async reviewFlashcard(userId: string, data: ReviewFlashcardDto) {
    const flashcard = await this.prisma.flashcard.findFirst({
      where: { id: data.flashcardId, userId },
    });

    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    // Older clients send easy/medium/hard; newer ones send again/hard/good/easy
    const legacy = { hard: 'hard', medium: 'good', easy: 'easy' } as const;
    const rating: Rating | undefined = isRating(data.rating) ? data.rating : legacy[data.difficulty as keyof typeof legacy];
    if (!rating) throw new BadRequestException('Say how well you knew the card');

    // One scheduler for every way of reviewing (FSRS, with XP and the review log)
    const result = await this.review.answer(userId, { type: 'card', id: flashcard.id, rating });
    return result.review;
  }

  // ============ GRAMMAR ============
  /** Every rule from the grammar course, with the lesson that teaches it */
  getGrammar(params: { level?: string }) {
    const level = String(params.level ?? '').toUpperCase();
    return GRAMMAR.filter((lesson) => !level || lesson.level === level).flatMap((lesson) =>
      lesson.rules.map((rule, index) => ({
        id: `${lesson.id}:${index}`,
        title: rule.title,
        description: rule.body,
        examples: rule.examples,
        language: 'en',
        level: lesson.level,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
      })),
    );
  }

  // ============ DASHBOARD ============

  /** Everything the dashboard shows, from real activity, in one request */
  /** Words in My words, optionally only those saved since a date */
  private async countWords(userId: string, since?: Date): Promise<number> {
    const created = since ? { createdAt: { gte: since } } : {};
    const [cards, saved] = await Promise.all([
      this.prisma.flashcard.count({ where: { userId, kind: 'word', ...created } }),
      this.prisma.voiceSavedWord.count({ where: { userId, ...created } }),
    ]);
    return cards + saved;
  }

  async getDashboard(userId: string) {
    const DAY = 24 * 60 * 60 * 1000;
    const now = new Date();
    // Days on the learner's own clock
    const zone = await learnerZone(this.prisma, userId);
    const todayKey = dayIn(now, zone);
    const startOf = (daysBack: number) => startOfDayKey(addDays(todayKey, -daysBack), zone);
    const historyStart = startOf(83); // 12 weeks incl. today
    const weekStart = startOf(6);
    const lastWeekStart = startOf(13);

    const [
      streakRow,
      totalXp,
      recentXp,
      profile,
      wordsTotal,
      wordsThisWeek,
      flashcardsTotal,
      dueReviews,
      newFlashcards,
      roomsJoined,
      roomsThisWeek,
      speaking,
      correctionsReceived,
      correctionsAccepted,
      correctionsPending,
      correctionsGiven,
      recentCorrections,
      dueSavedWords,
      speakingXp,
    ] = await Promise.all([
      this.prisma.streak.findUnique({ where: { userId } }),
      this.prisma.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } }),
      this.prisma.xpTransaction.findMany({
        where: { userId, createdAt: { gte: historyStart } },
        select: { amount: true, createdAt: true, reason: true },
      }),
      this.prisma.profile.findUnique({
        where: { userId },
        select: { nativeLanguage: true, learningLanguages: true, level: true, goals: true },
      }),
      // My words: word cards (packs, word of the day, your own) and words saved in rooms
      this.countWords(userId),
      this.countWords(userId, weekStart),
      this.prisma.flashcard.count({ where: { userId } }),
      this.prisma.flashcardReview.count({ where: { userId, dueAt: { lte: now } } }),
      this.prisma.flashcard.count({ where: { userId, reviews: { none: { userId } } } }),
      this.prisma.voiceParticipant.count({ where: { userId } }),
      this.prisma.voiceParticipant.count({ where: { userId, joinedAt: { gte: weekStart } } }),
      this.prisma.voiceSpeakerStats.aggregate({
        where: { userId },
        _sum: { speakingTime: true, timesSpoken: true },
      }),
      this.prisma.voiceCorrection.count({ where: { targetUserId: userId } }),
      this.prisma.voiceCorrection.count({ where: { targetUserId: userId, status: 'accepted' } }),
      this.prisma.voiceCorrection.count({ where: { targetUserId: userId, status: 'pending' } }),
      this.prisma.voiceCorrection.count({ where: { authorId: userId } }),
      this.prisma.voiceCorrection.findMany({
        where: { targetUserId: userId, status: 'accepted' },
        orderBy: { resolvedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          original: true,
          corrected: true,
          note: true,
          category: true,
          resolvedAt: true,
          author: { select: { name: true } },
        },
      }),
      // Saved words are part of the review queue, so "cards to review" must count them too
      this.prisma.voiceSavedWord.count({ where: { userId, dueAt: { lte: now } } }),
      // Rooms and random calls: room stats alone miss the calls
      this.prisma.xpTransaction.aggregate({ where: { userId, reason: 'VOICE_SPEAKING' }, _sum: { amount: true } }),
    ]);

    // XP per day for the activity heatmap and this-week/last-week comparison
    const byDay = new Map<string, number>();
    let speakingXpThisWeek = 0;
    for (const tx of recentXp) {
      const key = dayIn(tx.createdAt, zone);
      byDay.set(key, (byDay.get(key) ?? 0) + tx.amount);
      if (tx.reason === 'VOICE_SPEAKING' && tx.createdAt >= weekStart) speakingXpThisWeek += tx.amount;
    }
    const activity = Array.from({ length: 84 }, (_, i) => {
      const date = addDays(todayKey, -(83 - i));
      return { date, xp: byDay.get(date) ?? 0 };
    });
    const sumXp = (from: Date, to: Date) =>
      recentXp
        .filter((tx) => tx.createdAt >= from && tx.createdAt < to)
        .reduce((sum, tx) => sum + tx.amount, 0);

    // Corrections from 1:1 chat live as CORRECTION messages (original = replyTo)
    const [chatCorrectionsReceived, chatCorrectionsGiven] = await Promise.all([
      this.prisma.message.findMany({
        where: { type: 'CORRECTION', isDeleted: false, replyTo: { senderId: userId } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          content: true,
          metadata: true,
          createdAt: true,
          sender: { select: { name: true } },
          replyTo: { select: { content: true } },
        },
      }),
      this.prisma.message.count({ where: { type: 'CORRECTION', isDeleted: false, senderId: userId } }),
    ]);
    const chatMeta = (m: { metadata: unknown }) => (m.metadata ?? {}) as { note?: string; acceptedAt?: string };
    const chatAccepted = chatCorrectionsReceived.filter((m) => chatMeta(m).acceptedAt);
    const recentAll = [
      ...recentCorrections.map((c) => ({
        id: c.id,
        original: c.original,
        corrected: c.corrected,
        note: c.note,
        category: c.category,
        resolvedAt: c.resolvedAt,
        authorName: c.author?.name ?? 'Someone',
      })),
      ...chatAccepted.slice(0, 3).map((m) => ({
        id: m.id,
        original: m.replyTo?.content ?? '',
        corrected: m.content ?? '',
        note: chatMeta(m).note ?? null,
        category: 'chat',
        resolvedAt: chatMeta(m).acceptedAt ? new Date(chatMeta(m).acceptedAt as string) : m.createdAt,
        authorName: m.sender?.name ?? 'Someone',
      })),
    ]
      .sort((a, b) => new Date(b.resolvedAt ?? 0).getTime() - new Date(a.resolvedAt ?? 0).getTime())
      .slice(0, 3);

    const streak = ActivityService.effectiveStreak(streakRow, now, zone);
    const xpToday = byDay.get(todayKey) ?? 0;

    return {
      streak: {
        current: streak.current,
        longest: streakRow?.longestStreak ?? 0,
        practicedToday: streak.practicedToday,
        freezes: streak.freezes,
      },
      xp: {
        total: totalXp._sum.amount ?? 0,
        today: xpToday,
        dailyGoal: DAILY_XP_GOAL,
        thisWeek: sumXp(weekStart, new Date(now.getTime() + 1)),
        lastWeek: sumXp(lastWeekStart, weekStart),
      },
      activity,
      profile: {
        nativeLanguage: profile?.nativeLanguage ?? null,
        learningLanguages: profile?.learningLanguages ?? [],
        level: profile?.level ?? null,
        goals: profile?.goals ?? [],
      },
      words: { total: wordsTotal, thisWeek: wordsThisWeek },
      flashcards: { total: flashcardsTotal, due: dueReviews + newFlashcards + dueSavedWords },
      voice: {
        roomsJoined,
        roomsThisWeek,
        speakingMinutes: Math.round(Math.max((speaking._sum.speakingTime ?? 0) / 60, ((speakingXp?._sum?.amount ?? 0) * 15) / 60)),
        turns: speaking._sum.timesSpoken ?? 0,
        // 1 XP per 15s spoken → minutes this week
        speakingMinutesThisWeek: Math.round((speakingXpThisWeek * 15) / 60),
      },
      corrections: {
        received: correctionsReceived + chatCorrectionsReceived.length,
        accepted: correctionsAccepted + chatAccepted.length,
        pending: correctionsPending + (chatCorrectionsReceived.length - chatAccepted.length),
        given: correctionsGiven + chatCorrectionsGiven,
        recent: recentAll,
      },
    };
  }

  // ============ PROGRESS ============
  async getProgress(userId: string) {
    const progress = await this.prisma.progress.findMany({
      where: { userId },
    });

    const streak = await this.prisma.streak.findUnique({
      where: { userId },
    });

    const totalXP = await this.prisma.xpTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    const effective = ActivityService.effectiveStreak(streak, new Date(), await learnerZone(this.prisma, userId));
    return {
      progress,
      // A streak only survives if they practised today or yesterday (or a freeze covers the gap)
      streak: effective.current,
      practicedToday: effective.practicedToday,
      freezes: effective.freezes,
      totalXP: totalXP._sum.amount || 0,
    };
  }
}
