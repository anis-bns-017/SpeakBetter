import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

// ---------- Types ----------
export interface Vocabulary {
  id: string;
  word: string;
  translation: string;
  language: string;
  exampleSentence?: string;
  audioUrl?: string;
  difficulty: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  language: string;
  userId: string;
}

export interface FlashcardReview {
  id: string;
  flashcardId?: string;
  vocabularyId?: string;
  easeFactor: number;
  interval: number;
  dueAt: string;
  reviewCount: number;
  flashcard?: Flashcard;
  vocabulary?: Vocabulary;
}

export interface GrammarRule {
  id: string;
  title: string;
  description: string;
  examples: string[];
  language: string;
  level: string;
}

export interface Exercise {
  id: string;
  type: string;
  language: string;
  title: string;
  description?: string;
  content: string; // JSON string
  difficulty: string;
}

export interface Progress {
  id: string;
  language: string;
  skill: string;
  level: string;
  xp: number;
  completedExercises: number;
  mastered: boolean;
}

export interface UserProgress {
  progress: Progress[];
  streak: number;
  totalXP: number;
}

// ---------- Vocabulary ----------
export const useVocabulary = (params: {
  language?: string;
  difficulty?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: ['vocabulary', params],
    queryFn: async () => {
      const response = await apiClient.get<{
        items: Vocabulary[];
        total: number;
        limit: number;
        offset: number;
      }>('/learning/vocabulary', { params });
      return response.data;
    },
  });
};

export const useCreateVocabulary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/learning/vocabulary', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    },
  });
};

export const useReviewVocabulary = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { vocabularyId: string; difficulty: 'easy' | 'medium' | 'hard' }) => {
      const response = await apiClient.post('/learning/vocabulary/review', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
};

// ---------- Flashcards ----------
export const useFlashcards = (params: { language?: string; dueOnly?: boolean }) => {
  return useQuery({
    queryKey: ['flashcards', params],
    queryFn: async () => {
      const response = await apiClient.get<FlashcardReview[]>('/learning/flashcards', { params });
      return response.data;
    },
  });
};

export const useCreateFlashcard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { front: string; back: string; language: string }) => {
      const response = await apiClient.post('/learning/flashcards', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
    },
  });
};

export const useReviewFlashcard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { flashcardId: string; difficulty: 'easy' | 'medium' | 'hard' }) => {
      const response = await apiClient.post('/learning/flashcards/review', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
};

// ---------- Grammar ----------
export const useGrammar = (params: { language?: string; level?: string; limit?: number }) => {
  return useQuery({
    queryKey: ['grammar', params],
    queryFn: async () => {
      const response = await apiClient.get<GrammarRule[]>('/learning/grammar', { params });
      return response.data;
    },
  });
};

// ---------- Exercises ----------
export const useExercises = (params: {
  language?: string;
  type?: string;
  difficulty?: string;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['exercises', params],
    queryFn: async () => {
      const response = await apiClient.get<Exercise[]>('/learning/exercises', { params });
      return response.data;
    },
  });
};

export const useSubmitExercise = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { exerciseId: string; answers: any[]; metadata?: any }) => {
      const response = await apiClient.post('/learning/exercises/submit', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
};

// ---------- Progress ----------
export const useProgress = () => {
  return useQuery({
    queryKey: ['progress'],
    queryFn: async () => {
      const response = await apiClient.get<UserProgress>('/learning/progress');
      return response.data;
    },
  });
};
// ---------- Dashboard ----------
export interface DashboardData {
  streak: { current: number; longest: number; practicedToday: boolean };
  xp: { total: number; today: number; dailyGoal: number; thisWeek: number; lastWeek: number };
  /** XP earned per day for the last 84 days, oldest first */
  activity: Array<{ date: string; xp: number }>;
  profile: {
    nativeLanguage: string | null;
    learningLanguages: string[];
    level: string | null;
    goals: string[];
  };
  words: { total: number; thisWeek: number };
  flashcards: { total: number; due: number };
  voice: {
    roomsJoined: number;
    roomsThisWeek: number;
    speakingMinutes: number;
    turns: number;
    speakingMinutesThisWeek: number;
  };
  corrections: {
    received: number;
    accepted: number;
    pending: number;
    given: number;
    recent: Array<{
      id: string;
      original: string;
      corrected: string;
      note?: string | null;
      category: string;
      resolvedAt?: string | null;
      authorName: string;
    }>;
  };
}

export const useDashboard = () => {
  return useQuery({
    queryKey: ['learning-dashboard'],
    queryFn: async () => {
      const response = await apiClient.get<DashboardData>('/learning/dashboard');
      return response.data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
};
