import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GRAMMAR } from '../grammar/grammar.content';
import {
  EXERCISES_XP,
  EXERCISE_LEVELS,
  EXERCISE_SKILLS,
  SET_SIZE,
  findExercise,
  judgeExercise,
  passMark,
  pickSet,
  presentExercise,
  setSeed,
  type ExerciseRef,
} from './exercises.engine';
import { EXERCISES_GAME, ExercisesService } from './exercises.service';

/** The answer that is right for this learner, in the shape the page sends */
function rightAnswer(ref: ExerciseRef, userId: string): unknown {
  const shown = presentExercise(ref, userId);
  if (shown.kind === 'order') return ref.skill === 'grammar' && ref.exercise.kind === 'order' ? ref.exercise.words : [];
  if (shown.kind === 'type') return ref.skill === 'grammar' && ref.exercise.kind === 'type' ? ref.exercise.answers[0] : '';
  for (let i = 0; i < shown.options.length; i++) {
    if (judgeExercise(ref, i, userId).correct) return i;
  }
  throw new Error(`No right option for ${ref.id}`);
}

/** A wrong answer that still counts as answered */
function wrongAnswer(ref: ExerciseRef, userId: string): unknown {
  const shown = presentExercise(ref, userId);
  if (shown.kind === 'order') return shown.words.map(() => 'x');
  if (shown.kind === 'type') return 'zzzz';
  for (let i = 0; i < shown.options.length; i++) {
    if (!judgeExercise(ref, i, userId).correct) return i;
  }
  throw new Error(`No wrong option for ${ref.id}`);
}

describe('exercise sets', () => {
  it('has a full set for every level and skill, with no repeats', () => {
    for (const level of EXERCISE_LEVELS) {
      for (const skill of EXERCISE_SKILLS) {
        const set = pickSet(level, skill, 'seed');
        expect(set).toHaveLength(SET_SIZE);
        expect(new Set(set.map((r) => r.id)).size).toBe(SET_SIZE);
      }
    }
  });

  it('keeps a set stable, changes it next round, and mixes both skills', () => {
    const a = pickSet('B1', 'mixed', setSeed('u1', '2026-11-05', 'B1', 'mixed', 0));
    const same = pickSet('B1', 'mixed', setSeed('u1', '2026-11-05', 'B1', 'mixed', 0));
    const next = pickSet('B1', 'mixed', setSeed('u1', '2026-11-05', 'B1', 'mixed', 1));
    expect(same.map((r) => r.id)).toEqual(a.map((r) => r.id));
    expect(next.map((r) => r.id)).not.toEqual(a.map((r) => r.id));
    expect(a.filter((r) => r.skill === 'grammar')).toHaveLength(SET_SIZE / 2);
    expect(a.filter((r) => r.skill === 'vocabulary')).toHaveLength(SET_SIZE / 2);
  });

  it('finds an exercise by id and rejects made-up ones', () => {
    const [ref] = pickSet('A2', 'mixed', 'seed');
    expect(findExercise(ref.id)?.id).toBe(ref.id);
    for (const bad of ['', 'nope', 'g|nope|q1', 'v|nope|w1', `${ref.id}|extra`, null]) expect(findExercise(bad)).toBeNull();
  });

  it('never sends the answer, and marks every kind of question correctly', () => {
    for (const level of EXERCISE_LEVELS) {
      for (const ref of pickSet(level, 'mixed', `marking:${level}`)) {
        const shown = presentExercise(ref, 'u1') as unknown as Record<string, unknown>;
        expect(shown).not.toHaveProperty('answers');
        expect(shown).not.toHaveProperty('explanation');
        expect(judgeExercise(ref, rightAnswer(ref, 'u1'), 'u1')).toMatchObject({ answered: true, correct: true });
        expect(judgeExercise(ref, wrongAnswer(ref, 'u1'), 'u1')).toMatchObject({ answered: true, correct: false });
        expect(judgeExercise(ref, undefined, 'u1').answered).toBe(false);
      }
    }
  });

  it('covers grammar content from every level', () => {
    for (const level of EXERCISE_LEVELS) expect(GRAMMAR.some((l) => l.level === level)).toBe(true);
  });
});

function setup() {
  const results: any[] = [];
  const matches = (r: any, where: any) =>
    r.userId === where.userId && r.game === where.game && r.day === where.day && (where.won === undefined || r.won === where.won);
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level: 'B1', timezone: 'UTC' }) },
    gameResult: {
      count: jest.fn(async ({ where }: any) => results.filter((r) => matches(r, where)).length),
      create: jest.fn(async ({ data }: any) => results.push(data)),
    },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const review: any = {
    addCorrectionCard: jest.fn().mockResolvedValue({ created: true }),
    addWordCard: jest.fn().mockResolvedValue({ created: true }),
  };
  return { service: new ExercisesService(prisma, activity, review), results, activity, review };
}

const at = new Date(Date.UTC(2026, 10, 5, 10, 0));
const day = '2026-11-05';

const answersFor = (set: ExerciseRef[], wrongCount: number) =>
  Object.fromEntries(set.map((ref, i) => [ref.id, i < wrongCount ? wrongAnswer(ref, 'u1') : rightAnswer(ref, 'u1')]));

describe('ExercisesService', () => {
  const setFor = (round: number) => pickSet('B1', 'mixed', setSeed('u1', day, 'B1', 'mixed', round));

  it('starts at your level and moves to a new set after you finish one', async () => {
    const { service } = setup();
    const first = await service.session('u1', {}, at);
    expect(first).toMatchObject({ level: 'B1', skill: 'mixed', day, round: 0, xpAvailable: true, xp: EXERCISES_XP });
    expect(first.items).toHaveLength(SET_SIZE);
    await service.finish('u1', { level: 'B1', skill: 'mixed', day, round: 0, answers: answersFor(setFor(0), 0) }, at);
    const second = await service.session('u1', {}, at);
    expect(second).toMatchObject({ round: 1, doneToday: 1, xpAvailable: false });
    expect(second.items.map((i) => i.id)).not.toEqual(first.items.map((i) => i.id));
  });

  it('ignores a level or skill that does not exist', async () => {
    const { service } = setup();
    expect(await service.session('u1', { level: 'Z9', skill: 'nope' }, at)).toMatchObject({ level: 'B1', skill: 'mixed' });
  });

  it('checks one answer without saving', async () => {
    const { service, results } = setup();
    const [ref] = setFor(0);
    expect(service.check('u1', ref.id, rightAnswer(ref, 'u1'))).toMatchObject({ id: ref.id, correct: true });
    expect(() => service.check('u1', 'g|nope|q1', 0)).toThrow(NotFoundException);
    expect(() => service.check('u1', ref.id, undefined)).toThrow(BadRequestException);
    expect(results).toHaveLength(0);
  });

  it('pays XP only for the first set passed each day', async () => {
    const { service, activity } = setup();
    const first = await service.finish('u1', { level: 'B1', skill: 'mixed', day, round: 0, answers: answersFor(setFor(0), 0) }, at);
    expect(first).toMatchObject({ score: SET_SIZE, total: SET_SIZE, passed: true, perfect: true, xp: EXERCISES_XP });
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', EXERCISES_XP, 'EXERCISE_COMPLETED');
    const second = await service.finish('u1', { level: 'B1', skill: 'mixed', day, round: 1, answers: answersFor(setFor(1), 0) }, at);
    expect(second).toMatchObject({ passed: true, xp: 0 });
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('pays nothing for a failed set, records it, and sends each mistake to review', async () => {
    const { service, activity, review, results } = setup();
    const wrong = SET_SIZE - passMark(SET_SIZE) + 1;
    const r = await service.finish('u1', { level: 'B1', skill: 'mixed', day, round: 0, answers: answersFor(setFor(0), wrong) }, at);
    expect(r).toMatchObject({ score: SET_SIZE - wrong, passed: false, xp: 0, cardsAdded: wrong });
    expect(activity.recordActivity).not.toHaveBeenCalled();
    expect(review.addCorrectionCard.mock.calls.length + review.addWordCard.mock.calls.length).toBe(wrong);
    expect(results[0]).toMatchObject({ game: EXERCISES_GAME, day, won: false, score: SET_SIZE - wrong });
  });

  it('rejects unfinished, invalid and expired sets', async () => {
    const { service, results } = setup();
    const set = setFor(0);
    const good = { level: 'B1', skill: 'mixed', day, round: 0, answers: answersFor(set, 0) };
    const { [set[0].id]: _dropped, ...partial } = good.answers;
    for (const bad of [
      { ...good, answers: partial },
      { ...good, answers: undefined },
      { ...good, answers: ['x'] },
      { ...good, level: 'Z9' },
      { ...good, skill: 'nope' },
      { ...good, round: -1 },
      { ...good, round: 'x' },
      { ...good, day: '2026-11-01' },
    ]) {
      await expect(service.finish('u1', bad, at)).rejects.toThrow(BadRequestException);
    }
    expect(results).toHaveLength(0);
  });

  it('still accepts a set started just before midnight', async () => {
    const { service, results } = setup();
    const justAfter = new Date(Date.UTC(2026, 10, 6, 0, 5));
    const r = await service.finish('u1', { level: 'B1', skill: 'mixed', day, round: 0, answers: answersFor(setFor(0), 0) }, justAfter);
    expect(r.passed).toBe(true);
    expect(results[0].day).toBe('2026-11-06');
  });
});
