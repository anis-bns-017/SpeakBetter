// server/src/learning/review.memory.ts
// Turns stored review rows (flashcards and words saved in rooms) into FSRS state and back. Rows scheduled before
// FSRS have no stability yet: their memory is estimated once from the old schedule, the next time they come up.

import { REVIEW_INTERVAL_DAYS } from '../voice/coach/coach.engine';
import { initialDifficulty, legacyMemory, type ReviewState, type Scheduled } from './fsrs';
import type { Rating } from './srs';

const DAY = 24 * 60 * 60 * 1000;

export interface CardRow {
  stability: number | null;
  difficulty: number | null;
  easeFactor: number;
  interval: number;
  reviewCount: number;
  lapses: number;
  lastReviewedAt: Date | null;
}

export interface WordRow {
  stability: number | null;
  difficulty: number | null;
  box: number;
  dueAt: Date;
  reviewCount: number;
  lapses: number;
  interval: number;
  lastReviewedAt: Date | null;
}

export function cardState(row: CardRow): ReviewState {
  const memory =
    row.stability != null && row.difficulty != null
      ? { stability: row.stability, difficulty: row.difficulty }
      : legacyMemory({ interval: row.interval, easeFactor: row.easeFactor, reviewCount: row.reviewCount });
  return { memory, lastReviewedAt: memory ? row.lastReviewedAt : null, reviewCount: row.reviewCount, lapses: row.lapses ?? 0, interval: row.interval ?? 0 };
}

/** Words used boxes (1, 2, 4 ... 32 days); the box's gap stands in for stability, and the review was one gap before due */
export function wordState(row: WordRow): ReviewState {
  if (row.stability != null && row.difficulty != null) {
    return {
      memory: { stability: row.stability, difficulty: row.difficulty },
      lastReviewedAt: row.lastReviewedAt,
      reviewCount: row.reviewCount,
      lapses: row.lapses ?? 0,
      interval: row.interval ?? 0,
    };
  }
  if (!(row.reviewCount > 0)) return { memory: null, lastReviewedAt: null, reviewCount: 0, lapses: row.lapses ?? 0, interval: 0 };
  const gap = REVIEW_INTERVAL_DAYS[Math.min(Math.max(row.box, 0), REVIEW_INTERVAL_DAYS.length - 1)];
  return {
    memory: { stability: row.box > 0 ? gap : 0.5, difficulty: initialDifficulty('good') },
    lastReviewedAt: row.lastReviewedAt ?? new Date(row.dueAt.getTime() - gap * DAY),
    reviewCount: row.reviewCount,
    lapses: row.lapses ?? 0,
    interval: row.box > 0 ? gap : 0,
  };
}

export const cardUpdate = (next: Scheduled, now: Date) => ({
  stability: next.memory.stability,
  difficulty: next.memory.difficulty,
  interval: next.interval,
  reviewCount: next.reviewCount,
  lapses: next.lapses,
  lastReviewedAt: now,
  dueAt: next.dueAt,
});

/** Keeps the old box roughly in step, for anything that still reads it */
export const wordUpdate = (next: Scheduled, now: Date, rating: Rating, box: number) => ({
  ...cardUpdate(next, now),
  box: rating === 'again' ? 0 : Math.min(Math.max(box, 0) + 1, REVIEW_INTERVAL_DAYS.length - 1),
});
