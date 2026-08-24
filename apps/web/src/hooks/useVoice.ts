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
    apiClient.post<{ token: string; wsUrl?: string }>(
      `/voice/rooms/${roomId}/join`,
    ),
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

      // ✅ Check for mock token
      if (response.data?.token?.startsWith("mock-")) {
        throw new Error(
          "Voice service is currently unavailable. Please try again later.",
        );
      }

      return response.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["voice-room", roomId] });
      queryClient.invalidateQueries({
        queryKey: ["voice-participants", roomId],
      });
      queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
      toast.success("🎧 Joined room!");
    },
    onError: (error: any) => {
      if (error.message?.includes("unavailable")) {
        toast.error(
          "Voice service is currently unavailable. Please try again later.",
        );
      } else {
        toast.error(error.response?.data?.message || "Failed to join room");
      }
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

  /*
   * Key = participant identity
   * Value = whether that participant currently has
   * an audio track.
   */
  const [remoteTracks, setRemoteTracks] = useState<Record<string, boolean>>({});

  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const liveKitUrl = getEnvVar("VITE_LIVEKIT_URL", "ws://localhost:7880");

  const toggleMute = useCallback(() => {
    if (!localTrack) {
      return false;
    }

    if (localTrack.isMuted) {
      localTrack.unmute();
      return false;
    }

    localTrack.mute();
    return true;
  }, [localTrack]);

  useEffect(() => {
    if (!token || !roomName) {
      console.warn("⚠️ LiveKit skipped:", {
        roomName,
        hasToken: !!token,
      });

      return;
    }

    let livekitRoom: Room | null = null;
    let mounted = true;

    /*
     * Never allow mock mode to silently pretend
     * that real audio is working.
     */
    if (token.startsWith("mock-")) {
      console.error(
        "❌ LiveKit returned a MOCK token. Real-time audio cannot work.",
      );

      setIsConnected(false);
      setIsMockMode(true);
      setError("LiveKit is unavailable. Server returned a mock token.");

      return;
    }

    const connect = async () => {
      try {
        console.log("🎙️ Starting LiveKit connection...");
        console.log("🎙️ LiveKit URL:", liveKitUrl);
        console.log("🎙️ Room:", roomName);

        livekitRoom = new Room({
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },

          adaptiveStream: true,
          dynacast: true,
        });

        setRoom(livekitRoom);

        /*
         * ----------------------------
         * ROOM CONNECT
         * ----------------------------
         */
        await livekitRoom.connect(liveKitUrl, token);

        if (!mounted) {
          livekitRoom.disconnect();
          return;
        }

        console.log("✅ LiveKit connected:", livekitRoom.name);

        setIsConnected(true);
        setIsMockMode(false);
        setError(null);

        /*
         * ----------------------------
         * REMOTE AUDIO
         * ----------------------------
         *
         * THIS WAS MISSING.
         *
         * LiveKit delivers the remote audio track,
         * but the browser needs the track attached
         * to an audio element.
         */
        const attachRemoteAudio = (track: any, participant: Participant) => {
          if (track.kind !== Track.Kind.Audio) {
            return;
          }

          console.log(
            "🔊 Remote audio track subscribed:",
            participant.identity,
            track.sid,
          );

          /*
           * Attach creates an HTMLMediaElement.
           */
          const elements = track.attach();

          elements.forEach((element: HTMLMediaElement) => {
            element.autoplay = true;
            element.setAttribute("playsinline", "true");

            /*
             * Give the audio element a predictable ID.
             */
            element.id = `livekit-audio-${participant.identity}-${track.sid}`;

            element.volume = 1;

            /*
             * Remote audio should not be visible.
             */
            if (element instanceof HTMLAudioElement) {
              element.style.display = "none";
            }

            document.body.appendChild(element);

            /*
             * Explicitly attempt playback.
             */
            const playPromise = element.play();

            if (playPromise) {
              playPromise.catch((err) => {
                console.warn("⚠️ Remote audio autoplay was blocked:", err);
              });
            }
          });

          setRemoteTracks((prev) => ({
            ...prev,
            [participant.identity]: true,
          }));

          options?.onTrackSubscribed?.(track);
        };

        /*
         * ----------------------------
         * REMOTE AUDIO REMOVED
         * ----------------------------
         */
        const detachRemoteAudio = (track: any, participant: Participant) => {
          if (track.kind !== Track.Kind.Audio) {
            return;
          }

          console.log(
            "🔇 Remote audio track unsubscribed:",
            participant.identity,
            track.sid,
          );

          try {
            const elements = track.detach();

            elements.forEach((element: HTMLElement) => {
              element.remove();
            });
          } catch (err) {
            console.warn("Failed to detach remote audio:", err);
          }

          setRemoteTracks((prev) => {
            const next = { ...prev };
            delete next[participant.identity];
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
            console.log(
              "👤 LiveKit participant connected:",
              participant.identity,
            );

            setParticipants((prev) => {
              if (prev.some((p) => p.identity === participant.identity)) {
                return prev;
              }

              return [
                ...prev,
                {
                  identity: participant.identity,
                  name: participant.name || participant.identity,
                },
              ];
            });

            /*
             * A participant may already have
             * published tracks.
             */
            participant.trackPublications.forEach((publication: any) => {
              if (publication.kind === Track.Kind.Audio && publication.track) {
                attachRemoteAudio(publication.track, participant);
              }
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
            console.log(
              "👋 LiveKit participant disconnected:",
              participant.identity,
            );

            setParticipants((prev) =>
              prev.filter((p) => p.identity !== participant.identity),
            );

            setRemoteTracks((prev) => {
              const next = { ...prev };
              delete next[participant.identity];
              return next;
            });
          },
        );

        /*
         * ----------------------------
         * INITIAL PARTICIPANTS
         * ----------------------------
         */
        const initialParticipants = Array.from(
          livekitRoom.participants.values(),
        ).map((p: Participant) => ({
          identity: p.identity,
          name: p.name || p.identity,
        }));

        setParticipants(initialParticipants);

        /*
         * Attach already-subscribed audio tracks.
         */
        livekitRoom.participants.forEach((participant: Participant) => {
          participant.trackPublications.forEach((publication: any) => {
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
        console.log("🎤 Enabling local microphone...");

        await livekitRoom.localParticipant.setMicrophoneEnabled(true);

        const microphonePublication =
          livekitRoom.localParticipant.getTrackPublication(
            Track.Source.Microphone,
          );

        const microphoneTrack = microphonePublication?.track;

        if (microphoneTrack && microphoneTrack.kind === Track.Kind.Audio) {
          setLocalTrack(microphoneTrack as LocalAudioTrack);

          console.log("🎤 Microphone published:", microphoneTrack.sid);
        } else {
          console.error("❌ Microphone track was not published.");
        }

        /*
         * ----------------------------
         * AUDIO LEVEL
         * ----------------------------
         */
        livekitRoom.on(RoomEvent.AudioLevel, (levels: any[]) => {
          const localLevel =
            levels.find((item: any) => item.participant?.isLocal)?.level || 0;

          setAudioLevel(localLevel);

          options?.onAudioLevel?.(localLevel);
        });

        console.log("✅ LiveKit audio system ready.");
      } catch (err) {
        console.error("❌ LiveKit connection failed:", err);

        if (!mounted) {
          return;
        }

        setIsConnected(false);
        setError(
          err instanceof Error ? err.message : "LiveKit connection failed",
        );
      }
    };

    connect();

    return () => {
      mounted = false;

      console.log("🧹 Cleaning up LiveKit room...");

      if (livekitRoom) {
        try {
          livekitRoom.remoteParticipants.forEach((participant: Participant) => {
            participant.trackPublications.forEach((publication: any) => {
              if (publication.track && publication.kind === Track.Kind.Audio) {
                try {
                  const elements = publication.track.detach();

                  elements.forEach((element: HTMLElement) => element.remove());
                } catch {
                  // Ignore cleanup errors
                }
              }
            });
          });
        } catch {
          // Ignore cleanup errors
        }

        livekitRoom.disconnect();
      }

      setIsConnected(false);
      setRoom(null);
      setLocalTrack(null);
      setRemoteTracks({});
      setParticipants([]);
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
