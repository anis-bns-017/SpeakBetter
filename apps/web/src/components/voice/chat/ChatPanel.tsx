// apps/web/src/components/voice/chat/ChatPanel.tsx
import React, {
  useState,
  useEffect,
  useLayoutEffect,
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
  PinOff,
  Trash2,
  Pencil,
  Copy,
  Check,
  CheckCheck,
  Clock,
  CircleAlert,
  Ellipsis,
  Flag,
  Image,
  File,
  Video,
  Gift,
  Volume2,
  VolumeX,
  MessagesSquare,
  Settings2,
  Paperclip,
  Music,
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
  Keyboard,
  Users,
} from "lucide-react";
import { cn } from "../../../lib/utils";

// ============================================================
// Theme (self-contained fallback)
// ============================================================

const THEME = {
  colors: {
    background: {
      primary: "#0a0a12",
      secondary: "#0f0f1a",
      tertiary: "#141422",
      card: "rgba(20, 20, 34, 0.98)",
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

const OWN_BUBBLE_GRADIENT =
  "linear-gradient(135deg, rgba(99,102,241,0.95), rgba(139,92,246,0.92))";

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
  reactions?:
    | Record<string, string[]>
    | Array<{ emoji?: string; userId?: string; user?: { id?: string } }>;
  attachments?: Attachment[];
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  isHighlighted?: boolean;
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

type GroupPosition = "single" | "first" | "middle" | "last";

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
  onEditMessage: (messageId: string, newContent: string) => void | Promise<void>;
  onReactToMessage: (messageId: string, emoji: string) => void | Promise<void>;
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
  onSendGift?: (userId: string) => void;
  roomId?: string;
  participantNames?: string[];
  /** userId → display name, used for the typing indicator */
  participantNamesById?: Record<string, string>;
  /** Re-send a message whose status is "failed" */
  onRetryMessage?: (message: Message) => void;
  onReportMessage?: (message: Message) => void;
}

// ============================================================
// Data
// ============================================================

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    icon: "😊",
    emojis: ["😊","😂","🤣","❤️","🔥","🥰","😍","🤩","😎","🥳","😇","🤗","😘","🥺","😭","😤","😡","🤬","😱","🤔","😴","🙄","😮","😢","😆","😉","😌","🤭","🫡","🫶","💀","👀","✨","💖","💯"],
  },
  {
    name: "Gestures",
    icon: "👍",
    emojis: ["👍","👎","👏","🙌","🤝","✌️","🤞","👊","💪","🙏","🤲","👐","🤙","👋","🤚","🖐️","✋","🖖","👌","🤌","☝️","👇","👉","👈","🤘","🤟","🫶"],
  },
  {
    name: "Activities",
    icon: "🎉",
    emojis: ["🎉","🎊","🎈","🎁","🏆","🏅","🥇","🥈","🥉","🎯","🎳","🎮","🎲","♟️","🎪","🎨","🎭","🎤","⚽","🏀","🎸","🎧","🎵","🎶","🎬","🎃","🎄"],
  },
  {
    name: "Objects",
    icon: "💡",
    emojis: ["💡","🔑","🔓","🔒","🔐","🛡️","🪄","🧹","🪣","🧺","🪑","🛋️","🖼️","🧿","🪔","📚","📌","📎","💻","📱","🎁","💎","🎀","🔔"],
  },
  {
    name: "Symbols",
    icon: "💯",
    emojis: ["💯","❗","❓","❕","❌","✅","⭕","🔄","🔁","🔂","▶️","⏸️","⏹️","⏺️","🔽","🔼","⏩","⭐","🌟","💥","⚡","❤️‍🔥","🚀","☑️","‼️"],
  },
];

const QUICK_REACTIONS = ["❤️","🔥","😂","👏","💯","🙏","😮","👍"];
const QUICK_REPLIES = ["Thanks!","I agree 👍","Good point!","Can you explain?","One moment...","That's awesome!"];
const CONVERSATION_STARTERS = [
  "👋 Hi everyone! Nice to meet you.",
  "What topic should we practice today?",
  "Could someone correct my sentence?",
];

const MAX_MESSAGE_LENGTH = 2000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const COMPOSER_MAX_HEIGHT = 140;
const MAX_RECENT_EMOJIS = 16;
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

const MIN_CHAT_WIDTH = 320;
const MAX_CHAT_WIDTH = 720;
const DEFAULT_CHAT_WIDTH = 390;
const EXPANDED_CHAT_WIDTH = 560;

const STORAGE_KEYS = {
  width: "speakbetter-chat-width",
  sound: "speakbetter-chat-sound",
  compact: "speakbetter-chat-compact",
  recentEmojis: "speakbetter-chat-recent-emojis",
};

// ============================================================
// Helpers
// ============================================================

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

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
  return format(d, "EEEE, MMMM d");
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

function nameHue(name: string): number {
  return name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
}

function getTimeAgo(date: string): string {
  const d = safeDate(date);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

function formatFileSize(size?: number): string {
  if (size == null || !Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

function mentionHandle(name: string): string {
  return name.replace(/\s+/g, "");
}

function normalizeReactions(reactions: Message["reactions"]): Array<[string, string[]]> {
  if (!reactions) return [];
  const normalized: Record<string, string[]> = {};
  if (Array.isArray(reactions)) {
    for (const reaction of reactions) {
      const userId = reaction.userId || reaction.user?.id;
      if (reaction.emoji && userId) {
        normalized[reaction.emoji] = [...new Set([...(normalized[reaction.emoji] || []), userId])];
      }
    }
  } else {
    for (const [emoji, users] of Object.entries(reactions)) {
      if (Array.isArray(users)) normalized[emoji] = [...new Set(users.filter(Boolean))];
    }
  }
  return Object.entries(normalized).filter(([, users]) => users.length > 0);
}

function reactionTooltip(emoji: string, users: string[], currentUserId: string): string {
  const reacted = users.includes(currentUserId);
  const others = users.length - (reacted ? 1 : 0);
  if (reacted && others === 0) return `You reacted ${emoji}`;
  if (reacted) return `You and ${others} other${others === 1 ? "" : "s"} reacted ${emoji}`;
  return `${users.length} ${users.length === 1 ? "person" : "people"} reacted ${emoji}`;
}

function playMessageChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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
  } catch { /* silent fail */ }
}

/** Inline markdown-ish formatting: **bold**, *italic*, `code`, links, @mentions, search highlights */
function renderRichText(text: string, searchQuery: string, onAccent: boolean): React.ReactNode {
  const cleanQuery = searchQuery.trim();
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  const tokenRe = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|https?:\/\/[^\s<]+|@[a-zA-Z0-9_.-]+)/gi;
  const linkColor = onAccent ? "#ffffff" : THEME.colors.accent.cyan;
  const mentionColor = onAccent ? "#ffffff" : THEME.colors.accent.secondary;
  const mentionBg = onAccent ? "rgba(255,255,255,0.18)" : "rgba(167,139,250,0.14)";

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
          <mark key={`${keyBase}-h-${i}`} className="rounded px-0.5" style={{ background: "rgba(250, 204, 21, 0.35)", color: "inherit" }}>
            {part}
          </mark>,
        );
      } else if (part) {
        nodes.push(<React.Fragment key={`${keyBase}-p-${i}`}>{part}</React.Fragment>);
      }
    });
  };

  let match: RegExpExecArray | null;
  const re = new RegExp(tokenRe.source, tokenRe.flags);
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) pushPlain(text.slice(lastIndex, match.index), `t-${lastIndex}`);
    const token = match[0];
    const key = `tok-${match.index}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={key} className="rounded px-1 py-0.5 text-[0.85em] font-mono" style={{ background: onAccent ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.08)", color: onAccent ? "#fff" : THEME.colors.accent.cyan }}>
          {token.slice(1, -1)}
        </code>,
      );
    } else if (/^https?:\/\//i.test(token)) {
      nodes.push(
        <a key={key} href={token} target="_blank" rel="noreferrer" className="underline underline-offset-2 break-all hover:opacity-80" style={{ color: linkColor }} onClick={(e) => e.stopPropagation()}>
          {token}
        </a>,
      );
    } else if (token.startsWith("@")) {
      nodes.push(
        <span key={key} className="font-semibold rounded px-0.5" style={{ color: mentionColor, background: mentionBg }}>
          {token}
        </span>,
      );
    } else {
      pushPlain(token, key);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) pushPlain(text.slice(lastIndex), `t-${lastIndex}`);
  return nodes.length ? nodes : text;
}

function getAttachmentIcon(type: Attachment["type"]) {
  switch (type) {
    case "image": return Image;
    case "video": return Video;
    case "audio": return Music;
    case "gif": return Sparkles;
    case "sticker": return Smile;
    default: return File;
  }
}

function buildGroupedMessages(source: Message[], currentUserId: string): DateGroup[] {
  const groups: DateGroup[] = [];
  let currentDateGroup: DateGroup | null = null;
  let currentSenderGroup: SenderGroup | null = null;

  const sorted = [...source].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  for (const msg of sorted) {
    const msgDate = new Date(msg.createdAt);
    const key = dayKey(msg.createdAt);
    const senderName = resolveSenderName(msg);

    if (!currentDateGroup || currentDateGroup.key !== key) {
      currentDateGroup = { key, label: formatDateSeparator(msg.createdAt), messages: [] };
      groups.push(currentDateGroup);
      currentSenderGroup = null;
    }

    const lastMsg = currentSenderGroup?.messages.at(-1);
    const gap = lastMsg && msgDate.getTime() - new Date(lastMsg.createdAt).getTime() > GROUP_WINDOW_MS;

    if (!currentSenderGroup || currentSenderGroup.senderId !== msg.senderId || gap || msg.isDeleted || lastMsg?.isDeleted) {
      currentSenderGroup = { senderId: msg.senderId, senderName, isOwn: msg.senderId === currentUserId, messages: [] };
      currentDateGroup.messages.push(currentSenderGroup);
    }

    currentSenderGroup.messages.push({ ...msg, senderName });
  }

  return groups;
}

function groupPosition(index: number, length: number): GroupPosition {
  if (length === 1) return "single";
  if (index === 0) return "first";
  if (index === length - 1) return "last";
  return "middle";
}

/** Corner radii so consecutive bubbles from one sender read as a single stack */
function bubbleRadius(position: GroupPosition, isOwn: boolean): string {
  const big = "18px";
  const small = "6px";
  // order: top-left, top-right, bottom-right, bottom-left
  const tl = !isOwn && (position === "middle" || position === "last") ? small : big;
  const bl = !isOwn && (position === "first" || position === "middle" || position === "single") ? small : big;
  const tr = isOwn && (position === "middle" || position === "last") ? small : big;
  const br = isOwn && (position === "first" || position === "middle" || position === "single") ? small : big;
  return `${tl} ${tr} ${br} ${bl}`;
}

// ============================================================
// Sub-components
// ============================================================

const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, onClick, active = false, activeColor = THEME.colors.accent.primary, className, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    title={label}
    className={cn(
      "w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
      className,
    )}
    style={{ color: active ? activeColor : THEME.colors.text.muted, background: active ? "rgba(255,255,255,0.06)" : undefined }}
  >
    {children}
  </button>
);

const Toggle: React.FC<{ on: boolean }> = ({ on }) => (
  <span className="w-8 h-[18px] rounded-full p-0.5 transition-colors shrink-0" style={{ background: on ? THEME.colors.accent.primary : "rgba(255,255,255,0.12)" }}>
    <span className={cn("block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform", on ? "translate-x-3.5" : "translate-x-0")} />
  </span>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="px-1.5 py-0.5 rounded-md border text-[10px] font-medium font-sans" style={{ borderColor: THEME.colors.border.strong, background: "rgba(255,255,255,0.05)", color: THEME.colors.text.secondary }}>
    {children}
  </kbd>
);

const UserAvatar: React.FC<{ name?: string; avatarUrl?: string; size?: number }> = ({ name, avatarUrl, size = 32 }) => {
  const [failed, setFailed] = useState(false);
  const safeName = String(name || "User").trim() || "User";
  const hue = nameHue(safeName);
  const showImage = !!avatarUrl && !failed;

  return (
    <div
      className="rounded-full shrink-0 overflow-hidden flex items-center justify-center font-semibold select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size / 2.6),
        color: THEME.colors.text.primary,
        background: `linear-gradient(135deg, hsl(${hue} 60% 40%), hsl(${(hue + 40) % 360} 55% 28%))`,
      }}
      aria-hidden
    >
      {showImage ? (
        <img src={avatarUrl} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(safeName)
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  color?: string;
}> = ({ icon: Icon, label, onClick, danger = false, color }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left transition-colors focus-visible:outline-none",
      danger ? "hover:bg-red-500/10 focus-visible:bg-red-500/10" : "hover:bg-white/[0.07] focus-visible:bg-white/[0.07]",
    )}
    style={{ color: color ?? (danger ? THEME.colors.accent.error : THEME.colors.text.secondary) }}
  >
    <Icon className="w-4 h-4 shrink-0" />
    {label}
  </button>
);

const LinkPreview: React.FC<{ url: string; onAccent: boolean }> = ({ url, onAccent }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="mt-2 flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors"
    style={{ background: onAccent ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.04)" }}
    onClick={(e) => e.stopPropagation()}
  >
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: onAccent ? "rgba(255,255,255,0.14)" : "rgba(34,211,238,0.12)" }}>
      <Link2 className="w-4 h-4" style={{ color: onAccent ? "#fff" : THEME.colors.accent.cyan }} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-xs font-semibold truncate" style={{ color: onAccent ? "#fff" : THEME.colors.text.primary }}>{extractHostname(url)}</div>
      <div className="text-[11px] truncate" style={{ color: onAccent ? "rgba(255,255,255,0.75)" : THEME.colors.text.muted }}>{url}</div>
    </div>
  </a>
);

const AttachmentList: React.FC<{ attachments: Attachment[] }> = ({ attachments }) => (
  <div className={cn("mt-2 grid gap-1.5", attachments.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
    {attachments.map((att) => {
      const Icon = getAttachmentIcon(att.type);

      if (att.type === "image" || att.type === "gif" || att.type === "sticker") {
        return (
          <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-xl group/attachment" onClick={(e) => e.stopPropagation()}>
            <img src={att.url} alt={att.name || "Image attachment"} loading="lazy" className="w-full max-h-56 object-cover transition-transform duration-300 group-hover/attachment:scale-[1.03]" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            {att.type === "gif" && <span className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-black/60 text-white">GIF</span>}
          </a>
        );
      }

      if (att.type === "video") {
        return <video key={att.id} src={att.url} controls preload="metadata" className="w-full max-h-56 rounded-xl bg-black/40" onClick={(e) => e.stopPropagation()} />;
      }

      if (att.type === "audio") {
        return (
          <div key={att.id} className="col-span-full flex items-center gap-2 p-2 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(129,140,248,0.18)" }}>
              <Music className="w-4 h-4" style={{ color: THEME.colors.accent.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs truncate" style={{ color: THEME.colors.text.primary }}>{att.name || "Audio"}</div>
              {att.duration ? <div className="text-[11px]" style={{ color: THEME.colors.text.muted }}>{Math.round(att.duration)}s</div> : null}
            </div>
            <audio src={att.url} controls className="max-w-[150px] h-8" />
          </div>
        );
      }

      return (
        <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="col-span-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors" style={{ background: "rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
          <Icon className="w-4 h-4 shrink-0" style={{ color: THEME.colors.accent.primary }} />
          <span className="text-xs truncate flex-1" style={{ color: THEME.colors.text.primary }}>{att.name || "File"}</span>
          {att.size ? <span className="text-[11px] shrink-0" style={{ color: THEME.colors.text.muted }}>{formatFileSize(att.size)}</span> : null}
        </a>
      );
    })}
  </div>
);

const StatusIcon: React.FC<{ status: Message["status"]; onAccent: boolean }> = ({ status, onAccent }) => {
  const base = onAccent ? "rgba(255,255,255,0.75)" : THEME.colors.text.muted;
  switch (status) {
    case "sending":
      return <Clock className="w-3 h-3" style={{ color: base }} aria-label="Sending" />;
    case "failed":
      return <CircleAlert className="w-3 h-3" style={{ color: THEME.colors.accent.error }} aria-label="Not sent" />;
    case "read":
      return <CheckCheck className="w-3.5 h-3.5" style={{ color: onAccent ? "#a5f3fc" : THEME.colors.accent.cyan }} aria-label="Read" />;
    case "delivered":
      return <CheckCheck className="w-3.5 h-3.5" style={{ color: base }} aria-label="Delivered" />;
    default:
      return <Check className="w-3 h-3" style={{ color: base }} aria-label="Sent" />;
  }
};

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  currentUserId: string;
  canModerate: boolean;
  compact: boolean;
  position: GroupPosition;
  showHeader: boolean;
  isHighlighted?: boolean;
  searchQuery: string;
  getScrollRect: () => DOMRect | null;
  onReply: () => void;
  onPin: () => void;
  onDelete: () => void;
  onEdit: (newContent: string) => void;
  onReact: (emoji: string) => void;
  onKick: () => void;
  onMute: () => void;
  onTranslate?: () => void;
  onSendGift?: () => void;
  onReport?: () => void;
  onRetry?: () => void;
  onJumpToReply: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, isOwn, currentUserId, canModerate, compact, position, showHeader, isHighlighted = false, searchQuery, getScrollRect,
  onReply, onPin, onDelete, onEdit, onReact, onKick, onMute, onTranslate, onSendGift, onReport, onRetry, onJumpToReply,
}) => {
  const [hovered, setHovered] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [placeBelow, setPlaceBelow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const rowRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const lastTap = useRef(0);

  const isSending = message.status === "sending";
  const isFailed = message.status === "failed";
  const canEdit = (isOwn || canModerate) && !isSending && !isFailed;
  const canDelete = (isOwn || canModerate) && !isSending;
  const isOtherUser = message.senderId !== currentUserId;
  const displayName = resolveSenderName(message);
  const hue = nameHue(displayName);
  const onAccent = isOwn && !isHighlighted;
  const popoverOpen = showMenu || showReactionPicker;

  const firstUrl = useMemo(() => message.content?.match(URL_REGEX)?.[0] ?? null, [message.content]);
  const reactionEntries = useMemo(() => normalizeReactions(message.reactions), [message.reactions]);

  // Close popovers on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) {
        setShowMenu(false);
        setShowReactionPicker(false);
        setHovered(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [popoverOpen]);

  /** Open popovers below the bubble when it sits near the top of the list, above otherwise */
  const measurePlacement = useCallback(() => {
    const rect = rowRef.current?.getBoundingClientRect();
    const container = getScrollRect();
    if (!rect || !container) return;
    setPlaceBelow(rect.top - container.top < 220);
  }, [getScrollRect]);

  const openMenu = useCallback(() => {
    measurePlacement();
    setShowReactionPicker(false);
    setShowMenu((v) => !v);
  }, [measurePlacement]);

  const openReactionPicker = useCallback(() => {
    measurePlacement();
    setShowMenu(false);
    setShowReactionPicker((v) => !v);
  }, [measurePlacement]);

  const closeAll = useCallback(() => {
    setShowMenu(false);
    setShowReactionPicker(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Message copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy message");
    }
  }, [message.content]);

  const startEdit = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
    closeAll();
  }, [message.content, closeAll]);

  const submitEdit = useCallback(() => {
    const next = editContent.trim();
    if (!next) { toast.error("Message cannot be empty"); return; }
    if (next !== message.content.trim()) onEdit(next);
    setIsEditing(false);
  }, [editContent, message.content, onEdit]);

  // Touch: long-press opens the menu, double-tap likes. Mouse users get the hover toolbar instead,
  // so double-clicking to select text never fires a reaction.
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || isEditing) return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      lastTap.current = 0;
      setHovered(true);
      measurePlacement();
      setShowMenu(true);
    }, 450);
  }, [clearLongPress, isEditing, measurePlacement]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const wasLongPress = longPressTimer.current === null && showMenu;
    clearLongPress();
    if (wasLongPress || isEditing || message.isDeleted) return;
    if ((e.target as HTMLElement).closest("button, a, textarea, video, audio")) return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onReact("❤️");
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, [clearLongPress, isEditing, message.isDeleted, onReact, showMenu]);

  if (message.isDeleted) {
    return (
      <div className={cn("flex", isOwn ? "justify-end" : "justify-start", compact ? "my-0.5" : "my-1", !isOwn && "pl-9")}>
        <div className="px-3 py-1.5 rounded-2xl border border-dashed" style={{ borderColor: THEME.colors.border.strong }}>
          <p className="text-xs italic" style={{ color: THEME.colors.text.muted }}>This message was deleted</p>
        </div>
      </div>
    );
  }

  const showAvatar = !isOwn && (position === "last" || position === "single");
  const toolbarVisible = (hovered || popoverOpen) && !isEditing && !isSending;

  const bubbleBackground = isHighlighted
    ? "rgba(129,140,248,0.22)"
    : isOwn
      ? OWN_BUBBLE_GRADIENT
      : "rgba(255,255,255,0.055)";

  const bubbleBorder = message.isPinned
    ? "rgba(251,191,36,0.55)"
    : isHighlighted
      ? "rgba(129,140,248,0.5)"
      : isOwn
        ? "transparent"
        : "rgba(255,255,255,0.07)";

  const metaColor = onAccent ? "rgba(255,255,255,0.72)" : THEME.colors.text.muted;

  return (
    <div
      ref={rowRef}
      className={cn("relative flex items-end gap-2 group/message", isOwn ? "justify-end" : "justify-start", showHeader ? (compact ? "mt-2" : "mt-3.5") : compact ? "mt-px" : "mt-0.5")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!popoverOpen) setHovered(false); }}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setHovered(false);
          closeAll();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={clearLongPress}
      onPointerMove={(e) => { if (e.pointerType === "touch" && longPressTimer.current) clearLongPress(); }}
      onContextMenu={(e) => { if (longPressTimer.current || showMenu) e.preventDefault(); }}
    >
      {/* Avatar column (others only) */}
      {!isOwn && (
        <div className="w-7 shrink-0 self-end">
          {showAvatar && <UserAvatar name={displayName} avatarUrl={message.senderAvatar || message.sender?.avatar} size={28} />}
        </div>
      )}

      <div className={cn("relative min-w-0 flex flex-col", isOwn ? "items-end" : "items-start", compact ? "max-w-[88%]" : "max-w-[80%]")}>
        {showHeader && !isOwn && (
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className="text-xs font-semibold truncate" style={{ color: `hsl(${hue} 80% 76%)` }}>{displayName}</span>
            <span className="text-[11px] tabular-nums shrink-0" style={{ color: THEME.colors.text.muted }} title={getTimeAgo(message.createdAt)}>
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}

        <div
          className={cn("relative border transition-shadow", compact ? "px-3 py-1.5" : "px-3.5 py-2", isHighlighted && "shadow-[0_0_24px_rgba(129,140,248,0.25)]")}
          style={{
            background: bubbleBackground,
            borderColor: bubbleBorder,
            borderRadius: bubbleRadius(position, isOwn),
            opacity: isSending ? 0.7 : 1,
            boxShadow: isOwn && !isHighlighted ? "0 6px 18px -10px rgba(99,102,241,0.8)" : undefined,
          }}
        >
          {message.isPinned && (
            <div className="flex items-center gap-1 text-[11px] font-semibold mb-1" style={{ color: onAccent ? "#fde68a" : THEME.colors.accent.warning }}>
              <Pin className="w-3 h-3" /> Pinned
            </div>
          )}

          {message.replyTo && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onJumpToReply(message.replyTo!.id); }}
              className="w-full text-left mb-1.5 pl-2 pr-2 py-1 border-l-[3px] rounded-md transition-colors hover:brightness-125"
              style={{
                borderColor: onAccent ? "rgba(255,255,255,0.7)" : THEME.colors.accent.primary,
                background: onAccent ? "rgba(0,0,0,0.18)" : "rgba(129,140,248,0.08)",
              }}
              title="Jump to the original message"
            >
              <div className="text-[11px] font-semibold truncate" style={{ color: onAccent ? "#fff" : THEME.colors.accent.secondary }}>
                {resolveSenderName(message.replyTo)}
              </div>
              <div className="text-xs truncate" style={{ color: onAccent ? "rgba(255,255,255,0.8)" : THEME.colors.text.muted }}>
                {message.replyTo.isDeleted ? "Deleted message" : message.replyTo.content || "Attachment"}
              </div>
            </button>
          )}

          {isEditing ? (
            <div className="min-w-[220px] space-y-1.5" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                className="w-full px-2.5 py-2 rounded-lg text-sm outline-none border resize-none focus:border-indigo-300/60"
                style={{ background: "rgba(10,10,18,0.85)", color: THEME.colors.text.primary, borderColor: THEME.colors.border.strong }}
                rows={Math.min(6, Math.max(2, editContent.split("\n").length))}
                autoFocus
                aria-label="Edit message"
                onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") { e.preventDefault(); setIsEditing(false); }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px]" style={{ color: metaColor }}>Enter to save · Esc to cancel</span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setIsEditing(false)} className="px-2.5 py-1 rounded-md text-xs hover:bg-white/10" style={{ color: onAccent ? "#fff" : THEME.colors.text.secondary }}>Cancel</button>
                  <button type="button" onClick={submitEdit} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: onAccent ? "#fff" : THEME.colors.accent.primary, color: onAccent ? "#4f46e5" : "#fff" }}>Save</button>
                </div>
              </div>
            </div>
          ) : (
            message.content && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: onAccent ? "#fff" : THEME.colors.text.primary }}>
                {renderRichText(message.content, searchQuery, onAccent)}
              </p>
            )
          )}

          {firstUrl && !isEditing && !compact && <LinkPreview url={firstUrl} onAccent={onAccent} />}
          {message.attachments?.length ? <AttachmentList attachments={message.attachments} /> : null}

          {/* Meta row: edited · time · delivery status */}
          {!isEditing && (
            <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5 select-none">
              {message.isEdited && <span className="text-[10px]" style={{ color: metaColor }}>edited</span>}
              {(isOwn || !showHeader) && (
                <span className="text-[10px] tabular-nums" style={{ color: metaColor }} title={getTimeAgo(message.createdAt)}>
                  {formatTime(message.createdAt)}
                </span>
              )}
              {isOwn && <StatusIcon status={message.status} onAccent={onAccent} />}
            </div>
          )}
        </div>

        {isFailed && (
          <div className="flex items-center gap-1.5 mt-1 px-1 text-[11px]" style={{ color: THEME.colors.accent.error }}>
            <CircleAlert className="w-3 h-3" /> Not sent
            {onRetry && (
              <button type="button" onClick={onRetry} className="flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
                <RotateCcw className="w-3 h-3" /> Retry
              </button>
            )}
          </div>
        )}

        {reactionEntries.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1 px-0.5", isOwn ? "justify-end" : "justify-start")}>
            {reactionEntries.map(([emoji, users]) => {
              const reacted = users.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className="flex items-center gap-1 h-6 px-2 rounded-full text-xs border transition-transform hover:scale-105 active:scale-95"
                  style={{
                    background: reacted ? "rgba(129,140,248,0.22)" : "rgba(255,255,255,0.05)",
                    borderColor: reacted ? "rgba(129,140,248,0.55)" : THEME.colors.border.primary,
                  }}
                  title={reactionTooltip(emoji, users, currentUserId)}
                  aria-label={reactionTooltip(emoji, users, currentUserId)}
                  aria-pressed={reacted}
                >
                  <span className="leading-none">{emoji}</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: reacted ? "#c7d2fe" : THEME.colors.text.secondary }}>{users.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Hover toolbar: sits beside the bubble so it never covers text or gets clipped at the top */}
        <AnimatePresence>
          {toolbarVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.1 }}
              className={cn("absolute top-0 z-30 flex items-center gap-0.5 p-0.5 rounded-xl border shadow-xl backdrop-blur-md", isOwn ? "right-full mr-1.5" : "left-full ml-1.5")}
              style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
              role="toolbar"
              aria-label="Message actions"
            >
              {!isFailed && (
                <IconButton label="Add reaction" onClick={openReactionPicker} active={showReactionPicker} className="w-7 h-7">
                  <Smile className="w-4 h-4" />
                </IconButton>
              )}
              {!isFailed && (
                <IconButton label="Reply" onClick={() => { onReply(); closeAll(); }} className="w-7 h-7">
                  <Reply className="w-4 h-4" />
                </IconButton>
              )}
              <IconButton label="More actions" onClick={openMenu} active={showMenu} className="w-7 h-7">
                <Ellipsis className="w-4 h-4" />
              </IconButton>

              <AnimatePresence>
                {showReactionPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: placeBelow ? -4 : 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: placeBelow ? -4 : 4, scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    className={cn("absolute flex items-center gap-0.5 p-1 rounded-full border shadow-2xl z-50 backdrop-blur-md", placeBelow ? "top-full mt-1.5" : "bottom-full mb-1.5", isOwn ? "right-0" : "left-0")}
                    style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
                    role="menu"
                    aria-label="Pick a reaction"
                  >
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        role="menuitem"
                        onClick={() => { onReact(emoji); closeAll(); }}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-white/10 focus-visible:outline-none focus-visible:bg-white/10"
                        aria-label={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: placeBelow ? -4 : 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: placeBelow ? -4 : 4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className={cn("absolute w-52 p-1 rounded-xl border shadow-2xl z-50 backdrop-blur-md", placeBelow ? "top-full mt-1.5" : "bottom-full mb-1.5", isOwn ? "right-0" : "left-0")}
                    style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
                    role="menu"
                    aria-label="Message options"
                  >
                    {!isFailed && <MenuItem icon={CornerDownRight} label="Reply" onClick={() => { onReply(); closeAll(); }} />}
                    {message.content && <MenuItem icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy text"} onClick={() => { void handleCopy(); closeAll(); }} />}
                    {onTranslate && !isFailed && <MenuItem icon={Languages} label="Translate" onClick={() => { onTranslate(); closeAll(); }} />}
                    {onSendGift && isOtherUser && <MenuItem icon={Gift} label="Send gift" onClick={() => { onSendGift(); closeAll(); }} />}
                    {canModerate && !isFailed && (
                      <MenuItem
                        icon={message.isPinned ? PinOff : Pin}
                        label={message.isPinned ? "Unpin message" : "Pin message"}
                        color={message.isPinned ? THEME.colors.accent.warning : undefined}
                        onClick={() => { onPin(); closeAll(); }}
                      />
                    )}
                    {canEdit && <MenuItem icon={Pencil} label="Edit message" onClick={startEdit} />}
                    {canModerate && isOtherUser && (
                      <>
                        <div className="my-1 h-px" style={{ background: THEME.colors.border.primary }} />
                        <MenuItem icon={VolumeX} label="Mute user" onClick={() => { onMute(); closeAll(); }} />
                        <MenuItem icon={UserX} label="Remove from room" danger onClick={() => { onKick(); closeAll(); }} />
                      </>
                    )}
                    {onReport && isOtherUser && <MenuItem icon={Flag} label="Report message" onClick={() => { onReport(); closeAll(); }} />}
                    {canDelete && (
                      <>
                        <div className="my-1 h-px" style={{ background: THEME.colors.border.primary }} />
                        <MenuItem icon={Trash2} label="Delete message" danger onClick={() => { onDelete(); closeAll(); }} />
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="sticky top-1 z-10 flex justify-center my-3 pointer-events-none select-none">
    <span
      className="text-[11px] font-semibold px-3 py-1 rounded-full border shadow-md backdrop-blur-md"
      style={{ color: THEME.colors.text.secondary, borderColor: THEME.colors.border.primary, background: "rgba(20,20,34,0.85)" }}
    >
      {label}
    </span>
  </div>
);

const UnreadDivider: React.FC = () => (
  <div className="flex items-center gap-3 my-3 select-none" role="separator" aria-label="New messages">
    <div className="h-px flex-1" style={{ background: "rgba(248,113,113,0.45)" }} />
    <span className="text-[11px] font-semibold" style={{ color: THEME.colors.accent.error }}>New messages</span>
    <div className="h-px flex-1" style={{ background: "rgba(248,113,113,0.45)" }} />
  </div>
);

const TypingIndicator: React.FC<{ users: string[] }> = ({ users }) => {
  let label = "";
  if (users.length === 1) label = `${users[0]} is typing`;
  else if (users.length === 2) label = `${users[0]} and ${users[1]} are typing`;
  else if (users.length > 2) label = `${users[0]} and ${users.length - 1} others are typing`;

  return (
    <div className="h-6 px-4 flex items-center shrink-0" aria-live="polite">
      <AnimatePresence>
        {users.length > 0 && (
          <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 min-w-0">
            <span className="flex gap-0.5 shrink-0">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: THEME.colors.accent.primary }} animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, delay: i * 0.13, repeat: Infinity }} />
              ))}
            </span>
            <span className="text-[11px] truncate" style={{ color: THEME.colors.text.muted }}>{label}…</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};

const JumpToLatest: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => (
  <motion.button
    initial={{ opacity: 0, y: 8, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.95 }}
    type="button"
    onClick={onClick}
    className="absolute bottom-3 left-1/2 -translate-x-1/2 h-8 pl-2.5 pr-3 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xl border z-20 backdrop-blur-md hover:brightness-110"
    style={{ background: count > 0 ? OWN_BUBBLE_GRADIENT : THEME.colors.background.card, color: THEME.colors.text.primary, borderColor: count > 0 ? "transparent" : THEME.colors.border.strong }}
  >
    <ArrowDown className="w-3.5 h-3.5" />
    {count > 0 ? `${count} new message${count === 1 ? "" : "s"}` : "Jump to latest"}
  </motion.button>
);

/** One pinned message at a time; clicking jumps to it and advances to the next (newest first) */
const PinnedBar: React.FC<{
  messages: Message[];
  onJump: (id: string) => void;
  onUnpin?: (id: string) => void;
}> = ({ messages, onJump, onUnpin }) => {
  const [index, setIndex] = useState(0);
  if (!messages.length) return null;
  const safeIndex = index % messages.length;
  const current = messages[messages.length - 1 - safeIndex];

  return (
    <div className="flex items-stretch gap-1 px-3 py-1.5 border-b shrink-0" style={{ borderColor: THEME.colors.border.primary, background: "rgba(251,191,36,0.05)" }}>
      <button
        type="button"
        onClick={() => { onJump(current.id); setIndex((i) => (i + 1) % messages.length); }}
        className="flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg px-1.5 py-1 hover:bg-white/[0.04] transition-colors"
        title="Jump to pinned message"
      >
        <div className="flex flex-col gap-0.5 self-stretch py-0.5 shrink-0" aria-hidden>
          {messages.slice(0, 4).map((m, i) => (
            <span key={m.id} className="w-0.5 flex-1 rounded-full" style={{ background: i === Math.min(safeIndex, 3) ? THEME.colors.accent.warning : "rgba(251,191,36,0.25)" }} />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: THEME.colors.accent.warning }}>
            <Pin className="w-3 h-3" /> Pinned{messages.length > 1 ? ` · ${safeIndex + 1}/${messages.length}` : ""}
          </div>
          <div className="text-xs truncate" style={{ color: THEME.colors.text.secondary }}>
            <span className="font-medium" style={{ color: THEME.colors.text.primary }}>{resolveSenderName(current)}: </span>
            {current.content || "Attachment"}
          </div>
        </div>
      </button>
      {onUnpin && (
        <IconButton label="Unpin message" onClick={() => onUnpin(current.id)} className="self-center w-7 h-7">
          <X className="w-3.5 h-3.5" />
        </IconButton>
      )}
    </div>
  );
};

const MentionSuggestions: React.FC<{
  matches: string[];
  activeIndex: number;
  onSelect: (name: string) => void;
  onHover: (index: number) => void;
}> = ({ matches, activeIndex, onSelect, onHover }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 6 }}
    transition={{ duration: 0.12 }}
    className="absolute bottom-full left-2.5 right-2.5 mb-2 rounded-xl border shadow-2xl z-40 overflow-hidden backdrop-blur-md"
    style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
    role="listbox"
    aria-label="Mention someone"
  >
    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: THEME.colors.text.muted }}>
      <AtSign className="w-3 h-3" /> Mention · <span className="normal-case tracking-normal font-normal">↑↓ to choose, Enter to insert</span>
    </div>
    {matches.map((name, i) => (
      <button
        key={name}
        type="button"
        role="option"
        aria-selected={i === activeIndex}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(name)}
        onMouseEnter={() => onHover(i)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm"
        style={{ color: THEME.colors.text.primary, background: i === activeIndex ? "rgba(129,140,248,0.16)" : "transparent" }}
      >
        <UserAvatar name={name} size={24} />
        <span className="truncate">{name}</span>
        <span className="ml-auto text-xs truncate" style={{ color: THEME.colors.text.muted }}>@{mentionHandle(name)}</span>
      </button>
    ))}
  </motion.div>
);

// ============================================================
// Main Chat Panel
// ============================================================

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages, newMessage, replyTo, typingUsers, currentUserId, isHost, isModerator, showEmojiPicker, onEmojiPickerToggle, onMessageChange, onSendMessage, onReply, onPinMessage, onDeleteMessage, onEditMessage, onReactToMessage, onKickUser, onMuteUser, onTranslateMessage, chatSearch, onChatSearchChange, showChatSearch, onToggleChatSearch, totalParticipants, scrollRef, endRef, textareaRef, isNearBottom, onScroll, hasNewMessages, newMessageCount, onScrollToBottom, className, onAttachFile, onSendGift, roomId, participantNames = [], participantNamesById, onRetryMessage, onReportMessage,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(-1);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(readStorage(STORAGE_KEYS.recentEmojis) || "[]");
      return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string").slice(0, MAX_RECENT_EMOJIS) : [];
    } catch {
      return [];
    }
  });
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [compactMode, setCompactMode] = useState(() => readStorage(STORAGE_KEYS.compact) === "1");
  const [soundEnabled, setSoundEnabled] = useState(() => readStorage(STORAGE_KEYS.sound) === "1");
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = Number(readStorage(STORAGE_KEYS.width));
    return Number.isFinite(saved) && saved > 0 ? Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, saved)) : DEFAULT_CHAT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  const panelRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(DEFAULT_CHAT_WIDTH);

  const canModerate = isHost || isModerator;
  const isExpanded = panelWidth >= EXPANDED_CHAT_WIDTH - 20;
  const normalizedSearch = chatSearch.trim().toLowerCase();

  // ---------- derived data ----------

  const visibleCount = useMemo(() => messages.filter((m) => !m.isDeleted).length, [messages]);

  const filteredMessages = useMemo(() => {
    let result = messages;
    if (showPinnedOnly) result = result.filter((message) => message.isPinned && !message.isDeleted);
    if (normalizedSearch) {
      result = result.filter((message) => {
        if (message.isDeleted) return false;
        const haystack = [message.content, resolveSenderName(message), ...(message.attachments?.map((a) => a.name || "") || [])].join(" ").toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }
    return result;
  }, [messages, normalizedSearch, showPinnedOnly]);

  const groupedMessages = useMemo(() => buildGroupedMessages(filteredMessages, currentUserId), [filteredMessages, currentUserId]);
  const pinnedMessages = useMemo(() => messages.filter((m) => m.isPinned && !m.isDeleted), [messages]);

  const typingNames = useMemo(
    () => Array.from(typingUsers).filter((id) => id !== currentUserId).map((id) => {
      const known = participantNamesById?.[id];
      if (known) return known;
      const recent = [...messages].reverse().find((message) => message.senderId === id);
      return recent ? resolveSenderName(recent) : "Someone";
    }),
    [typingUsers, currentUserId, messages, participantNamesById],
  );

  const mentionNames = useMemo(() => {
    const ownName = messages.find((m) => m.senderId === currentUserId)?.senderName;
    const fromMessages = messages.map((m) => resolveSenderName(m));
    return Array.from(new Set([...participantNames, ...fromMessages])).filter((n) => n && n !== "Unknown User" && n !== "You" && n !== ownName);
  }, [messages, participantNames, currentUserId]);

  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return mentionNames
      .filter((n) => n.toLowerCase().includes(q) || mentionHandle(n).toLowerCase().includes(q))
      .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))
      .slice(0, 6);
  }, [mention, mentionNames]);

  const emojiTabs = useMemo(
    () => (recentEmojis.length ? [{ name: "Recent", icon: "🕘", emojis: recentEmojis }, ...EMOJI_CATEGORIES] : EMOJI_CATEGORIES),
    [recentEmojis],
  );
  const activeEmojiTab = selectedCategory < 0 || selectedCategory >= emojiTabs.length ? 0 : selectedCategory;

  const getScrollRect = useCallback(() => scrollRef.current?.getBoundingClientRect() ?? null, [scrollRef]);

  // ---------- effects ----------

  // Desktop breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // New-message bookkeeping. The parent (VoiceRoomView) owns auto-scrolling; here we only
  // mark where unread messages start (adjusted during render) and play the optional chime.
  const lastMessage = messages[messages.length - 1];
  const isIncoming = (m: Message | undefined): m is Message =>
    !!m && m.senderId !== currentUserId && !m.id.startsWith("temp-");
  const [seenLastId, setSeenLastId] = useState(lastMessage?.id);
  if (lastMessage?.id !== seenLastId) {
    setSeenLastId(lastMessage?.id);
    if (seenLastId !== undefined && isIncoming(lastMessage) && !isNearBottom) {
      setUnreadAnchorId((prev) => prev ?? lastMessage.id);
    }
  }

  useEffect(() => {
    const previousId = lastMessageIdRef.current;
    lastMessageIdRef.current = lastMessage?.id;
    if (previousId === undefined || lastMessage?.id === previousId || !isIncoming(lastMessage)) return;
    if (soundEnabled && !document.hidden) playMessageChime();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to a new last message
  }, [lastMessage?.id]);

  // Reaching the bottom clears the "New messages" divider
  useEffect(() => {
    if (isNearBottom && unreadAnchorId) {
      const t = window.setTimeout(() => setUnreadAnchorId(null), 1500);
      return () => window.clearTimeout(t);
    }
  }, [isNearBottom, unreadAnchorId]);

  // Grow/shrink the composer with its content (also resets after sending)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }, [newMessage, textareaRef, isDesktop, panelWidth]);

  // Close the settings menu on outside click
  useEffect(() => {
    if (!showChatSettings) return;
    const onDoc = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) setShowChatSettings(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showChatSettings]);

  // Close the emoji picker / quick replies on outside click
  useEffect(() => {
    if (!showEmojiPicker && !showQuickReplies) return;
    const onDoc = (e: MouseEvent) => {
      if (composerRef.current?.contains(e.target as Node)) return;
      if (showEmojiPicker) onEmojiPickerToggle();
      setShowQuickReplies(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showEmojiPicker, showQuickReplies, onEmojiPickerToggle]);

  // Page-level shortcuts: "/" focuses the composer; Ctrl/Cmd+F searches only while focus is in the chat
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (event.key === "/" && !isTypingTarget && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        textareaRef.current?.focus();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && panelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        if (!showChatSearch) onToggleChatSearch();
        window.setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [textareaRef, showChatSearch, onToggleChatSearch]);

  // Panel resize (desktop)
  useEffect(() => {
    if (!isResizing) return;
    let latest = resizeStartWidth.current;
    const handlePointerMove = (event: PointerEvent) => {
      latest = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, resizeStartWidth.current + (resizeStartX.current - event.clientX)));
      setPanelWidth(latest);
    };
    const stopResize = () => {
      setIsResizing(false);
      writeStorage(STORAGE_KEYS.width, String(Math.round(latest)));
    };
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", stopResize);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // ---------- handlers ----------

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktop) return;
    event.preventDefault();
    resizeStartX.current = event.clientX;
    resizeStartWidth.current = panelWidth;
    setIsResizing(true);
  }, [panelWidth, isDesktop]);

  const toggleExpanded = useCallback(() => {
    const next = isExpanded ? DEFAULT_CHAT_WIDTH : EXPANDED_CHAT_WIDTH;
    setPanelWidth(next);
    writeStorage(STORAGE_KEYS.width, String(next));
  }, [isExpanded]);

  const scrollToBottom = useCallback(() => {
    onScrollToBottom();
    setUnreadAnchorId(null);
  }, [onScrollToBottom]);

  /** Insert text at the caret (replacing any selection), keeping focus and caret position */
  const insertAtCaret = useCallback((text: string, opts: { spaced?: boolean } = {}) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? newMessage.length;
    const end = el?.selectionEnd ?? newMessage.length;
    const before = newMessage.slice(0, start);
    const insert = opts.spaced && before && !/\s$/.test(before) ? ` ${text}` : text;
    const next = (before + insert + newMessage.slice(end)).slice(0, MAX_MESSAGE_LENGTH);
    onMessageChange(next);
    const caret = Math.min(before.length + insert.length, next.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }, [newMessage, onMessageChange, textareaRef]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    insertAtCaret(emoji);
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENT_EMOJIS);
      writeStorage(STORAGE_KEYS.recentEmojis, JSON.stringify(next));
      return next;
    });
  }, [insertAtCaret]);

  const insertMention = useCallback((name: string) => {
    if (!mention) return;
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? newMessage.length;
    const handle = `@${mentionHandle(name)} `;
    const next = (newMessage.slice(0, mention.start) + handle + newMessage.slice(caret)).slice(0, MAX_MESSAGE_LENGTH);
    onMessageChange(next);
    setMention(null);
    const position = Math.min(mention.start + handle.length, next.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(position, position);
    });
  }, [mention, newMessage, onMessageChange, textareaRef]);

  const updateMentionState = useCallback((value: string, caret: number) => {
    const match = value.slice(0, caret).match(/(^|\s)@([a-zA-Z0-9_.-]*)$/);
    if (match) {
      setMention({ query: match[2], start: caret - match[2].length - 1 });
      setMentionIndex(0);
    } else {
      setMention(null);
    }
  }, []);

  const handleTextareaChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value.slice(0, MAX_MESSAGE_LENGTH);
    onMessageChange(value);
    updateMentionState(value, event.target.selectionStart ?? value.length);
  }, [onMessageChange, updateMentionState]);

  const send = useCallback(() => {
    if (!newMessage.trim()) return;
    setMention(null);
    setShowQuickReplies(false);
    if (showEmojiPicker) onEmojiPickerToggle();
    onSendMessage();
  }, [newMessage, onSendMessage, showEmojiPicker, onEmojiPickerToggle]);

  const handleTextareaKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (mention && mentionMatches.length > 0) {
      if (event.key === "ArrowDown") { event.preventDefault(); setMentionIndex((i) => (i + 1) % mentionMatches.length); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
      if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); insertMention(mentionMatches[mentionIndex] ?? mentionMatches[0]); return; }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMention(null); return; }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }, [mention, mentionMatches, mentionIndex, insertMention, send]);

  /** Escape closes one layer at a time, innermost first */
  const handlePanelKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (showChatSettings) setShowChatSettings(false);
    else if (showEmojiPicker) onEmojiPickerToggle();
    else if (showQuickReplies) setShowQuickReplies(false);
    else if (mention) setMention(null);
    else if (replyTo) onReply(null);
    else if (showChatSearch && document.activeElement === searchInputRef.current) onToggleChatSearch();
    else return;
    event.stopPropagation();
  }, [showChatSettings, showEmojiPicker, onEmojiPickerToggle, showQuickReplies, mention, replyTo, onReply, showChatSearch, onToggleChatSearch]);

  const jumpToMessage = useCallback((messageId: string) => {
    const node = messageRefs.current[messageId];
    if (!node) {
      toast.info("That message isn't in the current view");
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.animate(
      [
        { backgroundColor: "rgba(129,140,248,0)" },
        { backgroundColor: "rgba(129,140,248,0.18)" },
        { backgroundColor: "rgba(129,140,248,0)" },
      ],
      { duration: 1400, easing: "ease-out" },
    );
  }, []);

  const clearFilters = useCallback(() => {
    onChatSearchChange("");
    setShowPinnedOnly(false);
  }, [onChatSearchChange]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      writeStorage(STORAGE_KEYS.sound, prev ? "0" : "1");
      return !prev;
    });
  }, []);

  const toggleCompact = useCallback(() => {
    setCompactMode((prev) => {
      writeStorage(STORAGE_KEYS.compact, prev ? "0" : "1");
      return !prev;
    });
  }, []);

  const charRatio = newMessage.length / MAX_MESSAGE_LENGTH;
  const nearLimit = charRatio > 0.85;
  const canSend = newMessage.trim().length > 0;
  const isFiltering = Boolean(normalizedSearch) || showPinnedOnly;

  return (
    <aside
      ref={panelRef}
      className={cn("relative flex flex-col min-h-0 shrink-0 border-l overflow-hidden", "w-full md:w-auto", className)}
      style={{
        background: "rgba(10, 10, 18, 0.97)",
        borderColor: THEME.colors.border.primary,
        width: isDesktop ? panelWidth : "100%",
        minWidth: isDesktop ? MIN_CHAT_WIDTH : undefined,
        maxWidth: isDesktop ? MAX_CHAT_WIDTH : undefined,
        transition: isResizing ? "none" : "width 160ms ease",
      }}
      data-room-id={roomId}
      aria-label="Room chat"
      onKeyDown={handlePanelKeyDown}
    >
      {/* Desktop resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
        onPointerDown={startResize}
        onDoubleClick={toggleExpanded}
        className="hidden md:block absolute left-0 top-0 bottom-0 w-1.5 z-[60] cursor-col-resize group/resize"
        title="Drag to resize · double-click to expand"
      >
        <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-1 h-14 rounded-full transition-opacity", isResizing ? "opacity-100" : "opacity-0 group-hover/resize:opacity-100")} style={{ background: THEME.colors.accent.primary }} />
      </div>

      {/* Header */}
      <div className="h-14 px-3.5 border-b flex items-center justify-between gap-2 shrink-0" style={{ borderColor: THEME.colors.border.primary }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(129,140,248,0.22), rgba(167,139,250,0.12))" }}>
            <MessagesSquare className="w-[18px] h-[18px]" style={{ color: THEME.colors.accent.primary }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight" style={{ color: THEME.colors.text.primary }}>Room chat</span>
              {visibleCount > 0 && (
                <span className="text-[10px] px-1.5 py-px rounded-full tabular-nums font-semibold" style={{ background: "rgba(129,140,248,0.16)", color: "#c7d2fe" }}>{visibleCount}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: THEME.colors.text.muted }}>
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: THEME.colors.status.online }} />
                <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: THEME.colors.status.online }} />
              </span>
              <Users className="w-3 h-3" />
              <span className="tabular-nums">{totalParticipants} in room</span>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <IconButton label="Search messages (Ctrl/Cmd + F)" onClick={onToggleChatSearch} active={showChatSearch}>
            <Search className="w-4 h-4" />
          </IconButton>
          <IconButton label={showPinnedOnly ? "Show all messages" : "Show pinned messages"} onClick={() => setShowPinnedOnly((v) => !v)} active={showPinnedOnly} activeColor={THEME.colors.accent.warning}>
            <Pin className="w-4 h-4" />
          </IconButton>
          <IconButton label={isExpanded ? "Shrink chat" : "Expand chat"} onClick={toggleExpanded} className="hidden md:flex">
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </IconButton>

          <div className="relative" ref={settingsRef}>
            <IconButton label="Chat settings" onClick={() => setShowChatSettings((v) => !v)} active={showChatSettings}>
              <Settings2 className="w-4 h-4" />
            </IconButton>

            <AnimatePresence>
              {showChatSettings && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border p-1.5 shadow-2xl z-50 backdrop-blur-md"
                  style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
                  role="menu"
                >
                  <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: THEME.colors.text.muted }}>Display</div>
                  <button type="button" role="menuitemcheckbox" aria-checked={compactMode} onClick={toggleCompact} className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.06] text-left">
                    <span className="text-[13px]" style={{ color: THEME.colors.text.secondary }}>Compact messages</span>
                    <Toggle on={compactMode} />
                  </button>
                  <button type="button" role="menuitemcheckbox" aria-checked={soundEnabled} onClick={toggleSound} className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.06] text-left">
                    <span className="flex items-center gap-2 text-[13px]" style={{ color: THEME.colors.text.secondary }}>
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />} New message sound
                    </span>
                    <Toggle on={soundEnabled} />
                  </button>
                  <div className="my-1.5 h-px" style={{ background: THEME.colors.border.primary }} />
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: THEME.colors.text.muted }}>
                    <Keyboard className="w-3 h-3" /> Shortcuts
                  </div>
                  <div className="px-2 pb-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center text-xs" style={{ color: THEME.colors.text.muted }}>
                    <Kbd>/</Kbd><span>Focus message box</span>
                    <Kbd>Enter</Kbd><span>Send</span>
                    <Kbd>Shift+Enter</Kbd><span>New line</span>
                    <Kbd>@</Kbd><span>Mention someone</span>
                    <Kbd>Ctrl+F</Kbd><span>Search chat</span>
                    <Kbd>Esc</Kbd><span>Close / cancel reply</span>
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b shrink-0 overflow-hidden" style={{ borderColor: THEME.colors.border.primary }}>
            <div className="px-3 py-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: THEME.colors.text.muted }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={chatSearch}
                  onChange={(e) => onChatSearchChange(e.target.value)}
                  placeholder="Search messages, people, files…"
                  className="w-full h-9 pl-9 pr-9 rounded-xl text-sm outline-none border transition-colors focus:border-indigo-400/60"
                  style={{ background: "rgba(255,255,255,0.04)", color: THEME.colors.text.primary, borderColor: THEME.colors.border.primary }}
                  aria-label="Search messages"
                  autoFocus
                />
                {chatSearch && (
                  <button type="button" onClick={() => onChatSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10" style={{ color: THEME.colors.text.muted }} aria-label="Clear search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {isFiltering && (
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className="tabular-nums" style={{ color: THEME.colors.text.muted }}>
                    {filteredMessages.length} result{filteredMessages.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPinnedOnly((v) => !v)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border"
                    style={{ color: showPinnedOnly ? THEME.colors.accent.warning : THEME.colors.text.muted, borderColor: showPinnedOnly ? "rgba(251,191,36,0.45)" : THEME.colors.border.primary }}
                    aria-pressed={showPinnedOnly}
                  >
                    <Pin className="w-3 h-3" /> Pinned only
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned bar */}
      {!showPinnedOnly && (
        <PinnedBar messages={pinnedMessages} onJump={jumpToMessage} onUnpin={canModerate ? (id) => onPinMessage(id, false) : undefined} />
      )}

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn("h-full overflow-y-auto overscroll-contain", compactMode ? "px-2.5 pt-1 pb-2" : "px-3 pt-1 pb-3")}
          style={{ scrollbarWidth: "thin", scrollbarColor: `${THEME.colors.border.strong} transparent` }}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-full text-center px-6 py-10">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, rgba(129,140,248,0.18), rgba(167,139,250,0.08))" }}>
                {showPinnedOnly ? <Pin className="w-6 h-6" style={{ color: THEME.colors.accent.warning }} /> : normalizedSearch ? <Search className="w-6 h-6" style={{ color: THEME.colors.accent.primary }} /> : <MessagesSquare className="w-6 h-6" style={{ color: THEME.colors.accent.primary }} />}
              </div>
              <p className="text-sm font-semibold" style={{ color: THEME.colors.text.primary }}>
                {showPinnedOnly ? "No pinned messages" : normalizedSearch ? `No results for “${chatSearch.trim()}”` : "No messages yet"}
              </p>
              <p className="text-xs mt-1 max-w-[260px] leading-relaxed" style={{ color: THEME.colors.text.muted }}>
                {showPinnedOnly ? "Hosts can pin important messages so everyone can find them." : normalizedSearch ? "Try another word or clear the search." : "Break the ice — say hello and start practicing together."}
              </p>
              {isFiltering ? (
                <button type="button" onClick={clearFilters} className="mt-4 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5" style={{ color: THEME.colors.accent.primary, borderColor: THEME.colors.border.primary }}>
                  Clear filters
                </button>
              ) : (
                <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[280px]">
                  {CONVERSATION_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => { onMessageChange(starter); requestAnimationFrame(() => textareaRef.current?.focus()); }}
                      className="px-3 py-2 rounded-xl border text-xs text-left transition-colors hover:bg-white/[0.05]"
                      style={{ color: THEME.colors.text.secondary, borderColor: THEME.colors.border.primary }}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            groupedMessages.map((dateGroup) => (
              <section key={dateGroup.key} aria-label={dateGroup.label}>
                <DateSeparator label={dateGroup.label} />
                {dateGroup.messages.map((senderGroup) =>
                  senderGroup.messages.map((msg, msgIndex) => (
                    <React.Fragment key={msg.id}>
                      {unreadAnchorId === msg.id && <UnreadDivider />}
                      <div ref={(node) => { messageRefs.current[msg.id] = node; }} className="rounded-xl">
                        <MessageBubble
                          message={msg}
                          isOwn={senderGroup.isOwn}
                          currentUserId={currentUserId}
                          canModerate={canModerate}
                          compact={compactMode}
                          position={groupPosition(msgIndex, senderGroup.messages.length)}
                          showHeader={msgIndex === 0}
                          isHighlighted={msg.isHighlighted}
                          searchQuery={chatSearch}
                          getScrollRect={getScrollRect}
                          onReply={() => onReply(msg)}
                          onPin={() => onPinMessage(msg.id, !msg.isPinned)}
                          onDelete={() => onDeleteMessage(msg.id)}
                          onEdit={(content) => onEditMessage(msg.id, content)}
                          onReact={(emoji) => void onReactToMessage(msg.id, emoji)}
                          onKick={() => onKickUser(msg.senderId)}
                          onMute={() => onMuteUser(msg.senderId)}
                          onTranslate={onTranslateMessage ? () => onTranslateMessage(msg.id) : undefined}
                          onSendGift={onSendGift ? () => onSendGift(msg.senderId) : undefined}
                          onReport={onReportMessage ? () => onReportMessage(msg) : undefined}
                          onRetry={msg.status === "failed" && onRetryMessage ? () => onRetryMessage(msg) : undefined}
                          onJumpToReply={jumpToMessage}
                        />
                      </div>
                    </React.Fragment>
                  )),
                )}
              </section>
            ))
          )}

          <div ref={endRef} />
        </div>

        <AnimatePresence>
          {(hasNewMessages || !isNearBottom) && filteredMessages.length > 0 && (
            <JumpToLatest count={hasNewMessages ? newMessageCount : 0} onClick={scrollToBottom} />
          )}
        </AnimatePresence>
      </div>

      {/* Typing */}
      <TypingIndicator users={typingNames} />

      {/* Composer area */}
      <div ref={composerRef} className="relative shrink-0 px-2.5 pb-2.5">
        <AnimatePresence>
          {mention && mentionMatches.length > 0 && (
            <MentionSuggestions matches={mentionMatches} activeIndex={mentionIndex} onSelect={insertMention} onHover={setMentionIndex} />
          )}
        </AnimatePresence>

        {/* Emoji picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              className="absolute bottom-full left-2.5 mb-2 w-[min(340px,calc(100%-20px))] rounded-2xl border shadow-2xl z-50 backdrop-blur-md overflow-hidden"
              style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
              role="dialog"
              aria-label="Emoji picker"
            >
              <div className="flex items-center gap-0.5 px-1.5 pt-1.5 border-b" style={{ borderColor: THEME.colors.border.primary }}>
                {emojiTabs.map((category, index) => (
                  <button
                    type="button"
                    key={category.name}
                    onClick={() => setSelectedCategory(index)}
                    className="relative w-9 h-9 flex items-center justify-center rounded-lg text-base transition-colors hover:bg-white/[0.06]"
                    title={category.name}
                    aria-label={category.name}
                    aria-pressed={activeEmojiTab === index}
                  >
                    {category.icon}
                    {activeEmojiTab === index && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: THEME.colors.accent.primary }} />}
                  </button>
                ))}
              </div>
              <div className="px-2.5 pt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: THEME.colors.text.muted }}>
                {emojiTabs[activeEmojiTab].name}
              </div>
              <div className="grid grid-cols-8 gap-0.5 max-h-52 overflow-y-auto p-1.5">
                {emojiTabs[activeEmojiTab].emojis.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => handleEmojiSelect(emoji)}
                    className="h-9 rounded-lg flex items-center justify-center text-xl transition-transform hover:bg-white/10 hover:scale-110 focus-visible:outline-none focus-visible:bg-white/10"
                    aria-label={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-2.5 mb-2 pl-3 pr-1 py-1.5 rounded-xl border-l-[3px]" style={{ borderColor: THEME.colors.accent.primary, background: "rgba(129,140,248,0.08)" }}>
                <Reply className="w-4 h-4 shrink-0" style={{ color: THEME.colors.accent.primary }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold" style={{ color: THEME.colors.accent.secondary }}>Replying to {resolveSenderName(replyTo)}</div>
                  <div className="text-xs truncate" style={{ color: THEME.colors.text.secondary }}>{replyTo.content || "Attachment"}</div>
                </div>
                <IconButton label="Cancel reply" onClick={() => onReply(null)} className="w-7 h-7">
                  <X className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick replies */}
        <AnimatePresence>
          {showQuickReplies && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                {QUICK_REPLIES.map((reply) => (
                  <button
                    type="button"
                    key={reply}
                    onClick={() => { insertAtCaret(reply, { spaced: true }); setShowQuickReplies(false); }}
                    className="px-3 py-1.5 rounded-full border text-xs whitespace-nowrap transition-colors hover:bg-white/[0.06]"
                    style={{ color: THEME.colors.text.secondary, borderColor: THEME.colors.border.primary }}
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
          className="flex items-end gap-0.5 p-1 rounded-2xl border transition-colors focus-within:border-indigo-400/50"
          style={{ background: "rgba(255,255,255,0.04)", borderColor: THEME.colors.border.primary }}
        >
          {onAttachFile && (
            <IconButton label="Attach image, video, or file" onClick={onAttachFile} className="w-9 h-9 rounded-xl shrink-0">
              <Paperclip className="w-[18px] h-[18px]" />
            </IconButton>
          )}
          <IconButton label="Emoji" onClick={() => { onEmojiPickerToggle(); setShowQuickReplies(false); }} active={showEmojiPicker} className="w-9 h-9 rounded-xl shrink-0">
            <Smile className="w-[18px] h-[18px]" />
          </IconButton>

          <textarea
            ref={textareaRef}
            rows={1}
            value={newMessage}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={handleTextareaChange}
            onKeyDown={handleTextareaKeyDown}
            onClick={(e) => updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
            onBlur={() => window.setTimeout(() => setMention(null), 120)}
            placeholder={replyTo ? `Reply to ${resolveSenderName(replyTo)}…` : "Write a message…"}
            className="flex-1 min-w-0 self-center bg-transparent px-1.5 py-2 text-sm outline-none resize-none leading-5 placeholder:text-[#6b6b80]"
            style={{ color: THEME.colors.text.primary, maxHeight: COMPOSER_MAX_HEIGHT }}
            aria-label="Chat message"
          />

          <IconButton label="Quick replies" onClick={() => { setShowQuickReplies((v) => !v); if (showEmojiPicker) onEmojiPickerToggle(); }} active={showQuickReplies} className="w-9 h-9 rounded-xl shrink-0">
            <Sparkles className="w-[18px] h-[18px]" />
          </IconButton>

          <motion.button
            whileTap={canSend ? { scale: 0.92 } : undefined}
            type="button"
            onClick={send}
            disabled={!canSend}
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-all disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
            style={{
              background: canSend ? OWN_BUBBLE_GRADIENT : "rgba(255,255,255,0.06)",
              color: canSend ? "#fff" : THEME.colors.text.muted,
              boxShadow: canSend ? "0 6px 16px -6px rgba(99,102,241,0.9)" : "none",
            }}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1 h-4 text-[11px]" style={{ color: THEME.colors.text.muted }}>
          <span className="hidden sm:inline">
            <b className="font-semibold">Enter</b> to send · <b className="font-semibold">Shift+Enter</b> for a new line
          </span>
          {nearLimit && (
            <span className="ml-auto tabular-nums font-medium" style={{ color: charRatio >= 1 ? THEME.colors.accent.error : THEME.colors.accent.warning }}>
              {MAX_MESSAGE_LENGTH - newMessage.length} left
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default ChatPanel;
