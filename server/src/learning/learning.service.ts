import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
 
import { CreateVocabularyDto, ReviewVocabularyDto } from './dto/vocabulary.dto';
import { CreateFlashcardDto, ReviewFlashcardDto } from './dto/flashcard.dto';
import { SubmitExerciseDto } from './dto/exercise.dto';
import { PrismaService } from '../prisma.service';
import { ActivityService, DAILY_XP_GOAL, XP_REWARDS } from './activity.service';

@Injectable()
export class LearningService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  // ============ VOCABULARY ============
  async getVocabulary(params: {
    language?: string;
    difficulty?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { language, difficulty, search, limit = 50, offset = 0 } = params;

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

  async createVocabulary(data: CreateVocabularyDto) {
    const existing = await this.prisma.vocabulary.findUnique({
      where: {
        word_language: {
          word: data.word,
          language: data.language,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Vocabulary word already exists for this language',
      );
    }

    return this.prisma.vocabulary.create({
      data: {
        word: data.word,
        translation: data.translation,
        language: data.language,
        exampleSentence: data.exampleSentence,
        audioUrl: data.audioUrl,
        difficulty: (data.difficulty || 'BEGINNER') as any,
      },
    });
  }

  async reviewVocabulary(userId: string, data: ReviewVocabularyDto) {
    const vocabulary = await this.prisma.vocabulary.findUnique({
      where: { id: data.vocabularyId },
    });

    if (!vocabulary) {
      throw new NotFoundException('Vocabulary not found');
    }

    const difficultyMap = { easy: 4, medium: 2, hard: 0 };
    const easeFactor = difficultyMap[data.difficulty] || 2;

    const existingReview = await this.prisma.flashcardReview.findFirst({
      where: {
        vocabularyId: data.vocabularyId,
        userId,
      },
    });

    if (existingReview) {
      const newInterval = this.calculateInterval(
        existingReview.interval,
        easeFactor,
        existingReview.easeFactor,
      );

      return this.prisma.flashcardReview.update({
        where: { id: existingReview.id },
        data: {
          easeFactor: easeFactor,
          interval: newInterval,
          lastReviewedAt: new Date(),
          dueAt: new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000),
          reviewCount: existingReview.reviewCount + 1,
        },
      });
    }

    return this.prisma.flashcardReview.create({
      data: {
        flashcardId: data.vocabularyId,
        userId,
        easeFactor: 2.5,
        interval: 1,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reviewCount: 1,
      },
    });
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

    return this.prisma.flashcard.create({
      data: {
        front: data.front,
        back: data.back,
        language: data.language,
        userId,
      },
    });
  }

  async reviewFlashcard(userId: string, data: ReviewFlashcardDto) {
    const flashcard = await this.prisma.flashcard.findUnique({
      where: { id: data.flashcardId },
    });

    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    const difficultyMap = { easy: 4, medium: 2, hard: 0 };
    const easeFactor = difficultyMap[data.difficulty] || 2;

    // Every review counts toward XP and today's streak
    await this.activity.recordActivity(userId, XP_REWARDS.flashcardReview, 'FLASHCARD_REVIEW');

    const existingReview = await this.prisma.flashcardReview.findFirst({
      where: {
        flashcardId: data.flashcardId,
        userId,
      },
    });

    if (existingReview) {
      const newInterval = this.calculateInterval(
        existingReview.interval,
        easeFactor,
        existingReview.easeFactor,
      );

      return this.prisma.flashcardReview.update({
        where: { id: existingReview.id },
        data: {
          easeFactor: easeFactor,
          interval: newInterval,
          lastReviewedAt: new Date(),
          dueAt: new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000),
          reviewCount: existingReview.reviewCount + 1,
        },
      });
    }

    return this.prisma.flashcardReview.create({
      data: {
        flashcardId: data.flashcardId,
        userId,
        easeFactor: 2.5,
        interval: 1,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reviewCount: 1,
      },
    });
  }

  // ============ GRAMMAR ============
  async getGrammar(params: {
    language?: string;
    level?: string;
    limit?: number;
  }) {
    const { language, level, limit = 20 } = params;

    const where: any = {};
    if (language) where.language = language;
    if (level) where.level = level;

    return this.prisma.grammarRule.findMany({
      where,
      take: limit,
      orderBy: { title: 'asc' },
    });
  }

  // ============ EXERCISES ============
  async getExercises(params: {
    language?: string;
    type?: string;
    difficulty?: string;
    limit?: number;
  }) {
    const { language, type, difficulty, limit = 20 } = params;

    const where: any = {};
    if (language) where.language = language;
    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;

    return this.prisma.exercise.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitExercise(userId: string, data: SubmitExerciseDto) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: data.exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Simple scoring - placeholder
    const result = {
      exerciseId: exercise.id,
      userId,
      score: Math.floor(Math.random() * 40) + 60,
      passed: true,
      feedback: 'Good job! Keep practicing.',
      metadata: data.metadata || {},
    };

    await this.updateProgress(userId, exercise.language, exercise.type);
    await this.awardXP(userId, 10);

    return result;
  }

  // ============ DASHBOARD ============

  /** Everything the dashboard shows, from real activity, in one request */
  async getDashboard(userId: string) {
    const DAY = 24 * 60 * 60 * 1000;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const historyStart = new Date(todayStart.getTime() - 83 * DAY); // 12 weeks incl. today
    const weekStart = new Date(todayStart.getTime() - 6 * DAY);
    const lastWeekStart = new Date(todayStart.getTime() - 13 * DAY);

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
      this.prisma.vocabulary.count({ where: { userId } }),
      this.prisma.vocabulary.count({ where: { userId, createdAt: { gte: weekStart } } }),
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
    ]);

    // XP per day for the activity heatmap and this-week/last-week comparison
    const dayKey = (d: Date) => {
      const local = new Date(d);
      local.setHours(0, 0, 0, 0);
      return local.getTime();
    };
    const byDay = new Map<number, number>();
    let speakingXpThisWeek = 0;
    for (const tx of recentXp) {
      const key = dayKey(tx.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + tx.amount);
      if (tx.reason === 'VOICE_SPEAKING' && tx.createdAt >= weekStart) speakingXpThisWeek += tx.amount;
    }
    const activity = Array.from({ length: 84 }, (_, i) => {
      const day = new Date(historyStart.getTime() + i * DAY);
      return { date: day.toISOString().slice(0, 10), xp: byDay.get(dayKey(day)) ?? 0 };
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

    const streak = ActivityService.effectiveStreak(streakRow);
    const xpToday = byDay.get(todayStart.getTime()) ?? 0;

    return {
      streak: {
        current: streak.current,
        longest: streakRow?.longestStreak ?? 0,
        practicedToday: streak.practicedToday,
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
      flashcards: { total: flashcardsTotal, due: dueReviews + newFlashcards },
      voice: {
        roomsJoined,
        roomsThisWeek,
        speakingMinutes: Math.round((speaking._sum.speakingTime ?? 0) / 60),
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

    return {
      progress,
      // A streak only survives if they practised today or yesterday
      streak: ActivityService.effectiveStreak(streak).current,
      totalXP: totalXP._sum.amount || 0,
    };
  }

  async updateProgress(userId: string, language: string, skill: string) {
    const existing = await this.prisma.progress.findFirst({
      where: {
        userId,
      },
    });

    if (existing) {
      return this.prisma.progress.update({
        where: { id: existing.id },
        data: {
          completionRate: existing.completionRate + 1,
        },
      });
    }

    return this.prisma.progress.create({
      data: {
        userId,
        type: "VOCABULARY",
        completionRate: 1,
      },
    });
  }

  async awardXP(userId: string, amount: number) {
    return this.activity.recordActivity(userId, amount, 'EXERCISE_COMPLETED');
  }

  // ============ HELPERS ============
  private calculateInterval(
    currentInterval: number,
    easeFactor: number,
    currentEase: number,
  ): number {
    const newEase = Math.max(
      1.3,
      currentEase + (0.1 - (5 - easeFactor) * (0.08 + (5 - easeFactor) * 0.02)),
    );
    let newInterval = currentInterval * newEase;

    if (easeFactor >= 3) {
      newInterval = Math.max(1, newInterval);
    } else {
      newInterval = 1;
    }

    return Math.round(newInterval);
  }
}