// server/src/profile/onboarding.ts
// The first-day guide's answers, checked. Pure, so the rules can be tested without a database.

import { GOAL_OPTIONS } from '../insights/plan.engine';

/** Why people learn English, as the guide offers it */
export const ONBOARDING_GOALS = ['speaking', 'work', 'study', 'exam', 'travel', 'friends'] as const;
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number];

/** "How much English do you know?" for people who skip the level test, as a starting CEFR level */
export const SELF_LEVELS = { beginner: 'A1', basic: 'A2', intermediate: 'B1', confident: 'B2' } as const;
export type SelfLevel = keyof typeof SELF_LEVELS;

/** Interface languages the web app has */
export const INTERFACE_LANGUAGES = ['en', 'bn'] as const;

export interface OnboardingInput {
  nativeLanguage?: unknown;
  goals?: unknown;
  selfLevel?: unknown;
  dailyGoalMinutes?: unknown;
  interfaceLanguage?: unknown;
}

export interface OnboardingAnswers {
  nativeLanguage: string | null;
  goals: OnboardingGoal[] | null;
  selfLevel: SelfLevel | null;
  dailyGoalMinutes: number | null;
  interfaceLanguage: (typeof INTERFACE_LANGUAGES)[number] | null;
}

/** Keeps what is valid and drops the rest: every step of the guide can be skipped */
export function readOnboarding(input: OnboardingInput): OnboardingAnswers {
  const native = typeof input.nativeLanguage === 'string' ? input.nativeLanguage.trim().toLowerCase().slice(0, 12) : '';
  const goals = Array.isArray(input.goals)
    ? [...new Set(input.goals.filter((g): g is OnboardingGoal => (ONBOARDING_GOALS as readonly unknown[]).includes(g)))]
    : null;
  const minutes = Number(input.dailyGoalMinutes);
  return {
    nativeLanguage: /^[a-z]{2,3}(-[a-z0-9]{2,8})?$|^other$/.test(native) ? native : null,
    goals: goals && goals.length ? goals : null,
    selfLevel: typeof input.selfLevel === 'string' && input.selfLevel in SELF_LEVELS ? (input.selfLevel as SelfLevel) : null,
    dailyGoalMinutes: (GOAL_OPTIONS as readonly number[]).includes(minutes) ? minutes : null,
    interfaceLanguage: (INTERFACE_LANGUAGES as readonly unknown[]).includes(input.interfaceLanguage)
      ? (input.interfaceLanguage as OnboardingAnswers['interfaceLanguage'])
      : null,
  };
}
