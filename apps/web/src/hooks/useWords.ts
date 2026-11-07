// apps/web/src/hooks/useWords.ts
// My words: every word you saved (word packs, word of the day, voice rooms, your own) in one list.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type WordSource = 'pack' | 'dict' | 'room' | 'mine';
export type WordStage = 'new' | 'learning' | 'learned';
export type WordItemType = 'card' | 'word';

export interface BankWord {
  key: string;
  type: WordItemType;
  id: string;
  word: string;
  meaning: string | null;
  example: string | null;
  source: WordSource;
  sourceLabel: string;
  addedAt: string;
  stage: WordStage;
  /** Chance (0-100) you'd remember it right now; null until reviewed */
  recall: number | null;
  dueAt: string;
  due: boolean;
  reviews: number;
  lapses: number;
}

export interface WordsSummary {
  total: number;
  due: number;
  thisWeek: number;
  averageRecall: number | null;
  bySource: Record<WordSource, number>;
  byStage: Record<WordStage, number>;
}

export interface WordsResponse {
  items: BankWord[];
  summary: WordsSummary;
}

export const WORDS_KEY = ['my-words'] as const;

export const wordsError = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message?.toString() || fallback;

export const useWords = () =>
  useQuery({
    queryKey: WORDS_KEY,
    queryFn: async () => (await apiClient.get<WordsResponse>('/words')).data,
  });

/** Everything that shows saved words or their counts */
function useRefreshWords() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: WORDS_KEY });
    void queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    void queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
  };
}

export const useAddWord = () => {
  const refresh = useRefreshWords();
  return useMutation({
    mutationFn: async (input: { word: string; meaning: string; example?: string }) => (await apiClient.post<BankWord>('/words', input)).data,
    onSuccess: refresh,
  });
};

export const useUpdateWord = () => {
  const refresh = useRefreshWords();
  return useMutation({
    mutationFn: async (input: { type: WordItemType; id: string; meaning: string; example?: string }) =>
      (await apiClient.put<BankWord>(`/words/${input.type}/${input.id}`, { meaning: input.meaning, example: input.example ?? '' })).data,
    onSuccess: refresh,
  });
};

export const useRemoveWord = () => {
  const refresh = useRefreshWords();
  return useMutation({
    mutationFn: async (input: { type: WordItemType; id: string }) => (await apiClient.delete(`/words/${input.type}/${input.id}`)).data,
    onSuccess: refresh,
  });
};
