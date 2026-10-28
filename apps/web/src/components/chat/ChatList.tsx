import React, { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import type { Chat } from "../../hooks/useChat";
import {
  Users,
  User,
  Image as ImageIcon,
  Mic,
  FileText,
  Sticker,
  MapPin,
  Pin,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  MoreVertical,
  Star,
  StarOff,
  Trash2,
  Archive,
  EyeOff,
  Flag,
  Copy,
  Link2,
  MessageCircle,
  ChevronRight,
  Sparkles,
  Circle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface ChatListProps {
  chats: Chat[];
  selectedChatId?: string;
  onSelectChat: (chatId: string) => void;
  onlineUserIds?: Set<string>;
  isPinned?: boolean;
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const MEDIA_PREVIEW: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  IMAGE: { icon: ImageIcon, label: "Photo", color: "text-blue-500" },
  VIDEO: { icon: ImageIcon, label: "Video", color: "text-red-500" },
  AUDIO: { icon: Mic, label: "Audio", color: "text-purple-500" },
  VOICE_NOTE: { icon: Mic, label: "Voice note", color: "text-indigo-500" },
  FILE: { icon: FileText, label: "File", color: "text-orange-500" },
  GIF: { icon: ImageIcon, label: "GIF", color: "text-pink-500" },
  STICKER: { icon: Sticker, label: "Sticker", color: "text-emerald-500" },
  LOCATION: { icon: MapPin, label: "Location", color: "text-green-500" },
};

// Animation variants
const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

const hoverScale = { scale: 1.02 };
const tapScale = { scale: 0.98 };

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  onlineUserIds,
  isPinned = false,
}) => {
  const { user } = useAuth();
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<string | null>(null);

  const getOtherParticipant = (chat: Chat) =>
    chat.participants?.find((p) => p.userId !== user?.id)?.user;

  const getMyParticipant = (chat: Chat) =>
    chat.participants?.find((p) => p.userId === user?.id);

  const getChatName = (chat: Chat) => {
    if (chat.type === "PRIVATE") {
      return getOtherParticipant(chat)?.name || "Unknown User";
    }
    return chat.name || "Group Chat";
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.type === "PRIVATE") return getOtherParticipant(chat)?.avatarUrl;
    return chat.avatarUrl;
  };

  const isOnline = (chat: Chat) => {
    if (chat.type !== "PRIVATE" || !onlineUserIds) return false;
    const other = getOtherParticipant(chat);
    return other ? onlineUserIds.has(other.id) : false;
  };

  const isUnread = (chat: Chat) => {
    if (chat.unreadCount && chat.unreadCount > 0) return true;
    const lastMsg = chat.messages?.[0];
    if (!lastMsg || lastMsg.senderId === user?.id) return false;
    const me = getMyParticipant(chat);
    if (!me?.lastReadAt) return true;
    return new Date(lastMsg.createdAt) > new Date(me.lastReadAt);
  };

  const getUnreadCount = (chat: Chat) => {
    if (chat.unreadCount && chat.unreadCount > 0) return chat.unreadCount;
    const lastMsg = chat.messages?.[0];
    if (!lastMsg || lastMsg.senderId === user?.id) return 0;
    const me = getMyParticipant(chat);
    if (!me?.lastReadAt) return 1;
    return new Date(lastMsg.createdAt) > new Date(me.lastReadAt) ? 1 : 0;
  };

  const renderLastMessage = (chat: Chat) => {
    const msg = chat.messages?.[0];
    if (!msg) return <span className="italic">No messages yet</span>;
    if (msg.isDeleted) return <span className="italic">Message deleted</span>;

    const isOwn = msg.senderId === user?.id;
    const prefix =
      chat.type !== "PRIVATE" && !isOwn
        ? `${msg.sender?.name?.split(" ")[0] || "Someone"}: `
        : isOwn
          ? "You: "
          : "";

    // Message status
    // The server stores the sender's own receipt too, so only count other people
    const readByOthers = msg.readReceipts?.some((r) => r.userId !== msg.senderId) ?? false;
    const statusIcon = isOwn ? (
      readByOthers ? (
        <CheckCheck className="w-3 h-3 text-sky-400 inline-block mr-0.5" />
      ) : msg.delivered ? (
        <CheckCheck className="w-3 h-3 text-slate-400 inline-block mr-0.5" />
      ) : (
        <Check className="w-3 h-3 text-slate-300 inline-block mr-0.5" />
      )
    ) : null;

    if (msg.type === "CORRECTION") {
      return (
        <>
          {statusIcon}
          {prefix}
          <span className="line-clamp-1">✏️ {isOwn ? "Sent a correction" : "Corrected your message"}</span>
        </>
      );
    }

    if (msg.content) {
      return (
        <>
          {statusIcon}
          {prefix}
          <span className="line-clamp-1">{msg.content}</span>
        </>
      );
    }

    const media = MEDIA_PREVIEW[msg.type] || MEDIA_PREVIEW.FILE;
    const Icon = media.icon;
    return (
      <>
        {statusIcon}
        {prefix}
        <span className="inline-flex items-center gap-1">
          <Icon className={`w-3 h-3 shrink-0 ${media.color}`} />
          {media.label}
        </span>
      </>
    );
  };

  const handleChatAction = (action: string, chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    const name = chat ? getChatName(chat) : "Chat";
    switch (action) {
      case "pin":
        toast.success(`${name} ${isPinned ? "unpinned" : "pinned"}`);
        break;
      case "archive":
        toast.success(`${name} archived`);
        break;
      case "mute":
        toast.success(`${name} muted`);
        break;
      case "delete":
        toast.warning(`${name} deleted`);
        break;
      case "mark-read":
        toast.success(`${name} marked as read`);
        break;
      case "report":
        toast.info(`${name} reported`);
        break;
      default:
        toast.info(`Action: ${action}`);
    }
    setShowContextMenu(null);
  };

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aPinned = getMyParticipant(a)?.isPinned ? 1 : 0;
      const bPinned = getMyParticipant(b)?.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      
      // Sort by last message time
      const aTime = a.messages?.[0]?.createdAt || a.updatedAt;
      const bTime = b.messages?.[0]?.createdAt || b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, user?.id]);

  const contextMenuItems = [
    { icon: isPinned ? StarOff : Star, label: isPinned ? "Unpin" : "Pin", action: "pin" },
    { icon: Archive, label: "Archive", action: "archive" },
    { icon: BellOff, label: "Mute", action: "mute" },
    { icon: EyeOff, label: "Mark as read", action: "mark-read" },
    { icon: Copy, label: "Copy link", action: "copy" },
    { icon: Trash2, label: "Delete", action: "delete", danger: true },
    { icon: Flag, label: "Report", action: "report", danger: true },
  ];

  if (sortedChats.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 20 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center"
        >
          <MessageCircle className="w-7 h-7 text-slate-400" />
        </motion.div>
        <div>
          <p className="text-sm font-semibold text-slate-600">No conversations</p>
          <p className="text-xs text-slate-400 mt-0.5">Start a new chat to connect</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
      <AnimatePresence mode="popLayout">
        {sortedChats.map((chat, index) => {
          const isSelected = selectedChatId === chat.id;
          const avatarUrl = getChatAvatar(chat);
          const name = getChatName(chat);
          const isGroup = chat.type !== "PRIVATE";
          const online = isOnline(chat);
          const unread = isUnread(chat);
          const unreadCount = getUnreadCount(chat);
          const me = getMyParticipant(chat);
          const lastMsg = chat.messages?.[0];
          const isHovered = hoveredChatId === chat.id;
          const isContextOpen = showContextMenu === chat.id;

          // Generate avatar colors
          const avatarColors = [
            "from-indigo-500 to-violet-600",
            "from-pink-500 to-rose-600",
            "from-emerald-500 to-teal-600",
            "from-blue-500 to-cyan-600",
            "from-purple-500 to-pink-600",
            "from-amber-500 to-orange-600",
          ];
          const colorIndex = chat.id.charCodeAt(0) % avatarColors.length;

          return (
            <motion.div
              key={chat.id}
              layout
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={listItemVariants}
              transition={{ duration: 0.2, delay: index * 0.02 }}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => {
                setHoveredChatId(null);
                setShowContextMenu(null);
              }}
              className="relative"
            >
              {/* Chat Item */}
              <motion.div
                whileHover={!isSelected ? hoverScale : undefined}
                whileTap={tapScale}
                onClick={() => onSelectChat(chat.id)}
                className={`relative p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3.5 ${
                  isSelected
                    ? "bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200/60 shadow-md shadow-indigo-500/5"
                    : "bg-transparent hover:bg-slate-50/80 border border-transparent hover:border-slate-200/60"
                } ${unread ? "bg-opacity-70" : ""}`}
              >
                {/* Selection Indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="selectedIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-r-full shadow-lg shadow-indigo-500/30"
                  />
                )}

                {/* Avatar */}
                <div className="relative shrink-0">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="relative"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        className="w-13 h-13 rounded-2xl object-cover border-2 border-white shadow-sm"
                      />
                    ) : (
                      <div
                        className={`w-13 h-13 rounded-2xl font-bold text-base flex items-center justify-center bg-gradient-to-br ${avatarColors[colorIndex]} text-white shadow-lg shadow-${avatarColors[colorIndex].split(" ")[0]}/20`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Chat Type Badge */}
                    <div
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center border-2 border-white shadow-sm ${
                        isGroup
                          ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                          : "bg-white text-slate-500 border-slate-200"
                      }`}
                    >
                      {isGroup ? (
                        <Users className="w-2.5 h-2.5" />
                      ) : (
                        <User className="w-2.5 h-2.5" />
                      )}
                    </div>

                    {/* Online Status */}
                    {online && (
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                      />
                    )}
                  </motion.div>
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {me?.isPinned && (
                        <Pin className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <h4
                        className={`font-semibold text-sm truncate ${
                          isSelected
                            ? "text-indigo-950"
                            : unread
                              ? "text-slate-900"
                              : "text-slate-700"
                        }`}
                      >
                        {name}
                      </h4>
                      {isGroup && (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {chat.participants?.length || 0}
                        </span>
                      )}
                      {me?.isMuted && (
                        <BellOff className="w-3 h-3 text-slate-300 shrink-0" />
                      )}
                    </div>
                    {lastMsg && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`text-[10px] shrink-0 flex items-center gap-1 ${
                          unread
                            ? "text-indigo-600 font-semibold"
                            : "text-slate-400"
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5 opacity-50" />
                        {formatRelativeTime(lastMsg.createdAt)}
                      </motion.span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`text-xs truncate flex-1 flex items-center gap-0.5 ${
                        unread
                          ? "text-slate-800 font-medium"
                          : isSelected
                            ? "text-indigo-700/80 font-medium"
                            : "text-slate-500"
                      }`}
                    >
                      {renderLastMessage(chat)}
                    </div>

                    {/* Unread Badge */}
                    {unreadCount > 0 && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="shrink-0"
                      >
                        {unreadCount > 1 ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full min-w-[1.25rem] text-center shadow-sm shadow-indigo-500/30">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 block shadow-sm shadow-indigo-500/30" />
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Context Menu Trigger */}
                {isHovered && !isSelected && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowContextMenu(isContextOpen ? null : chat.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl bg-white/80 backdrop-blur-sm text-slate-400 hover:text-slate-600 hover:bg-white shadow-sm border border-slate-200/50 transition-all"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </motion.button>
                )}

                {/* Context Menu */}
                <AnimatePresence>
                  {isContextOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -5 }}
                      transition={{ type: "spring", damping: 20 }}
                      className="absolute right-0 top-full mt-1 z-10 min-w-[180px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-1.5">
                        {contextMenuItems.map((item) => (
                          <motion.button
                            key={item.action}
                            whileHover={{ x: 4 }}
                            onClick={() => handleChatAction(item.action, chat.id)}
                            className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-medium transition-colors ${
                              item.danger
                                ? "text-red-600 hover:bg-red-50"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <item.icon className={`w-3.5 h-3.5 ${item.danger ? "text-red-400" : "text-slate-400"}`} />
                            {item.label}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};