import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import { toast } from 'sonner';
import { type ApiError } from "../lib/api/errors";
import { msg, tr } from "../i18n/core";

export interface Community {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  type: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
  ownerId: string;
  owner: { id: string; name: string; avatarUrl?: string };
  members: CommunityMember[];
  channels: Channel[];
  roles: CommunityRole[];
  bans: CommunityBan[];
  _count?: { members: number; channels: number };
  /** What the person looking at it is to this community */
  viewer?: { isMember: boolean; role: string | null; banned: boolean };
  /** On a join by invite: they were in it already */
  alreadyMember?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityMember {
  id: string;
  userId: string;
  user: { id: string; name: string; avatarUrl?: string };
  role: string;
  joinedAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT' | 'CATEGORY';
  parentId?: string;
  position: number;
  threads?: Thread[];
}

export interface Thread {
  id: string;
  title: string;
  content?: string;
  authorId: string;
  author: { id: string; name: string; avatarUrl?: string };
  isLocked: boolean;
  isPinned: boolean;
  createdAt: string;
  _count?: { messages: number };
}

/** One post opened, with its replies */
export interface ThreadDetail extends Thread {
  messages: ThreadMessage[];
  viewer: { role: string; canModerate: boolean };
}

export interface ThreadMessage {
  id: string;
  authorId: string;
  author: { id: string; name: string; avatarUrl?: string };
  content: string;
  createdAt: string;
}

export interface CommunityRole {
  id: string;
  name: string;
  color?: string;
  permissions: string[];
  position: number;
}

export interface CommunityBan {
  id: string;
  userId: string;
  user: { id: string; name: string; avatarUrl?: string };
  reason?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface CommunityInvite {
  id: string;
  code: string;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
}

// ---------- API ----------

/** What the forms send (the server validates and fills in the rest) */
export type CommunityInput = Partial<Omit<Community, 'id' | 'type'>> & { name: string; type?: string };
export type ChannelInput = Partial<Omit<Channel, 'id' | 'type'>> & { name: string; type?: string };
export type ThreadInput = { title: string; content?: string; [field: string]: unknown };
export type RoleInput = Partial<Omit<CommunityRole, 'id'>> & { name: string };

export const communityApi = {
  getCommunities: () => apiClient.get<{ owned: Community[]; joined: Community[]; recommended: Community[] }>('/communities'),
  getCommunity: (communityId: string) => apiClient.get<Community>(`/communities/${communityId}`),
  createCommunity: (data: CommunityInput) => apiClient.post<Community>('/communities', data),
  updateCommunity: (communityId: string, data: Partial<CommunityInput>) => apiClient.put<Community>(`/communities/${communityId}`, data),
  deleteCommunity: (communityId: string) => apiClient.delete(`/communities/${communityId}`),

  createChannel: (communityId: string, data: ChannelInput) => apiClient.post<Channel>(`/communities/${communityId}/channels`, data),
  updateChannel: (communityId: string, channelId: string, data: Partial<ChannelInput>) => apiClient.put<Channel>(`/communities/${communityId}/channels/${channelId}`, data),
  deleteChannel: (communityId: string, channelId: string) => apiClient.delete(`/communities/${communityId}/channels/${channelId}`),

  createThread: (channelId: string, data: ThreadInput) => apiClient.post<Thread>(`/communities/channels/${channelId}/threads`, data),
  getThreads: (channelId: string) => apiClient.get<Thread[]>(`/communities/channels/${channelId}/threads`),
  getThread: (threadId: string) => apiClient.get<ThreadDetail>(`/communities/threads/${threadId}`),
  replyToThread: (threadId: string, content: string) => apiClient.post<ThreadMessage>(`/communities/threads/${threadId}/messages`, { content }),
  updateThread: (threadId: string, data: { isPinned?: boolean; isLocked?: boolean }) => apiClient.put<Thread>(`/communities/threads/${threadId}`, data),
  deleteThread: (threadId: string) => apiClient.delete(`/communities/threads/${threadId}`),
  deleteReply: (messageId: string) => apiClient.delete(`/communities/threads/messages/${messageId}`),
  reportPost: (kind: 'thread' | 'reply', id: string, data: { reason: string; details?: string }) =>
    apiClient.post(kind === 'thread' ? `/communities/threads/${id}/report` : `/communities/threads/messages/${id}/report`, data),

  joinCommunity: (communityId: string) => apiClient.post(`/communities/${communityId}/join`),
  leaveCommunity: (communityId: string) => apiClient.post(`/communities/${communityId}/leave`),
  addMember: (communityId: string, data: { userId: string; role?: string }) => apiClient.post(`/communities/${communityId}/members`, data),
  removeMember: (communityId: string, userId: string) => apiClient.delete(`/communities/${communityId}/members/${userId}`),
  updateMemberRole: (communityId: string, userId: string, data: { role: string }) => apiClient.put(`/communities/${communityId}/members/${userId}/role`, data),

  createRole: (communityId: string, data: RoleInput) => apiClient.post<CommunityRole>(`/communities/${communityId}/roles`, data),
  updateRole: (communityId: string, roleId: string, data: Partial<RoleInput>) => apiClient.put<CommunityRole>(`/communities/${communityId}/roles/${roleId}`, data),
  deleteRole: (communityId: string, roleId: string) => apiClient.delete(`/communities/${communityId}/roles/${roleId}`),

  banMember: (communityId: string, data: { userId: string; reason?: string; expiresAt?: string }) => apiClient.post(`/communities/${communityId}/bans`, data),
  unbanMember: (communityId: string, userId: string) => apiClient.delete(`/communities/${communityId}/bans/${userId}`),

  getInvites: (communityId: string) => apiClient.get<CommunityInvite[]>(`/communities/${communityId}/invites`),
  createInvite: (communityId: string, data?: { maxUses?: number; expiresAt?: string }) => apiClient.post<CommunityInvite>(`/communities/${communityId}/invites`, data || {}),
  revokeInvite: (communityId: string, inviteId: string) => apiClient.delete(`/communities/${communityId}/invites/${inviteId}`),
  joinByInvite: (code: string) => apiClient.post<Community>(`/communities/join/${encodeURIComponent(code)}`),
};

// ---------- Hooks ----------

/** The mutation owns its error message */
const failed = (fallback: string) => (error: ApiError) => {
  toast.error(error.response?.data?.message || tr(fallback));
};

/** A refusal (403, 404) won't change by asking again */
const noRetryOnRefusal = (count: number, error: unknown) => {
  const status = (error as ApiError)?.response?.status ?? 0;
  return !(status >= 400 && status < 500) && count < 2;
};

export const useCommunities = () => {
  return useQuery({
    queryKey: ['communities'],
    queryFn: async () => {
      const response = await communityApi.getCommunities();
      return response.data;
    },
  });
};

export const useCommunity = (communityId: string) => {
  return useQuery({
    queryKey: ['community', communityId],
    queryFn: async () => {
      const response = await communityApi.getCommunity(communityId);
      return response.data;
    },
    enabled: !!communityId,
    retry: noRetryOnRefusal,
  });
};

export const useCreateCommunity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CommunityInput) => {
      const response = await communityApi.createCommunity(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      toast.success(tr("Community created!"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to create community"));
    },
  });
};

export const useJoinCommunity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communityId: string) => {
      const response = await communityApi.joinCommunity(communityId);
      return response.data;
    },
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Joined community!"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to join community"));
    },
  });
};

export const useLeaveCommunity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communityId: string) => {
      const response = await communityApi.leaveCommunity(communityId);
      return response.data;
    },
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Left community"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to leave community."));
    },
  });
};

export const useCreateChannel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, data }: { communityId: string; data: ChannelInput }) => {
      const response = await communityApi.createChannel(communityId, data);
      return response.data;
    },
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Channel created"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to create channel."));
    },
  });
};

export const useDeleteChannel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, channelId }: { communityId: string; channelId: string }) => {
      const response = await communityApi.deleteChannel(communityId, channelId);
      return response.data;
    },
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Channel deleted"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to delete channel"));
    },
  });
};

export const useCreateThread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, data }: { channelId: string; data: ThreadInput }) => {
      const response = await communityApi.createThread(channelId, data);
      return response.data;
    },
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ['threads', channelId] });
      toast.success(tr("Posted"));
    },
    onError: failed(msg("Couldn't post that. Try again.")),
  });
};

export const useThreads = (channelId: string) => {
  return useQuery({
    queryKey: ['threads', channelId],
    queryFn: async () => {
      const response = await communityApi.getThreads(channelId);
      return response.data;
    },
    enabled: !!channelId,
    // New posts from other people show up while the channel is open
    refetchInterval: 30_000,
  });
};

export const useThread = (threadId: string) => {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      const response = await communityApi.getThread(threadId);
      return response.data;
    },
    enabled: !!threadId,
    retry: noRetryOnRefusal,
    refetchInterval: 15_000,
  });
};

/** After anything that changes a post: the post itself and its channel's list */
const refreshPost = (queryClient: ReturnType<typeof useQueryClient>, threadId: string, channelId: string) => {
  queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
  queryClient.invalidateQueries({ queryKey: ['threads', channelId] });
};

export const useReplyToThread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; channelId: string; content: string }) =>
      (await communityApi.replyToThread(threadId, content)).data,
    onSuccess: (_, { threadId, channelId }) => refreshPost(queryClient, threadId, channelId),
    onError: failed(msg("Couldn't send your reply. Try again.")),
  });
};

export const useUpdateThread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, data }: { threadId: string; channelId: string; data: { isPinned?: boolean; isLocked?: boolean } }) =>
      (await communityApi.updateThread(threadId, data)).data,
    onSuccess: (_, { threadId, channelId }) => refreshPost(queryClient, threadId, channelId),
    onError: failed(msg("Couldn't change that post.")),
  });
};

export const useDeleteThread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId }: { threadId: string; channelId: string }) => (await communityApi.deleteThread(threadId)).data,
    onSuccess: (_, { threadId, channelId }) => {
      queryClient.removeQueries({ queryKey: ['thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads', channelId] });
      toast.success(tr("Post deleted"));
    },
    onError: failed(msg("Couldn't delete that post.")),
  });
};

export const useDeleteReply = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId }: { messageId: string; threadId: string; channelId: string }) => (await communityApi.deleteReply(messageId)).data,
    onSuccess: (_, { threadId, channelId }) => refreshPost(queryClient, threadId, channelId),
    onError: failed(msg("Couldn't delete that reply.")),
  });
};

export const useReportPost = () =>
  useMutation({
    mutationFn: async ({ kind, id, reason, details }: { kind: 'thread' | 'reply'; id: string; reason: string; details?: string }) =>
      (await communityApi.reportPost(kind, id, { reason, details })).data,
    onSuccess: () => {
      toast.success(tr("Thanks. We will review this."));
    },
    onError: failed(msg("Could not send the report. Try again.")),
  });

export const useUpdateChannel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, channelId, data }: { communityId: string; channelId: string; data: Partial<ChannelInput> }) =>
      (await communityApi.updateChannel(communityId, channelId, data)).data,
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Saved"));
    },
    onError: failed(msg("Couldn't save the channel.")),
  });
};

export const useUpdateCommunity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, data }: { communityId: string; data: Partial<CommunityInput> }) =>
      (await communityApi.updateCommunity(communityId, data)).data,
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      toast.success(tr("Saved"));
    },
    onError: failed(msg("Couldn't save your changes.")),
  });
};

export const useDeleteCommunity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communityId: string) => (await communityApi.deleteCommunity(communityId)).data,
    onSuccess: (_, communityId) => {
      queryClient.removeQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      toast.success(tr("Community deleted"));
    },
    onError: failed(msg("Couldn't delete the community.")),
  });
};

export const useUpdateMemberRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, userId, role }: { communityId: string; userId: string; role: string }) =>
      (await communityApi.updateMemberRole(communityId, userId, { role })).data,
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Role changed"));
    },
    onError: failed(msg("Couldn't change the role.")),
  });
};

export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, userId }: { communityId: string; userId: string }) =>
      (await communityApi.removeMember(communityId, userId)).data,
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Member removed"));
    },
    onError: failed(msg("Couldn't remove that member.")),
  });
};

export const useBanMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, userId }: { communityId: string; userId: string }) =>
      (await communityApi.banMember(communityId, { userId })).data,
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Member banned"));
    },
    onError: failed(msg("Couldn't ban that member.")),
  });
};

export const useUnbanMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, userId }: { communityId: string; userId: string }) =>
      (await communityApi.unbanMember(communityId, userId)).data,
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(tr("Ban lifted"));
    },
    onError: failed(msg("Couldn't lift the ban.")),
  });
};

export const useInvites = (communityId: string) =>
  useQuery({
    queryKey: ['community-invites', communityId],
    queryFn: async () => (await communityApi.getInvites(communityId)).data,
    enabled: !!communityId,
    retry: noRetryOnRefusal,
  });

export const useCreateInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, data }: { communityId: string; data?: Parameters<typeof communityApi.createInvite>[1] }) => {
      const response = await communityApi.createInvite(communityId, data);
      return response.data;
    },
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community-invites', communityId] });
    },
    onError: failed(msg("Couldn't create an invite link.")),
  });
};

export const useRevokeInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, inviteId }: { communityId: string; inviteId: string }) =>
      (await communityApi.revokeInvite(communityId, inviteId)).data,
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['community-invites', communityId] });
      toast.success(tr("Invite link cancelled"));
    },
    onError: failed(msg("Couldn't cancel that link.")),
  });
};

export const useJoinByInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await communityApi.joinByInvite(code);
      return response.data;
    },
    onSuccess: (community) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community', community.id] });
      // Someone reopening their own invite is simply taken there
      if (!community.alreadyMember) toast.success(tr("Joined community!"));
    },
    onError: failed(msg("Invalid or expired invitation link.")),
  });
};
