// server/src/learning/srs.ts
// Spaced repetition for flashcards: how long until a card comes back, given how well you knew it.
// Pure functions (SM-2 style with four answers), so every rule can be unit-tested.

export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type Rating = (typeof RATINGS)[number];

export const isRating = (value: unknown): value is Rating =>
  typeof value === 'string' && (RATINGS as readonly string[]).includes(value);

export interface CardState {
  /** How fast the gaps grow: higher means you remember this card easily */
  easeFactor: number;
  /** Days until the next review; 0 means the card is still being learned (comes back in minutes) */
  interval: number;
  reviewCount: number;
  /** Times it was forgotten after being learned */
  lapses: number;
}

export interface ScheduledCard extends CardState {
  dueAt: Date;
}

export const NEW_CARD: CardState = { easeFactor: 2.5, interval: 0, reviewCount: 0, lapses: 0 };

/** A forgotten card comes back after this many minutes */
export const RELEARN_MINUTES = 10;
const MIN_EASE = 1.3;
const MAX_EASE = 3;
const DEFAULT_EASE = 2.5;
const MAX_INTERVAL_DAYS = 365;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** First gaps for a card that is new or being learned again */
const FIRST_INTERVAL_DAYS: Record<Exclude<Rating, 'again'>, number> = { hard: 1, good: 2, easy: 4 };

/**
 * Older reviews stored the answer (0, 2 or 4) in the ease column, so clamp anything odd
 * back to a sensible value instead of letting it distort the schedule.
 */
export const sanitizeEase = (ease: number): number =>
  !Number.isFinite(ease) || ease < MIN_EASE ? DEFAULT_EASE : Math.min(ease, MAX_EASE);

export function schedule(state: CardState, rating: Rating, now: Date = new Date()): ScheduledCard {
  const ease = sanitizeEase(state.easeFactor);
  const learning = state.interval <= 0;
  const reviewCount = state.reviewCount + 1;

  if (rating === 'again') {
    // Forgetting something you had learned costs ease; a card still being learned just repeats
    return {
      easeFactor: learning ? ease : Math.max(MIN_EASE, round2(ease - 0.2)),
      interval: 0,
      reviewCount,
      lapses: state.lapses + (learning ? 0 : 1),
      dueAt: new Date(now.getTime() + RELEARN_MINUTES * MINUTE),
    };
  }

  let interval: number;
  let easeFactor = ease;
  if (learning) {
    interval = FIRST_INTERVAL_DAYS[rating];
  } else if (rating === 'hard') {
    easeFactor = Math.max(MIN_EASE, round2(ease - 0.15));
    interval = Math.max(state.interval + 1, Math.round(state.interval * 1.2));
  } else if (rating === 'good') {
    interval = Math.max(state.interval + 1, Math.round(state.interval * ease));
  } else {
    easeFactor = Math.min(MAX_EASE, round2(ease + 0.15));
    interval = Math.max(state.interval + 2, Math.round(state.interval * ease * 1.3));
  }
  interval = Math.min(MAX_INTERVAL_DAYS, interval);

  return {
    easeFactor,
    interval,
    reviewCount,
    lapses: state.lapses,
    dueAt: new Date(now.getTime() + interval * DAY),
  };
}

/** Minutes until the card returns for each answer, to label the buttons ("10m", "1d", ...) */
export function previewMinutes(state: CardState): Record<Rating, number> {
  const out = {} as Record<Rating, number>;
  const now = new Date(0);
  for (const rating of RATINGS) out[rating] = Math.round(schedule(state, rating, now).dueAt.getTime() / MINUTE);
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
