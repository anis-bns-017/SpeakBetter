import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type ChallengeLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface ChallengePrompt {
  id: string;
  level: ChallengeLevel;
  title: string;
  prompt: string;
  phrases: string[];
  keywords: string[];
  seconds: number;
}

export interface AnswerStats {
  words: number;
  seconds: number;
  wpm: number | null;
  fluency: number | null;
  fillersPer100: number;
  uniqueWords: number;
  richWords: string[];
  tooShort: boolean;
  topicWords: string[];
  onTopic: boolean | null;
  score: number | null;
}

export interface ChallengeEntry {
  id: string;
  user: { id: string; name: string; avatarUrl: string | null };
  level: ChallengeLevel;
  promptId: string;
  promptTitle: string;
  audioUrl: string;
  transcript: string;
  durationSec: number;
  visibility: 'public' | 'private';
  stats: AnswerStats;
  reactions: Record<string, number>;
  totalReactions: number;
  myReaction: string | null;
  isMine: boolean;
  createdAt: string;
}

export interface ChallengeToday {
  day: string;
  level: ChallengeLevel;
  ownLevel: ChallengeLevel;
  prompt: ChallengePrompt;
  levels: Array<{ level: ChallengeLevel; title: string }>;
  mine: ChallengeEntry | null;
  feed: ChallengeEntry[];
  streak: number;
  total: number;
  reactions: string[];
}

export const useChallengeToday = (level?: ChallengeLevel) =>
  useQuery({
    queryKey: ['challenge-today', level ?? ''],
    queryFn: async () => (await apiClient.get<ChallengeToday>('/challenges/today', { params: level ? { level } : {} })).data,
    staleTime: 30_000,
  });

export const useSubmitChallenge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { promptId: string; audioUrl: string; transcript: string; durationSec: number; visibility: 'public' | 'private' }) =>
      (await apiClient.post<{ entry: ChallengeEntry | null; firstToday: boolean; xp: number }>('/challenges/entries', input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-today'] });
      queryClient.invalidateQueries({ queryKey: ['plan-today'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['league-current'] });
    },
  });
};

export const useDeleteChallenge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.delete('/challenges/entries/mine')).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['challenge-today'] }),
  });
};

export const useReactToChallenge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, emoji }: { entryId: string; emoji: string | null }) =>
      (
        await apiClient.post<{ entryId: string; reactions: Record<string, number>; totalReactions: number; myReaction: string | null }>(
          `/challenges/entries/${entryId}/react`,
          { emoji },
        )
      ).data,
    onSuccess: (result) => {
      // Update the card in place, without reordering the feed under the reader's finger
      queryClient.setQueriesData<ChallengeToday>({ queryKey: ['challenge-today'] }, (today) =>
        today
          ? {
              ...today,
              feed: today.feed.map((e) =>
                e.id === result.entryId ? { ...e, reactions: result.reactions, totalReactions: result.totalReactions, myReaction: result.myReaction } : e,
              ),
            }
          : today,
      );
    },
  });
};
