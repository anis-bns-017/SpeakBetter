// server/src/learning/fsrs.ts
//
// FSRS (Free Spaced Repetition Scheduler, version 4.5): the memory model behind modern Anki. Every card keeps
//   stability  S: days until the chance of remembering it falls to 90%
//   difficulty D: 1 (easy for you) to 10 (hard for you)
// and the chance of remembering it right now (retrievability R) follows a forgetting curve from the last review.
// Each answer updates S and D, and the next review is set for when R falls to the learner's target retention.
//
// Pure functions with the published default weights, so every rule can be unit tested. Every function also takes
// a learner's own weights (fitted from their review history by fsrs.fit.ts); without them the defaults apply.
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

import { RELEARN_MINUTES, sanitizeEase, type Rating } from './srs';

/** FSRS-4.5 default weights (trained on millions of Anki reviews) */
export const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;

/** A full set of 17 weights */
export type Weights = readonly number[];
export const WEIGHT_COUNT = W.length;

/** Weights that are a usable set (the right length, all finite numbers), or the defaults */
export const weightsOrDefault = (value: unknown): Weights =>
  Array.isArray(value) && value.length === WEIGHT_COUNT && value.every((n) => typeof n === 'number' && Number.isFinite(n)) ? value : W;

// Read once: inside some sandboxes (Jest) every lookup of Math is slow, and fitting calls these millions of times
const { exp, max, min, pow } = Math;
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

const clampD = (d: number) => min(10, max(1, d));
const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

export const initialStability = (rating: Rating, w: Weights = W): number => w[GRADE[rating] - 1];
export const initialDifficulty = (rating: Rating, w: Weights = W): number => clampD(w[4] - (GRADE[rating] - 3) * w[5]);

/** Chance of remembering after `days`, for a memory of stability `stability` */
export function retrievability(days: number, stability: number): number {
  if (stability <= 0) return 0;
  return pow(1 + (FACTOR * max(0, days)) / stability, DECAY);
}

/** Days until the chance of remembering falls to `retention` */
export function intervalFor(stability: number, retention = DEFAULT_RETENTION): number {
  return (stability / FACTOR) * (pow(retention, 1 / DECAY) - 1);
}

export function nextDifficulty(difficulty: number, rating: Rating, w: Weights = W): number {
  const moved = difficulty - w[6] * (GRADE[rating] - 3);
  // Mean reversion: pulls slowly back towards the difficulty of a card first answered "good"
  return clampD(w[7] * initialDifficulty('good', w) + (1 - w[7]) * moved);
}

/** Recalled: stability grows more when the card was harder to recall (low R) and the card is easier (low D) */
export function stabilityAfterRecall(m: Memory, r: number, rating: Exclude<Rating, 'again'>, w: Weights = W): number {
  const hardPenalty = rating === 'hard' ? w[15] : 1;
  const easyBonus = rating === 'easy' ? w[16] : 1;
  return (
    m.stability *
    (exp(w[8]) * (11 - m.difficulty) * pow(m.stability, -w[9]) * (exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1)
  );
}

/** Forgotten: stability drops, keeping more of it when the memory was strong */
export function stabilityAfterForget(m: Memory, r: number, w: Weights = W): number {
  const s = w[11] * pow(m.difficulty, -w[12]) * (pow(m.stability + 1, w[13]) - 1) * exp(w[14] * (1 - r));
  return min(s, m.stability);
}

/**
 * The memory after an answer, before rounding. `m` is null for a card answered for the first time; `r` is the
 * chance of remembering at the moment of the answer. The scheduler and the weight fitting both use this, so
 * the fitting replays exactly what the scheduler did.
 */
export function nextMemory(m: Memory | null, r: number, rating: Rating, w: Weights = W): Memory {
  if (!m) return { stability: initialStability(rating, w), difficulty: initialDifficulty(rating, w) };
  const stability = rating === 'again' ? stabilityAfterForget(m, r, w) : stabilityAfterRecall(m, r, rating, w);
  return { stability: max(0.1, stability), difficulty: nextDifficulty(m.difficulty, rating, w) };
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
    stability: max(0.5, old.interval || 0.5),
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
export function scheduleAll(
  state: ReviewState,
  now = new Date(),
  retention = DEFAULT_RETENTION,
  w: Weights = W,
): Record<Rating, Scheduled> {
  const days = state.lastReviewedAt ? (now.getTime() - state.lastReviewedAt.getTime()) / DAY : 0;
  const m = state.memory;
  const r = m ? retrievability(days, m.stability) : 1;
  const wasLearned = state.reviewCount > 0 && state.interval > 0;

  const memoryFor = (rating: Rating): Memory => {
    const next = nextMemory(m, r, rating, w);
    return m ? { stability: round(next.stability), difficulty: round(next.difficulty) } : next;
  };

  const gap = (s: number) => min(MAX_INTERVAL_DAYS, max(1, Math.round(intervalFor(s, retention))));
  const mem = { again: memoryFor('again'), hard: memoryFor('hard'), good: memoryFor('good'), easy: memoryFor('easy') };
  let hard = gap(mem.hard.stability);
  let good = gap(mem.good.stability);
  let easy = gap(mem.easy.stability);
  hard = min(hard, good);
  good = max(good, hard + 1);
  easy = max(easy, good + 1);

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

export const review = (state: ReviewState, rating: Rating, now = new Date(), retention = DEFAULT_RETENTION, w: Weights = W): Scheduled =>
  scheduleAll(state, now, retention, w)[rating];

/** Minutes until the card returns for each answer, to label the buttons ("10m", "3d", ...) */
export function previewAll(state: ReviewState, now = new Date(), retention = DEFAULT_RETENTION, w: Weights = W): Record<Rating, number> {
  const all = scheduleAll(state, now, retention, w);
  const minutes = (s: Scheduled) => Math.round((s.dueAt.getTime() - now.getTime()) / MINUTE);
  return { again: minutes(all.again), hard: minutes(all.hard), good: minutes(all.good), easy: minutes(all.easy) };
}
