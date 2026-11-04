import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LIBRARY, LIBRARY_LEVELS, optionOrder, readingMinutes } from './library.content';
import { LIBRARY_XP, LibraryService } from './library.service';

describe('library content', () => {
  it('has unique ids and texts at every level', () => {
    const ids = LIBRARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const level of LIBRARY_LEVELS) expect(LIBRARY.filter((t) => t.level === level).length).toBeGreaterThanOrEqual(3);
  });

  it('points every question at a real sentence, with four different options', () => {
    for (const t of LIBRARY) {
      expect(t.id.startsWith(t.level.toLowerCase())).toBe(true);
      for (const q of t.questions) {
        expect(q.sentence).toBeGreaterThanOrEqual(0);
        expect(q.sentence).toBeLessThan(t.sentences.length);
        expect(new Set(q.options).size).toBe(4);
      }
    }
  });

  it('shuffles options the same way for a reader, and differently between readers', () => {
    expect(optionOrder('u1:a1-cafe:q1')).toEqual(optionOrder('u1:a1-cafe:q1'));
    expect([...optionOrder('u1:a1-cafe:q1')].sort()).toEqual([0, 1, 2, 3]);
    const orders = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((u) => optionOrder(`${u}:a1-cafe:q1`).join('')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('estimates at least a minute of reading', () => {
    for (const t of LIBRARY) expect(readingMinutes(t)).toBeGreaterThanOrEqual(1);
  });
});

function setup(level: string | null = 'B1') {
  const rows = new Map<string, any>();
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level }) },
    libraryProgress: {
      findMany: jest.fn(async () => [...rows.values()]),
      findUnique: jest.fn(async ({ where }) => rows.get(where.userId_textId.textId) ?? null),
      upsert: jest.fn(async ({ where, create, update }) => {
        const id = where.userId_textId.textId;
        const row = rows.get(id);
        if (!row) rows.set(id, { ...create });
        else rows.set(id, { ...row, ...update, attempts: row.attempts + 1 });
        return rows.get(id);
      }),
    },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  return { service: new LibraryService(prisma, activity, badges), activity, badges, rows };
}

/** The answers a reader should send to get everything right (the shown index of each right answer) */
const rightAnswers = (userId: string, textId: string) => {
  const text = LIBRARY.find((t) => t.id === textId)!;
  return Object.fromEntries(text.questions.map((q) => [q.id, optionOrder(`${userId}:${textId}:${q.id}`).indexOf(0)]));
};

describe('LibraryService', () => {
  it('lists every text with progress and counts per level, starting at your level', async () => {
    const { service } = setup('B1');
    const list = await service.list('u1');
    expect(list.level).toBe('B1');
    expect(list.texts).toHaveLength(LIBRARY.length);
    expect(list.levels.find((l) => l.level === 'A1')).toEqual({ level: 'A1', total: 3, done: 0 });
    expect(list.texts[0]).toMatchObject({ done: false, bestScore: null, questions: 3 });
  });

  it('gives a text with shuffled options and never the answers', async () => {
    const { service } = setup();
    const text = await service.get('u1', 'a1-cafe');
    expect(text.sentences.length).toBeGreaterThan(5);
    expect(text.questions[0].options).toHaveLength(4);
    expect(JSON.stringify(text.questions)).not.toMatch(/explanation|correct/);
    expect(text.next).toMatchObject({ id: 'a1-flat' });
    await expect(service.get('u1', 'nope')).rejects.toThrow(NotFoundException);
  });

  it('marks answers, keeps the best score, and gives XP only the first time', async () => {
    const { service, activity, badges, rows } = setup();
    const right = rightAnswers('u1', 'a2-cooking');
    const wrongFirst = { ...right, q1: (right.q1 + 1) % 4 };

    const first = await service.answer('u1', 'a2-cooking', wrongFirst);
    expect(first).toMatchObject({ score: 2, total: 3, firstCompletion: true, xp: LIBRARY_XP });
    expect(first.results[0]).toMatchObject({ correct: false, correctIndex: right.q1, sentence: 3 });
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', LIBRARY_XP, 'LESSON_COMPLETED');
    expect(badges.evaluate).toHaveBeenCalledWith('u1');

    const second = await service.answer('u1', 'a2-cooking', right);
    expect(second).toMatchObject({ score: 3, firstCompletion: false, xp: 0 });
    expect(rows.get('a2-cooking')).toMatchObject({ bestScore: 3, attempts: 2 });
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('wants an answer to every question', async () => {
    const { service } = setup();
    await expect(service.answer('u1', 'a1-cafe', { q1: 0 })).rejects.toThrow(/every question/);
    await expect(service.answer('u1', 'a1-cafe', null)).rejects.toThrow(BadRequestException);
    await expect(service.answer('u1', 'a1-cafe', { q1: 0, q2: 9, q3: 1 })).rejects.toThrow(/every question/);
  });
});
