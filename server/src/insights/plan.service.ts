import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { isSoundKey, SOUNDS } from '../pronunciation/pronunciation.data';
import {
  buildPlan,
  dayKey,
  DEFAULT_GOAL_MINUTES,
  GOAL_OPTIONS,
  MINUTES_PER,
  normalizeGoal,
  planStreak,
  type PlanTask,
} from './plan.engine';

const DAY_MS = 24 * 60 * 60 * 1000;
/** XP for finishing the whole plan, once a day */
export const PLAN_BONUS_XP = 10;
/** A sound averaging below this counts as weak */
const WEAK_SOUND_BELOW = 90;

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export interface PlanTaskProgress extends PlanTask {
  progress: number;
  done: boolean;
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private review: ReviewService,
  ) {}

  async getGoal(userId: string): Promise<number> {
    const settings = await this.prisma.settings.findUnique({ where: { userId }, select: { dailyGoalMinutes: true } });
    return normalizeGoal(settings?.dailyGoalMinutes ?? DEFAULT_GOAL_MINUTES);
  }

  /** Changes the daily minutes; today's plan is made again to fit, unless it is already finished */
  async setGoal(userId: string, minutes: unknown) {
    if (!(GOAL_OPTIONS as readonly number[]).includes(Number(minutes))) {
      throw new BadRequestException(`Choose ${GOAL_OPTIONS.join(', ')} minutes`);
    }
    const goal = Number(minutes);
    await this.prisma.settings.upsert({
      where: { userId },
      create: { userId, dailyGoalMinutes: goal },
      update: { dailyGoalMinutes: goal },
    });
    await this.prisma.dailyPlan.deleteMany({ where: { userId, day: dayKey(new Date()), completedAt: null } });
    return this.getToday(userId);
  }

  /** Today's plan with live progress; finishing it gives the bonus once */
  async getToday(userId: string) {
    const now = new Date();
    const day = dayKey(now);
    let plan = await this.prisma.dailyPlan.findUnique({ where: { userId_day: { userId, day } } });
    if (!plan) plan = await this.createPlan(userId, day);

    const tasks = plan.tasks as unknown as PlanTask[];
    const measured = await this.measure(userId, tasks, startOfDay(now));
    const allDone = measured.length > 0 && measured.every((t) => t.done);

    let completedAt = plan.completedAt;
    let bonusJustEarned = false;
    if (allDone && !completedAt) {
      // updateMany with completedAt: null so two tabs finishing at once cannot both get the bonus
      const { count } = await this.prisma.dailyPlan.updateMany({
        where: { id: plan.id, completedAt: null },
        data: { completedAt: now },
      });
      if (count) {
        completedAt = now;
        bonusJustEarned = true;
        await this.activity.recordActivity(userId, PLAN_BONUS_XP, 'DAILY_PLAN');
      }
    }

    const finished = await this.prisma.dailyPlan.findMany({
      where: { userId, completedAt: { not: null }, createdAt: { gte: new Date(now.getTime() - 120 * DAY_MS) } },
      select: { day: true },
    });

    return {
      day,
      goalMinutes: plan.goalMinutes,
      goalOptions: GOAL_OPTIONS,
      tasks: measured,
      done: measured.filter((t) => t.done).length,
      total: measured.length,
      minutesPlanned: measured.reduce((sum, t) => sum + t.minutes, 0),
      completedAt,
      bonusXp: PLAN_BONUS_XP,
      bonusJustEarned,
      streak: planStreak(finished.map((f) => f.day), now),
    };
  }

  private async createPlan(userId: string, day: string) {
    const signals = await this.signals(userId);
    const tasks = buildPlan(signals);
    try {
      return await this.prisma.dailyPlan.create({
        data: { userId, day, goalMinutes: signals.goalMinutes, tasks: tasks as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      // Another request made today's plan at the same moment: use that one
      if ((error as { code?: string })?.code === 'P2002') {
        const existing = await this.prisma.dailyPlan.findUnique({ where: { userId_day: { userId, day } } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /** What the plan is built from: your level, what is due, your weak spots, and what you did this week */
  private async signals(userId: string) {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const [goalMinutes, profile, queue, mistakes, attempts, correctionsGiven, cardsSaved, wordsSaved] = await Promise.all([
      this.getGoal(userId),
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.review.getQueue(userId, { limit: 1 }).catch(() => null),
      this.review.getMistakesReport(userId, 30).catch(() => null),
      this.prisma.pronunciationAttempt.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) }, sound: { not: null } },
        select: { sound: true, score: true },
        take: 500,
      }),
      this.prisma.xpTransaction.count({ where: { userId, reason: 'CORRECTION_GIVEN', createdAt: { gte: weekAgo } } }),
      this.prisma.flashcard.count({ where: { userId, kind: 'word', createdAt: { gte: weekAgo } } }),
      this.prisma.voiceSavedWord.count({ where: { userId, createdAt: { gte: weekAgo } } }),
    ]);

    const repeating = mistakes?.patterns.find((p) => p.repeating) ?? null;

    const bySound = new Map<string, number[]>();
    for (const a of attempts) if (a.sound) bySound.set(a.sound, [...(bySound.get(a.sound) ?? []), a.score]);
    const weakest = [...bySound.entries()]
      .filter(([key]) => isSoundKey(key))
      .map(([key, scores]) => ({ key, average: scores.reduce((x, y) => x + y, 0) / scores.length }))
      .filter((s) => s.average < WEAK_SOUND_BELOW)
      .sort((a, b) => a.average - b.average)[0];

    return {
      goalMinutes,
      hasLevel: !!profile?.level,
      dueCards: queue?.due.total ?? 0,
      weakPattern: repeating ? { key: repeating.pattern, label: repeating.label } : null,
      weakSound: weakest && isSoundKey(weakest.key) ? { key: weakest.key, label: SOUNDS[weakest.key].label.split(' (')[0] } : null,
      correctionsGivenThisWeek: correctionsGiven,
      wordsSavedThisWeek: cardsSaved + wordsSaved,
    };
  }

  /** How far each task got today, from what you actually did anywhere in the app */
  private async measure(userId: string, tasks: PlanTask[], since: Date): Promise<PlanTaskProgress[]> {
    const kinds = new Set(tasks.map((t) => t.kind));
    const [xp, cardReviews, wordReviews, attempts, cardsSaved, wordsSaved, profile, challengeAnswers, textsRead, grammarTries, piecesWritten] = await Promise.all([
      this.prisma.xpTransaction.findMany({ where: { userId, createdAt: { gte: since } }, select: { reason: true, amount: true } }),
      kinds.has('REVIEW') ? this.prisma.flashcardReview.count({ where: { userId, lastReviewedAt: { gte: since } } }) : 0,
      kinds.has('REVIEW')
        ? this.prisma.voiceSavedWord.count({ where: { userId, reviewCount: { gt: 0 }, updatedAt: { gte: since } } })
        : 0,
      kinds.has('PRONUNCIATION') ? this.prisma.pronunciationAttempt.count({ where: { userId, createdAt: { gte: since } } }) : 0,
      kinds.has('WORDS') ? this.prisma.flashcard.count({ where: { userId, kind: 'word', createdAt: { gte: since } } }) : 0,
      kinds.has('WORDS') ? this.prisma.voiceSavedWord.count({ where: { userId, createdAt: { gte: since } } }) : 0,
      kinds.has('LEVEL') ? this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }) : null,
      kinds.has('CHALLENGE') ? this.prisma.challengeEntry.count({ where: { userId, createdAt: { gte: since } } }) : 0,
      kinds.has('READ') ? this.prisma.libraryProgress.count({ where: { userId, updatedAt: { gte: since } } }) : 0,
      kinds.has('EXERCISE') ? this.prisma.grammarProgress.count({ where: { userId, updatedAt: { gte: since } } }) : 0,
      kinds.has('WRITE') ? this.prisma.writingPiece.count({ where: { userId, submittedAt: { gte: since } } }) : 0,
    ]);

    const sum = (reason: string) => xp.filter((t) => t.reason === reason).reduce((s, t) => s + t.amount, 0);
    const count = (reason: string) => xp.filter((t) => t.reason === reason).length;
    // 1 XP per 15 seconds spoken in rooms and calls; each AI partner turn is about half a minute
    const speakingMinutes = (sum('VOICE_SPEAKING') * 15) / 60 + count('AI_PRACTICE') * MINUTES_PER.aiTurn;

    const value = (task: PlanTask): number => {
      switch (task.kind) {
        case 'LEVEL':
          return profile?.level ? 1 : 0;
        case 'REVIEW':
          return cardReviews + wordReviews;
        case 'PRONUNCIATION':
          return attempts;
        case 'SPEAK':
          return Math.floor(speakingMinutes);
        case 'CHALLENGE':
          return challengeAnswers;
        case 'READ':
          return textsRead;
        case 'WRITE':
          return piecesWritten;
        case 'CORRECTION':
          return count('CORRECTION_GIVEN');
        case 'WORDS':
          return cardsSaved + wordsSaved;
        case 'EXERCISE':
          // A grammar lesson tried today counts, even a repeat that earns no XP
          return Math.max(count('EXERCISE_COMPLETED'), grammarTries);
        default:
          return 0;
      }
    };

    return tasks.map((task) => {
      const v = value(task);
      return { ...task, progress: Math.min(task.target, v), done: v >= task.target };
    });
  }
}
