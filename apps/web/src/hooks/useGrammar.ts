import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type GrammarLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface GrammarLessonItem {
  id: string;
  level: GrammarLevel;
  title: string;
  summary: string;
  pattern: string | null;
  patternLabel: string | null;
  exercises: number;
  done: boolean;
  bestScore: number | null;
  tried: boolean;
}

export interface GrammarList {
  level: GrammarLevel;
  levels: Array<{ level: GrammarLevel; total: number; done: number }>;
  lessons: GrammarLessonItem[];
  done: number;
  recommended: { id: string; reason: string } | null;
}

export type GrammarExercise =
  | { id: string; kind: 'blank' | 'correct'; prompt: string; options: string[] }
  | { id: string; kind: 'order'; prompt: string; words: string[] }
  | { id: string; kind: 'type'; prompt: string };

/** What the learner answered: an option's position, the words in order, or typed text */
export type GrammarAnswer = number | string[] | string;

export interface GrammarLesson {
  id: string;
  level: GrammarLevel;
  title: string;
  summary: string;
  intro: string;
  pattern: string | null;
  patternLabel: string | null;
  rules: Array<{ title: string; body: string; examples: string[] }>;
  mistakes: Array<{ wrong: string; right: string; why: string }>;
  exercises: GrammarExercise[];
  positionInLevel: { index: number; of: number };
  progress: { bestScore: number; total: number; attempts: number; done: boolean } | null;
  next: { id: string; title: string; level: GrammarLevel } | null;
}

export interface GrammarCheck {
  id: string;
  correct: boolean;
  correctText: string;
  explanation: string;
}

export interface GrammarResult {
  score: number;
  total: number;
  passed: boolean;
  perfect: boolean;
  firstPass: boolean;
  xp: number;
  cardsAdded: number;
  results: Array<{ id: string; correct: boolean; original: string; correctText: string; explanation: string }>;
}

export const useGrammarLessons = () =>
  useQuery({
    queryKey: ['grammar'],
    queryFn: async () => (await apiClient.get<GrammarList>('/grammar/lessons')).data,
    staleTime: 60_000,
  });

export const useGrammarLesson = (id: string | undefined) =>
  useQuery({
    queryKey: ['grammar-lesson', id],
    queryFn: async () => (await apiClient.get<GrammarLesson>(`/grammar/lessons/${id}`)).data,
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

export const useCheckGrammar = (lessonId: string) =>
  useMutation({
    mutationFn: async (input: { exerciseId: string; answer: GrammarAnswer }) =>
      (await apiClient.post<GrammarCheck>(`/grammar/lessons/${lessonId}/check`, input)).data,
  });

export const useFinishGrammar = (lessonId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Record<string, GrammarAnswer>) =>
      (await apiClient.post<GrammarResult>(`/grammar/lessons/${lessonId}/finish`, { answers })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grammar'] });
      queryClient.invalidateQueries({ queryKey: ['grammar-lesson', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['plan-today'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      // Wrong answers become flashcards
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review-mistakes'] });
    },
  });
};
