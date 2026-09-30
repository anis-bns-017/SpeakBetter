import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api/client";
import { toast } from "sonner";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ---------- Types ----------
export interface Chat {
  id: string;
  type: "PRIVATE" | "GROUP" | "CHANNEL" | "THREAD";
  name?: string;
  description?: string;
  avatarUrl?: string;
  isPublic?: boolean;
  ownerId?: string;
  participants: ChatParticipant[];
  messages?: Message[];
  updatedAt: string;
}

export interface ChatParticipant {
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  role: string;
  isMuted?: boolean;
  isPinned?: boolean;
  joinedAt: string;
  lastReadAt?: string;
}

export interface Message {
  id: string;
  chatId?: string;
  communityId?: string;
  senderId: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  content: string | null;
  type: string;
  mediaUrl?: string;
  fileUrl?: string;
  replyToId?: string;
  replyTo?: Partial<Message>;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  reactions: Reaction[];
  attachments: Attachment[];
  translations: Translation[];
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export interface Attachment {
  id: string;
  url: string;
  type: string;
  filename: string;
  size: number;
}

export interface Translation {
  id: string;
  language: string;
  translatedContent: string;
}

export interface SendMessagePayload {
  chatId?: string;
  communityId?: string;
  content?: string;
  type?: string;
  mediaUrl?: string;
  fileUrl?: string;
  replyToId?: string;
}

// ---------- API Calls ----------

export const chatApi = {
  getUserChats: () => apiClient.get<Chat[]>("/chat"),
  getChatById: (chatId: string) => apiClient.get<Chat>(`/chat/${chatId}`),
  getMessages: (chatId: string, params?: { limit?: number; before?: string }) =>
    apiClient.get<Message[]>(`/chat/${chatId}/messages`, { params }),
  sendMessage: (data: SendMessagePayload) =>
    apiClient.post<Message>("/chat/messages", data),
  createPrivateChat: (userId: string) =>
    apiClient.post<Chat>(`/chat/private/${userId}`),
  createGroupChat: (data: { name: string; participantIds: string[] }) =>
    apiClient.post<Chat>("/chat/group", data),
  addParticipants: (chatId: string, userIds: string[]) =>
    apiClient.post(`/chat/group/${chatId}/add`, { userIds }),
  removeParticipant: (chatId: string, userId: string) =>
    apiClient.delete(`/chat/group/${chatId}/remove/${userId}`),
  markRead: (chatId: string, messageId: string) =>
    apiClient.put("/chat/messages/read", { chatId, messageId }),
  addReaction: (messageId: string, emoji: string) =>
    apiClient.post("/chat/messages/reaction", { messageId, emoji }),
  removeReaction: (messageId: string, emoji: string) =>
    apiClient.delete(`/chat/messages/${messageId}/reaction/${emoji}`),
  getReadReceipts: (messageId: string) =>
    apiClient.get(`/chat/messages/${messageId}/read-receipts`),
  searchMessages: (chatId: string, query: string) =>
    apiClient.get<Message[]>(`/chat/search/${chatId}`, {
      params: { q: query },
    }),
  deleteMessage: (messageId: string) =>
    apiClient.delete(`/chat/messages/${messageId}`),
  editMessage: (messageId: string, content: string) =>
    apiClient.put(`/chat/messages/${messageId}`, { content }),
  pinMessage: (messageId: string, pinned: boolean) =>
    apiClient.put(`/chat/messages/${messageId}/pin`, { pinned }),
  getCommunityMessages: (
    communityId: string,
    params?: { limit?: number; before?: string },
  ) =>
    apiClient.get<Message[]>(`/communities/${communityId}/messages`, {
      params,
    }),
  sendCommunityMessage: (
    communityId: string,
    data: {
      content: string;
      type?: string;
      mediaUrl?: string;
      fileUrl?: string;
      replyToId?: string;
    },
  ) => apiClient.post<Message>(`/communities/${communityId}/messages`, data),
};

// ---------- Message Cache Helpers ----------
const updateMessageInAllCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  messageId: string,
  updater: (message: Message) => Message,
) => {
  queryClient.setQueriesData<Message[]>({ queryKey: ["messages"] }, (old) =>
    old?.map((message) =>
      message.id === messageId ? updater(message) : message,
    ),
  );

  queryClient.setQueriesData<Message[]>(
    { queryKey: ["community-messages"] },
    (old) =>
      old?.map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
  );
};

// ---------- Query hooks ----------

export const useChats = () => {
  return useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const response = await chatApi.getUserChats();
      return response.data;
    },
  });
};

export const useChat = (chatId: string) => {
  return useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const response = await chatApi.getChatById(chatId);
      return response.data;
    },
    enabled: !!chatId,
  });
};

export const useMessages = (chatId: string, limit = 50) => {
  return useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      const response = await chatApi.getMessages(chatId, { limit });
      return response.data.slice().reverse();
    },
    enabled: !!chatId,
  });
};

export const useCommunityMessages = (communityId: string, limit = 50) => {
  return useQuery({
    queryKey: ["community-messages", communityId],
    queryFn: async () => {
      const response = await chatApi.getCommunityMessages(communityId, {
        limit,
      });
      return response.data.slice().reverse();
    },
    enabled: !!communityId,
  });
};

// ---------- Message Mutations ----------

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SendMessagePayload) => {
      const response = await chatApi.sendMessage(data);
      return response.data;
    },
    onSuccess: (message, variables) => {
      const queryKey = variables.chatId
        ? ["messages", variables.chatId]
        : variables.communityId
          ? ["community-messages", variables.communityId]
          : null;

      if (queryKey) {
        queryClient.setQueryData<Message[]>(queryKey, (old) => {
          if (!old) return [message];
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        });
      }
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to send message");
    },
  });
};

export const useSendCommunityMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      communityId,
      content,
      type,
      mediaUrl,
      fileUrl,
      replyToId,
    }: {
      communityId: string;
      content: string;
      type?: string;
      mediaUrl?: string;
      fileUrl?: string;
      replyToId?: string;
    }) => {
      const response = await chatApi.sendCommunityMessage(communityId, {
        content,
        type,
        mediaUrl,
        fileUrl,
        replyToId,
      });
      return response.data;
    },
    onSuccess: (message, variables) => {
      queryClient.setQueryData<Message[]>(
        ["community-messages", variables.communityId],
        (old) => {
          if (!old) return [message];
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        },
      );
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to send message");
    },
  });
};

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      await chatApi.deleteMessage(messageId);
    },
    onSuccess: (_, messageId) => {
      updateMessageInAllCaches(queryClient, messageId, (message) => ({
        ...message,
        isDeleted: true,
        content: "Message deleted",
      }));
      toast.success("Message deleted");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete message");
    },
  });
};

export const useEditMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      content,
    }: {
      messageId: string;
      content: string;
    }) => {
      const response = await chatApi.editMessage(messageId, content);
      return response.data;
    },
    onSuccess: (message) => {
      updateMessageInAllCaches(queryClient, message.id, (oldMessage) => ({
        ...oldMessage,
        content: message.content,
        isEdited: true,
        updatedAt: message.updatedAt,
      }));
      toast.success("Message edited");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to edit message");
    },
  });
};

export const usePinMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      pinned,
    }: {
      messageId: string;
      pinned: boolean;
    }) => {
      const response = await chatApi.pinMessage(messageId, pinned);
      return response.data;
    },
    onSuccess: (message) => {
      updateMessageInAllCaches(queryClient, message.id, (oldMessage) => ({
        ...oldMessage,
        isPinned: message.isPinned,
      }));
      toast.success(message.isPinned ? "Message pinned" : "Message unpinned");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to pin message");
    },
  });
};

// ---------- Chat Management Mutations ----------

export const useCreatePrivateChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await chatApi.createPrivateChat(userId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      toast.success("Chat created");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to start chat");
    },
  });
};

export const useCreateGroupChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; participantIds: string[] }) => {
      const response = await chatApi.createGroupChat(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      toast.success("Group created");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create group");
    },
  });
};

export const useAddParticipants = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      userIds,
    }: {
      chatId: string;
      userIds: string[];
    }) => {
      const response = await chatApi.addParticipants(chatId, userIds);
      return response.data;
    },
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to add participants",
      );
    },
  });
};

export const useRemoveParticipant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      userId,
    }: {
      chatId: string;
      userId: string;
    }) => {
      const response = await chatApi.removeParticipant(chatId, userId);
      return response.data;
    },
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to remove participant",
      );
    },
  });
};

// ---------- Reactions ----------

export const useAddReaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
    }: {
      messageId: string;
      emoji: string;
    }) => {
      const response = await chatApi.addReaction(messageId, emoji);
      return response.data;
    },
    onSuccess: (reaction) => {
      updateMessageInAllCaches(queryClient, reaction.messageId, (message) => ({
        ...message,
        reactions: [
          ...message.reactions.filter((r) => r.userId !== reaction.userId),
          reaction,
        ],
      }));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to add reaction");
    },
  });
};

export const useRemoveReaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
    }: {
      messageId: string;
      emoji: string;
    }) => {
      await chatApi.removeReaction(messageId, emoji);
    },
    onSuccess: (_, { messageId, emoji }) => {
      updateMessageInAllCaches(queryClient, messageId, (message) => ({
        ...message,
        reactions: message.reactions.filter(
          (reaction) => reaction.emoji !== emoji,
        ),
      }));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to remove reaction");
    },
  });
};

export const useMarkRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      messageId,
    }: {
      chatId: string;
      messageId: string;
    }) => {
      const response = await chatApi.markRead(chatId, messageId);
      return response.data;
    },
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
};

export const useSearchMessages = (chatId: string, query: string) => {
  return useQuery({
    queryKey: ["search-messages", chatId, query],
    queryFn: async () => {
      const response = await chatApi.searchMessages(chatId, query);
      return response.data;
    },
    enabled: !!chatId && query.trim().length > 0,
  });
};

// ============ WEBSOCKET HOOK ============

/**
 * Socket.IO connection settings.
 *
 * IMPORTANT:
 * - Do not send `token=undefined` in the URL/query string.
 * - `withCredentials: true` allows an HttpOnly authentication cookie to be
 *   sent by Firefox/Brave as well as Chromium browsers.
 * - Polling is intentionally listed first. Socket.IO can then upgrade to
 *   WebSocket after the initial authenticated handshake. This is more
 *   tolerant of browser/proxy/WebSocket differences during development.
 */
const SOCKET_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const CHAT_SOCKET_NAMESPACE = "/chat";

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;

  const isUsable = (value: string | null | undefined): value is string => {
    if (!value) return false;
    const normalized = value.trim();
    return (
      normalized.length > 0 &&
      normalized !== "undefined" &&
      normalized !== "null"
    );
  };

  try {
    const localToken =
      window.localStorage.getItem("accessToken") ||
      window.localStorage.getItem("token");

    if (isUsable(localToken)) return localToken.trim();

    const sessionToken =
      window.sessionStorage.getItem("accessToken") ||
      window.sessionStorage.getItem("token");

    if (isUsable(sessionToken)) return sessionToken.trim();

    // This works only for non-HttpOnly cookies. HttpOnly cookies are still
    // automatically sent because the socket uses withCredentials: true.
    const cookieToken = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        if (separator === -1) return null;
        return {
          name: cookie.slice(0, separator),
          value: cookie.slice(separator + 1),
        };
      })
      .find(
        (cookie) =>
          cookie &&
          (cookie.name === "accessToken" || cookie.name === "token") &&
          isUsable(cookie.value),
      );

    if (cookieToken && isUsable(cookieToken.value)) {
      return decodeURIComponent(cookieToken.value).trim();
    }
  } catch (error) {
    console.warn("⚠️ Unable to read stored authentication token:", error);
  }

  return null;
};

export const useChatSocket = (
  chatId: string | null,
  userId: string,
  options?: {
    onNewMessage?: (message: Message) => void;
    onMessageDeleted?: (data: {
      messageId: string;
      userId: string;
      chatId?: string;
      communityId?: string;
    }) => void;
    onMessageEdited?: (message: Message) => void;
    onReaction?: (reaction: Reaction) => void;
  },
) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const queryClient = useQueryClient();

  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectToastShownRef = useRef(false);

  const getToken = useCallback(() => getStoredToken(), []);

  // Keep the current chat room synchronized without recreating the socket.
  useEffect(() => {
    const currentSocket = socketRef.current;

    if (!currentSocket?.connected || !chatId) return;

    console.log(`📚 Joining chat room: ${chatId}`);
    currentSocket.emit("chat:join", { chatId });

    return () => {
      if (currentSocket.connected) {
        console.log(`📚 Leaving chat room: ${chatId}`);
        currentSocket.emit("chat:leave", { chatId });
      }
    };
  }, [chatId, isConnected]);

  // Create exactly one socket per userId.
  useEffect(() => {
    if (!userId) {
      console.log("⏳ Waiting for userId before connecting chat socket");
      return;
    }

    if (typeof window === "undefined") return;

    if (socketRef.current?.connected) {
      console.log("✅ Chat socket already connected");
      return;
    }

    if (isConnectingRef.current) {
      console.log("⏳ Chat socket connection already in progress");
      return;
    }

    isConnectingRef.current = true;

    const token = getToken();

    console.log(
      "🔑 Chat authentication:",
      token
        ? "stored token present"
        : "no JS-readable token; using credentials/cookies",
    );
    console.log(`🔌 Connecting to: ${SOCKET_URL}${CHAT_SOCKET_NAMESPACE}`);

    // Build auth without undefined values. This is the critical difference
    // from the previous implementation, which generated token=undefined.
    const auth: Record<string, string> = {};
    if (token) auth.token = token;

    const query: Record<string, string> = {
      userId,
    };
    if (token) query.token = token;

    const s = io(`${SOCKET_URL}${CHAT_SOCKET_NAMESPACE}`, {
      withCredentials: true,

      // Start with polling, then allow Socket.IO to upgrade to WebSocket.
      // This avoids an immediate Firefox/Brave WebSocket failure from
      // preventing the authenticated connection from being established.
      transports: ["polling", "websocket"],
      upgrade: true,

      auth,
      query,

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.25,
      timeout: 20000,

      // Prevent stale socket state from being reused between attempts.
      forceNew: true,
    });

    socketRef.current = s;
    setSocket(s);

    const handleConnect = () => {
      console.log("✅ Connected to chat socket", s.id);

      isConnectingRef.current = false;
      reconnectToastShownRef.current = false;
      setIsConnected(true);
      setReconnectAttempts(0);

      if (chatId) {
        console.log(`📚 Joining chat room: ${chatId}`);
        s.emit("chat:join", { chatId });
      }
    };

    const handleDisconnect = (reason: string) => {
      console.log(`❌ Disconnected from chat socket: ${reason}`);
      setIsConnected(false);

      // Socket.IO normally reconnects automatically. Do not call connect()
      // manually here because that can create duplicate connection attempts.
      if (reason === "io server disconnect") {
        console.log("🔄 Server requested disconnect; reconnecting...");
        reconnectTimerRef.current = setTimeout(() => {
          if (s.disconnected && !s.active) {
            s.connect();
          }
        }, 1000);
      }
    };

    const handleConnectError = (error: Error) => {
      const nextAttempt = reconnectAttempts + 1;

      console.error("❌ Chat socket connection error:", error.message);
      console.error("🔎 Socket transport:", s.io.engine?.transport?.name);
      console.error(
        "🔎 Authentication:",
        token ? "token supplied" : "credential/cookie mode",
      );

      setIsConnected(false);
      setReconnectAttempts(nextAttempt);
      isConnectingRef.current = false;

      // Authentication failures should not be hidden behind endless retries.
      const message = error.message?.toLowerCase() || "";
      const looksLikeAuthError =
        message.includes("unauthorized") ||
        message.includes("forbidden") ||
        message.includes("jwt") ||
        message.includes("token") ||
        message.includes("authentication");

      if (looksLikeAuthError && !reconnectToastShownRef.current) {
        reconnectToastShownRef.current = true;
        toast.error("Chat authentication failed. Please sign in again.");
      }
    };

    const handleReconnect = (attemptNumber: number) => {
      console.log(
        `🔄 Chat socket reconnected after ${attemptNumber} attempt(s)`,
      );
      isConnectingRef.current = false;
      setIsConnected(true);
      setReconnectAttempts(0);
      reconnectToastShownRef.current = false;
    };

    const handleReconnectError = (error: Error) => {
      console.error("❌ Chat socket reconnect error:", error.message);
    };

    const handleReconnectFailed = () => {
      console.error("❌ Chat socket reconnection stopped");
      isConnectingRef.current = false;
    };

    s.on("connect", handleConnect);
    s.on("disconnect", handleDisconnect);
    s.on("connect_error", handleConnectError);
    s.io.on("reconnect", handleReconnect);
    s.io.on("reconnect_error", handleReconnectError);
    s.io.on("reconnect_failed", handleReconnectFailed);

    s.on("connection:established", (data) => {
      console.log("✅ Connection established:", data);
      setIsConnected(true);
      isConnectingRef.current = false;
    });

    // ---------- Message Events ----------

    s.on("message:new", (message: Message) => {
      console.log("📩 New message received:", message);

      options?.onNewMessage?.(message);

      const queryKey = message.chatId
        ? ["messages", message.chatId]
        : message.communityId
          ? ["community-messages", message.communityId]
          : null;

      if (queryKey) {
        queryClient.setQueryData<Message[]>(queryKey, (old) => {
          if (!old) return [message];
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        });
      }

      queryClient.invalidateQueries({ queryKey: ["chats"] });
    });

    s.on("message:sent", (message: Message) => {
      console.log("✅ Message sent confirmation:", message);
    });

    s.on(
      "message:deleted",
      (data: {
        messageId: string;
        userId: string;
        chatId?: string;
        communityId?: string;
      }) => {
        console.log("🗑️ Message deleted:", data);

        options?.onMessageDeleted?.(data);

        const queryKey = data.chatId
          ? ["messages", data.chatId]
          : data.communityId
            ? ["community-messages", data.communityId]
            : null;

        if (queryKey) {
          queryClient.setQueryData<Message[]>(queryKey, (old) => {
            if (!old) return old;

            return old.map((message) =>
              message.id === data.messageId
                ? {
                    ...message,
                    isDeleted: true,
                    content: "Message deleted",
                  }
                : message,
            );
          });
        }
      },
    );

    s.on("message:edited", (message: Message) => {
      console.log("✏️ Message edited:", message);

      options?.onMessageEdited?.(message);

      const queryKey = message.chatId
        ? ["messages", message.chatId]
        : message.communityId
          ? ["community-messages", message.communityId]
          : null;

      if (queryKey) {
        queryClient.setQueryData<Message[]>(queryKey, (old) => {
          if (!old) return old;

          return old.map((item) =>
            item.id === message.id
              ? {
                  ...item,
                  content: message.content,
                  isEdited: true,
                }
              : item,
          );
        });
      }
    });

    s.on(
      "message:pinned",
      (data: { messageId: string; pinned: boolean; userId: string }) => {
        console.log("📌 Message pinned:", data);

        queryClient.setQueriesData<Message[]>(
          { queryKey: ["messages"] },
          (old) => {
            if (!old) return old;

            return old.map((message) =>
              message.id === data.messageId
                ? { ...message, isPinned: data.pinned }
                : message,
            );
          },
        );
      },
    );

    // ---------- Reaction Events ----------

    s.on(
      "reaction:new",
      (payload: Reaction | { messageId: string; reaction: Reaction }) => {
        const reaction = "reaction" in payload ? payload.reaction : payload;

        console.log("❤️ New reaction:", reaction);

        options?.onReaction?.(reaction);

        if (!reaction?.messageId) return;

        queryClient.setQueriesData<Message[]>(
          { queryKey: ["messages"] },
          (old) => {
            if (!old) return old;

            return old.map((message) =>
              message.id === reaction.messageId
                ? {
                    ...message,
                    reactions: [
                      ...message.reactions.filter(
                        (item) => item.userId !== reaction.userId,
                      ),
                      reaction,
                    ],
                  }
                : message,
            );
          },
        );
      },
    );

    s.on(
      "reaction:removed",
      (data: { messageId: string; userId: string; emoji: string }) => {
        console.log("💔 Reaction removed:", data);

        queryClient.setQueriesData<Message[]>(
          { queryKey: ["messages"] },
          (old) => {
            if (!old) return old;

            return old.map((message) =>
              message.id === data.messageId
                ? {
                    ...message,
                    reactions: message.reactions.filter(
                      (reaction) =>
                        reaction.emoji !== data.emoji ||
                        reaction.userId !== data.userId,
                    ),
                  }
                : message,
            );
          },
        );
      },
    );

    s.on("reaction:error", (data: { error: string }) => {
      toast.error(data.error || "Failed to add reaction");
    });

    // ---------- Read Receipts ----------

    s.on(
      "message:read",
      (data: { userId: string; messageId: string; chatId: string }) => {
        console.log("👀 Message read:", data);
      },
    );

    // ---------- Typing Events ----------

    s.on(
      "typing:start",
      (data: { userId: string; chatId: string; communityId?: string }) => {
        const targetId = data.chatId || data.communityId;

        if (targetId === chatId && data.userId !== userId) {
          setTypingUsers((previous) => {
            const next = new Set(previous);
            next.add(data.userId);
            return next;
          });
        }
      },
    );

    s.on(
      "typing:stop",
      (data: { userId: string; chatId: string; communityId?: string }) => {
        const targetId = data.chatId || data.communityId;

        if (targetId === chatId) {
          setTypingUsers((previous) => {
            const next = new Set(previous);
            next.delete(data.userId);
            return next;
          });
        }
      },
    );

    // ---------- Presence Events ----------

    s.on("user:online", (data: { userId: string }) => {
      if (!data?.userId) return;

      setOnlineUsers((previous) => {
        const next = new Set(previous);
        next.add(data.userId);
        return next;
      });
    });

    s.on("user:offline", (data: { userId: string }) => {
      if (!data?.userId) return;

      setOnlineUsers((previous) => {
        const next = new Set(previous);
        next.delete(data.userId);
        return next;
      });
    });

    s.on("users:online", (data: { users: string[] }) => {
      setOnlineUsers(new Set(data?.users || []));
    });

    // ---------- Socket Errors ----------

    s.on("message:error", (data: { error: string }) => {
      toast.error(data.error || "Message failed to send");
    });

    s.on("error", (data: { message: string }) => {
      console.error("❌ Socket error:", data);
      toast.error(data?.message || "Socket error occurred");
    });

    return () => {
      console.log("🧹 Cleaning up chat socket");

      isConnectingRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Remove listeners before disconnecting to prevent late events from
      // updating React state after this hook has been unmounted.
      s.off("connect", handleConnect);
      s.off("disconnect", handleDisconnect);
      s.off("connect_error", handleConnectError);
      s.off("connection:established");

      s.removeAllListeners("message:new");
      s.removeAllListeners("message:sent");
      s.removeAllListeners("message:deleted");
      s.removeAllListeners("message:edited");
      s.removeAllListeners("message:pinned");
      s.removeAllListeners("reaction:new");
      s.removeAllListeners("reaction:removed");
      s.removeAllListeners("reaction:error");
      s.removeAllListeners("message:read");
      s.removeAllListeners("typing:start");
      s.removeAllListeners("typing:stop");
      s.removeAllListeners("user:online");
      s.removeAllListeners("user:offline");
      s.removeAllListeners("users:online");
      s.removeAllListeners("message:error");
      s.removeAllListeners("error");

      s.io.off("reconnect", handleReconnect);
      s.io.off("reconnect_error", handleReconnectError);
      s.io.off("reconnect_failed", handleReconnectFailed);

      s.disconnect();

      if (socketRef.current === s) {
        socketRef.current = null;
      }

      setSocket(null);
      setIsConnected(false);
    };
  }, [userId]);

  // ---------- Socket Actions ----------

  const sendMessage = useCallback(
    (
      payload: Omit<SendMessagePayload, "chatId" | "communityId"> & {
        chatId?: string;
        communityId?: string;
      },
    ) => {
      if (!socketRef.current?.connected || !isConnected) {
        toast.error("Not connected to chat server");
        return;
      }

      const finalPayload = {
        ...payload,
        chatId: payload.chatId || chatId || undefined,
      };

      console.log("📤 Sending message via socket:", finalPayload);
      socketRef.current.emit("message:send", finalPayload);
    },
    [isConnected, chatId],
  );

  const sendVoiceMessage = useCallback(
    (payload: {
      chatId?: string;
      communityId?: string;
      audioUrl: string;
      duration: number;
    }) => {
      if (!socketRef.current?.connected || !isConnected) {
        toast.error("Not connected to chat server");
        return;
      }

      const finalPayload = {
        ...payload,
        chatId: payload.chatId || chatId || undefined,
      };

      socketRef.current.emit("voice:message:send", finalPayload);
    },
    [isConnected, chatId],
  );

  const sendTyping = useCallback(
    (isTyping: boolean, targetId?: string, isCommunity: boolean = false) => {
      if (!socketRef.current?.connected || !isConnected) return;

      const id = targetId || chatId;
      if (!id) return;

      const event = isTyping ? "typing:start" : "typing:stop";
      const payload = isCommunity ? { communityId: id } : { chatId: id };

      socketRef.current.emit(event, payload);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          if (socketRef.current?.connected && isConnected) {
            socketRef.current.emit("typing:stop", payload);
          }
        }, 3000);
      }
    },
    [isConnected, chatId],
  );

  const emitRead = useCallback(
    (messageId: string, targetId?: string, isCommunity: boolean = false) => {
      if (!socketRef.current?.connected || !isConnected) return;

      const id = targetId || chatId;
      if (!id) return;

      const payload = isCommunity
        ? { communityId: id, messageId }
        : { chatId: id, messageId };

      socketRef.current.emit("message:read", payload);
    },
    [isConnected, chatId],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!socketRef.current?.connected || !isConnected) {
        toast.error("Not connected to chat server");
        return;
      }

      socketRef.current.emit("message:delete", { messageId });
    },
    [isConnected],
  );

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      if (!socketRef.current?.connected || !isConnected) {
        toast.error("Not connected to chat server");
        return;
      }

      socketRef.current.emit("message:edit", { messageId, content });
    },
    [isConnected],
  );

  const pinMessage = useCallback(
    (messageId: string, pinned: boolean) => {
      if (!socketRef.current?.connected || !isConnected) {
        toast.error("Not connected to chat server");
        return;
      }

      socketRef.current.emit("message:pin", { messageId, pinned });
    },
    [isConnected],
  );

  const fetchMessages = useCallback(
    (params: {
      chatId?: string;
      communityId?: string;
      limit?: number;
      before?: string;
    }) => {
      if (!socketRef.current?.connected || !isConnected) {
        toast.error("Not connected to chat server");
        return;
      }

      socketRef.current.emit("messages:fetch", params);
    },
    [isConnected],
  );

  const joinChat = useCallback(
    (chatIdToJoin: string) => {
      if (!socketRef.current?.connected || !isConnected) {
        toast.error("Not connected to chat server");
        return;
      }

      socketRef.current.emit("chat:join", { chatId: chatIdToJoin });
    },
    [isConnected],
  );

  const leaveChat = useCallback(
    (chatIdToLeave: string) => {
      if (!socketRef.current?.connected || !isConnected) return;

      socketRef.current.emit("chat:leave", { chatId: chatIdToLeave });
    },
    [isConnected],
  );

  return {
    socket,
    isConnected,
    typingUsers,
    onlineUsers,
    sendMessage,
    sendVoiceMessage,
    sendTyping,
    emitRead,
    deleteMessage,
    editMessage,
    pinMessage,
    fetchMessages,
    joinChat,
    leaveChat,
    reconnectAttempts,
  };
};

// ============ VOICE MESSAGE RECORDING HOOK ============

const getSupportedAudioMimeType = (): string | undefined => {
  if (typeof MediaRecorder === "undefined") return undefined;

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
};

export const useVoiceMessageRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      const error = new Error(
        "This browser does not support microphone recording.",
      );
      toast.error("Your browser does not support microphone recording.");
      throw error;
    }

    try {
      setAudioBlob(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMimeType =
          mediaRecorder.mimeType || mimeType || "audio/webm";

        const blob = new Blob(chunksRef.current, {
          type: actualMimeType,
        });

        setAudioBlob(blob);
        chunksRef.current = [];
        stopTracks();
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((previous) => previous + 1);
      }, 1000);
    } catch (error: any) {
      console.error("❌ Failed to start recording:", error);

      stopTracks();
      setIsRecording(false);

      const name = error?.name;

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        toast.error(
          "Microphone permission was denied. Allow microphone access for this site and try again.",
        );
      } else if (name === "NotFoundError") {
        toast.error("No microphone was found.");
      } else if (name === "NotReadableError") {
        toast.error(
          "Your microphone is already being used by another application.",
        );
      } else {
        toast.error("Failed to access microphone. Please check permissions.");
      }

      throw error;
    }
  }, [isRecording, stopTracks]);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return audioBlob || new Blob([], { type: "audio/webm" });
    }

    return new Promise<Blob>((resolve) => {
      const finish = () => {
        const result =
          audioBlob ||
          new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

        setAudioBlob(result);
        resolve(result);
      };

      if (recorder.state === "recording") {
        recorder.addEventListener("stop", finish, { once: true });
        recorder.stop();
      } else {
        finish();
      }

      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      mediaRecorderRef.current = null;
    });
  }, [audioBlob]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    mediaRecorderRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    stopTracks();

    setIsRecording(false);
    setDuration(0);
    setAudioBlob(null);
    chunksRef.current = [];
  }, [stopTracks]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      mediaRecorderRef.current = null;
      stopTracks();
    };
  }, [stopTracks]);

  return {
    isRecording,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
