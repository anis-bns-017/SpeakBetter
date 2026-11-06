import { BadRequestException, ConflictException, Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { BadgesService } from '../gamification/badges.service';
import { weekEndOf, weekKey, weekStartOf } from '../gamification/leagues.engine';
import {
  buildQuests,
  CHEST_XP,
  daysLeftInWeek,
  FREEZE_PRICE,
  MAX_FREEZES,
  newlyDone,
  questText,
  type Quest,
  type QuestKind,
} from './quests.engine';

const DAY_MS = 24 * 60 * 60 * 1000;
/** "Your streak was saved" is only shown for this long after the freeze was used */
const SAVED_FRESH_DAYS = 14;

/** YYYY-MM-DD in the server's time zone */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    @Optional() private badges?: BadgesService,
  ) {}

  // ============ Weekly quests ============

  /** This week's quests with live progress. Quests done since the last look pay out here, once each. */
  async get(userId: string, now = new Date()) {
    const start = weekStartOf(now);
    const week = weekKey(now);
    let row = await this.prisma.questWeek.findUnique({ where: { userId_week: { userId, week } } });
    if (!row) row = await this.create(userId, week, start, now);

    const quests = row.quests as unknown as Quest[];
    const values = await this.measure(userId, quests.map((q) => q.kind), start);

    let mask = row.rewardedMask;
    const fresh = newlyDone(quests, values, mask);
    if (fresh.indexes.length) {
      // Matching the old mask means two tabs cannot both be paid for the same quest
      const { count } = await this.prisma.questWeek.updateMany({
        where: { userId, week, rewardedMask: mask },
        data: { rewardedMask: fresh.mask },
      });
      if (count) {
        mask = fresh.mask;
        const xp = fresh.indexes.reduce((sum, i) => sum + quests[i].xp, 0);
        await this.activity.recordActivity(userId, xp, 'QUEST_COMPLETED');
      }
    }

    const allDone = quests.length > 0 && quests.every((q, i) => values[i] >= q.target);
    let completedAt = row.completedAt;
    let freezeGiven = row.freezeGiven;
    if (allDone && !completedAt) {
      const { count } = await this.prisma.questWeek.updateMany({
        where: { userId, week, completedAt: null },
        data: { completedAt: now },
      });
      if (count) {
        completedAt = now;
        await this.activity.recordActivity(userId, CHEST_XP, 'QUEST_COMPLETED');
        freezeGiven = await this.giveFreeze(userId);
        if (freezeGiven) await this.prisma.questWeek.updateMany({ where: { userId, week }, data: { freezeGiven: true } });
        await this.badges?.evaluate(userId);
      }
    }

    return {
      week,
      endsAt: weekEndOf(start),
      quests: quests.map((q, i) => ({
        id: q.id,
        kind: q.kind,
        ...questText(q.kind, q.target),
        target: q.target,
        progress: Math.min(q.target, values[i]),
        done: values[i] >= q.target,
        xp: q.xp,
      })),
      done: quests.filter((q, i) => values[i] >= q.target).length,
      total: quests.length,
      chest: { xp: CHEST_XP, openedAt: completedAt, freezeGiven },
      /** The chest was opened and not celebrated yet */
      celebrate: !!completedAt && !row.seenAt,
    };
  }

  private async create(userId: string, week: string, start: Date, now: Date) {
    const lastStart = new Date(start.getTime() - 7 * DAY_MS);
    const [lastWeekXp, lastWeek] = await Promise.all([
      this.prisma.xpTransaction.aggregate({
        where: { userId, createdAt: { gte: lastStart, lt: start }, reason: { not: 'QUEST_COMPLETED' } },
        _sum: { amount: true },
      }),
      this.prisma.questWeek.findUnique({ where: { userId_week: { userId, week: weekKey(lastStart) } }, select: { quests: true } }),
    ]);
    const quests = buildQuests({
      lastWeekXp: lastWeekXp._sum.amount ?? 0,
      daysLeft: daysLeftInWeek(now, start),
      seed: `${userId}:${week}`,
      // A different mix from last week
      avoid: ((lastWeek?.quests as unknown as Quest[] | undefined) ?? []).map((q) => q.kind),
    });
    try {
      return await this.prisma.questWeek.create({
        data: { userId, week, quests: quests as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      // Another request made this week's quests at the same moment: use those
      if ((error as { code?: string })?.code === 'P2002') {
        const existing = await this.prisma.questWeek.findUnique({ where: { userId_week: { userId, week } } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /** How far each kind of quest got since the week started, from what the learner did anywhere in the app */
  private async measure(userId: string, kinds: QuestKind[], since: Date): Promise<number[]> {
    const has = (k: QuestKind) => kinds.includes(k);
    const [xp, cardReviews, wordReviews, attempts, challenges, texts, plans, pieces] = await Promise.all([
      this.prisma.xpTransaction.findMany({
        // Quest XP itself does not count towards the XP quest
        where: { userId, createdAt: { gte: since }, reason: { not: 'QUEST_COMPLETED' } },
        select: { reason: true, amount: true, createdAt: true },
      }),
      has('REVIEW') ? this.prisma.flashcardReview.count({ where: { userId, lastReviewedAt: { gte: since } } }) : 0,
      has('REVIEW') ? this.prisma.voiceSavedWord.count({ where: { userId, reviewCount: { gt: 0 }, updatedAt: { gte: since } } }) : 0,
      has('PRONUNCIATION') ? this.prisma.pronunciationAttempt.count({ where: { userId, createdAt: { gte: since } } }) : 0,
      has('CHALLENGE') ? this.prisma.challengeEntry.count({ where: { userId, createdAt: { gte: since } } }) : 0,
      has('READ') ? this.prisma.libraryProgress.count({ where: { userId, updatedAt: { gte: since } } }) : 0,
      has('PLAN') ? this.prisma.dailyPlan.count({ where: { userId, completedAt: { gte: since } } }) : 0,
      has('WRITE') ? this.prisma.writingPiece.count({ where: { userId, submittedAt: { gte: since } } }) : 0,
    ]);

    const sum = (reason?: string) => xp.filter((t) => !reason || t.reason === reason).reduce((s, t) => s + t.amount, 0);
    const count = (reason: string) => xp.filter((t) => t.reason === reason).length;

    return kinds.map((kind) => {
      switch (kind) {
        case 'XP':
          return sum();
        case 'DAYS':
          return new Set(xp.map((t) => dayKey(t.createdAt))).size;
        case 'PLAN':
          return plans;
        // 1 XP per 15 seconds spoken in rooms and calls; each AI partner turn is about half a minute
        case 'SPEAK':
          return Math.floor((sum('VOICE_SPEAKING') * 15) / 60 + count('AI_PRACTICE') * 0.5);
        case 'REVIEW':
          return cardReviews + wordReviews;
        case 'READ':
          return texts;
        case 'WRITE':
          return pieces;
        case 'CHALLENGE':
          return challenges;
        case 'PRONUNCIATION':
          return attempts;
        case 'CORRECTION':
          return count('CORRECTION_GIVEN');
        default:
          return 0;
      }
    });
  }

  // ============ Streak and freezes ============

  /** The streak, freezes in hand, the shop, and freezes used that the learner hasn't been told about */
  async streak(userId: string) {
    await this.activity.useFreezes(userId).catch((error) => this.logger.warn(`Could not use freezes for ${userId}: ${error?.message}`));
    const since = new Date(Date.now() - SAVED_FRESH_DAYS * DAY_MS);
    const [row, xp, saved] = await Promise.all([
      this.prisma.streak.findUnique({ where: { userId } }),
      this.prisma.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } }),
      this.prisma.streakFreezeUse.findMany({
        where: { userId, seenAt: null, createdAt: { gte: since } },
        orderBy: { day: 'asc' },
        select: { day: true, streak: true },
      }),
    ]);
    const effective = ActivityService.effectiveStreak(row);
    const balance = Math.max(0, (xp._sum.amount ?? 0) - (row?.xpSpent ?? 0));
    const freezes = row?.freezes ?? 0;
    return {
      current: effective.current,
      longest: Math.max(row?.longestStreak ?? 0, effective.current),
      practicedToday: effective.practicedToday,
      freezes,
      maxFreezes: MAX_FREEZES,
      price: FREEZE_PRICE,
      balance,
      canBuy: !!row && freezes < MAX_FREEZES && balance >= FREEZE_PRICE,
      saved,
    };
  }

  /** Spends shop XP on a freeze */
  async buyFreeze(userId: string) {
    const row = await this.prisma.streak.findUnique({ where: { userId } });
    if (!row) throw new BadRequestException('Practise once to start a streak first');
    if (row.freezes >= MAX_FREEZES) throw new BadRequestException(`You already hold ${MAX_FREEZES} freezes`);
    const xp = await this.prisma.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } });
    const balance = (xp._sum.amount ?? 0) - row.xpSpent;
    if (balance < FREEZE_PRICE) throw new BadRequestException(`You need ${FREEZE_PRICE - balance} more XP`);

    // Matching what was spent before means a double click cannot buy two with one balance
    const { count } = await this.prisma.streak.updateMany({
      where: { userId, xpSpent: row.xpSpent, freezes: { lt: MAX_FREEZES } },
      data: { freezes: { increment: 1 }, xpSpent: { increment: FREEZE_PRICE } },
    });
    if (!count) throw new ConflictException('Something changed. Try again');
    return this.streak(userId);
  }

  /** Marks the chest and the "streak saved" news as seen, so each is shown once */
  async markSeen(userId: string, input: { chest?: unknown; saved?: unknown }) {
    const now = new Date();
    await Promise.all([
      input.chest
        ? this.prisma.questWeek.updateMany({ where: { userId, completedAt: { not: null }, seenAt: null }, data: { seenAt: now } })
        : null,
      input.saved ? this.prisma.streakFreezeUse.updateMany({ where: { userId, seenAt: null }, data: { seenAt: now } }) : null,
    ]);
    return { ok: true };
  }

  /** One more freeze, unless the learner already holds the most */
  private async giveFreeze(userId: string): Promise<boolean> {
    const { count } = await this.prisma.streak.updateMany({
      where: { userId, freezes: { lt: MAX_FREEZES } },
      data: { freezes: { increment: 1 } },
    });
    return count > 0;
  }
}
