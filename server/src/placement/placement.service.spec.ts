import { BadRequestException, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { PlacementService, RETAKE_COOLDOWN_MS } from './placement.service';
import { getItem } from './placement.bank';
import { QUESTION_COUNT, optionOrder } from './placement.engine';

/** A tiny in-memory stand-in for the two tables the service touches */
function makeService() {
  const attempts: any[] = [];
  const profile: any = { userId: 'u1', level: null, levelAssessedAt: null };
  let seq = 0;

  const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([key, cond]: [string, any]) => {
      if (cond && typeof cond === 'object' && 'gt' in cond) return row[key] > cond.gt;
      return row[key] === cond;
    });

  const prisma: any = {
    profile: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...profile })),
      updateMany: jest.fn().mockImplementation(async ({ data }) => {
        Object.assign(profile, data);
        return { count: 1 };
      }),
    },
    placementAttempt: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const row = {
          id: `a${++seq}`,
          status: 'IN_PROGRESS',
          answers: [],
          currentItemId: null,
          level: null,
          result: null,
          speaking: null,
          startedAt: new Date(),
          completedAt: null,
          ...data,
        };
        attempts.push(row);
        return { ...row };
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const row = attempts.find((a) => a.id === where.id);
        Object.assign(row, data);
        return { ...row };
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        const rows = attempts.filter((a) => matches(a, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
      findFirst: jest.fn().mockImplementation(async ({ where, orderBy }) => {
        const rows = attempts.filter((a) => matches(a, where));
        if (orderBy?.completedAt) rows.sort((a, b) => +b.completedAt - +a.completedAt);
        if (orderBy?.startedAt) rows.sort((a, b) => +b.startedAt - +a.startedAt);
        return rows[0] ? { ...rows[0] } : null;
      }),
    },
  };
  return { service: new PlacementService(prisma), prisma, attempts, profile };
}

/** Picks the option whose bank position is `wanted` (0 = the correct one) */
const choose = (attemptId: string, itemId: string, wanted = 0) => optionOrder(attemptId, itemId).indexOf(wanted);

async function finish(service: PlacementService, userId: string, right: boolean) {
  let state: any = await service.start(userId);
  for (let i = 0; i < QUESTION_COUNT; i++) {
    state = await service.answer(userId, state.attemptId, state.question.id, choose(state.attemptId, state.question.id, right ? 0 : 1));
    if (state.done) return state;
  }
  throw new Error('test never finished');
}

describe('PlacementService', () => {
  it('starts with a question that hides the answer and the level', async () => {
    const { service } = makeService();
    const state = await service.start('u1');
    expect(state.total).toBe(QUESTION_COUNT);
    expect(state.answered).toBe(0);
    expect(state.question.options).toHaveLength(4);
    expect(JSON.stringify(state.question)).not.toMatch(/"level"|"answer"|"correct"/);
  });

  it('shows the same options in the same order every time the question is fetched', async () => {
    const { service } = makeService();
    const first = await service.start('u1');
    const again = await service.start('u1');
    expect(again.attemptId).toBe(first.attemptId);
    expect(again.question).toEqual(first.question);
  });

  it('marks the right option correct and never reveals it', async () => {
    const { service, attempts } = makeService();
    const s: any = await service.start('u1');
    const item = getItem(s.question.id)!;
    const reply: any = await service.answer('u1', s.attemptId, item.id, choose(s.attemptId, item.id, 0));
    expect(reply.done).toBe(false);
    expect(reply.answered).toBe(1);
    expect(JSON.stringify(reply)).not.toMatch(/correct/);
    expect(attempts[0].answers[0].correct).toBe(true);

    const s2: any = reply;
    const item2 = getItem(s2.question.id)!;
    await service.answer('u1', s.attemptId, item2.id, choose(s.attemptId, item2.id, 2));
    expect(attempts[0].answers[1].correct).toBe(false);
  });

  it('counts "I don\'t know" as a miss', async () => {
    const { service, attempts } = makeService();
    const s: any = await service.start('u1');
    await service.answer('u1', s.attemptId, s.question.id, null);
    expect(attempts[0].answers[0].correct).toBe(false);
  });

  it('rejects an answer to a question that is not the current one', async () => {
    const { service } = makeService();
    const s: any = await service.start('u1');
    const other = s.question.id === 'g-a1-1' ? 'g-a1-2' : 'g-a1-1';
    await expect(service.answer('u1', s.attemptId, other, 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a choice outside the options and another learner’s test', async () => {
    const { service } = makeService();
    const s: any = await service.start('u1');
    await expect(service.answer('u1', s.attemptId, s.question.id, 7)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.answer('someone-else', s.attemptId, s.question.id, 0)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a second answer to the same question', async () => {
    const { service, prisma } = makeService();
    const s: any = await service.start('u1');
    const pick = choose(s.attemptId, s.question.id);
    // Two requests read the same row before either writes
    const stale = await prisma.placementAttempt.findFirst({ where: { id: s.attemptId } });
    await service.answer('u1', s.attemptId, s.question.id, pick);
    prisma.placementAttempt.findFirst.mockResolvedValueOnce(stale);
    await expect(service.answer('u1', s.attemptId, s.question.id, pick)).rejects.toBeInstanceOf(ConflictException);
  });

  it('finishes after the last question, saves the level on the profile and the attempt', async () => {
    const { service, profile, attempts } = makeService();
    const done = await finish(service, 'u1', true);
    expect(done.done).toBe(true);
    expect(done.answered).toBe(QUESTION_COUNT);
    expect(['C1', 'C2']).toContain(done.result.level);
    expect(profile.level).toBe(done.result.level);
    expect(profile.levelAssessedAt).toBeInstanceOf(Date);
    expect(attempts[0].status).toBe('COMPLETED');
    expect(attempts[0].level).toBe(done.result.level);
    expect(attempts[0].currentItemId).toBeNull();
  });

  it('places a learner who misses everything at A1', async () => {
    const { service, profile } = makeService();
    const done = await finish(service, 'u1', false);
    expect(done.result.level).toBe('A1');
    expect(profile.level).toBe('A1');
  });

  it('allows a retake only after the cooldown', async () => {
    const { service, attempts } = makeService();
    await finish(service, 'u1', true);

    const err = await service.start('u1').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse().retryAt).toBeDefined();

    attempts[0].completedAt = new Date(Date.now() - RETAKE_COOLDOWN_MS - 1000);
    const fresh: any = await service.start('u1');
    expect(fresh.attemptId).not.toBe(attempts[0].id);
    expect(fresh.answered).toBe(0);
  });

  it('reports status: no level yet, then the result, a resumable test and the retake time', async () => {
    const { service } = makeService();
    expect(await service.getStatus('u1')).toMatchObject({ level: null, result: null, inProgress: null, retakeAvailableAt: null });

    const s: any = await service.start('u1');
    await service.answer('u1', s.attemptId, s.question.id, choose(s.attemptId, s.question.id));
    expect((await service.getStatus('u1')).inProgress).toEqual({ attemptId: s.attemptId, answered: 1 });

    const { service: s2 } = makeService();
    await finish(s2, 'u1', true);
    const status = await s2.getStatus('u1');
    expect(status.level).toBeTruthy();
    expect(status.result?.total).toBe(QUESTION_COUNT);
    expect(status.retakeAvailableAt).toBeInstanceOf(Date);
    expect(status.inProgress).toBeNull();
  });

  describe('speaking sample', () => {
    const talk =
      'Last summer I travelled to the coast with my family and we stayed in a small hotel near the beach. ' +
      'Every morning we walked along the water, and in the evening we cooked dinner together on the terrace.';

    it('needs a finished test', async () => {
      const { service } = makeService();
      const s: any = await service.start('u1');
      await expect(service.addSpeaking('u1', s.attemptId, talk, 20)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('saves a long enough sample and leaves the level alone', async () => {
      const { service, attempts, profile } = makeService();
      const done = await finish(service, 'u1', true);
      const before = profile.level;
      const sample = await service.addSpeaking('u1', done.attemptId, talk, 20);
      expect(sample.tooShort).toBe(false);
      expect(attempts[0].speaking).toMatchObject({ words: sample.words });
      expect(profile.level).toBe(before);
    });

    it('does not save a sample that is too short', async () => {
      const { service, attempts } = makeService();
      const done = await finish(service, 'u1', true);
      const sample = await service.addSpeaking('u1', done.attemptId, 'I like tea', 3);
      expect(sample.tooShort).toBe(true);
      expect(attempts[0].speaking).toBeNull();
    });
  });
});
