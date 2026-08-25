// apps/web/src/hooks/useVoice.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api/client";
import { toast } from "sonner";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  Room,
  RoomEvent,
  Track,
  LocalAudioTrack,
  RemoteAudioTrack,
  Participant,
} from "livekit-client";

// ---------- Environment Variables ----------
// Use import.meta.env for Vite, fallback to process.env for Next.js
const getEnvVar = (key: string, fallback: string): string => {
  // Check if we're in a Vite environment
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const viteVar = import.meta.env[key];
    if (viteVar) return viteVar;
  }
  // Check if we're in a Next.js environment
  if (typeof process !== "undefined" && process.env) {
    const nextVar = process.env[key];
    if (nextVar) return nextVar;
  }
  return fallback;
};

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

  constructor(
    private readonly startThreshold = 0.055,
    private readonly stopThreshold = 0.03,
    private readonly minimumSpeechMs = 70,
    private readonly releaseMs = 260,
  ) {}

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

export function normalizeRealtimeVoiceParticipant(input: any) {
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
      Boolean(window.AudioContext || (window as any).webkitAudioContext),
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

export interface VoiceParticipant {
  id: string;
  userId: string;
  user: { id: string; name: string; avatarUrl?: string };
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
  replyToId?: string;
  replyTo?: VoiceMessage;
  createdAt: string;
  updatedAt: string;
}

// ---------- API ----------

export const voiceApi = {
  // Rooms
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
  updateRoom: (roomId: string, data: any) =>
    apiClient.put(`/voice/rooms/${roomId}`, data),
  endRoom: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/end`),

  // Participants - ✅ Updated to handle LiveKit token properly
  joinRoom: (roomId: string) =>
  apiClient.post<{
    success?: boolean;
    token?: string;
    wsUrl?: string;
    liveKitRoomId?: string;
    room?: {
      liveKitRoomId?: string;
    };
    data?: {
      token?: string;
      wsUrl?: string;
      liveKitRoomId?: string;
      room?: {
        liveKitRoomId?: string;
      };
    };
  }>(`/voice/rooms/${roomId}/join`),
  
  leaveRoom: (roomId: string) => apiClient.post(`/voice/rooms/${roomId}/leave`),
  getRoomParticipants: (roomId: string) =>
    apiClient.get(`/voice/rooms/${roomId}/participants`),
  updateRole: (roomId: string, userId: string, role: string) =>
    apiClient.put(`/voice/rooms/${roomId}/role/${userId}`, { role }),

  // Stage
  addToStage: (roomId: string, userId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/stage/add/${userId}`),
  removeFromStage: (roomId: string, userId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/stage/remove/${userId}`),

  // Recordings
  getRecordings: (roomId: string) =>
    apiClient.get(`/voice/rooms/${roomId}/recordings`),
  startRecording: (roomId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/recordings/start`),
  stopRecording: (roomId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/recordings/stop`),

  // Chat Messages
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

  // Status
  checkRoomStatus: (roomId: string) =>
    apiClient.get(`/voice/rooms/${roomId}/status`),
  getActiveParticipants: (roomId: string) =>
    apiClient.get(`/voice/rooms/${roomId}/active-participants`),

  // Host Promotion
  promoteHost: (roomId: string, userId: string) =>
    apiClient.post(`/voice/rooms/${roomId}/promote-host/${userId}`),
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
    staleTime: 0,
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
      toast.success(`🎉 Room "${data.name}" created!`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create room");
    },
  });
};

export const useJoinVoiceRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string) => {
      const response = await voiceApi.joinRoom(roomId);

      console.log("🎙️ JOIN ROOM RAW RESPONSE:", response.data);

      /**
       * Backend may return either:
       *
       * {
       *   token,
       *   wsUrl,
       *   room
       * }
       *
       * OR:
       *
       * {
       *   success: true,
       *   data: {
       *     token,
       *     wsUrl,
       *     room
       *   }
       * }
       */

      const raw = response.data as any;

      const joinData = raw?.data ?? raw;

      const token = joinData?.token;
      const wsUrl = joinData?.wsUrl;

      const liveKitRoomId =
        joinData?.room?.liveKitRoomId ?? joinData?.liveKitRoomId ?? roomId;

      if (!token) {
        console.error("❌ LiveKit token missing:", {
          response: raw,
          joinData,
        });

        throw new Error("LiveKit token was not returned by the server.");
      }

      if (typeof token === "string" && token.startsWith("mock-")) {
        throw new Error(
          "Voice service is currently unavailable. Please try again later.",
        );
      }

      console.log("✅ LiveKit join data received:", {
        hasToken: Boolean(token),
        tokenLength: typeof token === "string" ? token.length : 0,
        wsUrl,
        roomName: liveKitRoomId,
      });

      return {
        token,
        wsUrl,
        liveKitRoomId,
        room: joinData?.room,
      };
    },

    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({
        queryKey: ["voice-room", roomId],
      });

      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });

      queryClient.invalidateQueries({
        queryKey: ["voice-rooms"],
      });

      toast.success("🎧 Joined room!");
    },

    onError: (error: any) => {
      console.error("❌ Join voice room error:", error);

      toast.error(
        error.response?.data?.message || error.message || "Failed to join room",
      );
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
      toast.success("👋 Left room");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to leave room");
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
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      queryClient.refetchQueries({ queryKey: ["voice-rooms"] });
      toast.success("📢 Room ended");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to end room");
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
      toast.success("Role updated");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update role");
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
      toast.success("🎤 Added to stage");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to add to stage");
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
      toast.success("Removed from stage");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to remove from stage",
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
      toast.success("🎙️ Recording started");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to start recording");
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
      toast.success("⏹️ Recording stopped");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to stop recording");
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
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to send message");
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
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: ["voice-messages", roomId] });
      toast.success("🗑️ Message deleted");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete message");
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
      toast.success("👑 Host transferred successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to transfer host");
    },
  });
};

// ---------- Voice Socket Hook ----------

export const useVoiceSocket = (roomId: string, userId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [hostId, setHostId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const reconnectAttemptsRef = useRef(0);

  // Get socket URL with environment variable support
  const socketUrl = getEnvVar("VITE_SOCKET_URL", "http://localhost:3000/voice");

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
      reconnectionDelayMax: 5000,
    });

    s.on("connect", () => {
      console.log("✅ Connected to voice socket");
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      s.emit("voice:join", { roomId });
    });

    s.on("disconnect", (reason) => {
      console.log("❌ Disconnected from voice socket:", reason);
      setIsConnected(false);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      reconnectAttemptsRef.current += 1;
      if (reconnectAttemptsRef.current >= 5) {
        toast.error(
          "Failed to connect to voice server after multiple attempts",
        );
      }
    });

    // ---------- Participant Events ----------
    s.on(
      "voice:participants",
      (data: { participants: any[]; participantIds: string[] }) => {
        setParticipants(data.participants || []);
      },
    );

    s.on("participant:joined", (data: { userId: string; user?: any }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, user: data.user }];
      });
    });

    s.on("participant:left", (data: { userId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
    });

    s.on("voice:host", (data: { hostId: string }) => {
      setHostId(data.hostId);
    });

    s.on("voice:host-changed", (data: { newHostId: string }) => {
      setHostId(data.newHostId);
      toast.info("👑 Host has changed");
    });

    s.on("voice:kicked", (data: { roomId: string; reason: string }) => {
      toast.error(`You were kicked from the room: ${data.reason}`);
      s.disconnect();
    });

    // ---------- Chat Events ----------
    s.on("voice:chat", (message: any) => {
      queryClient.setQueryData<VoiceMessage[]>(
        ["voice-messages", roomId],
        (old) => {
          if (!old) return [message];
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
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
              ? { ...m, isDeleted: true, content: "This message was deleted" }
              : m,
          );
        },
      );
    });

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

    // ---------- Typing Events ----------
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

    // ---------- Mute Events ----------
    s.on("voice:muted", (data: { userId: string; mutedBy: string }) => {
      toast.info(`🔇 User ${data.userId} was muted`);
    });

    s.on("voice:unmuted", (data: { userId: string; unmutedBy: string }) => {
      toast.info(`🔊 User ${data.userId} was unmuted`);
    });

    s.on("voice:self-muted", (data: { userId: string; muted: boolean }) => {
      // Update local state
    });

    // ---------- Hand Raise Events ----------
    s.on("voice:hand-raised", (data: { userId: string; raised: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === data.userId ? { ...p, raisedHand: data.raised } : p,
        ),
      );
    });

    // ---------- Error Events ----------
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

  // ---------- Socket Actions ----------
  const sendChatMessage = useCallback(
    (message: {
      content: string;
      type?: string;
      mediaUrl?: string;
      fileUrl?: string;
      replyToId?: string;
    }) => {
      if (!socket || !isConnected) {
        toast.error("Not connected to voice server");
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
        toast.error("Not connected to voice server");
        return;
      }
      socket.emit("voice:kick", { roomId, userId: userIdToKick });
    },
    [socket, isConnected, roomId],
  );

  const muteUser = useCallback(
    (userIdToMute: string) => {
      if (!socket || !isConnected) {
        toast.error("Not connected to voice server");
        return;
      }
      socket.emit("voice:mute-user", { roomId, userId: userIdToMute });
    },
    [socket, isConnected, roomId],
  );

  const unmuteUser = useCallback(
    (userIdToUnmute: string) => {
      if (!socket || !isConnected) {
        toast.error("Not connected to voice server");
        return;
      }
      socket.emit("voice:unmute-user", { roomId, userId: userIdToUnmute });
    },
    [socket, isConnected, roomId],
  );

  const promoteUser = useCallback(
    (userIdToPromote: string) => {
      if (!socket || !isConnected) {
        toast.error("Not connected to voice server");
        return;
      }
      socket.emit("voice:promote", { roomId, userId: userIdToPromote });
    },
    [socket, isConnected, roomId],
  );

  const demoteUser = useCallback(
    (userIdToDemote: string) => {
      if (!socket || !isConnected) {
        toast.error("Not connected to voice server");
        return;
      }
      socket.emit("voice:demote", { roomId, userId: userIdToDemote });
    },
    [socket, isConnected, roomId],
  );

  const promoteHost = useCallback(
    (userIdToPromote: string) => {
      if (!socket || !isConnected) {
        toast.error("Not connected to voice server");
        return;
      }
      socket.emit("voice:promote-host", { roomId, userId: userIdToPromote });
    },
    [socket, isConnected, roomId],
  );

  const pinMessage = useCallback(
    (messageId: string, pinned: boolean) => {
      if (!socket || !isConnected) {
        toast.error("Not connected to voice server");
        return;
      }
      socket.emit("voice:pin-message", { roomId, messageId, pin: pinned });
    },
    [socket, isConnected, roomId],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!socket || !isConnected) {
        toast.error("Not connected to voice server");
        return;
      }
      socket.emit("voice:delete-message", { roomId, messageId });
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

  return {
    socket,
    isConnected,
    participants,
    typingUsers,
    hostId,
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
    muteSelf,
    fetchMessages,
    promoteHost,
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
  onTrackSubscribed?: (track: any) => void;
  onAudioLevel?: (level: number) => void;
  onParticipantVoiceStateChanged?: (
    states: Record<string, LiveKitParticipantVoiceState>,
  ) => void;
};

export const useLiveKitRoom = (
  roomName: string,
  token: string | null,
  options?: {
    onAudioLevel?: (level: number) => void;
    onTrackSubscribed?: (track: any) => void;
  },
) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [localTrack, setLocalTrack] = useState<LocalAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  /*
   * Participant identity -> audio track exists
   */
  const [remoteTracks, setRemoteTracks] = useState<Record<string, boolean>>({});

  /*
   * Participant identity -> currently speaking
   */
  const [speakingParticipants, setSpeakingParticipants] = useState<
    Record<string, boolean>
  >({});

  /*
   * Participant identity -> actual audio level 0..1
   */
  const [remoteAudioLevels, setRemoteAudioLevels] = useState<
    Record<string, number>
  >({});

  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);

  const [isConnected, setIsConnected] = useState(false);

  const [isMockMode, setIsMockMode] = useState(false);

  const [audioLevel, setAudioLevel] = useState(0);

  const [participantVoiceStates, setParticipantVoiceStates] = useState<
    Record<string, LiveKitParticipantVoiceState>
  >({});

  const [error, setError] = useState<string | null>(null);

  const liveKitUrl = getEnvVar("VITE_LIVEKIT_URL", "ws://localhost:18080");

  /*
   * ----------------------------
   * MUTE / UNMUTE
   * ----------------------------
   */
  const toggleMute = useCallback(async () => {
    if (!room) {
      console.warn("⚠️ Cannot toggle mute: LiveKit room is not connected");
      return false;
    }

    try {
      const nextMuted = !isMuted;

      await room.localParticipant.setMicrophoneEnabled(!nextMuted);

      setIsMuted(nextMuted);

      console.log(nextMuted ? "🔇 Microphone muted" : "🎤 Microphone unmuted");

      return nextMuted;
    } catch (error) {
      console.error("❌ Failed to toggle microphone:", error);
      return isMuted;
    }
  }, [room, isMuted]);

  useEffect(() => {
    if (!token || !roomName) {
      console.warn("⚠️ LiveKit skipped:", {
        roomName,
        hasToken: Boolean(token),
      });

      return;
    }

    if (token.startsWith("mock-")) {
      console.error("❌ Mock LiveKit token detected.");

      setIsMockMode(true);
      setIsConnected(false);
      setError("LiveKit returned a mock token.");

      return;
    }

    let livekitRoom: Room | null = null;
    let mounted = true;

    /*
     * Keep track of attached audio elements.
     */
    const attachedAudioElements = new Map<string, HTMLMediaElement[]>();

    /*
     * ----------------------------
     * CONNECT
     * ----------------------------
     */
    const connect = async () => {
      try {
        console.log("════════════════════════════════");

        console.log("🎙️ LIVEKIT CONNECTION START");

        console.log("🎙️ URL:", liveKitUrl);

        console.log("🎙️ ROOM:", roomName);

        console.log("🎙️ TOKEN:", token ? "YES" : "NO");

        console.log("════════════════════════════════");

        livekitRoom = new Room({
          adaptiveStream: true,
          dynacast: true,

          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        setRoom(livekitRoom);

        /*
         * ----------------------------
         * LIVEKIT EVENTS MUST BE
         * REGISTERED BEFORE CONNECT
         * ----------------------------
         */

        /*
         * REMOTE AUDIO TRACK
         */
        const attachRemoteAudio = (track: any, participant: Participant) => {
          if (track.kind !== Track.Kind.Audio) {
            return;
          }

          const identity = participant.identity;

          console.log("🔊 REMOTE AUDIO TRACK:", identity, track.sid);

          try {
            const elements = track.attach();

            const usableElements = elements.filter(
              (element: any) =>
                element instanceof HTMLAudioElement ||
                element instanceof HTMLMediaElement,
            );

            usableElements.forEach((element: HTMLMediaElement) => {
              element.autoplay = true;

              element.setAttribute("playsinline", "true");

              element.volume = 1;

              element.muted = false;

              element.style.display = "none";

              element.id = `livekit-audio-${identity}-${track.sid}`;

              document.body.appendChild(element);

              /*
               * Store it so we can clean
               * it up later.
               */
              const existing = attachedAudioElements.get(identity) || [];

              existing.push(element);

              attachedAudioElements.set(identity, existing);

              /*
               * Browser autoplay may reject.
               */
              element
                .play()
                .then(() => {
                  console.log("🔊 Remote audio PLAYING:", identity);
                })
                .catch((error) => {
                  console.warn(
                    "⚠️ Remote audio autoplay blocked:",
                    identity,
                    error,
                  );
                });
            });
          } catch (error) {
            console.error("❌ Failed to attach remote audio:", error);
          }

          setRemoteTracks((previous) => ({
            ...previous,
            [identity]: true,
          }));

          setRemoteAudioLevels((previous) => ({
            ...previous,
            [identity]: 0,
          }));

          options?.onTrackSubscribed?.(track);
        };

        /*
         * REMOTE AUDIO REMOVED
         */
        const detachRemoteAudio = (track: any, participant: Participant) => {
          if (track.kind !== Track.Kind.Audio) {
            return;
          }

          const identity = participant.identity;

          console.log("🔇 REMOTE AUDIO REMOVED:", identity, track.sid);

          try {
            const elements = track.detach();

            elements.forEach((element: HTMLElement) => {
              element.remove();
            });
          } catch (error) {
            console.warn("⚠️ Failed to detach audio:", error);
          }

          /*
           * Remove our stored elements.
           */
          const stored = attachedAudioElements.get(identity);

          stored?.forEach((element) => {
            try {
              element.remove();
            } catch {
              // Ignore cleanup errors.
            }
          });

          attachedAudioElements.delete(identity);

          setRemoteTracks((previous) => {
            const next = {
              ...previous,
            };

            delete next[identity];

            return next;
          });

          setSpeakingParticipants((previous) => {
            const next = {
              ...previous,
            };

            delete next[identity];

            return next;
          });

          setRemoteAudioLevels((previous) => {
            const next = {
              ...previous,
            };

            delete next[identity];

            return next;
          });
        };

        /*
         * ----------------------------
         * TRACK SUBSCRIBED
         * ----------------------------
         */
        livekitRoom.on(
          RoomEvent.TrackSubscribed,
          (track: any, publication: any, participant: Participant) => {
            console.log("📡 TrackSubscribed:", {
              participant: participant.identity,
              kind: track.kind,
              sid: track.sid,
            });

            attachRemoteAudio(track, participant);
          },
        );

        /*
         * ----------------------------
         * TRACK UNSUBSCRIBED
         * ----------------------------
         */
        livekitRoom.on(
          RoomEvent.TrackUnsubscribed,
          (track: any, publication: any, participant: Participant) => {
            detachRemoteAudio(track, participant);
          },
        );

        /*
         * ----------------------------
         * PARTICIPANT CONNECTED
         * ----------------------------
         */
        livekitRoom.on(
          RoomEvent.ParticipantConnected,
          (participant: Participant) => {
            console.log("👤 PARTICIPANT CONNECTED:", participant.identity);

            setParticipants((previous) => {
              if (previous.some((p) => p.identity === participant.identity)) {
                return previous;
              }

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

        /*
         * ----------------------------
         * PARTICIPANT DISCONNECTED
         * ----------------------------
         */
        livekitRoom.on(
          RoomEvent.ParticipantDisconnected,
          (participant: Participant) => {
            const identity = participant.identity;

            console.log("👋 PARTICIPANT DISCONNECTED:", identity);

            setParticipants((previous) =>
              previous.filter((p) => p.identity !== identity),
            );

            setRemoteTracks((previous) => {
              const next = {
                ...previous,
              };

              delete next[identity];

              return next;
            });

            setSpeakingParticipants((previous) => {
              const next = {
                ...previous,
              };

              delete next[identity];

              return next;
            });

            setRemoteAudioLevels((previous) => {
              const next = {
                ...previous,
              };

              delete next[identity];

              return next;
            });
          },
        );

        /*
         * ----------------------------
         * ACTIVE SPEAKERS
         * ----------------------------
         *
         * This is the important part
         * for your speaking effect.
         */
        livekitRoom.on(
          RoomEvent.ActiveSpeakersChanged,
          (speakers: Participant[]) => {
            const nextSpeaking: Record<string, boolean> = {};

            const nextLevels: Record<string, number> = {};

            speakers.forEach((participant) => {
              if (participant.isLocal) {
                return;
              }

              nextSpeaking[participant.identity] = true;

              /*
               * LiveKit exposes audio level
               * on the participant.
               */
              const level = Number((participant as any).audioLevel ?? 0);

              nextLevels[participant.identity] = Math.max(
                0,
                Math.min(1, level),
              );
            });

            setSpeakingParticipants(nextSpeaking);

            setRemoteAudioLevels(nextLevels);
          },
        );

        /*
         * ----------------------------
         * AUDIO LEVEL
         * ----------------------------
         */
        livekitRoom.on(RoomEvent.AudioLevel, (levels: any[]) => {
          const local = levels.find((item) => item.participant?.isLocal);

          const level = Math.max(0, Math.min(1, Number(local?.level ?? 0)));

          setAudioLevel(level);

          options?.onAudioLevel?.(level);
        });

        /*
         * ----------------------------
         * CONNECT TO LIVEKIT
         * ----------------------------
         */
        await livekitRoom.connect(liveKitUrl, token);

        livekitRoom.on(
          RoomEvent.ActiveSpeakersChanged,
          (speakers: Participant[]) => {
            setParticipantVoiceStates((previous) => {
              const next = { ...previous };

              // Reset speaking state
              Object.keys(next).forEach((identity) => {
                next[identity] = {
                  ...next[identity],
                  isSpeaking: false,
                };
              });

              // Update currently speaking participants
              speakers.forEach((participant) => {
                const identity = participant.identity;

                next[identity] = {
                  userId: identity,
                  isSpeaking: true,
                  audioLevel: participant.audioLevel ?? 0,
                  isMuted: participant.isLocal
                    ? !livekitRoom!.localParticipant.isMicrophoneEnabled
                    : false,
                  hasAudioTrack: true,
                  lastSpeakingAt: Date.now(),
                };
              });

              return next;
            });
          },
        );

        livekitRoom.on(
          RoomEvent.AudioLevelChanged,
          (participant: Participant, level: number) => {
            const identity = participant.identity;

            setParticipantVoiceStates((previous) => ({
              ...previous,
              [identity]: {
                ...(previous[identity] || {
                  userId: identity,
                  isSpeaking: false,
                  isMuted: false,
                  hasAudioTrack: true,
                  lastSpeakingAt: 0,
                }),
                audioLevel: level,
                isSpeaking: level > 0.02,
                lastSpeakingAt:
                  level > 0.02
                    ? Date.now()
                    : previous[identity]?.lastSpeakingAt || 0,
              },
            }));
          },
        );

        if (!mounted) {
          livekitRoom.disconnect();
          return;
        }

        console.log("✅ LIVEKIT CONNECTED");

        console.log(
          "👥 Existing participants:",
          livekitRoom.remoteParticipants.size,
        );

        setIsConnected(true);
        setIsMockMode(false);
        setError(null);

        /*
         * ----------------------------
         * INITIAL PARTICIPANTS
         * ----------------------------
         */
        const initialParticipants = Array.from(
          livekitRoom.remoteParticipants.values(),
        ).map((participant) => ({
          identity: participant.identity,

          name: participant.name || participant.identity,
        }));

        setParticipants(initialParticipants);

        /*
         * ----------------------------
         * EXISTING REMOTE TRACKS
         * ----------------------------
         */
        livekitRoom.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((publication) => {
            if (publication.kind === Track.Kind.Audio && publication.track) {
              attachRemoteAudio(publication.track, participant);
            }
          });
        });

        /*
         * ----------------------------
         * LOCAL MICROPHONE
         * ----------------------------
         */
        console.log("🎤 Enabling microphone...");

        await livekitRoom.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);

        const microphonePublication =
          livekitRoom.localParticipant.getTrackPublication(
            Track.Source.Microphone,
          );

        const microphone = microphonePublication?.track;

        if (microphone && microphone.kind === Track.Kind.Audio) {
          setLocalTrack(microphone as LocalAudioTrack);

          console.log("🎤 MICROPHONE PUBLISHED:", microphone.sid);
        } else {
          console.error("❌ MICROPHONE WAS NOT PUBLISHED");
        }

        console.log("🎧 REAL-TIME AUDIO READY");
      } catch (error) {
        console.error("❌ LIVEKIT CONNECTION ERROR:", error);

        if (!mounted) {
          return;
        }

        setIsConnected(false);

        setError(
          error instanceof Error ? error.message : "LiveKit connection failed",
        );
      }
    };

    connect();

    /*
     * ----------------------------
     * CLEANUP
     * ----------------------------
     */
    return () => {
      mounted = false;

      console.log("🧹 Cleaning up LiveKit...");

      attachedAudioElements.forEach((elements) => {
        elements.forEach((element) => {
          try {
            element.remove();
          } catch {
            // Ignore.
          }
        });
      });

      attachedAudioElements.clear();

      if (livekitRoom) {
        try {
          livekitRoom.disconnect();
        } catch (error) {
          console.warn("LiveKit disconnect error:", error);
        }
      }

      setIsConnected(false);
      setRoom(null);
      setLocalTrack(null);
      setRemoteTracks({});
      setSpeakingParticipants({});
      setRemoteAudioLevels({});
      setParticipants([]);
      setParticipantVoiceStates({});
      setAudioLevel(0);
    };
  }, [token, roomName, liveKitUrl]);

  return {
    room,
    localTrack,
    remoteTracks,
    participants,
    isConnected,
    isMockMode,
    audioLevel,
    isMuted,
    toggleMute,
    error,
  };
};

// ---------- Recording Hook ----------

export const useVoiceRecording = (roomId: string) => {
  const startRecordingMutation = useStartRecording();
  const stopRecordingMutation = useStopRecording();

  const startRecording = useCallback(async () => {
    try {
      await startRecordingMutation.mutateAsync(roomId);
    } catch (error) {
      // Error handled by mutation
    }
  }, [roomId, startRecordingMutation]);

  const stopRecording = useCallback(async () => {
    try {
      await stopRecordingMutation.mutateAsync(roomId);
    } catch (error) {
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

/*
 * ================================================================
 * REALTIME VOICE IMPLEMENTATION NOTES
 * ================================================================
 *
 * The critical rule is that this hook must not create a second microphone
 * stream just to animate the UI. The same microphone track used by LiveKit
 * should be the source of truth for transport and speaking state.
 *
 * The room UI should consume:
 *   audioLevel -> 0..1
 *   isSpeaking -> boolean
 *   isMuted    -> boolean
 *   userId     -> stable participant identity
 *
 * Speaking should be published/derived from the actual LiveKit participant
 * speaking detector where available. Socket.IO should synchronize participant
 * presence/control state, not carry raw microphone audio.
 *
 * Never use Math.random() as an audio level. A remote profile should only
 * animate when the real participant state says that participant is speaking.
 *
 * If the browser reports a working microphone but remote speaking never
 * updates, inspect the useLiveKitRoom implementation next: that is the layer
 * responsible for publishing the local audio track and exposing remote
 * participant speaking/audio-level events.
 */
