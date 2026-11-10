// server/src/words/words.engine.ts
// "My words": every word you saved in one list. Words come from word packs (and the word of the day, which is a
// pack word), from voice rooms, or you add them yourself. Packs and your own words are word flashcards; words
// from rooms have their own table. Both are scheduled by FSRS, so each one has a recall chance and a stage.

import { recallNow, type ReviewState } from '../learning/fsrs';
import {
  cardState,
  wordState,
  type CardRow,
  type WordRow,
} from '../learning/review.memory';
import { PACKS } from '../vocab-packs/packs.content';

export type WordSource = 'pack' | 'room' | 'mine' | 'dict' | 'library';
export type WordStage = 'new' | 'learning' | 'learned';
export type BankItemType = 'card' | 'word';

export const WORD_SOURCES: readonly WordSource[] = [
  'pack',
  'dict',
  'library',
  'room',
  'mine',
];
export const WORD_STAGES: readonly WordStage[] = ['new', 'learning', 'learned'];

export const MAX_WORD = 60;
export const MAX_WORD_PARTS = 6;
export const MAX_MEANING = 300;
export const MAX_EXAMPLE = 300;
/** The most words one list returns (from each table) */
export const MAX_LIST = 2000;

const DAY = 24 * 60 * 60 * 1000;

export interface BankItem {
  /** Unique across both tables: "card:<id>" or "word:<id>" */
  key: string;
  type: BankItemType;
  id: string;
  word: string;
  meaning: string | null;
  example: string | null;
  source: WordSource;
  /** "Daily life pack", "Heard in Coffee chat", "Added by you" */
  sourceLabel: string;
  addedAt: Date;
  stage: WordStage;
  /** Chance (0-100) you'd remember it right now; null until it has been reviewed */
  recall: number | null;
  dueAt: Date;
  due: boolean;
  reviews: number;
  lapses: number;
}

export interface BankSummary {
  total: number;
  due: number;
  thisWeek: number;
  /** Average recall of the words you have reviewed, 0-100 */
  averageRecall: number | null;
  bySource: Record<WordSource, number>;
  byStage: Record<WordStage, number>;
}

const PACK_TITLES = new Map(PACKS.map((p) => [p.id, p.title]));

/** Only text (or a number) is accepted from a request; anything else counts as empty */
const asText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : '';

export const cleanText = (value: unknown, max: number): string =>
  asText(value).replace(/\s+/g, ' ').trim().slice(0, max);

/** How two saved words are compared: case and spacing do not matter */
export const normalWord = (word: string): string =>
  cleanText(word, MAX_WORD).toLowerCase();

/** Same stages as the Memory tab: never reviewed, still being learned (short gaps), learned */
export function stageOf(
  state: Pick<ReviewState, 'reviewCount' | 'interval'>,
): WordStage {
  if (!(state.reviewCount > 0)) return 'new';
  return state.interval > 0 ? 'learned' : 'learning';
}

/** Where a word flashcard came from. Pack ids are "<packId>:<wordId>". */
export function cardSource(
  source: string | null,
  sourceId: string | null,
): { source: WordSource; label: string } {
  if (source === 'pack') {
    const title = PACK_TITLES.get((sourceId ?? '').split(':')[0]);
    return { source: 'pack', label: title ? `${title} pack` : 'Word pack' };
  }
  if (source === 'dict') return { source: 'dict', label: 'Dictionary' };
  if (source === 'library') return { source: 'library', label: 'Library' };
  return { source: 'mine', label: 'Added by you' };
}

const percent = (state: ReviewState, now: Date): number | null => {
  const r = recallNow(state, now);
  return r === null ? null : Math.round(r * 100);
};

export interface CardWithReview {
  id: string;
  front: string;
  back: string;
  note: string | null;
  source: string | null;
  sourceId: string | null;
  createdAt: Date;
  reviews: Array<CardRow & { dueAt: Date }>;
}

export interface SavedWordRow extends WordRow {
  id: string;
  word: string;
  meaning: string | null;
  sentence: string | null;
  roomName: string | null;
  createdAt: Date;
}

/** A word flashcard. One with no review row yet counts as new and due now, as the review queue treats it. */
export function fromCard(card: CardWithReview, now: Date): BankItem {
  const row = card.reviews[0];
  const state: ReviewState = row
    ? cardState(row)
    : {
        memory: null,
        lastReviewedAt: null,
        reviewCount: 0,
        lapses: 0,
        interval: 0,
      };
  const dueAt = row?.dueAt ?? card.createdAt;
  const { source, label } = cardSource(card.source, card.sourceId);
  return {
    key: `card:${card.id}`,
    type: 'card',
    id: card.id,
    word: card.front,
    meaning: card.back || null,
    example: card.note,
    source,
    sourceLabel: label,
    addedAt: card.createdAt,
    stage: stageOf(state),
    recall: percent(state, now),
    dueAt,
    due: dueAt.getTime() <= now.getTime(),
    reviews: state.reviewCount,
    lapses: state.lapses,
  };
}

/** A word saved in a voice room */
export function fromSavedWord(word: SavedWordRow, now: Date): BankItem {
  const state = wordState(word);
  return {
    key: `word:${word.id}`,
    type: 'word',
    id: word.id,
    word: word.word,
    meaning: word.meaning || null,
    example: word.sentence,
    source: 'room',
    sourceLabel: word.roomName
      ? `Heard in ${word.roomName}`
      : 'Heard in a room',
    addedAt: word.createdAt,
    stage: stageOf(state),
    recall: percent(state, now),
    dueAt: word.dueAt,
    due: word.dueAt.getTime() <= now.getTime(),
    reviews: state.reviewCount,
    lapses: state.lapses,
  };
}

export function summarize(items: BankItem[], now: Date): BankSummary {
  const weekAgo = now.getTime() - 7 * DAY;
  const bySource: Record<WordSource, number> = {
    pack: 0,
    dict: 0,
    library: 0,
    room: 0,
    mine: 0,
  };
  const byStage: Record<WordStage, number> = {
    new: 0,
    learning: 0,
    learned: 0,
  };
  const recalls: number[] = [];
  let due = 0;
  let thisWeek = 0;
  for (const item of items) {
    bySource[item.source]++;
    byStage[item.stage]++;
    if (item.due) due++;
    if (item.addedAt.getTime() >= weekAgo) thisWeek++;
    if (item.recall !== null) recalls.push(item.recall);
  }
  const averageRecall = recalls.length
    ? Math.round(recalls.reduce((a, b) => a + b, 0) / recalls.length)
    : null;
  return {
    total: items.length,
    due,
    thisWeek,
    averageRecall,
    bySource,
    byStage,
  };
}

export type NewWordResult =
  | { ok: true; word: string; meaning: string; example: string | null }
  | { ok: false; error: string };

/** Checks a word you add yourself: a word or short phrase, a meaning, and an optional example */
export function validateNewWord(
  input:
    { word?: unknown; meaning?: unknown; example?: unknown } | null | undefined,
): NewWordResult {
  const rawWord = asText(input?.word).replace(/\s+/g, ' ').trim();
  const word = rawWord.replace(/^["'“”‘’]+|["'“”‘’.,!?;:]+$/g, '').trim();
  if (!word) return { ok: false, error: 'Type the word you want to keep' };
  if (word.length > MAX_WORD)
    return { ok: false, error: `Keep it under ${MAX_WORD} characters` };
  if (!/\p{L}/u.test(word))
    return { ok: false, error: 'A word needs at least one letter' };
  if (word.split(' ').length > MAX_WORD_PARTS)
    return {
      ok: false,
      error: `Save a word or short phrase (up to ${MAX_WORD_PARTS} words)`,
    };
  const meaning = validateMeaning(input?.meaning);
  if (!meaning.ok) return meaning;
  const example = cleanText(input?.example, MAX_EXAMPLE + 1);
  if (example.length > MAX_EXAMPLE)
    return {
      ok: false,
      error: `Keep the example under ${MAX_EXAMPLE} characters`,
    };
  return { ok: true, word, meaning: meaning.value, example: example || null };
}

export function validateMeaning(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const meaning = cleanText(value, MAX_MEANING + 1);
  if (!meaning)
    return { ok: false, error: 'Add what it means, in any language' };
  if (meaning.length > MAX_MEANING)
    return {
      ok: false,
      error: `Keep the meaning under ${MAX_MEANING} characters`,
    };
  return { ok: true, value: meaning };
}

export const isItemType = (value: unknown): value is BankItemType =>
  value === 'card' || value === 'word';
