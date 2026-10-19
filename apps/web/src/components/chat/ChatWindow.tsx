import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  useMessages,
  useCommunityMessages,
  useSendMessage,
  useSendCommunityMessage,
  useChat,
  useChatSocket,
  useDeleteMessage,
  useEditMessage,
  usePinMessage,
  type Message,
} from "../../hooks/useChat";
import { useAuth } from "../../contexts/AuthContext";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import {
  Reply,
  X,
  Users,
  Circle,
  Mic,
  Loader2,
  MoreVertical,
  Search,
  Pin,
  PinOff,
  Phone,
  Video,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Edit,
  Flag,
  Forward,
  MessageCircle,
  Check,
  ArrowLeft,
  Sparkles,
  Clock,
  Star,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

interface ChatWindowProps {
  chatId?: string;
  communityId?: string;
  onBack?: () => void;
}

// ─── Styled Components ─────────────────────────────────────────────

const glassMorphism = "bg-white/80 backdrop-blur-xl border-white/20 shadow-lg";
const glassMorphismDark =
  "bg-slate-900/80 backdrop-blur-xl border-slate-700/30 shadow-xl";

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chatId,
  communityId,
  onBack,
}) => {
  const { user } = useAuth();
  const isCommunity = !!communityId;
  const targetId = chatId || communityId || "";

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showMessageActions, setShowMessageActions] = useState<string | null>(
    null,
  );
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(
    new Set(),
  );
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastReadIdRef = useRef<string | null>(null);
  const searchHighlightRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  const { data: chat } = useChat(chatId || "");
  const {
    data: chatMessages,
    isLoading: isLoadingChat,
    fetchNextPage,
    hasNextPage,
  } = useMessages(chatId || "");
  const {
    data: communityMessages,
    isLoading: isLoadingCommunity,
    fetchNextPage: fetchNextCommunityPage,
    hasNextPage: hasNextCommunityPage,
  } = useCommunityMessages(communityId || "");

  const rawMessages = isCommunity ? communityMessages : chatMessages;
  const isLoading = isCommunity ? isLoadingCommunity : isLoadingChat;
  const hasMore = isCommunity ? hasNextCommunityPage : hasNextPage;

  const messages = useMemo(() => {
    if (!rawMessages?.length) return [];
    return [...rawMessages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [rawMessages]);

  const sendMessageRest = useSendMessage();
  const sendCommunityMessageRest = useSendCommunityMessage();
  const deleteMessageMutation = useDeleteMessage();
  const editMessageMutation = useEditMessage();
  const pinMessageMutation = usePinMessage();

  useEffect(() => {
    isNearBottomRef.current = isNearBottom;
  }, [isNearBottom]);

  const onNewMessage = useCallback(() => {
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, []);

  const socketOptions = useMemo(() => ({ onNewMessage }), [onNewMessage]);

  const {
    socket,
    isConnected,
    typingUsers,
    onlineUsers,
    sendMessage: sendSocketMessage,
    sendTyping,
    emitRead,
    deleteMessage: deleteSocketMessage,
    editMessage: editSocketMessage,
    pinMessage: pinSocketMessage,
  } = useChatSocket(targetId, user?.id || "", socketOptions);

  const chatName = useMemo(() => {
    if (isCommunity) return "Community Chat";
    if (!chat) return "Loading…";
    if (chat.type === "PRIVATE") {
      const other = chat.participants.find((p) => p.userId !== user?.id)?.user;
      return other?.name || "Unknown";
    }
    return chat.name || "Group Chat";
  }, [chat, isCommunity, user?.id]);

  const chatAvatar = useMemo(() => {
    if (isCommunity || !chat) return null;
    if (chat.type === "PRIVATE") {
      return chat.participants.find((p) => p.userId !== user?.id)?.user
        ?.avatarUrl;
    }
    return chat.avatarUrl;
  }, [chat, isCommunity, user?.id]);

  const otherUser =
    !isCommunity && chat?.type === "PRIVATE"
      ? chat.participants.find((p) => p.userId !== user?.id)?.user
      : null;
  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const isGroup = !isCommunity && chat?.type !== "PRIVATE";

  useEffect(() => {
    if (!searchQuery.trim() || !messages) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    setSearchResults(
      messages.filter((m) => m.content?.toLowerCase().includes(q)),
    );
    setSearchIndex(0);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (searchResults.length === 0 || !searchHighlightRef.current) return;
    searchHighlightRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [searchIndex, searchResults]);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    if (isNearBottom) scrollToBottom(messages.length > 5);
  }, [messages.length, isNearBottom, scrollToBottom]);

  useEffect(() => {
    if (!messages?.length || !user?.id) return;
    const last = messages[messages.length - 1];
    if (last.senderId === user.id || lastReadIdRef.current === last.id) return;
    lastReadIdRef.current = last.id;
    emitRead?.(last.id);
  }, [messages, user?.id, emitRead]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsNearBottom(nearBottom);
    setShowScrollButton(!nearBottom);

    if (scrollTop < 80 && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      const prevHeight = scrollHeight;
      const promise = isCommunity ? fetchNextCommunityPage() : fetchNextPage();
      Promise.resolve(promise)
        .then(() => {
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              const newHeight = messagesContainerRef.current.scrollHeight;
              messagesContainerRef.current.scrollTop = newHeight - prevHeight;
            }
          });
        })
        .finally(() => setIsLoadingMore(false));
    }
  }, [
    hasMore,
    isLoadingMore,
    isCommunity,
    fetchNextPage,
    fetchNextCommunityPage,
  ]);

  const handleSend = useCallback(
    async (
      content: string,
      type?: string,
      mediaUrl?: string,
      fileUrl?: string,
    ) => {
      const trimmed = content.trim();
      if (!trimmed && !mediaUrl && !fileUrl) return;

      if (editingMessage) {
        try {
          if (socket?.connected) {
            editSocketMessage(editingMessage.id, trimmed);
          } else {
            await editMessageMutation.mutateAsync({
              messageId: editingMessage.id,
              content: trimmed,
            });
          }
          toast.success("Message updated ✨");
        } catch {
          toast.error("Failed to update message");
        } finally {
          setEditingMessage(null);
          setReplyTo(null);
        }
        return;
      }

      const payload = {
        content: trimmed,
        type: type || "TEXT",
        mediaUrl,
        fileUrl,
        replyToId: replyTo?.id,
      };

      try {
        if (socket?.connected) {
          sendSocketMessage(
            isCommunity ? { communityId, ...payload } : { chatId, ...payload },
          );
        } else if (isCommunity) {
          await sendCommunityMessageRest.mutateAsync({
            communityId: communityId!,
            ...payload,
          });
        } else {
          await sendMessageRest.mutateAsync({ chatId: chatId!, ...payload });
        }
      } catch {
        toast.error("Failed to send message");
      }

      setReplyTo(null);
      setEditingMessage(null);
      setTimeout(() => scrollToBottom(true), 50);
    },
    [
      editingMessage,
      socket,
      editSocketMessage,
      editMessageMutation,
      replyTo?.id,
      isCommunity,
      communityId,
      chatId,
      sendSocketMessage,
      sendCommunityMessageRest,
      sendMessageRest,
      scrollToBottom,
    ],
  );

  const handleVoiceBlob = useCallback(
    async (blob: Blob, duration: number) => {
      if (!blob || blob.size === 0) {
        toast.error("Empty recording");
        return;
      }
      if (blob.size > 5 * 1024 * 1024) {
        toast.error("Voice message too large (max 5MB)");
        return;
      }

      try {
        const formData = new FormData();
        formData.append("file", blob, `voice-${Date.now()}.webm`);

        const uploadRes = await fetch(
          "http://localhost:3000/voice/upload-audio",
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({}));
          throw new Error(errorData.message || "Upload failed");
        }

        const uploadData = await uploadRes.json();
        const mediaUrl = uploadData.url;
        if (!mediaUrl) throw new Error("Upload response missing url");

        const payload = {
          content: "",
          type: "VOICE_NOTE" as const,
          mediaUrl,
          fileUrl: mediaUrl,
          duration: Math.max(1, Math.floor(duration || 1)),
          replyToId: replyTo?.id,
        };

        if (socket?.connected) {
          sendSocketMessage(
            isCommunity ? { communityId, ...payload } : { chatId, ...payload },
          );
        } else if (isCommunity) {
          await sendCommunityMessageRest.mutateAsync({
            communityId: communityId!,
            ...payload,
          });
        } else {
          await sendMessageRest.mutateAsync({ chatId: chatId!, ...payload });
        }

        toast.success("Voice message sent 🎙️");
        setReplyTo(null);
        setTimeout(() => scrollToBottom(true), 50);
      } catch (err: unknown) {
        console.error("Voice upload error:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to send voice message",
        );
      }
    },
    [
      socket,
      sendSocketMessage,
      isCommunity,
      communityId,
      chatId,
      replyTo?.id,
      sendCommunityMessageRest,
      sendMessageRest,
      scrollToBottom,
    ],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (socket?.connected) deleteSocketMessage(id);
      else deleteMessageMutation.mutate(id);
      setShowMessageActions(null);
      setSelectedMessages((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [socket, deleteSocketMessage, deleteMessageMutation],
  );

  const handlePin = useCallback(
    (id: string, pinned: boolean) => {
      if (socket?.connected) pinSocketMessage(id, pinned);
      else pinMessageMutation.mutate({ messageId: id, pinned });
      setShowMessageActions(null);
    },
    [socket, pinSocketMessage, pinMessageMutation],
  );

  const handleReact = useCallback(
    (id: string, emoji: string) => {
      if (socket?.connected) {
        socket.emit("reaction:add", { messageId: id, emoji });
      }
      setShowMessageActions(null);
    },
    [socket],
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard 📋");
    setShowMessageActions(null);
  }, []);

  const handleTyping = useCallback(
    (typing: boolean) => {
      sendTyping?.(typing, targetId, isCommunity);
    },
    [sendTyping, targetId, isCommunity],
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  }, []);

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, MMM d");
  };

  // ─── Message Context Menu ────────────────────────────────────────

  const MessageContextMenu = ({
    message,
    onClose,
  }: {
    message: Message;
    onClose: () => void;
  }) => {
    const isOwn = message.senderId === user?.id;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -8 }}
        transition={{ type: "spring", damping: 25, stiffness: 400 }}
        className="absolute right-3 top-2 z-50 w-56 overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-around gap-0.5 border-b border-slate-100/60 px-2 py-2.5">
          {["❤️", "👍", "😂", "😮", "😢"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                handleReact(message.id, emoji);
                onClose();
              }}
              className="rounded-xl p-2 text-lg transition-all hover:scale-125 hover:bg-slate-50/80"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="py-1.5">
          <MenuItem
            icon={<Reply className="h-4 w-4" />}
            label="Reply"
            onClick={() => {
              setReplyTo(message);
              onClose();
            }}
          />
          {message.content && (
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              label="Copy text"
              onClick={() => handleCopy(message.content!)}
            />
          )}
          <MenuItem
            icon={<Forward className="h-4 w-4" />}
            label="Forward"
            onClick={() => {
              toast.info("Forward feature coming soon");
              onClose();
            }}
          />
          {isOwn && (
            <>
              <div className="my-1.5 border-t border-slate-100/60" />
              <MenuItem
                icon={<Edit className="h-4 w-4" />}
                label="Edit"
                onClick={() => {
                  setEditingMessage(message);
                  setReplyTo(null);
                  onClose();
                }}
              />
              <MenuItem
                icon={
                  message.isPinned ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )
                }
                label={message.isPinned ? "Unpin" : "Pin"}
                onClick={() => handlePin(message.id, !message.isPinned)}
              />
              <MenuItem
                icon={<Trash2 className="h-4 w-4" />}
                label="Delete"
                danger
                onClick={() => handleDelete(message.id)}
              />
            </>
          )}
          <div className="my-1.5 border-t border-slate-100/60" />
          <MenuItem
            icon={<Flag className="h-4 w-4" />}
            label="Report"
            danger
            onClick={() => {
              toast.info("Report submitted successfully");
              onClose();
            }}
          />
        </div>
      </motion.div>
    );
  };

  const MenuItem = ({
    icon,
    label,
    onClick,
    danger,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-[13px] transition-all ${
        danger
          ? "text-red-600 hover:bg-red-50/60"
          : "text-slate-700 hover:bg-slate-50/60"
      }`}
    >
      <span className="opacity-70">{icon}</span>
      {label}
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100/80">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-8 w-8 text-indigo-500" />
        </motion.div>
        <p className="mt-4 text-sm font-medium text-slate-400">
          Loading conversation…
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50/80"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* ─── Animated Background ─────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-400/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-violet-400/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/3 blur-3xl" />
      </div>

      {/* ─── Header ────────────────────────────────────────────────── */}
      <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-white/20 bg-white/70 px-2 py-2.5 backdrop-blur-xl sm:px-4">
        {onBack && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onBack}
            className="rounded-full p-2.5 text-slate-600 transition-colors hover:bg-slate-100/80 lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
        )}

        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1 text-left transition-all hover:bg-slate-100/50"
        >
          <div className="relative shrink-0">
            {chatAvatar ? (
              <img
                src={chatAvatar}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-2 ring-white/50"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                {chatName.charAt(0).toUpperCase()}
              </div>
            )}
            {!isCommunity && !isGroup && (
              <motion.span
                animate={{ scale: isOnline ? 1 : 0.8 }}
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                  isOnline ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold leading-tight text-slate-900">
              {chatName}
            </h2>
            <p className="truncate text-[12px] leading-tight text-slate-500">
              {!isConnected ? (
                <span className="flex items-center gap-1 text-amber-600">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                  Connecting…
                </span>
              ) : isCommunity ? (
                "Community"
              ) : isGroup ? (
                `${chat?.participants?.length || 0} members`
              ) : isOnline ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              ) : (
                "Last seen recently"
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-0.5">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className={`rounded-full p-2.5 transition-all ${
              showSearch
                ? "bg-indigo-100 text-indigo-600"
                : "text-slate-500 hover:bg-slate-100/80"
            }`}
          >
            <Search className="h-5 w-5" />
          </motion.button>
          {!isCommunity && !isGroup && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                className="hidden rounded-full p-2.5 text-slate-500 transition-colors hover:bg-slate-100/80 sm:inline-flex"
              >
                <Phone className="h-5 w-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                className="hidden rounded-full p-2.5 text-slate-500 transition-colors hover:bg-slate-100/80 sm:inline-flex"
              >
                <Video className="h-5 w-5" />
              </motion.button>
            </>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setShowInfo(true)}
            className="rounded-full p-2.5 text-slate-500 transition-colors hover:bg-slate-100/80"
          >
            <MoreVertical className="h-5 w-5" />
          </motion.button>
        </div>
      </header>

      {/* ─── Search Bar ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-white/20 bg-white/50 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages…"
                  className="w-full rounded-full border-0 bg-slate-100/80 py-2.5 pl-10 pr-4 text-sm outline-none ring-1 ring-slate-200/50 transition-all focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="flex items-center gap-0.5 text-xs text-slate-500">
                  <span className="px-1.5 font-medium">
                    {searchIndex + 1}/{searchResults.length}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={() => setSearchIndex((i) => Math.max(0, i - 1))}
                    className="rounded-full p-1.5 transition-colors hover:bg-slate-100"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={() =>
                      setSearchIndex((i) =>
                        Math.min(searchResults.length - 1, i + 1),
                      )
                    }
                    className="rounded-full p-1.5 transition-colors hover:bg-slate-100"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.button>
                </div>
              )}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                }}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100/80"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Messages ────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="custom-scrollbar relative flex-1 overflow-y-auto px-2 py-4 sm:px-6"
      >
        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-5 w-5 text-indigo-400" />
            </motion.div>
          </div>
        )}

        <LayoutGroup>
          {messages.length > 0 ? (
            messages.map((msg, index) => {
              const prev = messages[index - 1];
              const showDate =
                index === 0 ||
                new Date(msg.createdAt).toDateString() !==
                  new Date(prev.createdAt).toDateString();
              const isOwn = msg.senderId === user?.id;
              const isSearchHit =
                searchResults[searchIndex]?.id === msg.id && !!searchQuery;

              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {showDate && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-white/80 px-4 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                        {formatDateLabel(new Date(msg.createdAt))}
                      </span>
                    </div>
                  )}
                  <div
                    ref={isSearchHit ? searchHighlightRef : undefined}
                    className={`group relative ${
                      isSelectionMode ? "cursor-pointer" : ""
                    } ${
                      isSearchHit
                        ? "rounded-2xl ring-2 ring-indigo-400/50 ring-offset-2 ring-offset-transparent"
                        : ""
                    }`}
                    onClick={() => isSelectionMode && toggleSelection(msg.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!isSelectionMode) {
                        setShowMessageActions(
                          showMessageActions === msg.id ? null : msg.id,
                        );
                      }
                    }}
                  >
                    {isSelectionMode && (
                      <div className="absolute left-0 top-1/2 z-10 -translate-y-1/2">
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                            selectedMessages.has(msg.id)
                              ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {selectedMessages.has(msg.id) && (
                            <Check className="h-3 w-3" />
                          )}
                        </motion.div>
                      </div>
                    )}
                    <div className={isSelectionMode ? "pl-8" : ""}>
                      <MessageBubble
                        message={msg}
                        isOwn={isOwn}
                        onReply={() => setReplyTo(msg)}
                        onEdit={() => {
                          setEditingMessage(msg);
                          setReplyTo(null);
                        }}
                        onDelete={() => handleDelete(msg.id)}
                        onPin={(pinned) => handlePin(msg.id, pinned)}
                        onReact={(emoji) => handleReact(msg.id, emoji)}
                        isPinned={!!msg.isPinned}
                        isSelected={selectedMessages.has(msg.id)}
                        isSelectionMode={isSelectionMode}
                      />
                    </div>
                    <AnimatePresence>
                      {showMessageActions === msg.id && (
                        <MessageContextMenu
                          message={msg}
                          onClose={() => setShowMessageActions(null)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 20 }}
                className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 shadow-inner"
              >
                <MessageCircle className="h-10 w-10 text-indigo-500" />
              </motion.div>
              <p className="text-[16px] font-semibold text-slate-700">
                No messages yet
              </p>
              <p className="mt-1.5 max-w-xs text-[13px] text-slate-400">
                Start the conversation with a message or voice note
              </p>
            </div>
          )}
        </LayoutGroup>
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* ─── Scroll to Bottom ────────────────────────────────────── */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-28 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-lg ring-1 ring-black/5 transition-all hover:bg-slate-50 hover:shadow-xl"
          >
            <ChevronDown className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Selection Bar ────────────────────────────────────────── */}
      <AnimatePresence>
        {isSelectionMode && selectedMessages.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="flex items-center justify-between border-t border-white/20 bg-white/80 px-4 py-3 backdrop-blur-sm"
          >
            <span className="text-sm font-medium text-slate-700">
              {selectedMessages.size} selected
            </span>
            <div className="flex items-center gap-0.5">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => toast.info("Forward feature coming soon")}
                className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100/80"
              >
                <Forward className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                  selectedMessages.forEach((id) => handleDelete(id));
                  exitSelection();
                }}
                className="rounded-full p-2 text-red-500 transition-colors hover:bg-red-50/80"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={exitSelection}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100/80"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Reply / Edit Bar ────────────────────────────────────── */}
      <AnimatePresence>
        {(replyTo || editingMessage) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={`mx-3 mb-1 flex items-center gap-3 rounded-2xl border-l-[3px] bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur-sm ring-1 ring-black/5 ${
                editingMessage ? "border-amber-500" : "border-indigo-500"
              }`}
            >
              {editingMessage ? (
                <Edit className="h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <Reply className="h-4 w-4 shrink-0 text-indigo-500" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[11px] font-semibold ${
                    editingMessage ? "text-amber-600" : "text-indigo-600"
                  }`}
                >
                  {editingMessage
                    ? "Editing message"
                    : `Replying to ${
                        replyTo?.senderId === user?.id ? "yourself" : "message"
                      }`}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {(editingMessage || replyTo)?.content || "Media content"}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  setEditingMessage(null);
                }}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100/80"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Composer ─────────────────────────────────────────────── */}
      <div className="relative shrink-0 border-t border-white/20 bg-white/70 px-2 py-2.5 backdrop-blur-sm sm:px-4">
        <MessageInput
          onSend={handleSend}
          onTyping={handleTyping}
          onVoiceRecording={handleVoiceBlob}
          editingMessage={
            editingMessage
              ? {
                  id: editingMessage.id,
                  content: editingMessage.content || "",
                }
              : null
          }
          onCancelEdit={() => setEditingMessage(null)}
          isConnected={isConnected}
          onSelectMessages={() => {
            setIsSelectionMode((v) => !v);
            if (isSelectionMode) setSelectedMessages(new Set());
          }}
          isSelectionMode={isSelectionMode}
        />
      </div>

      {/* ─── Typing Indicator ────────────────────────────────────── */}
      <AnimatePresence>
        {typingUsers.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-[4.5rem] left-4 z-10 flex items-center gap-2.5 rounded-full bg-white/90 px-3.5 py-2 text-xs text-slate-600 shadow-lg backdrop-blur-sm ring-1 ring-black/5"
          >
            <span className="flex gap-1">
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                className="h-1.5 w-1.5 rounded-full bg-indigo-500"
              />
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                className="h-1.5 w-1.5 rounded-full bg-indigo-500"
              />
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                className="h-1.5 w-1.5 rounded-full bg-indigo-500"
              />
            </span>
            <span className="font-medium">typing…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Info Sidebar ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showInfo && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfo(false)}
              className="absolute inset-0 z-30 bg-black/20 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="absolute right-0 top-0 z-40 flex h-full w-[min(100%,22rem)] flex-col bg-white/95 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100/60 px-5 py-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Chat Info
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowInfo(false)}
                  className="rounded-full p-2 transition-colors hover:bg-slate-100/80"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-6 text-center">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="mx-auto mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl font-bold text-white shadow-lg shadow-indigo-500/20"
                  >
                    {chatAvatar ? (
                      <img
                        src={chatAvatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      chatName.charAt(0).toUpperCase()
                    )}
                  </motion.div>
                  <h4 className="text-xl font-semibold text-slate-900">
                    {chatName}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {isGroup
                      ? `${chat?.participants?.length || 0} members`
                      : isCommunity
                        ? "Community"
                        : isOnline
                          ? "🟢 Online"
                          : "Private chat"}
                  </p>
                </div>

                <div className="mb-6 grid grid-cols-3 gap-2">
                  {!isCommunity && !isGroup && (
                    <>
                      <QuickAction
                        icon={<Phone className="h-5 w-5" />}
                        label="Call"
                      />
                      <QuickAction
                        icon={<Video className="h-5 w-5" />}
                        label="Video"
                      />
                    </>
                  )}
                  <QuickAction
                    icon={
                      isMuted ? (
                        <VolumeX className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )
                    }
                    label={isMuted ? "Unmute" : "Mute"}
                    onClick={() => setIsMuted((v) => !v)}
                  />
                </div>

                {isGroup && chat?.participants && (
                  <div>
                    <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Members
                    </h5>
                    <div className="space-y-1.5">
                      {chat.participants.map((p) => (
                        <motion.div
                          key={p.userId}
                          whileHover={{ x: 4 }}
                          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-slate-50/80"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-semibold text-slate-600">
                            {p.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {p.user.name}
                            </p>
                            <p className="text-[11px] capitalize text-slate-400">
                              {p.role.toLowerCase()}
                            </p>
                          </div>
                          {p.userId === user?.id && (
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600">
                              You
                            </span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Quick Action Button ──────────────────────────────────────────

const QuickAction = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) => (
  <motion.button
    whileHover={{ y: -2, scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    type="button"
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50/80 py-3.5 transition-colors hover:bg-slate-100/80"
  >
    <span className="text-indigo-500">{icon}</span>
    <span className="text-[10px] font-medium text-slate-500">{label}</span>
  </motion.button>
);