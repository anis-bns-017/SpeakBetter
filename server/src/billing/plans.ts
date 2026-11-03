import { BillingInterval, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

/** The plans a learner can choose from. FREE is the default and needs no payment. */
export type PaidPlan = 'PRO';

export interface PlanLimits {
  /** Every AI partner turn is a paid model call, so the free plan gets a taste and Pro gets room to practise */
  aiTurnsPerDay: number;
}

export const PLAN_LIMITS: Record<'FREE' | PaidPlan, PlanLimits> = {
  FREE: { aiTurnsPerDay: 20 },
  PRO: { aiTurnsPerDay: 150 },
};

/** What Pro costs, in US dollars */
export const PRO_PRICES: Record<BillingInterval, number> = {
  MONTHLY: 4.99,
  YEARLY: 39.99,
};

export const CURRENCY = 'USD';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of access one payment buys */
export const PERIOD_DAYS: Record<BillingInterval, number> = {
  MONTHLY: 30,
  YEARLY: 365,
};

export const priceOf = (interval: BillingInterval) => PRO_PRICES[interval];

export const limitsFor = (plan: SubscriptionPlan): PlanLimits => (plan === 'FREE' ? PLAN_LIMITS.FREE : PLAN_LIMITS.PRO);

export interface SubscriptionLike {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  endDate: Date | null;
}

/** A subscription that was cancelled still works until the period it paid for runs out */
const ACCESS_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'CANCELLED', 'TRIALING'];

/** The plan someone gets right now: a paid plan only while it is paid up */
export function effectivePlan(sub: SubscriptionLike | null | undefined, now = new Date()): SubscriptionPlan {
  if (!sub || sub.plan === 'FREE') return 'FREE';
  if (!ACCESS_STATUSES.includes(sub.status)) return 'FREE';
  if (!sub.endDate || sub.endDate.getTime() <= now.getTime()) return 'FREE';
  return sub.plan;
}

/**
 * When the access paid for now ends. Paying while still subscribed adds to the time left instead of
 * wasting it; paying after it lapsed starts from today.
 */
export function extendedEnd(current: SubscriptionLike | null | undefined, interval: BillingInterval, now = new Date()): Date {
  const stillPaid = effectivePlan(current, now) !== 'FREE' && current?.endDate;
  const from = stillPaid ? current!.endDate!.getTime() : now.getTime();
  return new Date(from + PERIOD_DAYS[interval] * DAY_MS);
}

/** Whole days between now and `end`, never negative */
export function daysLeft(end: Date | null, now = new Date()): number {
  if (!end) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

/** What yearly saves compared with paying monthly twelve times, as a whole percentage */
export function yearlySavingsPercent(): number {
  const monthlyYear = PRO_PRICES.MONTHLY * 12;
  return Math.round(((monthlyYear - PRO_PRICES.YEARLY) / monthlyYear) * 100);
}
