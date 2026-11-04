import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export type MistakePattern =
  | 'TENSE'
  | 'AGREEMENT'
  | 'PREPOSITION'
  | 'ARTICLE'
  | 'WORD_ORDER'
  | 'SPELLING'
  | 'WORD_CHOICE'
  | 'MISSING_WORD'
  | 'EXTRA_WORD'
  | 'PUNCTUATION'
  | 'PRONUNCIATION'
  | 'OTHER';

export interface ReviewItem {
  key: string;
  type: 'card' | 'word';
  id: string;
  /** correction: a mistake you were corrected on; word: a word or phrase to remember */
  kind: 'correction' | 'word';
  front: string;
  back: string;
  note: string | null;
  pattern: MistakePattern | null;
  patternLabel: string | null;
  isNew: boolean;
  dueAt: string;
  /** Minutes until the card returns for each answer */
  preview: Record<ReviewRating, number>;
}

export interface ReviewQueue {
  items: ReviewItem[];
  due: { corrections: number; words: number; total: number };
}

export interface ReviewQueueParams {
  /** Include cards that are not due yet */
  all?: boolean;
  kind?: 'correction' | 'word';
  pattern?: string;
  language?: string;
}

export const useReviewQueue = (params: ReviewQueueParams) =>
  useQuery({
    queryKey: ['review-queue', params],
    queryFn: async () => {
      const query = {
        ...(params.all ? { all: '1' } : {}),
        ...(params.kind ? { kind: params.kind } : {}),
        ...(params.pattern ? { pattern: params.pattern } : {}),
        ...(params.language ? { language: params.language } : {}),
      };
      return (await apiClient.get<ReviewQueue>('/review/queue', { params: query })).data;
    },
    // A review session works on the cards it started with; it refreshes when you ask for more
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });

export const useAnswerReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { type: ReviewItem['type']; id: string; rating: ReviewRating }) =>
      (await apiClient.post<{ key: string; dueAt: string; intervalDays: number }>('/review/answer', vars)).data,
    onSuccess: () => {
      // Not the queue itself: a session keeps working on the cards it started with
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['review-mistakes'] });
    },
  });
};

export interface MistakeGroup {
  pattern: MistakePattern;
  label: string;
  tip: string;
  count: number;
  last7: number;
  prev7: number;
  /** up means more mistakes than the week before */
  trend: 'up' | 'down' | 'same';
  /** Cards for this pattern you now remember for weeks */
  learned: number;
  repeating: boolean;
  examples: Array<{ original: string; corrected: string; note: string | null }>;
}

export interface MistakesReport {
  days: number;
  total: number;
  patterns: MistakeGroup[];
}

export const useMistakesReport = (days = 30) =>
  useQuery({
    queryKey: ['review-mistakes', days],
    queryFn: async () => (await apiClient.get<MistakesReport>('/review/mistakes', { params: { days } })).data,
    staleTime: 30_000,
  });

/** Brings corrections from before this feature existed into the deck; refreshes the lists if any were added */
export const useSyncReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<{ added: number }>('/review/sync')).data,
    onSuccess: (result) => {
      if (result.added > 0) {
        queryClient.invalidateQueries({ queryKey: ['review-queue'] });
        queryClient.invalidateQueries({ queryKey: ['review-mistakes'] });
      }
    },
  });
};

/** "10m", "1d", "3 wk", "2 mo": how long until a card returns */
export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const days = minutes / 1440;
  if (days < 1) return `${Math.round(minutes / 60)}h`;
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)} wk`;
  return `${Math.round(days / 30)} mo`;
}
