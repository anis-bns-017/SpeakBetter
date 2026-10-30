import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export interface Profile {
  id: string;
  userId: string;
  country?: string;
  nativeLanguage?: string;
  learningLanguages: string[];
  interests: string[];
  goals: string[];
  bio?: string;
  xp: number;
  streak: number;
  lastActive: string;
  // Also on the Profile row (server/prisma/schema.prisma)
  username?: string | null;
  displayName?: string | null;
  city?: string | null;
  level?: string | null;
  followersCount?: number;
  followingCount?: number;
  isVerified?: boolean;
  createdAt?: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface UpdateProfileData {
  country?: string;
  nativeLanguage?: string;
  learningLanguages?: string[];
  interests?: string[];
  goals?: string[];
  bio?: string;
}

export const useProfile = () => {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await apiClient.get<Profile>('/profile/me');
      return response.data;
    },
    retry: 1,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const response = await apiClient.put<Profile>('/profile/me', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });

  return {
    profile,
    isLoading,
    error,
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdating: updateProfileMutation.isPending,
  };
};