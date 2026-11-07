// server/src/dictionary/dictionary.data.ts
// The 10,000-word dictionary, built by scripts/build-dictionary.py into data/dictionary.json.gz and loaded once.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

export interface DictSense {
  /** Part of speech */
  p: string;
  /** Definition */
  d: string;
  /** Example phrases */
  x?: string[];
  syn?: string[];
  ant?: string[];
}

export interface DictWord {
  id: string;
  w: string;
  lv: Level;
  /** The level is estimated from how common the word is (it is not on the CEFR lists) */
  est?: boolean;
  /** Rank by how common it is: 1 is the most common */
  r: number;
  pos: string[];
  ipa?: { us?: string; uk?: string };
  s: DictSense[];
  /** Word forms: third, past, pastParticiple, ing, plural, comparative, superlative */
  f?: Record<string, string>;
  /** Word family (related words) */
  fam?: string[];
  /** Topics */
  t?: string[];
  /** Other spellings (behaviour) */
  alt?: string[];
  /** Real example sentences: [text, Tatoeba sentence id] */
  ex?: Array<[string, number]>;
}

export interface DictSource {
  name: string;
  by: string;
  url: string;
  license?: string;
  use: string;
}

export interface DictionaryData {
  version: number;
  count: number;
  words: DictWord[];
  /** Made-up words for the size test */
  nonwords: string[];
  sources: DictSource[];
}

export interface Dictionary extends DictionaryData {
  byId: Map<string, DictWord>;
  /** Lowercase word or other spelling -> word id */
  byText: Map<string, string>;
  /** Word forms ("went", "children", "happier") -> word id, for words heard or read in a sentence */
  byForm: Map<string, string>;
  topics: Array<{ name: string; count: number }>;
  levelCounts: Record<Level, number>;
}

export const DICTIONARY_FILE = join(
  process.cwd(),
  'data',
  'dictionary.json.gz',
);

export function indexDictionary(data: DictionaryData): Dictionary {
  const words = [...data.words].sort((a, b) => a.r - b.r);
  const byId = new Map(words.map((w) => [w.id, w]));
  const byText = new Map<string, string>();
  const byForm = new Map<string, string>();
  const topicCounts = new Map<string, number>();
  const levelCounts = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<
    Level,
    number
  >;
  for (const w of words) {
    if (!byText.has(w.w.toLowerCase())) byText.set(w.w.toLowerCase(), w.id);
    for (const alt of w.alt ?? [])
      if (!byText.has(alt.toLowerCase())) byText.set(alt.toLowerCase(), w.id);
    for (const form of Object.values(w.f ?? {}))
      for (const f of form.split(' / '))
        if (!byForm.has(f.toLowerCase())) byForm.set(f.toLowerCase(), w.id);
    for (const t of w.t ?? [])
      topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
    levelCounts[w.lv]++;
  }
  const topics = [...topicCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return { ...data, words, byId, byText, byForm, topics, levelCounts };
}

let cached: { dict: Dictionary; mtime: number; file: string } | null = null;

/** Loads the dictionary the first time it is needed, and again whenever the data file is rebuilt */
export function getDictionary(file = DICTIONARY_FILE): Dictionary {
  if (!existsSync(file)) {
    throw new Error(
      `Dictionary data not found at ${file}. Run scripts/build-dictionary.py.`,
    );
  }
  const mtime = statSync(file).mtimeMs;
  if (cached && cached.file === file && cached.mtime === mtime)
    return cached.dict;
  const data = JSON.parse(
    gunzipSync(readFileSync(file)).toString('utf8'),
  ) as DictionaryData;
  cached = { dict: indexDictionary(data), mtime, file };
  return cached.dict;
}
