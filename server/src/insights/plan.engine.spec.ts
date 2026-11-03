import { buildPlan, dayKey, normalizeGoal, planStreak, type PlanSignals } from './plan.engine';

const base: PlanSignals = {
  goalMinutes: 10,
  hasLevel: true,
  dueCards: 20,
  weakPattern: null,
  weakSound: null,
  correctionsGivenThisWeek: 3,
  wordsSavedThisWeek: 10,
};

const total = (tasks: ReturnType<typeof buildPlan>) => tasks.reduce((sum, t) => sum + t.minutes, 0);

describe('buildPlan', () => {
  it('fits a 10-minute day: reviews, the drill and some speaking', () => {
    const tasks = buildPlan(base);
    expect(tasks.map((t) => t.kind)).toEqual(['REVIEW', 'PRONUNCIATION', 'SPEAK']);
    expect(tasks[0]).toMatchObject({ target: 9, unit: 'cards', to: '/flashcards' });
    expect(total(tasks)).toBeGreaterThanOrEqual(8);
    expect(total(tasks)).toBeLessThanOrEqual(12);
  });

  it('puts the level test first when there is no level yet', () => {
    const tasks = buildPlan({ ...base, hasLevel: false });
    expect(tasks[0].kind).toBe('LEVEL');
  });

  it('skips the level test and speaking on a 5-minute day', () => {
    const tasks = buildPlan({ ...base, goalMinutes: 5, hasLevel: false });
    expect(tasks.map((t) => t.kind)).not.toContain('LEVEL');
    expect(tasks.map((t) => t.kind)).not.toContain('SPEAK');
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(total(tasks)).toBeLessThanOrEqual(7);
  });

  it('never asks for more cards than are due', () => {
    expect(buildPlan({ ...base, dueCards: 2 })[0]).toMatchObject({ kind: 'REVIEW', target: 2, title: 'Review 2 cards' });
    expect(buildPlan({ ...base, dueCards: 1 })[0].title).toBe('Review 1 card');
    expect(buildPlan({ ...base, dueCards: 0 }).map((t) => t.kind)).not.toContain('REVIEW');
  });

  it('points the review at the mistake that keeps coming back', () => {
    const review = buildPlan({ ...base, weakPattern: { key: 'ARTICLE', label: 'Articles' } })[0];
    expect(review.to).toBe('/flashcards?pattern=ARTICLE');
    expect(review.detail).toMatch(/articles/);
  });

  it('fills a long day with small tasks, up to five', () => {
    const tasks = buildPlan({ ...base, goalMinutes: 30, correctionsGivenThisWeek: 0, wordsSavedThisWeek: 0 });
    expect(tasks.length).toBeLessThanOrEqual(5);
    expect(tasks.map((t) => t.kind)).toEqual(expect.arrayContaining(['REVIEW', 'PRONUNCIATION', 'SPEAK', 'CORRECTION']));
  });

  it('gives a new learner with nothing due at least two tasks', () => {
    const tasks = buildPlan({ ...base, goalMinutes: 5, dueCards: 0 });
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('treats an unknown goal as 10 minutes', () => {
    expect(normalizeGoal(7)).toBe(10);
    expect(normalizeGoal('20')).toBe(20);
  });
});

describe('planStreak', () => {
  const day = (offset: number) => {
    const d = new Date(2026, 10, 3, 9);
    d.setDate(d.getDate() + offset);
    return dayKey(d);
  };
  const today = new Date(2026, 10, 3, 9);

  it('counts finished days in a row up to today', () => {
    expect(planStreak([day(0), day(-1), day(-2), day(-4)], today)).toBe(3);
  });

  it('keeps yesterday\'s streak alive until today is over', () => {
    expect(planStreak([day(-1), day(-2)], today)).toBe(2);
  });

  it('is zero after a missed day', () => {
    expect(planStreak([day(-2), day(-3)], today)).toBe(0);
    expect(planStreak([], today)).toBe(0);
  });
});
