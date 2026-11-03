import { PERIOD_DAYS, PLAN_LIMITS, daysLeft, effectivePlan, extendedEnd, limitsFor, yearlySavingsPercent } from './plans';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-03T12:00:00Z');
const pro = (endInDays: number | null, status: any = 'ACTIVE') => ({
  plan: 'PRO' as const,
  status,
  endDate: endInDays === null ? null : new Date(now.getTime() + endInDays * DAY),
});

describe('effectivePlan', () => {
  it('is FREE with no subscription or a free one', () => {
    expect(effectivePlan(null, now)).toBe('FREE');
    expect(effectivePlan({ plan: 'FREE', status: 'ACTIVE', endDate: null }, now)).toBe('FREE');
  });

  it('is Pro while paid up, including a cancelled one that has time left', () => {
    expect(effectivePlan(pro(10), now)).toBe('PRO');
    expect(effectivePlan(pro(10, 'CANCELLED'), now)).toBe('PRO');
  });

  it('drops to FREE when the paid time ran out, or the status says it is over', () => {
    expect(effectivePlan(pro(-1), now)).toBe('FREE');
    expect(effectivePlan(pro(0), now)).toBe('FREE');
    expect(effectivePlan(pro(null), now)).toBe('FREE');
    expect(effectivePlan(pro(10, 'EXPIRED'), now)).toBe('FREE');
    expect(effectivePlan(pro(10, 'PAST_DUE'), now)).toBe('FREE');
  });
});

describe('extendedEnd', () => {
  it('starts from today for a first payment or a lapsed plan', () => {
    expect(extendedEnd(null, 'MONTHLY', now).getTime()).toBe(now.getTime() + PERIOD_DAYS.MONTHLY * DAY);
    expect(extendedEnd(pro(-5), 'YEARLY', now).getTime()).toBe(now.getTime() + PERIOD_DAYS.YEARLY * DAY);
  });

  it('adds to the time left when paying early, so nothing is wasted', () => {
    expect(extendedEnd(pro(10), 'MONTHLY', now).getTime()).toBe(now.getTime() + (10 + PERIOD_DAYS.MONTHLY) * DAY);
  });
});

describe('limits and helpers', () => {
  it('gives Pro more AI turns than FREE', () => {
    expect(limitsFor('PRO').aiTurnsPerDay).toBeGreaterThan(limitsFor('FREE').aiTurnsPerDay);
    expect(limitsFor('FREE')).toEqual(PLAN_LIMITS.FREE);
  });

  it('counts whole days left and never goes negative', () => {
    expect(daysLeft(new Date(now.getTime() + 2.2 * DAY), now)).toBe(3);
    expect(daysLeft(new Date(now.getTime() - DAY), now)).toBe(0);
    expect(daysLeft(null, now)).toBe(0);
  });

  it('shows a real saving for yearly billing', () => {
    expect(yearlySavingsPercent()).toBeGreaterThan(0);
  });
});
