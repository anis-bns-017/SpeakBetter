import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type LibraryLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type TextKind = 'story' | 'dialogue' | 'article';
export type QuestionType = 'detail' | 'tfng' | 'vocab' | 'inference';

export interface LibraryItem {
  id: string;
  level: LibraryLevel;
  kind: TextKind;
  title: string;
  topic: string;
  summary: string;
  minutes: number;
  words: number;
  questions: number;
  keyWords: number;
  done: boolean;
  started: boolean;
  bestScore: number | null;
}

export interface LibraryList {
  level: LibraryLevel;
  levels: Array<{ level: LibraryLevel; total: number; done: number }>;
  topics: string[];
  texts: LibraryItem[];
  done: number;
  stats: { wordsRead: number; minutesRead: number; perfect: number };
  /** The next unread text at your level */
  recommended: { id: string; title: string; level: LibraryLevel; minutes: number } | null;
}

export interface LibraryText {
  id: string;
  level: LibraryLevel;
  kind: TextKind;
  title: string;
  topic: string;
  summary: string;
  minutes: number;
  words: number;
  sentences: Array<{ speaker?: string; text: string }>;
  vocab: Array<{ word: string; meaning: string; sentence: number; saved: boolean }>;
  discuss: string[];
  questions: Array<{ id: string; type: QuestionType; question: string; options: string[] }>;
  progress: { bestScore: number; total: number; attempts: number; done: boolean } | null;
  next: { id: string; title: string } | null;
}

export interface QuizResult {
  score: number;
  total: number;
  firstCompletion: boolean;
  xp: number;
  results: Array<{ id: string; type: QuestionType; chosen: number | null; correct: boolean; correctIndex: number; explanation: string; sentence: number }>;
}

export const useLibrary = () =>
  useQuery({
    queryKey: ['library'],
    queryFn: async () => (await apiClient.get<LibraryList>('/library')).data,
    staleTime: 60_000,
  });

export const useLibraryText = (id: string | undefined) =>
  useQuery({
    queryKey: ['library-text', id],
    queryFn: async () => (await apiClient.get<LibraryText>(`/library/${id}`)).data,
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

export const useAnswerLibrary = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Record<string, number>) => (await apiClient.post<QuizResult>(`/library/${id}/answers`, { answers })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['plan-today'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
    },
  });
};

/** Save one of a text's key words as a flashcard */
export const useSaveLibraryWord = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (word: string) => (await apiClient.post<{ word: string; saved: boolean; created: boolean }>(`/library/${id}/words`, { word })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-text', id] });
      queryClient.invalidateQueries({ queryKey: ['my-words'] });
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    },
  });
};
