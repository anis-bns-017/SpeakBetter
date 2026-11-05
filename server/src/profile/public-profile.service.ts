import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { BADGES, type BadgeTier } from '../gamification/badges.catalog';
import { LEAGUES } from '../gamification/leagues.engine';

const TIER_RANK: Record<BadgeTier, number> = { BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3, DIAMOND: 4 };
const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]));
/** Badges shown up front on a profile; the rest sit behind "see all" */
export const SHOWCASE_SIZE = 6;

export interface EarnedBadge {
  key: string;
  name: string;
  description: string;
  tier: BadgeTier;
  icon: string;
  earnedAt: Date;
}

/** Badges a person has earned, best tier first, newest first within a tier. Unknown (retired) badges are left out. */
export function earnedBadges(rows: Array<{ badgeId: string; earnedAt: Date }>): EarnedBadge[] {
  return rows
    .flatMap((r) => {
      const def = BADGE_BY_KEY.get(r.badgeId);
      return def ? [{ key: def.key, name: def.name, description: def.description, tier: def.tier, icon: def.icon, earnedAt: r.earnedAt }] : [];
    })
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.earnedAt.getTime() - a.earnedAt.getTime());
}

@Injectable()
export class PublicProfileService {
  constructor(private prisma: PrismaService) {}

  /**
   * What `viewerId` sees when they open `targetId`'s profile. Never includes contact details, birth date or
   * time zone. People who turned off "show my profile publicly" only show a name and photo, except to
   * themselves and their friends. Blocked in either direction looks the same as "not found".
   */
  async get(viewerId: string, targetId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        profile: {
          select: {
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            country: true,
            nativeLanguage: true,
            learningLanguages: true,
            interests: true,
            level: true,
            isVerified: true,
            lastActive: true,
          },
        },
        settings: { select: { showProfilePublic: true, showOnlineStatus: true } },
      },
    });
    if (!user) throw new NotFoundException('Profile not found');

    const isMe = viewerId === targetId;
    const [blocked, following, followedBy, friend, request] = await Promise.all([
      isMe
        ? null
        : this.prisma.block.findFirst({
            where: { OR: [{ blockerId: viewerId, blockedId: targetId }, { blockerId: targetId, blockedId: viewerId }] },
            select: { id: true },
          }),
      isMe ? 0 : this.prisma.follow.count({ where: { followerId: viewerId, followingId: targetId } }),
      isMe ? 0 : this.prisma.follow.count({ where: { followerId: targetId, followingId: viewerId } }),
      isMe
        ? null
        : this.prisma.friend.findFirst({
            where: { status: 'ACCEPTED', OR: [{ fromUserId: viewerId, toUserId: targetId }, { fromUserId: targetId, toUserId: viewerId }] },
            select: { id: true },
          }),
      isMe
        ? null
        : this.prisma.friendRequest.findFirst({
            where: { status: 'PENDING', OR: [{ fromUserId: viewerId, toUserId: targetId }, { fromUserId: targetId, toUserId: viewerId }] },
            select: { fromUserId: true },
          }),
    ]);
    if (blocked) throw new NotFoundException('Profile not found');

    const relationship = {
      isMe,
      following: following > 0,
      followedBy: followedBy > 0,
      isFriend: !!friend,
      friendRequest: request ? (request.fromUserId === viewerId ? ('sent' as const) : ('received' as const)) : null,
    };

    const name = user.profile?.displayName?.trim() || user.name;
    const avatarUrl = user.profile?.avatarUrl ?? user.avatarUrl ?? null;
    const isPublic = user.settings?.showProfilePublic !== false;
    if (!isMe && !isPublic && !relationship.isFriend) {
      return { id: user.id, name, avatarUrl, private: true as const, relationship };
    }

    const [xp, streak, badgeRows, league, followers, followingCount, friends, lessonsPassed, textsRead, challengeAnswers] = await Promise.all([
      this.prisma.xpTransaction.aggregate({ where: { userId: targetId }, _sum: { amount: true } }),
      this.prisma.streak.findUnique({ where: { userId: targetId } }),
      this.prisma.userBadge.findMany({ where: { userId: targetId }, select: { badgeId: true, earnedAt: true } }),
      this.prisma.leagueProfile.findUnique({ where: { userId: targetId } }),
      this.prisma.follow.count({ where: { followingId: targetId } }),
      this.prisma.follow.count({ where: { followerId: targetId } }),
      this.prisma.friend.count({ where: { status: 'ACCEPTED', OR: [{ fromUserId: targetId }, { toUserId: targetId }] } }),
      this.prisma.grammarProgress.count({ where: { userId: targetId, completedAt: { not: null } } }),
      this.prisma.libraryProgress.count({ where: { userId: targetId, completedAt: { not: null } } }),
      this.prisma.challengeEntry.count({ where: { userId: targetId } }),
    ]);

    const badges = earnedBadges(badgeRows);
    const tier = Math.min(Math.max(league?.tier ?? 0, 0), LEAGUES.length - 1);
    const showOnline = user.settings?.showOnlineStatus !== false;
    const p = user.profile;

    return {
      id: user.id,
      private: false as const,
      name,
      username: p?.username ?? null,
      avatarUrl,
      bio: p?.bio ?? null,
      country: p?.country ?? null,
      nativeLanguage: p?.nativeLanguage ?? null,
      learningLanguages: p?.learningLanguages ?? [],
      interests: p?.interests ?? [],
      level: p?.level ?? null,
      isVerified: !!p?.isVerified,
      joinedAt: user.createdAt,
      lastActive: showOnline ? (p?.lastActive ?? null) : null,
      stats: {
        xp: xp._sum.amount ?? 0,
        streak: ActivityService.effectiveStreak(streak).current,
        longestStreak: Math.max(streak?.longestStreak ?? 0, streak?.currentStreak ?? 0),
        lessonsPassed,
        textsRead,
        challengeAnswers,
        followers,
        following: followingCount,
        friends,
      },
      league: league ? { index: tier, name: LEAGUES[tier].name, color: LEAGUES[tier].color, best: LEAGUES[Math.min(league.bestTier, LEAGUES.length - 1)].name } : null,
      badges: { total: BADGES.length, earned: badges.length, showcase: badges.slice(0, SHOWCASE_SIZE), all: badges },
      relationship,
    };
  }
}
