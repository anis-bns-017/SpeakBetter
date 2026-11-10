import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dayKey } from '../insights/plan.engine';
import { BADGES, levelsGained, newlyEarned, progressOf, type BadgeDef, type LearnerStats } from './badges.catalog';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A badge counts as new on the page for this long */
const NEW_FOR_MS = 3 * DAY_MS;
/** Badges a learner can pin to the top of their profile (the profile's showcase row) */
export const MAX_PINNED = 6;
/** Most people checked in one background pass */
const EVALUATE_BATCH = 200;

/** The longest run of consecutive days in a list of YYYY-MM-DD keys */
export function longestRun(days: string[]): number {
  const set = new Set(days);
  let best = 0;
  for (const day of set) {
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() - 1);
    if (set.has(dayKey(d))) continue; // not the start of a run
    let run = 1;
    const next = new Date(`${day}T12:00:00`);
    for (;;) {
      next.setDate(next.getDate() + 1);
      if (!set.has(dayKey(next))) break;
      run++;
    }
    best = Math.max(best, run);
  }
  return best;
}

@Injectable()
export class BadgesService implements OnModuleInit {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** The catalog lives in code; the Badge table mirrors it so UserBadge rows have something to point at */
  async onModuleInit() {
    try {
      await Promise.all(
        BADGES.map((b) =>
          this.prisma.badge.upsert({
            where: { id: b.key },
            create: { id: b.key, name: b.name, category: b.category, type: b.tier, icon: b.icon },
            update: { name: b.name, category: b.category, type: b.tier, icon: b.icon },
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(`Could not sync the badge catalog: ${(error as Error)?.message}`);
    }
  }

  /** Everything the badge rules look at, for one learner */
  async stats(userId: string): Promise<LearnerStats> {
    const [
      xp,
      xpByReason,
      streak,
      cardReviews,
      wordReviews,
      wordCards,
      savedWords,
      attempts,
      perfect,
      plans,
      placements,
      followers,
      friends,
      league,
      challenges,
      reactionsReceived,
      library,
      grammar,
      packsPassed,
      packWordsSaved,
      dictations,
      perfectDictations,
      scenariosDone,
      shadowingLessons,
      questWeeks,
      freezesUsed,
      piecesWritten,
      polishedPieces,
    ] = await Promise.all([
      this.prisma.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } }),
      this.prisma.xpTransaction.groupBy({
        by: ['reason'],
        where: { userId, reason: { in: ['VOICE_SPEAKING', 'AI_PRACTICE', 'CORRECTION_GIVEN', 'CORRECTION_ACCEPTED'] } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.streak.findUnique({ where: { userId }, select: { longestStreak: true, currentStreak: true } }),
      this.prisma.flashcardReview.aggregate({ where: { userId }, _sum: { reviewCount: true } }),
      this.prisma.voiceSavedWord.aggregate({ where: { userId }, _sum: { reviewCount: true } }),
      this.prisma.flashcard.count({ where: { userId, kind: 'word' } }),
      this.prisma.voiceSavedWord.count({ where: { userId } }),
      this.prisma.pronunciationAttempt.count({ where: { userId } }),
      this.prisma.pronunciationAttempt.count({ where: { userId, score: 100, target: { contains: ' ' } } }),
      this.prisma.dailyPlan.findMany({ where: { userId, completedAt: { not: null } }, select: { day: true } }),
      this.prisma.placementAttempt.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'asc' },
        select: { level: true },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.friend.count({ where: { status: 'ACCEPTED', OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
      this.prisma.leagueProfile.findUnique({ where: { userId } }),
      this.prisma.challengeEntry.count({ where: { userId } }),
      this.prisma.challengeReaction.count({ where: { entry: { userId } } }),
      this.prisma.libraryProgress.findMany({ where: { userId, completedAt: { not: null } }, select: { textId: true, bestScore: true, total: true } }),
      this.prisma.grammarProgress.findMany({ where: { userId, completedAt: { not: null } }, select: { bestScore: true, total: true } }),
      this.prisma.vocabPackProgress.count({ where: { userId, completedAt: { not: null } } }),
      this.prisma.flashcard.count({ where: { userId, source: 'pack' } }),
      this.prisma.dictationResult.count({ where: { userId } }),
      this.prisma.dictationResult.count({ where: { userId, score: 100 } }),
      this.prisma.roleplayProgress.count({ where: { userId } }),
      this.prisma.shadowingProgress.count({ where: { userId } }),
      this.prisma.questWeek.count({ where: { userId, completedAt: { not: null } } }),
      this.prisma.streakFreezeUse.count({ where: { userId } }),
      this.prisma.writingPiece.count({ where: { userId, submittedAt: { not: null } } }),
      this.prisma.writingPiece.count({ where: { userId, submittedAt: { not: null }, wordCount: { gte: 80 }, score: { gte: 95 } } }),
    ]);

    const reason = (r: string) => xpByReason.find((x) => x.reason === r);
    return {
      totalXp: xp._sum.amount ?? 0,
      longestStreak: Math.max(streak?.longestStreak ?? 0, streak?.currentStreak ?? 0),
      // 1 XP per 15 seconds spoken; each AI partner turn is about half a minute
      speakingMinutes: ((reason('VOICE_SPEAKING')?._sum.amount ?? 0) * 15) / 60 + (reason('AI_PRACTICE')?._count._all ?? 0) * 0.5,
      reviews: (cardReviews._sum.reviewCount ?? 0) + (wordReviews._sum.reviewCount ?? 0),
      wordsSaved: wordCards + savedWords,
      pronunciationTries: attempts,
      perfectPronunciations: perfect,
      correctionsGiven: reason('CORRECTION_GIVEN')?._count._all ?? 0,
      correctionsAccepted: reason('CORRECTION_ACCEPTED')?._count._all ?? 0,
      plansCompleted: plans.length,
      bestPlanStreak: longestRun(plans.map((p) => p.day)),
      levelTests: placements.length,
      levelsGained: levelsGained(placements.map((p) => p.level)),
      followers,
      friends,
      leaguePromotions: league?.promotions ?? 0,
      leaguePodiums: league?.podiums ?? 0,
      bestLeagueTier: league?.bestTier ?? 0,
      challenges,
      reactionsReceived,
      textsRead: library.length,
      // B2, C1 and C2 text ids start with their level
      hardTextsPerfect: library.filter((p) => /^(b2|c1|c2)-/.test(p.textId) && p.total > 0 && p.bestScore === p.total).length,
      packsPassed,
      packWordsSaved,
      dictations,
      perfectDictations,
      scenariosDone,
      shadowingLessons,
      lessonsPassed: grammar.length,
      perfectLessons: grammar.filter((g) => g.total > 0 && g.bestScore === g.total).length,
      questWeeks,
      freezesUsed,
      piecesWritten,
      polishedPieces,
    };
  }

  /** Gives every badge whose rule is now met (once each) and tells the learner. Returns the new ones. */
  async evaluate(userId: string): Promise<BadgeDef[]> {
    try {
      const [stats, owned] = await Promise.all([
        this.stats(userId),
        this.prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
      ]);
      const earned: BadgeDef[] = [];
      for (const badge of newlyEarned(stats, owned.map((o) => o.badgeId))) {
        try {
          await this.prisma.userBadge.create({ data: { userId, badgeId: badge.key } });
        } catch (error) {
          // Another pass gave it a moment ago
          if ((error as { code?: string })?.code === 'P2002') continue;
          throw error;
        }
        earned.push(badge);
        void this.notifications.notify([userId], {
          type: 'ACHIEVEMENT',
          title: `New badge: ${badge.name}`,
          message: badge.description,
          actionUrl: '/leagues?tab=badges',
          data: { badge: badge.key, tier: badge.tier, icon: badge.icon },
          dedupeKey: `badge:${badge.key}`,
          preference: 'achievements',
        });
      }
      return earned;
    } catch (error) {
      this.logger.warn(`Could not check badges for ${userId}: ${(error as Error)?.message}`);
      return [];
    }
  }

  /** Checks everyone who did something since `since` (the background pass) */
  async evaluateActiveSince(since: Date) {
    const [xp, follows] = await Promise.all([
      this.prisma.xpTransaction.findMany({ where: { createdAt: { gte: since } }, distinct: ['userId'], select: { userId: true }, take: EVALUATE_BATCH }),
      this.prisma.follow.findMany({ where: { createdAt: { gte: since } }, select: { followingId: true }, take: EVALUATE_BATCH }),
    ]);
    const ids = [...new Set([...xp.map((x) => x.userId), ...follows.map((f) => f.followingId)])];
    let awarded = 0;
    for (const id of ids) awarded += (await this.evaluate(id)).length;
    return awarded;
  }

  /** All badges with what you have earned and how close you are to the rest */
  async list(userId: string) {
    await this.evaluate(userId);
    const [stats, owned] = await Promise.all([
      this.stats(userId),
      this.prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true, earnedAt: true, pinnedAt: true } }),
    ]);
    const earnedAt = new Map(owned.map((o) => [o.badgeId, o.earnedAt]));
    const pinnedAt = new Map(owned.map((o) => [o.badgeId, o.pinnedAt]));
    const now = Date.now();
    const badges = BADGES.map((b) => {
      const when = earnedAt.get(b.key) ?? null;
      return {
        key: b.key,
        name: b.name,
        description: b.description,
        category: b.category,
        tier: b.tier,
        icon: b.icon,
        earnedAt: when,
        isNew: !!when && now - when.getTime() < NEW_FOR_MS,
        pinned: !!pinnedAt.get(b.key),
        progress: progressOf(b, stats),
      };
    });
    const earned = badges.filter((b) => b.earnedAt);
    return {
      badges,
      earned: earned.length,
      total: badges.length,
      pinnedCount: owned.filter((o) => o.pinnedAt).length,
      maxPinned: MAX_PINNED,
      recent: earned.sort((a, b) => (b.earnedAt as Date).getTime() - (a.earnedAt as Date).getTime()).slice(0, 3),
    };
  }

  /** Pins or unpins one of your own badges. Only earned badges can be pinned, and only MAX_PINNED at a time. */
  async setPinned(userId: string, badgeKey: string, pinned: boolean) {
    const row = await this.prisma.userBadge.findUnique({ where: { userId_badgeId: { userId, badgeId: badgeKey } }, select: { id: true, pinnedAt: true } });
    if (!row) throw new NotFoundException('You have not earned this badge yet');
    if (pinned && !row.pinnedAt) {
      const count = await this.prisma.userBadge.count({ where: { userId, pinnedAt: { not: null } } });
      if (count >= MAX_PINNED) throw new BadRequestException(`You can pin up to ${MAX_PINNED} badges. Unpin one first.`);
    }
    if (pinned === !!row.pinnedAt) return { key: badgeKey, pinned };
    await this.prisma.userBadge.update({ where: { id: row.id }, data: { pinnedAt: pinned ? new Date() : null } });
    return { key: badgeKey, pinned };
  }
}
