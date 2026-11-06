import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type QuestKind = 'XP' | 'DAYS' | 'PLAN' | 'SPEAK' | 'REVIEW' | 'READ' | 'WRITE' | 'CHALLENGE' | 'PRONUNCIATION' | 'CORRECTION';

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  /** Where to go to work on it, if one place fits */
  to: string | null;
  target: number;
  progress: number;
  done: boolean;
  xp: number;
}

export interface WeeklyQuests {
  week: string;
  endsAt: string;
  quests: Quest[];
  done: number;
  total: number;
  chest: { xp: number; openedAt: string | null; freezeGiven: boolean };
  /** The chest was opened and not celebrated yet */
  celebrate: boolean;
}

export interface StreakStatus {
  current: number;
  longest: number;
  practicedToday: boolean;
  freezes: number;
  maxFreezes: number;
  price: number;
  /** XP left to spend in the shop (your level still counts everything you earned) */
  balance: number;
  canBuy: boolean;
  /** Days a freeze covered that you haven't been told about */
  saved: Array<{ day: string; streak: number }>;
}

export const useQuests = (enabled = true) =>
  useQuery({
    queryKey: ['quests'],
    queryFn: async () => (await apiClient.get<WeeklyQuests>('/quests')).data,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    // Quests tick off from anywhere in the app, so look again now and then
    refetchInterval: 2 * 60_000,
  });

export const useStreak = (enabled = true) =>
  useQuery({
    queryKey: ['streak'],
    queryFn: async () => (await apiClient.get<StreakStatus>('/streak')).data,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

export const useBuyFreeze = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<StreakStatus>('/streak/freezes')).data,
    onSuccess: (status) => {
      queryClient.setQueryData(['streak'], status);
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
    },
  });
};

/** Marks the chest and/or the "streak saved" news as seen */
export const useMarkQuestNews = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { chest?: boolean; saved?: boolean }) => (await apiClient.post('/quests/seen', input)).data,
    // Close the screen at once rather than after the round trip
    onMutate: (input) => {
      if (input.chest) queryClient.setQueryData<WeeklyQuests>(['quests'], (q) => (q ? { ...q, celebrate: false } : q));
      if (input.saved) queryClient.setQueryData<StreakStatus>(['streak'], (s) => (s ? { ...s, saved: [] } : s));
    },
    // The chest paid XP and may have brought a badge with it
    onSuccess: () => {
      for (const key of ['celebrations', 'achievements', 'progress', 'learning-dashboard', 'league-current']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
};
