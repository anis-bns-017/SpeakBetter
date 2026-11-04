import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadgesService } from './badges.service';
import { BADGE_BY_KEY } from './badges.catalog';
import {
  clampTier,
  GROUP_SIZE,
  LEAGUES,
  nextTier,
  rankGroup,
  weekEndOf,
  weekFromKey,
  weekKey,
  weekStartOf,
  type Zone,
} from './leagues.engine';

const TICK_MS = 2 * 60 * 1000;
/** Most people placed into groups in one background pass */
const SYNC_BATCH = 500;
/** "X passed you" at most this many times a day per person, so it never feels like spam */
const OVERTAKES_PER_DAY = 3;
/** Sunday from this hour the near-promotion and demotion nudges go out (once a week each) */
const NUDGE_FROM_HOUR = 17;
/** Only nudge when promotion is this close */
const NUDGE_WITHIN_XP = 60;
const FRIENDS_LIMIT = 50;
/** A week's results screen is only shown for this long after the week ends */
const RESULT_FRESH_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const RESULT_TEXT: Record<Zone, (league: string, next: string) => string> = {
  promote: (_league, next) => `You moved up to the ${next} league!`,
  stay: (league) => `You stay in the ${league} league.`,
  demote: (_league, next) => `You dropped to the ${next} league. Earn a bit more XP this week to climb back.`,
};

/**
 * The weekly leagues. People join this week's group the first time they earn XP; groups are ranked live from
 * XP; when the week is over the background pass settles each group, moves people up or down, and tells them.
 */
@Injectable()
export class LeaguesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaguesService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastPass = new Date();
  /** Each live group's ranks at the last pass (in memory: after a restart the next pass is the baseline) */
  private lastRanks = new Map<string, Map<string, number>>();

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private badges: BadgesService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tierOf(userId: string): Promise<number> {
    const profile = await this.prisma.leagueProfile.upsert({ where: { userId }, create: { userId }, update: {} });
    return clampTier(profile.tier);
  }

  /** Puts someone in an open group of their league for the week (or makes a new group) */
  async join(userId: string, week: string) {
    const existing = await this.prisma.leagueMember.findUnique({ where: { userId_weekStart: { userId, weekStart: week } } });
    if (existing) return existing;
    const tier = await this.tierOf(userId);
    const open = await this.prisma.leagueGroup.findMany({
      where: { weekStart: week, tier, finalizedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, _count: { select: { members: true } } },
    });
    const group = open.find((g) => g._count.members < GROUP_SIZE) ?? (await this.prisma.leagueGroup.create({ data: { weekStart: week, tier } }));
    try {
      return await this.prisma.leagueMember.create({ data: { groupId: group.id, userId, weekStart: week, tier } });
    } catch (error) {
      // Joined from another request at the same moment
      if ((error as { code?: string })?.code === 'P2002') {
        return this.prisma.leagueMember.findUnique({ where: { userId_weekStart: { userId, weekStart: week } } });
      }
      throw error;
    }
  }

  /** Everyone who has earned XP this week but is not in a group yet joins one */
  async syncWeek(now = new Date()) {
    const week = weekKey(now);
    const [active, members] = await Promise.all([
      this.prisma.xpTransaction.findMany({
        where: { createdAt: { gte: weekStartOf(now) }, amount: { gt: 0 } },
        distinct: ['userId'],
        select: { userId: true },
        take: SYNC_BATCH,
      }),
      this.prisma.leagueMember.findMany({ where: { weekStart: week }, select: { userId: true } }),
    ]);
    const inGroup = new Set(members.map((m) => m.userId));
    let joined = 0;
    for (const { userId } of active) {
      if (inGroup.has(userId)) continue;
      await this.join(userId, week);
      joined++;
    }
    return joined;
  }

  /** XP each member earned in their group's week */
  private async weeklyXp(userIds: string[], week: string) {
    const start = weekFromKey(week);
    const rows = await this.prisma.xpTransaction.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, createdAt: { gte: start, lt: weekEndOf(start) } },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.userId, r._sum.amount ?? 0]));
  }

  /** Settles every group whose week is over: ranks, moves people, and tells each of them */
  async finalizeDue(now = new Date()) {
    const current = weekKey(now);
    const due = await this.prisma.leagueGroup.findMany({
      where: { finalizedAt: null, weekStart: { lt: current } },
      include: { members: true },
      take: 50,
    });
    let settled = 0;
    for (const group of due) {
      // Claim the group first, so two server instances never settle it twice
      const { count } = await this.prisma.leagueGroup.updateMany({ where: { id: group.id, finalizedAt: null }, data: { finalizedAt: now } });
      if (!count) continue;
      const xp = await this.weeklyXp(group.members.map((m) => m.userId), group.weekStart);
      const ranked = rankGroup(
        group.members.map((m) => ({ userId: m.userId, xp: xp.get(m.userId) ?? 0, joinedAt: m.createdAt })),
        group.tier,
      );
      for (const r of ranked) {
        const member = group.members.find((m) => m.userId === r.userId);
        if (!member) continue;
        const next = nextTier(group.tier, r.zone);
        const podium = r.rank <= 3 && r.xp > 0 && ranked.length >= 2;
        await this.prisma.leagueMember.update({ where: { id: member.id }, data: { xp: r.xp, rank: r.rank, result: r.zone } });
        const profile = await this.prisma.leagueProfile.upsert({ where: { userId: r.userId }, create: { userId: r.userId }, update: {} });
        await this.prisma.leagueProfile.update({
          where: { userId: r.userId },
          data: {
            tier: next,
            bestTier: Math.max(profile.bestTier, next),
            ...(r.zone === 'promote' ? { promotions: { increment: 1 } } : {}),
            ...(podium ? { podiums: { increment: 1 } } : {}),
          },
        });
        const league = LEAGUES[group.tier].name;
        void this.notifications.notify([r.userId], {
          type: 'ACHIEVEMENT',
          title: `League results: #${r.rank} in ${league}`,
          message: `${r.xp} XP this week. ${RESULT_TEXT[r.zone](league, LEAGUES[next].name)}`,
          actionUrl: '/leagues',
          data: { tier: group.tier, nextTier: next, rank: r.rank, result: r.zone },
          dedupeKey: `league:${group.id}`,
          preference: 'achievements',
        });
        await this.badges.evaluate(r.userId);
      }
      settled++;
    }
    return settled;
  }

  /** Your league this week: your group ranked live, where the lines are, and how last week ended */
  async current(userId: string) {
    const now = new Date();
    const week = weekKey(now);
    const start = weekStartOf(now);
    const [earnedThisWeek, lastResult] = await Promise.all([
      this.prisma.xpTransaction.count({ where: { userId, createdAt: { gte: start }, amount: { gt: 0 } } }),
      this.prisma.leagueMember.findFirst({
        where: { userId, weekStart: { lt: week }, result: { not: null } },
        orderBy: { weekStart: 'desc' },
        select: { weekStart: true, tier: true, rank: true, xp: true, result: true },
      }),
    ]);
    if (earnedThisWeek > 0) await this.join(userId, week);

    const tier = await this.tierOf(userId);
    const base = {
      weekStart: start,
      endsAt: weekEndOf(start),
      tier: { index: tier, name: LEAGUES[tier].name, color: LEAGUES[tier].color },
      leagues: LEAGUES.map((l, index) => ({ index, name: l.name, color: l.color })),
      lastResult: lastResult
        ? { ...lastResult, league: LEAGUES[clampTier(lastResult.tier)].name }
        : null,
    };

    const me = await this.prisma.leagueMember.findUnique({ where: { userId_weekStart: { userId, weekStart: week } } });
    if (!me) return { ...base, joined: false as const, standings: [], promote: 0, demote: 0, myRank: null };

    const members = await this.prisma.leagueMember.findMany({
      where: { groupId: me.groupId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const xp = await this.weeklyXp(members.map((m) => m.userId), week);
    const ranked = rankGroup(
      members.map((m) => ({ userId: m.userId, xp: xp.get(m.userId) ?? 0, joinedAt: m.createdAt })),
      me.tier,
    );
    const byId = new Map(members.map((m) => [m.userId, m.user]));
    const standings = ranked.map((r) => ({
      rank: r.rank,
      userId: r.userId,
      name: byId.get(r.userId)?.name ?? 'Learner',
      avatarUrl: byId.get(r.userId)?.avatarUrl ?? null,
      xp: r.xp,
      zone: r.zone,
      isMe: r.userId === userId,
    }));
    return {
      ...base,
      tier: { index: me.tier, name: LEAGUES[me.tier].name, color: LEAGUES[me.tier].color },
      joined: true as const,
      standings,
      promote: ranked.filter((r) => r.zone === 'promote').length,
      demote: ranked.filter((r) => r.zone === 'demote').length,
      myRank: standings.find((s) => s.isMe)?.rank ?? null,
    };
  }

  /** This week's live groups, each ranked from XP so far */
  private async liveGroups(now: Date) {
    const week = weekKey(now);
    const groups = await this.prisma.leagueGroup.findMany({
      where: { weekStart: week, finalizedAt: null },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
      take: 200,
    });
    const result: Array<{ id: string; tier: number; week: string; ranked: ReturnType<typeof rankGroup>; names: Map<string, string> }> = [];
    for (const group of groups) {
      if (!group.members.length) continue;
      const xp = await this.weeklyXp(group.members.map((m) => m.userId), week);
      result.push({
        id: group.id,
        tier: group.tier,
        week,
        ranked: rankGroup(group.members.map((m) => ({ userId: m.userId, xp: xp.get(m.userId) ?? 0, joinedAt: m.createdAt })), group.tier),
        names: new Map(group.members.map((m) => [m.userId, m.user?.name ?? 'Someone'])),
      });
    }
    return result;
  }

  /**
   * Tells people when someone in their group passes them. Compares each group with how it stood at the last
   * pass; each pair is announced once a week, and nobody gets more than a few of these a day.
   */
  async sendOvertakeAlerts(now = new Date()) {
    let sent = 0;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    for (const group of await this.liveGroups(now)) {
      const before = this.lastRanks.get(group.id);
      const after = new Map(group.ranked.map((r) => [r.userId, r.rank]));
      this.lastRanks.set(group.id, after);
      if (!before) continue;

      for (const passed of group.ranked) {
        const was = before.get(passed.userId);
        if (was === undefined || passed.rank <= was) continue;
        // Everyone who was behind them and is now ahead
        const passers = group.ranked.filter((p) => {
          const pWas = before.get(p.userId);
          return p.userId !== passed.userId && p.xp > 0 && pWas !== undefined && pWas > was && p.rank < passed.rank;
        });
        for (const passer of passers) {
          const alreadyToday = await this.prisma.notification.count({
            where: { userId: passed.userId, dedupeKey: { startsWith: 'overtake:' }, createdAt: { gte: today } },
          });
          if (alreadyToday >= OVERTAKES_PER_DAY) break;
          const gap = passer.xp - passed.xp + 1;
          sent += await this.notifications.notify([passed.userId], {
            type: 'REMINDER',
            title: `${group.names.get(passer.userId)} just passed you`,
            message: `You're now #${passed.rank} in the ${LEAGUES[group.tier].name} league. ${gap} XP wins your place back.`,
            actionUrl: '/dashboard',
            data: { kind: 'overtake', by: passer.userId, rank: passed.rank, gap },
            dedupeKey: `overtake:${group.week}:${passer.userId}:${passed.userId}`,
            preference: 'achievements',
          });
        }
      }
    }
    // Groups that are over no longer need a snapshot
    const live = new Set((await this.prisma.leagueGroup.findMany({ where: { finalizedAt: null }, select: { id: true } })).map((g) => g.id));
    for (const id of this.lastRanks.keys()) if (!live.has(id)) this.lastRanks.delete(id);
    return sent;
  }

  /**
   * Sunday evening: a nudge for people within reach of promotion, and for people in the demotion zone.
   * Once a week each, and only when it can still make a difference.
   */
  async sendSundayNudges(now = new Date()) {
    if (now.getDay() !== 0 || now.getHours() < NUDGE_FROM_HOUR) return 0;
    const hoursLeft = Math.max(1, Math.round((weekEndOf(weekStartOf(now)).getTime() - now.getTime()) / (60 * 60 * 1000)));
    let sent = 0;
    for (const group of await this.liveGroups(now)) {
      const promoteCount = group.ranked.filter((r) => r.zone === 'promote').length;
      const lastPromoted = promoteCount ? group.ranked[promoteCount - 1] : null;
      const firstDemoted = group.ranked.find((r) => r.zone === 'demote');
      const safeAbove = firstDemoted ? group.ranked[firstDemoted.rank - 2] : null;
      for (const r of group.ranked) {
        let message: string | null = null;
        let title = '';
        if (r.zone === 'stay' && lastPromoted && r.xp > 0) {
          const need = lastPromoted.xp - r.xp + 1;
          if (need <= NUDGE_WITHIN_XP) {
            title = 'Promotion is within reach';
            message = `${need} XP more puts you in the promotion zone. ${hoursLeft}h left this week.`;
          }
        } else if (r.zone === 'demote' && group.tier > 0) {
          const need = Math.max(1, (safeAbove?.xp ?? 0) - r.xp + 1);
          title = "You're in the demotion zone";
          message = `Earn ${need} XP to stay in the ${LEAGUES[group.tier].name} league. ${hoursLeft}h left this week.`;
        }
        if (!message) continue;
        sent += await this.notifications.notify([r.userId], {
          type: 'REMINDER',
          title,
          message,
          actionUrl: '/dashboard',
          data: { kind: 'league-nudge', zone: r.zone },
          dedupeKey: `nudge:${group.week}:${r.userId}`,
          preference: 'achievements',
        });
      }
    }
    return sent;
  }

  /** This week's XP among you, your friends and the people you follow */
  async friends(userId: string) {
    const now = new Date();
    const [friendRows, followRows] = await Promise.all([
      this.prisma.friend.findMany({
        where: { status: 'ACCEPTED', OR: [{ fromUserId: userId }, { toUserId: userId }] },
        select: { fromUserId: true, toUserId: true },
        take: 500,
      }),
      this.prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true }, take: 500 }),
    ]);
    const ids = [
      ...new Set([
        userId,
        ...friendRows.map((f) => (f.fromUserId === userId ? f.toUserId : f.fromUserId)),
        ...followRows.map((f) => f.followingId),
      ]),
    ];
    const [xp, users, profiles] = await Promise.all([
      this.weeklyXp(ids, weekKey(now)),
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatarUrl: true } }),
      this.prisma.leagueProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, tier: true } }),
    ]);
    const tierOf = new Map(profiles.map((p) => [p.userId, clampTier(p.tier)]));
    const rows = users
      .map((u) => ({
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        xp: xp.get(u.id) ?? 0,
        league: LEAGUES[tierOf.get(u.id) ?? 0].name,
        leagueColor: LEAGUES[tierOf.get(u.id) ?? 0].color,
        isMe: u.id === userId,
      }))
      .sort((a, b) => b.xp - a.xp || Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name))
      .slice(0, FRIENDS_LIMIT)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    return { weekStart: weekStartOf(now), endsAt: weekEndOf(weekStartOf(now)), people: rows, hasFriends: rows.length > 1 };
  }

  /** What to celebrate when the learner opens the app: new badges, and last week's result if not seen yet */
  async celebrations(userId: string) {
    const since = new Date(Date.now() - RESULT_FRESH_DAYS * DAY_MS);
    const [badges, result] = await Promise.all([
      this.prisma.userBadge.findMany({
        where: { userId, seenAt: null, earnedAt: { gte: since } },
        orderBy: { earnedAt: 'desc' },
        take: 3,
        select: { badgeId: true, earnedAt: true },
      }),
      this.prisma.leagueMember.findFirst({
        where: { userId, result: { not: null }, seenAt: null, group: { finalizedAt: { gte: since } } },
        orderBy: { weekStart: 'desc' },
        include: { group: { select: { _count: { select: { members: true } } } } },
      }),
    ]);
    return {
      badges: badges
        .map((b) => {
          const def = BADGE_BY_KEY.get(b.badgeId);
          return def ? { key: def.key, name: def.name, description: def.description, tier: def.tier, icon: def.icon, earnedAt: b.earnedAt } : null;
        })
        .filter((b): b is NonNullable<typeof b> => !!b),
      league: result
        ? {
            weekStart: result.weekStart,
            rank: result.rank,
            xp: result.xp ?? 0,
            result: result.result as Zone,
            groupSize: result.group._count.members,
            from: { index: result.tier, name: LEAGUES[clampTier(result.tier)].name, color: LEAGUES[clampTier(result.tier)].color },
            to: (() => {
              const next = nextTier(result.tier, result.result as Zone);
              return { index: next, name: LEAGUES[next].name, color: LEAGUES[next].color };
            })(),
          }
        : null,
    };
  }

  /** Marks what was celebrated, so it is shown once */
  async markCelebrated(userId: string, input: { badges?: unknown; league?: unknown }) {
    const now = new Date();
    await Promise.all([
      input.badges ? this.prisma.userBadge.updateMany({ where: { userId, seenAt: null }, data: { seenAt: now } }) : null,
      input.league ? this.prisma.leagueMember.updateMany({ where: { userId, seenAt: null, result: { not: null } }, data: { seenAt: now } }) : null,
    ]);
    return { ok: true };
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    const started = new Date();
    try {
      await this.finalizeDue(started);
      await this.syncWeek(started);
      await this.sendOvertakeAlerts(started);
      await this.sendSundayNudges(started);
      await this.badges.evaluateActiveSince(new Date(this.lastPass.getTime() - 5000));
      this.lastPass = started;
    } catch (error) {
      this.logger.warn(`League pass failed: ${(error as Error)?.message}`);
    } finally {
      this.running = false;
    }
  }
}
