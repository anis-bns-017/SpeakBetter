// server/src/dictation/dictation.engine.ts
/**
 * Listening dictation: hear a sentence, type it, see word by word what you got. Sentences come from the
 * library's graded texts. Pure functions, so marking can be tested without a database.
 */

import { LIBRARY, LIBRARY_LEVELS, optionOrder, type LibraryLevel } from '../library/library.content';

export const SESSION_SIZE = 6;
/** XP for the first dictation finished each day */
export const DICTATION_XP = 6;
const MIN_WORDS = 4;
const MAX_WORDS = 18;

export interface DictationItem {
  /** `${textId}:${sentenceIndex}` */
  id: string;
  text: string;
  level: LibraryLevel;
}

const wordCount = (text: string) => text.trim().split(/\s+/).length;

/** Every sentence a learner at `level` can get; the level below joins in when a level has few sentences */
export function poolFor(level: LibraryLevel): DictationItem[] {
  const at = Math.max(0, LIBRARY_LEVELS.indexOf(level));
  const collect = (lv: LibraryLevel) =>
    LIBRARY.filter((t) => t.level === lv).flatMap((t) =>
      t.sentences
        .map((s, i) => ({ id: `${t.id}:${i}`, text: s.text, level: t.level }))
        .filter((s) => wordCount(s.text) >= MIN_WORDS && wordCount(s.text) <= MAX_WORDS),
    );
  const own = collect(LIBRARY_LEVELS[at]);
  return own.length >= SESSION_SIZE * 3 || at === 0 ? own : [...own, ...collect(LIBRARY_LEVELS[at - 1])];
}

const ITEM_BY_ID = new Map(LIBRARY_LEVELS.flatMap((lv) => poolFor(lv)).map((i) => [i.id, i]));
/** Any sentence by id, whatever the level (the pools overlap) */
export const itemById = (id: string): DictationItem | undefined => ITEM_BY_ID.get(id);

/** The sentences for one session: the same all day for the same attempt, different on the next attempt */
export function pickSession(level: LibraryLevel, seed: string, size = SESSION_SIZE): DictationItem[] {
  const pool = poolFor(level);
  return optionOrder(`dictation:${seed}`, pool.length)
    .slice(0, Math.min(size, pool.length))
    .map((i) => pool[i]);
}

/** Lower case, one kind of apostrophe, no punctuation around words */
export const normalizeWord = (word: string): string =>
  word
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')
    .replace(/^'+|'+$/g, '');

const words = (text: string): string[] => text.trim().split(/\s+/).filter((w) => normalizeWord(w) !== '');

/** Letters you would have to change to turn one word into the other */
function letterDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

export type TokenKind = 'ok' | 'spelling' | 'wrong' | 'missing' | 'extra';

export interface Token {
  kind: TokenKind;
  /** The word as written in the sentence (for extra: the word you typed) */
  word: string;
  /** What you typed in its place (spelling and wrong) */
  typed?: string;
}

export interface Marking {
  tokens: Token[];
  /** Words right, out of the words in the sentence */
  correct: number;
  total: number;
  /** 0-100 */
  score: number;
}

/**
 * Lines up what you typed against the sentence, word by word (the fewest changes that turn one into the
 * other), and labels each word: right, a small spelling slip, a different word, missing, or extra.
 */
export function markDictation(target: string, typed: string): Marking {
  const want = words(target);
  const got = words(typed);
  const a = want.map(normalizeWord);
  const b = got.map(normalizeWord);
  const n = a.length;
  const m = b.length;

  // Costs: a missing or extra word 2, a small spelling slip 2, a different word 3. A different word costing more
  // than a gap means "the station" typed as "station today" reads as one word missing and one extra, not two
  // wrong words; a slip costing the same as a gap keeps "lifes" lined up with "lives".
  const GAP = 2;
  const close = (x: string, y: string) => x.length >= 4 && letterDistance(x, y) <= (x.length >= 8 ? 2 : 1);
  const swap = (i: number, j: number) => (a[i] === b[j] ? 0 : close(a[i], b[j]) ? 2 : 3);

  // cost[i][j]: cheapest way to line up a[i..] with b[j..]
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      if (i === n) cost[i][j] = (m - j) * GAP;
      else if (j === m) cost[i][j] = (n - i) * GAP;
      else cost[i][j] = Math.min(swap(i, j) + cost[i + 1][j + 1], GAP + cost[i + 1][j], GAP + cost[i][j + 1]);
    }
  }

  const tokens: Token[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && cost[i][j] === swap(i, j) + cost[i + 1][j + 1]) {
      if (a[i] === b[j]) tokens.push({ kind: 'ok', word: want[i] });
      else tokens.push({ kind: close(a[i], b[j]) ? 'spelling' : 'wrong', word: want[i], typed: got[j] });
      i++;
      j++;
    } else if (i < n && cost[i][j] === GAP + cost[i + 1][j]) {
      tokens.push({ kind: 'missing', word: want[i] });
      i++;
    } else {
      tokens.push({ kind: 'extra', word: got[j] });
      j++;
    }
  }

  const correct = tokens.filter((t) => t.kind === 'ok').length;
  return { tokens, correct, total: n, score: n === 0 ? 0 : Math.round((correct / n) * 100) };
}
