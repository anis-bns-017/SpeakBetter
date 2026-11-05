import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import type { BadgeTier } from './useGamification';

export interface ProfileBadge {
  key: string;
  name: string;
  description: string;
  tier: BadgeTier;
  icon: string;
  earnedAt: string;
}

export interface ProfileRelationship {
  isMe: boolean;
  following: boolean;
  followedBy: boolean;
  isFriend: boolean;
  /** A friend request that is waiting: sent by you, or sent to you */
  friendRequest: 'sent' | 'received' | null;
}

/** A person who keeps their profile private: only a name and photo */
export interface PrivateProfile {
  id: string;
  private: true;
  name: string;
  avatarUrl: string | null;
  relationship: ProfileRelationship;
}

export interface FullProfile {
  id: string;
  private: false;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  nativeLanguage: string | null;
  learningLanguages: string[];
  interests: string[];
  level: string | null;
  isVerified: boolean;
  joinedAt: string;
  lastActive: string | null;
  stats: {
    xp: number;
    streak: number;
    longestStreak: number;
    lessonsPassed: number;
    textsRead: number;
    challengeAnswers: number;
    followers: number;
    following: number;
    friends: number;
  };
  league: { index: number; name: string; color: string; best: string } | null;
  badges: { total: number; earned: number; showcase: ProfileBadge[]; all: ProfileBadge[] };
  relationship: ProfileRelationship;
}

export type PublicProfile = FullProfile | PrivateProfile;

export const useUserProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => (await apiClient.get<PublicProfile>(`/users/${userId}/profile`)).data,
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
  });
