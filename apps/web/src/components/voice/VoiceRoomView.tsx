// apps/web/src/components/voice/VoiceRoomView.tsx
/**
 * Improved VoiceRoomView
 * - Chat ↔ room wiring fixed (sender names, reaction toggles, pin/delete optimistic UI)
 * - Typing indicators fire while composing
 * - Unread / new-message counts only when chat closed or scrolled up
 * - Header passes isConnected; opening chat clears unread badge
 * - Language chips in the participant grid actually filter people
 * - Command center: fixed panel + backdrop dismiss
 * - Deafened state uses functional setState; toast copy cleaned up
 * - Works with the improved ChatPanel (participantNames, reactions as user lists)
 * - Live speaker animation is driven by LiveKit + socket speaking state
 * - Remote speaking state is preserved instead of being reset to false
 * - Participant avatars pulse, glow, ripple and show a prominent SPEAKING badge
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

import {
  Mic,
  MicOff,
  Hand,
  PhoneOff,
  Users,
  MessageCircle,
  X,
  Pin,
  Trash2,
  UserX,
  VolumeX,
  Crown,
  Send,
  Reply,
  Loader2,
  AlertCircle,
  Minimize2,
  Volume2,
  VolumeOff,
  Smile,
  Radio,
  TrendingUp,
  Circle,
  Search,
  Plus,
  LogIn,
  Globe,
  Languages,
  Share2,
  MoreVertical,
  Zap,
  Star,
  Clock,
  Filter,
  UserPlus,
  MessageSquare,
  Gift,
  Bell,
  BellOff,
  RotateCcw,
  ArrowDown,
  CheckCheck,
  Copy,
  Wifi,
  WifiOff,
  SlidersHorizontal,
  PanelRight,
  PanelRightClose,
  Keyboard,
  MoreHorizontal,
  ShieldCheck,
  Timer,
  UserRoundSearch,
  Volume1,
  Settings,
  ChevronDown,
  ChevronUp,
  Flag,
  Heart,
  Award,
  Sparkles,
  MapPin,
  Calendar,
} from "lucide-react";

import {
  useVoiceRoom,
  useVoiceSocket,
  useLiveKitRoom,
  voiceApi,
  useRoomMessages,
  useSendVoiceMessage,
  useDeleteVoiceMessage,
  useLeaveVoiceRoom,
  useRefreshToken,
  type VoiceMessage,
} from "../../hooks/useVoice";

import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";

// Import all sub-components
import { AudioControls } from "./AudioControls";
import { ClapButton } from "./ClapButton";
import { SpeakerQueue } from "./SpeakerQueue";
import { StageSpeaker } from "./StageSpeaker";
import { TranscriptionDisplay } from "./TranscriptionDisplay";
import { VoiceCall } from "./VoiceCall";
import { ChatPanel } from "./chat/ChatPanel";

// Import theme and types
import { THEME } from "./VoiceRoomView.theme";
import type {
  VoiceRoomViewProps,
  MinimizedRoomData,
  RoomParticipant,
} from "./VoiceRoomView.types";

interface LanguageFilter {
  nativeLanguage?: string;
  learningLanguage?: string;
  level?: string;
  country?: string;
}

/** Local chat message shape aligned with ChatPanel */
type LocalVoiceMessage = VoiceMessage & {
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  isEdited?: boolean;
  isHighlighted?: boolean;
  /** userId lists per emoji — matches ChatPanel */
  reactions?: Record<string, string[]>;
  /** legacy count map — migrated on the fly */
  reactionTally?: Record<string, number>;
  senderName?: string;
  senderAvatar?: string;
  replyToId?: string;
};

function normalizeChatMessage(
  msg: any,
  currentUserId?: string,
): LocalVoiceMessage {
  const senderName =
    msg.senderName ||
    msg.sender?.name ||
    msg.user?.name ||
    (msg.senderId === currentUserId ? "You" : "Unknown User");

  const senderAvatar =
    msg.senderAvatar ||
    msg.sender?.avatarUrl ||
    msg.sender?.avatar ||
    msg.user?.avatarUrl;

  // Prefer reactions (user lists). Fall back from reactionTally with synthetic ids.
  let reactions: Record<string, string[]> = {};
  if (msg.reactions && typeof msg.reactions === "object") {
    for (const [emoji, users] of Object.entries(msg.reactions)) {
      if (Array.isArray(users)) reactions[emoji] = users.map(String);
      else if (typeof users === "number") {
        reactions[emoji] = Array.from({ length: users }, (_, i) => `anon-${i}`);
      }
    }
  } else if (msg.reactionTally && typeof msg.reactionTally === "object") {
    for (const [emoji, count] of Object.entries(msg.reactionTally)) {
      const n = Number(count) || 0;
      reactions[emoji] = Array.from({ length: n }, (_, i) => `anon-${i}`);
    }
  }

  const replyTo = msg.replyTo
    ? normalizeChatMessage(msg.replyTo, currentUserId)
    : undefined;

  return {
    ...msg,
    senderName,
    senderAvatar,
    reactions,
    replyTo,
    status: msg.status || "sent",
  };
}

// Import helpers
import {
  initials,
  hueFromString,
  formatTime,
  formatDateSeparator,
  dayKey,
  getCountryFlag,
  renderMessageContent,
  playNotificationBeep,
} from "./VoiceRoomView.helpers";

// ---- Types ----
interface VoiceRoomListProps {
  onJoinRoom: (roomId: string) => void;
  onViewRoom?: (roomId: string) => void;
}

// ---- Helper Functions ----
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

// ============================================================
// VOICE ROOM LIST - HelloTalk Style
// ============================================================

export const VoiceRoomList: React.FC<VoiceRoomListProps> = ({
  onJoinRoom,
  onViewRoom,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRooms, setActiveRooms] = useState(0);
  const [filter, setFilter] = useState<"all" | "active" | "waiting">("all");
  const [sortBy, setSortBy] = useState<"participants" | "recent" | "name">(
    "participants",
  );
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setIsLoading(true);
        const response = await voiceApi.getRooms();
        setRooms(response.data || []);
        setActiveRooms(
          response.data?.filter((r: any) => r.status === "ACTIVE").length || 0,
        );
      } catch (error) {
        toast.error("Failed to load rooms");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRooms();
  }, []);

  const filteredRooms = useMemo(() => {
    let filtered = rooms;
    if (searchQuery) {
      filtered = filtered.filter(
        (room) =>
          room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          room.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          room.language?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    if (filter === "active") {
      filtered = filtered.filter((room) => room.status === "ACTIVE");
    } else if (filter === "waiting") {
      filtered = filtered.filter((room) => room.status === "WAITING");
    }
    if (languageFilter.nativeLanguage) {
      filtered = filtered.filter(
        (room) =>
          room.nativeLanguage?.toLowerCase() ===
          languageFilter.nativeLanguage?.toLowerCase(),
      );
    }
    switch (sortBy) {
      case "participants":
        filtered = filtered.sort(
          (a, b) =>
            (b.participants?.length || 0) - (a.participants?.length || 0),
        );
        break;
      case "recent":
        filtered = filtered.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        break;
      case "name":
        filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return filtered;
  }, [rooms, searchQuery, filter, sortBy, languageFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: THEME.colors.accent.primary }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header - HelloTalk Style */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ color: THEME.colors.text.primary }}
          >
            Voice Rooms
          </h2>
          <p className="text-sm" style={{ color: THEME.colors.text.muted }}>
            {activeRooms} live now · {rooms.length} total rooms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all border"
            style={{
              borderColor: THEME.colors.border.primary,
              color: THEME.colors.text.secondary,
            }}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={() => toast.info("Create room feature coming soon")}
            className="px-4 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-all"
            style={{
              background: THEME.colors.gradient.primary,
              color: "#fff",
            }}
          >
            <Plus className="w-4 h-4" />
            New Room
          </button>
        </div>
      </div>

      {/* Filters - HelloTalk Style */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="p-4 rounded-xl border"
              style={{
                background: THEME.colors.background.card,
                borderColor: THEME.colors.border.primary,
              }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label
                    className="text-xs font-medium"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Status
                  </label>
                  <div className="flex gap-1.5 mt-1">
                    {(["all", "active", "waiting"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className="px-3 py-1 rounded-full text-xs font-medium transition-all capitalize"
                        style={{
                          background:
                            filter === f
                              ? THEME.colors.accent.primary
                              : THEME.colors.background.tertiary,
                          color:
                            filter === f ? "#fff" : THEME.colors.text.secondary,
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    className="text-xs font-medium"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Sort By
                  </label>
                  <div className="flex gap-1.5 mt-1">
                    {(["participants", "recent", "name"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortBy(s)}
                        className="px-3 py-1 rounded-full text-xs font-medium transition-all capitalize"
                        style={{
                          background:
                            sortBy === s
                              ? THEME.colors.accent.primary
                              : THEME.colors.background.tertiary,
                          color:
                            sortBy === s ? "#fff" : THEME.colors.text.secondary,
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    className="text-xs font-medium"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Native Language
                  </label>
                  <input
                    type="text"
                    value={languageFilter.nativeLanguage || ""}
                    onChange={(e) =>
                      setLanguageFilter({
                        ...languageFilter,
                        nativeLanguage: e.target.value,
                      })
                    }
                    placeholder="e.g., English"
                    className="w-full px-3 py-1 rounded-full text-xs outline-none border"
                    style={{
                      background: THEME.colors.background.tertiary,
                      color: THEME.colors.text.primary,
                      borderColor: THEME.colors.border.primary,
                    }}
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-medium"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Learning Language
                  </label>
                  <input
                    type="text"
                    value={languageFilter.learningLanguage || ""}
                    onChange={(e) =>
                      setLanguageFilter({
                        ...languageFilter,
                        learningLanguage: e.target.value,
                      })
                    }
                    placeholder="e.g., Spanish"
                    className="w-full px-3 py-1 rounded-full text-xs outline-none border"
                    style={{
                      background: THEME.colors.background.tertiary,
                      color: THEME.colors.text.primary,
                      borderColor: THEME.colors.border.primary,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search - HelloTalk Style */}
      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: THEME.colors.text.muted }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search rooms by name or language..."
          className="w-full px-11 py-3 rounded-xl outline-none transition-all border"
          style={{
            background: THEME.colors.background.card,
            color: THEME.colors.text.primary,
            borderColor: THEME.colors.border.primary,
          }}
        />
      </div>

      {/* Room Cards - HelloTalk Style */}
      <div className="space-y-3">
        {filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(99,102,241,0.1)" }}
            >
              <Radio
                className="w-8 h-8"
                style={{ color: THEME.colors.accent.primary }}
              />
            </div>
            <p className="text-sm" style={{ color: THEME.colors.text.muted }}>
              {searchQuery
                ? "No rooms match your search"
                : "No voice rooms available"}
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={() => onJoinRoom(room.id)}
              onView={() => onViewRoom?.(room.id)}
              currentUserId={user?.id}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ---- Room Card Component - HelloTalk Style ----
const RoomCard: React.FC<{
  room: any;
  onJoin: () => void;
  onView: () => void;
  currentUserId?: string;
}> = ({ room, onJoin, onView, currentUserId }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = room.status === "ACTIVE";
  const participantCount = room.participants?.length || 0;
  const isUserInside = room.participants?.some(
    (p: any) => p.userId === currentUserId,
  );
  const isHost = room.creatorId === currentUserId;
  const hasActiveSpeakers =
    room.participants?.some((p: any) => p.isSpeaking) || false;

  const languages = useMemo(() => {
    const langs = new Set<string>();
    room.participants?.forEach((p: any) => {
      if (p.nativeLanguage) langs.add(p.nativeLanguage);
      if (p.learningLanguage) langs.add(p.learningLanguage);
    });
    return Array.from(langs);
  }, [room.participants]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, y: -2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="p-4 rounded-xl border transition-all cursor-pointer"
      style={{
        background: isHovered
          ? THEME.colors.background.cardHover
          : THEME.colors.background.card,
        borderColor: isHovered
          ? THEME.colors.accent.primary
          : THEME.colors.border.primary,
      }}
      onClick={onView}
    >
      <div className="flex items-center gap-4">
        {/* Room Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 relative"
          style={{
            background: `hsl(${hueFromString(room.name)}, 50%, 22%)`,
            color: THEME.colors.text.primary,
          }}
        >
          {initials(room.name)}
          {isActive && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse ring-2"
              style={{
                background: THEME.colors.status.online,
                ringColor: THEME.colors.background.primary,
              }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-semibold truncate"
              style={{ color: THEME.colors.text.primary }}
            >
              {room.name}
            </span>
            {/* Language Tags */}
            {languages.slice(0, 2).map((lang) => (
              <span
                key={lang}
                className="text-[9px] px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(167, 139, 250, 0.1)",
                  color: THEME.colors.accent.tertiary,
                }}
              >
                {lang}
              </span>
            ))}
            {languages.length > 2 && (
              <span
                className="text-[9px] px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(167, 139, 250, 0.1)",
                  color: THEME.colors.accent.tertiary,
                }}
              >
                +{languages.length - 2}
              </span>
            )}
            {/* Host Badge */}
            {isHost && (
              <span
                className="text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{
                  background: "rgba(251, 191, 36, 0.15)",
                  color: THEME.colors.accent.warning,
                }}
              >
                <Crown className="w-2.5 h-2.5" /> Host
              </span>
            )}
          </div>

          {/* Room Stats */}
          <div
            className="flex items-center gap-3 mt-1 text-xs"
            style={{ color: THEME.colors.text.muted }}
          >
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {participantCount}
            </span>
            {hasActiveSpeakers && (
              <span className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: THEME.colors.accent.primary }}
                />
                Speaking
              </span>
            )}
            {room.language && (
              <span className="flex items-center gap-1">
                <Languages className="w-3 h-3" />
                {room.language}
              </span>
            )}
          </div>
        </div>

        {/* Join/Inside Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            if (isUserInside) {
              onView();
            } else {
              onJoin();
            }
          }}
          className="px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 shrink-0"
          style={{
            background: isUserInside
              ? "rgba(52, 211, 153, 0.15)"
              : THEME.colors.gradient.primary,
            color: isUserInside ? THEME.colors.status.online : "#fff",
            border: isUserInside
              ? `1px solid ${THEME.colors.status.online}`
              : "none",
          }}
        >
          {isUserInside ? (
            <>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: THEME.colors.status.online }}
              />
              Inside
            </>
          ) : (
            <>
              <LogIn className="w-3.5 h-3.5" />
              Join
            </>
          )}
        </motion.button>
      </div>

      {/* Description */}
      {room.description && (
        <p
          className="mt-2 text-sm truncate"
          style={{ color: THEME.colors.text.muted }}
        >
          {room.description}
        </p>
      )}
    </motion.div>
  );
};

// ============================================================
// VOICE ROOM HEADER - HelloTalk Style
// ============================================================

const VoiceRoomHeader: React.FC<{
  room: any;
  isHost: boolean;
  isLiveKitConnected: boolean;
  isMockMode: boolean;
  totalParticipants: number;
  speakingCount: number;
  onlineCount: number;
  showChat: boolean;
  unreadCount: number;
  isConnected: boolean;
  onToggleChat: () => void;
  onToggleCommandCenter: () => void;
  onMinimize?: (data: any) => void;
  onShare: () => void;
}> = ({
  room,
  isHost,
  isLiveKitConnected,
  isMockMode,
  totalParticipants,
  speakingCount,
  onlineCount,
  showChat,
  unreadCount,
  isConnected,
  onToggleChat,
  onToggleCommandCenter,
  onMinimize,
  onShare,
}) => {
  return (
    <header
      className="relative z-10 flex items-center justify-between px-4 py-3 border-b shrink-0"
      style={{
        background: `rgba(10, 10, 18, 0.92)`,
        backdropFilter: "blur(20px)",
        borderColor: THEME.colors.border.primary,
      }}
    >
      {/* Left - Room Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: THEME.colors.gradient.primary,
          }}
        >
          <Radio className="w-5 h-5 text-white" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className="text-base font-bold truncate"
              style={{ color: THEME.colors.text.primary }}
            >
              {room.name}
            </h2>
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-wider"
              style={{
                background: isLiveKitConnected
                  ? "rgba(52, 211, 153, 0.15)"
                  : THEME.colors.border.primary,
                color: isLiveKitConnected
                  ? THEME.colors.status.online
                  : THEME.colors.text.muted,
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isLiveKitConnected ? "animate-pulse" : ""}`}
                style={{
                  background: isLiveKitConnected
                    ? THEME.colors.status.online
                    : THEME.colors.text.muted,
                }}
              />
              {isLiveKitConnected ? "Live" : isMockMode ? "Demo" : "Connecting"}
            </div>
            {isHost && (
              <div
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase"
                style={{
                  background: "rgba(251, 191, 36, 0.15)",
                  color: THEME.colors.accent.warning,
                }}
              >
                <Crown className="w-2.5 h-2.5" /> Host
              </div>
            )}
          </div>
          <div
            className="flex items-center gap-2 text-[10px]"
            style={{ color: THEME.colors.text.muted }}
          >
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {totalParticipants}
            </span>
            <span>·</span>
            <span>{speakingCount} speaking</span>
            <span>·</span>
            <span>{onlineCount} online</span>
          </div>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Toggle Chat */}
        <button
          onClick={onToggleChat}
          className="relative p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{
            color: showChat
              ? THEME.colors.accent.primary
              : THEME.colors.text.muted,
          }}
          title="Toggle Chat"
        >
          <MessageCircle className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] text-[8px] rounded-full flex items-center justify-center px-1 font-bold"
              style={{ background: THEME.colors.accent.error, color: "#fff" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Command Center - Settings Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCommandCenter();
          }}
          className="p-2 rounded-full hover:bg-white/5 transition-colors relative"
          style={{ color: THEME.colors.text.muted }}
          title="Room controls"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Minimize */}
        {onMinimize && (
          <button
            onClick={() =>
              onMinimize({
                id: room.id,
                name: room.name,
                participants: [],
                type: room.type,
                participantCount: totalParticipants,
              })
            }
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
            style={{ color: THEME.colors.text.muted }}
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        )}

        {/* Share */}
        <button
          onClick={onShare}
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: THEME.colors.text.muted }}
          title="Share Room"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Connection Health */}
        <ConnectionHealth
          socketConnected={isConnected}
          liveKitConnected={isLiveKitConnected}
          isMockMode={isMockMode}
        />
      </div>
    </header>
  );
};

// ---- Connection Health ----
const ConnectionHealth: React.FC<{
  socketConnected: boolean;
  liveKitConnected: boolean;
  isMockMode?: boolean;
}> = ({ socketConnected, liveKitConnected, isMockMode }) => {
  const healthy = socketConnected && liveKitConnected;
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px]"
      style={{
        background: healthy ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)",
        borderColor: healthy ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)",
        color: healthy
          ? THEME.colors.status.online
          : THEME.colors.accent.warning,
      }}
    >
      {healthy ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>
        {isMockMode ? "Demo" : healthy ? "Connected" : "Reconnecting"}
      </span>
    </div>
  );
};

// ---- Audio Level Meter ----
const AudioLevelMeter: React.FC<{ level: number; muted: boolean }> = ({
  level,
  muted,
}) => {
  const safe = Math.max(0, Math.min(1, level || 0));
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-1 rounded-full transition-all duration-100"
          style={{
            height: `${5 + i * 2}px`,
            background:
              !muted && safe > i / 6
                ? THEME.colors.accent.primary
                : THEME.colors.border.primary,
            opacity: !muted && safe > i / 6 ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
};

// ---- Participant Grid - HelloTalk Style ----
const ParticipantGrid: React.FC<any> = ({
  participants,
  isHost,
  isModerator,
  currentUserId,
  hostId,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  showSearch,
  onToggleSearch,
  favoriteParticipants,
  onToggleFavorite,
  onMuteUser,
  onKickUser,
  onPromoteHost,
  onSendMessage,
  onViewProfile,
  showChat,
  className,
}) => {
  const [langFilter, setLangFilter] = useState<string>("all");

  const roomLanguages = useMemo(() => {
    const set = new Set<string>();
    participants.forEach((p: any) => {
      if (p.nativeLanguage) set.add(String(p.nativeLanguage));
      if (p.learningLanguage) set.add(String(p.learningLanguage));
    });
    return Array.from(set).sort();
  }, [participants]);

  // Filter participants
  const filteredParticipants = participants
    .filter((p: any) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return [p.name, p.nativeLanguage, p.learningLanguage, p.country, p.level]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .filter((p: any) => {
      if (filter === "online") return p.isOnline === true;
      if (filter === "speaking") return p.isSpeaking === true;
      if (filter === "raised") return p.raisedHand === true;
      return true;
    })
    .filter((p: any) => {
      if (langFilter === "all") return true;
      return (
        p.nativeLanguage === langFilter || p.learningLanguage === langFilter
      );
    })
    // REMOVED: Sorting by speaking status - this causes position changes
    // Now sorting only by name for consistent positioning
    .sort((a: any, b: any) => {
      // Hosts first (optional - keeps host at top)
      if (a.role === "HOST" && b.role !== "HOST") return -1;
      if (b.role === "HOST" && a.role !== "HOST") return 1;

      // Then sort by name alphabetically for consistent positions
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const onlineParticipants = participants.filter(
    (p: any) => p.isOnline === true,
  );

  return (
    <section
      className={cn(
        "flex-1 min-w-0 px-4 py-4 transition-all duration-300 overflow-y-auto",
        className,
      )}
      style={{
        background: `radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.04), transparent 70%)`,
      }}
    >
      {/* REMOVED: ActiveSpeakerStrip - No longer showing speaking users at top */}

      {/* Participant Toolbar - HelloTalk Style */}
      <div
        className="mb-4 rounded-xl border p-3"
        style={{
          background: THEME.colors.background.card,
          borderColor: THEME.colors.border.primary,
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            <Users
              className="w-4 h-4"
              style={{ color: THEME.colors.accent.tertiary }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: THEME.colors.text.primary }}
            >
              {participants.length} in room
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(52, 211, 153, 0.1)",
                color: THEME.colors.status.online,
              }}
            >
              {onlineParticipants.length} online
            </span>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-1">
            {(["all", "online", "speaking", "raised"] as const).map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className="px-2.5 py-1 rounded-full text-[9px] capitalize transition-all"
                style={{
                  background:
                    filter === f ? "rgba(99,102,241,0.15)" : "transparent",
                  color:
                    filter === f
                      ? THEME.colors.text.primary
                      : THEME.colors.text.muted,
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Search Toggle */}
          <button
            onClick={onToggleSearch}
            className="p-1.5 rounded-lg hover:bg-white/5"
            style={{
              color: showSearch
                ? THEME.colors.accent.primary
                : THEME.colors.text.muted,
            }}
            title="Search participants"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="relative mt-2">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: THEME.colors.text.muted }}
                />
                <input
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search by name, language, country..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
                  style={{
                    background: THEME.colors.background.primary,
                    borderColor: THEME.colors.border.primary,
                    color: THEME.colors.text.primary,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Language filters from people currently in the room */}
      {roomLanguages.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <span
            className="text-[10px] font-medium"
            style={{ color: THEME.colors.text.muted }}
          >
            Languages
          </span>
          <button
            type="button"
            onClick={() => setLangFilter("all")}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
            style={{
              background:
                langFilter === "all"
                  ? "rgba(129,140,248,0.18)"
                  : THEME.colors.background.tertiary,
              color:
                langFilter === "all"
                  ? THEME.colors.accent.primary
                  : THEME.colors.text.secondary,
              border: `1px solid ${
                langFilter === "all"
                  ? "rgba(129,140,248,0.35)"
                  : THEME.colors.border.primary
              }`,
            }}
          >
            All
          </button>
          {roomLanguages.slice(0, 8).map((lang: string) => (
            <button
              type="button"
              key={lang}
              onClick={() =>
                setLangFilter((prev) => (prev === lang ? "all" : lang))
              }
              className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
              style={{
                background:
                  langFilter === lang
                    ? "rgba(129,140,248,0.18)"
                    : THEME.colors.background.tertiary,
                color:
                  langFilter === lang
                    ? THEME.colors.accent.primary
                    : THEME.colors.text.secondary,
                border: `1px solid ${
                  langFilter === lang
                    ? "rgba(129,140,248,0.35)"
                    : THEME.colors.border.primary
                }`,
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      {/* Participant Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-5xl mx-auto">
        {filteredParticipants.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(99,102,241,0.1)" }}
            >
              <UserRoundSearch
                className="w-8 h-8"
                style={{ color: THEME.colors.accent.primary }}
              />
            </div>
            <p className="text-sm" style={{ color: THEME.colors.text.muted }}>
              {searchQuery
                ? "No participants match your search"
                : "No one has joined yet"}
            </p>
          </div>
        ) : (
          filteredParticipants.map((p: any) => {
            const isParticipantHost = hostId === p.id || p.role === "HOST";
            const isCurrentUser = p.id === currentUserId;

            return (
              <ParticipantCard
                key={p.id}
                participant={p}
                isHost={isParticipantHost}
                isCurrentUser={isCurrentUser}
                isModerator={isModerator}
                isFavorite={favoriteParticipants.has(p.id)}
                onMute={() => onMuteUser(p.id)}
                onKick={() => onKickUser(p.id)}
                onPromote={() => onPromoteHost(p.id)}
                onFollow={() => onToggleFavorite(p.id)}
                onSendMessage={() => onSendMessage(p.id)}
                onViewProfile={() => onViewProfile(p.id)}
                size="sm"
              />
            );
          })
        )}
      </div>
    </section>
  );
};

// ---- Participant Card - HelloTalk Style ----
const ParticipantCard: React.FC<{
  participant: any;
  isHost: boolean;
  isCurrentUser?: boolean;
  isModerator?: boolean;
  isFavorite?: boolean;
  onMute?: () => void;
  onKick?: () => void;
  onPromote?: () => void;
  onFollow?: () => void;
  onSendMessage?: () => void;
  onViewProfile?: () => void;
  size?: "sm" | "md" | "lg";
}> = ({
  participant,
  isHost,
  isCurrentUser = false,
  isModerator = false,
  isFavorite = false,
  onMute,
  onKick,
  onPromote,
  onFollow,
  onSendMessage,
  onViewProfile,
  size = "md",
}) => {
  const [showActions, setShowActions] = useState(false);

  const hue = hueFromString(participant.name);
  const sizeMap = {
    sm: { avatar: 56, text: "text-xs", nameSize: "text-xs" },
    md: { avatar: 72, text: "text-sm", nameSize: "text-sm" },
    lg: { avatar: 88, text: "text-base", nameSize: "text-base" },
  };
  const s = sizeMap[size];

  const countryFlag = getCountryFlag(participant.country);
  const isOnline = participant.isOnline !== false;
  const isMuted = participant.isMuted;
  const isSpeaking = Boolean(participant.isSpeaking) && !isMuted;
  const raisedHand = participant.raisedHand;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative flex flex-col items-center group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="cursor-pointer" onClick={onViewProfile}>
        <div className="relative">
          {/* ========================================================
               LIVE SPEAKER EFFECT
               This stays on the participant's avatar so EVERYONE in the
               room can immediately see who is speaking.
             ======================================================== */}
          {isSpeaking && (
            <>
              {/* Wide outer pulse */}
              <motion.div
                className="absolute inset-[-22px] rounded-full pointer-events-none"
                initial={{ scale: 0.82, opacity: 0 }}
                animate={{
                  scale: [0.82, 1.16, 1.34],
                  opacity: [0, 0.28, 0],
                }}
                transition={{
                  duration: 1.35,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
                style={{
                  border: `2px solid ${THEME.colors.accent.primary}`,
                  boxShadow: `0 0 28px ${THEME.colors.accent.primary}55`,
                }}
              />

              {/* Main pulsing ring */}
              <motion.div
                className="absolute inset-[-9px] rounded-full pointer-events-none"
                animate={{
                  scale: [1, 1.12, 1],
                  opacity: [0.55, 1, 0.55],
                }}
                transition={{
                  duration: 0.72,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  border: `3px solid ${THEME.colors.accent.primary}`,
                  boxShadow: `0 0 18px ${THEME.colors.accent.primary}AA, 0 0 42px ${THEME.colors.accent.primary}44`,
                }}
              />

              {/* Secondary wave */}
              <motion.div
                className="absolute inset-[-15px] rounded-full pointer-events-none"
                animate={{
                  scale: [1, 1.08, 1],
                  opacity: [0.18, 0.55, 0.18],
                }}
                transition={{
                  duration: 1.05,
                  repeat: Infinity,
                  delay: 0.12,
                  ease: "easeInOut",
                }}
                style={{
                  border: `2px solid ${THEME.colors.accent.secondary}`,
                }}
              />

              {/* Audio-reactive-looking glow */}
              <motion.div
                className="absolute inset-[-4px] rounded-full pointer-events-none"
                animate={{
                  boxShadow: [
                    `0 0 8px ${THEME.colors.accent.primary}66`,
                    `0 0 34px ${THEME.colors.accent.primary}CC`,
                    `0 0 12px ${THEME.colors.accent.primary}77`,
                  ],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Small speaking particles */}
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={`speaker-particle-${i}`}
                  className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
                  initial={{ x: "-50%", y: "-50%", opacity: 0, scale: 0.5 }}
                  animate={{
                    x: ["-50%", `${-50 + Math.cos((i * Math.PI) / 2) * 105}%`],
                    y: ["-50%", `${-50 + Math.sin((i * Math.PI) / 2) * 105}%`],
                    opacity: [0, 0.9, 0],
                    scale: [0.5, 1, 0.2],
                  }}
                  transition={{
                    duration: 1.05,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeOut",
                  }}
                  style={{
                    background: THEME.colors.accent.primary,
                    boxShadow: `0 0 8px ${THEME.colors.accent.primary}`,
                  }}
                />
              ))}
            </>
          )}

          {/* Avatar */}
          <motion.div
            className="relative rounded-full flex items-center justify-center font-semibold border-2 shadow-lg transition-all"
            animate={
              isSpeaking
                ? {
                    scale: [1, 1.045, 1],
                    y: [0, -1.5, 0],
                  }
                : { scale: 1, y: 0 }
            }
            transition={
              isSpeaking
                ? {
                    duration: 0.42,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                : { duration: 0.2 }
            }
            style={{
              width: s.avatar,
              height: s.avatar,
              background: participant.avatarUrl
                ? `url(${participant.avatarUrl}) center/cover`
                : `hsl(${hue}, 50%, 22%)`,
              borderColor: isOnline
                ? isSpeaking
                  ? THEME.colors.accent.primary
                  : THEME.colors.status.online
                : THEME.colors.border.primary,
              color: participant.avatarUrl
                ? "transparent"
                : THEME.colors.text.primary,
              fontSize: s.avatar / 3,
              boxShadow:
                isOnline && isSpeaking
                  ? `0 0 30px ${THEME.colors.accent.primary}44`
                  : "none",
            }}
          >
            {!participant.avatarUrl && initials(participant.name)}
          </motion.div>

          {/* Online Status Dot */}
          {isOnline && !isMuted && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
              style={{
                background: isSpeaking
                  ? THEME.colors.accent.primary
                  : "#22C55E",
                borderColor: THEME.colors.background.primary,
              }}
            />
          )}

          {/* Muted Indicator */}
          {isMuted && isOnline && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 flex items-center justify-center"
              style={{
                background: "#4B5563",
                borderColor: THEME.colors.background.primary,
              }}
            >
              <MicOff className="w-1.5 h-1.5" style={{ color: "#9CA3AF" }} />
            </div>
          )}

          {/* Host Crown */}
          {isHost && (
            <motion.div
              className="absolute -top-1 -right-1"
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Crown className="w-3.5 h-3.5 text-yellow-400 drop-shadow-lg" />
            </motion.div>
          )}

          {/* Raised Hand */}
          {raisedHand && (
            <motion.div
              className="absolute -top-1 -left-1"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              <Hand className="w-3.5 h-3.5 text-yellow-400 drop-shadow-lg" />
            </motion.div>
          )}

          {/* Country Flag */}
          <div className="absolute -bottom-0.5 -left-0.5 text-xs leading-none">
            {countryFlag}
          </div>

          {/* Favorite Star */}
          {isFavorite && (
            <div className="absolute -top-1 -left-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
            </div>
          )}

          {/* Premium/Verified Badges */}
          {participant.isPremium && (
            <div className="absolute -bottom-1 right-6 text-[8px]">⭐</div>
          )}
          {participant.isVerified && (
            <div className="absolute -bottom-1 right-0 text-[8px]">✅</div>
          )}

          {/* You Badge */}
          {isCurrentUser && !isSpeaking && (
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-bold whitespace-nowrap"
              style={{ background: THEME.colors.accent.primary, color: "#fff" }}
            >
              You
            </div>
          )}

          {/* Speaking Badge */}
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[7px] font-bold tracking-wider whitespace-nowrap border shadow-lg"
              style={{
                background: "rgba(99,102,241,0.95)",
                borderColor: "rgba(196,181,253,0.5)",
                color: "#fff",
                boxShadow: `0 4px 14px ${THEME.colors.accent.primary}44`,
              }}
            >
              <span className="inline-flex items-center gap-1">
                <span className="flex items-end gap-[2px] h-2">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span
                      key={i}
                      className="w-[2px] rounded-full bg-white"
                      animate={{ height: ["3px", "7px", "4px", "6px", "3px"] }}
                      transition={{
                        duration: 0.5,
                        delay: i * 0.07,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </span>
                SPEAKING
              </span>
            </motion.div>
          )}
        </div>

        {/* Name & Language Tags - HelloTalk Style */}
        <div className="mt-1.5 text-center">
          <span
            className={`${s.nameSize} font-medium truncate max-w-[70px] block`}
            style={{ color: THEME.colors.text.primary }}
          >
            {participant.name}
          </span>

          <div className="flex flex-col items-center gap-0.5 mt-0.5">
            {participant.nativeLanguage && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(167, 139, 250, 0.12)",
                  color: THEME.colors.accent.tertiary,
                }}
              >
                {participant.nativeLanguage}
              </span>
            )}
            {participant.learningLanguage && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(52, 211, 153, 0.12)",
                  color: THEME.colors.accent.success,
                }}
              >
                📚 {participant.learningLanguage}
              </span>
            )}
          </div>

          <span
            className="text-[7px]"
            style={{
              color: isMuted
                ? THEME.colors.accent.error
                : isOnline
                  ? isSpeaking
                    ? THEME.colors.accent.primary
                    : THEME.colors.text.muted
                  : THEME.colors.text.muted,
            }}
          >
            {isMuted
              ? "🔇 Muted"
              : isOnline
                ? isSpeaking
                  ? "🔊 Speaking"
                  : "🎧 Listening"
                : "💤 Away"}
          </span>
        </div>
      </div>

      {/* Action Buttons - HelloTalk Style */}
      <AnimatePresence>
        {showActions && !isCurrentUser && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -8 }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-0.5 p-1 rounded-xl border shadow-lg"
            style={{
              background: THEME.colors.background.card,
              borderColor: THEME.colors.border.primary,
            }}
          >
            <button
              onClick={onFollow}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title="Follow"
              style={{
                color: isFavorite
                  ? THEME.colors.accent.primary
                  : THEME.colors.text.muted,
              }}
            >
              <UserPlus className="w-3 h-3" />
            </button>
            <button
              onClick={onSendMessage}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title="Send Message"
              style={{ color: THEME.colors.text.muted }}
            >
              <MessageSquare className="w-3 h-3" />
            </button>
            {isModerator && (
              <>
                <button
                  onClick={onMute}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                  title="Toggle Mute"
                  style={{ color: THEME.colors.text.muted }}
                >
                  <VolumeX className="w-3 h-3" />
                </button>
                <button
                  onClick={onKick}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                  title="Kick"
                  style={{ color: THEME.colors.text.muted }}
                >
                  <UserX className="w-3 h-3" />
                </button>
                {!isHost && (
                  <button
                    onClick={onPromote}
                    className="p-1.5 rounded-lg hover:bg-yellow-500/20 transition-all"
                    title="Make Host"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    <Crown className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ---- Command Center ----
const CommandCenter: React.FC<{
  isHost: boolean;
  isModerator: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  soundEnabled: boolean;
  showChat: boolean;
  showParticipants: boolean;
  showLiveStats: boolean;
  isRecording: boolean;
  onMute: () => void;
  onDeafen: () => void;
  onToggleSound: () => void;
  onToggleChat: () => void;
  onToggleStats: () => void;
  onRecord: () => void;
  onClose: () => void;
}> = ({
  isHost,
  isModerator,
  isMuted,
  isDeafened,
  soundEnabled,
  showChat,
  showParticipants,
  showLiveStats,
  isRecording,
  onMute,
  onDeafen,
  onToggleSound,
  onToggleChat,
  onToggleStats,
  onRecord,
  onClose,
}) => {
  const actions = [
    {
      label: isMuted ? "Unmute" : "Mute",
      icon: isMuted ? MicOff : Mic,
      active: isMuted,
      onClick: onMute,
    },
    {
      label: isDeafened ? "Undeafen" : "Deafen",
      icon: isDeafened ? Volume2 : VolumeOff,
      active: isDeafened,
      onClick: onDeafen,
    },
    {
      label: soundEnabled ? "Sounds on" : "Sounds off",
      icon: soundEnabled ? Bell : BellOff,
      active: !soundEnabled,
      onClick: onToggleSound,
    },
    {
      label: showChat ? "Hide chat" : "Show chat",
      icon: MessageCircle,
      active: showChat,
      onClick: onToggleChat,
    },
    {
      label: showLiveStats ? "Hide stats" : "Show stats",
      icon: TrendingUp,
      active: showLiveStats,
      onClick: onToggleStats,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="fixed top-16 right-4 w-[min(92vw,360px)] rounded-2xl border p-4 shadow-2xl z-[999]"
      style={{
        background: "rgba(18, 18, 32, 0.96)",
        borderColor: THEME.colors.border.primary,
        backdropFilter: "blur(20px)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: THEME.colors.text.primary }}
          >
            Room controls
          </p>
          <p className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
            Quick actions & settings
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: THEME.colors.text.muted }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const isActive = action.active;
          return (
            <button
              key={action.label}
              onClick={() => {
                action.onClick();
              }}
              className="rounded-lg border px-3 py-3 text-center transition-all hover:scale-[1.02] active:scale-95"
              style={{
                background: isActive
                  ? "rgba(99,102,241,0.15)"
                  : "rgba(255,255,255,0.03)",
                borderColor: isActive
                  ? "rgba(99,102,241,0.3)"
                  : THEME.colors.border.primary,
              }}
            >
              <Icon
                className="w-5 h-5 mx-auto mb-1.5"
                style={{
                  color: isActive
                    ? THEME.colors.accent.primary
                    : THEME.colors.text.muted,
                }}
              />
              <span
                className="block text-[9px] leading-tight"
                style={{
                  color: isActive
                    ? THEME.colors.text.primary
                    : THEME.colors.text.muted,
                }}
              >
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {(isHost || isModerator) && (
        <div
          className="mt-3 pt-3 border-t"
          style={{ borderColor: THEME.colors.border.primary }}
        >
          <p
            className="text-[9px] uppercase tracking-wider font-semibold mb-2"
            style={{ color: THEME.colors.text.muted }}
          >
            Moderation
          </p>
          <div className="flex gap-2">
            <span
              className="flex-1 px-3 py-1.5 rounded-lg text-[10px] flex items-center gap-1.5"
              style={{
                background: "rgba(251, 191, 36, 0.08)",
                color: THEME.colors.accent.warning,
                border: `1px solid rgba(251, 191, 36, 0.15)`,
              }}
            >
              <ShieldCheck className="w-4 h-4" />
              {isHost ? "Host" : "Moderator"}
            </span>
            {isHost && isRecording && (
              <span
                className="px-3 py-1.5 rounded-lg text-[10px] flex items-center gap-1.5"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  color: THEME.colors.accent.error,
                  border: `1px solid rgba(239, 68, 68, 0.15)`,
                }}
              >
                <Radio className="w-4 h-4" />
                Recording
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onRecord}
        disabled={!isHost}
        className="w-full mt-3 py-2 rounded-lg text-[10px] font-semibold border transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-95"
        style={{
          borderColor: isRecording
            ? "rgba(239,68,68,0.35)"
            : THEME.colors.border.primary,
          color: isRecording
            ? THEME.colors.accent.error
            : THEME.colors.text.secondary,
          background: isRecording ? "rgba(239,68,68,0.05)" : "transparent",
        }}
      >
        {isRecording ? (
          <span className="flex items-center justify-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: THEME.colors.accent.error }}
            />
            Recording...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Radio className="w-4 h-4" />
            Start recording
          </span>
        )}
      </button>
    </motion.div>
  );
};

// ---- Room Details Panel ----
const RoomDetailsPanel: React.FC<{
  room: any;
  totalParticipants: number;
  speakingCount: number;
  onlineCount: number;
  messages: number;
  duration: number;
  premiumCount: number;
  verifiedCount: number;
  languages: string[];
  onClose: () => void;
  onCopyLink: () => void;
}> = ({
  room,
  totalParticipants,
  speakingCount,
  onlineCount,
  messages,
  duration,
  premiumCount,
  verifiedCount,
  languages,
  onClose,
  onCopyLink,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-4 bottom-20 z-30 w-72 rounded-xl border p-4 shadow-2xl"
      style={{
        background: THEME.colors.background.card,
        borderColor: THEME.colors.border.primary,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p
            className="text-xs font-semibold"
            style={{ color: THEME.colors.text.primary }}
          >
            Room details
          </p>
          <p className="text-[9px]" style={{ color: THEME.colors.text.muted }}>
            Live session stats
          </p>
        </div>
        <button onClick={onClose} style={{ color: THEME.colors.text.muted }}>
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <SectionPill
          icon={<Users className="w-3 h-3" />}
          label="People"
          value={totalParticipants}
        />
        <SectionPill
          icon={<Mic className="w-3 h-3" />}
          label="Speaking"
          value={speakingCount}
        />
        <SectionPill
          icon={<Clock className="w-3 h-3" />}
          label="Minutes"
          value={Math.floor(duration / 60)}
        />
        <SectionPill
          icon={<MessageCircle className="w-3 h-3" />}
          label="Messages"
          value={messages}
        />
      </div>
      <div className="space-y-1.5 text-[10px]">
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Languages</span>
          <span style={{ color: THEME.colors.text.secondary }}>
            {languages.length ? languages.join(", ") : "None"}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Premium</span>
          <span style={{ color: THEME.colors.text.secondary }}>
            {premiumCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Verified</span>
          <span style={{ color: THEME.colors.text.secondary }}>
            {verifiedCount}
          </span>
        </div>
        <button
          onClick={onCopyLink}
          className="w-full mt-2 py-2 rounded-lg border text-[10px] font-medium hover:bg-white/5"
          style={{
            borderColor: THEME.colors.border.primary,
            color: THEME.colors.text.secondary,
          }}
        >
          <Copy className="inline w-3 h-3 mr-1.5" /> Copy link
        </button>
      </div>
    </motion.div>
  );
};

// ---- Section Pill ----
const SectionPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: string | number;
}> = ({ icon, label, value }) => (
  <div
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px]"
    style={{
      borderColor: THEME.colors.border.primary,
      background: "rgba(255,255,255,0.02)",
      color: THEME.colors.text.muted,
    }}
  >
    {icon}
    <span>{label}</span>
    {value !== undefined && (
      <strong style={{ color: THEME.colors.text.primary }}>{value}</strong>
    )}
  </div>
);

// ---- Shortcut Panel ----
const ShortcutPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border p-5 shadow-2xl"
        style={{
          background: THEME.colors.background.card,
          borderColor: THEME.colors.border.primary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard
              className="w-4 h-4"
              style={{ color: THEME.colors.accent.tertiary }}
            />
            <h3
              className="font-semibold text-sm"
              style={{ color: THEME.colors.text.primary }}
            >
              Keyboard shortcuts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5"
            style={{ color: THEME.colors.text.muted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {[
            ["Ctrl/Cmd + Shift + M", "Mute / unmute"],
            ["Ctrl/Cmd + Shift + H", "Raise hand"],
            ["Enter", "Send message"],
            ["Shift + Enter", "New line"],
            ["Esc", "Close chat"],
          ].map(([key, action]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-lg px-3 py-2"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <span
                className="text-xs"
                style={{ color: THEME.colors.text.secondary }}
              >
                {action}
              </span>
              <kbd
                className="text-[9px] px-2 py-1 rounded-lg border"
                style={{
                  borderColor: THEME.colors.border.primary,
                  color: THEME.colors.text.primary,
                  background: THEME.colors.background.tertiary,
                }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ---- Leave Confirmation Modal ----
const LeaveConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-[70] px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="rounded-xl w-full max-w-md p-6 border"
        style={{
          background: THEME.colors.background.card,
          borderColor: THEME.colors.border.primary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(239, 68, 68, 0.15)" }}
          >
            <PhoneOff
              className="w-8 h-8"
              style={{ color: THEME.colors.accent.error }}
            />
          </div>
          <h3
            className="text-xl font-bold mb-2"
            style={{ color: THEME.colors.text.primary }}
          >
            Leave Room?
          </h3>
          <p
            className="text-sm mb-6"
            style={{ color: THEME.colors.text.muted }}
          >
            You can always come back to this room later.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5"
              style={{ color: THEME.colors.text.muted }}
            >
              Stay
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-80"
              style={{ background: THEME.colors.accent.error, color: "#fff" }}
            >
              Leave
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================
// MAIN VOICE ROOM VIEW - HelloTalk Style
// ============================================================

export const VoiceRoomView: React.FC<VoiceRoomViewProps> = ({
  roomId,
  onLeave,
  onMinimize,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ============================================================
  // STATE - ALL HOOKS MUST BE CALLED BEFORE CONDITIONAL RETURNS
  // ============================================================

  const [token, setToken] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [liveKitRoomId, setLiveKitRoomId] = useState<string>("");
  const [tokenRefreshAttempts, setTokenRefreshAttempts] = useState(0);

  const [isDeafened, setIsDeafened] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showChat, setShowChat] = useState(true);
  const [messages, setMessages] = useState<LocalVoiceMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState<VoiceMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isRaisingHand, setIsRaisingHand] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [reactions, setReactions] = useState<{ id: string; emoji: string }[]>(
    [],
  );
  const [isRecording, setIsRecording] = useState(false);
  const [roomDuration, setRoomDuration] = useState(0);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryTimer, setRetryTimer] = useState<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantFilter, setParticipantFilter] = useState<
    "all" | "online" | "speaking" | "raised"
  >("all");
  const [showParticipantSearch, setShowParticipantSearch] = useState(false);
  const [showQualityPanel, setShowQualityPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [favoriteParticipants, setFavoriteParticipants] = useState<Set<string>>(
    new Set(),
  );
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasRefreshedRef = useRef(false);

  // ============================================================
  // DATA QUERIES
  // ============================================================

  const { data: room, isLoading, refetch, error } = useVoiceRoom(roomId);
  const { data: initialMessages, isLoading: isLoadingMessages } =
    useRoomMessages(roomId);
  const sendMessageMutation = useSendVoiceMessage();
  const deleteMessageMutation = useDeleteVoiceMessage();
  const leaveRoomMutation = useLeaveVoiceRoom();
  const refreshTokenMutation = useRefreshToken();

  // ============================================================
  // WEBSOCKET HOOK
  // ============================================================

  const {
    socket,
    isConnected,
    participants: wsParticipants,
    hostId,
    sendChatMessage,
    sendTyping,
    raiseHand,
    kickUser,
    muteUser,
    unmuteUser,
    pinMessage,
    deleteMessage: deleteSocketMessage,
    promoteHost,
    broadcastSpeaking,
  } = useVoiceSocket(roomId, user?.id || "");

  // ============================================================
  // LIVEKIT HOOK
  // ============================================================

  const liveKitRoomIdFromRoom = room?.liveKitRoomId || "";
  const shouldConnect = Boolean(
    token && (liveKitRoomId || liveKitRoomIdFromRoom),
  );

  const liveKitOptions = useMemo(
    () => ({
      onAudioLevel: (level: number) => setAudioLevel(level),
      // LiveKit detects the microphone state locally. The socket broadcast
      // distributes that state to the other people in the room.
      onSpeakingStatusChange: (userId: string, isSpeaking: boolean) => {
        if (userId === user?.id) {
          broadcastSpeaking(isSpeaking);
        }
      },
    }),
    [user?.id, broadcastSpeaking],
  );

  const liveKitResult = useLiveKitRoom(
    shouldConnect ? liveKitRoomId || liveKitRoomIdFromRoom || "" : "",
    shouldConnect ? token : null,
    liveKitOptions,
  );

  const {
    isConnected: isLiveKitConnected,
    participants: livekitParticipants = [],
    participantVoiceStates = {},
    isMuted: liveKitIsMuted,
    toggleMute,
    isMockMode,
    error: liveKitError,
    isConnecting,
  } = liveKitResult;

  const isMuted = liveKitIsMuted;

  // ============================================================
  // DERIVED STATE
  // ============================================================

  const allParticipants = useMemo<RoomParticipant[]>(() => {
    const map = new Map<string, RoomParticipant>();

    (wsParticipants || []).forEach((p: any) => {
      map.set(p.userId, {
        id: p.userId,
        userId: p.userId,
        name: p.name || p.user?.name || "Anonymous",
        avatarUrl: p.avatarUrl || p.user?.avatarUrl,
        country: p.country || p.user?.country,
        nativeLanguage: p.nativeLanguage || p.user?.nativeLanguage,
        learningLanguage: p.learningLanguage || p.user?.learningLanguage,
        level: p.level || p.user?.level,
        bio: p.bio || p.user?.bio,
        interests: p.interests || p.user?.interests,
        isOnline: true,
        // IMPORTANT: keep the server/socket speaking state. Previously this was
        // hard-coded to false, so remote speaker animations could never start
        // from the websocket state.
        isSpeaking: Boolean(p.isSpeaking) && !Boolean(p.isMuted),
        isMuted: Boolean(p.isMuted),
        raisedHand: p.raisedHand || false,
        joinedAt: p.joinedAt || new Date().toISOString(),
        role: p.role || "MEMBER",
        isListening: true,
        audioLevel: Number(p.audioLevel || 0),
        isVerified: p.isVerified || p.user?.isVerified,
        isPremium: p.isPremium || p.user?.isPremium,
      });
    });

    (room?.participants || []).forEach((p: any) => {
      if (!map.has(p.userId)) {
        map.set(p.userId, {
          id: p.userId,
          userId: p.userId,
          name: p.user?.name || "Anonymous",
          avatarUrl: p.user?.avatarUrl,
          country: p.user?.country,
          nativeLanguage: p.user?.nativeLanguage,
          learningLanguage: p.user?.learningLanguage,
          level: p.user?.level,
          isOnline: false,
          isSpeaking: Boolean(p.isSpeaking) && !Boolean(p.isMuted),
          isMuted: Boolean(p.isMuted),
          raisedHand: p.raisedHand || false,
          joinedAt: p.joinedAt || new Date().toISOString(),
          role: p.role || "MEMBER",
          isListening: false,
          audioLevel: 0,
          isVerified: p.user?.isVerified,
          isPremium: p.user?.isPremium,
        });
      }
    });

    livekitParticipants?.forEach((p: any) => {
      const liveKitIdentity = String(
        p.identity ?? p.userId ?? p.sid ?? p.participantIdentity ?? "",
      );

      const metadataUserId = (() => {
        try {
          const metadata =
            typeof p.metadata === "string"
              ? JSON.parse(p.metadata)
              : p.metadata;
          return metadata?.userId || metadata?.user?.id;
        } catch {
          return undefined;
        }
      })();

      const candidateIds = [
        liveKitIdentity,
        metadataUserId ? String(metadataUserId) : "",
      ].filter(Boolean);

      const participant =
        candidateIds.map((id) => map.get(id)).find(Boolean) || undefined;

      if (!participant) return;

      const voiceState =
        participantVoiceStates?.[liveKitIdentity] ||
        participantVoiceStates?.[participant.id] ||
        (metadataUserId
          ? participantVoiceStates?.[String(metadataUserId)]
          : undefined);

      const liveKitSpeaking = Boolean(voiceState?.isSpeaking ?? p.isSpeaking);
      const liveKitMuted = Boolean(
        voiceState?.isMuted ?? p.isMuted ?? participant.isMuted,
      );
      const liveKitAudioLevel = Number(
        voiceState?.audioLevel ?? p.audioLevel ?? participant.audioLevel ?? 0,
      );

      participant.isOnline = true;
      participant.isMuted = liveKitMuted;
      participant.isSpeaking = liveKitSpeaking && !liveKitMuted;
      participant.audioLevel = participant.isSpeaking
        ? Math.max(0, Math.min(1, liveKitAudioLevel))
        : 0;
    });

    const currentUser = map.get(user?.id || "");
    if (currentUser) {
      currentUser.isOnline = isConnected || isLiveKitConnected;
      currentUser.isListening = currentUser.isOnline;
      currentUser.isSpeaking = !isMuted && Number(audioLevel || 0) > 0.08;
      currentUser.audioLevel = Math.max(
        0,
        Math.min(1, Number(audioLevel || 0)),
      );
      currentUser.isMuted = isMuted;
    }

    return Array.from(map.values());
  }, [
    wsParticipants,
    room?.participants,
    livekitParticipants,
    participantVoiceStates,
    user?.id,
    audioLevel,
    isMuted,
    isConnected,
    isLiveKitConnected,
  ]);

  const speakingCount = allParticipants.filter((p) => p.isSpeaking).length;
  const totalParticipants = allParticipants.length;
  const onlineParticipants = allParticipants.filter((p) => p.isOnline === true);
  const isHost = hostId === user?.id || room?.creatorId === user?.id;
  const isModerator =
    isHost ||
    allParticipants.some(
      (p) =>
        p.userId === user?.id && (p.role === "MODERATOR" || p.role === "HOST"),
    );

  // ============================================================
  // HANDLERS - useCallback
  // ============================================================

  const handleToggleMute = useCallback(async () => {
    const muted = await toggleMute();
    if (socket && isConnected) {
      socket.emit("voice:mute-self", { roomId, muted });
    }
  }, [toggleMute, socket, isConnected, roomId]);

  const handleToggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      toast.info(next ? "Deafened — room audio muted" : "Audio restored");
      return next;
    });
  }, []);

  const handleRaiseHand = useCallback(() => {
    setIsRaisingHand(true);
    raiseHand(true);
    toast.success("Hand raised — waiting for the host");
    setTimeout(() => setIsRaisingHand(false), 3000);
  }, [raiseHand]);

  const handleLeave = useCallback(() => {
    setShowLeaveConfirm(true);
  }, []);

  const handleConfirmLeave = useCallback(async () => {
    try {
      await leaveRoomMutation.mutateAsync(roomId);
      socket?.emit("voice:leave", { roomId, userId: user?.id });
      toast.success("Left room");
      onLeave();
    } catch (error) {
      toast.error("Failed to leave room");
    }
  }, [leaveRoomMutation, roomId, socket, user?.id, onLeave]);

  const handleStartRecording = useCallback(async () => {
    try {
      await voiceApi.startRecording(roomId);
      setIsRecording(true);
      toast.success("Recording started");
      refetch();
    } catch (error) {
      toast.error("Failed to start recording");
    }
  }, [roomId, refetch]);

  const handleStopRecording = useCallback(async () => {
    try {
      await voiceApi.stopRecording(roomId);
      setIsRecording(false);
      toast.success("Recording stopped");
      refetch();
    } catch (error) {
      toast.error("Failed to stop recording");
    }
  }, [roomId, refetch]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Room link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setHasNewMessages(false);
      setNewMessageCount(0);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  }, []);

  const handleSendMessage = useCallback(() => {
    const content = newMessage.trim();
    if (!content || !user?.id) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const messageData: { content: string; type: string; replyToId?: string } = {
      content,
      type: "TEXT",
    };

    if (replyTo && replyTo.id) {
      messageData.replyToId = replyTo.id;
    }

    const optimisticMessage = normalizeChatMessage(
      {
        id: tempId,
        content,
        senderId: user.id,
        sender: {
          id: user.id,
          name: (user as any).name || "You",
          avatarUrl: (user as any).avatarUrl,
        },
        senderName: (user as any).name || "You",
        senderAvatar: (user as any).avatarUrl,
        createdAt: new Date().toISOString(),
        isPinned: false,
        isDeleted: false,
        replyTo: replyTo || undefined,
        replyToId: replyTo?.id,
        status: "sending",
        reactions: {},
      },
      user.id,
    );

    setMessages((prev) => [...prev, optimisticMessage]);

    if (socket && isConnected) {
      sendChatMessage(messageData);
    } else {
      sendMessageMutation.mutate(
        { roomId, ...messageData },
        {
          onSuccess: (res: any) => {
            const realMessage = res?.data || res;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId
                  ? { ...(realMessage || m), status: "sent" as const }
                  : m,
              ),
            );
            queryClient.invalidateQueries({
              queryKey: ["voice-messages", roomId],
            });
          },
          onError: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId ? { ...m, status: "failed" as const } : m,
              ),
            );
            toast.error("Failed to send message");
          },
        },
      );
    }

    setNewMessage("");
    setReplyTo(null);
    sendTyping(false);
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [
    newMessage,
    replyTo,
    socket,
    isConnected,
    sendChatMessage,
    sendMessageMutation,
    sendTyping,
    roomId,
    user,
    queryClient,
  ]);

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: newContent, isEdited: true }
            : m,
        ),
      );
      toast.success("Message edited");
    },
    [],
  );

  const handleMessageReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!user?.id) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;

          const reactions: Record<string, string[]> = {};
          if (m.reactions) {
            for (const [e, users] of Object.entries(m.reactions)) {
              reactions[e] = Array.isArray(users) ? [...users] : [];
            }
          } else if (m.reactionTally) {
            for (const [e, count] of Object.entries(m.reactionTally)) {
              const n = Number(count) || 0;
              reactions[e] = Array.from({ length: n }, (_, i) => `anon-${i}`);
            }
          }

          const users = new Set(reactions[emoji] || []);
          if (users.has(user.id)) users.delete(user.id);
          else users.add(user.id);

          if (users.size > 0) reactions[emoji] = Array.from(users);
          else delete reactions[emoji];

          return { ...m, reactions, reactionTally: undefined };
        }),
      );

      if (socket && isConnected) {
        socket.emit("voice:message-reaction", {
          roomId,
          messageId,
          emoji,
          userId: user.id,
        });
      }
    },
    [socket, isConnected, roomId, user?.id],
  );

  // ============================================================
  // CHAT PANEL ADAPTERS
  // ============================================================

  const chatPanelMessages = useMemo(
    () => messages.map((m) => normalizeChatMessage(m, user?.id)),
    [messages, user?.id],
  );

  const handleComposerChange = useCallback(
    (text: string) => {
      setNewMessage(text);
      if (!user?.id) return;

      if (text.trim()) {
        sendTyping(true);
        if (typingStopTimerRef.current) {
          clearTimeout(typingStopTimerRef.current);
        }
        typingStopTimerRef.current = setTimeout(() => {
          sendTyping(false);
          typingStopTimerRef.current = null;
        }, 1400);
      } else {
        sendTyping(false);
        if (typingStopTimerRef.current) {
          clearTimeout(typingStopTimerRef.current);
          typingStopTimerRef.current = null;
        }
      }
    },
    [sendTyping, user?.id],
  );

  // ============================================================
  // EFFECTS - ALL EFFECTS HERE
  // ============================================================

  // Token fetching
  useEffect(() => {
    const getToken = async () => {
      if (!roomId || !user?.id || isJoining || token) return;

      try {
        setIsJoining(true);
        const response = await voiceApi.joinRoom(roomId);
        const raw = response.data as any;

        let extractedToken =
          raw?.data?.token || raw?.token || raw?.data?.data?.token;
        const extractedRoomId =
          raw?.data?.liveKitRoomId || raw?.liveKitRoomId || roomId;

        if (!extractedToken) {
          throw new Error("No token returned from server");
        }

        setToken(extractedToken);
        setLiveKitRoomId(extractedRoomId);
        setTokenRefreshAttempts(0);
        toast.success("Connected to voice");
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to join room");
      } finally {
        setIsJoining(false);
      }
    };

    getToken();
  }, [roomId, user?.id, token]);

  // Messages — normalize for ChatPanel (senderName, reactions)
  useEffect(() => {
    if (initialMessages) {
      const sorted = [...initialMessages]
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .map((msg) =>
          normalizeChatMessage({ ...msg, status: "sent" as const }, user?.id),
        );
      setMessages(sorted);
    }
  }, [initialMessages, user?.id]);

  // Socket message handlers
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: any) => {
      setMessages((prev) => {
        const exists = prev.some((m) => {
          if (m.id === message.id) return true;
          if (
            m.senderId === message.senderId &&
            m.content === message.content &&
            Math.abs(
              new Date(m.createdAt).getTime() -
                new Date(message.createdAt).getTime(),
            ) < 2000
          ) {
            return true;
          }
          return false;
        });
        if (exists) return prev;

        if (message.senderId === user?.id) {
          const tempIndex = prev.findIndex(
            (m) =>
              m.id.startsWith("temp-") &&
              m.senderId === message.senderId &&
              m.content === message.content,
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = normalizeChatMessage(
              { ...message, status: "sent" as const },
              user?.id,
            );
            return updated;
          }
        }

        if (!showChat) {
          setUnreadCount((c) => c + 1);
        }
        if (soundEnabled && (document.hidden || !showChat)) {
          playNotificationBeep();
        }

        const normalized = normalizeChatMessage(
          { ...message, status: "sent" as const },
          user?.id,
        );

        return [...prev, normalized];
      });

      setTimeout(() => {
        if (isNearBottom && showChat) scrollToBottom();
        else if (showChat) {
          setHasNewMessages(true);
          setNewMessageCount((c) => c + 1);
        }
      }, 50);
    };

    const handleTypingStart = (data: { userId: string }) => {
      if (data.userId !== user?.id) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));
      }
    };

    const handleTypingStop = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socket.on("voice:chat", handleNewMessage);
    socket.on("voice:typing-start", handleTypingStart);
    socket.on("voice:typing-stop", handleTypingStop);

    return () => {
      socket.off("voice:chat", handleNewMessage);
      socket.off("voice:typing-start", handleTypingStart);
      socket.off("voice:typing-stop", handleTypingStop);
    };
  }, [socket, user?.id, showChat, soundEnabled, scrollToBottom, isNearBottom]);

  // Room duration
  useEffect(() => {
    if (room?.startedAt) {
      const start = new Date(room.startedAt).getTime();
      durationIntervalRef.current = setInterval(() => {
        setRoomDuration(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => {
        if (durationIntervalRef.current)
          clearInterval(durationIntervalRef.current);
      };
    }
  }, [room?.startedAt]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "m"
      ) {
        e.preventDefault();
        handleToggleMute();
      }
      if (e.key === "Escape" && showChat) {
        setShowChat(false);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "h"
      ) {
        e.preventDefault();
        handleRaiseHand();
      }
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        document.activeElement === textareaRef.current
      ) {
        e.preventDefault();
        handleSendMessage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showChat, handleToggleMute, handleRaiseHand, handleSendMessage]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (durationIntervalRef.current)
        clearInterval(durationIntervalRef.current);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [retryTimer]);

  // ============================================================
  // RENDER - NOW AFTER ALL HOOKS
  // ============================================================

  if (isLoading || isJoining || isConnecting || (!token && !isJoining)) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: THEME.colors.background.primary }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: THEME.colors.accent.primary }}
            />
          </motion.div>
          <p className="text-sm" style={{ color: THEME.colors.text.secondary }}>
            {isConnecting
              ? "🎧 Connecting to voice..."
              : isJoining
                ? "🎧 Joining the conversation..."
                : !token
                  ? "⏳ Waiting for voice connection..."
                  : "Loading room..."}
          </p>
          {!token && !isJoining && !isConnecting && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
              style={{ background: THEME.colors.accent.primary, color: "#fff" }}
            >
              Retry Connection
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  if (!room) {
    return (
      <div
        className="h-screen flex items-center justify-center px-6"
        style={{ background: THEME.colors.background.primary }}
      >
        <div className="text-center max-w-sm">
          <AlertCircle
            className="w-12 h-12 mx-auto mb-4 opacity-50"
            style={{ color: THEME.colors.text.muted }}
          />
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: THEME.colors.text.primary }}
          >
            Room Not Found
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: THEME.colors.text.muted }}
          >
            This room may have ended or the link is incorrect.
          </p>
          <button
            onClick={onLeave}
            className="px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105"
            style={{ background: THEME.colors.accent.primary, color: "#fff" }}
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: THEME.colors.background.primary }}
    >
      {/* Background Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: THEME.colors.gradient.glow }}
      />

      {/* Room Header */}
      <VoiceRoomHeader
        room={room}
        isHost={isHost}
        isLiveKitConnected={isLiveKitConnected}
        isMockMode={isMockMode}
        totalParticipants={totalParticipants}
        speakingCount={speakingCount}
        onlineCount={onlineParticipants.length}
        showChat={showChat}
        unreadCount={unreadCount}
        isConnected={isConnected}
        onToggleChat={() => {
          setShowChat((v) => {
            const next = !v;
            if (next) {
              setUnreadCount(0);
              setHasNewMessages(false);
              setNewMessageCount(0);
            }
            return next;
          });
        }}
        onToggleCommandCenter={() => setShowCommandCenter(!showCommandCenter)}
        onMinimize={onMinimize}
        onShare={handleCopyLink}
      />

      {/* Live Stats Bar */}
      <AnimatePresence>
        {showLiveStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-1.5 border-b"
            style={{
              borderColor: THEME.colors.border.primary,
              background: THEME.colors.background.secondary,
            }}
          >
            <div className="flex items-center gap-4 flex-wrap text-xs">
              {[
                { label: "Participants", value: totalParticipants },
                { label: "Speaking", value: speakingCount },
                {
                  label: "Duration",
                  value: `${Math.floor(roomDuration / 60)}m ${roomDuration % 60}s`,
                },
                { label: "Messages", value: messages.length },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span style={{ color: THEME.colors.text.muted }}>
                    {stat.label}:
                  </span>
                  <span
                    className="font-medium"
                    style={{ color: THEME.colors.text.primary }}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex flex-1 min-h-0 relative z-10">
        {/* Participants Grid */}
        <ParticipantGrid
          participants={allParticipants}
          isHost={isHost}
          isModerator={isModerator}
          currentUserId={user?.id}
          hostId={hostId}
          searchQuery={participantSearch}
          onSearchChange={setParticipantSearch}
          filter={participantFilter}
          onFilterChange={setParticipantFilter}
          showSearch={showParticipantSearch}
          onToggleSearch={() =>
            setShowParticipantSearch(!showParticipantSearch)
          }
          favoriteParticipants={favoriteParticipants}
          onToggleFavorite={(userId) => {
            setFavoriteParticipants((prev) => {
              const next = new Set(prev);
              if (next.has(userId)) next.delete(userId);
              else next.add(userId);
              return next;
            });
          }}
          onMuteUser={muteUser}
          onKickUser={kickUser}
          onPromoteHost={promoteHost}
          onSendMessage={(userId) => {
            const participant = allParticipants.find((p) => p.id === userId);
            if (participant) {
              setShowChat(true);
              setActiveTab("chat");
              setNewMessage(`@${participant.name} `);
            }
          }}
          onViewProfile={(userId) => toast.info(`👤 Viewing profile`)}
          showChat={showChat}
          className={showChat ? "md:w-2/3" : "w-full"}
        />

        {/* Chat Panel */}
        <AnimatePresence>
          {showChat && (
            <ChatPanel
              messages={chatPanelMessages}
              newMessage={newMessage}
              replyTo={
                replyTo
                  ? (normalizeChatMessage(replyTo, user?.id) as any)
                  : null
              }
              typingUsers={typingUsers}
              currentUserId={user?.id || ""}
              isHost={isHost}
              isModerator={isModerator}
              showEmojiPicker={showEmojiPicker}
              onEmojiPickerToggle={() => setShowEmojiPicker(!showEmojiPicker)}
              onMessageChange={handleComposerChange}
              onSendMessage={handleSendMessage}
              onReply={(msg) => setReplyTo(msg as any)}
              onPinMessage={(messageId, pinned) => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId ? { ...m, isPinned: pinned } : m,
                  ),
                );
                try {
                  pinMessage?.(messageId, pinned);
                } catch {
                  pinMessage?.(messageId);
                }
              }}
              onDeleteMessage={(messageId) => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId ? { ...m, isDeleted: true } : m,
                  ),
                );
                if (socket && isConnected) {
                  deleteSocketMessage(messageId);
                } else {
                  deleteMessageMutation.mutate({ roomId, messageId });
                }
              }}
              onEditMessage={handleEditMessage}
              onReactToMessage={handleMessageReaction}
              onKickUser={kickUser}
              onMuteUser={muteUser}
              onTranslateMessage={() =>
                toast.info("Translation will connect to your i18n API")
              }
              onSendGift={() =>
                toast.info("Gifts can be wired to your economy API")
              }
              chatSearch={chatSearch}
              onChatSearchChange={setChatSearch}
              showChatSearch={showChatSearch}
              onToggleChatSearch={() => setShowChatSearch(!showChatSearch)}
              totalParticipants={totalParticipants}
              scrollRef={chatScrollRef}
              endRef={chatEndRef}
              textareaRef={textareaRef}
              isNearBottom={isNearBottom}
              onScroll={handleChatScroll}
              hasNewMessages={hasNewMessages}
              newMessageCount={newMessageCount}
              onScrollToBottom={() => {
                setHasNewMessages(false);
                setNewMessageCount(0);
                scrollToBottom();
              }}
              onAttachFile={() =>
                toast.info("File uploads can be connected to your media API")
              }
              onRecordAudio={() =>
                toast.info("Voice notes can be connected to your audio API")
              }
              roomId={roomId}
              participantNames={allParticipants
                .map((p) => p.name)
                .filter(Boolean)}
              className="w-full md:w-[400px] border-l"
            />
          )}
        </AnimatePresence>
      </main>

      {/* Audio Controls */}
      <AudioControls
        isMuted={isMuted}
        isDeafened={isDeafened}
        volume={volume}
        audioLevel={audioLevel}
        isHost={isHost}
        isRecording={isRecording}
        isRaisingHand={isRaisingHand}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        onVolumeChange={setVolume}
        onLeave={handleLeave}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onShare={handleCopyLink}
        onRaiseHand={handleRaiseHand}
        participantCount={totalParticipants}
        onShowParticipants={() => setShowParticipants(true)}
        connectionQuality="excellent"
        isCallActive={isLiveKitConnected}
      />

      {/* Command Center */}
      <AnimatePresence>
        {showCommandCenter && (
          <>
            <motion.div
              key="cc-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998] bg-black/30"
              onClick={() => setShowCommandCenter(false)}
            />
            <CommandCenter
              isHost={isHost}
              isModerator={isModerator}
              isMuted={isMuted}
              isDeafened={isDeafened}
              soundEnabled={soundEnabled}
              showChat={showChat}
              showParticipants={true}
              showLiveStats={showLiveStats}
              isRecording={isRecording}
              onMute={handleToggleMute}
              onDeafen={handleToggleDeafen}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              onToggleChat={() => setShowChat(!showChat)}
              onToggleStats={() => setShowLiveStats(!showLiveStats)}
              onRecord={
                isRecording ? handleStopRecording : handleStartRecording
              }
              onClose={() => setShowCommandCenter(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Room Details */}
      <AnimatePresence>
        {showRoomDetails && (
          <RoomDetailsPanel
            room={room}
            totalParticipants={totalParticipants}
            speakingCount={speakingCount}
            onlineCount={onlineParticipants.length}
            messages={messages.length}
            duration={roomDuration}
            premiumCount={allParticipants.filter((p) => p.isPremium).length}
            verifiedCount={allParticipants.filter((p) => p.isVerified).length}
            languages={Array.from(
              new Set(
                allParticipants
                  .flatMap((p) => [p.nativeLanguage, p.learningLanguage])
                  .filter(Boolean),
              ),
            )}
            onClose={() => setShowRoomDetails(false)}
            onCopyLink={handleCopyLink}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <LeaveConfirmationModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleConfirmLeave}
      />

      <ShortcutPanel
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Session Notice */}
      <AnimatePresence>
        {sessionNotice && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[75] px-4 py-2 rounded-full border shadow-xl backdrop-blur-xl text-xs"
            style={{
              background: THEME.colors.background.card,
              borderColor: THEME.colors.border.primary,
              color: THEME.colors.text.primary,
            }}
          >
            <span className="inline-flex items-center gap-2">
              <CheckCheck
                className="w-3.5 h-3.5"
                style={{ color: THEME.colors.accent.success }}
              />
              {sessionNotice}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-24 left-4 z-20 hidden md:block">
        <div
          className="text-[9px] px-2.5 py-1 rounded-full"
          style={{
            color: THEME.colors.text.muted,
            background: `rgba(10, 10, 15, 0.8)`,
            backdropFilter: "blur(10px)",
          }}
        >
          ⌘+⇧+M mute · Enter send · Esc close chat
        </div>
      </div>
    </div>
  );
};

export default VoiceRoomView;
