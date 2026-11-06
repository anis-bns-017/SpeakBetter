// server/src/learning/fsrs.ts
//
// FSRS (Free Spaced Repetition Scheduler, version 4.5): the memory model behind modern Anki. Every card keeps
//   stability  S: days until the chance of remembering it falls to 90%
//   difficulty D: 1 (easy for you) to 10 (hard for you)
// and the chance of remembering it right now (retrievability R) follows a forgetting curve from the last review.
// Each answer updates S and D, and the next review is set for when R falls to the learner's target retention.
//
// Pure functions with the published default weights, so every rule can be unit tested.
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

import { RELEARN_MINUTES, sanitizeEase, type Rating } from './srs';

/** FSRS-4.5 default weights (trained on millions of Anki reviews) */
export const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;

const DECAY = -0.5;
/** Chosen so that R = 90% exactly when the days since review equal the stability */
const FACTOR = 19 / 81;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const MAX_INTERVAL_DAYS = 3650;

export const DEFAULT_RETENTION = 0.9;
/** The targets a learner can pick: a higher target means more reviews */
export const RETENTION_OPTIONS = [0.8, 0.85, 0.9, 0.95] as const;
export const isRetention = (value: unknown): value is number => RETENTION_OPTIONS.includes(Number(value) as (typeof RETENTION_OPTIONS)[number]);

const GRADE: Record<Rating, 1 | 2 | 3 | 4> = { again: 1, hard: 2, good: 3, easy: 4 };

export interface Memory {
  stability: number;
  difficulty: number;
}

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

export const initialStability = (rating: Rating): number => W[GRADE[rating] - 1];
export const initialDifficulty = (rating: Rating): number => clampD(W[4] - (GRADE[rating] - 3) * W[5]);

/** Chance of remembering after `days`, for a memory of stability `stability` */
export function retrievability(days: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, days)) / stability, DECAY);
}

/** Days until the chance of remembering falls to `retention` */
export function intervalFor(stability: number, retention = DEFAULT_RETENTION): number {
  return (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

export function nextDifficulty(difficulty: number, rating: Rating): number {
  const moved = difficulty - W[6] * (GRADE[rating] - 3);
  // Mean reversion: pulls slowly back towards the difficulty of a card first answered "good"
  return clampD(W[7] * initialDifficulty('good') + (1 - W[7]) * moved);
}

/** Recalled: stability grows more when the card was harder to recall (low R) and the card is easier (low D) */
export function stabilityAfterRecall(m: Memory, r: number, rating: Exclude<Rating, 'again'>): number {
  const hardPenalty = rating === 'hard' ? W[15] : 1;
  const easyBonus = rating === 'easy' ? W[16] : 1;
  return (
    m.stability *
    (Math.exp(W[8]) * (11 - m.difficulty) * Math.pow(m.stability, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1)
  );
}

/** Forgotten: stability drops, keeping more of it when the memory was strong */
export function stabilityAfterForget(m: Memory, r: number): number {
  const s = W[11] * Math.pow(m.difficulty, -W[12]) * (Math.pow(m.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(s, m.stability);
}

/** What the scheduler needs to know about a card or word */
export interface ReviewState {
  /** null for a new card, or one scheduled before FSRS (then `legacy` describes it) */
  memory: Memory | null;
  lastReviewedAt: Date | null;
  reviewCount: number;
  lapses: number;
  /** Days of the last gap; 0 while the card is being learned */
  interval: number;
}

export interface Scheduled {
  memory: Memory;
  interval: number;
  dueAt: Date;
  reviewCount: number;
  lapses: number;
}

/**
 * A memory estimate for a card scheduled by the old system: its last gap stands in for stability (at a 90%
 * target the gap equals stability), its ease for difficulty. Used once, the first time the card is answered.
 */
export function legacyMemory(old: { interval: number; easeFactor?: number | null; reviewCount: number }): Memory | null {
  if (old.reviewCount <= 0) return null;
  const ease = sanitizeEase(old.easeFactor ?? 2.5);
  return {
    stability: Math.max(0.5, old.interval || 0.5),
    difficulty: clampD(initialDifficulty('good') + (2.5 - ease) * 6),
  };
}

/** The chance (0-1) of remembering the card right now; null for a card never reviewed */
export function recallNow(state: Pick<ReviewState, 'memory' | 'lastReviewedAt'>, now = new Date()): number | null {
  if (!state.memory || !state.lastReviewedAt) return null;
  return retrievability((now.getTime() - state.lastReviewedAt.getTime()) / DAY, state.memory.stability);
}

/**
 * The next schedule for every answer. Gaps are kept in order (hard < good < easy), as Anki does, so the buttons
 * never promise a shorter gap for a better answer.
 */
export function scheduleAll(state: ReviewState, now = new Date(), retention = DEFAULT_RETENTION): Record<Rating, Scheduled> {
  const days = state.lastReviewedAt ? (now.getTime() - state.lastReviewedAt.getTime()) / DAY : 0;
  const m = state.memory;
  const r = m ? retrievability(days, m.stability) : 1;
  const wasLearned = state.reviewCount > 0 && state.interval > 0;

  const memoryFor = (rating: Rating): Memory => {
    if (!m) return { stability: initialStability(rating), difficulty: initialDifficulty(rating) };
    const stability = rating === 'again' ? stabilityAfterForget(m, r) : stabilityAfterRecall(m, r, rating);
    return { stability: round(Math.max(0.1, stability)), difficulty: round(nextDifficulty(m.difficulty, rating)) };
  };

  const gap = (s: number) => Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(intervalFor(s, retention))));
  const mem = { again: memoryFor('again'), hard: memoryFor('hard'), good: memoryFor('good'), easy: memoryFor('easy') };
  let hard = gap(mem.hard.stability);
  let good = gap(mem.good.stability);
  let easy = gap(mem.easy.stability);
  hard = Math.min(hard, good);
  good = Math.max(good, hard + 1);
  easy = Math.max(easy, good + 1);

  const reviewCount = state.reviewCount + 1;
  const passed = (memory: Memory, interval: number): Scheduled => ({
    memory,
    interval,
    dueAt: new Date(now.getTime() + interval * DAY),
    reviewCount,
    lapses: state.lapses,
  });
  return {
    // Forgotten (or not learned yet): back in a few minutes, the same session
    again: {
      memory: mem.again,
      interval: 0,
      dueAt: new Date(now.getTime() + RELEARN_MINUTES * MINUTE),
      reviewCount,
      lapses: state.lapses + (wasLearned ? 1 : 0),
    },
    hard: passed(mem.hard, hard),
    good: passed(mem.good, good),
    easy: passed(mem.easy, easy),
  };
}

export const review = (state: ReviewState, rating: Rating, now = new Date(), retention = DEFAULT_RETENTION): Scheduled =>
  scheduleAll(state, now, retention)[rating];

/** Minutes until the card returns for each answer, to label the buttons ("10m", "3d", ...) */
export function previewAll(state: ReviewState, now = new Date(), retention = DEFAULT_RETENTION): Record<Rating, number> {
  const all = scheduleAll(state, now, retention);
  const minutes = (s: Scheduled) => Math.round((s.dueAt.getTime() - now.getTime()) / MINUTE);
  return { again: minutes(all.again), hard: minutes(all.hard), good: minutes(all.good), easy: minutes(all.easy) };
}
