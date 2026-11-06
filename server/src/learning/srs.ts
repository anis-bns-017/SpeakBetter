// server/src/learning/srs.ts
// The four answers a learner gives when reviewing, and the defaults new review rows start with.
// Scheduling itself is FSRS (fsrs.ts); the ease value below only matters for cards scheduled before FSRS, whose
// memory is estimated from it once (legacyMemory).

export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type Rating = (typeof RATINGS)[number];

export const isRating = (value: unknown): value is Rating =>
  typeof value === 'string' && (RATINGS as readonly string[]).includes(value);

/** What a new review row starts with (the ease column predates FSRS and is kept for old rows) */
export const NEW_CARD = { easeFactor: 2.5, interval: 0, reviewCount: 0, lapses: 0 } as const;

/** A forgotten card comes back after this many minutes */
export const RELEARN_MINUTES = 10;

const MIN_EASE = 1.3;
const MAX_EASE = 3;
const DEFAULT_EASE = 2.5;

/**
 * Older reviews stored the answer (0, 2 or 4) in the ease column, so clamp anything odd back to a sensible
 * value before it is used to estimate a card's difficulty.
 */
export const sanitizeEase = (ease: number): number =>
  !Number.isFinite(ease) || ease < MIN_EASE ? DEFAULT_EASE : Math.min(ease, MAX_EASE);
