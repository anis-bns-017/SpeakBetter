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
 * - Header has separate Leave (member) / End Room (host) actions
 * - Reactions survive refresh: HTTP-first writes + cache merge
 * - ✨ Stage reactions: floating emoji overlay + bottom reaction bar
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
  upload, 
  BarChart3
  LogOut,
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
  useEditVoiceMessage,
  useReactToVoiceMessage,
  usePinVoiceMessage,
  useLeaveVoiceRoom,
  type VoiceMessage,
} from "../../hooks/useVoice";

import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";

// Import all sub-components
import { AudioControls } from "./AudioControls";
import { ClapButton } from "./ClapButton";
import { VoiceRoomHeader } from "./shared/VoiceRoomHeader";
import { LeaveConfirmationModal } from "./shared/LeaveConfirmationModal";
import { SectionPill } from "./shared/SectionPill";
import { RoomDetailsPanel } from "./shared/RoomDetailsPanel";
import { ShortcutPanel } from "./shared/ShortcutPanel";
import { CommandCenter } from "./shared/CommandCenter";
import { RoomInvite } from "./shared/RoomInvite";
import { SessionInsights } from "./shared/SessionInsights";
import { RoomQualityPanel } from "./shared/RoomQualityPanel";
import { AICoHost } from "./shared/AICoHost";
import { useAICoHost } from "../../hooks/useAICoHost";

import {
  AttachmentPreviewModal,
  type PendingAttachment,
} from "./chat/AttachmentPreviewModal";
import { useSpeakingTimes } from "../../hooks/useSpeakingTimes";
import { ParticipantCard } from "./participants/ParticipantCard";
import { EmptyParticipantState } from "../shared/EmptyParticipantState";
import { ParticipantGrid } from "./participants/ParticipantGrid";
import { TranscriptionDisplay } from "./TranscriptionDisplay";
import { useVoiceTranscription } from "../../hooks/useVoiceTranscription";

import { ChatPanel } from "./chat/ChatPanel";
import { ReactionOverlay, type StageReaction } from "./shared/ReactionOverlay";
import { SpeakerQueue } from "./SpeakerQueue";
import { ActiveSpeakerStrip } from "./shared/ActiveSpeakerStrip";
import { StageReactionBar } from "./shared/StageReactionBar";

// Import theme and types
import { THEME } from "./VoiceRoomView.theme";
import type {
  VoiceRoomViewProps,
  MinimizedRoomData,
  RoomParticipant,
} from "./VoiceRoomView.types";

// ------------------------------------------------------------
// Room-wide drag-drop overlay
// ------------------------------------------------------------
const RoomDropZone: React.FC<{ onFile: (file: File) => void }> = ({
  onFile,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const counter = React.useRef(0);

  React.useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      counter.current += 1;
      setIsDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      counter.current -= 1;
      if (counter.current <= 0) {
        counter.current = 0;
        setIsDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      counter.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFile]);

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
          style={{
            background: "rgba(129,140,248,0.16)",
            backdropFilter: "blur(6px)",
            border: `3px dashed ${THEME.colors.accent.primary}`,
          }}
        >
          <div className="text-center">
            <Upload
              className="w-12 h-12 mx-auto mb-3"
              style={{ color: THEME.colors.accent.primary }}
            />
            <p
              className="text-xl font-bold"
              style={{ color: THEME.colors.text.primary }}
            >
              Drop to attach
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: THEME.colors.text.muted }}
            >
              Images, video, audio, or files up to 50MB
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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

  let reactions: Record<string, string[]> = {};

  if (Array.isArray(msg.reactions)) {
    for (const reaction of msg.reactions) {
      const emoji = reaction?.emoji;
      const userId =
        reaction?.userId || reaction?.user?.id || reaction?.user?.userId;

      if (emoji && userId) {
        reactions[emoji] = [...(reactions[emoji] || []), String(userId)];
      }
    }

    for (const emoji of Object.keys(reactions)) {
      reactions[emoji] = [...new Set(reactions[emoji])];
    }
  } else if (msg.reactions && typeof msg.reactions === "object") {
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const response = await voiceApi.getRooms();
        setRooms(response.data || []);
        setActiveRooms(
          response.data?.filter((r: any) => r.status === "ACTIVE").length || 0,
        );
      } catch (error) {
        setLoadError(
          "We couldn't load the voice rooms. Check your connection and try again.",
        );
        toast.error("Failed to load rooms");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRooms();
  }, [reloadKey]);

  const filteredRooms = useMemo(() => {
    let filtered = [...rooms];
    if (searchQuery) {
      filtered = filtered.filter(
        (room) =>
          String(room.name || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
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
    if (languageFilter.learningLanguage) {
      filtered = filtered.filter(
        (room) =>
          room.learningLanguage?.toLowerCase() ===
            languageFilter.learningLanguage?.toLowerCase() ||
          room.participants?.some(
            (participant: any) =>
              participant.learningLanguage?.toLowerCase() ===
              languageFilter.learningLanguage?.toLowerCase(),
          ),
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
        filtered = filtered.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || "")),
        );
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

  if (loadError) {
    return (
      <div className="min-h-[18rem] flex items-center justify-center px-4">
        <div
          className="w-full max-w-md rounded-2xl border p-6 text-center shadow-xl"
          style={{
            background: THEME.colors.background.card,
            borderColor: THEME.colors.border.primary,
          }}
          role="alert"
        >
          <WifiOff
            className="w-9 h-9 mx-auto mb-3"
            style={{ color: THEME.colors.accent.warning }}
          />
          <h3
            className="font-semibold"
            style={{ color: THEME.colors.text.primary }}
          >
            Rooms are unavailable
          </h3>
          <p
            className="mt-1 text-sm"
            style={{ color: THEME.colors.text.muted }}
          >
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
            style={{ background: THEME.colors.gradient.primary }}
          >
            <RotateCcw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
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

export const VoiceRoomView: React.FC<VoiceRoomViewProps> = ({
  roomId,
  onLeave,
  onMinimize,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ============================================================
  // STATE
  // ============================================================

  const [token, setToken] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinAttempt, setJoinAttempt] = useState(0);
  const [liveKitRoomId, setLiveKitRoomId] = useState<string>("");

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
  const [isRecording, setIsRecording] = useState(false);
  const [roomDuration, setRoomDuration] = useState(0);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantFilter, setParticipantFilter] = useState<
    "all" | "online" | "speaking" | "raised"
  >("all");
  const [showParticipantSearch, setShowParticipantSearch] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [showRoomInvite, setShowRoomInvite] = useState(false);
  const [showSessionInsights, setShowSessionInsights] = useState(false);
  const [showQualityPanel, setShowQualityPanel] = useState(false);
  const [showAICoHost, setShowAICoHost] = useState(false);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [favoriteParticipants, setFavoriteParticipants] = useState<Set<string>>(
    new Set(),
  );
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [stageReactions, setStageReactions] = useState<StageReaction[]>([]);
  const [showTranscription, setShowTranscription] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================
  // DATA QUERIES
  // ============================================================

  const { data: room, isLoading, refetch } = useVoiceRoom(roomId);
  const { data: initialMessages } = useRoomMessages(roomId);
  const sendMessageMutation = useSendVoiceMessage();
  const deleteMessageMutation = useDeleteVoiceMessage();
  const editMessageMutation = useEditVoiceMessage();
  const reactMessageMutation = useReactToVoiceMessage();
  const pinMessageMutation = usePinVoiceMessage();
  const leaveRoomMutation = useLeaveVoiceRoom();

  const { data: cachedMessages } = useQuery<VoiceMessage[]>({
    queryKey: ["voice-messages", roomId],
    enabled: false,
  });

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
    editMessage,
    reactMessage,
    broadcastSpeaking,
    sendStageReaction,
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
    isConnecting,
  } = liveKitResult;

  const isMuted = liveKitIsMuted;

  // ------------------------------------------------------------
  // Live transcription (Web Speech API + socket broadcast)
  //   Runs after LiveKit so it can react to `isMuted` changes.
  // ------------------------------------------------------------
  const {
    transcriptions,
    isRecording: isTranscribing,
    isSupported: isTranscriptionSupported,
    clear: clearTranscriptions,
  } = useVoiceTranscription({
    roomId,
    userId: user?.id || "",
    userName: (user as any)?.name || "You",
    isMuted,
    socket,
    isConnected,
    language: "en-US",
  });

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
  // ------------------------------
  // Speaking time tracker (for SessionInsights)
  // ------------------------------
  const speakingTimes = useSpeakingTimes(allParticipants);

    // ------------------------------
  // AI co-host (quiet detection + summary)
  // ------------------------------
  const aiCoHost = useAICoHost({
    enabled: isHost || isModerator,
    roomName: room?.name || "",
    transcriptions,
    participantCount: totalParticipants,
    roomDurationSec: roomDuration,
    messagesCount: messages.length,
  });

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
  // HANDLERS
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

  const handleEndRoom = useCallback(async () => {
    if (!roomId) return;
    if (!window.confirm("End this room for everyone? This cannot be undone.")) {
      return;
    }
    try {
      await voiceApi.endRoom(roomId);
      socket?.emit("voice:leave", { roomId, userId: user?.id });
      toast.success("Room ended");
      onLeave();
    } catch {
      toast.error("Failed to end room");
    }
  }, [roomId, socket, user?.id, onLeave]);

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
      if (!roomId) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: newContent, isEdited: true }
            : m,
        ),
      );

      editMessageMutation.mutate(
        { roomId, messageId, content: newContent },
        {
          onSuccess: () => {
            if (socket && isConnected) {
              editMessage(messageId, newContent);
            }
            toast.success("Message edited");
          },
        },
      );
    },
    [roomId, editMessageMutation, socket, isConnected, editMessage],
  );

  // ---------- Speaker queue actions ----------
  const handleQueuePromote = useCallback(
    (userId: string) => {
      // Unmute the user so they can speak
      unmuteUser(userId);
      // Optional: emit a dedicated event if your gateway supports it
      socket?.emit?.("voice:promote-speaker", { roomId, userId });
      // Locally clear raised hand for that user
      setStageReactions((prev) => prev); // no-op; hand state comes from socket
    },
    [unmuteUser, socket, roomId],
  );

  const handleQueueRemove = useCallback(
    (userId: string) => {
      socket?.emit?.("voice:lower-hand", { roomId, userId });
    },
    [socket, roomId],
  );

  const handleToggleRaiseHand = useCallback(
    (raised: boolean) => {
      raiseHand(raised);
      if (raised) toast.success("✋ Hand raised");
      else toast.info("Hand lowered");
    },
    [raiseHand],
  );

  const handleMessageReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!user?.id || !roomId) return;

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

      reactMessageMutation.mutate(
        { roomId, messageId, emoji, userId: user.id },
        {
          onSuccess: () => {
            if (socket && isConnected) {
              reactMessage(messageId, emoji);
            }
          },
          onError: () => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== messageId) return m;
                const reactions: Record<string, string[]> = {};
                if (m.reactions) {
                  for (const [e, users] of Object.entries(m.reactions)) {
                    reactions[e] = Array.isArray(users) ? [...users] : [];
                  }
                }
                const users = new Set(reactions[emoji] || []);
                if (users.has(user.id)) users.delete(user.id);
                else users.add(user.id);
                if (users.size > 0) reactions[emoji] = Array.from(users);
                else delete reactions[emoji];
                return { ...m, reactions };
              }),
            );
            toast.error("Failed to react");
          },
        },
      );
    },
    [user?.id, roomId, reactMessageMutation, socket, isConnected, reactMessage],
  );

  // ============================================================
  // ATTACHMENT HANDLERS (Cloudinary)
  // ============================================================

  const handleAttachClick = useCallback(() => {
    attachInputRef.current?.click();
  }, []);

    // Step 1: pick a file → open preview modal (does NOT upload yet)
  const handleAttachFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      openAttachmentPreview(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Normalize a File → PendingAttachment and open the modal
  const openAttachmentPreview = useCallback((file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50MB limit");
      return;
    }

    let kind: PendingAttachment["kind"] = "file";
    if (file.type.startsWith("image/")) kind = "image";
    else if (file.type.startsWith("video/")) kind = "video";
    else if (file.type.startsWith("audio/")) kind = "audio";

    const previewUrl =
      kind === "image" || kind === "video" || kind === "audio"
        ? URL.createObjectURL(file)
        : null;

    // Revoke previous preview if any
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, kind, previewUrl };
    });

    setShowAttachmentPreview(true);
  }, []);

  // Step 2: modal → Send → actually upload + emit
  const handleConfirmAttachmentSend = useCallback(
    async (caption: string) => {
      const pending = pendingAttachment;
      if (!pending || !user?.id || !roomId) return;

      const { uploadToCloudinary, kindToMessageType } = await import(
        "../../lib/uploadToCloudinary"
      );

      const result = await uploadToCloudinary(pending.file);

      const payload = {
        content: caption || pending.file.name,
        type: kindToMessageType(result.kind),
        mediaUrl: result.url,
        fileUrl: result.url,
        replyToId: replyTo?.id,
      };

      if (socket && isConnected) {
        sendChatMessage(payload);
      } else {
        sendMessageMutation.mutate({ roomId, ...payload });
      }

      // Clean up
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      setPendingAttachment(null);
      setShowAttachmentPreview(false);
      setReplyTo(null);

      toast.success("Sent");
    },
    [
      pendingAttachment,
      user?.id,
      roomId,
      replyTo,
      socket,
      isConnected,
      sendChatMessage,
      sendMessageMutation,
    ],
  );

  // Step 3: modal → Cancel → clean up
  const handleCancelAttachment = useCallback(() => {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setShowAttachmentPreview(false);
  }, []);

  // Step 4: modal → Replace → swap the file
  const handleReplaceAttachment = useCallback(
    (file: File) => {
      openAttachmentPreview(file);
    },
    [openAttachmentPreview],
  );

  // ============================================================
  // STAGE REACTIONS (Feature 1)
  // ============================================================

  useEffect(() => {
    if (!socket) return;

    const handleStageReaction = (data: {
      id?: string;
      userId: string;
      userName?: string;
      emoji: string;
      createdAt?: number;
    }) => {
      setStageReactions((prev) => [
        ...prev,
        {
          id:
            data.id ||
            `${data.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          emoji: data.emoji,
          userId: data.userId,
          userName: data.userName,
          xPercent: 12 + Math.random() * 76,
          createdAt: data.createdAt ?? Date.now(),
        },
      ]);
    };

    socket.on("voice:stage-reaction", handleStageReaction);
    return () => {
      socket.off("voice:stage-reaction", handleStageReaction);
    };
  }, [socket]);

  // Prune old reactions
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setStageReactions((prev) =>
        prev.length === 0 ? prev : prev.filter((r) => now - r.createdAt < 3600),
      );
    }, 600);
    return () => window.clearInterval(interval);
  }, []);

  const handleSendStageReaction = useCallback(
    (emoji: string) => {
      setStageReactions((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          emoji,
          userId: user?.id || "me",
          userName: (user as any)?.name,
          xPercent: 12 + Math.random() * 76,
          createdAt: Date.now(),
        },
      ]);
      sendStageReaction(emoji);
    },
    [sendStageReaction, user],
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
  // EFFECTS
  // ============================================================

  // Token fetching
  useEffect(() => {
    const getToken = async () => {
      if (!roomId || !user?.id || isJoining || token) return;

      try {
        setIsJoining(true);
        setJoinError(null);
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
        toast.success("Connected to voice");
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Failed to join room";
        setJoinError(message);
        toast.error(message);
      } finally {
        setIsJoining(false);
      }
    };

    getToken();
  }, [roomId, user?.id, token, joinAttempt]);

  // Cache → local mirror with reaction preservation
  useEffect(() => {
    const source = cachedMessages ?? initialMessages;
    if (!source) return;

    setMessages((prev) => {
      const prevById = new Map(prev.map((m) => [m.id, m]));

      const sorted = [...source]
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .map((msg) => {
          const prior = prevById.get(msg.id);
          const normalized = normalizeChatMessage(
            { ...msg, status: "sent" as const },
            user?.id,
          );
          const incomingHasReactions =
            normalized.reactions &&
            Object.keys(normalized.reactions).length > 0;
          const priorHasReactions =
            prior?.reactions && Object.keys(prior.reactions).length > 0;
          if (!incomingHasReactions && priorHasReactions) {
            return { ...normalized, reactions: prior!.reactions };
          }
          return normalized;
        });

      return sorted;
    });
  }, [cachedMessages, initialMessages, user?.id]);

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
    };
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  if (joinError && !token && !isJoining) {
    return (
      <div
        className="h-screen flex items-center justify-center px-6"
        style={{ background: THEME.colors.background.primary }}
      >
        <div
          className="w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl"
          style={{
            background: THEME.colors.background.card,
            borderColor: THEME.colors.border.primary,
          }}
          role="alert"
        >
          <WifiOff
            className="w-11 h-11 mx-auto mb-4"
            style={{ color: THEME.colors.accent.warning }}
          />
          <h2
            className="text-xl font-bold"
            style={{ color: THEME.colors.text.primary }}
          >
            Couldn't connect to voice
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: THEME.colors.text.muted }}
          >
            {joinError}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onLeave}
              className="flex-1 rounded-full border px-4 py-2.5 text-sm font-medium"
              style={{
                borderColor: THEME.colors.border.primary,
                color: THEME.colors.text.secondary,
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setJoinAttempt((attempt) => attempt + 1)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
              style={{ background: THEME.colors.gradient.primary }}
            >
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || isJoining || isConnecting || !token) {
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

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: THEME.colors.background.primary }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: THEME.colors.gradient.glow }}
      />

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
        onShowDetails={() => setShowRoomDetails(true)}
        onShowShortcuts={() => setShowShortcuts(true)}
        onMinimize={onMinimize}
        onShare={() => setShowRoomInvite(true)}
        onLeave={handleLeave}
        onEndRoom={handleEndRoom}
      />

      <AnimatePresence>

              {/* ✨ AI Co-host toggle — host/mod only */}
      {(isHost || isModerator) && (
        <button
          type="button"
          onClick={() => setShowAICoHost((v) => !v)}
          className="absolute top-20 left-14 z-40 p-2.5 rounded-full border shadow-lg transition-all hover:scale-105 relative"
          style={{
            background: showAICoHost
              ? `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`
              : "rgba(18,18,32,0.85)",
            borderColor: THEME.colors.border.primary,
            color: showAICoHost ? "#fff" : THEME.colors.text.muted,
          }}
          title={
            showAICoHost ? "Hide AI co-host" : "Open AI co-host"
          }
        >
          <Sparkles className="w-4 h-4" />
          {/* Suggestion-ready dot */}
          {aiCoHost.suggestion && !showAICoHost && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: THEME.colors.accent.warning }}
            />
          )}
        </button>
      )}

              {/* 📶 Connection quality toggle */}
      <button
        type="button"
        onClick={() => setShowQualityPanel((v) => !v)}
        className="absolute top-20 right-14 z-40 p-2.5 rounded-full border shadow-lg transition-all hover:scale-105"
        style={{
          background: showQualityPanel
            ? THEME.colors.accent.primary
            : "rgba(18,18,32,0.85)",
          borderColor: THEME.colors.border.primary,
          color: showQualityPanel ? "#fff" : THEME.colors.text.muted,
        }}
        title={
          showQualityPanel ? "Hide connection info" : "Show connection info"
        }
      >
        <Wifi className="w-4 h-4" />
      </button>

        {/* 📊 Session insights toggle — host/mod only */}
        {(isHost || isModerator) && (
          <button
            type="button"
            onClick={() => setShowSessionInsights((v) => !v)}
            className="absolute top-20 left-4 z-40 p-2.5 rounded-full border shadow-lg transition-all hover:scale-105"
            style={{
              background: showSessionInsights
                ? THEME.colors.accent.primary
                : "rgba(18,18,32,0.85)",
              borderColor: THEME.colors.border.primary,
              color: showSessionInsights ? "#fff" : THEME.colors.text.muted,
            }}
            title={
              showSessionInsights ? "Hide insights" : "Show session insights"
            }
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        )}

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

      <main className="flex flex-1 min-h-0 relative z-10">
        {/* ✨ Floating emoji overlay — spans the stage */}
        <ReactionOverlay reactions={stageReactions} />

        {/* 🎧 Stage column: speaker strip + participant grid */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 relative">
          {/* 🎙️ Active speaker strip — flows at the top of the stage */}
          <ActiveSpeakerStrip
            participants={allParticipants}
            currentUserId={user?.id}
            onSelect={(id) => {
              const p = allParticipants.find(
                (x) => x.id === id || x.userId === id,
              );
              if (p) toast.info(`🎤 ${p.name} is speaking`);
            }}
          />

          {/* 🧑‍🤝‍🧑 Participant grid */}
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
            onUnmuteUser={unmuteUser}
            onKickUser={kickUser}
            onPromoteHost={promoteHost}
            onSendMessage={(userId) => {
              const participant = allParticipants.find((p) => p.id === userId);
              if (participant) {
                setShowChat(true);
                setNewMessage(`@${participant.name} `);
              }
            }}
                        onViewProfile={(userId) => toast.info(`👤 Viewing profile`)}
            showChat={showChat}
            className="w-full"
            onInvite={() => setShowRoomInvite(true)}
            onPickTopic={(topic) => {
              setShowChat(true);
              setNewMessage(topic);
              setTimeout(() => textareaRef.current?.focus(), 100);
            }}
          />

          {/* ✋ Speaker queue — floating card on the right of the stage */}
          <div className="pointer-events-none absolute right-3 top-3 z-30 w-[min(88vw,300px)] hidden md:block">
            <div className="pointer-events-auto">
              <SpeakerQueue
                participants={allParticipants.map((p) => ({
                  id: p.id,
                  userId: p.userId,
                  name: p.name,
                  avatarUrl: p.avatarUrl,
                  isVerified: p.isVerified,
                  isPremium: p.isPremium,
                  raisedHand: p.raisedHand,
                  raisedHandAt: (p as any).raisedHandAt,
                  isSpeaking: p.isSpeaking,
                  isMuted: p.isMuted,
                }))}
                currentUserId={user?.id}
                isModerator={isModerator}
                onPromote={handleQueuePromote}
                onRemove={handleQueueRemove}
                onSkip={(userId) => kickUser(userId)}
                onToggleRaiseHand={handleToggleRaiseHand}
                defaultExpanded={false}
              />
            </div>
          </div>
        </div>

        {/* 💬 Chat panel */}
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
                if (!roomId) return;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId ? { ...m, isPinned: pinned } : m,
                  ),
                );
                pinMessageMutation.mutate(
                  { roomId, messageId, pinned },
                  {
                    onSuccess: () => {
                      if (socket && isConnected) {
                        pinMessage?.(messageId, pinned);
                      }
                    },
                  },
                );
              }}
              onDeleteMessage={(messageId) => {
                if (!roomId) return;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId ? { ...m, isDeleted: true } : m,
                  ),
                );
                deleteMessageMutation.mutate(
                  { roomId, messageId },
                  {
                    onSuccess: () => {
                      if (socket && isConnected) {
                        deleteSocketMessage(messageId);
                      }
                    },
                  },
                );
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
              onAttachFile={handleAttachClick}
              roomId={roomId}
              participantNames={allParticipants
                .map((p) => p.name)
                .filter(Boolean)}
              className="w-full md:w-[400px] border-l"
            />
          )}
        </AnimatePresence>
      </main>

      {/* ✨ Floating stage reaction bar */}
      <StageReactionBar onSend={handleSendStageReaction} />

      {/* 👏 Floating clap button — bottom-left of the stage */}
      <div className="pointer-events-none absolute bottom-6 left-4 z-[65] hidden sm:block">
        <div className="pointer-events-auto">
          <ClapButton
            onClap={() => handleSendStageReaction("👏")}
            size="md"
            maxClaps={50}
            cooldownMs={180}
          />
        </div>
      </div>

      {/* 👏 Mobile version — small, bottom-right */}
      <div className="pointer-events-none absolute bottom-6 right-4 z-[65] sm:hidden">
        <div className="pointer-events-auto">
          <ClapButton
            onClap={() => handleSendStageReaction("👏")}
            size="sm"
            maxClaps={50}
            cooldownMs={180}
            showRemaining={false}
          />
        </div>
      </div>

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
            {/* Positioning wrapper — CommandCenter hangs off the top-right */}
            <div className="fixed top-16 right-4 z-[999]">
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
            </div>
          </>
        )}
      </AnimatePresence>

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

      <LeaveConfirmationModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleConfirmLeave}
      />

            <ShortcutPanel
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

            <AttachmentPreviewModal
        isOpen={showAttachmentPreview}
        attachment={pendingAttachment}
        onSend={handleConfirmAttachmentSend}
        onCancel={handleCancelAttachment}
        onReplace={handleReplaceAttachment}
      />


      <RoomInvite
        isOpen={showRoomInvite}
        onClose={() => setShowRoomInvite(false)}
        roomName={room.name}
        roomId={roomId}
        participantCount={totalParticipants}
      />

            {/* ✨ AI Co-host panel */}
      {(isHost || isModerator) && (
        <AICoHost
          isOpen={showAICoHost}
          onClose={() => setShowAICoHost(false)}
          isHost={isHost}
          isModerator={isModerator}
          suggestion={aiCoHost.suggestion}
          onDismissSuggestion={aiCoHost.dismissSuggestion}
          onSuggestNow={aiCoHost.suggestNow}
          summary={aiCoHost.summary}
          isSummarizing={aiCoHost.isSummarizing}
          onGenerateSummary={aiCoHost.generateSummary}
          onClearSummary={aiCoHost.clearSummary}
          exportText={aiCoHost.exportSummaryText}
          onUseSuggestion={(text) => {
            setShowChat(true);
            setNewMessage(text);
            setTimeout(() => textareaRef.current?.focus(), 100);
          }}
        />
      )}


            {/* 📶 Connection quality panel */}
      <RoomQualityPanel
        isOpen={showQualityPanel}
        onClose={() => setShowQualityPanel(false)}
        liveKitQuality={
          isLiveKitConnected
            ? "excellent"
            : isMockMode
              ? "poor"
              : "good"
        }
      />

      {/* 📊 Session insights (host/mod) */}
      <AnimatePresence>
        {showSessionInsights && (isHost || isModerator) && (
          <SessionInsights
            speakingTimes={speakingTimes}
            totalParticipants={totalParticipants}
            roomDuration={roomDuration}
            messages={messages.length}
            reactions={stageReactions.length}
            isHost={isHost}
            isModerator={isModerator}
            onClose={() => setShowSessionInsights(false)}
          />
        )}
      </AnimatePresence>

      <ShortcutPanel
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

            {/* Room-wide drag-drop zone */}
      <RoomDropZone onFile={openAttachmentPreview} />


      {/* Hidden file input for paperclip */}
      <input
        ref={attachInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
        className="hidden"
        onChange={handleAttachFileChange}
      />

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
