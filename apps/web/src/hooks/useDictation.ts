import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import type { ChallengeOutcome } from './useFriendChallenges';

export type TokenKind = 'ok' | 'spelling' | 'wrong' | 'missing' | 'extra';

export interface DictationToken {
  kind: TokenKind;
  word: string;
  typed?: string;
}

export interface DictationSession {
  level: string;
  day: string;
  attempt: number;
  doneToday: number;
  finished: number;
  bestScore: number | null;
  /** The text is here so the browser can read it aloud; the page hides it until you answer */
  items: Array<{ id: string; text: string }>;
}

export interface DictationCheck {
  id: string;
  text: string;
  tokens: DictationToken[];
  correct: number;
  total: number;
  score: number;
}

export interface DictationResult {
  challenges?: ChallengeOutcome[];
  score: number;
  correctWords: number;
  totalWords: number;
  perfect: boolean;
  xp: number;
  cardsAdded: number;
  results: Array<DictationCheck & { typed: string }>;
}

export const useDictationSession = () =>
  useQuery({
    queryKey: ['dictation-session'],
    queryFn: async () => (await apiClient.get<DictationSession>('/dictation/session')).data,
    staleTime: Infinity,
  });

export const useCheckDictation = () =>
  useMutation({
    mutationFn: async (input: { id: string; typed: string }) => (await apiClient.post<DictationCheck>('/dictation/check', input)).data,
  });

export const useFinishDictation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Record<string, string>) => (await apiClient.post<DictationResult>('/dictation/finish', { answers })).data,
    onSuccess: () => {
      // The session itself is refetched only when they start a new one, so the result stays on screen
      queryClient.invalidateQueries({ queryKey: ['plan-today'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });
};
