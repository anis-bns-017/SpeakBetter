import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SCENARIOS, SCENARIO_LEVELS } from './roleplay.content';
import { ROLEPLAY_XP, RoleplayService, averageSpoken } from './roleplay.service';

describe('role-play content', () => {
  it('has unique ids that start with the level, and a scenario at every level', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCENARIOS) expect(s.id.startsWith(s.level.toLowerCase() + '-')).toBe(true);
    for (const level of SCENARIO_LEVELS) expect(SCENARIOS.some((s) => s.level === level)).toBe(true);
  });

  it('gives every scenario a full conversation, two different replies per turn and useful phrases', () => {
    for (const s of SCENARIOS) {
      expect(s.exchanges.length).toBeGreaterThanOrEqual(4);
      for (const e of s.exchanges) {
        expect(e.partner.trim().length).toBeGreaterThan(5);
        expect(e.replies).toHaveLength(2);
        expect(e.replies[0]).not.toBe(e.replies[1]);
        // short enough to say in one breath and score
        for (const r of e.replies) expect(r.split(/\s+/).length).toBeLessThanOrEqual(20);
      }
      expect(s.closing.length).toBeGreaterThan(3);
      expect(s.phrases.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('averageSpoken', () => {
  it('averages only real scores from 0 to 100, ignoring the rest', () => {
    expect(averageSpoken([90, null, 70], 5)).toEqual({ spoken: 2, average: 80 });
    expect(averageSpoken([150, -3, 'x', NaN, 40], 5)).toEqual({ spoken: 1, average: 40 });
    expect(averageSpoken([], 5)).toEqual({ spoken: 0, average: null });
    expect(averageSpoken(undefined, 5)).toEqual({ spoken: 0, average: null });
    // never more scores than turns
    expect(averageSpoken([100, 100, 100, 0, 0, 0], 3)).toEqual({ spoken: 3, average: 100 });
  });
});

function setup() {
  const rows = new Map<string, any>();
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level: 'B1' }) },
    roleplayProgress: {
      findMany: jest.fn(async () => [...rows.values()]),
      findUnique: jest.fn(async ({ where }: any) => rows.get(where.userId_scenarioId.scenarioId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const id = where.userId_scenarioId.scenarioId;
        const row = rows.get(id);
        if (!row) rows.set(id, { ...create });
        else rows.set(id, { ...row, bestScore: update.bestScore, completions: row.completions + 1 });
      }),
    },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  return { service: new RoleplayService(prisma, activity, badges), rows, activity, badges };
}

describe('RoleplayService', () => {
  const id = 'a1-cafe';

  it('lists every scenario with progress and the learner\'s level', async () => {
    const { service } = setup();
    const list = await service.list('u1');
    expect(list.level).toBe('B1');
    expect(list.scenarios).toHaveLength(SCENARIOS.length);
    expect(list.done).toBe(0);
    expect(list.levels.reduce((n, l) => n + l.total, 0)).toBe(SCENARIOS.length);
  });

  it('sends the whole script and the next scenario', async () => {
    const { service } = setup();
    const s = await service.get('u1', id);
    expect(s.exchanges.length).toBeGreaterThan(0);
    expect(s.next).toEqual({ id: SCENARIOS[1].id, title: SCENARIOS[1].title });
    await expect(service.get('u1', 'nope')).rejects.toThrow(NotFoundException);
  });

  it('pays XP the first time, keeps the best score, and counts each finish', async () => {
    const { service, rows, activity, badges } = setup();
    const first = await service.finish('u1', id, [80, 90, null, 70, 60]);
    expect(first).toMatchObject({ firstTime: true, xp: ROLEPLAY_XP, spoken: 4, average: 75, best: 75 });
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', ROLEPLAY_XP, 'LESSON_COMPLETED');
    expect(badges.evaluate).toHaveBeenCalled();

    const lower = await service.finish('u1', id, [50, 50]);
    expect(lower).toMatchObject({ firstTime: false, xp: 0, average: 50, best: 75 });
    const silent = await service.finish('u1', id, []);
    expect(silent).toMatchObject({ spoken: 0, average: null, best: 75 });
    expect(rows.get(id).completions).toBe(3);
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('counts a finish without speaking, with no score', async () => {
    const { service, rows } = setup();
    const r = await service.finish('u1', id, undefined);
    expect(r).toMatchObject({ firstTime: true, spoken: 0, average: null, best: null });
    expect(rows.get(id).bestScore).toBeNull();
  });

  it('rejects unknown scenarios and scores that are not a list', async () => {
    const { service } = setup();
    await expect(service.finish('u1', 'nope', [])).rejects.toThrow(NotFoundException);
    await expect(service.finish('u1', id, { a: 1 })).rejects.toThrow(BadRequestException);
  });
});
