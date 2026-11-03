import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export interface TutorScenarioInfo {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
}

export interface TutorStatus {
  /** False until ANTHROPIC_API_KEY is set on the server */
  configured: boolean;
  level: string | null;
  dailyTurnsLeft: number;
  /** Turns a day on the learner's plan (Free or Pro) */
  dailyTurnLimit: number;
  activeSessionId: string | null;
  scenarios: TutorScenarioInfo[];
}

export interface TutorCorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export interface TutorWord {
  word: string;
  meaning: string;
  example: string;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  corrections?: TutorCorrection[];
  betterPhrasing?: string;
  newWords?: TutorWord[];
  suggestions?: string[];
  /** Sent but not yet answered, so the corrections aren't known */
  pending?: boolean;
}

export interface TutorSummary {
  turns: number;
  words: number;
  uniqueWords: number;
  avgWordsPerTurn: number;
  fluency: number | null;
  fillersPer100: number;
  richWords: string[];
  mistakes: number;
  corrections: TutorCorrection[];
  newWords: TutorWord[];
  xpEarned: number;
}

export interface TutorSession {
  sessionId: string;
  scenario: { id: string; title: string; emoji: string };
  level: string;
  ended: boolean;
  summary: TutorSummary | null;
  turnsLeftToday: number;
  messages: TutorMessage[];
}

export interface TutorTurnReply {
  userMessage: TutorMessage;
  reply: TutorMessage;
  turnsLeftToday: number;
  sessionTurnsLeft: number;
}

export const useTutorStatus = () =>
  useQuery({
    queryKey: ['ai-tutor-status'],
    queryFn: async () => (await apiClient.get<TutorStatus>('/ai-tutor/status')).data,
    staleTime: 15_000,
  });

export const useStartTutorSession = () =>
  useMutation({
    mutationFn: async (vars: { scenario: string; level?: string }) =>
      (await apiClient.post<TutorSession>('/ai-tutor/sessions', vars)).data,
  });

export const fetchTutorSession = async (sessionId: string) =>
  (await apiClient.get<TutorSession>(`/ai-tutor/sessions/${sessionId}`)).data;

export const useTutorTurn = (sessionId: string) =>
  useMutation({
    mutationFn: async (text: string) =>
      (await apiClient.post<TutorTurnReply>(`/ai-tutor/sessions/${sessionId}/turn`, { text })).data,
  });

export const useEndTutorSession = (sessionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ sessionId: string; summary: TutorSummary }>(`/ai-tutor/sessions/${sessionId}/end`)).data,
    onSuccess: () => {
      // The recap earned XP and used up the day's turns
      queryClient.invalidateQueries({ queryKey: ['ai-tutor-status'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
    },
  });
};

/** The server's message for a failed request, or a fallback */
export const tutorErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  return typeof data?.message === 'string' ? data.message : fallback;
};
