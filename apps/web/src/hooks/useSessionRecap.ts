import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export interface SessionRecap {
  roomId: string;
  roomName: string;
  at: string;
  durationSec: number;
  speakingSec: number;
  words: number;
  uniqueWords: number;
  wpm: number | null;
  fluencyScore: number | null;
  fillerCount: number;
  topFillers: Array<{ word: string; count: number }>;
  richWords: string[];
  missionsCompleted: number;
  correctionsGiven: number;
  corrections: Array<{ id: string; original: string; corrected: string; note: string | null; category: string; author: { id: string; name: string; avatarUrl: string | null } }>;
  savedWords: Array<{ word: string; meaning: string | null; sentence: string | null }>;
  people: Array<{ id: string; name: string; avatarUrl: string | null }>;
  tip: { kind: 'mistake' | 'fillers' | 'pace-slow' | 'pace-fast' | 'speak-more' | 'keep-going'; title: string; text: string };
}

export interface SessionSummary {
  id: string;
  roomId: string;
  roomName: string;
  durationSec: number;
  speakingSec: number;
  words: number;
  fluencyScore: number | null;
  correctionsReceived: number;
  updatedAt: string;
}

/** The recap for one room. The report is written as you leave, so a 404 right after leaving is retried a few times. */
export const useSessionRecap = (roomId: string | undefined) =>
  useQuery({
    queryKey: ['session-recap', roomId],
    queryFn: async () => (await apiClient.get<SessionRecap>(`/voice/coach/recap/${roomId}`)).data,
    enabled: !!roomId,
    retry: 4,
    retryDelay: 1500,
    staleTime: 60_000,
  });

export const useMySessions = () =>
  useQuery({
    queryKey: ['my-sessions'],
    queryFn: async () => (await apiClient.get<SessionSummary[]>('/voice/coach/reports/me', { params: { limit: 30 } })).data,
    staleTime: 60_000,
  });

/** "1 h 5 min", "12 min", "45 s" */
export const formatDuration = (sec: number): string => {
  if (sec < 60) return `${Math.max(0, Math.round(sec))} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};
