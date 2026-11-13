// server/src/learning/fsrs.fit.ts
//
// Fits the 17 FSRS weights to one learner's own review history, so the schedule follows how fast *they* forget.
// It replays every card's reviews with candidate weights (exactly as the scheduler would have run them), scores
// how well the predicted chance of remembering matched what really happened (log loss), and moves the weights
// to lower that score. A pull towards the default weights keeps a small history from going to extremes, and the
// result is only used when it predicts better than the defaults on cards it was not fitted on.
//
// Pure functions (plus a pause now and then, so a long fit does not hold up the server).

import { nextMemory, retrievability, W, WEIGHT_COUNT, type Memory, type Weights } from './fsrs';
import type { Rating } from './srs';

// Read once: inside some sandboxes (Jest) every lookup of Math is slow, and fitting calls these millions of times
const { ceil, exp, floor, log, max, min, sqrt } = Math;
const DAY = 24 * 60 * 60 * 1000;

/** Reviews that came back after at least a day: the ones that say something about long-term memory */
export const MIN_LESSONS = 300;
/** Refit once this many more reviews have been logged */
export const REFIT_EVERY = 100;

/**
 * The range each weight may take (close to the reference FSRS optimizer's limits). Fitting works in units of
 * these ranges, so every weight moves at a comparable pace.
 */
export const BOUNDS: ReadonlyArray<readonly [number, number]> = [
  [0.1, 100], [0.1, 100], [0.1, 100], [0.1, 100], // first stability after again / hard / good / easy
  [1, 10], [0.1, 5], // first difficulty
  [0.1, 5], [0, 0.75], // how difficulty moves
  [0, 4.5], [0, 0.8], [0.01, 3.5], // growth after a recall
  [0.1, 5], [0.01, 0.25], [0.01, 0.9], [0.01, 4], // stability after forgetting
  [0, 1], [1, 6], // hard penalty, easy bonus
];

export interface LogRow {
  itemType: string;
  itemId: string;
  rating: string;
  reviewedAt: Date;
  /** null on a card's first review under FSRS */
  elapsedDays: number | null;
}

/** One card's answers in order: the rating and when (ms) */
export type History = Array<{ rating: Rating; at: number }>;

const RATINGS = new Set<string>(['again', 'hard', 'good', 'easy']);

/**
 * Groups the log into one history per card. Only cards whose whole life is in the log can be replayed: one that
 * was scheduled before FSRS (its first logged review already had a gap) started from an estimate, so it is left
 * out. A card answered once says nothing yet.
 */
export function buildHistories(rows: readonly LogRow[]): History[] {
  const byItem = new Map<string, LogRow[]>();
  for (const row of rows) {
    if (!RATINGS.has(row.rating)) continue;
    const key = `${row.itemType}:${row.itemId}`;
    const list = byItem.get(key);
    if (list) list.push(row);
    else byItem.set(key, [row]);
  }
  const histories: History[] = [];
  for (const list of byItem.values()) {
    list.sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime());
    if (list[0].elapsedDays !== null || list.length < 2) continue;
    histories.push(list.map((r) => ({ rating: r.rating as Rating, at: r.reviewedAt.getTime() })));
  }
  return histories;
}

/** How many reviews in these histories came back after a day or more */
export function countLessons(histories: readonly History[]): number {
  let n = 0;
  for (const h of histories) for (let i = 1; i < h.length; i++) if (h[i].at - h[i - 1].at >= DAY) n++;
  return n;
}

const EPS = 1e-4;

/** Every prediction made for a review a day or more after the last one: [predicted chance, remembered] */
function predictions(histories: readonly History[], w: Weights, visit: (p: number, remembered: boolean) => void) {
  for (const h of histories) {
    let m: Memory = nextMemory(null, 1, h[0].rating, w);
    let last = h[0].at;
    for (let i = 1; i < h.length; i++) {
      const { rating, at } = h[i];
      const days = (at - last) / DAY;
      const r = retrievability(days, m.stability);
      if (days >= 1) visit(r, rating !== 'again');
      m = nextMemory(m, r, rating, w);
      last = at;
    }
  }
}

/** Average log loss of the predictions (lower is better), and how many there were */
export function logLoss(histories: readonly History[], w: Weights): { loss: number; n: number } {
  let sum = 0;
  let n = 0;
  predictions(histories, w, (p, remembered) => {
    const q = min(1 - EPS, max(EPS, p));
    sum -= remembered ? log(q) : log(1 - q);
    n++;
  });
  return { loss: n ? sum / n : 0, n };
}

/**
 * How far the predictions are from what happened, as a share (0.05 = off by 5 points): the predictions are put
 * in ten bins by the chance predicted, and each bin's average prediction is compared with how many were really
 * remembered, weighted by its size. The same measure ("RMSE (bins)") the FSRS project reports.
 */
export function calibrationError(histories: readonly History[], w: Weights): number {
  const bins = Array.from({ length: 10 }, () => ({ n: 0, predicted: 0, remembered: 0 }));
  predictions(histories, w, (p, remembered) => {
    const bin = bins[min(9, floor(p * 10))];
    bin.n++;
    bin.predicted += p;
    bin.remembered += remembered ? 1 : 0;
  });
  let total = 0;
  let sum = 0;
  for (const b of bins) {
    if (!b.n) continue;
    total += b.n;
    sum += b.n * ((b.predicted - b.remembered) / b.n) ** 2;
  }
  return total ? sqrt(sum / total) : 0;
}

// ---------- fitting ----------

/**
 * Fitting works in units of each weight's range, so every weight moves at a comparable pace. The first four
 * (stabilities from 0.1 to 100 days) are measured on a log scale, where a step is a share of the value rather
 * than a fixed number of days.
 */
const LOG_SCALE = 4;
const toUnit = (w: Weights) =>
  w.map((v, i) => {
    const [lo, hi] = BOUNDS[i];
    return i < LOG_SCALE ? (log(max(v, lo)) - log(lo)) / (log(hi) - log(lo)) : (v - lo) / (hi - lo);
  });
const fromUnit = (u: readonly number[]) =>
  u.map((raw, i) => {
    const [lo, hi] = BOUNDS[i];
    const v = min(1, max(0, raw));
    return i < LOG_SCALE ? exp(log(lo) + v * (log(hi) - log(lo))) : lo + v * (hi - lo);
  });
const DEFAULT_UNIT = toUnit(W);

export interface FitOptions {
  iterations?: number;
  /** How strongly the weights are held near the defaults, in reviews' worth of evidence */
  prior?: number;
  /** Starting point (defaults to the default weights) */
  start?: Weights;
  /** Called between steps, so a long fit can give way to other work */
  pause?: () => Promise<void>;
}

/** Log loss plus the pull towards the defaults: what the fitting lowers */
function objective(histories: readonly History[], u: readonly number[], prior: number): number {
  const { loss, n } = logLoss(histories, fromUnit(u));
  if (!n) return 0;
  let penalty = 0;
  for (let i = 0; i < WEIGHT_COUNT; i++) penalty += (u[i] - DEFAULT_UNIT[i]) ** 2;
  return loss + (prior / n) * penalty;
}

/** Lowers the objective with Adam, using gradients from small nudges to each weight */
export async function fitWeights(histories: readonly History[], options: FitOptions = {}): Promise<number[]> {
  const iterations = options.iterations ?? ITERATIONS;
  const prior = options.prior ?? 40;
  const u = toUnit(options.start ?? W).map((v) => min(1, max(0, v)));
  const m = new Array<number>(WEIGHT_COUNT).fill(0);
  const v = new Array<number>(WEIGHT_COUNT).fill(0);
  const rate = 0.01;
  const h = 1e-3;
  const [b1, b2] = [0.9, 0.999];

  for (let step = 1; step <= iterations; step++) {
    for (let i = 0; i < WEIGHT_COUNT; i++) {
      const keep = u[i];
      u[i] = min(1, keep + h);
      const up = objective(histories, u, prior);
      const hi = u[i];
      u[i] = max(0, keep - h);
      const down = objective(histories, u, prior);
      const lo = u[i];
      u[i] = keep;
      const g = hi > lo ? (up - down) / (hi - lo) : 0;
      m[i] = b1 * m[i] + (1 - b1) * g;
      v[i] = b2 * v[i] + (1 - b2) * g * g;
      const mHat = m[i] / (1 - b1 ** step);
      const vHat = v[i] / (1 - b2 ** step);
      u[i] = min(1, max(0, u[i] - (rate * mHat) / (sqrt(vHat) + 1e-8)));
    }
    if (options.pause) await options.pause();
  }
  return fromUnit(u).map((x) => Math.round(x * 10_000) / 10_000);
}

export interface PersonalFit {
  /** Whether the fitted weights should be used: they predicted better on cards held back from the fitting */
  adopted: boolean;
  weights: number[];
  lessons: number;
  /** Prediction error (see calibrationError) with the default weights and with the fitted ones */
  defaultError: number;
  fittedError: number;
  defaultLoss: number;
  fittedLoss: number;
}

const ITERATIONS = 100;
/** The most reviews a fit looks at (the most recent cards): enough to judge, and a few seconds of work at most */
export const MAX_FIT_REVIEWS = 4000;

/** Every fifth card is held back to check the fit on reviews it has not seen */
const HOLDOUT_EVERY = 5;
/** The fitted weights must lower the held-back log loss by at least this share */
const MIN_GAIN = 0.002;

/**
 * Fits one learner's weights. Returns null while there is too little history. The weights are fitted on most
 * cards and checked on the rest; only if they beat the defaults there are they refitted on everything and
 * marked as adopted.
 */
export async function fitLearner(all: readonly History[], options: Omit<FitOptions, 'start'> = {}): Promise<PersonalFit | null> {
  const histories = recent(all, MAX_FIT_REVIEWS);
  const lessons = countLessons(histories);
  if (lessons < MIN_LESSONS) return null;

  const train = histories.filter((_, i) => i % HOLDOUT_EVERY !== 0);
  const held = histories.filter((_, i) => i % HOLDOUT_EVERY === 0);
  const trial = await fitWeights(train, options);
  const before = logLoss(held, W).loss;
  const after = logLoss(held, trial).loss;
  const adopted = countLessons(held) > 0 && after < before * (1 - MIN_GAIN);

  const weights = adopted ? await fitWeights(histories, { ...options, start: trial, iterations: ceil((options.iterations ?? ITERATIONS) / 3) }) : [...W];
  return {
    adopted,
    weights,
    lessons,
    defaultError: round(calibrationError(histories, W)),
    fittedError: round(calibrationError(histories, weights)),
    defaultLoss: round(logLoss(histories, W).loss),
    fittedLoss: round(logLoss(histories, weights).loss),
  };
}

const round = (n: number) => Math.round(n * 10_000) / 10_000;

/** The cards started most recently, up to about `limit` reviews in all, in their original order */
function recent(histories: readonly History[], limit: number): readonly History[] {
  let total = 0;
  for (const h of histories) total += h.length;
  if (total <= limit) return histories;
  const newestFirst = [...histories].sort((a, b) => b[0].at - a[0].at);
  const kept = new Set<History>();
  let count = 0;
  for (const h of newestFirst) {
    if (count + h.length > limit && kept.size) break;
    kept.add(h);
    count += h.length;
  }
  return histories.filter((h) => kept.has(h));
}
