// server/src/vocab-packs/packs.engine.ts
/** Building and marking vocabulary pack quizzes. Pure functions, so they can be tested without a database. */

import { optionOrder } from '../library/library.content';
import type { PackWord, VocabPack } from './packs.content';

export const QUIZ_SIZE = 8;
/** Share of the questions that must be right to pass a pack's quiz */
export const PASS_RATIO = 0.7;
/** XP the first time you pass a pack's quiz */
export const PACK_XP = 8;

export const passMark = (total: number): number => Math.ceil(total * PASS_RATIO);

export type QuizKind = 'meaning' | 'gap';

export interface QuizQuestion {
  /** `${wordId}:${kind}` */
  id: string;
  kind: QuizKind;
  wordId: string;
  /** The meaning to match, or the example sentence with the word blanked out */
  prompt: string;
  /** options[0] is the right one; the page shows them in a per-learner shuffled order */
  options: string[];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The example sentence with the word replaced by a gap, or null when the word does not appear in it */
export function gapSentence(example: string, word: string): string | null {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'iu');
  return pattern.test(example) ? example.replace(pattern, '_____') : null;
}

/** Up to three wrong options for a word, preferring the same part of speech so they look plausible */
function distractors(pack: VocabPack, target: PackWord, seed: string): string[] {
  const others = pack.words.filter((x) => x.id !== target.id);
  const ranked = optionOrder(seed, others.length).map((i) => others[i]);
  const same = ranked.filter((x) => x.pos === target.pos);
  const different = ranked.filter((x) => x.pos !== target.pos);
  return [...same, ...different].slice(0, 3).map((x) => x.word);
}

/**
 * The quiz for one learner and one attempt: a different mix of words each time (the seed holds the attempt
 * number), alternating "which word means this?" with "which word fills the gap?".
 */
export function buildQuiz(pack: VocabPack, seed: string, size = QUIZ_SIZE): QuizQuestion[] {
  const count = Math.min(size, pack.words.length);
  const picked = optionOrder(`${seed}:words`, pack.words.length)
    .slice(0, count)
    .map((i) => pack.words[i]);
  return picked.map((word, position) => {
    const gap = gapSentence(word.example, word.word);
    // Gap questions need the word in its example; fall back to the meaning question when it is not
    const kind: QuizKind = position % 2 === 1 && gap ? 'gap' : 'meaning';
    const id = `${word.id}:${kind}`;
    return {
      id,
      kind,
      wordId: word.id,
      prompt: kind === 'gap' ? (gap as string) : word.meaning,
      options: [word.word, ...distractors(pack, word, `${seed}:${id}:d`)],
    };
  });
}

/** The seed for one learner's quiz attempt */
export const quizSeed = (userId: string, packId: string, attempts: number): string => `${userId}:${packId}:${attempts}`;

/** The order one question's options are shown in: `order[i]` is the index in `options` of the option at slot i */
export const shownOrder = (seed: string, question: QuizQuestion): number[] => optionOrder(`${seed}:${question.id}:o`, question.options.length);

export interface Judgement {
  answered: boolean;
  correct: boolean;
  /** The option the learner chose, as text */
  chosen: string | null;
  right: string;
}

/** Marks one answer, given as the position of the option as shown */
export function judge(question: QuizQuestion, answer: unknown, seed: string): Judgement {
  const right = question.options[0];
  const order = shownOrder(seed, question);
  const pick = typeof answer === 'number' || typeof answer === 'string' ? Number(answer) : NaN;
  if (!Number.isInteger(pick) || pick < 0 || pick >= order.length) return { answered: false, correct: false, chosen: null, right };
  return { answered: true, correct: order[pick] === 0, chosen: question.options[order[pick]], right };
}
