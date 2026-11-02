import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import type { CefrCode } from '../lib/cefr';

export type PlacementSkill = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING';

export interface PlacementQuestion {
  id: string;
  skill: PlacementSkill;
  prompt: string;
  passage?: string;
  audio?: string;
  options: string[];
}

export interface PlacementProgress {
  attemptId: string;
  answered: number;
  total: number;
  question: PlacementQuestion;
}

export interface PlacementSkillResult {
  level: CefrCode;
  correct: number;
  total: number;
}

export interface PlacementResult {
  level: CefrCode;
  theta: number;
  confidence: 'low' | 'medium' | 'high';
  correct: number;
  total: number;
  skills: Record<PlacementSkill, PlacementSkillResult>;
  strongest: PlacementSkill;
  weakest: PlacementSkill;
}

export interface SpeakingSample {
  words: number;
  seconds: number;
  wpm: number | null;
  fluency: number | null;
  fillersPer100: number;
  uniqueWords: number;
  richWords: string[];
  tooShort: boolean;
}

export type PlacementAnswerReply =
  | ({ done: false } & PlacementProgress)
  | { done: true; attemptId: string; answered: number; total: number; result: PlacementResult };

export interface PlacementStatus {
  level: string | null;
  assessedAt: string | null;
  attemptId: string | null;
  result: PlacementResult | null;
  speaking: SpeakingSample | null;
  inProgress: { attemptId: string; answered: number } | null;
  /** ISO time the next attempt is allowed, or null when a retake is open */
  retakeAvailableAt: string | null;
  totalQuestions: number;
}

export const usePlacementStatus = () =>
  useQuery({
    queryKey: ['placement'],
    queryFn: async () => (await apiClient.get<PlacementStatus>('/placement/me')).data,
    staleTime: 30_000,
  });

export const useStartPlacement = () =>
  useMutation({
    mutationFn: async () => (await apiClient.post<PlacementProgress>('/placement/start')).data,
  });

export const useAnswerPlacement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      attemptId: string;
      itemId: string;
      /** Position of the chosen option; leave out with `skip` */
      choice?: number;
      skip?: boolean;
      ms?: number;
    }) => {
      const { attemptId, ...body } = vars;
      return (await apiClient.post<PlacementAnswerReply>(`/placement/${attemptId}/answer`, body)).data;
    },
    onSuccess: (reply) => {
      if (!reply.done) return;
      // The level now lives on the profile and shows in several places
      queryClient.invalidateQueries({ queryKey: ['placement'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
    },
  });
};

export const useSubmitSpeaking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { attemptId: string; transcript: string; seconds: number }) => {
      const { attemptId, ...body } = vars;
      return (await apiClient.post<SpeakingSample>(`/placement/${attemptId}/speaking`, body)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['placement'] }),
  });
};
