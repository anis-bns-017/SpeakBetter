import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import type { ChallengeOutcome } from './useFriendChallenges';

export type PackLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface PackItem {
  id: string;
  level: PackLevel;
  title: string;
  topic: string;
  icon: string;
  summary: string;
  words: number;
  saved: number;
  done: boolean;
  bestScore: number | null;
  total: number | null;
}

export interface PackList {
  level: PackLevel;
  levels: Array<{ level: PackLevel; total: number; done: number }>;
  packs: PackItem[];
  done: number;
  wordsSaved: number;
  recommended: string | null;
}

export interface PackWord {
  id: string;
  word: string;
  pos: string;
  meaning: string;
  example: string;
  saved: boolean;
}

export interface PackQuestion {
  id: string;
  kind: 'meaning' | 'gap';
  prompt: string;
  options: string[];
}

export interface Pack {
  id: string;
  level: PackLevel;
  title: string;
  topic: string;
  icon: string;
  summary: string;
  words: PackWord[];
  quiz: PackQuestion[];
  progress: { bestScore: number; total: number; attempts: number; done: boolean } | null;
  next: { id: string; title: string } | null;
}

export interface PackCheck {
  id: string;
  correct: boolean;
  correctText: string;
  meaning: string;
  example: string;
}

export interface PackResult {
  challenges?: ChallengeOutcome[];
  score: number;
  total: number;
  passed: boolean;
  perfect: boolean;
  firstPass: boolean;
  xp: number;
  wordsAdded: number;
  results: Array<{ id: string; correct: boolean; chosen: string | null; correctText: string; meaning: string; example: string }>;
}

/** GET /vocab-packs/today: the same word for everyone at your level today, and three meanings to choose from */
export interface WordOfDay {
  day: string;
  packId: string;
  packTitle: string;
  level: PackLevel;
  wordId: string;
  word: string;
  pos: string;
  meaning: string;
  example: string;
  saved: boolean;
  options: string[];
  /** Position of the right meaning in `options` (nothing is at stake, so it comes with the question) */
  answer: number;
}

export const useWordOfDay = () =>
  useQuery({
    queryKey: ['word-of-day'],
    queryFn: async () => (await apiClient.get<WordOfDay>('/vocab-packs/today')).data,
    staleTime: 10 * 60_000,
  });

export const usePacks = () =>
  useQuery({
    queryKey: ['vocab-packs'],
    queryFn: async () => (await apiClient.get<PackList>('/vocab-packs')).data,
    staleTime: 60_000,
  });

export const usePack = (id: string | undefined) =>
  useQuery({
    queryKey: ['vocab-pack', id],
    queryFn: async () => (await apiClient.get<Pack>(`/vocab-packs/${id}`)).data,
    enabled: !!id,
    staleTime: 0,
  });

const refreshReview = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['review-queue'] });
  queryClient.invalidateQueries({ queryKey: ['plan-today'] });
  queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
};

export const useSavePackWords = (packId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (wordIds?: string[]) =>
      (await apiClient.post<{ added: number; saved: number; total: number }>(`/vocab-packs/${packId}/save`, { wordIds })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab-pack', packId] });
      queryClient.invalidateQueries({ queryKey: ['vocab-packs'] });
      queryClient.invalidateQueries({ queryKey: ['word-of-day'] });
      refreshReview(queryClient);
    },
  });
};

export const useCheckPackAnswer = (packId: string) =>
  useMutation({
    mutationFn: async (input: { questionId: string; answer: number }) =>
      (await apiClient.post<PackCheck>(`/vocab-packs/${packId}/check`, input)).data,
  });

export const useFinishPackQuiz = (packId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Record<string, number>) =>
      (await apiClient.post<PackResult>(`/vocab-packs/${packId}/finish`, { answers })).data,
    onSuccess: () => {
      // The pack page is NOT refetched here: the learner is still reading their result, and a refetch would
      // swap in the next attempt's quiz. It is refetched when they start again.
      queryClient.invalidateQueries({ queryKey: ['vocab-packs'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
      refreshReview(queryClient);
    },
  });
};
