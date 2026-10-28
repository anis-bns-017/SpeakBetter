// server/src/learning/activity.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { XpReason } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/** XP a learner should aim for each day (shown as the daily goal ring) */
export const DAILY_XP_GOAL = 50;

/** XP awarded per action — tuned so speaking is the most rewarding habit */
export const XP_REWARDS = {
  /** per 15 seconds of speaking in a voice room */
  speakingPer15s: 1,
  correctionGiven: 3,
  correctionAccepted: 5,
  flashcardReview: 2,
  /** per message in a conversation, capped by CHAT_XP_DAILY_CAP */
  chatMessage: 1,
} as const;

/** Most XP a learner can earn from chat messages per day (keeps it about practice, not spam) */
export const CHAT_XP_DAILY_CAP = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * The one place that awards XP and keeps the daily streak up to date.
 * Any rewarded activity (speaking, corrections, reviews, exercises) goes through here.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private prisma: PrismaService) {}

  /** Adds XP (if any) and counts today as a practice day for the streak */
  async recordActivity(userId: string, amount: number, reason: XpReason) {
    if (!userId) return;
    try {
      if (amount > 0) {
        await this.prisma.$transaction([
          this.prisma.xpTransaction.create({ data: { userId, amount, reason } }),
          // updateMany: users without a profile row shouldn't make this throw
          this.prisma.profile.updateMany({
            where: { userId },
            data: { xp: { increment: amount } },
          }),
        ]);
      }
      await this.touchStreak(userId);
    } catch (error) {
      this.logger.warn(`Could not record activity for ${userId}: ${error?.message}`);
    }
  }

  /** Like recordActivity, but stops awarding XP for `reason` once today's total reaches `dailyCap` */
  async recordCappedActivity(userId: string, amount: number, reason: XpReason, dailyCap: number) {
    if (!userId) return;
    try {
      const today = startOfDay(new Date());
      const earned = await this.prisma.xpTransaction.aggregate({
        where: { userId, reason, createdAt: { gte: today } },
        _sum: { amount: true },
      });
      const remaining = dailyCap - (earned._sum.amount ?? 0);
      // Still counts as practice for the streak even when the XP cap is reached
      await this.recordActivity(userId, Math.max(0, Math.min(amount, remaining)), reason);
    } catch (error) {
      this.logger.warn(`Could not record capped activity for ${userId}: ${error?.message}`);
    }
  }

  /** Practising on consecutive days grows the streak; missing a day restarts it at 1 */
  async touchStreak(userId: string) {
    const now = new Date();
    const today = startOfDay(now);
    const existing = await this.prisma.streak.findUnique({ where: { userId } });

    let current = 1;
    let longest = 1;
    if (existing) {
      const lastDay = startOfDay(existing.lastActivityDate);
      const daysSince = Math.round((today.getTime() - lastDay.getTime()) / DAY_MS);
      if (daysSince <= 0) return; // already counted today
      current = daysSince === 1 ? existing.currentStreak + 1 : 1;
      longest = Math.max(existing.longestStreak, current);
    }

    await this.prisma.streak.upsert({
      where: { userId },
      create: { userId, currentStreak: current, longestStreak: longest, lastActivityDate: now },
      update: { currentStreak: current, longestStreak: longest, lastActivityDate: now },
    });
    await this.prisma.profile.updateMany({ where: { userId }, data: { streak: current } });
  }

  /** The streak as the learner sees it: it only survives if they practised today or yesterday */
  static effectiveStreak(streak: { currentStreak: number; lastActivityDate: Date } | null) {
    if (!streak) return { current: 0, practicedToday: false };
    const daysSince = Math.round(
      (startOfDay(new Date()).getTime() - startOfDay(streak.lastActivityDate).getTime()) / DAY_MS,
    );
    return {
      current: daysSince <= 1 ? streak.currentStreak : 0,
      practicedToday: daysSince <= 0,
    };
  }
}
