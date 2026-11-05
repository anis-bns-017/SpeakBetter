// server/src/vocab-packs/word-of-day.ts
/**
 * Word of the day: one word from the vocabulary packs for each level and day. Everyone at the same level gets
 * the same word on the same day, and every word in the pool comes up once before any comes back.
 * Pure functions, so the choice can be tested without a database or a clock.
 */

import { optionOrder } from '../library/library.content';
import { PACKS, PACK_LEVELS, type PackLevel, type PartOfSpeech } from './packs.content';

export interface DailyWord {
  packId: string;
  packTitle: string;
  level: PackLevel;
  wordId: string;
  word: string;
  pos: PartOfSpeech;
  meaning: string;
  example: string;
}

/** The words a learner at `level` can get: that level's packs and the level below, so there is always plenty */
export function poolFor(level: PackLevel): DailyWord[] {
  const at = Math.max(0, PACK_LEVELS.indexOf(level));
  const levels = new Set<PackLevel>([PACK_LEVELS[at], PACK_LEVELS[Math.max(0, at - 1)]]);
  return PACKS.filter((p) => levels.has(p.level)).flatMap((p) =>
    p.words.map((w) => ({
      packId: p.id,
      packTitle: p.title,
      level: p.level,
      wordId: w.id,
      word: w.word,
      pos: w.pos,
      meaning: w.meaning,
      example: w.example,
    })),
  );
}

/** Days since 1970-01-01 for a YYYY-MM-DD day */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/**
 * The word for `level` on `day`. The pool has one fixed shuffled order per level and each day takes the next
 * word in it, so within any run of days as long as the pool, no word comes up twice (a fresh shuffle per cycle
 * could repeat a word across the boundary within days).
 */
export function wordOfDay(level: PackLevel, day: string): DailyWord {
  const pool = poolFor(level);
  const order = optionOrder(`word-of-day:${level}`, pool.length);
  const n = dayNumber(day);
  return pool[order[((n % pool.length) + pool.length) % pool.length]];
}

/**
 * Three meanings to choose from for "Do you know it?": the right one and two from other words in the same pack,
 * in an order that is the same all day. `answer` is the position of the right one.
 */
export function meaningChoices(word: DailyWord, day: string): { options: string[]; answer: number } {
  const pack = PACKS.find((p) => p.id === word.packId)!;
  const others = pack.words.filter((w) => w.id !== word.wordId && w.meaning !== word.meaning);
  const picked = optionOrder(`word-of-day:${word.packId}:${word.wordId}:${day}:d`, others.length)
    .slice(0, 2)
    .map((i) => others[i].meaning);
  const bank = [word.meaning, ...picked];
  const order = optionOrder(`word-of-day:${word.packId}:${word.wordId}:${day}:o`, bank.length);
  return { options: order.map((i) => bank[i]), answer: order.indexOf(0) };
}
