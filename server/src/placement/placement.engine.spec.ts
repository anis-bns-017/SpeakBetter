import { PLACEMENT_BANK, SKILLS, getItem } from './placement.bank';
import {
  CEFR_CODES,
  QUESTION_COUNT,
  analyzeSpeaking,
  estimateAbility,
  optionOrder,
  pickNextItem,
  scoreAttempt,
  seededRng,
  thetaToLevelIndex,
  type AnswerRecord,
} from './placement.engine';

/** Runs a whole test with a learner defined by `answer(item) => correct` */
function runTest(answer: (level: number, skill: string, n: number) => boolean, seed = 'attempt-1'): AnswerRecord[] {
  const answers: AnswerRecord[] = [];
  for (let n = 0; n < QUESTION_COUNT; n++) {
    const item = pickNextItem(answers, seededRng(`${seed}:next:${n}`));
    if (!item) throw new Error(`ran out of questions at ${n}`);
    answers.push({ itemId: item.id, skill: item.skill, level: item.level, correct: answer(item.level, item.skill, n) });
  }
  return answers;
}

describe('placement bank', () => {
  it('has unique ids and four distinct options per question', () => {
    const ids = PLACEMENT_BANK.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of PLACEMENT_BANK) {
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options).size).toBe(4);
      expect(item.level).toBeGreaterThanOrEqual(0);
      expect(item.level).toBeLessThanOrEqual(5);
    }
  });

  it('covers every skill at every level with at least two questions', () => {
    for (const skill of SKILLS) {
      for (let level = 0; level < CEFR_CODES.length; level++) {
        const n = PLACEMENT_BANK.filter((i) => i.skill === skill && i.level === level).length;
        expect(n).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('gives reading questions a passage and listening questions audio', () => {
    for (const item of PLACEMENT_BANK) {
      if (item.skill === 'READING') expect(item.passage).toBeTruthy();
      if (item.skill === 'LISTENING') expect(item.audio).toBeTruthy();
    }
  });

  it('looks questions up by id', () => {
    expect(getItem('g-a1-1')?.skill).toBe('GRAMMAR');
    expect(getItem('nope')).toBeUndefined();
    expect(getItem(null)).toBeUndefined();
  });
});

describe('option order', () => {
  it('is a stable permutation for one attempt and question', () => {
    const a = optionOrder('att', 'g-a1-1');
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(optionOrder('att', 'g-a1-1')).toEqual(a);
  });

  it('puts the correct answer in different places across questions', () => {
    const positions = new Set(PLACEMENT_BANK.map((i) => optionOrder('att', i.id).indexOf(0)));
    expect(positions.size).toBe(4);
  });
});

describe('estimateAbility', () => {
  it('starts near B1 with no answers', () => {
    expect(thetaToLevelIndex(estimateAbility([]).theta)).toBe(2);
  });

  it('rises with correct answers and falls with wrong ones', () => {
    const right = estimateAbility([{ level: 3, correct: true }, { level: 4, correct: true }]).theta;
    const wrong = estimateAbility([{ level: 3, correct: false }, { level: 1, correct: false }]).theta;
    expect(right).toBeGreaterThan(wrong);
  });

  it('is more certain after more answers', () => {
    const few = estimateAbility([{ level: 2, correct: true }]);
    const many = estimateAbility(
      Array.from({ length: 12 }, (_, i) => ({ level: 2 + (i % 2), correct: i % 3 !== 0 })),
    );
    expect(many.sd).toBeLessThan(few.sd);
  });

  it('maps ability to a level index inside A1..C2', () => {
    expect(thetaToLevelIndex(-5)).toBe(0);
    expect(thetaToLevelIndex(99)).toBe(5);
    expect(thetaToLevelIndex(2.5)).toBe(2);
  });
});

describe('pickNextItem', () => {
  it('never repeats a question and stops after the last one', () => {
    const answers = runTest(() => true);
    const ids = answers.map((a) => a.itemId);
    expect(new Set(ids).size).toBe(QUESTION_COUNT);
    expect(pickNextItem(answers, seededRng('x'))).toBeNull();
  });

  it('asks every skill the same number of times', () => {
    const answers = runTest((level) => level <= 2);
    for (const skill of SKILLS) {
      expect(answers.filter((a) => a.skill === skill)).toHaveLength(QUESTION_COUNT / SKILLS.length);
    }
  });

  it('starts around B1 and moves up after right answers, down after wrong ones', () => {
    const first = pickNextItem([], seededRng('s'))!;
    expect(Math.abs(first.level - 2)).toBeLessThanOrEqual(1);

    const up = runTest(() => true);
    const down = runTest(() => false);
    const mean = (a: AnswerRecord[]) => a.slice(-6).reduce((s, x) => s + x.level, 0) / 6;
    expect(mean(up)).toBeGreaterThan(mean(down));
    expect(mean(up)).toBeGreaterThanOrEqual(4);
    expect(mean(down)).toBeLessThanOrEqual(1);
  });
});

describe('scoreAttempt', () => {
  it.each([0, 1, 2, 3, 4, 5])('places a learner who masters exactly level %i within one level', (mastered) => {
    const result = scoreAttempt(runTest((level) => level <= mastered, `seed-${mastered}`));
    const got = CEFR_CODES.indexOf(result.level);
    expect(Math.abs(got - mastered)).toBeLessThanOrEqual(1);
  });

  it('places someone who gets everything right at C1 or C2, and everything wrong at A1', () => {
    expect(['C1', 'C2']).toContain(scoreAttempt(runTest(() => true)).level);
    expect(scoreAttempt(runTest(() => false)).level).toBe('A1');
  });

  it('puts a pure guesser at the bottom', () => {
    const rng = seededRng('guesser');
    const result = scoreAttempt(runTest(() => rng() < 0.25));
    expect(CEFR_CODES.indexOf(result.level)).toBeLessThanOrEqual(1);
  });

  it('reports per-skill results and the strongest and weakest skill', () => {
    // Fine at listening and reading up to C1, weak at grammar and vocabulary beyond A2
    const result = scoreAttempt(
      runTest((level, skill) => (skill === 'LISTENING' || skill === 'READING' ? level <= 4 : level <= 1), 'skills'),
    );
    expect(result.total).toBe(QUESTION_COUNT);
    expect(result.correct).toBeLessThan(QUESTION_COUNT);
    expect(['LISTENING', 'READING']).toContain(result.strongest);
    expect(['GRAMMAR', 'VOCABULARY']).toContain(result.weakest);
    for (const skill of SKILLS) expect(result.skills[skill].total).toBe(QUESTION_COUNT / SKILLS.length);
    expect(CEFR_CODES.indexOf(result.skills.LISTENING.level)).toBeGreaterThan(
      CEFR_CODES.indexOf(result.skills.GRAMMAR.level),
    );
  });

  it('is only confident once enough questions were answered', () => {
    expect(scoreAttempt(runTest(() => true).slice(0, 4)).confidence).toBe('low');
  });
});

describe('analyzeSpeaking', () => {
  const talk =
    'Last summer I travelled to the coast with my family and we stayed in a small hotel near the beach. ' +
    'Every morning we walked along the water, and in the evening we cooked dinner together on the terrace.';

  it('measures words, pace and fluency from a transcript', () => {
    const sample = analyzeSpeaking(talk, 20);
    expect(sample.tooShort).toBe(false);
    expect(sample.words).toBeGreaterThan(30);
    expect(sample.wpm).toBeGreaterThan(80);
    expect(sample.fluency).not.toBeNull();
  });

  it('counts filler words', () => {
    const filled = analyzeSpeaking(`um ${talk} uh basically ${talk}`, 40);
    expect(filled.fillersPer100).toBeGreaterThan(0);
  });

  it('flags a sample that is too short to judge', () => {
    expect(analyzeSpeaking('I like tea', 3).tooShort).toBe(true);
    expect(analyzeSpeaking('', 3).tooShort).toBe(true);
  });
});
