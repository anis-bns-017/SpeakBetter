import { NEW_CARD, RATINGS, RELEARN_MINUTES, isRating, previewMinutes, sanitizeEase, schedule, type CardState } from './srs';

const NOW = new Date('2026-11-02T10:00:00Z');
const days = (d: Date) => Math.round((d.getTime() - NOW.getTime()) / 86_400_000);
const minutes = (d: Date) => Math.round((d.getTime() - NOW.getTime()) / 60_000);

const learned = (interval: number, extra: Partial<CardState> = {}): CardState => ({
  easeFactor: 2.5,
  interval,
  reviewCount: 3,
  lapses: 0,
  ...extra,
});

describe('schedule: a new card', () => {
  it('"again" brings it back in minutes and does not count as a lapse', () => {
    const s = schedule(NEW_CARD, 'again', NOW);
    expect(minutes(s.dueAt)).toBe(RELEARN_MINUTES);
    expect(s).toMatchObject({ interval: 0, lapses: 0, reviewCount: 1, easeFactor: 2.5 });
  });

  it('gives longer first gaps for hard, good and easy', () => {
    expect(days(schedule(NEW_CARD, 'hard', NOW).dueAt)).toBe(1);
    expect(days(schedule(NEW_CARD, 'good', NOW).dueAt)).toBe(2);
    expect(days(schedule(NEW_CARD, 'easy', NOW).dueAt)).toBe(4);
  });
});

describe('schedule: a learned card', () => {
  it('"good" multiplies the gap by the ease', () => {
    expect(schedule(learned(10), 'good', NOW).interval).toBe(25);
  });

  it('"hard" grows the gap a little and lowers the ease', () => {
    const s = schedule(learned(10), 'hard', NOW);
    expect(s.interval).toBe(12);
    expect(s.easeFactor).toBe(2.35);
  });

  it('"easy" grows the gap the most and raises the ease', () => {
    const s = schedule(learned(10), 'easy', NOW);
    expect(s.interval).toBe(33);
    expect(s.easeFactor).toBe(2.65);
  });

  it('"again" is a lapse: back to minutes, lower ease, one more lapse', () => {
    const s = schedule(learned(10), 'again', NOW);
    expect(minutes(s.dueAt)).toBe(RELEARN_MINUTES);
    expect(s).toMatchObject({ interval: 0, lapses: 1, easeFactor: 2.3 });
  });

  it('always moves forward by at least a day, even with a tiny gap', () => {
    expect(schedule(learned(1), 'hard', NOW).interval).toBe(2);
    expect(schedule(learned(1, { easeFactor: 1.3 }), 'good', NOW).interval).toBe(2);
    expect(schedule(learned(1), 'easy', NOW).interval).toBeGreaterThanOrEqual(3);
  });

  it('orders the answers: again < hard < good < easy', () => {
    const due = RATINGS.map((r) => schedule(learned(8), r, NOW).dueAt.getTime());
    expect([...due].sort((a, b) => a - b)).toEqual(due);
    expect(new Set(due).size).toBe(4);
  });

  it('never lets the ease fall below 1.3 or the gap pass a year', () => {
    let s: CardState = learned(5, { easeFactor: 1.4 });
    for (let i = 0; i < 6; i++) s = schedule(s, 'again', NOW);
    expect(s.easeFactor).toBe(1.3);

    expect(schedule(learned(300), 'easy', NOW).interval).toBe(365);
  });

  it('a card forgotten and then remembered starts over from short gaps', () => {
    let s = schedule(learned(30), 'again', NOW);
    expect(s.interval).toBe(0);
    s = schedule(s, 'good', NOW);
    expect(s.interval).toBe(2);
    expect(s.lapses).toBe(1);
  });
});

describe('legacy data', () => {
  it('fixes the odd ease values older reviews stored (0, 2, 4)', () => {
    expect(sanitizeEase(0)).toBe(2.5);
    expect(sanitizeEase(NaN)).toBe(2.5);
    expect(sanitizeEase(2)).toBe(2);
    expect(sanitizeEase(4)).toBe(3);
    expect(schedule(learned(4, { easeFactor: 0 }), 'good', NOW).interval).toBe(10);
  });
});

describe('previewMinutes', () => {
  it('shows when each answer would bring the card back', () => {
    expect(previewMinutes(NEW_CARD)).toEqual({ again: RELEARN_MINUTES, hard: 1440, good: 2880, easy: 5760 });
    const p = previewMinutes(learned(10));
    expect(p.again).toBe(RELEARN_MINUTES);
    expect(p.good).toBe(25 * 1440);
  });
});

describe('isRating', () => {
  it('accepts only the four answers', () => {
    expect(isRating('good')).toBe(true);
    expect(isRating('medium')).toBe(false);
    expect(isRating(undefined)).toBe(false);
  });
});
