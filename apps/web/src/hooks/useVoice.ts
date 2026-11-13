// apps/web/src/hooks/useVoice.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ensureFreshSession } from "../lib/api/client";
import { toast } from "sonner";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  Room,
  RoomEvent,
  Track,
  LocalAudioTrack,
  RemoteAudioTrack,
  RemoteTrack,
  RemoteTrackPublication,
  Participant,
  ConnectionQuality,
  DisconnectReason,
  AudioPresets,
} from "livekit-client";
import { type ApiError } from "../lib/api/errors";
import { tr } from "../i18n/core";
import { SOCKET_URL, LIVEKIT_URL } from "../lib/api/serverUrl";

// ---------- Environment Variables ----------
// ---------- Types ----------

export type VoiceRealtimeState = {
  audioLevel: number;
  isSpeaking: boolean;
  lastSpeakingAt: number;
};

export class RealtimeVoiceActivityDetector {
  private speaking = false;
  private aboveSince = 0;
  private lastAbove = 0;
  private readonly startThreshold: number;
  private readonly stopThreshold: number;
  private readonly minimumSpeechMs: number;
  private readonly releaseMs: number;

  constructor(
    startThreshold = 0.055,
    stopThreshold = 0.03,
    minimumSpeechMs = 70,
    releaseMs = 260,
  ) {
    this.startThreshold = startThreshold;
    this.stopThreshold = stopThreshold;
    this.minimumSpeechMs = minimumSpeechMs;
    this.releaseMs = releaseMs;
  }

  update(level: number, now = Date.now()) {
    const safe = Math.max(0, Math.min(1, Number(level) || 0));

    if (!this.speaking) {
      if (safe >= this.startThreshold) {
        if (!this.aboveSince) this.aboveSince = now;
        if (now - this.aboveSince >= this.minimumSpeechMs) {
          this.speaking = true;
          this.lastAbove = now;
        }
      } else {
        this.aboveSince = 0;
      }
      return this.speaking;
    }

    if (safe >= this.stopThreshold) {
      this.lastAbove = now;
      return true;
    }

    if (now - this.lastAbove >= this.releaseMs) {
      this.speaking = false;
      this.aboveSince = 0;
      return false;
    }

    return true;
  }

  reset() {
    this.speaking = false;
    this.aboveSince = 0;
    this.lastAbove = 0;
  }
}

/** A participant report from any source (LiveKit, our socket, older payloads), with the field names they use */
type RawVoiceParticipant = Partial<Record<
  "audioLevel" | "volume" | "level" | "audioVolume" | "userId" | "identity" | "id" | "isSpeaking" | "speaking" | "isTalking"
  | "isMuted" | "muted" | "hasAudioTrack" | "audioTrack" | "track" | "audio" | "lastSpeakingAt",
  unknown
>>;

export function normalizeRealtimeVoiceParticipant(input: RawVoiceParticipant | null | undefined) {
  const audioLevel = Math.max(
    0,
    Math.min(
      1,
      Number(
        input?.audioLevel ??
          input?.volume ??
          input?.level ??
          input?.audioVolume ??
          0,
      ) || 0,
    ),
  );

  return {
    userId: String(input?.userId ?? input?.identity ?? input?.id ?? ""),
    isSpeaking: Boolean(
      input?.isSpeaking ?? input?.speaking ?? input?.isTalking ?? false,
    ),
    audioLevel,
    isMuted: Boolean(input?.isMuted ?? input?.muted ?? false),
    hasAudioTrack: Boolean(
      input?.hasAudioTrack ?? input?.audioTrack ?? input?.track ?? input?.audio,
    ),
    lastSpeakingAt: Number(
      input?.lastSpeakingAt ?? (input?.isSpeaking ? Date.now() : 0),
    ),
  };
}

export async function getRealtimeMicrophonePermission() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return "unavailable" as const;
  }

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });

      if (result.state === "denied") return "denied" as const;
      if (result.state === "granted") return "granted" as const;
    }

    return "unknown" as const;
  } catch {
    return "unknown" as const;
  }
}

export function getRealtimeVoiceDiagnostics() {
  return {
    secureContext:
      typeof window !== "undefined" ? window.isSecureContext : false,
    mediaDevices:
      typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
    getUserMedia:
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    audioContext:
      typeof window !== "undefined" &&
      Boolean(window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext),
  };
}

export interface VoiceRoom {
  id: string;
  name: string;
  description?: string;
  type: "OPEN" | "PRIVATE" | "SCHEDULED" | "STAGE";
  status: "WAITING" | "ACTIVE" | "ENDED";
  creatorId: string;
  creator: { id: string; name: string; avatarUrl?: string };
  scheduledFor?: string;
  startedAt?: string | null;
  maxParticipants: number;
  isRecording: boolean;
  language?: string;
  topics: string[];
  categories: string[];
  tags: string[];
  participants: VoiceParticipant[];
  recordings: Recording[];
  stages: Stage[];
  createdAt: string;
  updatedAt: string;
  liveKitRoomId?: string;
}

/** Someone in the room as the voice socket reports them (lighter than VoiceParticipant) */
export interface RoomSocketParticipant {
  userId: string;
  user?: { id?: string; name?: string; avatarUrl?: string | null };
  role?: string;
  raisedHand?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  [key: string]: unknown;
}

export interface VoiceParticipant {
  id: string;
  userId: string;
  user: { id: string; name: string; avatarUrl?: string; country?: string; isVerified?: boolean; isPremium?: boolean };
  role: "SPEAKER" | "LISTENER" | "STAGE_SPEAKER" | "MODERATOR";
  isMuted: boolean;
  isDeafened: boolean;
  raisedHand: boolean;
  joinedAt: string;
  leftAt?: string;
}

export interface Recording {
  id: string;
  url: string;
  duration: number;
  size: number;
  transcript?: string;
  createdAt: string;
}

export interface Stage {
  id: string;
  name: string;
  speakers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VoiceMessage {
  id: string;
  content: string;
  type: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  chatId?: string;
  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  reactions?: Record<string, string[]>;
  replyToId?: string;
  replyTo?: VoiceMessage;
  /** Uploaded image / video / audio (IMAGE, VIDEO, VOICE_NOTE…) */
  mediaUrl?: string | null;
  /** Uploaded document (FILE) */
  fileUrl?: string | null;
  editedAt?: string | null;
  /** Sender's optimistic id, echoed back on the socket broadcast of their own message */
  clientId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceMessageTranslation {
  messageId: string;
  language: string;
  text: string;
  /** Already in the reader's language */
  unchanged: boolean;
}

// ---------- API ----------

export const voiceApi = {
  getRooms: (params?: { type?: string; status?: string }) =>
    apiClient.get<VoiceRoom[]>("/voice/rooms", { params }),
  getRoom: (roomId: string) =>
    apiClient.get<VoiceRoom>(`/voice/rooms/${roomId}`),
  createRoom: (data: {
    name: string;
    description?: string;
    type: string;
    maxParticipants: number;
    password?: string;
    language?: string;
    topics?: string[];
    categories?: string[];
    tags?: string[];
    scheduledFor?: string;
  }) => apiClient.post<VoiceRoom>("/voice/rooms", data),
  updateRoom: (roomId: string, data: Partial<Pick<VoiceRoom, "name" | "description" | "language" | "topics" | "categories" | "tags" | "maxParticipants">>) =>
    apiClient.put(`/voice/rooms/${roomId}`, data),
  endRoom: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/end`),

  joinRoom: (roomId: string) =>
    apiClient.post<{
      success?: boolean;
      token?: string;
      wsUrl?: string;
      liveKitRoomId?: string;
      room?: { liveKitRoomId?: string };
      data?: {
        token?: string;
        wsUrl?: string;
        liveKitRoomId?: string;
        room?: { liveKitRoomId?: string };
      };
    }>(`/voice/rooms/${roomId}/join`),

  refreshToken: (roomId: string) =>
    apiClient.post<{
      success: boolean;
      data: {
        token: string;
        liveKitRoomId: string;
      };
    }>(`/voice/rooms/${roomId}/refresh-token`),

  leaveRoom: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/leave`),
  getRoomParticipants: (roomId: string) =>
    apiClient.get(`/voice/rooms/${roomId}/participants`),
  updateRole: (roomId: string, userId: string, role: string) =>
    apiClient.put(`/voice/rooms/${roomId}/role/${userId}`, { role }),

  addToStage: (roomId: string, userId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/stage/add/${userId}`),
  removeFromStage: (roomId: string, userId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/stage/remove/${userId}`),

  getRecordings: (roomId: string) =>
    apiClient.get(`/voice/rooms/${roomId}/recordings`),
  startRecording: (roomId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/recordings/start`),
  stopRecording: (roomId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/recordings/stop`),

  getRoomMessages: (roomId: string, limit?: number, before?: string) =>
    apiClient.get<VoiceMessage[]>(`/voice/rooms/${roomId}/messages`, {
      params: { limit, before },
    }),
  sendRoomMessage: (
    roomId: string,
    data: {
      content: string;
      type?: string;
      mediaUrl?: string;
      fileUrl?: string;
      replyToId?: string;
    },
  ) => apiClient.post<VoiceMessage>(`/voice/rooms/${roomId}/messages`, data),
  deleteRoomMessage: (roomId: string, messageId: string) =>
    apiClient.delete(`/voice/rooms/${roomId}/messages/${messageId}`),

  editRoomMessage: (roomId: string, messageId: string, content: string) =>
    apiClient.patch<VoiceMessage>(
      `/voice/rooms/${roomId}/messages/${messageId}`,
      { content },
    ),
  reactToRoomMessage: (roomId: string, messageId: string, emoji: string) =>
    apiClient.post<{ reactions: Record<string, string[]> }>(
      `/voice/rooms/${roomId}/messages/${messageId}/reactions`,
      { emoji },
    ),
  pinRoomMessage: (roomId: string, messageId: string, pinned: boolean) =>
    apiClient.post<VoiceMessage>(
      `/voice/rooms/${roomId}/messages/${messageId}/pin`,
      { pinned },
    ),
  translateRoomMessage: (roomId: string, messageId: string, target?: string) =>
    apiClient.post<{ success: boolean; data: VoiceMessageTranslation }>(
      `/voice/rooms/${roomId}/messages/${messageId}/translate`,
      target ? { target } : {},
    ),
  reportRoomMessage: (
    roomId: string,
    messageId: string,
    reason: string,
    description?: string,
  ) =>
    apiClient.post<{ success: boolean; data: { alreadyReported: boolean } }>(
      `/voice/rooms/${roomId}/messages/${messageId}/report`,
      { reason, description },
    ),

  checkRoomStatus: (roomId: string) =>
    apiClient.get(`/voice/rooms/${roomId}/status`),
  getActiveParticipants: (roomId: string) =>
    apiClient.get(`/voice/rooms/${roomId}/active-participants`),

  promoteHost: (roomId: string, userId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/promote-host/${userId}`),

  muteParticipant: (roomId: string, userId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/mute`, { userId }),
  unmuteParticipant: (roomId: string, userId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/unmute`, { userId }),
};

// ---------- Query Hooks ----------

export const useVoiceRooms = (filters?: { type?: string; status?: string }) => {
  return useQuery({
    queryKey: ["voice-rooms", filters],
    queryFn: async () => {
      const response = await voiceApi.getRooms(filters);
      return response.data;
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 15000,
  });
};

export const useVoiceRoom = (roomId: string) => {
  return useQuery({
    queryKey: ["voice-room", roomId],
    queryFn: async () => {
      const response = await voiceApi.getRoom(roomId);
      return response.data;
    },
    enabled: !!roomId,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useRoomParticipants = (roomId: string) => {
  return useQuery({
    queryKey: ["voice-participants", roomId],
    queryFn: async () => {
      const response = await voiceApi.getRoomParticipants(roomId);
      return response.data;
    },
    enabled: !!roomId,
    staleTime: 0,
    refetchInterval: 5000,
  });
};

export const useRoomMessages = (roomId: string, limit: number = 50) => {
  return useQuery({
    queryKey: ["voice-messages", roomId],
    queryFn: async () => {
      const response = await voiceApi.getRoomMessages(roomId, limit);
      return response.data;
    },
    enabled: !!roomId,
    staleTime: 30_000, // ← was 0 — now 30s
    refetchOnWindowFocus: false, // ← don't refetch on tab switch
    refetchOnMount: false, // ← don't refetch on remount if cached
  });
};

export const useRoomStatus = (roomId: string) => {
  return useQuery({
    queryKey: ["voice-status", roomId],
    queryFn: async () => {
      const response = await voiceApi.checkRoomStatus(roomId);
      return response.data;
    },
    enabled: !!roomId,
    refetchInterval: 5000,
  });
};

// ---------- Mutation Hooks ----------

export const useCreateVoiceRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      type: string;
      maxParticipants: number;
      password?: string;
      language?: string;
      topics?: string[];
      categories?: string[];
      tags?: string[];
      scheduledFor?: string;
    }) => {
      const response = await voiceApi.createRoom(data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
      toast.success(tr("🎉 Room \"{name}\" created!", { name: data.name }));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to create room"));
    },
  });
};

export const useJoinVoiceRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string) => {
      const response = await voiceApi.joinRoom(roomId);
      type JoinPayload = { token?: string; wsUrl?: string; liveKitRoomId?: string; room?: { liveKitRoomId?: string }; data?: JoinPayload };
      const raw = response.data as JoinPayload | undefined;

      let joinData: JoinPayload | undefined = raw?.data ?? raw;
      if (joinData?.data && !joinData?.token) {
        joinData = joinData.data;
      }

      const token = joinData?.token;
      const wsUrl = joinData?.wsUrl;
      const liveKitRoomId =
        joinData?.room?.liveKitRoomId ?? joinData?.liveKitRoomId ?? roomId;

      if (!token) {
        console.error("❌ LiveKit token missing:", { response: raw, joinData });
        throw new Error("LiveKit token was not returned by the server.");
      }

      if (typeof token === "string" && token.startsWith("mock-")) {
        throw new Error(
          "Voice service is currently unavailable. Please try again later.",
        );
      }

      return {
        token,
        wsUrl,
        liveKitRoomId,
        room: joinData?.room,
      };
    },

    onSuccess: (_data, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
    },

    onError: (error: ApiError) => {
      console.error("❌ Join voice room error:", error);
      toast.error(
        error.response?.data?.message || error.message || tr("Failed to join room"),
      );
    },
  });
};

export const useRefreshToken = () => {
  return useMutation({
    mutationFn: async (roomId: string) => {
      const response = await voiceApi.refreshToken(roomId);
      return response.data;
    },
    onSuccess: () => {},
    onError: (error: ApiError) => {
      console.error("❌ Token refresh failed:", error);
      toast.error(tr("Failed to refresh voice connection"));
    },
  });
};

export const useLeaveVoiceRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      await voiceApi.leaveRoom(roomId);
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      queryClient.invalidateQueries({ queryKey: ["voice-rooms", "active"] });
      queryClient.invalidateQueries({ queryKey: ["voice-rooms", "all"] });
      queryClient.refetchQueries({ queryKey: ["voice-rooms"] });
      toast.success(tr("👋 Left room"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to leave room"));
    },
  });
};

export const useEndVoiceRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      await voiceApi.endRoom(roomId);
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      queryClient.refetchQueries({ queryKey: ["voice-rooms"] });
      toast.success(tr("📢 Room ended"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to end room"));
    },
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      userId,
      role,
    }: {
      roomId: string;
      userId: string;
      role: string;
    }) => {
      const response = await voiceApi.updateRole(roomId, userId, role);
      return response.data;
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      toast.success(tr("Role updated"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to update role"));
    },
  });
};

export const useAddToStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      userId,
    }: {
      roomId: string;
      userId: string;
    }) => {
      const response = await voiceApi.addToStage(roomId, userId);
      return response.data;
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      toast.success(tr("🎤 Added to stage"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to add to stage"));
    },
  });
};

export const useRemoveFromStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      userId,
    }: {
      roomId: string;
      userId: string;
    }) => {
      const response = await voiceApi.removeFromStage(roomId, userId);
      return response.data;
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      toast.success(tr("Removed from stage"));
    },
    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message || tr("Failed to remove from stage"),
      );
    },
  });
};

export const useStartRecording = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const response = await voiceApi.startRecording(roomId);
      return response.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      toast.success(tr("🎙️ Recording started"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to start recording"));
    },
  });
};

export const useStopRecording = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const response = await voiceApi.stopRecording(roomId);
      return response.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      queryClient.invalidateQueries({ queryKey: ["voice-recordings", roomId] });
      toast.success(tr("⏹️ Recording stopped"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to stop recording"));
    },
  });
};

export const useSendVoiceMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      content,
      type,
      mediaUrl,
      fileUrl,
      replyToId,
    }: {
      roomId: string;
      content: string;
      type?: string;
      mediaUrl?: string;
      fileUrl?: string;
      replyToId?: string;
    }) => {
      const response = await voiceApi.sendRoomMessage(roomId, {
        content,
        type,
        mediaUrl,
        fileUrl,
        replyToId,
      });
      return response.data;
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: ["voice-messages", roomId] });
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to send message"));
    },
  });
};

export const useDeleteVoiceMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      messageId,
    }: {
      roomId: string;
      messageId: string;
    }) => {
      await voiceApi.deleteRoomMessage(roomId, messageId);
    },
    onMutate: async ({ roomId, messageId }) => {
      await queryClient.cancelQueries({ queryKey: ["voice-messages", roomId] });
      const previous = queryClient.getQueryData<VoiceMessage[]>([
        "voice-messages",
        roomId,
      ]);
      queryClient.setQueryData<VoiceMessage[]>(
        ["voice-messages", roomId],
        (old) =>
          old?.map((m) =>
            m.id === messageId
              ? { ...m, isDeleted: true, isPinned: false, content: "" }
              : m,
          ),
      );
      return { previous };
    },
    onError: (_err, { roomId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["voice-messages", roomId], context.previous);
      }
      toast.error(tr("Failed to delete message"));
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: ["voice-messages", roomId] });
    },
  });
};

export const useEditVoiceMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      messageId,
      content,
    }: {
      roomId: string;
      messageId: string;
      content: string;
    }) => {
      const response = await voiceApi.editRoomMessage(
        roomId,
        messageId,
        content,
      );
      return response.data;
    },
    onMutate: async ({ roomId, messageId, content }) => {
      await queryClient.cancelQueries({ queryKey: ["voice-messages", roomId] });
      const previous = queryClient.getQueryData<VoiceMessage[]>([
        "voice-messages",
        roomId,
      ]);
      queryClient.setQueryData<VoiceMessage[]>(
        ["voice-messages", roomId],
        (old) =>
          old?.map((m) =>
            m.id === messageId ? { ...m, content, isEdited: true } : m,
          ),
      );
      return { previous };
    },
    onError: (_err, { roomId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["voice-messages", roomId], context.previous);
      }
      toast.error(tr("Failed to edit message"));
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: ["voice-messages", roomId] });
    },
  });
};

// ---- FIXED: react mutation takes userId, toggles optimistically ----
export const useReactToVoiceMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      messageId,
      emoji,
    }: {
      roomId: string;
      messageId: string;
      emoji: string;
      userId?: string;
    }) => {
      const response = await voiceApi.reactToRoomMessage(
        roomId,
        messageId,
        emoji,
      );
      return response.data;
    },
    onMutate: async ({ roomId, messageId, emoji, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["voice-messages", roomId] });
      const previous = queryClient.getQueryData<VoiceMessage[]>([
        "voice-messages",
        roomId,
      ]);
      queryClient.setQueryData<VoiceMessage[]>(
        ["voice-messages", roomId],
        (old) =>
          old?.map((m) => {
            if (m.id !== messageId) return m;
            const reactions = { ...(m.reactions || {}) };
            const users = new Set(reactions[emoji] || []);
            if (userId) {
              if (users.has(userId)) users.delete(userId);
              else users.add(userId);
            }
            if (users.size > 0) reactions[emoji] = Array.from(users);
            else delete reactions[emoji];
            return { ...m, reactions };
          }),
      );
      return { previous };
    },
    onError: (_err, { roomId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["voice-messages", roomId], context.previous);
      }
      toast.error(tr("Failed to react"));
    },
    onSuccess: (data: { data?: { reactions?: Record<string, string[]> }; reactions?: Record<string, string[]> } | undefined, { roomId, messageId }) => {
      // The server answers { success, data: { messageId, reactions } } — the same map it broadcasts
      const reactions: Record<string, string[]> | undefined =
        data?.data?.reactions ?? data?.reactions;
      if (reactions) {
        queryClient.setQueryData<VoiceMessage[]>(
          ["voice-messages", roomId],
          (old) =>
            old?.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        );
      }
    },
  });
};

export const usePinVoiceMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      messageId,
      pinned,
    }: {
      roomId: string;
      messageId: string;
      pinned: boolean;
    }) => {
      const response = await voiceApi.pinRoomMessage(roomId, messageId, pinned);
      return response.data;
    },
    onMutate: async ({ roomId, messageId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ["voice-messages", roomId] });
      const previous = queryClient.getQueryData<VoiceMessage[]>([
        "voice-messages",
        roomId,
      ]);
      queryClient.setQueryData<VoiceMessage[]>(
        ["voice-messages", roomId],
        (old) =>
          old?.map((m) =>
            m.id === messageId ? { ...m, isPinned: pinned } : m,
          ),
      );
      return { previous };
    },
    onError: (_err, { roomId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["voice-messages", roomId], context.previous);
      }
      toast.error(tr("Failed to pin message"));
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: ["voice-messages", roomId] });
    },
  });
};

export const usePromoteHost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      userId,
    }: {
      roomId: string;
      userId: string;
    }) => {
      const response = await voiceApi.promoteHost(roomId, userId);
      return response.data;
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      toast.success(tr("👑 Host transferred successfully!"));
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message || tr("Failed to transfer host"));
    },
  });
};

export const useMuteParticipant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      userId,
    }: {
      roomId: string;
      userId: string;
    }) => {
      const response = await voiceApi.muteParticipant(roomId, userId);
      return response.data;
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      toast.success(tr("🔇 Participant muted"));
    },
    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message || tr("Failed to mute participant"),
      );
    },
  });
};

export const useUnmuteParticipant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      userId,
    }: {
      roomId: string;
      userId: string;
    }) => {
      const response = await voiceApi.unmuteParticipant(roomId, userId);
      return response.data;
    },
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      toast.success(tr("🔊 Participant unmuted"));
    },
    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message || tr("Failed to unmute participant"),
      );
    },
  });
};

// ---------- Voice Socket Hook ----------

export const useVoiceSocket = (roomId: string, userId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [participants, setParticipants] = useState<RoomSocketParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [hostId, setHostId] = useState<string | null>(null);
  // True once the host removed me (kicked and banned); the room view leaves
  const [wasRemoved, setWasRemoved] = useState(false);
  const queryClient = useQueryClient();
  const reconnectAttemptsRef = useRef(0);

  const socketUrl = SOCKET_URL;

  useEffect(() => {
    if (!roomId || !userId) return;

    const s = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
      reconnectionDelay: 1000,
      // Re-evaluated before every (re)connect: an expired access cookie is
      // refreshed first instead of the server turning the socket away.
      auth: (cb) => {
        void ensureFreshSession().finally(() => cb({}));
      },
    });

    s.on("connect", () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      s.emit("voice:join", { roomId });
    });

    s.on("disconnect", (reason) => {
      setIsConnected(false);
      // The server closed the socket (expired access token, or a logout /
      // revoked login). Socket.IO does not retry that by itself: come back
      // only if the session is still valid.
      if (reason === "io server disconnect") {
        setTimeout(() => {
          void ensureFreshSession().then((signedIn) => {
            if (signedIn && s.disconnected && !s.active) s.connect();
          });
        }, 1000);
      }
    });

    s.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      reconnectAttemptsRef.current += 1;
      if (reconnectAttemptsRef.current >= 5) {
        toast.error(
          tr("Failed to connect to voice server after multiple attempts"),
        );
      }
    });

    s.on(
      "voice:participants",
      (data: { participants: RoomSocketParticipant[]; participantIds: string[] }) => {
        setParticipants(data.participants || []);
      },
    );

    s.on(
      "participant:joined",
      (data: { userId: string; user?: RoomSocketParticipant["user"]; role?: string; raisedHand?: boolean }) => {
        setParticipants((prev) => {
          if (prev.some((p) => p.userId === data.userId)) return prev;
          return [
            ...prev,
            {
              userId: data.userId,
              user: data.user,
              role: data.role,
              raisedHand: data.raisedHand ?? false,
            },
          ];
        });
      },
    );

    // Stage moves: invited up, moved to the audience, made moderator, etc.
    s.on(
      "voice:role-changed",
      (data: { userId: string; role: string; canSpeak: boolean; by?: string }) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === data.userId
              ? { ...p, role: data.role, raisedHand: data.role === "LISTENER" ? p.raisedHand : false }
              : p,
          ),
        );
        if (data.userId === userId && data.by !== userId) {
          if (data.role === "LISTENER") toast.info(tr("You were moved to the audience"));
          else if (data.canSpeak) toast.success(tr("🎤 You're on stage! Tap the mic to talk"));
        }
      },
    );

    s.on("participant:left", (data: { userId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
    });

    // Someone's connection dropped (server waits ~15s before counting it as leaving)
    s.on(
      "voice:presence",
      (data: { userId: string; status: "reconnecting" | "online" }) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === data.userId
              ? { ...p, isReconnecting: data.status === "reconnecting" }
              : p,
          ),
        );
      },
    );

    s.on("voice:host", (data: { hostId: string }) => {
      setHostId(data.hostId);
    });

    s.on("voice:host-changed", (data: { newHostId: string }) => {
      setHostId(data.newHostId);
      toast.info(tr("👑 Host has changed"));
    });

    // The server sends this twice: to the whole room as { userId, kickedBy } (so
    // everyone can drop that person), and to the kicked person's own sockets as
    // { roomId, reason }. Only the kicked person may leave; for everyone else
    // it just removes one name from the list.
    let removedHandled = false;
    s.on(
      "voice:kicked",
      (data: { roomId?: string; reason?: string; userId?: string }) => {
        if (data.userId && data.userId !== userId) {
          setParticipants((prev) =>
            prev.filter((p) => (p.userId ?? p.user?.id) !== data.userId),
          );
          return;
        }
        if (removedHandled) return;
        removedHandled = true;
        toast.error(
          data.reason ||
            tr("You were removed from this room by the host and can't rejoin."),
        );
        setWasRemoved(true);
        s.disconnect();
      },
    );

    s.on("voice:chat", (message: VoiceMessage & { user?: { name?: string; avatarUrl?: string } }) => {
      const processedMessage = {
        ...message,
        sender: {
          id: message.senderId,
          name: message.sender?.name || message.user?.name || "Unknown User",
          avatarUrl: message.sender?.avatarUrl || message.user?.avatarUrl,
        },
      };

      queryClient.setQueryData<VoiceMessage[]>(
        ["voice-messages", roomId],
        (old) => {
          if (!old) return [processedMessage];
          if (old.some((m) => m.id === processedMessage.id)) return old;
          return [...old, processedMessage];
        },
      );
    });

    s.on("voice:message-history", (messages: VoiceMessage[]) => {
      queryClient.setQueryData(["voice-messages", roomId], messages);
    });

    s.on("voice:message-deleted", (data: { messageId: string }) => {
      queryClient.setQueryData<VoiceMessage[]>(
        ["voice-messages", roomId],
        (old) => {
          if (!old) return old;
          return old.map((m) =>
            m.id === data.messageId
              ? {
                  ...m,
                  isDeleted: true,
                  isPinned: false,
                  content: "",
                  mediaUrl: null,
                  fileUrl: null,
                  reactions: {},
                }
              : m,
          );
        },
      );
    });

    s.on(
      "voice:message-edited",
      (data: { messageId: string; content: string }) => {
        queryClient.setQueryData<VoiceMessage[]>(
          ["voice-messages", roomId],
          (old) => {
            if (!old) return old;
            return old.map((m) =>
              m.id === data.messageId
                ? { ...m, content: data.content, isEdited: true }
                : m,
            );
          },
        );
      },
    );

    s.on(
      "voice:message-reaction",
      (data: { messageId: string; reactions: Record<string, string[]> }) => {
        queryClient.setQueryData<VoiceMessage[]>(
          ["voice-messages", roomId],
          (old) => {
            if (!old) return old;
            return old.map((m) => {
              if (m.id !== data.messageId) return m;
              const incoming = data.reactions || {};
              const incomingEmpty = Object.keys(incoming).length === 0;
              const localNonEmpty =
                m.reactions && Object.keys(m.reactions).length > 0;
              if (incomingEmpty && localNonEmpty) return m;
              return { ...m, reactions: incoming };
            });
          },
        );
      },
    );

    s.on(
      "voice:message-pinned",
      (data: { messageId: string; pinned: boolean }) => {
        queryClient.setQueryData<VoiceMessage[]>(
          ["voice-messages", roomId],
          (old) => {
            if (!old) return old;
            return old.map((m) =>
              m.id === data.messageId ? { ...m, isPinned: data.pinned } : m,
            );
          },
        );
      },
    );

    s.on("voice:typing-start", (data: { userId: string }) => {
      if (data.userId !== userId) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));
      }
    });

    s.on("voice:typing-stop", (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    });

    s.on("voice:muted", (data: { userId?: string }) => {
      if (data?.userId && data.userId === userId) {
        toast.warning(tr("🔇 The host muted you. Only they can unmute you."));
      } else {
        toast.info(tr("🔇 A participant was muted"));
      }
      if (data?.userId) {
        setParticipants((prev) =>
          prev.map((p) =>
            (p.userId ?? p.user?.id) === data.userId
              ? { ...p, isMuted: true, mutedByHost: true }
              : p,
          ),
        );
      }
    });

    s.on("voice:unmuted", (data: { userId?: string }) => {
      if (data?.userId && data.userId === userId) {
        toast.success(tr("🔊 The host unmuted you. You can speak again."));
      } else {
        toast.info(tr("🔊 A participant was unmuted"));
      }
      if (data?.userId) {
        setParticipants((prev) =>
          prev.map((p) =>
            (p.userId ?? p.user?.id) === data.userId
              ? { ...p, isMuted: false, mutedByHost: false }
              : p,
          ),
        );
      }
    });

    s.on("voice:hand-raised", (data: { userId: string; raised: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === data.userId ? { ...p, raisedHand: data.raised } : p,
        ),
      );
    });

    s.on(
      "voice:speaking-status",
      (data: { userId: string; isSpeaking: boolean }) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === data.userId
              ? { ...p, isSpeaking: data.isSpeaking }
              : p,
          ),
        );
      },
    );

    s.on("voice:error", (err: { message: string }) => {
      console.error("Voice gateway error:", err.message);
      toast.error(err.message);
    });

    setSocket(s);

    return () => {
      if (s && s.connected) {
        s.emit("voice:leave", { roomId });
        s.disconnect();
      }
      s.offAny();
    };
  }, [roomId, userId, queryClient, socketUrl]);

  const sendChatMessage = useCallback(
    (message: {
      content: string;
      type?: string;
      mediaUrl?: string;
      fileUrl?: string;
      replyToId?: string;
      clientId?: string;
    }) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:chat", { roomId, ...message });
    },
    [socket, isConnected, roomId],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !isConnected) return;
      socket.emit(isTyping ? "voice:typing-start" : "voice:typing-stop", {
        roomId,
      });
    },
    [socket, isConnected, roomId],
  );

  const raiseHand = useCallback(
    (raise: boolean) => {
      if (!socket || !isConnected) return;
      socket.emit("voice:raise-hand", { roomId, raise });
    },
    [socket, isConnected, roomId],
  );

  const kickUser = useCallback(
    (userIdToKick: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:kick", { roomId, userId: userIdToKick });
    },
    [socket, isConnected, roomId],
  );

  const muteUser = useCallback(
    (userIdToMute: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:mute-user", { roomId, userId: userIdToMute });
    },
    [socket, isConnected, roomId],
  );

  const unmuteUser = useCallback(
    (userIdToUnmute: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:unmute-user", { roomId, userId: userIdToUnmute });
    },
    [socket, isConnected, roomId],
  );

  const promoteUser = useCallback(
    (userIdToPromote: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:promote", { roomId, userId: userIdToPromote });
    },
    [socket, isConnected, roomId],
  );

  const demoteUser = useCallback(
    (userIdToDemote: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:demote", { roomId, userId: userIdToDemote });
    },
    [socket, isConnected, roomId],
  );

  const promoteHost = useCallback(
    (userIdToPromote: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:promote-host", { roomId, userId: userIdToPromote });
    },
    [socket, isConnected, roomId],
  );

  /** Host/moderator brings someone up to speak (grants their mic) */
  const inviteToStage = useCallback(
    (targetUserId: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:promote-speaker", { roomId, userId: targetUserId });
    },
    [socket, isConnected, roomId],
  );

  /** Back to listening — yourself (leave stage) or, for hosts, someone else */
  const moveToAudience = useCallback(
    (targetUserId: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:move-to-audience", { roomId, userId: targetUserId });
    },
    [socket, isConnected, roomId],
  );

  const pinMessage = useCallback(
    (messageId: string, pinned: boolean) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:pin-message", { roomId, messageId, pin: pinned });
    },
    [socket, isConnected, roomId],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:delete-message", { roomId, messageId });
    },
    [socket, isConnected, roomId],
  );

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:edit-message", { roomId, messageId, content });
    },
    [socket, isConnected, roomId],
  );

  const reactMessage = useCallback(
    (messageId: string, emoji: string) => {
      if (!socket || !isConnected) {
        toast.error(tr("Not connected to voice server"));
        return;
      }
      socket.emit("voice:react-message", { roomId, messageId, emoji });
    },
    [socket, isConnected, roomId],
  );

  const muteSelf = useCallback(
    (muted: boolean) => {
      if (!socket || !isConnected) return;
      socket.emit("voice:mute-self", { roomId, muted });
    },
    [socket, isConnected, roomId],
  );

  const fetchMessages = useCallback(
    (limit?: number, before?: string) => {
      if (!socket || !isConnected) return;
      socket.emit("voice:fetch-messages", { roomId, limit, before });
    },
    [socket, isConnected, roomId],
  );

  // LiveKit reports active speakers many times a second; only send changes, and send
  // them as volatile so nothing piles up (and floods the room) while we're offline.
  const lastSpeakingRef = useRef(false);
  const speakingOffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const broadcastSpeaking = useCallback(
    (isSpeaking: boolean) => {
      if (!socket || !isConnected) return;

      if (speakingOffTimerRef.current) {
        clearTimeout(speakingOffTimerRef.current);
        speakingOffTimerRef.current = null;
      }
      if (isSpeaking) {
        // No "stopped" event comes from LiveKit for us, so infer it from silence
        speakingOffTimerRef.current = setTimeout(() => {
          speakingOffTimerRef.current = null;
          lastSpeakingRef.current = false;
          socket.volatile.emit("voice:speaking", { roomId, isSpeaking: false });
        }, 1500);
      }

      if (lastSpeakingRef.current === isSpeaking) return;
      lastSpeakingRef.current = isSpeaking;
      socket.volatile.emit("voice:speaking", { roomId, isSpeaking });
    },
    [socket, isConnected, roomId],
  );

  useEffect(
    () => () => {
      if (speakingOffTimerRef.current) clearTimeout(speakingOffTimerRef.current);
    },
    [],
  );

    const sendStageReaction = useCallback(
    (emoji: string) => {
      if (!socket || !isConnected) return;
      const clean = String(emoji).slice(0, 8).trim();
      if (!clean) return;
      socket.emit("voice:stage-reaction", { roomId, emoji: clean });
    },
    [socket, isConnected, roomId],
  );

  return {
    socket,
    isConnected,
    participants,
    typingUsers,
    hostId,
    wasRemoved,
    sendChatMessage,
    sendTyping,
    raiseHand,
    kickUser,
    muteUser,
    unmuteUser,
    promoteUser,
    demoteUser,
    pinMessage,
    deleteMessage,
    editMessage,
    reactMessage,
    muteSelf,
    fetchMessages,
    promoteHost,
    inviteToStage,
    moveToAudience,
    broadcastSpeaking,
    sendStageReaction,
  };
};

// ---------- LiveKit Room Hook ----------

export type LiveKitParticipantVoiceState = {
  userId: string;
  isSpeaking: boolean;
  audioLevel: number;
  isMuted: boolean;
  hasAudioTrack: boolean;
  lastSpeakingAt: number;
};

type LiveKitRoomOptions = {
  onTrackSubscribed?: (track: RemoteTrack) => void;
  onAudioLevel?: (level: number) => void;
  onParticipantVoiceStateChanged?: (
    states: Record<string, LiveKitParticipantVoiceState>,
  ) => void;
  onSpeakingStatusChange?: (userId: string, isSpeaking: boolean) => void;
  onConnectionQuality?: (quality: string) => void;
};

export const useLiveKitRoom = (
  roomName: string,
  token: string | null,
  options?: LiveKitRoomOptions,
) => {
  // The callbacks change on every render; read the latest ones without reconnecting the room
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const [room, setRoom] = useState<Room | null>(null);
  const [localTrack, setLocalTrack] = useState<LocalAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  /** False for audience members in stage rooms until the host invites them up */
  const [canPublish, setCanPublish] = useState(true);
  const [remoteTracks, setRemoteTracks] = useState<Record<string, boolean>>({});
  const [speakingParticipants, setSpeakingParticipants] = useState<
    Record<string, boolean>
  >({});
  const [remoteAudioLevels, setRemoteAudioLevels] = useState<
    Record<string, number>
  >({});
  const [participants, setParticipants] = useState<
    { identity: string; name: string }[]
  >([]);
  const [isConnected, setIsConnected] = useState(false);
  // The server hands out "mock-" tokens when LiveKit is not configured
  const isMockMode = Boolean(token?.startsWith("mock-"));
  const [audioLevel, setAudioLevel] = useState(0);
  const [participantVoiceStates, setParticipantVoiceStates] = useState<
    Record<string, LiveKitParticipantVoiceState>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const liveKitUrl = LIVEKIT_URL;

  const isMountedRef = useRef(true);
  const connectionAttemptRef = useRef(0);
  const roomRef = useRef<Room | null>(null);

  /** "reconnecting" covers both LiveKit's own resume and our full re-join */
  const [connectionState, setConnectionState] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "disconnected"
  >("idle");
  /** Bumping this re-runs the connect effect (full re-join with the same token) */
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const rejoinAttemptsRef = useRef(0);
  const rejoinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_REJOIN_ATTEMPTS = 5;

  const reconnectNow = useCallback(() => {
    if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
    rejoinTimerRef.current = null;
    rejoinAttemptsRef.current = 0;
    setError(null);
    setConnectionState("reconnecting");
    setReconnectNonce((n) => n + 1);
  }, []);

  // Coming back online: retry straight away instead of waiting for the back-off timer
  useEffect(() => {
    const onOnline = () => {
      if (connectionState === "reconnecting" || connectionState === "disconnected") {
        reconnectNow();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [connectionState, reconnectNow]);

  const toggleMute = useCallback(async () => {
    if (!room) {
      console.warn("⚠️ Cannot toggle mute: LiveKit room is not connected");
      return false;
    }

    if (room.localParticipant.permissions?.canPublish === false) {
      toast.info(tr("You're in the audience — raise your hand to speak"));
      return true;
    }

    try {
      const nextMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
      return nextMuted;
    } catch (error) {
      console.error("❌ Failed to toggle microphone:", error);
      return isMuted;
    }
  }, [room, isMuted]);

  useEffect(() => {
    isMountedRef.current = true;
    const attemptId = ++connectionAttemptRef.current;

    // Nothing to connect to: the previous run's cleanup already reset the connection state
    if (!token || !roomName) return;

    if (token.startsWith("mock-")) return;

    let livekitRoom: Room | null = null;
    let localLevelInterval: ReturnType<typeof setInterval> | null = null;
    /**
     * One <audio> element per remote audio track, keyed by track. A removed element keeps playing
     * (audio plays without being in the page), so every element must be silenced before it is
     * dropped — otherwise the same voice plays twice a few ms apart and sounds like a long echo.
     */
    const attachedAudio = new Map<
      string,
      { identity: string; track: RemoteAudioTrack; element: HTMLMediaElement }
    >();

    const silenceElement = (element: HTMLMediaElement) => {
      try {
        element.pause();
        element.srcObject = null;
        element.remove();
      } catch {
        // ignore
      }
    };

    const trackKey = (track: RemoteAudioTrack, identity: string) =>
      track.sid ?? `${identity}:${track.mediaStreamTrack?.id ?? "audio"}`;

    const releaseAudio = (key: string) => {
      const entry = attachedAudio.get(key);
      if (!entry) return;
      try {
        // Detaches (and silences) every element LiveKit has handed out for this track
        entry.track.detach().forEach((el) => silenceElement(el));
      } catch {
        // ignore
      }
      silenceElement(entry.element);
      attachedAudio.delete(key);
    };

    const attachRemoteAudio = (
      track: RemoteAudioTrack,
      participantIdentity: string,
    ) => {
      try {
        const key = trackKey(track, participantIdentity);
        const current = attachedAudio.get(key);
        // Already playing this exact track (TrackSubscribed + the initial scan both fire)
        if (current && current.track === track && current.element.isConnected) {
          return;
        }
        releaseAudio(key);

        const audioElement = track.attach();
        audioElement.autoplay = true;
        audioElement.setAttribute("data-livekit-audio", participantIdentity);
        audioElement.setAttribute("data-livekit-track", key);
        audioElement.style.display = "none";
        document.body.appendChild(audioElement);
        attachedAudio.set(key, {
          identity: participantIdentity,
          track,
          element: audioElement,
        });
      } catch (error) {
        console.error("❌ Failed to attach remote audio:", error);
      }
    };

    const detachRemoteAudio = (track: RemoteTrack, participant: Participant) => {
      if (track.kind !== Track.Kind.Audio) return;
      const identity = participant.identity;

      releaseAudio(trackKey(track as RemoteAudioTrack, identity));
      try {
        track.detach().forEach((element: HTMLMediaElement) => silenceElement(element));
      } catch (error) {
        console.warn("⚠️ Failed to detach audio:", error);
      }

      // Only clear the participant's "has audio" state when none of their audio is left
      const stillHasAudio = Array.from(attachedAudio.values()).some(
        (entry) => entry.identity === identity,
      );
      if (stillHasAudio) return;

      setRemoteTracks((previous) => {
        const next = { ...previous };
        delete next[identity];
        return next;
      });

      setSpeakingParticipants((previous) => {
        const next = { ...previous };
        delete next[identity];
        return next;
      });

      setRemoteAudioLevels((previous) => {
        const next = { ...previous };
        delete next[identity];
        return next;
      });
    };

    const connect = async () => {
      if (attemptId !== connectionAttemptRef.current || !isMountedRef.current) {
        return;
      }

      try {
        setIsConnecting(true);

        livekitRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          // Echo cancellation must stay on and the mic must be mono: the browser's echo canceller
          // is tuned for a single voice channel, and stereo capture lets room echo through
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          // Speech preset (mono, ~24 kbps) + silence suppression: cleaner than the default "music" preset
          publishDefaults: {
            audioPreset: AudioPresets.speech,
            dtx: true,
          },
        });

        roomRef.current = livekitRoom;
        setRoom(livekitRoom);

        livekitRoom.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _publication: RemoteTrackPublication, participant: Participant) => {
            if (track.kind !== Track.Kind.Audio) return;
            attachRemoteAudio(track as RemoteAudioTrack, participant.identity);
          },
        );

        livekitRoom.on(
          RoomEvent.TrackUnsubscribed,
          (track: RemoteTrack, _publication: RemoteTrackPublication, participant: Participant) => {
            detachRemoteAudio(track, participant);
          },
        );

        livekitRoom.on(
          RoomEvent.ParticipantConnected,
          (participant: Participant) => {
            setParticipants((previous) => {
              if (previous.some((p) => p.identity === participant.identity))
                return previous;
              return [
                ...previous,
                {
                  identity: participant.identity,
                  name: participant.name || participant.identity,
                },
              ];
            });
          },
        );

        livekitRoom.on(
          RoomEvent.ParticipantDisconnected,
          (participant: Participant) => {
            const identity = participant.identity;

            setParticipants((previous) =>
              previous.filter((p) => p.identity !== identity),
            );
            setRemoteTracks((previous) => {
              const next = { ...previous };
              delete next[identity];
              return next;
            });
            setSpeakingParticipants((previous) => {
              const next = { ...previous };
              delete next[identity];
              return next;
            });
            setRemoteAudioLevels((previous) => {
              const next = { ...previous };
              delete next[identity];
              return next;
            });
            setParticipantVoiceStates((previous) => {
              const next = { ...previous };
              delete next[identity];
              return next;
            });
          },
        );

        livekitRoom.on(
          RoomEvent.ActiveSpeakersChanged,
          (speakers: Participant[]) => {
            const nextSpeaking: Record<string, boolean> = {};
            const nextLevels: Record<string, number> = {};

            speakers.forEach((participant) => {
              if (participant.isLocal) return;
              nextSpeaking[participant.identity] = true;
              const level = Number(participant.audioLevel ?? 0);
              nextLevels[participant.identity] = Math.max(
                0,
                Math.min(1, level),
              );
            });

            setSpeakingParticipants(nextSpeaking);
            setRemoteAudioLevels(nextLevels);

            setParticipantVoiceStates((previous) => {
              const next = { ...previous };

              Object.keys(next).forEach((identity) => {
                next[identity] = { ...next[identity], isSpeaking: false };
              });

              speakers.forEach((participant) => {
                const identity = participant.identity;
                const level = Number(participant.audioLevel ?? 0);
                next[identity] = {
                  userId: identity,
                  isSpeaking: true,
                  audioLevel: level,
                  isMuted: false,
                  hasAudioTrack: true,
                  lastSpeakingAt: Date.now(),
                };
                optionsRef.current?.onSpeakingStatusChange?.(identity, true);
              });

              return next;
            });
          },
        );

        // Connection health: LiveKit first tries to resume by itself
        livekitRoom.on(RoomEvent.Reconnecting, () => setConnectionState("reconnecting"));
        livekitRoom.on(RoomEvent.Reconnected, () => {
          setConnectionState("connected");
          rejoinAttemptsRef.current = 0;
        });
        // ...and if it gives up, we re-join from scratch with back-off
        livekitRoom.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          if (!isMountedRef.current || attemptId !== connectionAttemptRef.current) return;
          setIsConnected(false);

          if (reason === DisconnectReason.CLIENT_INITIATED) return;
          if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
            setConnectionState("disconnected");
            setError("You joined this room from another tab or device.");
            return;
          }
          if (
            reason === DisconnectReason.PARTICIPANT_REMOVED ||
            reason === DisconnectReason.ROOM_DELETED
          ) {
            setConnectionState("disconnected");
            return;
          }
          if (rejoinAttemptsRef.current >= MAX_REJOIN_ATTEMPTS) {
            setConnectionState("disconnected");
            setError("Lost connection to the voice server.");
            return;
          }

          setConnectionState("reconnecting");
          const delay = Math.min(30_000, 2_000 * 2 ** rejoinAttemptsRef.current);
          rejoinAttemptsRef.current += 1;
          rejoinTimerRef.current = setTimeout(() => {
            rejoinTimerRef.current = null;
            if (isMountedRef.current) setReconnectNonce((n) => n + 1);
          }, delay);
        });

        // Keep localTrack in sync when the mic is (re)published, e.g. after a stage promotion
        livekitRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
          if (
            publication.source === Track.Source.Microphone &&
            publication.track?.kind === Track.Kind.Audio
          ) {
            setLocalTrack(publication.track as LocalAudioTrack);
          }
        });
        livekitRoom.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.source === Track.Source.Microphone) setLocalTrack(null);
        });

        // The host invited us on stage or moved us back to the audience
        livekitRoom.on(
          RoomEvent.ParticipantPermissionsChanged,
          (_previous: unknown, participant: Participant) => {
            if (!participant.isLocal) return;
            const allowed = participant.permissions?.canPublish ?? false;
            setCanPublish(allowed);
            if (!allowed) {
              // LiveKit has already unpublished the mic
              setIsMuted(true);
              setLocalTrack(null);
            }
            // When granted we stay muted until the user taps the mic, like Clubhouse
          },
        );

        livekitRoom.on(
          RoomEvent.ConnectionQualityChanged,
          (quality: ConnectionQuality, participant: Participant) => {
            if (participant.isLocal) optionsRef.current?.onConnectionQuality?.(quality);
          },
        );

        // livekit-client has no per-frame audio level event; poll the local mic level
        localLevelInterval = setInterval(() => {
          const local = livekitRoom?.localParticipant;
          const level = Math.max(0, Math.min(1, Number(local?.audioLevel ?? 0)));
          setAudioLevel(level);
          optionsRef.current?.onAudioLevel?.(level);
        }, 100);

        await livekitRoom.connect(liveKitUrl, token);

        if (
          !isMountedRef.current ||
          attemptId !== connectionAttemptRef.current
        ) {
          livekitRoom.disconnect();
          return;
        }

        setIsConnected(true);
        setError(null);
        setIsConnecting(false);
        setConnectionState("connected");
        rejoinAttemptsRef.current = 0;

        const initialParticipants = Array.from(
          livekitRoom.remoteParticipants.values(),
        ).map((participant) => ({
          identity: participant.identity,
          name: participant.name || participant.identity,
        }));
        setParticipants(initialParticipants);

        livekitRoom.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((publication) => {
            if (publication.kind === Track.Kind.Audio && publication.track) {
              attachRemoteAudio(
                publication.track as RemoteAudioTrack,
                participant.identity,
              );
            }
          });
        });

        // Stage-room audience joins listen-only; everyone else starts with the mic on
        const allowedToPublish =
          livekitRoom.localParticipant.permissions?.canPublish ?? true;
        setCanPublish(allowedToPublish);
        if (!allowedToPublish) {
          setIsMuted(true);
          return;
        }

        await livekitRoom.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);

        const microphonePublication =
          livekitRoom.localParticipant.getTrackPublication(
            Track.Source.Microphone,
          );
        const microphone = microphonePublication?.track;
        if (microphone && microphone.kind === Track.Kind.Audio) {
          setLocalTrack(microphone as LocalAudioTrack);
        }
      } catch (error) {
        if (
          !isMountedRef.current ||
          attemptId !== connectionAttemptRef.current
        ) {
          return;
        }

        setIsConnected(false);
        setIsConnecting(false);

        // A re-join that fails (e.g. still offline) keeps retrying with back-off
        if (rejoinAttemptsRef.current > 0 && rejoinAttemptsRef.current < MAX_REJOIN_ATTEMPTS) {
          setConnectionState("reconnecting");
          const delay = Math.min(30_000, 2_000 * 2 ** rejoinAttemptsRef.current);
          rejoinAttemptsRef.current += 1;
          rejoinTimerRef.current = setTimeout(() => {
            rejoinTimerRef.current = null;
            if (isMountedRef.current) setReconnectNonce((n) => n + 1);
          }, delay);
          return;
        }

        setConnectionState("disconnected");
        setError(
          error instanceof Error ? error.message : "LiveKit connection failed",
        );
      }
    };

    if (rejoinAttemptsRef.current === 0) setConnectionState("connecting");
    connect();

    return () => {
      isMountedRef.current = false;

      if (localLevelInterval) clearInterval(localLevelInterval);

      Array.from(attachedAudio.keys()).forEach(releaseAudio);
      // Anything left from an earlier room instance must not keep playing under the new one
      document
        .querySelectorAll<HTMLMediaElement>("[data-livekit-audio]")
        .forEach(silenceElement);

      if (livekitRoom) {
        try {
          livekitRoom.disconnect();
        } catch (error) {
          console.warn("LiveKit disconnect error:", error);
        }
      }

      setIsConnected(false);
      setIsConnecting(false);
      setError(null);
      setRoom(null);
      roomRef.current = null;
      setLocalTrack(null);
      setRemoteTracks({});
      setSpeakingParticipants({});
      setRemoteAudioLevels({});
      setParticipants([]);
      setParticipantVoiceStates({});
      setAudioLevel(0);
    };
  }, [token, roomName, liveKitUrl, reconnectNonce]);

  // Stop any pending re-join when the room changes or the hook unmounts
  useEffect(
    () => () => {
      if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
      rejoinTimerRef.current = null;
      rejoinAttemptsRef.current = 0;
    },
    [token, roomName],
  );

  return {
    room,
    localTrack,
    remoteTracks,
    participants,
    isConnected,
    isMockMode,
    audioLevel,
    isMuted,
    canPublish,
    connectionState,
    reconnectNow,
    toggleMute,
    error: isMockMode ? "LiveKit returned a mock token." : error,
    isConnecting,
    speakingParticipants,
    remoteAudioLevels,
    participantVoiceStates,
  };
};

// ---------- Recording Hook ----------

export const useVoiceRecording = (roomId: string) => {
  const startRecordingMutation = useStartRecording();
  const stopRecordingMutation = useStopRecording();

  const startRecording = useCallback(async () => {
    try {
      await startRecordingMutation.mutateAsync(roomId);
    } catch {
      // Error handled by mutation
    }
  }, [roomId, startRecordingMutation]);

  const stopRecording = useCallback(async () => {
    try {
      await stopRecordingMutation.mutateAsync(roomId);
    } catch {
      // Error handled by mutation
    }
  }, [roomId, stopRecordingMutation]);

  return {
    startRecording,
    stopRecording,
    isStarting: startRecordingMutation.isPending,
    isStopping: stopRecordingMutation.isPending,
  };
};
