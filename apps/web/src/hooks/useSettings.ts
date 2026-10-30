import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

/** Mirrors the Settings model in server/prisma/schema.prisma */
export interface Settings {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEffects: boolean;
  /** LIGHT | DARK | SYSTEM */
  theme: string;
  language: string;
  dailyReminderEnabled?: boolean;
  /** "HH:mm", or null when no reminder time is set */
  dailyReminderTime?: string | null;
  shareActivityWithFriends: boolean;
  showOnlineStatus: boolean;
  showProfilePublic?: boolean;
  allowFriendRequests?: boolean;
  allowDirectMessages?: boolean;
  autoTranslateMessages?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateSettingsData {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  soundEffects?: boolean;
  theme?: string;
  language?: string;
  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string | null;
  shareActivityWithFriends?: boolean;
  showOnlineStatus?: boolean;
  showProfilePublic?: boolean;
  allowFriendRequests?: boolean;
  allowDirectMessages?: boolean;
  autoTranslateMessages?: boolean;
}

export const useSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await apiClient.get<Settings>('/settings');
      return response.data;
    },
    retry: 1,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: UpdateSettingsData) => {
      const response = await apiClient.put<Settings>('/settings', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettingsMutation.mutateAsync,
    isUpdating: updateSettingsMutation.isPending,
  };
};