// server/src/learning/activity.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { XpReason } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { addDays, dayIn, daysBetween, learnerZone, startOfDayIn, startOfDayKey } from '../common/learner-day';

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

const HOUR_MS = 60 * 60 * 1000;

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
      await this.grantXp(userId, amount, reason);
      await this.touchStreak(userId);
    } catch (error) {
      this.logger.warn(`Could not record activity for ${userId}: ${error?.message}`);
    }
  }

  /** XP alone, for something finished on an earlier day: it must not make today count as a practice day */
  async grantXp(userId: string, amount: number, reason: XpReason) {
    if (!userId || amount <= 0) return;
    await this.prisma.$transaction([
      this.prisma.xpTransaction.create({ data: { userId, amount, reason } }),
      // updateMany: users without a profile row shouldn't make this throw
      this.prisma.profile.updateMany({
        where: { userId },
        data: { xp: { increment: amount } },
      }),
    ]);
  }

  /** Like recordActivity, but stops awarding XP for `reason` once today's total reaches `dailyCap` */
  async recordCappedActivity(userId: string, amount: number, reason: XpReason, dailyCap: number) {
    if (!userId) return;
    try {
      // The cap resets at the learner's own midnight
      const today = startOfDayIn(new Date(), await learnerZone(this.prisma, userId));
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

  /**
   * Spends streak freezes on the days missed since the last practice, if there are enough to cover all of
   * them (a freeze is never wasted on a streak that is lost anyway). The streak then carries on from
   * yesterday, without growing for the frozen days. Returns how many were used.
   */
  async useFreezes(userId: string, now = new Date(), zone?: string): Promise<number> {
    const row = await this.prisma.streak.findUnique({ where: { userId } });
    if (!row || row.currentStreak <= 0 || row.freezes <= 0) return 0;
    zone ??= await learnerZone(this.prisma, userId);
    const todayKey = dayIn(now, zone);
    const lastKey = dayIn(row.lastActivityDate, zone);
    const missed = daysBetween(lastKey, todayKey) - 1;
    if (missed <= 0 || missed > row.freezes) return 0;

    // Midday yesterday on their clock: the streak then carries on from yesterday
    const yesterday = new Date(startOfDayKey(todayKey, zone).getTime() - 12 * HOUR_MS);
    // Matching the old date means two requests at once cannot both spend the freezes
    const { count } = await this.prisma.streak.updateMany({
      where: { userId, lastActivityDate: row.lastActivityDate, freezes: { gte: missed } },
      data: { freezes: { decrement: missed }, lastActivityDate: yesterday },
    });
    if (!count) return 0;

    const days = Array.from({ length: missed }, (_, i) => addDays(lastKey, i + 1));
    await this.prisma.streakFreezeUse.createMany({
      data: days.map((day) => ({ userId, day, streak: row.currentStreak })),
      skipDuplicates: true,
    });
    return missed;
  }

  /** Practising on consecutive days grows the streak; missing a day restarts it at 1 (unless a freeze covers it) */
  async touchStreak(userId: string) {
    const now = new Date();
    const zone = await learnerZone(this.prisma, userId);
    await this.useFreezes(userId, now, zone);
    const existing = await this.prisma.streak.findUnique({ where: { userId } });

    let current = 1;
    let longest = 1;
    if (existing) {
      const daysSince = daysBetween(dayIn(existing.lastActivityDate, zone), dayIn(now, zone));
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

  /**
   * The streak as the learner sees it: it survives if they practised today or yesterday, or if the freezes
   * they hold cover every day missed since (they are spent the next time the streak is touched).
   */
  static effectiveStreak(
    streak: { currentStreak: number; lastActivityDate: Date; freezes?: number } | null,
    now = new Date(),
    zone?: string | null,
  ) {
    if (!streak) return { current: 0, practicedToday: false, freezes: 0 };
    const daysSince = daysBetween(dayIn(streak.lastActivityDate, zone), dayIn(now, zone));
    const freezes = streak.freezes ?? 0;
    const alive = daysSince <= 1 || (streak.currentStreak > 0 && daysSince - 1 <= freezes);
    return {
      current: alive ? streak.currentStreak : 0,
      practicedToday: daysSince <= 0,
      freezes,
    };
  }
}
