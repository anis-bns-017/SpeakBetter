import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type PlanTaskKind = 'LEVEL' | 'REVIEW' | 'PRONUNCIATION' | 'SPEAK' | 'CHALLENGE' | 'READ' | 'WRITE' | 'CORRECTION' | 'WORDS' | 'EXERCISE';

export interface PlanTask {
  id: string;
  kind: PlanTaskKind;
  title: string;
  detail: string;
  to: string;
  target: number;
  unit: 'test' | 'cards' | 'tries' | 'minutes' | 'answers' | 'texts' | 'pieces' | 'corrections' | 'words' | 'exercises';
  minutes: number;
  progress: number;
  done: boolean;
}

export interface TodayPlan {
  day: string;
  goalMinutes: number;
  goalOptions: number[];
  tasks: PlanTask[];
  done: number;
  total: number;
  minutesPlanned: number;
  completedAt: string | null;
  bonusXp: number;
  bonusJustEarned: boolean;
  /** Days in a row the whole plan was finished */
  streak: number;
}

export const useTodayPlan = () =>
  useQuery({
    queryKey: ['plan-today'],
    queryFn: async () => (await apiClient.get<TodayPlan>('/plan/today')).data,
    // Progress comes from what you do anywhere in the app, so look again now and then
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

export const useSetDailyGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (minutes: number) => (await apiClient.put<TodayPlan>('/plan/goal', { minutes })).data,
    onSuccess: (plan) => {
      queryClient.setQueryData(['plan-today'], plan);
    },
  });
};

export type ActivityKind = 'speaking' | 'review' | 'pronunciation' | 'corrections' | 'chat' | 'exercises' | 'other';

export interface WeekStats {
  minutes: number;
  xp: number;
  reviews: number;
  speakingMinutes: number;
  pronunciationAverage: number | null;
  pronunciationTries: number;
  activeDays: number;
  plansCompleted: number;
  mistakes: number;
}

export interface ProgressInsights {
  days: Array<{ date: string; xp: number; minutes: number; byActivity: Record<ActivityKind, number> }>;
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  /** Minutes per week, oldest first (12 weeks) */
  weeklyMinutes: number[];
  mistakes: {
    patterns: Array<{ key: string; label: string }>;
    byWeek: Array<{ weeksAgo: number; total: number; byPattern: Record<string, number> }>;
  };
  cards: { learned: number; total: number };
  pronunciation: {
    byWeek: Array<{ weeksAgo: number; average: number | null; tries: number }>;
    weakSounds: Array<{ key: string; label: string; average: number; tries: number }>;
  };
  levels: Array<{ level: string; date: string }>;
  streak: { current: number; longest: number; plan: number };
  totalXp: number;
  summary: string[];
}

export const useProgressInsights = () =>
  useQuery({
    queryKey: ['insights-progress'],
    queryFn: async () => (await apiClient.get<ProgressInsights>('/insights/progress')).data,
    staleTime: 60_000,
  });
