// server/src/dictionary/dictionary.engine.ts
// Searching the dictionary, the vocabulary size test and the word map. Pure functions over the loaded data.

import { randomInt } from 'node:crypto';
import {
  LEVELS,
  type Dictionary,
  type DictWord,
  type Level,
} from './dictionary.data';

export const PAGE_SIZE = 48;
export const BAND_SIZE = 1000;
/** Real words per 1,000-word band in a size test, and made-up words mixed in */
export const TEST_WORDS_PER_BAND = 5;
export const TEST_NONWORDS = 10;
/** How many of the words you said you know are checked with a meaning question */
export const TEST_CHECKS = 10;
export const TEST_XP = 15;

export type WordStatus = 'new' | 'saved' | 'known';
export type StatusFilter = 'all' | WordStatus;
export type SortKey = 'rank' | 'az';

/** What the learner has done with dictionary words */
export interface Progress {
  known: Set<string>;
  /** Lowercase words in My words (any source) */
  saved: Set<string>;
  /** Lowercase words in My words that are learned (they count as known on the map) */
  learned: Set<string>;
}

export const statusOf = (word: DictWord, progress: Progress): WordStatus => {
  const text = word.w.toLowerCase();
  if (progress.known.has(word.id) || progress.learned.has(text)) return 'known';
  if (progress.saved.has(text)) return 'saved';
  return 'new';
};

export const isLevel = (value: unknown): value is Level =>
  typeof value === 'string' && (LEVELS as readonly string[]).includes(value);

/** The first meaning, for lists */
export const shortMeaning = (word: DictWord): string => word.s[0]?.d ?? '';

export interface ListQuery {
  level?: string;
  topic?: string;
  q?: string;
  status?: string;
  sort?: string;
  page?: number;
  rankFrom?: number;
  rankTo?: number;
}

/**
 * Filters and sorts the dictionary. A search puts words that start with the text first, then words that contain
 * it, then (for 3+ letters) words whose meanings mention it.
 */
export function listWords(
  dict: Dictionary,
  progress: Progress,
  query: ListQuery,
) {
  const q = String(query.q ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 60);
  const level = isLevel(query.level) ? query.level : null;
  const topic =
    typeof query.topic === 'string' && query.topic ? query.topic : null;
  const status: StatusFilter =
    query.status === 'new' ||
    query.status === 'saved' ||
    query.status === 'known'
      ? query.status
      : 'all';
  const sort: SortKey = query.sort === 'az' ? 'az' : 'rank';
  const rankFrom = Number.isFinite(query.rankFrom) ? Number(query.rankFrom) : 1;
  const rankTo = Number.isFinite(query.rankTo)
    ? Number(query.rankTo)
    : Number.MAX_SAFE_INTEGER;

  const scored: Array<{ word: DictWord; score: number }> = [];
  for (const word of dict.words) {
    if (level && word.lv !== level) continue;
    if (topic && !word.t?.includes(topic)) continue;
    if (word.r < rankFrom || word.r > rankTo) continue;
    if (status !== 'all' && statusOf(word, progress) !== status) continue;
    let score = 0;
    if (q) {
      const text = word.w.toLowerCase();
      const alts = (word.alt ?? []).map((a) => a.toLowerCase());
      if (text === q || alts.includes(q)) score = 0;
      else if (text.startsWith(q) || alts.some((a) => a.startsWith(q)))
        score = 1;
      else if (text.includes(q)) score = 2;
      else if (
        q.length >= 3 &&
        word.s.some((s) => s.d.toLowerCase().includes(q))
      )
        score = 3;
      else continue;
    }
    scored.push({ word, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      (sort === 'az' ? a.word.w.localeCompare(b.word.w) : a.word.r - b.word.r),
  );

  const total = scored.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Math.floor(Number(query.page) || 1)),
    pages,
  );
  const items = scored
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .map(({ word }) => ({
      id: word.id,
      word: word.w,
      level: word.lv,
      rank: word.r,
      pos: word.pos,
      ipa: word.ipa?.us ?? word.ipa?.uk ?? null,
      meaning: shortMeaning(word),
      topics: word.t ?? [],
      status: statusOf(word, progress),
    }));
  return { items, total, page, pages };
}

/** "Top 1,000", "Top 5,000" ... how common a word is, in plain words */
export function commonness(rank: number): string {
  if (rank <= 1000) return 'One of the 1,000 most common words';
  if (rank <= 3000) return 'One of the 3,000 most common words';
  if (rank <= 5000) return 'One of the 5,000 most common words';
  if (rank <= CORE_SIZE) return 'One of the 10,000 most common words';
  return 'An advanced word, beyond the 10,000 most common';
}

/** Words the entry mentions (synonyms, opposites, family) that have their own page */
export function linkedWords(
  dict: Dictionary,
  word: DictWord,
): Record<string, string> {
  const links: Record<string, string> = {};
  const mentioned = [
    ...word.s.flatMap((s) => [...(s.syn ?? []), ...(s.ant ?? [])]),
    ...(word.fam ?? []),
  ];
  for (const m of mentioned) {
    const id = dict.byText.get(m.toLowerCase());
    if (id && id !== word.id) links[m.toLowerCase()] = id;
  }
  return links;
}

// ============================================================
// Vocabulary size test
// ============================================================

export const BANDS = 10;
/** The most common words; the size test and its estimate cover these. Words ranked after them are advanced extras. */
export const CORE_SIZE = BANDS * BAND_SIZE;
export const bandOf = (rank: number) => Math.floor((rank - 1) / BAND_SIZE);

export interface TestItem {
  /** Opaque key the app sends back */
  key: string;
  text: string;
  /** null for a made-up word */
  wordId: string | null;
  band: number | null;
}

export interface TestCheck {
  key: string;
  wordId: string;
  options: string[];
  answer: number;
}

export interface StoredTest {
  items: TestItem[];
  /** Keys the learner said they know (after the first step) */
  claimed?: string[];
  checks?: TestCheck[];
}

const shuffle = <T>(
  list: T[],
  rand: (n: number) => number = randomInt,
): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const testable = (w: DictWord) =>
  !w.w.includes(' ') && /^[a-z]+$/i.test(w.w) && w.s.length > 0;

/** 5 real words from each 1,000-word band and 10 made-up words, mixed */
export function buildTest(
  dict: Dictionary,
  rand: (n: number) => number = randomInt,
): TestItem[] {
  const items: TestItem[] = [];
  for (let band = 0; band < BANDS; band++) {
    const pool = dict.words.filter(
      (w) => w.r <= CORE_SIZE && bandOf(w.r) === band && testable(w),
    );
    for (const w of shuffle(pool, rand).slice(0, TEST_WORDS_PER_BAND))
      items.push({ key: '', text: w.w.toLowerCase(), wordId: w.id, band });
  }
  for (const text of shuffle(dict.nonwords, rand).slice(0, TEST_NONWORDS))
    items.push({ key: '', text, wordId: null, band: null });
  return shuffle(items, rand).map((item, i) => ({ ...item, key: `q${i + 1}` }));
}

/** Meaning questions for some of the real words the learner said they know: the right meaning and 3 others */
export function buildChecks(
  dict: Dictionary,
  items: TestItem[],
  claimed: Set<string>,
  rand: (n: number) => number = randomInt,
): TestCheck[] {
  const known = shuffle(
    items.filter((i) => i.wordId && claimed.has(i.key)),
    rand,
  ).slice(0, TEST_CHECKS);
  return known.map((item) => {
    const word = dict.byId.get(item.wordId!)!;
    const right = shortMeaning(word);
    const pos = word.s[0]?.p;
    const others = shuffle(
      dict.words.filter(
        (w) =>
          w.id !== word.id &&
          w.s[0]?.p === pos &&
          Math.abs(w.r - word.r) < 3000 &&
          shortMeaning(w) !== right,
      ),
      rand,
    )
      .slice(0, 3)
      .map(shortMeaning);
    const options = shuffle([right, ...others], rand);
    return {
      key: item.key,
      wordId: word.id,
      options,
      answer: options.indexOf(right),
    };
  });
}

export interface TestResult {
  estimate: number;
  level: Level;
  /** Share of each band known, 0-1 */
  bands: number[];
  falseAlarms: number;
  checked: number;
  checkedRight: number;
  /** Word ids to mark as known */
  knownIds: string[];
}

/** Rough CEFR level for a vocabulary of this size (out of the 10,000 most common words) */
export function levelForSize(size: number): Level {
  if (size < 800) return 'A1';
  if (size < 1600) return 'A2';
  if (size < 3000) return 'B1';
  if (size < 4800) return 'B2';
  if (size < 7000) return 'C1';
  return 'C2';
}

/**
 * Scores a test. Saying yes to made-up words shows guessing, so each band's yes rate is corrected for it
 * ((hits - false alarms) / (1 - false alarms)); wrong answers to the meaning questions lower the estimate too.
 */
export function scoreTest(
  test: StoredTest,
  answers: Record<string, unknown>,
): TestResult {
  const claimed = new Set(test.claimed ?? []);
  const nonwords = test.items.filter((i) => !i.wordId);
  const falseAlarms = nonwords.length
    ? nonwords.filter((i) => claimed.has(i.key)).length / nonwords.length
    : 0;

  const checks = test.checks ?? [];
  const wrong = new Set(
    checks.filter((c) => Number(answers[c.key]) !== c.answer).map((c) => c.key),
  );
  const checkedRight = checks.length - wrong.size;
  // Each wrong meaning lowers trust in the other "yes" answers a little, and so does each made-up word called real
  // (the band correction alone leaves a band where every word got a yes at 100%, guessing or not)
  const trust =
    (checks.length ? 0.5 + 0.5 * (checkedRight / checks.length) : 1) *
    (1 - falseAlarms);

  const bands: number[] = [];
  for (let band = 0; band < BANDS; band++) {
    const real = test.items.filter((i) => i.band === band);
    if (!real.length) {
      bands.push(0);
      continue;
    }
    const hits =
      real.filter((i) => claimed.has(i.key) && !wrong.has(i.key)).length /
      real.length;
    const corrected =
      falseAlarms >= 1
        ? 0
        : Math.max(0, (hits - falseAlarms) / (1 - falseAlarms));
    bands.push(Math.round(Math.min(1, corrected * trust) * 100) / 100);
  }
  const estimate =
    Math.round(bands.reduce((sum, b) => sum + b * BAND_SIZE, 0) / 10) * 10;
  // Words marked as known: said yes and not caught out, unless the answers look like guessing
  const knownIds =
    falseAlarms > 0.3
      ? []
      : test.items
          .filter((i) => i.wordId && claimed.has(i.key) && !wrong.has(i.key))
          .map((i) => i.wordId!);
  return {
    estimate,
    level: levelForSize(estimate),
    bands,
    falseAlarms,
    checked: checks.length,
    checkedRight,
    knownIds,
  };
}

// ============================================================
// Word map
// ============================================================

export const CELL_SIZE = 100;

export interface MapCell {
  from: number;
  to: number;
  known: number;
  saved: number;
}

/**
 * All the words in cells of 100 (most common first), with how many you know and have saved; and the same
 * per 1,000-word band, with the latest test's estimate for the band.
 */
export function wordMap(
  dict: Dictionary,
  progress: Progress,
  testBands: number[] | null,
) {
  const cells: MapCell[] = [];
  for (const word of dict.words) {
    const i = Math.floor((word.r - 1) / CELL_SIZE);
    cells[i] ??= {
      from: i * CELL_SIZE + 1,
      to: Math.min((i + 1) * CELL_SIZE, dict.words.length),
      known: 0,
      saved: 0,
    };
    const status = statusOf(word, progress);
    if (status === 'known') cells[i].known++;
    else if (status === 'saved') cells[i].saved++;
  }
  const bands = Array.from(
    { length: Math.ceil(dict.words.length / BAND_SIZE) },
    (_, b) => {
      const slice = cells.slice(b * 10, b * 10 + 10);
      const total = slice.reduce((n, c) => n + (c.to - c.from + 1), 0);
      return {
        band: b,
        from: b * BAND_SIZE + 1,
        to: b * BAND_SIZE + total,
        known: slice.reduce((n, c) => n + c.known, 0),
        saved: slice.reduce((n, c) => n + c.saved, 0),
        tested: testBands ? (testBands[b] ?? null) : null,
      };
    },
  );
  const levels = LEVELS.map((level) => {
    const words = dict.words.filter((w) => w.lv === level);
    return {
      level,
      total: words.length,
      known: words.filter((w) => statusOf(w, progress) === 'known').length,
    };
  });
  return { cells, bands, levels };
}

/**
 * The next words worth learning: the most common words you have not saved or marked, skipping bands the latest
 * test says you mostly know.
 */
export function nextWords(
  dict: Dictionary,
  progress: Progress,
  testBands: number[] | null,
  count = 20,
): DictWord[] {
  const out: DictWord[] = [];
  for (const word of dict.words) {
    if (out.length >= count) break;
    if (testBands && (testBands[bandOf(word.r)] ?? 0) >= 0.85) continue;
    if (statusOf(word, progress) !== 'new') continue;
    out.push(word);
  }
  return out;
}

/**
 * The dictionary word for a word as it was heard or written: the word itself, another spelling, or a form of it
 * ("went" is "go", "cities" is "city"). Regular endings are tried last.
 */
export function findWord(dict: Dictionary, raw: unknown): DictWord | null {
  const text = String(typeof raw === 'string' ? raw : '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/^[^\p{L}]+|[^\p{L}']+$/gu, '')
    .slice(0, 60);
  if (!text) return null;
  const id = dict.byText.get(text) ?? dict.byForm.get(text);
  if (id) return dict.byId.get(id) ?? null;
  const candidates = [
    text.replace(/'s$/, ''),
    text.replace(/ies$/, 'y'),
    text.replace(/es$/, ''),
    text.replace(/s$/, ''),
    text.replace(/ied$/, 'y'),
    text.replace(/ed$/, ''),
    text.replace(/d$/, ''),
    text.replace(/ing$/, ''),
    text.replace(/ing$/, 'e'),
    text.replace(/(.)\1ing$/, '$1'),
    text.replace(/(.)\1ed$/, '$1'),
    text.replace(/ly$/, ''),
  ];
  for (const c of candidates) {
    if (c === text || c.length < 2) continue;
    const match = dict.byText.get(c);
    if (match) return dict.byId.get(match) ?? null;
  }
  return null;
}
