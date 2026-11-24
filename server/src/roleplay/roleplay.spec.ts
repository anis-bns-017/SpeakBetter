import { NotFoundException } from '@nestjs/common';
import { SCENARIOS, SCENARIO_LEVELS } from './roleplay.content';
import { ROLEPLAY_XP, RoleplayService, turnScores } from './roleplay.service';

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

describe('turnScores', () => {
  const exchanges = [{ replies: ['Yes, please.', 'No, thank you.'] }, { replies: ['A coffee.', 'A tea.'] }, { replies: ['Bye.', 'See you.'] }];

  it('takes your best on either reply, and leaves unsaid turns empty', () => {
    const attempts = [
      { target: 'yes, please.', score: 60 },
      { target: 'No, thank you.', score: 85 },
      { target: 'A tea.', score: 70 },
      { target: 'Something else', score: 100 },
    ];
    expect(turnScores(exchanges, attempts)).toEqual([85, 70, null]);
    expect(turnScores(exchanges, [])).toEqual([null, null, null]);
  });
});

function setup() {
  const rows = new Map<string, any>();
  const attempts: Array<{ target: string; score: number }> = [];
  const prisma: any = {
    pronunciationAttempt: { findMany: jest.fn(async () => attempts) },
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
  return { service: new RoleplayService(prisma, activity, badges), rows, attempts, prisma, activity, badges };
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
    const { service, rows, attempts, activity, badges } = setup();
    const scenario = SCENARIOS.find((s) => s.id === id)!;
    attempts.push({ target: scenario.exchanges[0].replies[0], score: 80 }, { target: scenario.exchanges[1].replies[1], score: 90 });
    const first = await service.finish('u1', id, new Date().toISOString());
    expect(first).toMatchObject({ firstTime: true, xp: ROLEPLAY_XP, spoken: 2, average: 85, best: 85 });
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', ROLEPLAY_XP, 'LESSON_COMPLETED');
    expect(badges.evaluate).toHaveBeenCalled();

    attempts.length = 0;
    attempts.push({ target: scenario.exchanges[0].replies[0], score: 50 });
    const lower = await service.finish('u1', id, new Date().toISOString());
    expect(lower).toMatchObject({ firstTime: false, xp: 0, average: 50, best: 85 });
    attempts.length = 0;
    const silent = await service.finish('u1', id, new Date().toISOString());
    expect(silent).toMatchObject({ spoken: 0, average: null, best: 85 });
    expect(rows.get(id).completions).toBe(3);
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('cannot be given a score by the page', async () => {
    const { service } = setup();
    const r = await service.finish('u1', id, [100, 100, 100, 100, 100]);
    expect(r).toMatchObject({ spoken: 0, average: null, best: null });
  });

  it('only looks at attempts since the conversation started', async () => {
    const { service, prisma } = setup();
    const startedAt = new Date(Date.now() - 60_000);
    await service.finish('u1', id, startedAt.toISOString());
    expect(prisma.pronunciationAttempt.findMany.mock.calls[0][0].where.createdAt.gte).toEqual(startedAt);
  });

  it('counts a finish without speaking, with no score', async () => {
    const { service, rows } = setup();
    const r = await service.finish('u1', id, undefined);
    expect(r).toMatchObject({ firstTime: true, spoken: 0, average: null, best: null });
    expect(rows.get(id).bestScore).toBeNull();
  });

  it('rejects unknown scenarios', async () => {
    const { service } = setup();
    await expect(service.finish('u1', 'nope', undefined)).rejects.toThrow(NotFoundException);
  });
});
