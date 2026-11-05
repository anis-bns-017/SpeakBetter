import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type ChallengeKind = 'grammar' | 'pack' | 'dictation';
export type ChallengeStatus = 'OPEN' | 'BEATEN' | 'HELD' | 'TIED' | 'EXPIRED';

export interface FriendChallenge {
  id: string;
  kind: ChallengeKind;
  title: string;
  url: string;
  /** The other person: who challenged you (incoming) or who you challenged (outgoing) */
  person: { id: string; name: string; avatarUrl: string | null };
  score: number;
  total: number;
  responseScore: number | null;
  responseTotal: number | null;
  status: ChallengeStatus;
  expiresAt: string;
  createdAt: string;
}

/** What finishing an activity did to the challenges friends had sent you */
export interface ChallengeOutcome {
  id: string;
  from: string;
  status: 'BEATEN' | 'HELD' | 'TIED';
  theirs: string;
  yours: string;
}

export const useFriendChallenges = () =>
  useQuery({
    queryKey: ['friend-challenges'],
    queryFn: async () => (await apiClient.get<{ incoming: FriendChallenge[]; outgoing: FriendChallenge[] }>('/friend-challenges')).data,
    staleTime: 30_000,
  });

export const useChallengeFriend = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { friendId: string; kind: ChallengeKind; refId: string }) =>
      (await apiClient.post<{ id: string; created: boolean }>('/friend-challenges', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friend-challenges'] }),
  });
};

/** Score as a friend would read it: 5/6, or 82% for a dictation */
export const formatScore = (kind: ChallengeKind, score: number | null, total: number | null) =>
  score === null || total === null ? '-' : kind === 'dictation' ? `${score}%` : `${score}/${total}`;
