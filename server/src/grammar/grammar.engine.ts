// server/src/grammar/grammar.engine.ts
/** Checking grammar answers. Pure functions, so they can be tested without a database. */

import { optionOrder } from '../library/library.content';
import type { GrammarExercise } from './grammar.content';

/** Share of exercises that must be right to pass a lesson */
export const PASS_RATIO = 0.6;
/** XP the first time you pass a lesson */
export const GRAMMAR_XP = 10;

export const passMark = (total: number): number => Math.ceil(total * PASS_RATIO);

/** Lower-case, one kind of apostrophe, no punctuation, single spaces: so "Didn't  eat." matches "didn't eat" */
export const normalizeAnswer = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const GAP = '___';
export const fillGap = (prompt: string, text: string): string => prompt.replace(GAP, text);

/** The seed that keeps one learner's shuffle the same every time they open a lesson */
export const seedFor = (userId: string, lessonId: string, exerciseId: string): string => `${userId}:${lessonId}:${exerciseId}`;

/** The words of an "order" exercise in a shuffled order that is never the right one */
export function shuffledWords(seed: string, words: string[]): string[] {
  const order = optionOrder(seed, words.length);
  const shuffled = order.map((i) => words[i]);
  if (words.length > 1 && shuffled.every((w, i) => w === words[i])) {
    return [...shuffled.slice(1), shuffled[0]];
  }
  return shuffled;
}

export interface Judgement {
  /** False when the answer is missing or not in the shape asked for */
  answered: boolean;
  correct: boolean;
  /** What the learner wrote, as a full sentence or phrase */
  original: string;
  /** The right version, as a full sentence or phrase */
  corrected: string;
}

/**
 * Marks one answer. What `answer` holds depends on the kind: blank and correct send the index of the option
 * as it was shown, order sends the words in the order chosen, type sends the typed text.
 */
export function judge(exercise: GrammarExercise, answer: unknown, seed: string): Judgement {
  const none = (corrected: string): Judgement => ({ answered: false, correct: false, original: '', corrected });

  switch (exercise.kind) {
    case 'blank':
    case 'correct': {
      const options = exercise.options;
      const order = optionOrder(seed, options.length);
      const right = exercise.kind === 'blank' ? fillGap(exercise.prompt, options[0]) : options[0];
      const pick = typeof answer === 'number' || typeof answer === 'string' ? Number(answer) : NaN;
      if (!Number.isInteger(pick) || pick < 0 || pick >= order.length) return none(right);
      const chosen = options[order[pick]];
      return {
        answered: true,
        correct: order[pick] === 0,
        original: exercise.kind === 'blank' ? fillGap(exercise.prompt, chosen) : chosen,
        corrected: right,
      };
    }
    case 'order': {
      const right = exercise.words.join(' ');
      if (!Array.isArray(answer) || answer.length !== exercise.words.length || answer.some((w) => typeof w !== 'string')) return none(right);
      const written = (answer as string[]).join(' ');
      const accepted = new Set([right, ...(exercise.alsoAccept ?? [])].map(normalizeAnswer));
      return { answered: true, correct: accepted.has(normalizeAnswer(written)), original: written, corrected: right };
    }
    case 'type': {
      const right = fillGap(exercise.prompt, exercise.answers[0]);
      const typed = typeof answer === 'string' ? answer.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
      if (!typed) return none(right);
      const accepted = new Set(exercise.answers.map(normalizeAnswer));
      return { answered: true, correct: accepted.has(normalizeAnswer(typed)), original: fillGap(exercise.prompt, typed), corrected: right };
    }
  }
}
