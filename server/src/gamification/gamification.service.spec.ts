import { BadgesService, longestRun } from './badges.service';
import { LeaguesService } from './leagues.service';
import { weekKey } from './leagues.engine';

describe('longestRun', () => {
  it('finds the longest run of consecutive days', () => {
    expect(longestRun(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'])).toBe(3);
    expect(longestRun(['2026-10-31', '2026-11-01'])).toBe(2); // across a month end
    expect(longestRun([])).toBe(0);
  });
});

function badgesSetup(stats: Partial<Record<string, number>> = {}) {
  const owned: string[] = [];
  const prisma: any = {
    xpTransaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: stats.totalXp ?? 0 } }),
      groupBy: jest.fn().mockResolvedValue([{ reason: 'VOICE_SPEAKING', _sum: { amount: (stats.speakingMinutes ?? 0) * 4 }, _count: { _all: 1 } }]),
    },
    streak: { findUnique: jest.fn().mockResolvedValue({ longestStreak: stats.longestStreak ?? 0, currentStreak: 0 }) },
    flashcardReview: { aggregate: jest.fn().mockResolvedValue({ _sum: { reviewCount: 0 } }) },
    voiceSavedWord: { aggregate: jest.fn().mockResolvedValue({ _sum: { reviewCount: 0 } }), count: jest.fn().mockResolvedValue(0) },
    flashcard: { count: jest.fn().mockResolvedValue(0) },
    pronunciationAttempt: { count: jest.fn().mockResolvedValue(0) },
    dailyPlan: { findMany: jest.fn().mockResolvedValue([]) },
    placementAttempt: { findMany: jest.fn().mockResolvedValue([]) },
    follow: { count: jest.fn().mockResolvedValue(0) },
    friend: { count: jest.fn().mockResolvedValue(0) },
    leagueProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    challengeEntry: { count: jest.fn().mockResolvedValue(0) },
    challengeReaction: { count: jest.fn().mockResolvedValue(0) },
    libraryProgress: { findMany: jest.fn().mockResolvedValue([]) },
    questWeek: { count: jest.fn().mockResolvedValue(0) },
    streakFreezeUse: { count: jest.fn().mockResolvedValue(0) },
    userBadge: {
      findMany: jest.fn(async () => owned.map((badgeId) => ({ badgeId, earnedAt: new Date() }))),
      create: jest.fn(async ({ data }) => {
        if (owned.includes(data.badgeId)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        owned.push(data.badgeId);
        return data;
      }),
    },
  };
  const notifications: any = { notify: jest.fn().mockResolvedValue(1) };
  return { service: new BadgesService(prisma, notifications), notifications, owned };
}

describe('BadgesService', () => {
  it('gives each earned badge once and tells the learner', async () => {
    const { service, notifications, owned } = badgesSetup({ longestStreak: 4, totalXp: 150, speakingMinutes: 12 });
    const first = await service.evaluate('u1');
    expect(first.map((b) => b.key)).toEqual(['streak-3', 'xp-100', 'speak-10']);
    expect(owned).toEqual(['streak-3', 'xp-100', 'speak-10']);
    expect(notifications.notify).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({ type: 'ACHIEVEMENT', title: 'New badge: Warming up', dedupeKey: 'badge:streak-3', preference: 'achievements' }),
    );
    expect(await service.evaluate('u1')).toEqual([]);
  });

  it('lists every badge with progress towards the ones still to earn', async () => {
    const { service } = badgesSetup({ longestStreak: 4, speakingMinutes: 12 });
    const list = await service.list('u1');
    expect(list.total).toBeGreaterThan(20);
    expect(list.earned).toBe(2);
    const week = list.badges.find((b) => b.key === 'streak-7');
    expect(week).toMatchObject({ earnedAt: null, progress: { value: 4, target: 7 } });
    expect(list.recent.every((b) => b.isNew)).toBe(true);
  });
});

function leaguesSetup() {
  const groups: any[] = [];
  const members: any[] = [];
  const profiles = new Map<string, any>();
  const xpRows: Array<{ userId: string; amount: number; createdAt: Date }> = [];
  const prisma: any = {
    leagueProfile: {
      upsert: jest.fn(async ({ where }) => {
        if (!profiles.has(where.userId)) profiles.set(where.userId, { userId: where.userId, tier: 0, bestTier: 0, promotions: 0, podiums: 0 });
        return profiles.get(where.userId);
      }),
      update: jest.fn(async ({ where, data }) => {
        const p = profiles.get(where.userId);
        for (const [k, v] of Object.entries(data)) p[k] = typeof v === 'object' && v && 'increment' in v ? p[k] + (v as any).increment : v;
        return p;
      }),
    },
    leagueGroup: {
      findMany: jest.fn(async ({ where, include }) =>
        groups
          .filter(
            (g) =>
              (where.weekStart === undefined || (where.weekStart?.lt ? g.weekStart < where.weekStart.lt : g.weekStart === where.weekStart)) &&
              (where.tier === undefined || g.tier === where.tier) &&
              !g.finalizedAt,
          )
          .map((g) => ({
            ...g,
            _count: { members: members.filter((m) => m.groupId === g.id).length },
            ...(include ? { members: members.filter((m) => m.groupId === g.id).map((m) => ({ ...m, user: { id: m.userId, name: `Name ${m.userId}` } })) } : {}),
          })),
      ),
      create: jest.fn(async ({ data }) => {
        const g = { id: `g${groups.length + 1}`, createdAt: new Date(), finalizedAt: null, ...data };
        groups.push(g);
        return g;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const g = groups.find((x) => x.id === where.id && !x.finalizedAt);
        if (!g) return { count: 0 };
        Object.assign(g, data);
        return { count: 1 };
      }),
    },
    leagueMember: {
      findUnique: jest.fn(async ({ where }) => members.find((m) => m.userId === where.userId_weekStart.userId && m.weekStart === where.userId_weekStart.weekStart) ?? null),
      create: jest.fn(async ({ data }) => {
        const m = { id: `m${members.length + 1}`, createdAt: new Date(Date.now() + members.length), rank: null, result: null, ...data };
        members.push(m);
        return m;
      }),
      findMany: jest.fn(async ({ where }) =>
        members
          .filter((m) => (where.groupId ? m.groupId === where.groupId : m.weekStart === where.weekStart))
          .map((m) => ({ ...m, user: { id: m.userId, name: `Name ${m.userId}`, avatarUrl: null } })),
      ),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(async ({ where, data }) => Object.assign(members.find((m) => m.id === where.id), data)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    xpTransaction: {
      count: jest.fn(async ({ where }) => xpRows.filter((r) => r.userId === where.userId && r.createdAt >= where.createdAt.gte).length),
      findMany: jest.fn(async () => [...new Set(xpRows.map((r) => r.userId))].map((userId) => ({ userId }))),
      groupBy: jest.fn(async ({ where }) => {
        const sums = new Map<string, number>();
        for (const r of xpRows) {
          if (!where.userId.in.includes(r.userId) || r.createdAt < where.createdAt.gte || r.createdAt >= where.createdAt.lt) continue;
          sums.set(r.userId, (sums.get(r.userId) ?? 0) + r.amount);
        }
        return [...sums.entries()].map(([userId, amount]) => ({ userId, _sum: { amount } }));
      }),
    },
  };
  prisma.notification = { count: jest.fn().mockResolvedValue(0) };
  prisma.friend = { findMany: jest.fn().mockResolvedValue([]) };
  prisma.follow = { findMany: jest.fn().mockResolvedValue([]) };
  prisma.user = { findMany: jest.fn(async ({ where }) => where.id.in.map((id: string) => ({ id, name: `Name ${id}`, avatarUrl: null }))) };
  prisma.leagueProfile.findMany = jest.fn(async () => [...profiles.values()]);
  prisma.userBadge = { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }) };
  const notifications: any = { notify: jest.fn().mockResolvedValue(1) };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  return { service: new LeaguesService(prisma, notifications, badges), prisma, groups, members, profiles, xpRows, notifications, badges };
}

describe('LeaguesService', () => {
  it('puts people who earned XP this week into a group and ranks it live', async () => {
    const { service, xpRows, groups } = leaguesSetup();
    const now = new Date();
    xpRows.push({ userId: 'a', amount: 40, createdAt: now }, { userId: 'b', amount: 90, createdAt: now }, { userId: 'c', amount: 10, createdAt: now });
    expect(await service.syncWeek(now)).toBe(3);
    expect(groups).toHaveLength(1);

    const view = await service.current('a');
    expect(view.joined).toBe(true);
    expect(view.tier.name).toBe('Bronze');
    expect(view.standings.map((s) => [s.userId, s.rank, s.xp, s.zone])).toEqual([
      ['b', 1, 90, 'promote'],
      ['a', 2, 40, 'stay'],
      ['c', 3, 10, 'stay'],
    ]);
    expect(view.myRank).toBe(2);
  });

  it('shows the league without a group to someone who has not earned XP this week', async () => {
    const { service } = leaguesSetup();
    const view = await service.current('quiet');
    expect(view).toMatchObject({ joined: false, standings: [], tier: { name: 'Bronze' } });
  });

  it('settles a finished week once: moves people, counts podiums and tells everyone', async () => {
    const { service, xpRows, profiles, notifications, badges, members } = leaguesSetup();
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    xpRows.push({ userId: 'a', amount: 200, createdAt: lastWeek }, { userId: 'b', amount: 50, createdAt: lastWeek });
    await service.join('a', weekKey(lastWeek));
    await service.join('b', weekKey(lastWeek));

    expect(await service.finalizeDue()).toBe(1);
    expect(profiles.get('a')).toMatchObject({ tier: 1, bestTier: 1, promotions: 1, podiums: 1 });
    expect(profiles.get('b')).toMatchObject({ tier: 0, podiums: 1 });
    expect(members.map((m) => [m.userId, m.rank, m.result])).toEqual([
      ['a', 1, 'promote'],
      ['b', 2, 'stay'],
    ]);
    expect(notifications.notify).toHaveBeenCalledWith(
      ['a'],
      expect.objectContaining({ title: 'League results: #1 in Bronze', message: expect.stringMatching(/moved up to the Silver league/) }),
    );
    expect(badges.evaluate).toHaveBeenCalledWith('a');
    expect(await service.finalizeDue()).toBe(0);
  });
});

describe('LeaguesService live competition', () => {
  it('tells you once when someone passes you, and stays quiet otherwise', async () => {
    const { service, xpRows, notifications } = leaguesSetup();
    const now = new Date();
    xpRows.push({ userId: 'a', amount: 50, createdAt: now }, { userId: 'b', amount: 20, createdAt: now });
    await service.syncWeek(now);
    expect(await service.sendOvertakeAlerts(now)).toBe(0); // first pass is the baseline

    xpRows.push({ userId: 'b', amount: 40, createdAt: now }); // b: 60, a: 50
    expect(await service.sendOvertakeAlerts(now)).toBe(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      ['a'],
      expect.objectContaining({ type: 'REMINDER', title: 'Name b just passed you', message: expect.stringMatching(/#2 in the Bronze league\. 11 XP/) }),
    );
    expect(notifications.notify.mock.calls[0][1].dedupeKey).toMatch(/^overtake:.*:b:a$/);

    notifications.notify.mockClear();
    expect(await service.sendOvertakeAlerts(now)).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('stops overtake alerts after a few a day', async () => {
    const { service, xpRows, prisma, notifications } = leaguesSetup();
    const now = new Date();
    xpRows.push({ userId: 'a', amount: 50, createdAt: now }, { userId: 'b', amount: 20, createdAt: now });
    await service.syncWeek(now);
    await service.sendOvertakeAlerts(now);
    prisma.notification.count.mockResolvedValue(3);
    xpRows.push({ userId: 'b', amount: 40, createdAt: now });
    expect(await service.sendOvertakeAlerts(now)).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('nudges on Sunday evening only, when promotion is close', async () => {
    const { service, xpRows, notifications } = leaguesSetup();
    // Next Sunday at 18:00 and the Monday before it, in the same week
    const sunday = new Date();
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
    sunday.setHours(18, 0, 0, 0);
    const monday = new Date(sunday);
    monday.setDate(sunday.getDate() - 6);
    monday.setHours(10);
    for (const [id, xp] of [['a', 100], ['b', 80], ['c', 70], ['d', 60], ['e', 50]] as const) {
      xpRows.push({ userId: id, amount: xp, createdAt: monday });
    }
    await service.syncWeek(sunday);

    expect(await service.sendSundayNudges(new Date(sunday.getTime() - 3 * 60 * 60 * 1000))).toBe(0); // 15:00 is too early
    const sent = await service.sendSundayNudges(sunday);
    expect(sent).toBeGreaterThan(0);
    expect(notifications.notify).toHaveBeenCalledWith(
      ['b'],
      expect.objectContaining({ title: 'Promotion is within reach', message: expect.stringMatching(/^21 XP more/) }),
    );
  });

  it('ranks you against your friends and the people you follow', async () => {
    const { service, xpRows, prisma } = leaguesSetup();
    const now = new Date();
    prisma.friend.findMany.mockResolvedValue([{ fromUserId: 'me', toUserId: 'f1' }]);
    prisma.follow.findMany.mockResolvedValue([{ followingId: 'f2' }]);
    xpRows.push({ userId: 'f1', amount: 30, createdAt: now }, { userId: 'me', amount: 50, createdAt: now });
    const board = await service.friends('me');
    expect(board.hasFriends).toBe(true);
    expect(board.people.map((p) => [p.userId, p.rank, p.xp, p.isMe])).toEqual([
      ['me', 1, 50, true],
      ['f1', 2, 30, false],
      ['f2', 3, 0, false],
    ]);
  });

  it("shows last week's result once, with where you go next", async () => {
    const { service, prisma } = leaguesSetup();
    prisma.leagueMember.findFirst.mockResolvedValue({
      weekStart: '2026-10-26',
      tier: 1,
      rank: 2,
      xp: 140,
      result: 'promote',
      group: { _count: { members: 12 } },
    });
    const c = await service.celebrations('u1');
    expect(c.league).toMatchObject({ rank: 2, xp: 140, result: 'promote', groupSize: 12, from: { name: 'Silver' }, to: { name: 'Gold' } });
    await service.markCelebrated('u1', { league: true, badges: true });
    expect(prisma.leagueMember.updateMany).toHaveBeenCalled();
    expect(prisma.userBadge.updateMany).toHaveBeenCalled();
  });
});
