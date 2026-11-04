import { BadRequestException, NotFoundException } from '@nestjs/common';
import { optionOrder } from '../library/library.content';
import { MISTAKE_PATTERNS } from '../learning/mistakes';
import { GRAMMAR, GRAMMAR_LEVELS } from './grammar.content';
import { GRAMMAR_XP, judge, normalizeAnswer, passMark, seedFor, shuffledWords } from './grammar.engine';
import { GrammarService } from './grammar.service';

describe('grammar content', () => {
  it('has unique ids, a lesson at every level and ids that start with the level', () => {
    const ids = GRAMMAR.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const level of GRAMMAR_LEVELS) expect(GRAMMAR.some((l) => l.level === level)).toBe(true);
    for (const l of GRAMMAR) expect(l.id.startsWith(l.level.toLowerCase() + '-')).toBe(true);
  });

  it('gives every lesson rules, mistakes and six well-formed exercises', () => {
    for (const l of GRAMMAR) {
      expect(l.rules.length).toBeGreaterThanOrEqual(2);
      expect(l.mistakes.length).toBeGreaterThanOrEqual(2);
      expect(l.exercises).toHaveLength(6);
      if (l.pattern) expect(l.pattern in MISTAKE_PATTERNS).toBe(true);
      expect(new Set(l.exercises.map((e) => e.id)).size).toBe(6);
      for (const ex of l.exercises) {
        expect(ex.explanation.length).toBeGreaterThan(5);
        if (ex.kind === 'blank' || ex.kind === 'type') expect(ex.prompt).toContain('___');
        if (ex.kind === 'blank' || ex.kind === 'correct') {
          expect(ex.options).toHaveLength(4);
          expect(new Set(ex.options).size).toBe(4);
        }
        if (ex.kind === 'order') expect(ex.words.length).toBeGreaterThanOrEqual(4);
        if (ex.kind === 'type') expect(ex.answers.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('grammar engine', () => {
  it('ignores case, punctuation, spacing and curly apostrophes when comparing', () => {
    expect(normalizeAnswer("  Didn’t   EAT. ")).toBe("didn't eat");
    expect(passMark(6)).toBe(4);
  });

  it('marks multiple choice by the option as it was shown', () => {
    const ex = GRAMMAR[0].exercises[0]; // She ___ a teacher.
    const seed = seedFor('u1', GRAMMAR[0].id, ex.id);
    if (ex.kind !== 'blank') throw new Error('expected a blank');
    const rightSlot = optionOrder(seed, 4).indexOf(0);
    const right = judge(ex, rightSlot, seed);
    expect(right).toMatchObject({ answered: true, correct: true, original: 'She is a teacher.', corrected: 'She is a teacher.' });
    const wrongSlot = (rightSlot + 1) % 4;
    const wrong = judge(ex, wrongSlot, seed);
    expect(wrong.correct).toBe(false);
    expect(wrong.corrected).toBe('She is a teacher.');
    expect(wrong.original).not.toBe(wrong.corrected);
    expect(judge(ex, 9, seed).answered).toBe(false);
    expect(judge(ex, undefined, seed).answered).toBe(false);
  });

  it('accepts every listed answer for typed exercises, and only those', () => {
    const lesson = GRAMMAR.find((l) => l.id === 'a2-past-simple')!;
    const ex = lesson.exercises[5];
    expect(judge(ex, "Didn't eat", 's').correct).toBe(true);
    expect(judge(ex, 'did not eat.', 's').correct).toBe(true);
    const wrong = judge(ex, 'ate', 's');
    expect(wrong).toMatchObject({ answered: true, correct: false, original: 'He ate breakfast this morning. (not eat)' });
    expect(judge(ex, '   ', 's').answered).toBe(false);
  });

  it('marks word order, accepts listed alternatives, and shuffles away from the answer', () => {
    const lesson = GRAMMAR.find((l) => l.id === 'a2-prepositions')!;
    const ex = lesson.exercises[4];
    if (ex.kind !== 'order') throw new Error('expected order');
    expect(judge(ex, ex.words, 's').correct).toBe(true);
    // Punctuation and curly apostrophes do not matter, word order does
    expect(judge(ex, ['Let’s', 'meet', 'on', 'Friday', 'at', 'the', 'station.'], 's').correct).toBe(true);
    expect(judge(ex, ["Let's", 'meet', 'on', 'the', 'station', 'at', 'Friday.'], 's').correct).toBe(false);
    expect(judge(ex, ['only', 'two'], 's').answered).toBe(false);
    for (const seed of ['a', 'b', 'c', 'd']) {
      const words = shuffledWords(seed, ex.words);
      expect([...words].sort()).toEqual([...ex.words].sort());
      expect(words).not.toEqual(ex.words);
    }
  });
});

function setup(level: string | null = 'A1') {
  const rows = new Map<string, any>();
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level }) },
    flashcard: { groupBy: jest.fn().mockResolvedValue([]) },
    grammarProgress: {
      findMany: jest.fn(async () => [...rows.values()]),
      findUnique: jest.fn(async ({ where }) => rows.get(where.userId_lessonId.lessonId) ?? null),
      upsert: jest.fn(async ({ where, create, update }) => {
        const id = where.userId_lessonId.lessonId;
        const row = rows.get(id);
        if (!row) rows.set(id, { ...create });
        else rows.set(id, { ...row, ...update, attempts: row.attempts + 1 });
        return rows.get(id);
      }),
    },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const review: any = { addCorrectionCard: jest.fn().mockResolvedValue({ created: true }) };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  return { service: new GrammarService(prisma, activity, review, badges), prisma, activity, review, badges, rows };
}

/** The answers that get a lesson all right (or wrong, for the exercises in `wrongIds`) for one learner */
function answersFor(userId: string, lessonId: string, wrongIds: string[] = []) {
  const lesson = GRAMMAR.find((l) => l.id === lessonId)!;
  const out: Record<string, unknown> = {};
  for (const ex of lesson.exercises) {
    const seed = seedFor(userId, lessonId, ex.id);
    const wrong = wrongIds.includes(ex.id);
    if (ex.kind === 'blank' || ex.kind === 'correct') {
      const slot = optionOrder(seed, 4).indexOf(0);
      out[ex.id] = wrong ? (slot + 1) % 4 : slot;
    } else if (ex.kind === 'order') {
      out[ex.id] = wrong ? [...ex.words].reverse() : ex.words;
    } else {
      out[ex.id] = wrong ? 'zzz' : ex.answers[0];
    }
  }
  return out;
}

describe('GrammarService', () => {
  const id = 'a1-to-be';

  it('lists every lesson, starting a beginner on the first one', async () => {
    const { service } = setup('A1');
    const list = await service.list('u1');
    expect(list.lessons).toHaveLength(GRAMMAR.length);
    expect(list.level).toBe('A1');
    expect(list.recommended).toEqual({ id, reason: 'Next at your level (A1)' });
    expect(list.done).toBe(0);
  });

  it('recommends a lesson for the mistake you keep making', async () => {
    const { service, prisma } = setup('A1');
    prisma.flashcard.groupBy.mockResolvedValue([{ pattern: 'PREPOSITION', _count: { _all: 3 } }]);
    const list = await service.list('u1');
    expect(list.recommended).toEqual({ id: 'a2-prepositions', reason: 'You keep making prepositions mistakes' });
  });

  it('hides the answers when it sends a lesson', async () => {
    const { service } = setup();
    const lesson = await service.get('u1', id);
    expect(lesson.exercises).toHaveLength(6);
    expect(JSON.stringify(lesson.exercises)).not.toMatch(/"answers"|explanation|"correct":|alsoAccept/);
    await expect(service.get('u1', 'nope')).rejects.toThrow(NotFoundException);
  });

  it('checks one answer without saving anything', async () => {
    const { service, prisma } = setup();
    const answers = answersFor('u1', id);
    expect(service.check('u1', id, 'q1', answers.q1)).toMatchObject({ correct: true, correctText: 'She is a teacher.' });
    expect(service.check('u1', id, 'q1', (Number(answers.q1) + 1) % 4).correct).toBe(false);
    expect(() => service.check('u1', id, 'q1', 'x')).toThrow(BadRequestException);
    expect(() => service.check('u1', id, 'q99', 0)).toThrow(NotFoundException);
    expect(prisma.grammarProgress.upsert).not.toHaveBeenCalled();
  });

  it('needs every exercise answered', async () => {
    const { service } = setup();
    const answers = answersFor('u1', id);
    delete answers.q6;
    await expect(service.finish('u1', id, answers)).rejects.toThrow(BadRequestException);
    await expect(service.finish('u1', id, undefined)).rejects.toThrow(BadRequestException);
  });

  it('pays XP once for passing, and badges are checked', async () => {
    const { service, activity, badges, review } = setup();
    const first = await service.finish('u1', id, answersFor('u1', id));
    expect(first).toMatchObject({ score: 6, total: 6, passed: true, perfect: true, firstPass: true, xp: GRAMMAR_XP, cardsAdded: 0 });
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', GRAMMAR_XP, 'EXERCISE_COMPLETED');
    expect(badges.evaluate).toHaveBeenCalledTimes(1);
    expect(review.addCorrectionCard).not.toHaveBeenCalled();

    const again = await service.finish('u1', id, answersFor('u1', id));
    expect(again).toMatchObject({ passed: true, firstPass: false, xp: 0 });
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('turns wrong answers into review cards filed under the lesson\'s mistake type', async () => {
    const { service, review, rows, activity } = setup();
    const result = await service.finish('u1', id, answersFor('u1', id, ['q1', 'q5']));
    expect(result).toMatchObject({ score: 4, passed: true, perfect: false, cardsAdded: 2 });
    expect(review.addCorrectionCard).toHaveBeenCalledTimes(2);
    expect(review.addCorrectionCard).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ source: 'grammar', sourceId: `${id}:q5`, pattern: 'AGREEMENT', corrected: 'My brothers are at home now.' }),
      { ignoreDailyLimit: true },
    );
    expect(result.results.filter((r) => !r.correct).map((r) => r.id)).toEqual(['q1', 'q5']);
    expect(rows.get(id).completedAt).toBeInstanceOf(Date);
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('does not complete or pay for a failed try, but keeps the best score', async () => {
    const { service, activity, badges, rows } = setup();
    const failed = await service.finish('u1', id, answersFor('u1', id, ['q1', 'q2', 'q3', 'q4']));
    expect(failed).toMatchObject({ score: 2, passed: false, firstPass: false, xp: 0 });
    expect(rows.get(id).completedAt).toBeUndefined();
    expect(activity.recordActivity).not.toHaveBeenCalled();
    expect(badges.evaluate).not.toHaveBeenCalled();

    await service.finish('u1', id, answersFor('u1', id, ['q1']));
    expect(rows.get(id).bestScore).toBe(5);
    await service.finish('u1', id, answersFor('u1', id, ['q1', 'q2']));
    expect(rows.get(id).bestScore).toBe(5);
  });
});
