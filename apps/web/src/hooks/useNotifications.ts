import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type NotificationType =
  | 'ROOM_REMINDER'
  | 'ROOM_LIVE'
  | 'ROOM_SCHEDULED'
  | 'NEW_FOLLOWER'
  | 'CORRECTION'
  | 'FRIEND_REQUEST'
  | string;

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  data: { actor?: { id: string; name: string; avatarUrl: string | null } | null; roomId?: string } | null;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  unread: number;
  hasMore: boolean;
}

export const NOTIFICATIONS_KEY = ['notifications'] as const;

export const useNotifications = () =>
  useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => (await apiClient.get<NotificationPage>('/notifications', { params: { limit: 30 } })).data,
    staleTime: 30_000,
  });

/** Marks some (or all) notifications read; the list and the badge update straight away */
export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids?: string[]; all?: boolean }) =>
      (await apiClient.post<{ unread: number }>('/notifications/read', input)).data,
    onMutate: (input) => {
      queryClient.setQueryData<NotificationPage>(NOTIFICATIONS_KEY, (page) =>
        page
          ? {
              ...page,
              items: page.items.map((n) => (input.all || input.ids?.includes(n.id) ? { ...n, isRead: true } : n)),
              unread: input.all ? 0 : Math.max(0, page.unread - page.items.filter((n) => !n.isRead && input.ids?.includes(n.id)).length),
            }
          : page,
      );
    },
    onSuccess: ({ unread }) => {
      queryClient.setQueryData<NotificationPage>(NOTIFICATIONS_KEY, (page) => (page ? { ...page, unread } : page));
    },
  });
};

export type NotificationPreferences = Record<'roomReminders' | 'followedLive' | 'newFollowers' | 'corrections' | 'friendRequests', boolean>;

export const useNotificationPreferences = () =>
  useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => (await apiClient.get<NotificationPreferences>('/notifications/preferences')).data,
    staleTime: 5 * 60_000,
  });

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: Partial<NotificationPreferences>) =>
      (await apiClient.put<NotificationPreferences>('/notifications/preferences', changes)).data,
    onSuccess: (prefs) => queryClient.setQueryData(['notification-preferences'], prefs),
  });
};

// ---------- following ----------

export interface FollowStatus {
  following: boolean;
  followedBy: boolean;
  followers: number;
  followingCount: number;
}

export const useFollowStatus = (userId: string | undefined) =>
  useQuery({
    queryKey: ['follow', userId],
    queryFn: async () => (await apiClient.get<FollowStatus>(`/users/${userId}/follow`)).data,
    enabled: !!userId,
    staleTime: 60_000,
  });

export const useToggleFollow = (userId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (follow: boolean) =>
      (follow
        ? await apiClient.post<FollowStatus>(`/users/${userId}/follow`)
        : await apiClient.delete<FollowStatus>(`/users/${userId}/follow`)
      ).data,
    onSuccess: (status) => {
      queryClient.setQueryData(['follow', userId], status);
      queryClient.invalidateQueries({ queryKey: ['voice-upcoming'] });
    },
  });
};

// ---------- scheduled rooms ----------

export interface UpcomingRoom {
  id: string;
  name: string;
  description: string | null;
  type: string;
  language: string | null;
  topics: string[];
  scheduledFor: string;
  creator: { id: string; name: string; avatarUrl: string | null };
  interestedCount: number;
  interested: boolean;
  followingHost: boolean;
  isHost: boolean;
}

export const useUpcomingRooms = () =>
  useQuery({
    queryKey: ['voice-upcoming'],
    queryFn: async () => (await apiClient.get<UpcomingRoom[]>('/voice/upcoming')).data,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

export type RoomInterests = Record<string, { count: number; mine: boolean }>;

/** Reminder counts for a set of room cards */
export const useRoomInterests = (roomIds: string[]) => {
  const ids = [...roomIds].sort();
  return useQuery({
    queryKey: ['voice-interests', ids.join(',')],
    queryFn: async () => (await apiClient.get<RoomInterests>('/voice/interests', { params: { ids: ids.join(',') } })).data,
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
};

export const useToggleRoomInterest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, interested }: { roomId: string; interested: boolean }) =>
      (interested
        ? await apiClient.post<{ roomId: string; interested: boolean; count: number }>(`/voice/rooms/${roomId}/interest`)
        : await apiClient.delete<{ roomId: string; interested: boolean; count: number }>(`/voice/rooms/${roomId}/interest`)
      ).data,
    onSuccess: (result) => {
      queryClient.setQueriesData<RoomInterests>({ queryKey: ['voice-interests'] }, (map) =>
        map && map[result.roomId] ? { ...map, [result.roomId]: { count: result.count, mine: result.interested } } : map,
      );
      queryClient.setQueryData<UpcomingRoom[]>(['voice-upcoming'], (rooms) =>
        rooms?.map((r) => (r.id === result.roomId ? { ...r, interested: result.interested, interestedCount: result.count } : r)),
      );
      queryClient.invalidateQueries({ queryKey: ['voice-interests'] });
    },
  });
};
