import {
  DEFAULT_RETENTION,
  initialDifficulty,
  initialStability,
  intervalFor,
  isRetention,
  legacyMemory,
  nextDifficulty,
  previewAll,
  recallNow,
  retrievability,
  review,
  scheduleAll,
  stabilityAfterForget,
  stabilityAfterRecall,
  type ReviewState,
} from './fsrs';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-06T10:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);
const NEW: ReviewState = { memory: null, lastReviewedAt: null, reviewCount: 0, lapses: 0, interval: 0 };

describe('FSRS forgetting curve', () => {
  it('is 90% after exactly one stability of days, and falls with time', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 6);
    expect(retrievability(0, 10)).toBe(1);
    expect(retrievability(30, 10)).toBeLessThan(retrievability(20, 10));
  });

  it('sets the gap from the target: 90% means a gap equal to the stability', () => {
    expect(intervalFor(10, 0.9)).toBeCloseTo(10, 6);
    expect(intervalFor(10, 0.95)).toBeLessThan(intervalFor(10, 0.9));
    expect(intervalFor(10, 0.8)).toBeGreaterThan(intervalFor(10, 0.9));
  });

  it('only accepts the retention targets offered', () => {
    expect(isRetention(0.9)).toBe(true);
    expect(isRetention('0.85')).toBe(true);
    expect(isRetention(0.5)).toBe(false);
  });
});

describe('FSRS memory updates', () => {
  it('starts new cards from the default weights', () => {
    expect(initialStability('again')).toBeCloseTo(0.4872);
    expect(initialStability('easy')).toBeCloseTo(13.8206);
    expect(initialDifficulty('good')).toBeCloseTo(5.1618);
    expect(initialDifficulty('again')).toBeGreaterThan(initialDifficulty('easy'));
  });

  it('matches the published formula for a recall', () => {
    // S=10, D=5, reviewed when R=0.9, answered good: 10 * (e^1.6474 * 6 * 10^-0.1367 * (e^0.10461 - 1) + 1)
    expect(stabilityAfterRecall({ stability: 10, difficulty: 5 }, 0.9, 'good')).toBeCloseTo(35.08, 1);
  });

  it('grows stability more when the card was nearly forgotten (the spacing effect)', () => {
    const m = { stability: 10, difficulty: 5 };
    expect(stabilityAfterRecall(m, 0.7, 'good')).toBeGreaterThan(stabilityAfterRecall(m, 0.95, 'good'));
    expect(stabilityAfterRecall(m, 0.9, 'easy')).toBeGreaterThan(stabilityAfterRecall(m, 0.9, 'good'));
    expect(stabilityAfterRecall(m, 0.9, 'hard')).toBeLessThan(stabilityAfterRecall(m, 0.9, 'good'));
  });

  it('drops stability on a lapse, never above what it was', () => {
    const after = stabilityAfterForget({ stability: 30, difficulty: 5 }, 0.8);
    expect(after).toBeLessThan(30);
    expect(after).toBeGreaterThan(0);
  });

  it('moves difficulty up when forgotten and down when easy, within 1-10', () => {
    expect(nextDifficulty(5, 'again')).toBeGreaterThan(5);
    expect(nextDifficulty(5, 'easy')).toBeLessThan(5);
    expect(nextDifficulty(10, 'again')).toBeLessThanOrEqual(10);
    expect(nextDifficulty(1, 'easy')).toBeGreaterThanOrEqual(1);
  });
});

describe('FSRS scheduling', () => {
  it('gives a new card 10 minutes, 1, 4 and 14 days', () => {
    expect(previewAll(NEW, now)).toEqual({ again: 10, hard: 1440, good: 4 * 1440, easy: 14 * 1440 });
  });

  it('keeps the answers in order: hard < good < easy', () => {
    for (const s of [0.3, 1, 2.5, 8, 40, 200]) {
      for (const d of [1, 4, 7, 10]) {
        for (const ago of [0, 1, 5, 30]) {
          const p = previewAll({ memory: { stability: s, difficulty: d }, lastReviewedAt: daysAgo(ago), reviewCount: 3, lapses: 0, interval: 3 }, now);
          expect(p.hard).toBeLessThan(p.good);
          expect(p.good).toBeLessThan(p.easy);
          expect(p.again).toBe(10);
        }
      }
    }
  });

  it('grows the gaps as a card keeps being remembered', () => {
    let state: ReviewState = NEW;
    let when = now;
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      const next = review(state, 'good', when);
      gaps.push(next.interval);
      state = { memory: next.memory, lastReviewedAt: when, reviewCount: next.reviewCount, lapses: next.lapses, interval: next.interval };
      when = next.dueAt;
    }
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    expect(gaps[0]).toBe(4);
  });

  it('counts a lapse only for a card that had been learned', () => {
    expect(review(NEW, 'again', now).lapses).toBe(0);
    const learned: ReviewState = { memory: { stability: 20, difficulty: 5 }, lastReviewedAt: daysAgo(20), reviewCount: 4, lapses: 1, interval: 20 };
    const forgot = review(learned, 'again', now);
    expect(forgot).toMatchObject({ lapses: 2, interval: 0 });
    expect(forgot.memory.stability).toBeLessThan(20);
  });

  it('reviews more often for a higher retention target', () => {
    const state: ReviewState = { memory: { stability: 20, difficulty: 5 }, lastReviewedAt: daysAgo(20), reviewCount: 4, lapses: 0, interval: 20 };
    expect(scheduleAll(state, now, 0.95).good.interval).toBeLessThan(scheduleAll(state, now, DEFAULT_RETENTION).good.interval);
    expect(scheduleAll(state, now, 0.8).good.interval).toBeGreaterThan(scheduleAll(state, now, DEFAULT_RETENTION).good.interval);
  });

  it('tells the chance of remembering a card right now', () => {
    expect(recallNow({ memory: { stability: 10, difficulty: 5 }, lastReviewedAt: daysAgo(10) }, now)).toBeCloseTo(0.9, 6);
    expect(recallNow({ memory: null, lastReviewedAt: null }, now)).toBeNull();
  });
});

describe('moving cards from the old scheduler', () => {
  it('uses the old gap as stability and the ease as difficulty', () => {
    expect(legacyMemory({ interval: 12, easeFactor: 2.5, reviewCount: 3 })).toEqual({ stability: 12, difficulty: initialDifficulty('good') });
    expect(legacyMemory({ interval: 12, easeFactor: 1.3, reviewCount: 3 })!.difficulty).toBeGreaterThan(initialDifficulty('good'));
    expect(legacyMemory({ interval: 12, easeFactor: 3, reviewCount: 3 })!.difficulty).toBeLessThan(initialDifficulty('good'));
    expect(legacyMemory({ interval: 0, easeFactor: 2.5, reviewCount: 2 })!.stability).toBe(0.5);
    expect(legacyMemory({ interval: 0, easeFactor: 2.5, reviewCount: 0 })).toBeNull();
  });
});
