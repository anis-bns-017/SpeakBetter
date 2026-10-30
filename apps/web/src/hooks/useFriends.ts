import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import { toast } from 'sonner';

// ---------- Types ----------
export interface Friend {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  friendSince: string;
  profile?: {
    nativeLanguage?: string;
    learningLanguages?: string[];
    lastActive?: string;
  };
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: string;
  fromUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface BlockedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  blockedAt: string;
  reason?: string;
}

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isFriend: boolean;
  isRequested: boolean;
  isBlocked: boolean;
  profile?: {
    nativeLanguage?: string;
    learningLanguages?: string[];
  };
}

// ---------- Friend Requests ----------
export const useSendFriendRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (toUserId: string) => {
      const response = await apiClient.post('/friends/requests', { toUserId });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Friend request sent!');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send request');
    },
  });
};

export const useRespondFriendRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'accepted' | 'rejected' }) => {
      const response = await apiClient.put('/friends/requests/respond', { requestId, action });
      return response.data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'accepted' ? 'Friend request accepted!' : 'Friend request rejected');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to respond');
    },
  });
};

export const useCancelFriendRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiClient.delete(`/friends/requests/${requestId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Friend request cancelled');
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel');
    },
  });
};

// ---------- Friends List ----------
export const useFriends = () => {
  return useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const response = await apiClient.get<Friend[]>('/friends');
      return response.data;
    },
  });
};

export const useFriendRequests = () => {
  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: async () => {
      const response = await apiClient.get<FriendRequest[]>('/friends/requests/incoming');
      return response.data;
    },
  });
};

export const useOutgoingRequests = () => {
  return useQuery({
    queryKey: ['outgoing-requests'],
    queryFn: async () => {
      const response = await apiClient.get<FriendRequest[]>('/friends/requests/outgoing');
      return response.data;
    },
  });
};

export const useFriendCount = () => {
  return useQuery({
    queryKey: ['friend-count'],
    queryFn: async () => {
      const response = await apiClient.get<number>('/friends/count');
      return response.data;
    },
  });
};

// ---------- Blocking ----------
export const useBlockUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const response = await apiClient.post('/friends/block', { userId, reason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('User blocked');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to block user');
    },
  });
};

export const useUnblockUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.delete(`/friends/block/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('User unblocked');
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to unblock user');
    },
  });
};

export const useBlockedUsers = () => {
  return useQuery({
    queryKey: ['blocked-users'],
    queryFn: async () => {
      const response = await apiClient.get<BlockedUser[]>('/friends/blocked');
      return response.data;
    },
  });
};

// ---------- Search ----------
export const useSearchUsers = (query: string) => {
  return useQuery({
    queryKey: ['user-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const response = await apiClient.get<UserSearchResult[]>('/friends/search', {
        params: { query },
      });
      return response.data;
    },
    enabled: query.length >= 2,
  });
};

// ---------- Online Status ----------
export const useOnlineStatus = (userId: string) => {
  return useQuery({
    queryKey: ['online-status', userId],
    queryFn: async () => {
      const response = await apiClient.get<{ online: boolean; lastActive: string }>(
        `/friends/online/${userId}`
      );
      return response.data;
    },
    refetchInterval: 30000, // refresh every 30 seconds
  });
};

export const useUpdateLastActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/friends/online/update');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-status'] });
    },
  });
};

// ---------- Friendship Check ----------
export const useCheckFriendship = (userId: string) => {
  return useQuery({
    queryKey: ['friendship-check', userId],
    queryFn: async () => {
      const response = await apiClient.get<boolean>(`/friends/check/${userId}`);
      return response.data;
    },
    enabled: !!userId,
  });
};


/** GET /friends/suggestions — best language-exchange matches first */
export interface FriendSuggestion {
  id: string;
  name: string;
  avatarUrl?: string | null;
  profile?: {
    nativeLanguage?: string | null;
    learningLanguages?: string[];
    interests?: string[];
    country?: string | null;
    level?: string | null;
    lastActive?: string;
  } | null;
  /** Why this person was suggested, e.g. "Native English speaker — you're learning it" */
  reason?: string;
  sharedInterests?: string[];
  matchScore?: number;
  isRequested?: boolean;
}

export const useSuggestions = () => {
  return useQuery({
    queryKey: ['friend-suggestions'],
    queryFn: async () => {
      const response = await apiClient.get<FriendSuggestion[]>('/friends/suggestions');
      return response.data;
    },
  });
};