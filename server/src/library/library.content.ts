/**
 * The reading and listening library: texts for every level (A1 to C2), each with key words, questions of
 * several kinds and things to talk about afterwards. The texts live in the library.texts.* files; this file puts
 * them together in reading order and holds the helpers the service and the tests share.
 *
 * Multiple-choice questions list the right answer first and the service shuffles the options for each reader.
 * True / False / Not given questions keep their order.
 */

import { CORE_TEXTS } from './library.texts.core';
import { CORE_EXTRAS } from './library.texts.extras';
import { A1_TEXTS } from './library.texts.a1';
import { A2_TEXTS } from './library.texts.a2';
import { B1_TEXTS } from './library.texts.b1';
import { B2_TEXTS } from './library.texts.b2';
import { C1_TEXTS } from './library.texts.c1';
import { C2_TEXTS } from './library.texts.c2';
import { LIBRARY_LEVELS, type LibraryLevel, type LibraryText, type Question } from './library.types';

export * from './library.types';

const core: LibraryText[] = CORE_TEXTS.map((t) => ({ ...t, vocab: CORE_EXTRAS[t.id]?.vocab ?? [], discuss: CORE_EXTRAS[t.id]?.discuss ?? [] }));

const ALL: LibraryText[] = [...core, ...A1_TEXTS, ...A2_TEXTS, ...B1_TEXTS, ...B2_TEXTS, ...C1_TEXTS, ...C2_TEXTS];

/** Every text, easiest level first; within a level, in the order they are meant to be read */
export const LIBRARY: LibraryText[] = LIBRARY_LEVELS.flatMap((level) => ALL.filter((t) => t.level === level));

export const TEXT_BY_ID = new Map(LIBRARY.map((t) => [t.id, t]));

export const wordCount = (text: LibraryText): number => text.sentences.reduce((n, x) => n + x.text.split(/\s+/).filter(Boolean).length, 0);

/** Rough reading time: about 150 words a minute for a learner, never under a minute */
export function readingMinutes(text: LibraryText): number {
  return Math.max(1, Math.round(wordCount(text) / 150));
}

/** The topics used across the library, most common first */
export function topicsOf(texts: LibraryText[] = LIBRARY): string[] {
  const counts = new Map<string, number>();
  for (const t of texts) counts.set(t.topic, (counts.get(t.topic) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([topic]) => topic);
}

/** Simple string hash, for a stable per-reader shuffle */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The order to show a question's options in for one reader: shuffled, but the same every time they open
 * the text. `order[i]` is the index in the bank (0 = the right answer) of the option shown at position i.
 */
export function optionOrder(seed: string, count = 4): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  let state = hash(seed) || 1;
  for (let i = count - 1; i > 0; i--) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const j = state % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * How a question's options are laid out for one reader. `order[i]` is the bank index of the option shown at
 * position i; `correctIndex` is the shown position of the right answer.
 */
export function layoutFor(userId: string, textId: string, question: Question): { order: number[]; correctIndex: number } {
  if (question.fixed) {
    return { order: question.options.map((_, i) => i), correctIndex: question.correct ?? 0 };
  }
  const order = optionOrder(`${userId}:${textId}:${question.id}`, question.options.length);
  return { order, correctIndex: order.indexOf(0) };
}

export type { LibraryLevel };
