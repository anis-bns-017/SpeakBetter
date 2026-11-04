import { BADGES, levelsGained, newlyEarned, progressOf, type LearnerStats } from './badges.catalog';
import { nextTier, rankGroup, TOP_TIER, weekKey, weekStartOf, zoneSizes } from './leagues.engine';

const zero: LearnerStats = {
  totalXp: 0,
  longestStreak: 0,
  speakingMinutes: 0,
  reviews: 0,
  wordsSaved: 0,
  pronunciationTries: 0,
  perfectPronunciations: 0,
  correctionsGiven: 0,
  correctionsAccepted: 0,
  plansCompleted: 0,
  bestPlanStreak: 0,
  levelTests: 0,
  levelsGained: 0,
  followers: 0,
  friends: 0,
  leaguePromotions: 0,
  leaguePodiums: 0,
  bestLeagueTier: 0,
  challenges: 0,
  reactionsReceived: 0,
  textsRead: 0,
  lessonsPassed: 0,
  perfectLessons: 0,
  hardTextsPerfect: 0,
  questWeeks: 0,
  freezesUsed: 0,
};

describe('badges', () => {
  it('has unique keys and sensible targets', () => {
    const keys = BADGES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(BADGES.every((b) => b.target > 0)).toBe(true);
  });

  it('awards the badges whose rule is met, once', () => {
    const stats = { ...zero, longestStreak: 8, totalXp: 120 };
    expect(newlyEarned(stats, []).map((b) => b.key)).toEqual(['streak-3', 'streak-7', 'xp-100']);
    expect(newlyEarned(stats, ['streak-3', 'streak-7']).map((b) => b.key)).toEqual(['xp-100']);
    expect(newlyEarned(zero, [])).toEqual([]);
  });

  it('shows progress capped at the target', () => {
    const badge = BADGES.find((b) => b.key === 'speak-60')!;
    expect(progressOf(badge, { ...zero, speakingMinutes: 12.7 })).toEqual({ value: 12, target: 60 });
    expect(progressOf(badge, { ...zero, speakingMinutes: 500 })).toEqual({ value: 60, target: 60 });
  });

  it('counts levels climbed between the first and the latest test', () => {
    expect(levelsGained(['A2', 'B1'])).toBe(1);
    expect(levelsGained(['B1', 'A2'])).toBe(0);
    expect(levelsGained(['A1', null, 'B2'])).toBe(3);
    expect(levelsGained(['B1'])).toBe(0);
  });
});

describe('league weeks', () => {
  it('starts weeks on Monday', () => {
    const wednesday = new Date(2026, 10, 4, 15); // Wed 4 Nov 2026
    expect(weekStartOf(wednesday).getDay()).toBe(1);
    expect(weekKey(wednesday)).toBe('2026-11-02');
    expect(weekKey(new Date(2026, 10, 8, 23))).toBe('2026-11-02'); // Sunday is the same week
    expect(weekKey(new Date(2026, 10, 9, 0, 1))).toBe('2026-11-09');
  });
});

describe('zoneSizes', () => {
  it('sends 7 up and 5 down from a full group', () => {
    expect(zoneSizes(30, 3)).toEqual({ promote: 7, demote: 5 });
  });

  it('scales down for small groups and spares groups under 5 from demotion', () => {
    expect(zoneSizes(10, 3)).toEqual({ promote: 2, demote: 2 });
    expect(zoneSizes(4, 3)).toEqual({ promote: 1, demote: 0 });
    expect(zoneSizes(1, 0)).toEqual({ promote: 1, demote: 0 });
  });

  it('has nowhere to go up from Diamond or down from Bronze', () => {
    expect(zoneSizes(30, TOP_TIER).promote).toBe(0);
    expect(zoneSizes(30, 0).demote).toBe(0);
  });
});

describe('rankGroup', () => {
  const t = (minutes: number) => new Date(2026, 10, 2, 9, minutes);

  it('ranks by XP, breaks ties by who joined first, and marks the zones', () => {
    const ranked = rankGroup(
      [
        { userId: 'c', xp: 50, joinedAt: t(3) },
        { userId: 'a', xp: 120, joinedAt: t(1) },
        { userId: 'b', xp: 50, joinedAt: t(2) },
        { userId: 'd', xp: 10, joinedAt: t(4) },
        { userId: 'e', xp: 5, joinedAt: t(5) },
      ],
      2,
    );
    expect(ranked.map((r) => [r.userId, r.rank, r.zone])).toEqual([
      ['a', 1, 'promote'],
      ['b', 2, 'stay'],
      ['c', 3, 'stay'],
      ['d', 4, 'stay'],
      ['e', 5, 'demote'],
    ]);
  });

  it('never promotes someone with no XP, and drops them from a higher league', () => {
    const ranked = rankGroup(
      [
        { userId: 'a', xp: 0, joinedAt: t(1) },
        { userId: 'b', xp: 0, joinedAt: t(2) },
      ],
      1,
    );
    expect(ranked.map((r) => r.zone)).toEqual(['demote', 'demote']);
    expect(rankGroup([{ userId: 'a', xp: 0, joinedAt: t(1) }], 0)[0].zone).toBe('stay');
  });

  it('moves people a league at a time and stays inside the ladder', () => {
    expect(nextTier(0, 'promote')).toBe(1);
    expect(nextTier(0, 'demote')).toBe(0);
    expect(nextTier(TOP_TIER, 'promote')).toBe(TOP_TIER);
    expect(nextTier(4, 'stay')).toBe(4);
  });
});
