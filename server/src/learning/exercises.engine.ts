// server/src/learning/exercises.engine.ts
/**
 * Quick mixed practice, built from the real grammar lessons and word packs. The server picks the set and marks it,
 * so a score always means something. Pure functions, so they can be tested without a database.
 */

import { GRAMMAR, LESSON_BY_ID, type GrammarExercise, type GrammarLesson, type GrammarLevel } from '../grammar/grammar.content';
import { judge as judgeGrammar, shuffledWords } from '../grammar/grammar.engine';
import { optionOrder } from '../library/library.content';
import { PACKS, PACK_BY_ID, type PackWord, type VocabPack } from '../vocab-packs/packs.content';
import { judge as judgePack, questionFor, shownOrder, type QuizQuestion } from '../vocab-packs/packs.engine';

export const SET_SIZE = 8;
/** Share of a set that must be right to pass */
export const PASS_RATIO = 0.6;
/** XP for the first set passed each day */
export const EXERCISES_XP = 8;
export const EXERCISE_LEVELS: GrammarLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const EXERCISE_SKILLS = ['mixed', 'grammar', 'vocabulary'] as const;
export type ExerciseSkill = (typeof EXERCISE_SKILLS)[number];

export const passMark = (total: number): number => Math.ceil(total * PASS_RATIO);
export const isExerciseLevel = (value: unknown): value is GrammarLevel => EXERCISE_LEVELS.includes(value as GrammarLevel);
export const isExerciseSkill = (value: unknown): value is ExerciseSkill => EXERCISE_SKILLS.includes(value as ExerciseSkill);

export type ExerciseRef =
  | { skill: 'grammar'; id: string; lesson: GrammarLesson; exercise: GrammarExercise }
  | { skill: 'vocabulary'; id: string; pack: VocabPack; word: PackWord };

const grammarRef = (lesson: GrammarLesson, exercise: GrammarExercise): ExerciseRef => ({
  skill: 'grammar',
  id: `g|${lesson.id}|${exercise.id}`,
  lesson,
  exercise,
});
const wordRef = (pack: VocabPack, word: PackWord): ExerciseRef => ({ skill: 'vocabulary', id: `v|${pack.id}|${word.id}`, pack, word });

const grammarPools = new Map<GrammarLevel, ExerciseRef[]>();
const wordPools = new Map<GrammarLevel, ExerciseRef[]>();

/** The level's grammar exercises; the level below joins in when a level has too few for varied sets */
function grammarPool(level: GrammarLevel): ExerciseRef[] {
  let pool = grammarPools.get(level);
  if (!pool) {
    const at = (lv: GrammarLevel) => GRAMMAR.filter((l) => l.level === lv).flatMap((l) => l.exercises.map((e) => grammarRef(l, e)));
    const own = at(level);
    const below = EXERCISE_LEVELS[EXERCISE_LEVELS.indexOf(level) - 1];
    pool = own.length >= SET_SIZE * 2 || !below ? own : [...own, ...at(below)];
    grammarPools.set(level, pool);
  }
  return pool;
}

/** Every word at the level once, from packs big enough to offer three wrong answers */
function wordPool(level: GrammarLevel): ExerciseRef[] {
  let pool = wordPools.get(level);
  if (!pool) {
    const seen = new Set<string>();
    pool = PACKS.filter((p) => p.level === level && p.words.length >= 4).flatMap((p) =>
      p.words
        .filter((w) => {
          const key = w.word.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((w) => wordRef(p, w)),
    );
    wordPools.set(level, pool);
  }
  return pool;
}

const take = (pool: ExerciseRef[], count: number, seed: string) =>
  optionOrder(seed, pool.length)
    .slice(0, Math.min(count, pool.length))
    .map((i) => pool[i]);

/** The seed of one set: the same set every time it is asked for, a different one for the next round */
export const setSeed = (userId: string, day: string, level: GrammarLevel, skill: ExerciseSkill, round: number) =>
  `exercises:${userId}:${day}:${level}:${skill}:${round}`;

/** The exercises of one set. A mixed set alternates grammar and words. */
export function pickSet(level: GrammarLevel, skill: ExerciseSkill, seed: string, size = SET_SIZE): ExerciseRef[] {
  if (skill === 'grammar') return take(grammarPool(level), size, `${seed}:g`);
  if (skill === 'vocabulary') return take(wordPool(level), size, `${seed}:v`);
  const grammar = take(grammarPool(level), Math.ceil(size / 2), `${seed}:g`);
  const words = take(wordPool(level), Math.floor(size / 2), `${seed}:v`);
  const mixed: ExerciseRef[] = [];
  for (let i = 0; i < Math.max(grammar.length, words.length); i++) {
    if (grammar[i]) mixed.push(grammar[i]);
    if (words[i]) mixed.push(words[i]);
  }
  return mixed;
}

/** Any exercise by its id, or null */
export function findExercise(id: unknown): ExerciseRef | null {
  const [type, parent, child, ...rest] = String(id ?? '').split('|');
  if (!parent || !child || rest.length) return null;
  if (type === 'g') {
    const lesson = LESSON_BY_ID.get(parent);
    const exercise = lesson?.exercises.find((e) => e.id === child);
    return lesson && exercise ? grammarRef(lesson, exercise) : null;
  }
  if (type === 'v') {
    const pack = PACK_BY_ID.get(parent);
    const word = pack?.words.find((w) => w.id === child);
    return pack && word && pack.words.length >= 4 ? wordRef(pack, word) : null;
  }
  return null;
}

/** Keeps one learner's option order the same each time they see an exercise */
const itemSeed = (userId: string, id: string) => `${userId}:exercises:${id}`;

const wordQuestion = (ref: Extract<ExerciseRef, { skill: 'vocabulary' }>, seed: string): QuizQuestion =>
  questionFor(ref.pack, ref.word, optionOrder(`${seed}:kind`, 2)[0] === 1, seed);

export type PublicExercise =
  | { id: string; skill: 'grammar' | 'vocabulary'; topic: string; kind: 'blank' | 'correct' | 'meaning' | 'gap'; prompt: string; options: string[] }
  | { id: string; skill: 'grammar'; topic: string; kind: 'order'; prompt: string; words: string[] }
  | { id: string; skill: 'grammar'; topic: string; kind: 'type'; prompt: string };

/** What the page shows, without the answer */
export function presentExercise(ref: ExerciseRef, userId: string): PublicExercise {
  const seed = itemSeed(userId, ref.id);
  if (ref.skill === 'vocabulary') {
    const q = wordQuestion(ref, seed);
    return { id: ref.id, skill: 'vocabulary', topic: ref.pack.title, kind: q.kind, prompt: q.prompt, options: shownOrder(seed, q).map((i) => q.options[i]) };
  }
  const base = { id: ref.id, skill: 'grammar' as const, topic: ref.lesson.title, prompt: ref.exercise.prompt };
  const ex = ref.exercise;
  switch (ex.kind) {
    case 'blank':
    case 'correct':
      return { ...base, kind: ex.kind, options: optionOrder(seed, ex.options.length).map((i) => ex.options[i]) };
    case 'order':
      return { ...base, kind: 'order', words: shuffledWords(seed, ex.words) };
    case 'type':
      return { ...base, kind: 'type' };
  }
}

export interface ExerciseJudgement {
  answered: boolean;
  correct: boolean;
  original: string;
  corrected: string;
  explanation: string;
}

/** Marks one answer: the option's position as shown, the words in order, or the typed text */
export function judgeExercise(ref: ExerciseRef, answer: unknown, userId: string): ExerciseJudgement {
  const seed = itemSeed(userId, ref.id);
  if (ref.skill === 'grammar') {
    const r = judgeGrammar(ref.exercise, answer, seed);
    return { answered: r.answered, correct: r.correct, original: r.original, corrected: r.corrected, explanation: ref.exercise.explanation };
  }
  const r = judgePack(wordQuestion(ref, seed), answer, seed);
  return {
    answered: r.answered,
    correct: r.correct,
    original: r.chosen ?? '',
    corrected: r.right,
    explanation: `${ref.word.word}: ${ref.word.meaning}`,
  };
}
