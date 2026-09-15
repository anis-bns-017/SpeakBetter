import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Search,
  X,
  Smile,
  Send,
  Reply,
  Pin,
  Trash2,
  Edit,
  Copy,
  Check,
  MoreVertical,
  Flag,
  Image,
  File,
  Mic,
  Video,
  Gift,
  Volume2,
  VolumeX,
  MessageCircle,
  Settings,
  Filter,
  CheckCheck,
  Paperclip,
  Music,
  ShieldCheck,
  Loader2,
  ArrowDown,
  RotateCcw,
  Languages,
  UserX,
  Sparkles,
  CornerDownRight,
  Maximize2,
  Minimize2,
  Link2,
  AtSign,
} from "lucide-react";
import { cn } from "../../../lib/utils";

// ============================================================
// Theme (self-contained fallback so the panel works standalone)
// ============================================================

const THEME = {
  colors: {
    background: {
      primary: "#0a0a12",
      secondary: "#0f0f1a",
      tertiary: "#141422",
      card: "rgba(18, 18, 32, 0.96)",
    },
    border: {
      primary: "rgba(255,255,255,0.08)",
      strong: "rgba(255,255,255,0.14)",
    },
    text: {
      primary: "#f4f4f8",
      secondary: "#c4c4d4",
      muted: "#8b8b9e",
    },
    accent: {
      primary: "#818cf8",
      secondary: "#a78bfa",
      cyan: "#22d3ee",
      success: "#34d399",
      warning: "#fbbf24",
      error: "#f87171",
    },
    status: {
      online: "#34d399",
    },
  },
} as const;

/**
 * Optional: re-export / merge with your room theme.
 * import { THEME as ROOM_THEME } from "../VoiceRoomView.theme";
 * Object.assign(THEME.colors, ROOM_THEME.colors);
 */

// ============================================================
// Types
// ============================================================

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  createdAt: string;
  isPinned?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  replyTo?: Message;
  reactions?: Record<string, string[]>;
  attachments?: Attachment[];
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  isHighlighted?: boolean;
  /** Optional nested sender object some APIs attach */
  sender?: { id?: string; name?: string; avatar?: string };
}

interface Attachment {
  id: string;
  type: "image" | "video" | "audio" | "file" | "gif" | "sticker";
  url: string;
  name?: string;
  size?: number;
  duration?: number;
}

interface SenderGroup {
  senderId: string;
  senderName: string;
  isOwn: boolean;
  messages: Message[];
}

interface DateGroup {
  key: string;
  label: string;
  messages: SenderGroup[];
}

interface ChatPanelProps {
  messages: Message[];
  newMessage: string;
  replyTo: Message | null;
  typingUsers: Set<string>;
  currentUserId: string;
  isHost: boolean;
  isModerator: boolean;
  showEmojiPicker: boolean;
  onEmojiPickerToggle: () => void;
  onMessageChange: (text: string) => void;
  onSendMessage: () => void;
  onReply: (message: Message | null) => void;
  onPinMessage: (messageId: string, pinned: boolean) => void;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  onKickUser: (userId: string) => void;
  onMuteUser: (userId: string) => void;
  onTranslateMessage?: (messageId: string) => void;
  chatSearch: string;
  onChatSearchChange: (query: string) => void;
  showChatSearch: boolean;
  onToggleChatSearch: () => void;
  totalParticipants: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  endRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isNearBottom: boolean;
  onScroll: () => void;
  hasNewMessages: boolean;
  newMessageCount: number;
  onScrollToBottom: () => void;
  className?: string;
  onAttachFile?: () => void;
  onRecordAudio?: () => void;
  onSendGift?: (userId: string) => void;
  roomId?: string;
  /** Optional participant names for @mention suggestions */
  participantNames?: string[];
}

// ============================================================
// Data
// ============================================================

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    icon: "😊",
    emojis: [
      "😊",
      "😂",
      "🤣",
      "❤️",
      "🔥",
      "🥰",
      "😍",
      "🤩",
      "😎",
      "🥳",
      "😇",
      "🤗",
      "😘",
      "🥺",
      "😭",
      "😤",
      "😡",
      "🤬",
      "😱",
      "🤔",
      "😴",
      "🙄",
      "😮",
      "😢",
      "😆",
      "😉",
      "😌",
      "🤭",
      "🫡",
      "🫶",
      "💀",
      "👀",
      "✨",
      "💖",
      "💯",
    ],
  },
  {
    name: "Gestures",
    icon: "👍",
    emojis: [
      "👍",
      "👎",
      "👏",
      "🙌",
      "🤝",
      "✌️",
      "🤞",
      "👊",
      "💪",
      "🙏",
      "🤲",
      "👐",
      "🤙",
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "👌",
      "🤌",
      "☝️",
      "👇",
      "👉",
      "👈",
      "🤘",
      "🤟",
      "🫶",
    ],
  },
  {
    name: "Activities",
    icon: "🎉",
    emojis: [
      "🎉",
      "🎊",
      "🎈",
      "🎁",
      "🏆",
      "🏅",
      "🥇",
      "🥈",
      "🥉",
      "🎯",
      "🎳",
      "🎮",
      "🎲",
      "♟️",
      "🎪",
      "🎨",
      "🎭",
      "🎤",
      "⚽",
      "🏀",
      "🎸",
      "🎧",
      "🎵",
      "🎶",
      "🎬",
      "🎃",
      "🎄",
    ],
  },
  {
    name: "Objects",
    icon: "💡",
    emojis: [
      "💡",
      "🔑",
      "🔓",
      "🔒",
      "🔐",
      "🛡️",
      "🪄",
      "🧹",
      "🪣",
      "🧺",
      "🪑",
      "🛋️",
      "🖼️",
      "🧿",
      "🪔",
      "📚",
      "📌",
      "📎",
      "💻",
      "📱",
      "🎁",
      "💎",
      "🎀",
      "🔔",
    ],
  },
  {
    name: "Symbols",
    icon: "💯",
    emojis: [
      "💯",
      "❗",
      "❓",
      "❕",
      "❌",
      "✅",
      "⭕",
      "🔄",
      "🔁",
      "🔂",
      "▶️",
      "⏸️",
      "⏹️",
      "⏺️",
      "🔽",
      "🔼",
      "⏩",
      "⭐",
      "🌟",
      "💥",
      "⚡",
      "❤️‍🔥",
      "🚀",
      "☑️",
      "‼️",
    ],
  },
];

const QUICK_REACTIONS = [
  "❤️",
  "🔥",
  "😂",
  "🥺",
  "💯",
  "👏",
  "🎉",
  "👍",
  "🙏",
  "😍",
  "🤯",
  "💪",
];

const QUICK_REPLIES = [
  "Thanks!",
  "I agree 👍",
  "Good point!",
  "Can you explain?",
  "One moment...",
  "That's awesome!",
];

const MAX_MESSAGE_LENGTH = 2000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

// ============================================================
// Helpers
// ============================================================

function safeDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(date: string): string {
  const d = safeDate(date);
  return d ? format(d, "h:mm a") : "";
}

function formatDateSeparator(date: string): string {
  const d = safeDate(date);
  if (!d) return "";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

function dayKey(date: string): string {
  const d = safeDate(date);
  if (!d) return date;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "?"
  );
}

function getTimeAgo(date: string): string {
  const d = safeDate(date);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

function formatFileSize(size?: number): string {
  if (!size || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function resolveSenderName(msg: Message): string {
  return msg.senderName?.trim() || msg.sender?.name?.trim() || "Unknown User";
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Soft chime for new messages (no external asset). */
function playMessageChime() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    window.setTimeout(() => ctx.close(), 400);
  } catch {
    // Audio not available — silent fail.
  }
}

function renderRichText(text: string, searchQuery: string): React.ReactNode {
  const cleanQuery = searchQuery.trim();
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  // Combined tokenizer for URLs, mentions, markdown, and search hits
  const tokenRe =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s<]+|@[a-zA-Z0-9_.-]+)/gi;

  const pushPlain = (chunk: string, keyBase: string) => {
    if (!chunk) return;
    if (!cleanQuery) {
      nodes.push(<React.Fragment key={keyBase}>{chunk}</React.Fragment>);
      return;
    }
    const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = chunk.split(new RegExp(`(${escaped})`, "gi"));
    parts.forEach((part, i) => {
      if (part.toLowerCase() === cleanQuery.toLowerCase()) {
        nodes.push(
          <mark
            key={`${keyBase}-h-${i}`}
            className="rounded px-0.5"
            style={{
              background: "rgba(250, 204, 21, 0.28)",
              color: THEME.colors.text.primary,
            }}
          >
            {part}
          </mark>,
        );
      } else if (part) {
        nodes.push(
          <React.Fragment key={`${keyBase}-p-${i}`}>{part}</React.Fragment>,
        );
      }
    });
  };

  let match: RegExpExecArray | null;
  const re = new RegExp(tokenRe.source, tokenRe.flags);
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(text.slice(lastIndex, match.index), `t-${lastIndex}`);
    }
    const token = match[0];
    const key = `tok-${match.index}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (
      token.startsWith("*") &&
      token.endsWith("*") &&
      !token.startsWith("**")
    ) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded px-1 py-0.5 text-[0.85em] font-mono"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: THEME.colors.accent.cyan,
          }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (/^https?:\/\//i.test(token)) {
      nodes.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 break-all hover:opacity-90"
          style={{ color: THEME.colors.accent.cyan }}
          onClick={(e) => e.stopPropagation()}
        >
          {token}
        </a>,
      );
    } else if (token.startsWith("@")) {
      nodes.push(
        <span
          key={key}
          className="font-semibold rounded px-0.5"
          style={{
            color: THEME.colors.accent.secondary,
            background: "rgba(167,139,250,0.12)",
          }}
        >
          {token}
        </span>,
      );
    } else {
      pushPlain(token, key);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    pushPlain(text.slice(lastIndex), `t-${lastIndex}`);
  }

  return nodes.length ? nodes : text;
}

function getAttachmentIcon(type: Attachment["type"]) {
  switch (type) {
    case "image":
      return Image;
    case "video":
      return Video;
    case "audio":
      return Music;
    case "file":
      return File;
    case "gif":
      return Sparkles;
    case "sticker":
      return Smile;
    default:
      return File;
  }
}

function buildGroupedMessages(
  source: Message[],
  currentUserId: string,
): DateGroup[] {
  const groups: DateGroup[] = [];
  let currentDateGroup: DateGroup | null = null;
  let currentSenderGroup: SenderGroup | null = null;

  const sorted = [...source].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const msg of sorted) {
    const msgDate = new Date(msg.createdAt);
    const dateKey = dayKey(msg.createdAt);
    const senderName = resolveSenderName(msg);

    if (!currentDateGroup || currentDateGroup.key !== dateKey) {
      currentDateGroup = {
        key: dateKey,
        label: formatDateSeparator(msg.createdAt),
        messages: [],
      };
      groups.push(currentDateGroup);
      currentSenderGroup = null;
    }

    const lastMsg = currentSenderGroup?.messages.at(-1);
    const gap =
      lastMsg &&
      msgDate.getTime() - new Date(lastMsg.createdAt).getTime() >
        GROUP_WINDOW_MS;

    if (
      !currentSenderGroup ||
      currentSenderGroup.senderId !== msg.senderId ||
      gap
    ) {
      currentSenderGroup = {
        senderId: msg.senderId,
        senderName,
        isOwn: msg.senderId === currentUserId,
        messages: [],
      };
      currentDateGroup.messages.push(currentSenderGroup);
    }

    currentSenderGroup.messages.push({
      ...msg,
      senderName,
    });
  }

  return groups;
}

// ============================================================
// Avatar
// ============================================================

const UserAvatar: React.FC<{
  name?: string;
  avatarUrl?: string;
  size?: number;
  isOnline?: boolean;
  isSpeaking?: boolean;
}> = ({ name, avatarUrl, size = 32, isOnline = false, isSpeaking = false }) => {
  const safeName = String(name || "User").trim() || "User";
  const hue =
    safeName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-medium overflow-hidden",
          isSpeaking && "ring-2 ring-offset-1 ring-offset-transparent",
        )}
        style={{
          width: size,
          height: size,
          background: avatarUrl
            ? `url(${avatarUrl}) center/cover`
            : `linear-gradient(135deg, hsl(${hue}, 55%, 32%), hsl(${(hue + 40) % 360}, 50%, 22%))`,
          color: avatarUrl ? "transparent" : THEME.colors.text.primary,
          fontSize: Math.max(10, size / 2.8),
          boxShadow: isSpeaking
            ? `0 0 0 2px ${THEME.colors.accent.primary}`
            : undefined,
        }}
      >
        {!avatarUrl && initials(safeName)}
      </div>

      {isOnline && (
        <div
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
          style={{
            width: Math.max(7, size / 4),
            height: Math.max(7, size / 4),
            background: isSpeaking
              ? THEME.colors.accent.primary
              : THEME.colors.status.online,
            borderColor: THEME.colors.background.primary,
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// Reaction Picker
// ============================================================

const ReactionPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, y: 6 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9, y: 6 }}
    transition={{ duration: 0.14 }}
    className="absolute bottom-full left-0 mb-2 flex items-center gap-0.5 p-1.5 rounded-2xl border shadow-2xl z-50 backdrop-blur-md"
    style={{
      background: THEME.colors.background.card,
      borderColor: THEME.colors.border.primary,
    }}
    onClick={(e) => e.stopPropagation()}
  >
    {QUICK_REACTIONS.map((emoji) => (
      <button
        key={emoji}
        type="button"
        onClick={() => {
          onSelect(emoji);
          onClose();
        }}
        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-transform hover:scale-125 text-base"
        title={`React ${emoji}`}
      >
        {emoji}
      </button>
    ))}
    <button
      type="button"
      onClick={onClose}
      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
      style={{ color: THEME.colors.text.muted }}
      title="Close"
    >
      <X className="w-4 h-4" />
    </button>
  </motion.div>
);

// ============================================================
// Link preview (lightweight, no network fetch)
// ============================================================

const LinkPreview: React.FC<{ url: string }> = ({ url }) => {
  const host = extractHostname(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2.5 rounded-xl border px-3 py-2 hover:bg-white/[0.04] transition-colors"
      style={{ borderColor: THEME.colors.border.primary }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "rgba(34,211,238,0.10)" }}
      >
        <Link2
          className="w-3.5 h-3.5"
          style={{ color: THEME.colors.accent.cyan }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] font-semibold truncate"
          style={{ color: THEME.colors.text.primary }}
        >
          {host}
        </div>
        <div
          className="text-[10px] truncate"
          style={{ color: THEME.colors.text.muted }}
        >
          {url}
        </div>
      </div>
    </a>
  );
};

// ============================================================
// Attachment Preview
// ============================================================

const AttachmentList: React.FC<{ attachments: Attachment[] }> = ({
  attachments,
}) => (
  <div className="mt-2 grid grid-cols-2 gap-2">
    {attachments.map((att) => {
      const Icon = getAttachmentIcon(att.type);
      const isImage = att.type === "image" || att.type === "gif";
      const isVideo = att.type === "video";
      const isAudio = att.type === "audio";

      if (isImage) {
        return (
          <a
            key={att.id}
            href={att.url}
            target="_blank"
            rel="noreferrer"
            className="relative block overflow-hidden rounded-xl border group/attachment"
            style={{ borderColor: THEME.colors.border.primary }}
          >
            <img
              src={att.url}
              alt={att.name || "Attachment"}
              loading="lazy"
              className="w-full max-h-48 object-cover transition-transform duration-300 group-hover/attachment:scale-[1.03]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            {att.type === "gif" && (
              <span className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold bg-black/60 text-white">
                GIF
              </span>
            )}
          </a>
        );
      }

      if (isVideo) {
        return (
          <video
            key={att.id}
            src={att.url}
            controls
            preload="metadata"
            className="w-full max-h-52 rounded-xl border bg-black/30"
            style={{ borderColor: THEME.colors.border.primary }}
          />
        );
      }

      if (isAudio) {
        return (
          <div
            key={att.id}
            className="col-span-2 flex items-center gap-2 p-2 rounded-xl border"
            style={{
              borderColor: THEME.colors.border.primary,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(129,140,248,0.14)" }}
            >
              <Music
                className="w-4 h-4"
                style={{ color: THEME.colors.accent.primary }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-xs truncate"
                style={{ color: THEME.colors.text.primary }}
              >
                {att.name || "Audio message"}
              </div>
              {att.duration ? (
                <div
                  className="text-[10px]"
                  style={{ color: THEME.colors.text.muted }}
                >
                  {Math.round(att.duration)}s
                </div>
              ) : null}
            </div>
            <audio src={att.url} controls className="max-w-[150px] h-8" />
          </div>
        );
      }

      return (
        <a
          key={att.id}
          href={att.url}
          target="_blank"
          rel="noreferrer"
          className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-white/5 transition-colors"
          style={{
            borderColor: THEME.colors.border.primary,
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <Icon
            className="w-4 h-4 shrink-0"
            style={{ color: THEME.colors.accent.primary }}
          />
          <span
            className="text-xs truncate flex-1"
            style={{ color: THEME.colors.text.secondary }}
          >
            {att.name || "File"}
          </span>
          {att.size ? (
            <span
              className="text-[10px] shrink-0"
              style={{ color: THEME.colors.text.muted }}
            >
              {formatFileSize(att.size)}
            </span>
          ) : null}
        </a>
      );
    })}
  </div>
);

// ============================================================
// Message Bubble
// ============================================================

const MessageBubble: React.FC<{
  message: Message;
  isOwn: boolean;
  currentUserId: string;
  canModerate: boolean;
  onReply: () => void;
  onPin: () => void;
  onDelete: () => void;
  onEdit: (newContent: string) => void;
  onReact: (emoji: string) => void;
  onKick: () => void;
  onMute: () => void;
  onTranslate?: () => void;
  onSendGift?: () => void;
  onRetry?: () => void;
  onJumpToReply?: (messageId: string) => void;
  showHeader: boolean;
  isLastInGroup: boolean;
  isHighlighted?: boolean;
  searchQuery?: string;
  isUnreadDivider?: boolean;
}> = ({
  message,
  isOwn,
  currentUserId,
  canModerate,
  onReply,
  onPin,
  onDelete,
  onEdit,
  onReact,
  onKick,
  onMute,
  onTranslate,
  onSendGift,
  onRetry,
  onJumpToReply,
  showHeader,
  isLastInGroup,
  isHighlighted = false,
  searchQuery = "",
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const lastTap = useRef(0);

  const isSending = message.status === "sending";
  const isFailed = message.status === "failed";
  const canEdit = isOwn || canModerate;
  const canDelete = isOwn || canModerate;
  const displayName = resolveSenderName(message);

  const firstUrl = useMemo(() => {
    const m = message.content?.match(URL_REGEX);
    return m?.[0] ?? null;
  }, [message.content]);

  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  // Close menus on outside click
  useEffect(() => {
    if (!showMoreMenu && !showReactionPicker) return;
    const onDoc = (e: MouseEvent) => {
      if (!bubbleRef.current?.contains(e.target as Node)) {
        setShowMoreMenu(false);
        setShowReactionPicker(false);
        setShowActions(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showMoreMenu, showReactionPicker]);

  const handleCopy = useCallback(async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Message copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy message");
    }
  }, [message.content]);

  const submitEdit = useCallback(() => {
    const next = editContent.trim();
    if (!next) {
      toast.error("Message cannot be empty");
      return;
    }
    if (next === message.content.trim()) {
      setIsEditing(false);
      return;
    }
    onEdit(next);
    setIsEditing(false);
  }, [editContent, message.content, onEdit]);

  const reactionEntries = useMemo(
    () =>
      message.reactions
        ? Object.entries(message.reactions).filter(
            ([, users]) => Array.isArray(users) && users.length > 0,
          )
        : [],
    [message.reactions],
  );

  const openActions = useCallback(() => {
    setShowActions(true);
  }, []);

  // Mobile long-press
  const onTouchStart = useCallback(() => {
    longPressTimer.current = window.setTimeout(() => {
      setShowActions(true);
      setShowMoreMenu(true);
    }, 420);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Double-tap to quick-react ❤️
  const onDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      onReact("❤️");
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, [onReact]);

  if (message.isDeleted) {
    return (
      <div className={cn("flex mb-1", isOwn ? "justify-end" : "justify-start")}>
        <div
          className="px-3 py-2 rounded-xl border opacity-60"
          style={{ borderColor: THEME.colors.border.primary }}
        >
          <p
            className="text-xs italic"
            style={{ color: THEME.colors.text.muted }}
          >
            This message was deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={bubbleRef}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex mb-0.5 group",
        isOwn ? "justify-end" : "justify-start",
        showHeader ? "mt-3" : "mt-0.5",
      )}
      onMouseEnter={openActions}
      onMouseLeave={() => {
        if (!showMoreMenu && !showReactionPicker) {
          setShowActions(false);
        }
      }}
      onFocus={openActions}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setShowActions(false);
          setShowMoreMenu(false);
          setShowReactionPicker(false);
        }
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onClick={onDoubleTap}
    >
      {!isOwn && showHeader && (
        <div className="mr-2 mt-0.5">
          <UserAvatar
            name={displayName}
            avatarUrl={message.senderAvatar || message.sender?.avatar}
            size={30}
            isOnline
          />
        </div>
      )}

      {!isOwn && !showHeader && <div className="w-8 mr-2 shrink-0" />}

      <div className="relative max-w-[86%] min-w-0">
        <div
          className={cn(
            "relative px-3.5 py-2.5 rounded-2xl border transition-all duration-150",
            isHighlighted && "shadow-[0_0_28px_rgba(129,140,248,0.22)]",
            isLastInGroup && (isOwn ? "rounded-br-md" : "rounded-bl-md"),
          )}
          style={{
            background: isHighlighted
              ? "rgba(129,140,248,0.16)"
              : message.isPinned
                ? "rgba(251,191,36,0.08)"
                : isOwn
                  ? "rgba(129,140,248,0.12)"
                  : "rgba(255,255,255,0.04)",
            borderColor: isHighlighted
              ? "rgba(129,140,248,0.45)"
              : message.isPinned
                ? "rgba(251,191,36,0.32)"
                : isOwn
                  ? "rgba(129,140,248,0.28)"
                  : THEME.colors.border.primary,
            opacity: isSending ? 0.65 : 1,
          }}
        >
          {message.isPinned && (
            <div
              className="flex items-center gap-1 text-[10px] font-semibold mb-1"
              style={{ color: THEME.colors.accent.warning }}
            >
              <Pin className="w-3 h-3" />
              Pinned
            </div>
          )}

          {showHeader && (
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-xs font-semibold"
                style={{
                  color: isOwn
                    ? THEME.colors.text.primary
                    : THEME.colors.accent.secondary,
                }}
              >
                {displayName}
                {isOwn && (
                  <span
                    className="font-normal ml-1"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    · You
                  </span>
                )}
              </span>

              {message.senderId === currentUserId && (
                <ShieldCheck
                  className="w-3 h-3"
                  style={{ color: THEME.colors.accent.primary }}
                />
              )}

              {message.isEdited && (
                <span
                  className="text-[9px]"
                  style={{ color: THEME.colors.text.muted }}
                >
                  edited
                </span>
              )}
            </div>
          )}

          {message.replyTo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onJumpToReply?.(message.replyTo!.id);
              }}
              className="w-full text-left mb-2 pl-2.5 border-l-2 rounded-r-md hover:bg-white/5 transition-colors py-0.5"
              style={{ borderColor: THEME.colors.accent.primary }}
              title="Jump to replied message"
            >
              <div
                className="text-[10px] font-semibold"
                style={{ color: THEME.colors.accent.secondary }}
              >
                {resolveSenderName(message.replyTo)}
              </div>
              <span
                className="text-[11px] truncate block"
                style={{ color: THEME.colors.text.muted }}
              >
                {message.replyTo.content || "Attachment"}
              </span>
            </button>
          )}

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) =>
                  setEditContent(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                }
                className="w-full px-2.5 py-2 rounded-lg text-sm outline-none border resize-none"
                style={{
                  background: THEME.colors.background.primary,
                  color: THEME.colors.text.primary,
                  borderColor: THEME.colors.border.primary,
                }}
                rows={3}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setIsEditing(false);
                  }
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    submitEdit();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[9px]"
                  style={{ color: THEME.colors.text.muted }}
                >
                  ⌘/Ctrl+Enter · Esc
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(false);
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] hover:bg-white/5"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      submitEdit();
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                    style={{
                      background: THEME.colors.accent.primary,
                      color: "#fff",
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            message.content && (
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                style={{ color: THEME.colors.text.primary }}
              >
                {renderRichText(message.content, searchQuery)}
              </p>
            )
          )}

          {firstUrl && !isEditing && <LinkPreview url={firstUrl} />}

          {message.attachments?.length ? (
            <AttachmentList attachments={message.attachments} />
          ) : null}

          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            {isSending && (
              <span
                className="flex items-center gap-1 text-[9px]"
                style={{ color: THEME.colors.text.muted }}
              >
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Sending
              </span>
            )}

            {isFailed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry?.();
                }}
                className="flex items-center gap-1 text-[9px] hover:underline"
                style={{ color: THEME.colors.accent.error }}
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Retry
              </button>
            )}

            <span
              className="text-[9px] tabular-nums"
              title={getTimeAgo(message.createdAt)}
              style={{ color: THEME.colors.text.muted }}
            >
              {formatTime(message.createdAt)}
            </span>

            {isOwn && !isSending && !isFailed && (
              <CheckCheck
                className="w-3 h-3"
                style={{
                  color:
                    message.status === "read"
                      ? THEME.colors.accent.cyan
                      : THEME.colors.text.muted,
                }}
              />
            )}
          </div>
        </div>

        {reactionEntries.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1 mt-1",
              isOwn ? "justify-end" : "justify-start",
            )}
          >
            {reactionEntries.slice(0, 8).map(([emoji, users]) => {
              const reacted = users.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReact(emoji);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border hover:scale-105 transition-transform"
                  style={{
                    background: reacted
                      ? "rgba(129,140,248,0.22)"
                      : "rgba(255,255,255,0.04)",
                    borderColor: reacted
                      ? "rgba(129,140,248,0.45)"
                      : THEME.colors.border.primary,
                  }}
                  title={`${users.length} reaction${users.length !== 1 ? "s" : ""}`}
                >
                  <span>{emoji}</span>
                  <span
                    className="text-[9px] font-medium tabular-nums"
                    style={{ color: THEME.colors.text.secondary }}
                  >
                    {users.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {showActions && !isEditing && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className={cn(
                "absolute -top-10 z-30",
                isOwn ? "right-0" : "left-0",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center gap-0.5 p-1 rounded-full border shadow-xl backdrop-blur-md"
                style={{
                  background: THEME.colors.background.card,
                  borderColor: THEME.colors.border.primary,
                }}
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowReactionPicker((v) => !v)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                    style={{ color: THEME.colors.text.muted }}
                    title="React"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  <AnimatePresence>
                    {showReactionPicker && (
                      <ReactionPicker
                        onSelect={onReact}
                        onClose={() => setShowReactionPicker(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={onReply}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                  style={{ color: THEME.colors.text.muted }}
                  title="Reply"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                  style={{
                    color: copied
                      ? THEME.colors.accent.success
                      : THEME.colors.text.muted,
                  }}
                  title="Copy"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {(canModerate ||
                  canEdit ||
                  canDelete ||
                  onTranslate ||
                  onSendGift) && (
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu((v) => !v)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                    style={{
                      color: showMoreMenu
                        ? THEME.colors.accent.primary
                        : THEME.colors.text.muted,
                    }}
                    title="More actions"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMoreMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className={cn(
                "absolute top-full mt-1 min-w-[185px] max-w-[230px] flex flex-col gap-0.5 p-1 rounded-xl border shadow-2xl z-40 backdrop-blur-md",
                isOwn ? "right-0" : "left-0",
              )}
              style={{
                background: THEME.colors.background.card,
                borderColor: THEME.colors.border.primary,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  onReply();
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-xs text-left"
                style={{ color: THEME.colors.text.secondary }}
              >
                <CornerDownRight className="w-3.5 h-3.5" />
                Reply
              </button>

              {onTranslate && (
                <button
                  type="button"
                  onClick={() => {
                    onTranslate();
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-xs text-left"
                  style={{ color: THEME.colors.text.secondary }}
                >
                  <Languages className="w-3.5 h-3.5" />
                  Translate
                </button>
              )}

              {onSendGift && (
                <button
                  type="button"
                  onClick={() => {
                    onSendGift();
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-xs text-left"
                  style={{ color: THEME.colors.text.secondary }}
                >
                  <Gift className="w-3.5 h-3.5" />
                  Send gift
                </button>
              )}

              {canModerate && (
                <button
                  type="button"
                  onClick={() => {
                    onPin();
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-xs text-left"
                  style={{
                    color: message.isPinned
                      ? THEME.colors.accent.warning
                      : THEME.colors.text.secondary,
                  }}
                >
                  <Pin className="w-3.5 h-3.5" />
                  {message.isPinned ? "Unpin message" : "Pin message"}
                </button>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(message.content);
                    setIsEditing(true);
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-xs text-left"
                  style={{ color: THEME.colors.text.secondary }}
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit message
                </button>
              )}

              {canModerate && message.senderId !== currentUserId && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onMute();
                      setShowMoreMenu(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-red-500/10 text-xs text-left"
                    style={{ color: THEME.colors.text.secondary }}
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    Mute user
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onKick();
                      setShowMoreMenu(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-red-500/10 text-xs text-left"
                    style={{ color: THEME.colors.text.secondary }}
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Remove from room
                  </button>
                </>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-red-500/10 text-xs text-left"
                  style={{ color: THEME.colors.accent.error }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete message
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  toast.info(
                    "Report controls can be connected to your moderation API.",
                  );
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-xs text-left"
                style={{ color: THEME.colors.text.muted }}
              >
                <Flag className="w-3.5 h-3.5" />
                Report
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ============================================================
// Date Separator
// ============================================================

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 justify-center my-4 select-none">
    <div
      className="h-px flex-1"
      style={{ background: THEME.colors.border.primary }}
    />
    <span
      className="text-[10px] font-semibold px-3 py-1 rounded-full border"
      style={{
        color: THEME.colors.text.muted,
        borderColor: THEME.colors.border.primary,
        background: THEME.colors.background.tertiary,
      }}
    >
      {label}
    </span>
    <div
      className="h-px flex-1"
      style={{ background: THEME.colors.border.primary }}
    />
  </div>
);

// ============================================================
// Unread divider
// ============================================================

const UnreadDivider: React.FC = () => (
  <div className="flex items-center gap-3 my-3 select-none">
    <div
      className="h-px flex-1"
      style={{ background: "rgba(129,140,248,0.35)" }}
    />
    <span
      className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{
        color: THEME.colors.accent.primary,
        background: "rgba(129,140,248,0.12)",
      }}
    >
      New messages
    </span>
    <div
      className="h-px flex-1"
      style={{ background: "rgba(129,140,248,0.35)" }}
    />
  </div>
);

// ============================================================
// Typing Indicator
// ============================================================

const TypingIndicator: React.FC<{ users: string[] }> = ({ users }) => {
  if (users.length === 0) return null;

  const visible = users.slice(0, 3);
  const extra = users.length - visible.length;
  let label = visible.join(", ");
  if (extra > 0) label += ` +${extra}`;

  return (
    <div
      className="px-4 py-1.5 border-b shrink-0"
      style={{ borderColor: THEME.colors.border.primary }}
      aria-live="polite"
    >
      <span className="flex items-center gap-2">
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: THEME.colors.accent.primary }}
              animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
              transition={{
                duration: 0.75,
                delay: i * 0.12,
                repeat: Infinity,
              }}
            />
          ))}
        </span>
        <span
          className="text-[10px]"
          style={{ color: THEME.colors.text.muted }}
        >
          {label} {users.length === 1 ? "is" : "are"} typing…
        </span>
      </span>
    </div>
  );
};

// ============================================================
// Jump to Latest
// ============================================================

const JumpToLatest: React.FC<{
  count: number;
  onClick: () => void;
}> = ({ count, onClick }) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    type="button"
    onClick={onClick}
    className="absolute bottom-24 left-1/2 -translate-x-1/2 px-3.5 py-2 rounded-full text-[10px] font-semibold flex items-center gap-2 shadow-xl border z-20 backdrop-blur-md"
    style={{
      background: THEME.colors.background.card,
      color: THEME.colors.text.primary,
      borderColor: THEME.colors.border.primary,
    }}
  >
    <ArrowDown
      className="w-3.5 h-3.5"
      style={{ color: THEME.colors.accent.primary }}
    />
    {count > 0
      ? `${count} new message${count === 1 ? "" : "s"}`
      : "New messages"}
  </motion.button>
);

// ============================================================
// Pinned strip
// ============================================================

const PinnedStrip: React.FC<{
  messages: Message[];
  onJump: (id: string) => void;
  onUnpin?: (id: string) => void;
  canModerate?: boolean;
}> = ({ messages, onJump, onUnpin, canModerate }) => {
  if (!messages.length) return null;

  return (
    <div
      className="px-3 py-2 border-b shrink-0 overflow-x-auto"
      style={{
        borderColor: THEME.colors.border.primary,
        background: "rgba(251,191,36,0.04)",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Pin
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: THEME.colors.accent.warning }}
        />
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {messages.slice(0, 6).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onJump(m.id)}
              className="flex items-center gap-1.5 max-w-[180px] px-2.5 py-1.5 rounded-lg border text-left hover:bg-white/5 transition-colors shrink-0"
              style={{ borderColor: "rgba(251,191,36,0.25)" }}
              title={m.content}
            >
              <span
                className="text-[10px] font-semibold truncate"
                style={{ color: THEME.colors.accent.warning }}
              >
                {resolveSenderName(m)}
              </span>
              <span
                className="text-[10px] truncate"
                style={{ color: THEME.colors.text.muted }}
              >
                {m.content || "Attachment"}
              </span>
              {canModerate && onUnpin && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpin(m.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onUnpin(m.id);
                    }
                  }}
                  className="ml-0.5 p-0.5 rounded hover:bg-white/10"
                  style={{ color: THEME.colors.text.muted }}
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Mention suggestions
// ============================================================

const MentionSuggestions: React.FC<{
  query: string;
  names: string[];
  onSelect: (name: string) => void;
}> = ({ query, names, onSelect }) => {
  const q = query.toLowerCase();
  const matches = names.filter((n) => n.toLowerCase().includes(q)).slice(0, 6);

  if (!matches.length) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 mx-1 rounded-xl border shadow-2xl z-40 overflow-hidden"
      style={{
        background: THEME.colors.background.card,
        borderColor: THEME.colors.border.primary,
      }}
    >
      <div
        className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1"
        style={{ color: THEME.colors.text.muted }}
      >
        <AtSign className="w-3 h-3" />
        Mention
      </div>
      {matches.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-white/8 text-xs"
          style={{ color: THEME.colors.text.secondary }}
        >
          <UserAvatar name={name} size={22} />
          <span>@{name.replace(/\s+/g, "")}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================
// Main Chat Panel
// ============================================================

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  newMessage,
  replyTo,
  typingUsers,
  currentUserId,
  isHost,
  isModerator,
  showEmojiPicker,
  onEmojiPickerToggle,
  onMessageChange,
  onSendMessage,
  onReply,
  onPinMessage,
  onDeleteMessage,
  onEditMessage,
  onReactToMessage,
  onKickUser,
  onMuteUser,
  onTranslateMessage,
  chatSearch,
  onChatSearchChange,
  showChatSearch,
  onToggleChatSearch,
  totalParticipants,
  scrollRef,
  endRef,
  textareaRef,
  isNearBottom,
  onScroll,
  hasNewMessages,
  newMessageCount,
  onScrollToBottom,
  className,
  onAttachFile,
  onRecordAudio,
  onSendGift,
  roomId,
  participantNames = [],
}) => {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [messageCount, setMessageCount] = useState(messages.length);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null);

  const [reactionOverrides, setReactionOverrides] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const MIN_CHAT_WIDTH = 320;
  const MAX_CHAT_WIDTH = 720;
  const DEFAULT_CHAT_WIDTH = 390;
  const [panelWidth, setPanelWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const inputContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const localEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousMessageCount = useRef(messages.length);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Desktop breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Sound preference
  useEffect(() => {
    try {
      setSoundEnabled(
        window.localStorage.getItem("speakbetter-chat-sound") === "1",
      );
    } catch {
      // ignore
    }
  }, []);

  // ----------------------------------------------------------
  // Derived state — FIXED: filter applies to grouping
  // ----------------------------------------------------------

  const normalizedSearch = chatSearch.trim().toLowerCase();

  const filteredMessages = useMemo(() => {
    let result = messages;

    if (showPinnedOnly) {
      result = result.filter((message) => message.isPinned);
    }

    if (normalizedSearch) {
      result = result.filter((message) => {
        const haystack = [
          message.content,
          resolveSenderName(message),
          ...(message.attachments?.map((a) => a.name || "") || []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    return result;
  }, [messages, normalizedSearch, showPinnedOnly]);

  const groupedMessages = useMemo(
    () => buildGroupedMessages(filteredMessages, currentUserId),
    [filteredMessages, currentUserId],
  );

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.isPinned && !m.isDeleted),
    [messages],
  );

  const typingUsersArray = useMemo(
    () =>
      Array.from(typingUsers)
        .filter((id) => id !== currentUserId)
        .map((id) => {
          const recent = [...messages]
            .reverse()
            .find((message) => message.senderId === id);
          return recent ? resolveSenderName(recent) : "Someone";
        }),
    [typingUsers, currentUserId, messages],
  );

  const pinnedCount = pinnedMessages.length;
  const canModerate = isHost || isModerator;

  // Mention names from props + recent senders
  const mentionNames = useMemo(() => {
    const fromMessages = messages
      .map((m) => resolveSenderName(m))
      .filter((n) => n !== "Unknown User");
    return Array.from(new Set([...participantNames, ...fromMessages]));
  }, [messages, participantNames]);

  const getMergedReactions = useCallback(
    (message: Message): Record<string, string[]> => {
      const merged: Record<string, string[]> = {};

      for (const [emoji, users] of Object.entries(message.reactions || {})) {
        if (Array.isArray(users) && users.length > 0) {
          merged[emoji] = [...new Set(users.filter(Boolean))];
        }
      }

      const overrides = reactionOverrides[message.id];
      if (overrides) {
        for (const [emoji, desired] of Object.entries(overrides)) {
          const users = new Set(merged[emoji] || []);
          if (desired) users.add(currentUserId);
          else users.delete(currentUserId);
          if (users.size > 0) merged[emoji] = Array.from(users);
          else delete merged[emoji];
        }
      }

      return merged;
    },
    [reactionOverrides, currentUserId],
  );

  const handleReactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      if (!messageId || !emoji || !currentUserId) return;

      const message = messages.find((item) => item.id === messageId);
      const currentReactions = message ? getMergedReactions(message) : {};
      const alreadyReacted = (currentReactions[emoji] || []).includes(
        currentUserId,
      );
      const shouldHaveReaction = !alreadyReacted;

      setReactionOverrides((previous) => ({
        ...previous,
        [messageId]: {
          ...(previous[messageId] || {}),
          [emoji]: shouldHaveReaction,
        },
      }));

      try {
        onReactToMessage(messageId, emoji);
      } catch {
        setReactionOverrides((previous) => {
          const next = { ...previous };
          const messageOverrides = { ...(next[messageId] || {}) };
          delete messageOverrides[emoji];
          if (Object.keys(messageOverrides).length === 0) {
            delete next[messageId];
          } else {
            next[messageId] = messageOverrides;
          }
          return next;
        });
        toast.error("Could not react to this message");
      }
    },
    [currentUserId, getMergedReactions, messages, onReactToMessage],
  );

  // Drop optimistic overrides once parent confirms
  useEffect(() => {
    setReactionOverrides((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const [messageId, overrides] of Object.entries(previous)) {
        const message = messages.find((item) => item.id === messageId);
        if (!message) continue;

        const serverReactions = message.reactions || {};
        const remaining: Record<string, boolean> = {};

        for (const [emoji, desired] of Object.entries(overrides)) {
          const serverHasUser =
            Array.isArray(serverReactions[emoji]) &&
            serverReactions[emoji].includes(currentUserId);

          if (serverHasUser !== desired) {
            remaining[emoji] = desired;
          } else {
            changed = true;
          }
        }

        if (Object.keys(remaining).length === 0) {
          delete next[messageId];
        } else {
          next[messageId] = remaining;
        }
      }

      return changed ? next : previous;
    });
  }, [messages, currentUserId]);

  // Restore panel width
  useEffect(() => {
    try {
      const saved = Number(
        window.localStorage.getItem("speakbetter-chat-width"),
      );
      if (Number.isFinite(saved)) {
        setPanelWidth(
          Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, saved)),
        );
      }
    } catch {
      // ignore
    }
  }, []);

  // Close settings on outside click
  useEffect(() => {
    if (!showChatSettings) return;
    const onDoc = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) {
        setShowChatSettings(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showChatSettings]);

  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(DEFAULT_CHAT_WIDTH);

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      resizeStartX.current = event.clientX;
      resizeStartWidth.current = panelWidth;
      setIsResizing(true);
    },
    [panelWidth, isDesktop],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = resizeStartX.current - event.clientX;
      const nextWidth = Math.min(
        MAX_CHAT_WIDTH,
        Math.max(MIN_CHAT_WIDTH, resizeStartWidth.current + delta),
      );
      setPanelWidth(nextWidth);
    };

    const stopResize = () => {
      setIsResizing(false);
      setPanelWidth((width) => {
        try {
          window.localStorage.setItem(
            "speakbetter-chat-width",
            String(Math.round(width)),
          );
        } catch {
          // ignore
        }
        return width;
      });
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", stopResize, { once: true });
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // ----------------------------------------------------------
  // Message count / scroll / sound / unread anchor
  // ----------------------------------------------------------

  useEffect(() => {
    setMessageCount(messages.length);

    if (messages.length > previousMessageCount.current) {
      if (!isNearBottom) {
        setShowScrollTop(true);
        // Mark first new message as unread anchor
        const newest = messages[messages.length - 1];
        if (newest && newest.senderId !== currentUserId) {
          setUnreadAnchorId((prev) => prev ?? newest.id);
          if (soundEnabled) playMessageChime();
        }
      } else {
        setUnreadAnchorId(null);
      }
    }

    previousMessageCount.current = messages.length;
  }, [messages, isNearBottom, currentUserId, soundEnabled]);

  useEffect(() => {
    if (isNearBottom) {
      setUnreadAnchorId(null);
      if (messages.length > 0) {
        window.setTimeout(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
          endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 40);
      }
    }
  }, [messages, isNearBottom, scrollRef, endRef]);

  // ----------------------------------------------------------
  // Keyboard shortcuts
  // ----------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        if (isTypingTarget && newMessage.trim()) {
          event.preventDefault();
          onSendMessage();
        }
      }

      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        textareaRef.current?.focus();
      }

      if (event.key === "Escape") {
        if (showEmojiPicker) onEmojiPickerToggle();
        if (replyTo) onReply(null);
        if (showChatSettings) setShowChatSettings(false);
        if (mentionQuery !== null) setMentionQuery(null);
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        onToggleChatSearch();
        window.setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    newMessage,
    onSendMessage,
    textareaRef,
    showEmojiPicker,
    onEmojiPickerToggle,
    replyTo,
    onReply,
    showChatSettings,
    onToggleChatSearch,
    mentionQuery,
  ]);

  // ----------------------------------------------------------
  // Helpers / actions
  // ----------------------------------------------------------

  const scrollToBottom = useCallback(() => {
    onScrollToBottom();
    setUnreadAnchorId(null);
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      localEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 30);
  }, [onScrollToBottom, scrollRef, endRef]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const next = `${newMessage}${emoji}`.slice(0, MAX_MESSAGE_LENGTH);
      onMessageChange(next);
      setShowQuickReplies(false);
      textareaRef.current?.focus();
    },
    [newMessage, onMessageChange, textareaRef],
  );

  const insertText = useCallback(
    (text: string) => {
      const next = `${newMessage}${newMessage ? " " : ""}${text}`.slice(
        0,
        MAX_MESSAGE_LENGTH,
      );
      onMessageChange(next);
      textareaRef.current?.focus();
    },
    [newMessage, onMessageChange, textareaRef],
  );

  const insertMention = useCallback(
    (name: string) => {
      const handle = name.replace(/\s+/g, "");
      // Replace trailing @query
      const replaced = newMessage.replace(/@([a-zA-Z0-9_.-]*)$/, `@${handle} `);
      onMessageChange(replaced.slice(0, MAX_MESSAGE_LENGTH));
      setMentionQuery(null);
      textareaRef.current?.focus();
    },
    [newMessage, onMessageChange, textareaRef],
  );

  const handleTextareaChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value.slice(0, MAX_MESSAGE_LENGTH);
      onMessageChange(value);

      event.currentTarget.style.height = "auto";
      event.currentTarget.style.height = `${Math.min(
        event.currentTarget.scrollHeight,
        120,
      )}px`;

      // Detect @mention in progress
      const mentionMatch = value.match(/@([a-zA-Z0-9_.-]*)$/);
      setMentionQuery(mentionMatch ? mentionMatch[1] : null);
    },
    [onMessageChange],
  );

  const handleTextareaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (newMessage.trim()) {
          setMentionQuery(null);
          onSendMessage();
        }
        return;
      }

      if (event.key === "Escape" && replyTo) {
        event.preventDefault();
        onReply(null);
      }
    },
    [newMessage, onSendMessage, replyTo, onReply],
  );

  const jumpToMessage = useCallback((messageId: string) => {
    const node = messageRefs.current[messageId];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.animate(
        [
          { boxShadow: "0 0 0 rgba(129,140,248,0)" },
          { boxShadow: "0 0 0 5px rgba(129,140,248,0.22)" },
          { boxShadow: "0 0 0 rgba(129,140,248,0)" },
        ],
        { duration: 1000 },
      );
    }
  }, []);

  const handlePanelScroll = useCallback(() => {
    onScroll();
    const element = scrollRef.current;
    if (!element) return;
    setShowScrollTop(element.scrollTop > 500);
  }, [onScroll, scrollRef]);

  const clearSearch = useCallback(() => {
    onChatSearchChange("");
    setShowPinnedOnly(false);
  }, [onChatSearchChange]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("speakbetter-chat-sound", next ? "1" : "0");
      } catch {
        // ignore
      }
      toast.success(next ? "Message sounds on" : "Message sounds off");
      return next;
    });
  }, []);

  const charRatio = newMessage.length / MAX_MESSAGE_LENGTH;
  const nearLimit = charRatio > 0.85;

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <aside
      className={cn(
        "relative flex flex-col min-h-0 shrink-0 border-l overflow-hidden",
        "w-full md:w-auto",
        isResizing && "select-none",
        className,
      )}
      style={{
        background: "rgba(10, 10, 18, 0.97)",
        borderColor: THEME.colors.border.primary,
        width: isDesktop ? panelWidth : "100%",
        minWidth: isDesktop ? MIN_CHAT_WIDTH : undefined,
        maxWidth: isDesktop ? MAX_CHAT_WIDTH : undefined,
        transition: isResizing ? "none" : "width 160ms ease",
      }}
      data-room-id={roomId}
    >
      {/* Desktop resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
        onPointerDown={startResize}
        className={cn(
          "hidden md:block absolute left-0 top-0 bottom-0 w-1.5 z-[60] cursor-col-resize group/resize",
          isResizing && "bg-white/10",
        )}
        title="Drag to resize chat"
      >
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full opacity-0 group-hover/resize:opacity-100 transition-opacity"
          style={{ background: THEME.colors.accent.primary }}
        />
      </div>

      {/* Header */}
      <div
        className="px-3.5 py-3 border-b flex items-center justify-between shrink-0"
        style={{
          borderColor: THEME.colors.border.primary,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(129,140,248,0.2), rgba(167,139,250,0.12))",
            }}
          >
            <MessageCircle
              className="w-4 h-4"
              style={{ color: THEME.colors.accent.primary }}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="text-sm font-semibold tracking-tight"
                style={{ color: THEME.colors.text.primary }}
              >
                Live Chat
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full tabular-nums font-medium"
                style={{
                  background: "rgba(129,140,248,0.14)",
                  color: THEME.colors.accent.primary,
                }}
              >
                {messageCount}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className="text-[9px] tabular-nums"
                style={{ color: THEME.colors.text.muted }}
              >
                {totalParticipants} participant
                {totalParticipants === 1 ? "" : "s"}
              </span>

              {pinnedCount > 0 && (
                <>
                  <span
                    className="text-[8px]"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    ·
                  </span>
                  <span
                    className="text-[9px] flex items-center gap-0.5 tabular-nums"
                    style={{ color: THEME.colors.accent.warning }}
                  >
                    <Pin className="w-2.5 h-2.5" />
                    {pinnedCount}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleSound}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{
              color: soundEnabled
                ? THEME.colors.accent.primary
                : THEME.colors.text.muted,
            }}
            title={
              soundEnabled ? "Mute message sounds" : "Enable message sounds"
            }
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleChatSearch}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{
              color: showChatSearch
                ? THEME.colors.accent.primary
                : THEME.colors.text.muted,
            }}
            title="Search messages (Ctrl/Cmd + F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowPinnedOnly((v) => !v)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{
              color: showPinnedOnly
                ? THEME.colors.accent.warning
                : THEME.colors.text.muted,
            }}
            title="Show pinned messages"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              const nextExpanded = !isExpanded;
              setIsExpanded(nextExpanded);
              setPanelWidth(nextExpanded ? 560 : DEFAULT_CHAT_WIDTH);
            }}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors hidden md:flex"
            style={{ color: THEME.colors.text.muted }}
            title={isExpanded ? "Shrink chat" : "Expand chat"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setShowChatSettings((v) => !v)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              style={{
                color: showChatSettings
                  ? THEME.colors.accent.primary
                  : THEME.colors.text.muted,
              }}
              title="Chat settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {showChatSettings && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 w-56 rounded-xl border p-1.5 shadow-2xl z-50 backdrop-blur-md"
                  style={{
                    background: THEME.colors.background.card,
                    borderColor: THEME.colors.border.primary,
                  }}
                >
                  <div
                    className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Chat preferences
                  </div>

                  <button
                    type="button"
                    onClick={() => setCompactMode((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-left"
                  >
                    <span
                      className="text-xs"
                      style={{ color: THEME.colors.text.secondary }}
                    >
                      Compact messages
                    </span>
                    <span
                      className="w-7 h-4 rounded-full p-0.5 transition-colors"
                      style={{
                        background: compactMode
                          ? THEME.colors.accent.primary
                          : "rgba(255,255,255,0.10)",
                      }}
                    >
                      <span
                        className={cn(
                          "block w-3 h-3 rounded-full bg-white transition-transform",
                          compactMode ? "translate-x-3" : "translate-x-0",
                        )}
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleSound}
                    className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-left"
                  >
                    <span
                      className="text-xs"
                      style={{ color: THEME.colors.text.secondary }}
                    >
                      Message sounds
                    </span>
                    <span
                      className="w-7 h-4 rounded-full p-0.5 transition-colors"
                      style={{
                        background: soundEnabled
                          ? THEME.colors.accent.primary
                          : "rgba(255,255,255,0.10)",
                      }}
                    >
                      <span
                        className={cn(
                          "block w-3 h-3 rounded-full bg-white transition-transform",
                          soundEnabled ? "translate-x-3" : "translate-x-0",
                        )}
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPinnedOnly((v) => !v);
                      setShowChatSettings(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-left"
                  >
                    <span
                      className="text-xs"
                      style={{ color: THEME.colors.text.secondary }}
                    >
                      Pinned only
                    </span>
                    <Pin
                      className="w-3.5 h-3.5"
                      style={{
                        color: showPinnedOnly
                          ? THEME.colors.accent.warning
                          : THEME.colors.text.muted,
                      }}
                    />
                  </button>

                  <div
                    className="my-1 h-px"
                    style={{ background: THEME.colors.border.primary }}
                  />

                  <div
                    className="px-2 py-1 text-[9px] leading-relaxed"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    <b>/</b> focus · <b>⌘/Ctrl+F</b> search · type <b>@</b> to
                    mention · double-tap ❤️
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Search */}
      <AnimatePresence initial={false}>
        {showChatSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 border-b shrink-0 overflow-hidden"
            style={{ borderColor: THEME.colors.border.primary }}
          >
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: THEME.colors.text.muted }}
              />
              <input
                ref={searchInputRef}
                type="search"
                value={chatSearch}
                onChange={(e) => onChatSearchChange(e.target.value)}
                placeholder="Search messages, people, files…"
                className="w-full pl-8 pr-10 py-2 rounded-xl text-xs outline-none border focus:ring-1"
                style={{
                  background: "rgba(10,10,18,0.55)",
                  color: THEME.colors.text.primary,
                  borderColor: THEME.colors.border.primary,
                  // @ts-expect-error CSS var for focus ring
                  "--tw-ring-color": THEME.colors.accent.primary,
                }}
                autoFocus
              />
              {chatSearch && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10"
                  style={{ color: THEME.colors.text.muted }}
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {(chatSearch || showPinnedOnly) && (
              <div className="flex items-center justify-between mt-1.5">
                <span
                  className="text-[9px] tabular-nums"
                  style={{ color: THEME.colors.text.muted }}
                >
                  {filteredMessages.length} result
                  {filteredMessages.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPinnedOnly((v) => !v)}
                  className="flex items-center gap-1 text-[9px]"
                  style={{
                    color: showPinnedOnly
                      ? THEME.colors.accent.warning
                      : THEME.colors.text.muted,
                  }}
                >
                  <Filter className="w-3 h-3" />
                  Pinned
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned strip */}
      {!showPinnedOnly && (
        <PinnedStrip
          messages={pinnedMessages}
          onJump={jumpToMessage}
          canModerate={canModerate}
          onUnpin={(id) => onPinMessage(id, false)}
        />
      )}

      {/* Typing */}
      <TypingIndicator users={typingUsersArray} />

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handlePanelScroll}
          className={cn(
            "h-full overflow-y-auto px-3 py-2.5",
            compactMode && "py-1.5",
          )}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: `${THEME.colors.border.primary} transparent`,
          }}
        >
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(129,140,248,0.14), rgba(167,139,250,0.08))",
                }}
              >
                {showPinnedOnly ? (
                  <Pin
                    className="w-7 h-7"
                    style={{ color: THEME.colors.accent.warning }}
                  />
                ) : normalizedSearch ? (
                  <Search
                    className="w-7 h-7"
                    style={{ color: THEME.colors.accent.primary }}
                  />
                ) : (
                  <MessageCircle
                    className="w-7 h-7"
                    style={{ color: THEME.colors.accent.primary }}
                  />
                )}
              </div>

              <p
                className="text-sm font-semibold"
                style={{ color: THEME.colors.text.primary }}
              >
                {showPinnedOnly
                  ? "No pinned messages"
                  : normalizedSearch
                    ? "No messages found"
                    : "No messages yet"}
              </p>

              <p
                className="text-xs mt-1 max-w-[260px] leading-relaxed"
                style={{ color: THEME.colors.text.muted }}
              >
                {showPinnedOnly
                  ? "Pin important messages so everyone can find them quickly."
                  : normalizedSearch
                    ? "Try another keyword or clear the search."
                    : "Start the conversation and make the room more engaging."}
              </p>

              {(showPinnedOnly || normalizedSearch) && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-3 px-3 py-1.5 rounded-lg text-[10px] font-semibold border hover:bg-white/5"
                  style={{
                    color: THEME.colors.accent.primary,
                    borderColor: THEME.colors.border.primary,
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            groupedMessages.map((dateGroup) => (
              <div key={dateGroup.key}>
                <DateSeparator label={dateGroup.label} />

                {dateGroup.messages.map((senderGroup) =>
                  senderGroup.messages.map((msg, msgIndex) => (
                    <React.Fragment key={msg.id}>
                      {unreadAnchorId === msg.id && <UnreadDivider />}
                      <div
                        ref={(node) => {
                          messageRefs.current[msg.id] = node;
                        }}
                        className={compactMode ? "py-0" : undefined}
                      >
                        <MessageBubble
                          message={{
                            ...msg,
                            senderName: resolveSenderName(msg),
                            reactions: getMergedReactions(msg),
                          }}
                          isOwn={msg.senderId === currentUserId}
                          currentUserId={currentUserId}
                          canModerate={canModerate}
                          onReply={() => onReply(msg)}
                          onPin={() => onPinMessage(msg.id, !msg.isPinned)}
                          onDelete={() => onDeleteMessage(msg.id)}
                          onEdit={(content) => onEditMessage(msg.id, content)}
                          onReact={(emoji) =>
                            handleReactToMessage(msg.id, emoji)
                          }
                          onKick={() => onKickUser(msg.senderId)}
                          onMute={() => onMuteUser(msg.senderId)}
                          onTranslate={
                            onTranslateMessage
                              ? () => onTranslateMessage(msg.id)
                              : undefined
                          }
                          onSendGift={
                            onSendGift
                              ? () => onSendGift(msg.senderId)
                              : undefined
                          }
                          onRetry={
                            msg.status === "failed" ? onSendMessage : undefined
                          }
                          onJumpToReply={jumpToMessage}
                          showHeader={msgIndex === 0}
                          isLastInGroup={
                            msgIndex === senderGroup.messages.length - 1
                          }
                          isHighlighted={msg.isHighlighted}
                          searchQuery={chatSearch}
                        />
                      </div>
                    </React.Fragment>
                  )),
                )}
              </div>
            ))
          )}

          <div ref={endRef} />
          <div ref={localEndRef} />
        </div>

        <AnimatePresence>
          {(hasNewMessages || (!isNearBottom && showScrollTop)) && (
            <JumpToLatest count={newMessageCount} onClick={scrollToBottom} />
          )}
        </AnimatePresence>
      </div>

      {/* Reply bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 border-t shrink-0 overflow-hidden"
            style={{
              borderColor: THEME.colors.border.primary,
              background: "rgba(129,140,248,0.06)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(129,140,248,0.14)" }}
              >
                <Reply
                  className="w-3.5 h-3.5"
                  style={{ color: THEME.colors.accent.primary }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: THEME.colors.accent.primary }}
                >
                  Replying to {resolveSenderName(replyTo)}
                </div>
                <span
                  className="text-xs truncate block"
                  style={{ color: THEME.colors.text.secondary }}
                >
                  {replyTo.content || "Attachment"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onReply(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 shrink-0"
                style={{ color: THEME.colors.text.muted }}
                title="Cancel reply"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick replies */}
      <AnimatePresence>
        {showQuickReplies && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="px-3 py-2 border-t shrink-0 overflow-x-auto"
            style={{
              borderColor: THEME.colors.border.primary,
              background: "rgba(255,255,255,0.018)",
            }}
          >
            <div className="flex gap-1.5">
              {QUICK_REPLIES.map((reply) => (
                <button
                  type="button"
                  key={reply}
                  onClick={() => insertText(reply)}
                  className="px-2.5 py-1.5 rounded-full border text-[10px] whitespace-nowrap hover:bg-white/5 transition-colors"
                  style={{
                    color: THEME.colors.text.secondary,
                    borderColor: THEME.colors.border.primary,
                  }}
                >
                  {reply}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div
        ref={inputContainerRef}
        className="p-2.5 border-t shrink-0 relative"
        style={{
          borderColor: THEME.colors.border.primary,
          background: "rgba(10,10,18,0.97)",
        }}
      >
        {mentionQuery !== null && mentionNames.length > 0 && (
          <MentionSuggestions
            query={mentionQuery}
            names={mentionNames}
            onSelect={insertMention}
          />
        )}

        <div className="flex items-end gap-1.5">
          {onAttachFile && (
            <button
              type="button"
              onClick={onAttachFile}
              className="p-2.5 rounded-full hover:bg-white/5 transition-colors shrink-0"
              style={{ color: THEME.colors.text.muted }}
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}

          {onRecordAudio && (
            <button
              type="button"
              onClick={onRecordAudio}
              className="p-2.5 rounded-full hover:bg-white/5 transition-colors shrink-0"
              style={{ color: THEME.colors.text.muted }}
              title="Record voice message"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                onEmojiPickerToggle();
                setShowQuickReplies(false);
              }}
              className="p-2.5 rounded-full hover:bg-white/5 transition-colors"
              style={{
                color: showEmojiPicker
                  ? THEME.colors.accent.primary
                  : THEME.colors.text.muted,
              }}
              title="Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  transition={{ duration: 0.14 }}
                  className="absolute bottom-full left-0 mb-2 w-[min(330px,calc(100vw-24px))] rounded-2xl border shadow-2xl p-2 z-50 backdrop-blur-md"
                  style={{
                    background: THEME.colors.background.card,
                    borderColor: THEME.colors.border.primary,
                  }}
                >
                  <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1">
                    {EMOJI_CATEGORIES.map((category, index) => (
                      <button
                        type="button"
                        key={category.name}
                        onClick={() => setSelectedCategory(index)}
                        className="px-2 py-1.5 rounded-lg text-xs whitespace-nowrap hover:bg-white/5 transition-colors"
                        style={{
                          background:
                            selectedCategory === index
                              ? "rgba(129,140,248,0.14)"
                              : "transparent",
                          color:
                            selectedCategory === index
                              ? THEME.colors.accent.primary
                              : THEME.colors.text.muted,
                        }}
                        title={category.name}
                      >
                        {category.icon}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1">
                    {EMOJI_CATEGORIES[selectedCategory].emojis.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="h-8 rounded-lg flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-transform text-lg"
                        title={`Insert ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowQuickReplies((v) => !v);
              if (showEmojiPicker) onEmojiPickerToggle();
            }}
            className="p-2.5 rounded-full hover:bg-white/5 transition-colors shrink-0"
            style={{
              color: showQuickReplies
                ? THEME.colors.accent.primary
                : THEME.colors.text.muted,
            }}
            title="Quick replies"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <div className="relative flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                replyTo
                  ? `Reply to ${resolveSenderName(replyTo)}…`
                  : "Type a message…  (@ to mention)"
              }
              className="w-full px-3.5 py-2.5 pr-11 rounded-2xl text-sm outline-none transition-all border resize-none leading-relaxed focus:ring-1"
              style={{
                background: "rgba(10,10,18,0.65)",
                color: THEME.colors.text.primary,
                borderColor: THEME.colors.border.primary,
                maxHeight: 120,
                // @ts-expect-error CSS custom property
                "--tw-ring-color": THEME.colors.accent.primary,
              }}
              aria-label="Chat message"
            />

            {/* Character progress near limit */}
            {nearLimit && (
              <div
                className="absolute right-2.5 bottom-2 flex items-center justify-center"
                title={`${newMessage.length}/${MAX_MESSAGE_LENGTH}`}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <circle
                    cx="9"
                    cy="9"
                    r="7"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="9"
                    cy="9"
                    r="7"
                    fill="none"
                    stroke={
                      charRatio >= 1
                        ? THEME.colors.accent.error
                        : THEME.colors.accent.warning
                    }
                    strokeWidth="2"
                    strokeDasharray={`${charRatio * 44} 44`}
                    strokeLinecap="round"
                    transform="rotate(-90 9 9)"
                  />
                </svg>
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={onSendMessage}
            disabled={!newMessage.trim()}
            className="p-2.5 rounded-full disabled:opacity-35 disabled:cursor-not-allowed transition-all shrink-0"
            style={{
              background: newMessage.trim()
                ? `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`
                : "rgba(255,255,255,0.08)",
              color: "#fff",
              boxShadow: newMessage.trim()
                ? `0 4px 18px ${THEME.colors.accent.primary}40`
                : "none",
            }}
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1">
          <div
            className="flex items-center gap-2 text-[8px]"
            style={{ color: THEME.colors.text.muted }}
          >
            <span>
              <b>Enter</b> send
            </span>
            <span>
              <b>Shift+Enter</b> line
            </span>
          </div>
          <div
            className="text-[8px] tabular-nums"
            style={{
              color:
                charRatio >= 1
                  ? THEME.colors.accent.error
                  : THEME.colors.text.muted,
            }}
          >
            {newMessage.length > 0
              ? `${newMessage.length}/${MAX_MESSAGE_LENGTH}`
              : ""}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChatPanel;