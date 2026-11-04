import { BadRequestException } from '@nestjs/common';
import { ActivityService } from '../learning/activity.service';
import { weekStartOf } from '../gamification/leagues.engine';
import {
  buildQuests,
  CHEST_XP,
  daysLeftInWeek,
  FREEZE_PRICE,
  intensity,
  MAX_FREEZES,
  newlyDone,
  QUEST_XP,
  questText,
  targetFor,
} from './quests.engine';
import { QuestsService } from './quests.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const monday = new Date(2026, 10, 2, 9); // Mon 2 Nov 2026

describe('quest rules', () => {
  it('makes one habit quest and two different activity quests', () => {
    const quests = buildQuests({ lastWeekXp: 300, daysLeft: 7, seed: 'u1:2026-11-02' });
    expect(quests).toHaveLength(3);
    expect(new Set(quests.map((q) => q.kind)).size).toBe(3);
    expect(['XP', 'DAYS', 'PLAN']).toContain(quests[2].kind);
    expect(quests.every((q) => q.xp === QUEST_XP && q.target > 0)).toBe(true);
  });

  it('gives the same learner the same quests all week, and other learners other mixes', () => {
    const a = buildQuests({ lastWeekXp: 0, daysLeft: 7, seed: 'u1:2026-11-02' });
    expect(buildQuests({ lastWeekXp: 0, daysLeft: 7, seed: 'u1:2026-11-02' })).toEqual(a);
    const mixes = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'].map((u) =>
      buildQuests({ lastWeekXp: 0, daysLeft: 7, seed: `${u}:2026-11-02` }).map((q) => q.kind).join(),
    ));
    expect(mixes.size).toBeGreaterThan(1);
  });

  it('avoids last week\'s kinds when it can', () => {
    const avoid = ['SPEAK', 'REVIEW', 'READ', 'XP'] as const;
    const quests = buildQuests({ lastWeekXp: 0, daysLeft: 7, seed: 'u1:w', avoid: [...avoid] });
    for (const q of quests) expect(avoid).not.toContain(q.kind);
  });

  it('asks more of keen learners', () => {
    expect(intensity(0)).toBe(0);
    expect(intensity(200)).toBe(1);
    expect(intensity(900)).toBe(2);
    expect(targetFor('XP', 2, 7)).toBeGreaterThan(targetFor('XP', 0, 7));
  });

  it('scales targets to the days left, and never asks for more once-a-day goals than days left', () => {
    expect(daysLeftInWeek(monday, weekStartOf(monday))).toBe(7);
    const sunday = new Date(monday.getTime() + 6 * DAY_MS);
    expect(daysLeftInWeek(sunday, weekStartOf(sunday))).toBe(1);
    expect(targetFor('XP', 1, 7)).toBe(350);
    expect(targetFor('XP', 1, 2)).toBe(100);
    expect(targetFor('CHALLENGE', 2, 3)).toBe(3);
    expect(targetFor('DAYS', 1, 1)).toBe(1);
    expect(targetFor('REVIEW', 0, 1) % 5).toBe(0);
  });

  it('writes a title for every kind', () => {
    expect(questText('READ', 1).title).toBe('Read 1 text in the library');
    expect(questText('PRONUNCIATION', 10).title).toBe('Do 10 pronunciation tries');
    expect(questText('DAYS', 5)).toEqual({ title: 'Practise on 5 different days', to: null });
  });

  it('only pays a quest once', () => {
    const quests = buildQuests({ lastWeekXp: 0, daysLeft: 7, seed: 's' });
    const first = newlyDone(quests, [quests[0].target, 0, 0], 0);
    expect(first).toEqual({ mask: 1, indexes: [0] });
    expect(newlyDone(quests, [quests[0].target, 0, 0], first.mask).indexes).toEqual([]);
    expect(newlyDone(quests, quests.map((q) => q.target), first.mask)).toEqual({ mask: 7, indexes: [1, 2] });
  });
});

describe('effective streak with freezes', () => {
  const now = new Date(2026, 10, 5, 10);
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);

  it('keeps a streak alive when the freezes cover every missed day', () => {
    expect(ActivityService.effectiveStreak({ currentStreak: 8, lastActivityDate: daysAgo(2), freezes: 1 }, now).current).toBe(8);
    expect(ActivityService.effectiveStreak({ currentStreak: 8, lastActivityDate: daysAgo(3), freezes: 2 }, now).current).toBe(8);
  });

  it('loses it when they do not', () => {
    expect(ActivityService.effectiveStreak({ currentStreak: 8, lastActivityDate: daysAgo(2), freezes: 0 }, now).current).toBe(0);
    expect(ActivityService.effectiveStreak({ currentStreak: 8, lastActivityDate: daysAgo(4), freezes: 2 }, now).current).toBe(0);
  });
});

describe('ActivityService.useFreezes', () => {
  function setup(row: any) {
    const state = { row: row ? { ...row } : null, uses: [] as any[] };
    const prisma: any = {
      streak: {
        findUnique: jest.fn(async () => state.row),
        updateMany: jest.fn(async ({ where, data }) => {
          if (!state.row || state.row.lastActivityDate.getTime() !== where.lastActivityDate.getTime()) return { count: 0 };
          state.row = { ...state.row, freezes: state.row.freezes - data.freezes.decrement, lastActivityDate: data.lastActivityDate };
          return { count: 1 };
        }),
      },
      streakFreezeUse: { createMany: jest.fn(async ({ data }) => state.uses.push(...data)) },
    };
    return { service: new ActivityService(prisma), state };
  }
  const now = new Date(2026, 10, 5, 10); // Thu
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);

  it('covers the missed days and carries the streak on from yesterday', async () => {
    const { service, state } = setup({ currentStreak: 6, freezes: 2, lastActivityDate: daysAgo(3) });
    expect(await service.useFreezes('u1', now)).toBe(2);
    expect(state.row.freezes).toBe(0);
    expect(state.row.lastActivityDate.getDate()).toBe(4);
    expect(state.uses.map((u) => u.day)).toEqual(['2026-11-03', '2026-11-04']);
    expect(state.uses[0].streak).toBe(6);
  });

  it('does nothing when nothing was missed, or when there are not enough freezes', async () => {
    expect(await setup({ currentStreak: 6, freezes: 2, lastActivityDate: daysAgo(1) }).service.useFreezes('u1', now)).toBe(0);
    const short = setup({ currentStreak: 6, freezes: 1, lastActivityDate: daysAgo(3) });
    expect(await short.service.useFreezes('u1', now)).toBe(0);
    expect(short.state.row.freezes).toBe(1);
  });
});

describe('QuestsService', () => {
  function setup(opts: { xpTotal?: number; streak?: any; values?: Partial<Record<string, number>> } = {}) {
    const weeks = new Map<string, any>();
    const state = { streak: opts.streak ? { ...opts.streak } : null as any };
    const v = opts.values ?? {};
    const prisma: any = {
      questWeek: {
        findUnique: jest.fn(async ({ where }) => weeks.get(where.userId_week.week) ?? null),
        create: jest.fn(async ({ data }) => {
          const row = { rewardedMask: 0, completedAt: null, seenAt: null, freezeGiven: false, ...data };
          weeks.set(data.week, row);
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          const row = weeks.get(where.week);
          if (!row) return { count: 0 };
          if ('rewardedMask' in where && row.rewardedMask !== where.rewardedMask) return { count: 0 };
          if ('completedAt' in where && where.completedAt === null && row.completedAt) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
      },
      xpTransaction: {
        aggregate: jest.fn(async () => ({ _sum: { amount: opts.xpTotal ?? 0 } })),
        // Busy every day of the week: speaking on 7 days and plenty of corrections
        findMany: jest.fn(async () =>
          v.XP
            ? [
                ...Array.from({ length: 7 }, (_, i) => ({ reason: 'VOICE_SPEAKING', amount: v.XP, createdAt: new Date(monday.getTime() + i * DAY_MS) })),
                ...Array.from({ length: 20 }, () => ({ reason: 'CORRECTION_GIVEN', amount: 3, createdAt: monday })),
              ]
            : [],
        ),
      },
      flashcardReview: { count: jest.fn(async () => v.REVIEW ?? 0) },
      voiceSavedWord: { count: jest.fn(async () => 0) },
      pronunciationAttempt: { count: jest.fn(async () => v.PRONUNCIATION ?? 0) },
      challengeEntry: { count: jest.fn(async () => v.CHALLENGE ?? 0) },
      libraryProgress: { count: jest.fn(async () => v.READ ?? 0) },
      dailyPlan: { count: jest.fn(async () => v.PLAN ?? 0) },
      streak: {
        findUnique: jest.fn(async () => state.streak),
        updateMany: jest.fn(async ({ where, data }) => {
          if (!state.streak) return { count: 0 };
          if (where.freezes?.lt !== undefined && state.streak.freezes >= where.freezes.lt) return { count: 0 };
          if (where.xpSpent !== undefined && state.streak.xpSpent !== where.xpSpent) return { count: 0 };
          state.streak.freezes += data.freezes?.increment ?? 0;
          state.streak.xpSpent += data.xpSpent?.increment ?? 0;
          return { count: 1 };
        }),
      },
      streakFreezeUse: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 0 })) },
    };
    const activity: any = { recordActivity: jest.fn(async () => undefined), useFreezes: jest.fn(async () => 0) };
    const badges: any = { evaluate: jest.fn(async () => []) };
    return { service: new QuestsService(prisma, activity, badges), activity, badges, state, weeks };
  }

  it('makes the week\'s quests once and shows progress', async () => {
    const { service, weeks } = setup();
    const first = await service.get('u1', monday);
    expect(first.quests).toHaveLength(3);
    expect(first.done).toBe(0);
    expect(first.celebrate).toBe(false);
    expect(weeks.size).toBe(1);
    const again = await service.get('u1', monday);
    expect(again.quests.map((q) => q.kind)).toEqual(first.quests.map((q) => q.kind));
  });

  it('pays each quest once, then opens the chest with bonus XP and a freeze', async () => {
    const all = { XP: 10_000, REVIEW: 999, READ: 99, CHALLENGE: 9, PRONUNCIATION: 999, PLAN: 9 };
    const { service, activity, badges, state } = setup({ values: all, streak: { freezes: 0, xpSpent: 0, currentStreak: 3 } });
    const result = await service.get('u1', monday);
    expect(result.done).toBe(3);
    expect(activity.recordActivity.mock.calls.map((c: any[]) => c[1])).toEqual([QUEST_XP * 3, CHEST_XP]);
    expect(result.chest.openedAt).not.toBeNull();
    expect(result.chest.freezeGiven).toBe(true);
    expect(state.streak.freezes).toBe(1);
    expect(result.celebrate).toBe(true);
    expect(badges.evaluate).toHaveBeenCalled();
    activity.recordActivity.mockClear();
    await service.get('u1', monday);
    expect(activity.recordActivity).not.toHaveBeenCalled();
  });

  it('sells a freeze for XP, and refuses when the balance or the room runs out', async () => {
    const { service, state } = setup({ xpTotal: FREEZE_PRICE + 50, streak: { freezes: 0, xpSpent: 0, currentStreak: 2, longestStreak: 2, lastActivityDate: new Date() } });
    const after = await service.buyFreeze('u1');
    expect(state.streak).toMatchObject({ freezes: 1, xpSpent: FREEZE_PRICE });
    expect(after.balance).toBe(50);
    expect(after.canBuy).toBe(false);
    await expect(service.buyFreeze('u1')).rejects.toBeInstanceOf(BadRequestException);

    const full = setup({ xpTotal: 10_000, streak: { freezes: MAX_FREEZES, xpSpent: 0, currentStreak: 2, lastActivityDate: new Date() } });
    await expect(full.service.buyFreeze('u1')).rejects.toThrow(/already hold/);
    await expect(setup({ xpTotal: 10_000 }).service.buyFreeze('u1')).rejects.toThrow(/Practise once/);
  });
});
