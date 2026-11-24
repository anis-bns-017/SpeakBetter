// Word games: pure rules and word picking (no database), so they are easy to test.
import { optionOrder } from '../library/library.content';
import type { Dictionary, DictWord, Level } from '../dictionary/dictionary.data';

export const WORDLE_LENGTH = 5;
export const WORDLE_GUESSES = 6;
export const SCRAMBLE_ROUND = 5;
export const SCRAMBLE_PASS = 4;
export const WORDLE_XP_BASE = 4;
export const SCRAMBLE_XP = 6;

export type LetterMark = 'hit' | 'near' | 'miss';

const PLAIN = /^[a-z]+$/;

/** Whole days since 1970 for a "YYYY-MM-DD" date, so everyone on the same calendar day shares a word */
export function dayNumber(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return 0;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** Marks a guess against the answer; repeated letters are handled like the original game */
export function scoreGuess(guess: string, answer: string): LetterMark[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const marks: LetterMark[] = Array.from({ length: g.length }, () => 'miss');
  const left = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) marks[i] = 'hit';
    else left.set(a[i], (left.get(a[i]) ?? 0) + 1);
  }
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === 'hit') continue;
    const n = left.get(g[i]) ?? 0;
    if (n > 0) {
      marks[i] = 'near';
      left.set(g[i], n - 1);
    }
  }
  return marks;
}

const EASY_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2'];

/** Words that can be the day's answer: five letters, everyday levels, common first */
export function wordleAnswers(dict: Dictionary): DictWord[] {
  return dict.words.filter((w) => w.w.length === WORDLE_LENGTH && PLAIN.test(w.w) && EASY_LEVELS.includes(w.lv) && !w.est);
}

/** The answer for a calendar day: a fixed shuffle of the pool, so a word only comes back after the whole pool */
export function wordleAnswerFor(dict: Dictionary, day: string): DictWord {
  const pool = wordleAnswers(dict).sort((a, b) => a.w.localeCompare(b.w));
  const order = optionOrder('wordle:v1', pool.length);
  return pool[order[dayNumber(day) % pool.length]];
}

/** Is this a real word we accept as a guess? Plain five letters that the dictionary knows (forms included) */
export function isValidGuess(dict: Dictionary, guess: string): boolean {
  const g = guess.toLowerCase();
  if (g.length !== WORDLE_LENGTH || !PLAIN.test(g)) return false;
  return dict.byText.has(g) || dict.byForm.has(g);
}

export interface WordleOutcome {
  rows: Array<{ guess: string; marks: LetterMark[] }>;
  solved: boolean;
  over: boolean;
}

/** Replays every guess sent by the page, so the page never holds the answer */
export function playWordle(dict: Dictionary, answer: string, guesses: string[]): WordleOutcome | { error: string } {
  const rows: WordleOutcome['rows'] = [];
  let solved = false;
  for (const raw of guesses.slice(0, WORDLE_GUESSES)) {
    if (solved) return { error: 'You already solved it' };
    const guess = String(raw ?? '').toLowerCase().trim();
    if (!isValidGuess(dict, guess)) return { error: `"${guess}" is not in our word list` };
    const marks = scoreGuess(guess, answer);
    rows.push({ guess, marks });
    solved = marks.every((m) => m === 'hit');
  }
  return { rows, solved, over: solved || rows.length >= WORDLE_GUESSES };
}

export function wordleXp(attempts: number): number {
  return WORDLE_XP_BASE + Math.max(0, WORDLE_GUESSES - attempts);
}

// ---- Unscramble ----

export interface ScrambleItem {
  id: string;
  word: string;
  letters: string;
  hint: string;
  pos: string;
}

const LEVEL_ORDER: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Letters in a shuffled order that is never the word itself */
export function scrambleLetters(word: string, seed: string): string {
  const letters = word.split('');
  if (new Set(letters).size < 2) return word;
  for (let attempt = 0; attempt < 8; attempt++) {
    const out = optionOrder(`${seed}:${attempt}`, letters.length).map((i) => letters[i]).join('');
    if (out !== word) return out;
  }
  return letters.slice().reverse().join('') === word ? letters.slice(1).concat(letters[0]).join('') : letters.slice().reverse().join('');
}

/** A short clue from the word's first meaning, with the word itself hidden */
export function clueFor(w: DictWord): string {
  const sense = w.s.find((x) => x.d && x.d.length >= 12) ?? w.s[0];
  if (!sense) return '';
  const hidden = new RegExp(`\\b${w.w}\\w*`, 'gi');
  return sense.d.replace(/^\([^)]*\)\s*/, '').replace(hidden, '…').slice(0, 140);
}

/** Words for a round: this level and the one below, five to eight letters, with a usable clue */
export function pickScramble(dict: Dictionary, level: string, seed: string, count = SCRAMBLE_ROUND): ScrambleItem[] {
  const at = Math.max(0, LEVEL_ORDER.indexOf(level as Level));
  const wanted = new Set<Level>([LEVEL_ORDER[at], LEVEL_ORDER[Math.max(0, at - 1)]]);
  const pool = dict.words
    .filter((w) => w.w.length >= 5 && w.w.length <= 8 && PLAIN.test(w.w) && wanted.has(w.lv) && !w.est && clueFor(w).length >= 12)
    .sort((a, b) => a.w.localeCompare(b.w));
  if (!pool.length) return [];
  return optionOrder(`scramble:${seed}`, pool.length)
    .slice(0, count)
    .map((i) => {
      const w = pool[i];
      return { id: w.id, word: w.w, letters: scrambleLetters(w.w, `${seed}:${w.id}`), hint: clueFor(w), pos: w.pos[0] ?? '' };
    });
}

const sorted = (s: string) => s.toLowerCase().split('').sort().join('');

/** Right if it is the word, or another real word made from the same letters */
export function isScrambleRight(dict: Dictionary, word: string, typed: string): boolean {
  const t = String(typed ?? '').toLowerCase().trim();
  if (!PLAIN.test(t) || t.length !== word.length) return false;
  if (t === word) return true;
  return sorted(t) === sorted(word) && (dict.byText.has(t) || dict.byForm.has(t));
}
