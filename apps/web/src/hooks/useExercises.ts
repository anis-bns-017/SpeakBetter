// apps/web/src/hooks/useExercises.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type ExerciseLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type ExerciseSkill = 'mixed' | 'grammar' | 'vocabulary';

export type PracticeExercise =
  | { id: string; skill: 'grammar' | 'vocabulary'; topic: string; kind: 'blank' | 'correct' | 'meaning' | 'gap'; prompt: string; options: string[] }
  | { id: string; skill: 'grammar'; topic: string; kind: 'order'; prompt: string; words: string[] }
  | { id: string; skill: 'grammar'; topic: string; kind: 'type'; prompt: string };

/** The position of an option, the words in order, or the typed text */
export type PracticeAnswer = number | string | string[];

export interface ExerciseSet {
  level: ExerciseLevel;
  skill: ExerciseSkill;
  day: string;
  round: number;
  levels: ExerciseLevel[];
  skills: ExerciseSkill[];
  doneToday: number;
  xpAvailable: boolean;
  xp: number;
  passMark: number;
  items: PracticeExercise[];
}

export interface ExerciseCheck {
  id: string;
  correct: boolean;
  correctText: string;
  explanation: string;
}

export interface ExerciseResult {
  score: number;
  total: number;
  passed: boolean;
  perfect: boolean;
  passMark: number;
  xp: number;
  cardsAdded: number;
  results: Array<{ id: string; correct: boolean; original: string; correctText: string; explanation: string }>;
}

export const useExerciseSet = (level: ExerciseLevel | undefined, skill: ExerciseSkill) =>
  useQuery({
    queryKey: ['exercise-set', level ?? 'mine', skill],
    queryFn: async () => (await apiClient.get<ExerciseSet>('/learning/exercises', { params: { level, skill } })).data,
    // A set must not change while someone is answering it, and must be fresh when they come back
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

export const useCheckExercise = () =>
  useMutation({
    mutationFn: async (input: { id: string; answer: PracticeAnswer }) =>
      (await apiClient.post<ExerciseCheck>('/learning/exercises/check', input)).data,
  });

export const useFinishExercises = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { level: ExerciseLevel; skill: ExerciseSkill; day: string; round: number; answers: Record<string, PracticeAnswer> }) =>
      (await apiClient.post<ExerciseResult>('/learning/exercises/finish', input)).data,
    onSuccess: () => {
      // The set itself is refetched only when they ask for a new one, so the result stays on screen
      for (const key of ['plan-today', 'learning-dashboard', 'streak', 'quests', 'review-queue', 'progress']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
};
