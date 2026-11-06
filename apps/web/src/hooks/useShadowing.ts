import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type ShadowLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type Tune = 'rise' | 'fall' | 'tag';

export interface ShadowLessonSummary {
  id: string;
  track: string;
  level: ShadowLevel;
  title: string;
  focus: string;
  lines: number;
  done: boolean;
  bestScore: number | null;
  times: number;
}

export interface ShadowTrack {
  id: string;
  label: string;
  description: string;
  icon: string;
  lessons: ShadowLessonSummary[];
  done: number;
}

export interface ShadowOverview {
  level: ShadowLevel;
  levels: ShadowLevel[];
  tracks: ShadowTrack[];
  next: ShadowLessonSummary | null;
  stats: { done: number; total: number; average: number | null; linesSpoken: number; sessions: number };
}

export interface LineToken {
  text: string;
  stress: boolean;
  weak: string | null;
  link: boolean;
}

export interface ShadowLine {
  id: string;
  text: string;
  tokens: LineToken[];
  tune: Tune;
  /** Build-up steps: the end of the line first, the whole line last */
  steps: string[];
}

export interface ShadowLesson {
  id: string;
  level: string;
  round?: number;
  title: string;
  focus: string;
  tip: string;
  track: { id: string; label: string; icon: string } | null;
  lines: ShadowLine[];
  progress: { bestScore: number | null; times: number; lineScores: Record<string, number> } | null;
  next: { id: string; title: string } | null;
}

export interface ShadowResult {
  firstTime: boolean;
  xp: number;
  spoken: number;
  total: number;
  average: number | null;
  best: number | null;
  lines: Array<{ id: string; text: string; score: number | null; best: number | null }>;
  weakWords: string[];
}

export const useShadowingOverview = () =>
  useQuery({
    queryKey: ['shadowing'],
    queryFn: async () => (await apiClient.get<ShadowOverview>('/shadowing')).data,
    staleTime: 60_000,
  });

/** A course lesson, or the daily mix when id is "daily" */
export const useShadowLesson = (id: string | undefined, round = 0) =>
  useQuery({
    queryKey: ['shadowing', id, id === 'daily' ? round : 0],
    queryFn: async () =>
      (id === 'daily'
        ? await apiClient.get<ShadowLesson>('/shadowing/daily', { params: { round } })
        : await apiClient.get<ShadowLesson>(`/shadowing/${id}`)
      ).data,
    enabled: !!id,
    staleTime: id === 'daily' ? Infinity : 5 * 60_000,
  });

export const useFinishShadowing = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (startedAt: string) => (await apiClient.post<ShadowResult>(`/shadowing/${id}/finish`, { startedAt })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shadowing'] });
      queryClient.invalidateQueries({ queryKey: ['plan-today'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });
};
