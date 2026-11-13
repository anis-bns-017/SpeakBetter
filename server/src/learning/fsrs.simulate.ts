// server/src/learning/fsrs.simulate.ts
// Simulated learners for testing the memory model: a learner whose memory really follows some FSRS weights
// (faster or slower than the standard ones) reviews cards that the app schedules. Used by tests only.

import { nextMemory, retrievability, review, W, type Memory, type ReviewState, type Weights } from './fsrs';
import type { LogRow } from './fsrs.fit';
import type { Rating } from './srs';

const DAY = 24 * 60 * 60 * 1000;

/** The standard weights with some of them multiplied ({ 2: 0.5 } halves the first stability after "good") */
export const scaled = (changes: Record<number, number>): number[] => W.map((v, i) => (i in changes ? v * changes[i] : v));

/** A small seeded random number generator, so every run simulates the same learners */
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A learner whose memory really works by `truth`, reviewing cards the app schedules with the default weights.
 * `schedule` is what the app schedules with (the standard weights unless given). Cards are added a few a day; each comes back when the app says (sometimes a day or two late), and is
 * remembered with the true chance of remembering. A forgotten card is relearned a few minutes later.
 */
export function simulate(truth: Weights, options: { seed: number; cards: number; days: number; schedule?: Weights }): LogRow[] {
  const rand = random(options.seed);
  const start = new Date('2026-01-01T09:00:00Z').getTime();
  const rows: LogRow[] = [];
  const end = start + options.days * DAY;

  for (let c = 0; c < options.cards; c++) {
    const id = `c${c}`;
    let now = start + Math.floor((c / options.cards) * (options.days / 2)) * DAY + rand() * 3_600_000;
    let app: ReviewState = { memory: null, lastReviewedAt: null, reviewCount: 0, lapses: 0, interval: 0 };
    let real: Memory | null = null;
    let lastAt: number | null = null;

    while (now < end) {
      const days = lastAt === null ? 0 : (now - lastAt) / DAY;
      const r = real ? retrievability(days, real.stability) : 1;
      let rating: Rating;
      if (!real) {
        const x = rand();
        rating = x < 0.25 ? 'again' : x < 0.3 ? 'hard' : x < 0.95 ? 'good' : 'easy';
      } else if (rand() < r) {
        const x = rand();
        rating = x < 0.1 ? 'hard' : x < 0.95 ? 'good' : 'easy';
      } else {
        rating = 'again';
      }
      rows.push({ itemType: 'card', itemId: id, rating, reviewedAt: new Date(now), elapsedDays: lastAt === null ? null : days });

      real = nextMemory(real, r, rating, truth);
      const next = review(app, rating, new Date(now), 0.9, options.schedule ?? W);
      app = { memory: next.memory, lastReviewedAt: new Date(now), reviewCount: next.reviewCount, lapses: next.lapses, interval: next.interval };
      lastAt = now;
      // Learners do not always come back on the day
      const late = rating === 'again' ? 0 : Math.floor(rand() * 3) * DAY * (rand() < 0.4 ? 1 : 0);
      now = next.dueAt.getTime() + late;
    }
  }
  return rows;
}
