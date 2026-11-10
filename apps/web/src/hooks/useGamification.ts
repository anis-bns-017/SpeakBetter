import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
export type BadgeCategory = 'STREAK' | 'LEARNING' | 'SPEAKING' | 'VOCABULARY' | 'COMMUNITY' | 'SPECIAL';

export interface Badge {
  key: string;
  name: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  icon: string;
  earnedAt: string | null;
  isNew: boolean;
  /** Pinned to the top of your profile */
  pinned: boolean;
  progress: { value: number; target: number };
}

export interface Achievements {
  badges: Badge[];
  earned: number;
  total: number;
  recent: Badge[];
  pinnedCount: number;
  maxPinned: number;
}

export const useAchievements = () =>
  useQuery({
    queryKey: ['achievements'],
    queryFn: async () => (await apiClient.get<Achievements>('/achievements')).data,
    staleTime: 60_000,
  });

/** Pin or unpin a badge you have earned (the pinned ones come first on your profile) */
export const usePinBadge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; pinned: boolean }) =>
      (await apiClient.put<{ key: string; pinned: boolean }>(`/achievements/${encodeURIComponent(input.key)}/pin`, { pinned: input.pinned })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
};

export type Zone = 'promote' | 'stay' | 'demote';

export interface LeagueInfo {
  index: number;
  name: string;
  color: string;
}

export interface LeagueStanding {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  zone: Zone;
  isMe: boolean;
}

export interface CurrentLeague {
  weekStart: string;
  endsAt: string;
  tier: LeagueInfo;
  leagues: LeagueInfo[];
  lastResult: { weekStart: string; tier: number; rank: number | null; xp: number | null; result: Zone | null; league: string } | null;
  /** False until you earn XP this week */
  joined: boolean;
  standings: LeagueStanding[];
  promote: number;
  demote: number;
  myRank: number | null;
}

export const useCurrentLeague = () =>
  useQuery({
    queryKey: ['league-current'],
    queryFn: async () => (await apiClient.get<CurrentLeague>('/leagues/current')).data,
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  });

/** "2d 5h", "5h 20m", "12m": time left in the league week */
export function timeLeft(endsAt: string, now: number): string {
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// ---------- friends board ----------

export interface FriendsLeague {
  weekStart: string;
  endsAt: string;
  hasFriends: boolean;
  people: Array<{
    rank: number;
    userId: string;
    name: string;
    avatarUrl: string | null;
    xp: number;
    league: string;
    leagueColor: string;
    isMe: boolean;
  }>;
}

export const useFriendsLeague = (enabled = true) =>
  useQuery({
    queryKey: ['league-friends'],
    queryFn: async () => (await apiClient.get<FriendsLeague>('/leagues/friends')).data,
    enabled,
    staleTime: 30_000,
  });

// ---------- celebrations ----------

export interface Celebrations {
  badges: Array<{ key: string; name: string; description: string; tier: BadgeTier; icon: string; earnedAt: string }>;
  league: {
    weekStart: string;
    rank: number | null;
    xp: number;
    result: Zone;
    groupSize: number;
    from: LeagueInfo;
    to: LeagueInfo;
  } | null;
}

export const useCelebrations = (enabled: boolean) =>
  useQuery({
    queryKey: ['celebrations'],
    queryFn: async () => (await apiClient.get<Celebrations>('/celebrations')).data,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

export const useMarkCelebrated = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { badges?: boolean; league?: boolean }) => (await apiClient.post('/celebrations/seen', input)).data,
    // Close the screen at once rather than after the round trip
    onMutate: (input) => {
      queryClient.setQueryData<Celebrations>(['celebrations'], (c) =>
        c ? { badges: input.badges ? [] : c.badges, league: input.league ? null : c.league } : c,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['celebrations'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    },
  });
};
