import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type ScenarioLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface ScenarioItem {
  id: string;
  level: ScenarioLevel;
  title: string;
  setting: string;
  icon: string;
  partner: string;
  turns: number;
  done: boolean;
  bestScore: number | null;
  times: number;
}

export interface ScenarioList {
  level: ScenarioLevel;
  levels: Array<{ level: ScenarioLevel; total: number; done: number }>;
  scenarios: ScenarioItem[];
  done: number;
}

export interface Scenario {
  id: string;
  level: ScenarioLevel;
  title: string;
  setting: string;
  you: string;
  partner: string;
  icon: string;
  exchanges: Array<{ partner: string; replies: [string, string] }>;
  closing: string;
  phrases: Array<{ phrase: string; use: string }>;
  progress: { bestScore: number | null; times: number } | null;
  next: { id: string; title: string } | null;
}

export interface RoleplayResult {
  firstTime: boolean;
  xp: number;
  spoken: number;
  turns: number;
  average: number | null;
  best: number | null;
}

export const useScenarios = () =>
  useQuery({
    queryKey: ['roleplay'],
    queryFn: async () => (await apiClient.get<ScenarioList>('/roleplay')).data,
    staleTime: 60_000,
  });

export const useScenario = (id: string | undefined) =>
  useQuery({
    queryKey: ['roleplay', id],
    queryFn: async () => (await apiClient.get<Scenario>(`/roleplay/${id}`)).data,
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

export const useFinishScenario = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scores: Array<number | null>) => (await apiClient.post<RoleplayResult>(`/roleplay/${id}/finish`, { scores })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roleplay'] });
      queryClient.invalidateQueries({ queryKey: ['plan-today'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });
};
