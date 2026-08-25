import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  useVoiceRoom,
  useVoiceSocket,
  useLiveKitRoom,
  voiceApi,
  useRoomMessages,
  useSendVoiceMessage,
  useDeleteVoiceMessage,
  useLeaveVoiceRoom,
  type VoiceMessage,
} from "../../hooks/useVoice";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  Link2,
  Radio,
  TrendingUp,
  Circle,
  Sparkles,
  Settings,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  LogIn,
  ChevronRight,
  Globe,
  Languages,
  Flag,
  Heart,
  Share2,
  MoreVertical,
  Zap,
  Coffee,
  Star,
  Award,
  MapPin,
  Clock,
  Calendar,
  Filter,
  SortAsc,
  UserPlus,
  UserCheck,
  MessageSquare,
  Video,
  Image,
  Gift,
  Music,
  Gamepad2,
  Bell,
  BellOff,
  RotateCcw,
  ArrowDown,
  CheckCheck,
  Copy,
  Wifi,
  WifiOff,
  Headphones,
  SlidersHorizontal,
  PanelRight,
  PanelRightClose,
  Keyboard,
  Maximize2,
  MoreHorizontal,
  ShieldCheck,
  Timer,
  UserRoundSearch,
  Volume1,
  Sparkle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";

// ---- Types ----
interface VoiceRoomViewProps {
  roomId: string;
  onLeave: () => void;
  onMinimize?: (roomData: {
    id: string;
    name: string;
    participants: any[];
    type: string;
    participantCount: number;
  }) => void;
}

interface VoiceRoomListProps {
  onJoinRoom: (roomId: string) => void;
  onViewRoom?: (roomId: string) => void;
}

interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  country?: string;
  nativeLanguage?: string;
  learningLanguage?: string;
  level?: string;
  bio?: string;
  interests?: string[];
  isOnline?: boolean;
  lastActive?: string;
  isVerified?: boolean;
  isPremium?: boolean;
  age?: number;
  gender?: string;
  timezone?: string;
}

interface RoomParticipant extends UserProfile {
  isSpeaking: boolean;
  isMuted: boolean;
  raisedHand: boolean;
  joinedAt: string;
  role: "HOST" | "MODERATOR" | "MEMBER";
  isListening: boolean;
  audioLevel: number;
}

interface LanguageFilter {
  nativeLanguage?: string;
  learningLanguage?: string;
  level?: string;
  country?: string;
}

type LocalMessageStatus = "sending" | "sent" | "failed" | undefined;
type LocalVoiceMessage = VoiceMessage & {
  status?: LocalMessageStatus;
  reactionTally?: Record<string, number>;
};

// ---- Theme ----

/**
 * REAL-TIME MICROPHONE LEVEL
 *
 * Uses the browser's actual microphone signal only for truthful local UI
 * feedback. LiveKit remains responsible for the actual room audio transport.
 * This avoids fake/random speaker animation.
 */

const THEME = {
  void: "#0A0A12",
  surface: "#141425",
  surfaceRaised: "#1E1E38",
  surfaceHover: "#2A2A4A",
  border: "#2A2A4A",
  borderGlow: "rgba(120, 80, 255, 0.2)",
  aurora: {
    primary: "#7C6AFF",
    secondary: "#A78BFA",
    tertiary: "#6EE7B7",
    quaternary: "#FCD34D",
    pink: "#F472B6",
    cyan: "#67E8F9",
    purple: "#8B5CF6",
    blue: "#3B82F6",
    green: "#34D399",
    red: "#EF4444",
    orange: "#F59E0B",
    yellow: "#FBBF24",
  },
  gradient: {
    from: "rgba(124, 106, 255, 0.15)",
    to: "rgba(167, 139, 250, 0.05)",
  },
  text: {
    primary: "#F8F7FF",
    secondary: "#B8B0D8",
    muted: "#7A72A0",
    accent: "#A78BFA",
  },
  status: {
    live: "#6EE7B7",
    liveGlow: "rgba(110, 231, 183, 0.3)",
    muted: "#7A72A0",
    speaking: "#A78BFA",
    speakingGlow: "rgba(167, 139, 250, 0.4)",
    waiting: "#FCD34D",
    waitingGlow: "rgba(252, 211, 77, 0.3)",
  },
};

// ---- Helper Functions ----
function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "?"
  );
}

function hueFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function formatTime(date: string) {
  try {
    return format(new Date(date), "h:mm a");
  } catch {
    return "";
  }
}

function formatDateSeparator(date: string) {
  try {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMMM d, yyyy");
  } catch {
    return "";
  }
}

function dayKey(date: string) {
  try {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  } catch {
    return date;
  }
}

function getCountryFlag(countryCode?: string): string {
  if (!countryCode) return "🌍";
  const flags: Record<string, string> = {
    US: "🇺🇸",
    GB: "🇬🇧",
    FR: "🇫🇷",
    DE: "🇩🇪",
    ES: "🇪🇸",
    IT: "🇮🇹",
    JP: "🇯🇵",
    KR: "🇰🇷",
    CN: "🇨🇳",
    IN: "🇮🇳",
    BR: "🇧🇷",
    RU: "🇷🇺",
    AU: "🇦🇺",
    CA: "🇨🇦",
    MX: "🇲🇽",
    ZA: "🇿🇦",
    NG: "🇳🇬",
    EG: "🇪🇬",
    SA: "🇸🇦",
    AE: "🇦🇪",
    SG: "🇸🇬",
    MY: "🇲🇾",
    PH: "🇵🇭",
    VN: "🇻🇳",
    TH: "🇹🇭",
    ID: "🇮🇩",
    PK: "🇵🇰",
    BD: "🇧🇩",
    TR: "🇹🇷",
    NL: "🇳🇱",
    BE: "🇧🇪",
    CH: "🇨🇭",
    SE: "🇸🇪",
    NO: "🇳🇴",
    DK: "🇩🇰",
    FI: "🇫🇮",
    PL: "🇵🇱",
    GR: "🇬🇷",
    PT: "🇵🇹",
    IE: "🇮🇪",
    NZ: "🇳🇿",
    AR: "🇦🇷",
    CL: "🇨🇱",
    CO: "🇨🇴",
    PE: "🇵🇪",
    VE: "🇻🇪",
  };
  return flags[countryCode] || "🌍";
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderMessageContent(content: string) {
  if (!content) return null;
  const urlParts = content.split(URL_PATTERN);
  return urlParts.map((chunk, ci) => {
    if (URL_PATTERN.test(chunk)) {
      URL_PATTERN.lastIndex = 0;
      return (
        <a
          key={`u-${ci}`}
          href={chunk}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline underline-offset-2 hover:opacity-80 break-all"
          style={{ color: THEME.aurora.cyan }}
        >
          {chunk}
        </a>
      );
    }
    URL_PATTERN.lastIndex = 0;
    const mentionParts = chunk.split(/(@[a-zA-Z0-9_]+)/g);
    return mentionParts.map((part, i) =>
      /^@[a-zA-Z0-9_]+$/.test(part) ? (
        <span
          key={`${ci}-${i}`}
          className="font-semibold"
          style={{ color: THEME.aurora.secondary }}
        >
          {part}
        </span>
      ) : (
        <React.Fragment key={`${ci}-${i}`}>{part}</React.Fragment>
      ),
    );
  });
}

function playNotificationBeep() {
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    osc.onended = () => ctx.close();
  } catch {
    // Ignore
  }
}

// ============================
// VOICE ROOM LIST COMPONENT
// ============================

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
          style={{ color: THEME.aurora.primary }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2
            className="text-2xl font-serif"
            style={{ color: THEME.text.primary }}
          >
            Voice Rooms
          </h2>
          <p className="text-sm" style={{ color: THEME.text.muted }}>
            {activeRooms} active {activeRooms === 1 ? "room" : "rooms"} ·{" "}
            {rooms.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-all hover:scale-105 border"
            style={{
              borderColor: THEME.border,
              color: THEME.text.secondary,
            }}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={() => toast.info("Create room feature coming soon")}
            className="px-4 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
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
                background: THEME.surface,
                borderColor: THEME.border,
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label
                    className="text-xs font-medium"
                    style={{ color: THEME.text.muted }}
                  >
                    Status
                  </label>
                  <div className="flex gap-2 mt-1">
                    {(["all", "active", "waiting"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize"
                        style={{
                          background:
                            filter === f
                              ? THEME.aurora.primary
                              : THEME.surfaceHover,
                          color: filter === f ? "#fff" : THEME.text.secondary,
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
                    style={{ color: THEME.text.muted }}
                  >
                    Sort By
                  </label>
                  <div className="flex gap-2 mt-1">
                    {(["participants", "recent", "name"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortBy(s)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize"
                        style={{
                          background:
                            sortBy === s
                              ? THEME.aurora.primary
                              : THEME.surfaceHover,
                          color: sortBy === s ? "#fff" : THEME.text.secondary,
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
                    style={{ color: THEME.text.muted }}
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
                    placeholder="Filter by language..."
                    className="w-full px-3 py-1.5 rounded-full text-xs outline-none border"
                    style={{
                      background: THEME.surfaceHover,
                      color: THEME.text.primary,
                      borderColor: THEME.border,
                    }}
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-medium"
                    style={{ color: THEME.text.muted }}
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
                    placeholder="Filter by learning language..."
                    className="w-full px-3 py-1.5 rounded-full text-xs outline-none border"
                    style={{
                      background: THEME.surfaceHover,
                      color: THEME.text.primary,
                      borderColor: THEME.border,
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
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: THEME.text.muted }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search rooms by name, description, or language..."
          className="w-full px-10 py-3 rounded-xl outline-none transition-all border"
          style={{
            background: THEME.surface,
            color: THEME.text.primary,
            borderColor: THEME.border,
          }}
        />
      </div>

      <div className="space-y-3">
        {filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(167, 139, 250, 0.1)" }}
            >
              <Radio
                className="w-8 h-8"
                style={{ color: THEME.aurora.primary }}
              />
            </div>
            <p className="text-sm" style={{ color: THEME.text.muted }}>
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

// ---- Room Card Component ----
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
      className="p-4 rounded-2xl border transition-all cursor-pointer"
      style={{
        background: isHovered ? THEME.surfaceHover : THEME.surface,
        borderColor: isHovered ? THEME.aurora.primary : THEME.border,
        boxShadow: isHovered ? `0 0 40px ${THEME.borderGlow}` : "none",
      }}
      onClick={onView}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 relative"
          style={{
            background: `hsl(${hueFromString(room.name)}, 50%, 22%)`,
            color: THEME.text.primary,
          }}
        >
          {initials(room.name)}
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-semibold truncate"
              style={{ color: THEME.text.primary }}
            >
              {room.name}
            </span>
            {languages.slice(0, 2).map((lang) => (
              <span
                key={lang}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(167, 139, 250, 0.1)",
                  color: THEME.aurora.secondary,
                }}
              >
                {lang}
              </span>
            ))}
            {languages.length > 2 && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(167, 139, 250, 0.1)",
                  color: THEME.aurora.secondary,
                }}
              >
                +{languages.length - 2}
              </span>
            )}
            {isHost && (
              <span
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#FBBF24",
                }}
              >
                <Crown className="w-3 h-3" /> HOST
              </span>
            )}
            {isUserInside && (
              <span
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(110, 231, 183, 0.15)",
                  color: THEME.status.live,
                }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
                INSIDE
              </span>
            )}
            {isActive && !isUserInside && (
              <span
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(110, 231, 183, 0.1)",
                  color: THEME.status.live,
                }}
              >
                ● LIVE
              </span>
            )}
            {!isActive && (
              <span
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(251, 191, 36, 0.1)",
                  color: "#FBBF24",
                }}
              >
                ● WAITING
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-3 mt-1 text-xs"
            style={{ color: THEME.text.muted }}
          >
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {participantCount}/{room.maxParticipants || 50}
            </span>
            {hasActiveSpeakers && (
              <span className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: THEME.status.speaking }}
                />
                Speaking
              </span>
            )}
            {room.type && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {room.type}
              </span>
            )}
            {room.nativeLanguage && (
              <span className="flex items-center gap-1">
                <Languages className="w-3 h-3" />
                {room.nativeLanguage}
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
              ? "rgba(110, 231, 183, 0.15)"
              : `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
            color: isUserInside ? THEME.status.live : "#fff",
            border: isUserInside ? `1px solid ${THEME.status.live}` : "none",
          }}
        >
          {isUserInside ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
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
          style={{ color: THEME.text.muted }}
        >
          {room.description}
        </p>
      )}
    </motion.div>
  );
};

// ============================
// ENHANCED VOICE ROOM VIEW
// ============================

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
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="rounded-3xl w-full max-w-md p-6 border"
        style={{ background: THEME.surface, borderColor: THEME.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(239, 68, 68, 0.15)" }}
          >
            <PhoneOff className="w-8 h-8" style={{ color: "#EF4444" }} />
          </div>
          <h3
            className="font-serif text-xl mb-2"
            style={{ color: THEME.text.primary }}
          >
            Leave Room?
          </h3>
          <p className="text-sm mb-6" style={{ color: THEME.text.muted }}>
            Are you sure you want to leave this room? You can always join back
            later.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: THEME.text.muted }}
            >
              Stay
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-80"
              style={{ background: "#EF4444", color: "#fff" }}
            >
              Leave Room
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ---- Sub-components ----

// 1. ParticleBackground
const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: {
      x: number;
      y: number;
      radius: number;
      speed: number;
      angle: number;
      opacity: number;
    }[] = [];
    const count = 80;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 1,
        speed: Math.random() * 0.5 + 0.1,
        angle: Math.random() * Math.PI * 2,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.angle += 0.01;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167, 139, 250, ${p.opacity})`;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${0.05 * (1 - distance / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

// 2. EnergyOrbs
const EnergyOrbs: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const orbs = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      size: 100 + Math.random() * 200,
      duration: 15 + Math.random() * 20,
      delay: Math.random() * 5,
      opacity: 0.02 + Math.random() * 0.03,
    }));
  }, [count]);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full blur-3xl"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            background: `radial-gradient(circle, ${THEME.aurora.primary}, transparent)`,
            opacity: orb.opacity,
          }}
          animate={{
            x: [0, 30, -20, 10, 0],
            y: [0, -20, 30, -10, 0],
            scale: [1, 1.1, 0.9, 1.05, 1],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

// 3. ActiveSpeakerAvatarEffect
// High-visibility "HelloTalk-style" active-speaker treatment.
// It uses the existing realtime isSpeaking/audioLevel state and does not invent
// new backend events. The effect is intentionally obvious but lightweight.
const ActiveSpeakerAvatarEffect: React.FC<{
  speaking: boolean;
  level: number;
  size: number;
}> = ({ speaking, level, size }) => {
  const safeLevel = Math.max(0, Math.min(1, level || 0));
  if (!speaking) return null;

  const intensity = 0.45 + safeLevel * 0.55;

  return (
    <>
      {/* Soft aura */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -12,
          background: `radial-gradient(circle, rgba(167,139,250,${0.18 * intensity}) 0%, rgba(124,106,255,${0.1 * intensity}) 42%, transparent 72%)`,
          filter: "blur(4px)",
        }}
        animate={{
          scale: [0.92, 1.08 + safeLevel * 0.12, 0.96, 1.12, 0.92],
          opacity: [0.55, 1, 0.7, 0.95, 0.55],
        }}
        transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Outer breathing ring */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -7,
          border: `2px solid rgba(167,139,250,${0.65 * intensity})`,
          boxShadow: `0 0 ${18 + safeLevel * 22}px rgba(167,139,250,${0.42 * intensity})`,
        }}
        animate={{
          scale: [1, 1.16 + safeLevel * 0.1, 1],
          opacity: [0.95, 0.18, 0.95],
        }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeOut" }}
      />

      {/* Fast inner pulse */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -3,
          border: "2px solid rgba(110,231,183,.95)",
        }}
        animate={{
          scale: [1, 1.07 + safeLevel * 0.06, 1],
          opacity: [1, 0.35, 1],
        }}
        transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Four sound-wave arcs */}
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="absolute rounded-full pointer-events-none"
          style={{
            width: size + 18 + i * 8,
            height: size + 18 + i * 8,
            left: -(9 + i * 4),
            top: -(9 + i * 4),
            border: `1px solid rgba(167,139,250,${0.42 - i * 0.07})`,
          }}
          animate={{
            scale: [0.88, 1.02, 1.12],
            opacity: [0.55, 0.28, 0],
          }}
          transition={{
            duration: 1.35,
            delay: i * 0.2,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </>
  );
};

// 3. ParticipantCard - Redesigned like HelloTalk
const ParticipantCard: React.FC<{
  participant: RoomParticipant;
  isHost: boolean;
  isCurrentUser?: boolean;
  isModerator?: boolean;
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
  onMute,
  onKick,
  onPromote,
  onFollow,
  onSendMessage,
  onViewProfile,
  size = "md",
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const hue = hueFromString(participant.name);
  const sizeMap = {
    sm: { avatar: 48, text: "text-xs", gap: "gap-1", nameSize: "text-xs" },
    md: { avatar: 64, text: "text-sm", gap: "gap-1.5", nameSize: "text-sm" },
    lg: { avatar: 80, text: "text-base", gap: "gap-2", nameSize: "text-base" },
  };
  const s = sizeMap[size];

  const countryFlag = getCountryFlag(participant.country);
  const isOnline = participant.isOnline !== false;
  const isMuted = participant.isMuted;

  const isSpeaking = Boolean(participant.isSpeaking) && !isMuted;
  const raisedHand = participant.raisedHand;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="relative flex flex-col items-center group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="cursor-pointer" onClick={onViewProfile}>
        <div className="relative">
          {/* Advanced active-speaker effect */}
          <ActiveSpeakerAvatarEffect
            speaking={isSpeaking}
            level={participant.audioLevel}
            size={s.avatar}
          />

          {/* Avatar */}
          <div
            className="relative rounded-full flex items-center justify-center font-semibold border-2 shadow-lg transition-all"
            style={{
              width: s.avatar,
              height: s.avatar,
              background: participant.avatarUrl
                ? `url(${participant.avatarUrl}) center/cover`
                : `hsl(${hue}, 50%, 22%)`,
              borderColor: isOnline
                ? isSpeaking
                  ? THEME.aurora.primary
                  : THEME.status.live
                : THEME.border,
              color: participant.avatarUrl ? "transparent" : THEME.text.primary,
              fontSize: s.avatar / 3,
              transform: isSpeaking
                ? `scale(${1 + Math.min(0.055, (participant.audioLevel || 0) * 0.055)})`
                : "scale(1)",
              boxShadow: isOnline
                ? isSpeaking
                  ? `0 0 ${34 + Math.round((participant.audioLevel || 0) * 24)}px rgba(167,139,250,.62), 0 0 12px rgba(110,231,183,.38)`
                  : `0 0 15px ${THEME.status.liveGlow}`
                : "none",
            }}
          >
            {!participant.avatarUrl && initials(participant.name)}
          </div>

          {/* Online indicator - Telegram style */}
          {isOnline && !isMuted && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
              style={{
                background: isSpeaking ? THEME.aurora.primary : "#22C55E",
                borderColor: THEME.surface,
              }}
            />
          )}

          {/* Muted indicator */}
          {isMuted && isOnline && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 flex items-center justify-center"
              style={{ background: "#4B5563", borderColor: THEME.surface }}
            >
              <MicOff className="w-1.5 h-1.5" style={{ color: "#9CA3AF" }} />
            </div>
          )}

          {/* Host crown */}
          {isHost && (
            <motion.div
              className="absolute -top-1 -right-1"
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Crown className="w-3.5 h-3.5 text-yellow-400 drop-shadow-lg" />
            </motion.div>
          )}

          {/* Raised hand */}
          {raisedHand && (
            <motion.div
              className="absolute -top-1 -left-1"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              <Hand className="w-3.5 h-3.5 text-yellow-400 drop-shadow-lg" />
            </motion.div>
          )}

          {/* Country flag */}
          <div className="absolute -bottom-0.5 -left-0.5 text-xs leading-none">
            {countryFlag}
          </div>

          {/* Live speech badge: makes the current speaker immediately identifiable */}
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-black tracking-wider whitespace-nowrap border"
              style={{
                background: "rgba(124,106,255,.96)",
                borderColor: "rgba(196,181,253,.65)",
                color: "#fff",
                boxShadow: "0 4px 14px rgba(124,106,255,.35)",
              }}
            >
              <span className="inline-flex items-center gap-1">
                <span className="flex items-end gap-[2px] h-2">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span
                      key={i}
                      className="w-[2px] rounded-full bg-white"
                      animate={{ height: ["3px", "8px", "4px", "7px", "3px"] }}
                      transition={{
                        duration: 0.55,
                        delay: i * 0.08,
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

          {/* You badge */}
          {isCurrentUser && !isSpeaking && (
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[7px] font-bold whitespace-nowrap"
              style={{ background: THEME.aurora.primary, color: "#fff" }}
            >
              You
            </div>
          )}
        </div>

        {/* Name and info - HelloTalk style */}
        <div className={`mt-1.5 text-center ${s.gap}`}>
          <span
            className={`${s.nameSize} font-medium truncate max-w-[70px] block`}
            style={{ color: THEME.text.primary }}
          >
            {participant.name}
          </span>

          {/* Language tags - HelloTalk style */}
          <div className="flex flex-col items-center gap-0.5 mt-0.5">
            {participant.nativeLanguage && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(167, 139, 250, 0.15)",
                  color: THEME.aurora.secondary,
                }}
              >
                {participant.nativeLanguage}
              </span>
            )}
            {participant.learningLanguage && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(110, 231, 183, 0.15)",
                  color: THEME.status.live,
                }}
              >
                {participant.learningLanguage}
              </span>
            )}
          </div>

          <span className="text-[8px]" style={{ color: THEME.text.muted }}>
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

      {/* Action buttons on hover - Telegram style */}
      {showActions && !isCurrentUser && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-0.5 p-1 rounded-xl backdrop-blur-xl border"
          style={{
            background: "rgba(20, 20, 37, 0.95)",
            borderColor: THEME.border,
          }}
        >
          <button
            onClick={() => {
              setIsFollowing(!isFollowing);
              onFollow?.();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
            title="Follow"
            style={{
              color: isFollowing ? THEME.aurora.primary : THEME.text.secondary,
            }}
          >
            <UserPlus className="w-3 h-3" />
          </button>
          <button
            onClick={onSendMessage}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
            title="Send Message"
            style={{ color: THEME.text.secondary }}
          >
            <MessageSquare className="w-3 h-3" />
          </button>
          {isModerator && (
            <>
              <button
                onClick={onMute}
                className="p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                title="Toggle Mute"
                style={{ color: THEME.text.secondary }}
              >
                <VolumeX className="w-3 h-3" />
              </button>
              <button
                onClick={onKick}
                className="p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                title="Kick"
                style={{ color: THEME.text.secondary }}
              >
                <UserX className="w-3 h-3" />
              </button>
              {!isHost && (
                <button
                  onClick={onPromote}
                  className="p-1.5 rounded-lg hover:bg-yellow-500/20 transition-all"
                  title="Make Host"
                  style={{ color: THEME.text.secondary }}
                >
                  <Crown className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

// 4. GlassMessage - Telegram/Messenger style with proper grouping
const GlassMessage: React.FC<{
  message: LocalVoiceMessage;
  isOwn: boolean;
  isHost: boolean;
  showHeader: boolean;
  isLastInGroup: boolean;
  onReply: () => void;
  onPin: () => void;
  onDelete: () => void;
  onKick: () => void;
  onMute: () => void;
  onTranslate?: () => void;
  onReaction?: (emoji: string) => void;
  onRetry?: () => void;
}> = ({
  message,
  isOwn,
  isHost,
  showHeader,
  isLastInGroup,
  onReply,
  onPin,
  onDelete,
  onKick,
  onMute,
  onTranslate,
  onReaction,
  onRetry,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const closeMenus = () => {
    setShowEmojiGrid(false);
    setShowMoreMenu(false);
  };

  if (message.isDeleted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1`}
      >
        <div className="px-3 py-2 rounded-xl backdrop-blur-sm border border-white/5">
          <p className="text-sm italic" style={{ color: THEME.text.muted }}>
            This message was deleted
          </p>
        </div>
      </motion.div>
    );
  }

  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";

  // Telegram-style corner treatment
  const tightCorner = isOwn ? "rounded-br-md" : "rounded-bl-md";
  const tailCorner = isOwn ? "rounded-br-sm" : "rounded-bl-sm";

  const reactionEntries = message.reactionTally
    ? Object.entries(message.reactionTally).filter(([, count]) => count > 0)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} ${
        showHeader ? "mt-3" : "mt-0.5"
      } mb-0.5 group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        closeMenus();
      }}
    >
      <div className="relative max-w-[85%]">
        <motion.div
          className={`relative px-4 py-2.5 rounded-2xl backdrop-blur-sm border transition-all ${
            message.isPinned
              ? "border-amber-500/30 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.1)]"
              : isOwn
                ? "border-purple-500/30 bg-purple-500/10"
                : "border-white/5 bg-white/5"
          } ${isLastInGroup ? tailCorner : tightCorner}`}
          style={{ opacity: isSending ? 0.65 : 1 }}
          whileHover={{ scale: 1.005 }}
        >
          {/* Pinned badge */}
          {message.isPinned && (
            <div className="flex items-center gap-1 text-xs font-medium text-amber-400 mb-1">
              <Pin className="w-3 h-3" /> Pinned
            </div>
          )}

          {/* Sender info - only for first bubble in group */}
          {showHeader && (
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-sm font-semibold"
                style={{
                  color: isOwn ? THEME.text.primary : THEME.aurora.secondary,
                }}
              >
                {message.sender?.name || "Unknown"}
              </span>
              {isHost && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
            </div>
          )}

          {/* Reply to - FIXED: Using replyTo object */}
          {message.replyTo && message.replyTo.sender && (
            <div
              className="mb-1.5 pl-2 border-l-2 text-xs"
              style={{
                borderColor: THEME.aurora.primary,
                color: THEME.text.muted,
              }}
            >
              <div
                className="font-medium"
                style={{ color: THEME.aurora.secondary }}
              >
                {message.replyTo.sender.name}
              </div>
              <span className="truncate block max-w-[220px]">
                {message.replyTo.content}
              </span>
            </div>
          )}

          {/* Message content */}
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap break-words"
            style={{ color: THEME.text.primary }}
          >
            {renderMessageContent(message.content)}
          </p>

          {/* Footer: timestamp + status */}
          <div className="mt-1 flex items-center justify-end gap-1.5">
            {isSending && (
              <span
                className="flex items-center gap-1 text-[10px]"
                style={{ color: THEME.text.muted }}
              >
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending
              </span>
            )}
            {isFailed && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 text-[10px] hover:underline"
                style={{ color: "#EF4444" }}
              >
                <RotateCcw className="w-2.5 h-2.5" /> Failed · Retry
              </button>
            )}
            <span className="text-[10px]" style={{ color: THEME.text.muted }}>
              {formatTime(message.createdAt)}
            </span>
            {isOwn && !isSending && !isFailed && (
              <CheckCheck
                className="w-3 h-3"
                style={{ color: THEME.aurora.tertiary }}
              />
            )}
          </div>
        </motion.div>

        {/* Reaction chips */}
        {reactionEntries.length > 0 && (
          <div
            className={`flex flex-wrap gap-1 mt-1 ${
              isOwn ? "justify-end" : "justify-start"
            }`}
          >
            {reactionEntries.map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReaction?.(emoji)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border hover:scale-110 transition-transform"
                style={{
                  background: "rgba(124, 106, 255, 0.12)",
                  borderColor: THEME.border,
                }}
              >
                <span>{emoji}</span>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: THEME.text.secondary }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Hover toolbar */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className={`absolute -top-9 ${isOwn ? "right-0" : "left-0"} z-20`}
            >
              <div
                className="flex items-center gap-0.5 p-1 rounded-full backdrop-blur-xl border shadow-lg"
                style={{
                  background: "rgba(20, 20, 37, 0.96)",
                  borderColor: THEME.border,
                }}
              >
                {["❤️", "🔥", "😂"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onReaction?.(emoji)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 hover:scale-110 transition-all text-sm"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}

                <button
                  onClick={() => {
                    setShowEmojiGrid((v) => !v);
                    setShowMoreMenu(false);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                  title="More reactions"
                  style={{
                    color: showEmojiGrid
                      ? THEME.aurora.primary
                      : THEME.text.secondary,
                  }}
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>

                <div
                  className="w-px h-4 mx-0.5"
                  style={{ background: THEME.border }}
                />

                <button
                  onClick={onReply}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                  title="Reply"
                  style={{ color: THEME.text.secondary }}
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(message.content || "");
                    toast.success("Copied to clipboard");
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                  title="Copy text"
                  style={{ color: THEME.text.secondary }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                {(isHost || isOwn || onTranslate) && (
                  <button
                    onClick={() => {
                      setShowMoreMenu((v) => !v);
                      setShowEmojiGrid(false);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                    title="More actions"
                    style={{
                      color: showMoreMenu
                        ? THEME.aurora.primary
                        : THEME.text.secondary,
                    }}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Emoji grid */}
              <AnimatePresence>
                {showEmojiGrid && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute top-full mt-1 ${
                      isOwn ? "right-0" : "left-0"
                    } grid grid-cols-5 gap-0.5 p-1.5 rounded-xl backdrop-blur-xl border shadow-lg`}
                    style={{
                      background: "rgba(20, 20, 37, 0.96)",
                      borderColor: THEME.border,
                      width: 172,
                    }}
                  >
                    {[
                      "❤️",
                      "🔥",
                      "👏",
                      "🎉",
                      "😂",
                      "🥺",
                      "💯",
                      "✨",
                      "👍",
                      "🙏",
                    ].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReaction?.(emoji);
                          setShowEmojiGrid(false);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 hover:scale-125 transition-all text-base"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* More menu */}
              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute top-full mt-1 ${
                      isOwn ? "right-0" : "left-0"
                    } flex flex-col gap-0.5 p-1 rounded-xl backdrop-blur-xl border shadow-lg min-w-[160px]`}
                    style={{
                      background: "rgba(20, 20, 37, 0.96)",
                      borderColor: THEME.border,
                    }}
                  >
                    {onTranslate && (
                      <button
                        onClick={() => {
                          onTranslate();
                          setShowMoreMenu(false);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-all text-xs text-left"
                        style={{ color: THEME.text.secondary }}
                      >
                        <Languages className="w-3.5 h-3.5" /> Translate
                      </button>
                    )}
                    {isHost && (
                      <button
                        onClick={() => {
                          onPin();
                          setShowMoreMenu(false);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-all text-xs text-left"
                        style={{
                          color: message.isPinned
                            ? "#FCD34D"
                            : THEME.text.secondary,
                        }}
                      >
                        <Pin className="w-3.5 h-3.5" />{" "}
                        {message.isPinned ? "Unpin" : "Pin message"}
                      </button>
                    )}
                    {isHost && (
                      <button
                        onClick={() => {
                          onMute();
                          setShowMoreMenu(false);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-all text-xs text-left"
                        style={{ color: THEME.text.secondary }}
                      >
                        <VolumeX className="w-3.5 h-3.5" /> Mute sender
                      </button>
                    )}
                    {isHost && (
                      <button
                        onClick={() => {
                          onKick();
                          setShowMoreMenu(false);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-all text-xs text-left"
                        style={{ color: THEME.text.secondary }}
                      >
                        <UserX className="w-3.5 h-3.5" /> Remove sender
                      </button>
                    )}
                    {(isOwn || isHost) && (
                      <button
                        onClick={() => {
                          onDelete();
                          setShowMoreMenu(false);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-all text-xs text-left"
                        style={{ color: "#EF4444" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete message
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// 5. DateSeparator - Telegram style
const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center my-3 select-none">
    <span
      className="text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-sm border"
      style={{
        color: THEME.text.muted,
        borderColor: THEME.border,
        background: "rgba(20, 20, 37, 0.6)",
      }}
    >
      {label}
    </span>
  </div>
);

// 6. AdvancedAudioControls
const AdvancedAudioControls: React.FC<{
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onLeave: () => void;
  isHost: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecording?: boolean;
}> = ({
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  volume,
  onVolumeChange,
  onLeave,
  isHost,
  onStartRecording,
  onStopRecording,
  isRecording,
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border"
      style={{
        background: "rgba(20, 20, 37, 0.8)",
        borderColor: THEME.border,
        boxShadow: "0 0 30px rgba(0,0,0,0.3)",
      }}
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggleMute}
        className="relative p-1.5 rounded-full transition-all"
        style={{
          background: isMuted
            ? "rgba(239, 68, 68, 0.2)"
            : "rgba(110, 231, 183, 0.15)",
        }}
      >
        {isMuted ? (
          <MicOff className="w-4 h-4 text-red-400" />
        ) : (
          <Mic className="w-4 h-4 text-green-400" />
        )}
        {!isMuted && (
          <motion.span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-500"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.button>

      <div
        className="relative flex items-center"
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        <button
          onClick={onToggleDeafen}
          className="p-1 rounded-full hover:bg-white/5 transition-colors"
          style={{
            color: isDeafened ? THEME.text.muted : THEME.text.secondary,
          }}
        >
          {isDeafened ? (
            <VolumeOff className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>

        <AnimatePresence>
          {showVolumeSlider && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 60 }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden"
            >
              <input
                type="range"
                min="0"
                max="100"
                value={isDeafened ? 0 : volume}
                onChange={(e) => onVolumeChange(parseInt(e.target.value))}
                className="w-16 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${THEME.aurora.primary} ${isDeafened ? 0 : volume}%, ${THEME.border} ${isDeafened ? 0 : volume}%)`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-px h-5" style={{ background: THEME.border }} />

      {isHost && (
        <>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isRecording ? onStopRecording : onStartRecording}
            className="p-1 rounded-full hover:bg-white/5 transition-colors relative"
            style={{ color: isRecording ? "#EF4444" : THEME.text.muted }}
            title={isRecording ? "Stop Recording" : "Start Recording"}
          >
            {isRecording ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                <Circle className="w-3.5 h-3.5" />
              </motion.div>
            ) : (
              <Circle className="w-3.5 h-3.5" />
            )}
          </motion.button>
          <div className="w-px h-5" style={{ background: THEME.border }} />
        </>
      )}

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
          toast.success("📋 Room link copied!");
        }}
        className="p-1 rounded-full hover:bg-white/5 transition-colors"
        style={{ color: THEME.text.muted }}
        title="Share Room"
      >
        <Share2 className="w-3.5 h-3.5" />
      </motion.button>

      <div className="w-px h-5" style={{ background: THEME.border }} />

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onLeave}
        className="p-1.5 rounded-full transition-colors hover:bg-red-500/20"
        style={{ color: "#EF4444" }}
        title="Leave Room"
      >
        <PhoneOff className="w-4 h-4" />
      </motion.button>
    </div>
  );
};

// ============================
// ADVANCED ROOM UX COMPONENTS
// These components are additive: they do not replace the existing room,
// participant, chat, moderation, LiveKit or recording functionality.
// ============================

const ConnectionHealth: React.FC<{
  socketConnected: boolean;
  liveKitConnected: boolean;
  isMockMode?: boolean;
}> = ({ socketConnected, liveKitConnected, isMockMode }) => {
  const healthy = socketConnected && liveKitConnected;
  return (
    <div
      className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px]"
      style={{
        background: healthy ? "rgba(110,231,183,.08)" : "rgba(251,191,36,.08)",
        borderColor: healthy ? "rgba(110,231,183,.2)" : "rgba(251,191,36,.2)",
        color: healthy ? THEME.status.live : THEME.status.waiting,
      }}
      title={`Socket: ${socketConnected ? "connected" : "offline"} · Audio: ${liveKitConnected ? "connected" : "offline"}`}
    >
      {healthy ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>
        {isMockMode ? "Demo audio" : healthy ? "Connected" : "Reconnecting"}
      </span>
    </div>
  );
};

const AudioLevelMeter: React.FC<{ level: number; muted: boolean }> = ({
  level,
  muted,
}) => {
  const safe = Math.max(0, Math.min(1, level || 0));
  return (
    <div
      className="flex items-center gap-1"
      title={muted ? "Microphone muted" : "Microphone level"}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-1 rounded-full transition-all duration-100"
          style={{
            height: `${5 + i * 2}px`,
            background:
              !muted && safe > i / 6 ? THEME.status.speaking : THEME.border,
            opacity: !muted && safe > i / 6 ? 1 : 0.7,
          }}
        />
      ))}
    </div>
  );
};

const SectionPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: string | number;
  active?: boolean;
  onClick?: () => void;
}> = ({ icon, label, value, active, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] transition-all hover:-translate-y-0.5"
    style={{
      background: active ? "rgba(124,106,255,.14)" : "rgba(255,255,255,.025)",
      borderColor: active ? "rgba(124,106,255,.45)" : THEME.border,
      color: active ? THEME.text.primary : THEME.text.muted,
    }}
  >
    {icon}
    <span>{label}</span>
    {value !== undefined && <strong>{value}</strong>}
  </button>
);

const RoomQualityPanel: React.FC<{
  socketConnected: boolean;
  liveKitConnected: boolean;
  isMockMode?: boolean;
  audioLevel: number;
  volume: number;
}> = ({
  socketConnected,
  liveKitConnected,
  isMockMode,
  audioLevel,
  volume,
}) => {
  const quality =
    socketConnected && liveKitConnected
      ? "Excellent"
      : socketConnected || liveKitConnected
        ? "Fair"
        : "Poor";
  return (
    <div
      className="absolute right-0 top-full mt-2 w-64 p-3 rounded-2xl border backdrop-blur-2xl shadow-2xl z-50"
      style={{ background: "rgba(15,15,28,.96)", borderColor: THEME.border }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p
            className="text-xs font-semibold"
            style={{ color: THEME.text.primary }}
          >
            Connection quality
          </p>
          <p className="text-[10px]" style={{ color: THEME.text.muted }}>
            Realtime room diagnostics
          </p>
        </div>
        <span
          className="text-[10px] font-semibold"
          style={{
            color:
              quality === "Excellent"
                ? THEME.status.live
                : THEME.status.waiting,
          }}
        >
          {quality}
        </span>
      </div>
      <div className="space-y-2 text-[10px]">
        <div className="flex justify-between">
          <span style={{ color: THEME.text.muted }}>Realtime socket</span>
          <span
            style={{ color: socketConnected ? THEME.status.live : "#EF4444" }}
          >
            {socketConnected ? "Connected" : "Offline"}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.text.muted }}>Voice transport</span>
          <span
            style={{ color: liveKitConnected ? THEME.status.live : "#EF4444" }}
          >
            {isMockMode ? "Demo" : liveKitConnected ? "Connected" : "Offline"}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.text.muted }}>Output volume</span>
          <span style={{ color: THEME.text.primary }}>{volume}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: THEME.text.muted }}>Mic level</span>
          <AudioLevelMeter level={audioLevel} muted={false} />
        </div>
      </div>
    </div>
  );
};

const EmptyParticipantState: React.FC<{ query?: string }> = ({ query }) => (
  <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
    <div
      className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 border"
      style={{ background: THEME.surface, borderColor: THEME.border }}
    >
      <UserRoundSearch
        className="w-7 h-7"
        style={{ color: THEME.aurora.secondary }}
      />
    </div>
    <p className="text-sm font-semibold" style={{ color: THEME.text.primary }}>
      {query ? "No matching participants" : "No participants found"}
    </p>
    <p className="text-xs mt-1 max-w-xs" style={{ color: THEME.text.muted }}>
      {query
        ? "Try another name, language or status filter."
        : "Participants will appear here when they join the room."}
    </p>
  </div>
);

const ShortcutPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.98 }}
    className="fixed inset-0 z-[80] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md"
    onClick={onClose}
  >
    <div
      className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
      style={{ background: THEME.surface, borderColor: THEME.border }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Keyboard
            className="w-4 h-4"
            style={{ color: THEME.aurora.secondary }}
          />
          <h3
            className="font-semibold text-sm"
            style={{ color: THEME.text.primary }}
          >
            Keyboard shortcuts
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/5"
          style={{ color: THEME.text.muted }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2">
        {[
          ["Ctrl / Cmd + Shift + M", "Mute / unmute microphone"],
          ["Ctrl / Cmd + Shift + H", "Raise your hand"],
          ["Enter", "Send chat message"],
          ["Shift + Enter", "New line in chat"],
          ["Esc", "Close chat / modal"],
        ].map(([key, action]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 rounded-xl px-3 py-2"
            style={{ background: "rgba(255,255,255,.025)" }}
          >
            <span className="text-xs" style={{ color: THEME.text.secondary }}>
              {action}
            </span>
            <kbd
              className="text-[9px] px-2 py-1 rounded-lg border whitespace-nowrap"
              style={{
                borderColor: THEME.border,
                color: THEME.text.primary,
                background: THEME.surfaceRaised,
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

// ============================
// ROOM COMMAND CENTER
// ============================
// A compact, high-density control surface for power users. It intentionally
// uses local UI state only; no new backend events are invented here.
const RoomCommandCenter: React.FC<{
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
  onToggleParticipants: () => void;
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
  onToggleParticipants,
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
      hint: "Ctrl/Cmd + Shift + M",
    },
    {
      label: isDeafened ? "Undeafen" : "Deafen",
      icon: isDeafened ? Volume2 : VolumeOff,
      active: isDeafened,
      onClick: onDeafen,
      hint: "Local output",
    },
    {
      label: soundEnabled ? "Sounds on" : "Sounds off",
      icon: soundEnabled ? Bell : BellOff,
      active: soundEnabled,
      onClick: onToggleSound,
      hint: "Notifications",
    },
    {
      label: showChat ? "Hide chat" : "Show chat",
      icon: MessageCircle,
      active: showChat,
      onClick: onToggleChat,
      hint: "Chat panel",
    },
    {
      label: showParticipants ? "Hide people" : "Show people",
      icon: Users,
      active: showParticipants,
      onClick: onToggleParticipants,
      hint: "Participant panel",
    },
    {
      label: showLiveStats ? "Hide stats" : "Show stats",
      icon: TrendingUp,
      active: showLiveStats,
      onClick: onToggleStats,
      hint: "Live metrics",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      className="absolute top-full right-0 mt-2 w-[min(92vw,360px)] rounded-3xl border p-3 shadow-2xl backdrop-blur-2xl z-[65]"
      style={{ background: "rgba(15,15,28,.97)", borderColor: THEME.border }}
    >
      <div className="flex items-center justify-between px-1 mb-3">
        <div>
          <p
            className="text-xs font-semibold"
            style={{ color: THEME.text.primary }}
          >
            Room controls
          </p>
          <p className="text-[9px]" style={{ color: THEME.text.muted }}>
            Everything you need without leaving the conversation
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/5"
          style={{ color: THEME.text.muted }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="rounded-2xl border px-2 py-2.5 text-left transition-all hover:-translate-y-0.5"
              style={{
                background: action.active
                  ? "rgba(124,106,255,.13)"
                  : "rgba(255,255,255,.025)",
                borderColor: action.active
                  ? "rgba(124,106,255,.35)"
                  : THEME.border,
              }}
              title={action.hint}
            >
              <Icon
                className="w-3.5 h-3.5 mb-2"
                style={{
                  color: action.active
                    ? THEME.aurora.secondary
                    : THEME.text.muted,
                }}
              />
              <span
                className="block text-[9px] leading-tight"
                style={{ color: THEME.text.secondary }}
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
          style={{ borderColor: THEME.border }}
        >
          <p
            className="text-[9px] uppercase tracking-wider font-semibold mb-2"
            style={{ color: THEME.text.muted }}
          >
            Moderation
          </p>
          <div className="flex gap-2">
            <span
              className="flex-1 px-2.5 py-2 rounded-xl text-[9px]"
              style={{ background: "rgba(245,158,11,.08)", color: "#FBBF24" }}
            >
              <ShieldCheck className="inline w-3 h-3 mr-1" />
              {isHost ? "Host controls enabled" : "Moderator controls enabled"}
            </span>
            {isHost && isRecording && (
              <span
                className="px-2.5 py-2 rounded-xl text-[9px]"
                style={{ background: "rgba(239,68,68,.08)", color: "#F87171" }}
              >
                <Radio className="inline w-3 h-3 mr-1" />
                Recording
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onRecord}
        disabled={!isHost}
        className="w-full mt-3 py-2 rounded-xl text-[10px] font-semibold border transition-all disabled:opacity-40"
        style={{
          borderColor: isRecording ? "rgba(239,68,68,.35)" : THEME.border,
          color: isRecording ? "#F87171" : THEME.text.secondary,
          background: isRecording ? "rgba(239,68,68,.07)" : "transparent",
        }}
      >
        {isRecording ? (
          <>
            <Circle className="inline w-3 h-3 mr-1.5 fill-current" />
            Recording active
          </>
        ) : (
          <>
            <Radio className="inline w-3 h-3 mr-1.5" />
            Start room recording
          </>
        )}
      </button>
    </motion.div>
  );
};

// ============================
// ACTIVE SPEAKER STRIP
// ============================
const ActiveSpeakerStrip: React.FC<{
  participants: any[];
  onSelect?: (id: string) => void;
}> = ({ participants, onSelect }) => {
  const speakers = participants.filter((p: any) => p.isSpeaking).slice(0, 6);
  if (!speakers.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin"
    >
      <span
        className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-semibold"
        style={{
          background: "rgba(167,139,250,.12)",
          color: THEME.aurora.secondary,
        }}
      >
        <Volume1 className="w-3 h-3" />
        Speaking now
      </span>
      {speakers.map((p: any) => (
        <button
          key={p.userId}
          onClick={() => onSelect?.(p.userId)}
          className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full border hover:bg-white/5 transition-all"
          style={{
            borderColor: "rgba(167,139,250,.25)",
            background: "rgba(255,255,255,.02)",
          }}
        >
          <span
            className="relative w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold"
            style={{
              background: p.avatarUrl
                ? `url(${p.avatarUrl}) center/cover`
                : `hsl(${hueFromString(p.name || "speaker")},50%,22%)`,
              color: "#fff",
            }}
          >
            {!p.avatarUrl && initials(p.name || "?")}
            <span
              className="absolute -right-0.5 -bottom-0.5 w-1.5 h-1.5 rounded-full border"
              style={{
                background: THEME.status.speaking,
                borderColor: THEME.surface,
              }}
            />
          </span>
          <span
            className="max-w-[90px] truncate text-[9px]"
            style={{ color: THEME.text.secondary }}
          >
            {p.name || "Anonymous"}
          </span>
        </button>
      ))}
    </motion.div>
  );
};

// ============================
// SESSION INSIGHTS
// ============================
const SessionInsights: React.FC<{
  totalParticipants: number;
  onlineParticipants: number;
  speakingCount: number;
  messages: number;
  duration: number;
  premium: number;
  verified: number;
  languages: string[];
}> = ({
  totalParticipants,
  onlineParticipants,
  speakingCount,
  messages,
  duration,
  premium,
  verified,
  languages,
}) => {
  const participation = totalParticipants
    ? Math.round((onlineParticipants / totalParticipants) * 100)
    : 0;
  const engagement = Math.min(
    100,
    Math.round(speakingCount * 25 + Math.min(messages, 40) * 1.5),
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        {
          label: "Presence",
          value: `${participation}%`,
          icon: Users,
          note: `${onlineParticipants} online`,
        },
        {
          label: "Engagement",
          value: `${engagement}%`,
          icon: Zap,
          note: `${speakingCount} speaking`,
        },
        {
          label: "Messages",
          value: messages,
          icon: MessageCircle,
          note: "room chat",
        },
        {
          label: "Duration",
          value: `${Math.floor(duration / 60)}m`,
          icon: Timer,
          note: `${duration % 60}s`,
        },
        { label: "Premium", value: premium, icon: Star, note: "members" },
        {
          label: "Verified",
          value: verified,
          icon: ShieldCheck,
          note: "members",
        },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-2xl border p-2.5"
            style={{
              background: "rgba(255,255,255,.02)",
              borderColor: THEME.border,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <Icon
                className="w-3 h-3"
                style={{ color: THEME.aurora.secondary }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: THEME.text.primary }}
              >
                {item.value}
              </span>
            </div>
            <p
              className="text-[9px] font-medium"
              style={{ color: THEME.text.secondary }}
            >
              {item.label}
            </p>
            <p className="text-[8px]" style={{ color: THEME.text.muted }}>
              {item.note}
            </p>
          </div>
        );
      })}
      <div
        className="col-span-2 rounded-2xl border p-2.5"
        style={{
          background: "rgba(255,255,255,.02)",
          borderColor: THEME.border,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[9px] font-medium"
            style={{ color: THEME.text.secondary }}
          >
            Languages detected
          </span>
          <Languages
            className="w-3 h-3"
            style={{ color: THEME.aurora.secondary }}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {languages.length ? (
            languages.map((lang) => (
              <span
                key={lang}
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(167,139,250,.1)",
                  color: THEME.text.secondary,
                }}
              >
                {lang}
              </span>
            ))
          ) : (
            <span className="text-[8px]" style={{ color: THEME.text.muted }}>
              No language data yet
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ---- Main VoiceRoomView Component ----
export const VoiceRoomView: React.FC<VoiceRoomViewProps> = ({
  roomId,
  onLeave,
  onMinimize,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

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
  const [showParticipants, setShowParticipants] = useState(true);
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
  const [showMobileTools, setShowMobileTools] = useState(false);
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

  // Data queries
  const { data: room, isLoading, refetch, error } = useVoiceRoom(roomId);
  const { data: initialMessages, isLoading: isLoadingMessages } =
    useRoomMessages(roomId);
  const sendMessageMutation = useSendVoiceMessage();
  const deleteMessageMutation = useDeleteVoiceMessage();
  const leaveRoomMutation = useLeaveVoiceRoom();

  // WebSocket hook
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
  } = useVoiceSocket(roomId, user?.id || "");

  // LiveKit hook
  const liveKitRoomId = room?.liveKitRoomId || "";
  const liveKitResult = useLiveKitRoom(liveKitRoomId, token, {
    onAudioLevel: (level) => setAudioLevel(level),
  });
  const {
    isConnected: isLiveKitConnected,
    participants: livekitParticipants = [],
    remoteTracks = {},
    participantVoiceStates = {},
    isMuted: liveKitIsMuted,
    toggleMute,
    isMockMode,
  } = liveKitResult;

  const isMuted = liveKitIsMuted;

  // Participants
  const allParticipants = useMemo(() => {
    const wsMap = new Map();
    (wsParticipants || []).forEach((p: any) => {
      wsMap.set(p.userId, {
        ...p,
        source: "ws",
        isSpeaking: false,
        isMuted: false,
        raisedHand: p.raisedHand || false,
        isOnline: true,
        isListening: true,
        audioLevel: 0,
      });
    });
    (room?.participants || []).forEach((p: any) => {
      if (!wsMap.has(p.userId)) {
        wsMap.set(p.userId, {
          ...p,
          source: "db",
          isSpeaking: false,
          isMuted: false,
          raisedHand: p.raisedHand || false,
          // A database participant is a room member, not proof of realtime presence.
          isOnline: false,
          isListening: false,
          audioLevel: 0,
          name: p.user?.name || "Anonymous",
          avatarUrl: p.user?.avatarUrl,
          country: p.user?.country,
          nativeLanguage: p.user?.nativeLanguage,
          learningLanguage: p.user?.learningLanguage,
          level: p.user?.level,
        });
      }
    });
    livekitParticipants?.forEach((p: any) => {
      const wsUser = wsMap.get(p.identity);

      if (!wsUser) return;

      const voiceState = participantVoiceStates?.[p.identity];

      wsUser.isOnline = true;

      wsUser.isMuted = Boolean(voiceState?.isMuted);

      // IMPORTANT:
      // remoteTracks means "has an audio track".
      // It does NOT mean "currently speaking".
      wsUser.isSpeaking = Boolean(
        voiceState?.isSpeaking && !voiceState?.isMuted,
      );

      wsUser.audioLevel = wsUser.isSpeaking
        ? Number(voiceState?.audioLevel || 0)
        : 0;
    });

    const currentUser = wsMap.get(user?.id);
    if (currentUser) {
      currentUser.isCurrentUser = true;
      currentUser.isOnline = isConnected || isLiveKitConnected;
      currentUser.isListening = currentUser.isOnline;
      currentUser.isSpeaking = audioLevel > 0.1;
      currentUser.audioLevel = audioLevel;
      currentUser.isMuted = isMuted;
    }
    return Array.from(wsMap.values());
  }, [
    wsParticipants,
    room?.participants,
    livekitParticipants,
    remoteTracks,
    user?.id,
    audioLevel,
    isMuted,
    isConnected,
    isLiveKitConnected,
  ]);

  const speakingCount = useMemo(() => {
    return allParticipants.filter((p: any) => p.isSpeaking).length;
  }, [allParticipants]);

  // Scroll to bottom
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

  // Load messages from database
  useEffect(() => {
    if (initialMessages) {
      console.log(`📥 Loaded ${initialMessages.length} messages from database`);
      const messagesWithStatus = [...initialMessages]
        .sort(
          (a: VoiceMessage, b: VoiceMessage) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .map((msg: VoiceMessage) => ({
          ...msg,
          status: "sent" as LocalMessageStatus,
        }));
      setMessages(messagesWithStatus);
      setTimeout(scrollToBottom, 100);
    }
  }, [initialMessages, scrollToBottom]);

  // Socket message history
  useEffect(() => {
    if (!socket) return;

    const handleMessageHistory = (historyMessages: VoiceMessage[]) => {
      if (historyMessages && historyMessages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = historyMessages
            .filter((m) => !existingIds.has(m.id))
            .map((m) => ({ ...m, status: "sent" as LocalMessageStatus }));
          if (newMessages.length > 0) {
            return [...prev, ...newMessages].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );
          }
          return prev;
        });
        setTimeout(scrollToBottom, 100);
      }
    };

    socket.on("voice:message-history", handleMessageHistory);
    return () => {
      socket.off("voice:message-history", handleMessageHistory);
    };
  }, [socket, scrollToBottom]);

  // Lightweight room activity clock for a polished live-status indicator.
  useEffect(() => {
    if (messages.length || speakingCount > 0 || allParticipants.length) {
      setLastActivityAt(Date.now());
    }
  }, [messages.length, speakingCount, allParticipants.length]);

  useEffect(() => {
    if (!sessionNotice) return;
    const timer = window.setTimeout(() => setSessionNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [sessionNotice]);

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

  // Retry logic
  useEffect(() => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      setRetryTimer(null);
    }
    if ((error || !room) && retryCount < maxRetries && !isLoading) {
      const delay = 1000 * (retryCount + 1);
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        refetch();
      }, delay);
      setRetryTimer(timer);
    }
    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        setRetryTimer(null);
      }
    };
  }, [error, room, retryCount, isLoading, refetch]);

  useEffect(() => {
    if (room) {
      setRetryCount(0);
      if (retryTimer) {
        clearTimeout(retryTimer);
        setRetryTimer(null);
      }
    }
  }, [room]);

  // Join room
  useEffect(() => {
    const getToken = async () => {
      if (!roomId) return;
      try {
        setIsJoining(true);
        const res = await voiceApi.joinRoom(roomId);
        setToken(res.data.token);
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to join room");
      } finally {
        setIsJoining(false);
      }
    };
    getToken();
  }, [roomId]);

  // Socket message handlers
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: VoiceMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }

        if (message.senderId === user?.id) {
          const tempIndex = prev.findIndex(
            (m) =>
              typeof m.id === "string" &&
              m.id.startsWith("temp-") &&
              m.senderId === message.senderId &&
              m.content === message.content,
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = {
              ...updated[tempIndex],
              ...message,
              status: "sent" as LocalMessageStatus,
            };
            return updated;
          }
        }

        if (!showChat) {
          setUnreadCount((prevCount) => prevCount + 1);
        }
        if (soundEnabled && (document.hidden || !showChat)) {
          playNotificationBeep();
        }

        const merged = [
          ...prev,
          { ...message, status: "sent" as LocalMessageStatus },
        ];
        merged.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return merged;
      });

      setTimeout(scrollToBottom, 50);
    };

    socket.on("voice:chat", handleNewMessage);
    return () => {
      socket.off("voice:chat", handleNewMessage);
    };
  }, [socket, showChat, user?.id, soundEnabled, scrollToBottom]);

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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showChat]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (durationIntervalRef.current)
        clearInterval(durationIntervalRef.current);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [retryTimer]);

  // Auto-scroll
  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setHasNewMessages(false);
      setNewMessageCount(0);
    } else if (messages.length > 0) {
      setHasNewMessages(true);
      setNewMessageCount((c) => c + 1);
    }
  }, [messages]);

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

  // ============================================================
  // FIX: Send message with proper reply handling
  // ============================================================
  const handleSendMessage = useCallback(() => {
    const content = newMessage.trim();
    if (!content || !user?.id) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Build the message data - FIX: Only include replyToId if it exists
    const messageData: {
      content: string;
      type: string;
      replyToId?: string;
    } = {
      content,
      type: "TEXT",
    };

    // Only add replyToId if replyTo exists and has an id
    if (replyTo && replyTo.id) {
      messageData.replyToId = replyTo.id;
    }

    // Create optimistic message
    const optimisticMessage: LocalVoiceMessage = {
      id: tempId,
      content,
      senderId: user.id,
      sender: {
        id: user.id,
        name: (user as any).name || "You",
        avatarUrl: (user as any).avatarUrl,
      } as any,
      createdAt: new Date().toISOString(),
      isPinned: false,
      isDeleted: false,
      replyTo: replyTo || undefined,
      replyToId: replyTo?.id,
      status: "sending",
    } as unknown as LocalVoiceMessage;

    setMessages((prev) => [...prev, optimisticMessage]);

    // Send via socket
    if (socket && isConnected) {
      sendChatMessage(messageData);
    }

    // Save to database via API
    sendMessageMutation.mutate(
      { roomId, ...messageData },
      {
        onSuccess: (res: any) => {
          const realMessage = res?.data || res;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...(realMessage || m),
                    status: "sent" as LocalMessageStatus,
                  }
                : m,
            ),
          );
          queryClient.invalidateQueries({
            queryKey: ["voice-messages", roomId],
          });
        },
        onError: (error) => {
          console.error("❌ Failed to save message:", error);
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
          );
          toast.error("Failed to send message");
        },
      },
    );

    setTimeout(scrollToBottom, 50);
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
    scrollToBottom,
  ]);

  // Retry failed message
  const handleRetryMessage = useCallback(
    (msg: LocalVoiceMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "sending" } : m)),
      );

      const messageData: {
        content: string;
        type: string;
        replyToId?: string;
      } = {
        content: msg.content,
        type: "TEXT",
      };

      if ((msg as any).replyToId) {
        messageData.replyToId = (msg as any).replyToId;
      }

      if (socket && isConnected) {
        sendChatMessage(messageData);
      }

      sendMessageMutation.mutate(
        { roomId, ...messageData },
        {
          onSuccess: (res: any) => {
            const realMessage = res?.data || res;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id ? { ...(realMessage || m), status: "sent" } : m,
              ),
            );
          },
          onError: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id && m.status === "sending"
                  ? { ...m, status: "failed" }
                  : m,
              ),
            );
            toast.error("Failed to send message");
          },
        },
      );
    },
    [socket, isConnected, sendChatMessage, sendMessageMutation, roomId],
  );

  // Send reaction
  const sendReaction = useCallback(
    (emoji: string) => {
      if (socket && isConnected) {
        socket.emit("voice:reaction", { roomId, emoji });
      }
      const id = `${Date.now()}-${Math.random()}`;
      setReactions((prev) => [...prev, { id, emoji }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2000);
    },
    [socket, isConnected, roomId],
  );

  // Message reaction
  const handleMessageReaction = useCallback(
    (messageId: string, emoji: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const tally = { ...(m.reactionTally || {}) };
          tally[emoji] = (tally[emoji] || 0) + 1;
          return { ...m, reactionTally: tally };
        }),
      );
      if (socket && isConnected) {
        socket.emit("voice:message-reaction", { roomId, messageId, emoji });
      }
    },
    [socket, isConnected, roomId],
  );

  const handleRaiseHand = () => {
    setIsRaisingHand(true);
    raiseHand(true);
    toast.success("✋ Hand raised!");
    setTimeout(() => setIsRaisingHand(false), 3000);
  };

  const handleLeave = () => {
    setShowLeaveConfirm(true);
  };

  const handleConfirmLeave = async () => {
    try {
      await leaveRoomMutation.mutateAsync(roomId);
      socket?.emit("voice:leave", {
        roomId,
        userId: user?.id,
      });
      toast.success("Left room");
      onLeave();
    } catch (error) {
      toast.error("Failed to leave room");
    }
  };

  const handleToggleMute = async () => {
    const muted = await toggleMute();

    if (socket && isConnected) {
      socket.emit("voice:mute-self", {
        roomId,
        muted,
      });
    }
  };

  const handleToggleDeafen = () => {
    setIsDeafened(!isDeafened);
    if (!isDeafened) {
      toast.info("🔇 Audio muted for all speakers");
    } else {
      toast.info("🔊 Audio restored");
    }
  };

  const handleStartRecording = async () => {
    try {
      await voiceApi.startRecording(roomId);
      setIsRecording(true);
      toast.success("🎙️ Recording started");
      refetch();
    } catch (error) {
      toast.error("Failed to start recording");
    }
  };

  const handleStopRecording = async () => {
    try {
      await voiceApi.stopRecording(roomId);
      setIsRecording(false);
      toast.success("⏹️ Recording stopped");
      refetch();
    } catch (error) {
      toast.error("Failed to stop recording");
    }
  };

  const handleMessageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setNewMessage(value);
      sendTyping(value.length > 0);
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = setTimeout(() => sendTyping(false), 2000);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [sendTyping],
  );

  const handleMessageKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  const toggleFavoriteParticipant = useCallback((participantId: string) => {
    setFavoriteParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  }, []);

  const copyRoomLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/voice/${roomId}`,
      );
      setSessionNotice("Room link copied to clipboard");
      toast.success("📋 Room link copied!");
    } catch {
      toast.error("Could not copy the room link");
    }
  }, [roomId]);

  const isHost = hostId === user?.id || room?.creatorId === user?.id;
  const isModerator =
    isHost ||
    allParticipants.some(
      (p: any) => p.userId === user?.id && p.role === "MODERATOR",
    );
  const totalParticipants = allParticipants.length;
  const onlineParticipants = useMemo(
    () => allParticipants.filter((p: any) => p.isOnline === true),
    [allParticipants],
  );

  const filteredParticipants = useMemo(() => {
    const query = participantSearch.trim().toLowerCase();
    return allParticipants
      .filter((p: any) => {
        const matchesQuery =
          !query ||
          [p.name, p.nativeLanguage, p.learningLanguage, p.country, p.level]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        if (!matchesQuery) return false;
        if (participantFilter === "online") return p.isOnline === true;
        if (participantFilter === "speaking") return p.isSpeaking === true;
        if (participantFilter === "raised") return p.raisedHand === true;
        return true;
      })
      .sort((a: any, b: any) => {
        if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [allParticipants, participantSearch, participantFilter]);

  const favoriteCount = favoriteParticipants.size;
  const roomLanguages = useMemo(() => {
    const set = new Set<string>();
    allParticipants.forEach((p: any) => {
      if (p.nativeLanguage) set.add(p.nativeLanguage);
      if (p.learningLanguage) set.add(p.learningLanguage);
    });
    return Array.from(set).slice(0, 8);
  }, [allParticipants]);

  const typingUsersNames = useMemo(() => {
    return Array.from(typingUsers)
      .map((id) => {
        const participant = allParticipants.find((p) => p.userId === id);
        return participant?.name || id;
      })
      .filter(Boolean);
  }, [typingUsers, allParticipants]);

  const filteredMessages = useMemo(() => {
    const sorted = [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    if (!chatSearch.trim()) return sorted;
    const q = chatSearch.toLowerCase();
    return sorted.filter(
      (m) =>
        m.content?.toLowerCase().includes(q) ||
        m.sender?.name?.toLowerCase().includes(q),
    );
  }, [messages, chatSearch]);

  // Build render items with date separators and grouping
  const renderItems = useMemo(() => {
    const items: Array<
      | { kind: "date"; key: string; label: string }
      | {
          kind: "message";
          key: string;
          message: LocalVoiceMessage;
          showHeader: boolean;
          isLastInGroup: boolean;
        }
    > = [];

    let lastDayKey: string | null = null;
    const GROUP_WINDOW_MS = 5 * 60 * 1000;

    filteredMessages.forEach((msg, i) => {
      const currentDayKey = dayKey(msg.createdAt);
      if (currentDayKey !== lastDayKey) {
        items.push({
          kind: "date",
          key: `date-${currentDayKey}-${i}`,
          label: formatDateSeparator(msg.createdAt),
        });
        lastDayKey = currentDayKey;
      }

      const prevMsg = filteredMessages[i - 1];
      const nextMsg = filteredMessages[i + 1];

      const sameSenderAsPrev =
        prevMsg &&
        prevMsg.senderId === msg.senderId &&
        currentDayKey === dayKey(prevMsg.createdAt) &&
        new Date(msg.createdAt).getTime() -
          new Date(prevMsg.createdAt).getTime() <
          GROUP_WINDOW_MS;

      const sameSenderAsNext =
        nextMsg &&
        nextMsg.senderId === msg.senderId &&
        currentDayKey === dayKey(nextMsg.createdAt) &&
        new Date(nextMsg.createdAt).getTime() -
          new Date(msg.createdAt).getTime() <
          GROUP_WINDOW_MS;

      items.push({
        kind: "message",
        key: String(msg.id),
        message: msg,
        showHeader: !sameSenderAsPrev,
        isLastInGroup: !sameSenderAsNext,
      });
    });

    return items;
  }, [filteredMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0) {
      setTimeout(scrollToBottom, 200);
    }
  }, [isLoadingMessages, messages.length, scrollToBottom]);

  // Loading state
  if (isLoading || isJoining || (retryCount < maxRetries && !room)) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: THEME.void, color: THEME.text.muted }}
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
              style={{ color: THEME.aurora.primary }}
            />
          </motion.div>
          <p className="text-sm" style={{ color: THEME.text.secondary }}>
            {retryCount > 0
              ? "⏳ Room is being prepared..."
              : isJoining
                ? "🎧 Joining the conversation..."
                : "Loading room..."}
          </p>
          {retryCount > 0 && retryCount < maxRetries && (
            <p className="text-xs mt-2" style={{ color: THEME.text.muted }}>
              Retrying... ({retryCount}/{maxRetries})
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // Room not found
  if (!room && retryCount >= maxRetries) {
    return (
      <div
        className="h-screen flex items-center justify-center px-6"
        style={{ background: THEME.void, color: THEME.text.muted }}
      >
        <div className="text-center max-w-sm">
          <AlertCircle
            className="w-12 h-12 mx-auto mb-4 opacity-50"
            style={{ color: THEME.text.muted }}
          />
          <h2
            className="text-2xl font-serif mb-2"
            style={{ color: THEME.text.primary }}
          >
            Room Not Found
          </h2>
          <p className="text-sm mb-6">
            {error
              ? "Unable to load this room. It may have been deleted or you don't have access."
              : "This room may have ended or the link is incorrect."}
          </p>
          <button
            onClick={onLeave}
            className="px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105"
            style={{ background: THEME.aurora.primary, color: "#fff" }}
          >
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: THEME.void, color: THEME.text.muted }}
      >
        <div className="text-center">
          <Loader2
            className="w-12 h-12 mx-auto mb-4 animate-spin"
            style={{ color: THEME.aurora.primary }}
          />
          <p className="text-sm" style={{ color: THEME.text.secondary }}>
            Loading room...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: THEME.void }}
    >
      <ParticleBackground />
      <EnergyOrbs count={4} />

      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 1, scale: 0.5, y: 0 }}
            animate={{ opacity: 0, scale: 1.5, y: -80 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="fixed pointer-events-none text-3xl z-50"
            style={{
              left: `${30 + Math.random() * 40}%`,
              top: `${30 + Math.random() * 40}%`,
            }}
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Top Bar - Clean and minimal like Telegram */}
      <header
        className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-2.5 border-b shrink-0 backdrop-blur-xl"
        style={{
          background: "rgba(20, 20, 37, 0.8)",
          borderColor: THEME.border,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
            }}
          >
            <Radio className="w-4 h-4 text-white" />
          </motion.div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2
                className="text-sm font-semibold truncate"
                style={{ color: THEME.text.primary }}
              >
                {room.name}
              </h2>
              <span
                className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{
                  background: isLiveKitConnected
                    ? "rgba(110, 231, 183, 0.15)"
                    : THEME.border,
                  color: isLiveKitConnected
                    ? THEME.status.live
                    : THEME.text.muted,
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isLiveKitConnected ? "animate-pulse" : ""}`}
                  style={{
                    background: isLiveKitConnected
                      ? THEME.status.live
                      : THEME.text.muted,
                  }}
                />
                {isLiveKitConnected
                  ? "Live"
                  : isMockMode
                    ? "Demo"
                    : "Connecting"}
              </span>
              {isHost && (
                <span
                  className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#FBBF24",
                  }}
                >
                  <Crown className="w-2.5 h-2.5" /> Host
                </span>
              )}
            </div>
            <div
              className="flex items-center gap-2 text-[10px]"
              style={{ color: THEME.text.muted }}
            >
              <span>{totalParticipants} participants</span>
              <span>·</span>
              <span>{speakingCount} speaking</span>
              <span>·</span>
              <span>{onlineParticipants.length} online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowChat(!showChat)}
            className="relative p-1.5 rounded-full hover:bg-white/5 transition-colors"
            style={{
              color: showChat ? THEME.aurora.primary : THEME.text.muted,
            }}
            title="Toggle Chat"
          >
            <MessageCircle className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-[8px] rounded-full flex items-center justify-center px-1 font-bold"
                style={{ background: "#EF4444", color: "#fff" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowCommandCenter((v) => !v)}
              className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
              style={{
                color: showCommandCenter
                  ? THEME.aurora.primary
                  : THEME.text.muted,
              }}
              title="Room controls"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showCommandCenter && (
                <RoomCommandCenter
                  isHost={isHost}
                  isModerator={isModerator}
                  isMuted={isMuted}
                  isDeafened={isDeafened}
                  soundEnabled={soundEnabled}
                  showChat={showChat}
                  showParticipants={showParticipants}
                  showLiveStats={showLiveStats}
                  isRecording={isRecording}
                  onMute={handleToggleMute}
                  onDeafen={handleToggleDeafen}
                  onToggleSound={() => setSoundEnabled((v) => !v)}
                  onToggleChat={() => setShowChat((v) => !v)}
                  onToggleParticipants={() => setShowParticipants((v) => !v)}
                  onToggleStats={() => setShowLiveStats((v) => !v)}
                  onRecord={
                    isRecording ? handleStopRecording : handleStartRecording
                  }
                  onClose={() => setShowCommandCenter(false)}
                />
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => {
              if (onMinimize) {
                onMinimize({
                  id: roomId,
                  name: room?.name || "Voice Room",
                  participants: allParticipants,
                  type: room?.type || "OPEN",
                  participantCount: totalParticipants,
                });
              }
            }}
            className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
            style={{ color: THEME.text.muted }}
            title="Minimize Room"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              copyRoomLink();
            }}
            className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
            style={{ color: THEME.text.muted }}
            title="Share Room"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <ConnectionHealth
            socketConnected={isConnected}
            liveKitConnected={isLiveKitConnected}
            isMockMode={isMockMode}
          />
          <div className="relative">
            <button
              onClick={() => setShowQualityPanel((v) => !v)}
              className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
              style={{
                color: showQualityPanel
                  ? THEME.aurora.primary
                  : THEME.text.muted,
              }}
              title="Connection quality"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showQualityPanel && (
                <RoomQualityPanel
                  socketConnected={isConnected}
                  liveKitConnected={isLiveKitConnected}
                  isMockMode={isMockMode}
                  audioLevel={audioLevel}
                  volume={volume}
                />
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setShowShortcuts(true)}
            className="hidden sm:block p-1.5 rounded-full hover:bg-white/5 transition-colors"
            style={{ color: THEME.text.muted }}
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Live Stats Bar - Collapsible */}
      <AnimatePresence>
        {showLiveStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-1.5 border-b backdrop-blur-sm"
            style={{
              borderColor: THEME.border,
              background: "rgba(20, 20, 37, 0.3)",
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
                  <span style={{ color: THEME.text.muted }}>{stat.label}:</span>
                  <span
                    className="font-medium"
                    style={{ color: THEME.text.primary }}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <main className="flex flex-1 min-h-0 relative z-10">
        {/* Participants Grid - HelloTalk style */}
        <section
          className={`flex-1 min-w-0 px-4 sm:px-6 py-4 transition-all duration-300 overflow-y-auto ${
            showChat ? "md:w-2/3" : "w-full"
          }`}
          style={{
            backgroundImage: `radial-gradient(ellipse 60% 40% at 50% 20%, ${THEME.gradient.from}, transparent 70%)`,
          }}
        >
          <ActiveSpeakerStrip participants={allParticipants} />

          {/* Participant intelligence toolbar */}
          <div
            className="mb-3 rounded-2xl border p-2.5 backdrop-blur-xl"
            style={{
              background: "rgba(20,20,37,.62)",
              borderColor: THEME.border,
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 mr-auto">
                <Users
                  className="w-3.5 h-3.5"
                  style={{ color: THEME.aurora.secondary }}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: THEME.text.primary }}
                >
                  People in room
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(110,231,183,.1)",
                    color: THEME.status.live,
                  }}
                >
                  {onlineParticipants.length} online
                </span>
              </div>
              <button
                onClick={() => setShowParticipantSearch((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-white/5"
                style={{
                  color: showParticipantSearch
                    ? THEME.aurora.primary
                    : THEME.text.muted,
                }}
                title="Search participants"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1">
                {(["all", "online", "speaking", "raised"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setParticipantFilter(f)}
                    className="px-2 py-1 rounded-full text-[9px] capitalize transition-all"
                    style={{
                      background:
                        participantFilter === f
                          ? "rgba(124,106,255,.18)"
                          : "transparent",
                      color:
                        participantFilter === f
                          ? THEME.text.primary
                          : THEME.text.muted,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <AnimatePresence>
              {showParticipantSearch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative mt-2">
                    <UserRoundSearch
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                      style={{ color: THEME.text.muted }}
                    />
                    <input
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      placeholder="Search by name, language, country or level..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
                      style={{
                        background: THEME.void,
                        borderColor: THEME.border,
                        color: THEME.text.primary,
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Language filter - HelloTalk style */}
          <div className="flex items-center gap-1.5 mb-4 px-1 flex-wrap">
            <span
              className="text-[10px] font-medium"
              style={{ color: THEME.text.muted }}
            >
              🌍 Languages:
            </span>
            {["All", "🇺🇸", "🇪🇸", "🇫🇷", "🇯🇵", "🇰🇷", "🇨🇳"].map((lang) => (
              <button
                key={lang}
                className="px-2 py-0.5 rounded-full text-[9px] transition-all hover:scale-105"
                style={{
                  background: THEME.surfaceHover,
                  color: THEME.text.secondary,
                  border: `1px solid ${THEME.border}`,
                }}
              >
                {lang}
              </button>
            ))}
          </div>

          <div
            className="mb-2 px-1 text-[9px]"
            style={{ color: THEME.text.muted }}
          >
            {filteredParticipants.length} shown · {favoriteCount} favorites
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {filteredParticipants.length === 0 ? (
              <EmptyParticipantState query={participantSearch} />
            ) : (
              filteredParticipants.map((p: any) => {
                const isParticipantHost =
                  hostId === p.userId || p.role === "HOST";
                const isCurrentUser = p.userId === user?.id;

                const participant: RoomParticipant = {
                  id: p.userId,
                  name: p.name || p.user?.name || "Anonymous",
                  avatarUrl: p.avatarUrl || p.user?.avatarUrl,
                  country: p.country || p.user?.country,
                  nativeLanguage: p.nativeLanguage || p.user?.nativeLanguage,
                  learningLanguage:
                    p.learningLanguage || p.user?.learningLanguage,
                  level: p.level || p.user?.level,
                  bio: p.bio || p.user?.bio,
                  interests: p.interests || p.user?.interests,
                  isOnline: p.isOnline === true,
                  isVerified: p.isVerified || p.user?.isVerified,
                  isPremium: p.isPremium || p.user?.isPremium,
                  isSpeaking: p.isSpeaking || false,
                  isMuted: Boolean(p.isMuted),
                  raisedHand: p.raisedHand || false,
                  joinedAt: p.joinedAt || new Date().toISOString(),
                  role: p.role || (isParticipantHost ? "HOST" : "MEMBER"),
                  isListening: p.isListening === true,
                  audioLevel: p.audioLevel || 0,
                  age: p.age || p.user?.age,
                  gender: p.gender || p.user?.gender,
                  timezone: p.timezone || p.user?.timezone,
                };

                return (
                  <ParticipantCard
                    key={p.userId}
                    participant={participant}
                    isHost={isParticipantHost}
                    isCurrentUser={isCurrentUser}
                    isModerator={isModerator}
                    onMute={() => muteUser(p.userId)}
                    onKick={() => kickUser(p.userId)}
                    onPromote={() => promoteHost(p.userId)}
                    onFollow={() => toast.success(`👋 Following ${p.name}`)}
                    onSendMessage={() => {
                      setShowChat(true);
                      setActiveTab("chat");
                      setNewMessage((prev) => (prev ? prev : `@${p.name} `));
                      toast.info(`💬 Send a message to ${p.name}`);
                    }}
                    onViewProfile={() =>
                      toast.info(`👤 Viewing ${p.name}'s profile`)
                    }
                    size="sm"
                  />
                );
              })
            )}

            {allParticipants.length === 0 && (
              <div className="col-span-full text-center py-12">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(167, 139, 250, 0.1)" }}
                >
                  <Users
                    className="w-8 h-8"
                    style={{ color: THEME.aurora.primary }}
                  />
                </div>
                <p className="text-sm" style={{ color: THEME.text.muted }}>
                  Waiting for participants...
                </p>
                <p className="text-xs mt-1" style={{ color: THEME.text.muted }}>
                  Share the room link to invite others
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Chat Sidebar - Telegram/HelloTalk style */}
        <AnimatePresence>
          {showChat && (
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, type: "spring", damping: 25 }}
              className="w-full md:w-[380px] border-l flex flex-col min-h-0 shrink-0 backdrop-blur-xl"
              style={{
                background: "rgba(20, 20, 37, 0.9)",
                borderColor: THEME.border,
              }}
            >
              {/* Chat Header */}
              <div
                className="px-4 py-2 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: THEME.border }}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("chat")}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1.5`}
                    style={{
                      background:
                        activeTab === "chat"
                          ? THEME.aurora.primary
                          : "transparent",
                      color: activeTab === "chat" ? "#fff" : THEME.text.muted,
                    }}
                  >
                    <MessageCircle className="w-3 h-3" />
                    Chat
                    <span
                      className="text-[8px] px-1 py-0.5 rounded-full"
                      style={{
                        background:
                          activeTab === "chat"
                            ? "rgba(255,255,255,0.2)"
                            : THEME.border,
                      }}
                    >
                      {messages.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("participants")}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1.5`}
                    style={{
                      background:
                        activeTab === "participants"
                          ? THEME.aurora.primary
                          : "transparent",
                      color:
                        activeTab === "participants"
                          ? "#fff"
                          : THEME.text.muted,
                    }}
                  >
                    <Users className="w-3 h-3" />
                    People
                    <span
                      className="text-[8px] px-1 py-0.5 rounded-full"
                      style={{
                        background:
                          activeTab === "participants"
                            ? "rgba(255,255,255,0.2)"
                            : THEME.border,
                      }}
                    >
                      {totalParticipants}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {activeTab === "chat" && (
                    <button
                      onClick={() => setShowChatSearch((v) => !v)}
                      className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                      style={{
                        color: showChatSearch
                          ? THEME.aurora.primary
                          : THEME.text.muted,
                      }}
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowChat(false)}
                    className="p-1 rounded hover:bg-white/5 transition-colors"
                    style={{ color: THEME.text.muted }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat Search */}
              <AnimatePresence>
                {activeTab === "chat" && showChatSearch && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-3 py-1.5 border-b shrink-0"
                    style={{ borderColor: THEME.border }}
                  >
                    <div className="relative">
                      <Search
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3"
                        style={{ color: THEME.text.muted }}
                      />
                      <input
                        autoFocus
                        type="text"
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        placeholder="Search messages..."
                        className="w-full pl-7 pr-3 py-1 rounded-full text-xs outline-none border"
                        style={{
                          background: "rgba(10, 10, 18, 0.5)",
                          color: THEME.text.primary,
                          borderColor: THEME.border,
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {activeTab === "chat" ? (
                <>
                  {/* Typing indicator */}
                  {typingUsers.size > 0 && (
                    <div
                      className="px-4 py-1 text-xs italic border-b"
                      style={{
                        color: THEME.text.muted,
                        borderColor: THEME.border,
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="flex gap-0.5">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <motion.span
                              key={i}
                              className="w-1 h-1 rounded-full"
                              style={{ background: THEME.aurora.primary }}
                              animate={{ y: [0, -4, 0] }}
                              transition={{
                                duration: 0.6,
                                delay: i * 0.15,
                                repeat: Infinity,
                              }}
                            />
                          ))}
                        </span>
                        {typingUsersNames.length > 0 && (
                          <span>
                            {typingUsersNames.join(", ")}{" "}
                            {typingUsersNames.length === 1 ? "is" : "are"}{" "}
                            typing...
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Messages - Telegram/WhatsApp style */}
                  <div
                    ref={chatScrollRef}
                    onScroll={handleChatScroll}
                    className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: `${THEME.border} transparent`,
                    }}
                  >
                    {isLoadingMessages && messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2
                          className="w-6 h-6 animate-spin"
                          style={{ color: THEME.aurora.primary }}
                        />
                      </div>
                    ) : renderItems.length > 0 ? (
                      renderItems.map((item) =>
                        item.kind === "date" ? (
                          <DateSeparator key={item.key} label={item.label} />
                        ) : (
                          <GlassMessage
                            key={item.key}
                            message={item.message}
                            isOwn={item.message.senderId === user?.id}
                            isHost={isHost}
                            showHeader={item.showHeader}
                            isLastInGroup={item.isLastInGroup}
                            onReply={() => setReplyTo(item.message)}
                            onPin={() =>
                              pinMessage(
                                item.message.id,
                                !item.message.isPinned,
                              )
                            }
                            onDelete={() => {
                              if (socket && isConnected) {
                                deleteSocketMessage(item.message.id);
                              } else {
                                deleteMessageMutation.mutate({
                                  roomId,
                                  messageId: item.message.id,
                                });
                              }
                            }}
                            onKick={() => kickUser(item.message.senderId)}
                            onMute={() => muteUser(item.message.senderId)}
                            onTranslate={() =>
                              toast.info("🌐 Translation coming soon")
                            }
                            onReaction={(emoji) =>
                              handleMessageReaction(
                                String(item.message.id),
                                emoji,
                              )
                            }
                            onRetry={() => handleRetryMessage(item.message)}
                          />
                        ),
                      )
                    ) : chatSearch.trim() ? (
                      <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <p
                          className="text-sm"
                          style={{ color: THEME.text.muted }}
                        >
                          No messages match "{chatSearch}"
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                          style={{ background: "rgba(167, 139, 250, 0.1)" }}
                        >
                          <MessageCircle
                            className="w-8 h-8"
                            style={{ color: THEME.aurora.primary }}
                          />
                        </div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: THEME.text.primary }}
                        >
                          No messages yet
                        </p>
                        <p
                          className="text-xs mt-1"
                          style={{ color: THEME.text.muted }}
                        >
                          Be the first to start the conversation ✨
                        </p>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Jump to latest */}
                  <AnimatePresence>
                    {hasNewMessages && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        onClick={scrollToBottom}
                        className="self-center mb-1.5 px-3 py-1 rounded-full text-[10px] font-medium flex items-center gap-1.5 shrink-0 mx-auto"
                        style={{
                          background: THEME.aurora.primary,
                          color: "#fff",
                          boxShadow: `0 0 20px ${THEME.borderGlow}`,
                        }}
                      >
                        <ArrowDown className="w-3 h-3" />
                        {newMessageCount > 0
                          ? `${newMessageCount} new message${newMessageCount > 1 ? "s" : ""}`
                          : "New messages"}
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Reply Bar */}
                  <AnimatePresence>
                    {replyTo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-3 py-1.5 border-t flex items-center justify-between shrink-0"
                        style={{
                          borderColor: THEME.border,
                          background: "rgba(20, 20, 37, 0.5)",
                        }}
                      >
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          <Reply
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: THEME.aurora.primary }}
                          />
                          <div className="min-w-0">
                            <div
                              className="text-[9px] font-mono uppercase tracking-wider"
                              style={{ color: THEME.text.muted }}
                            >
                              Replying to {replyTo.sender?.name}
                            </div>
                            <span
                              className="text-xs truncate block max-w-[180px]"
                              style={{ color: THEME.text.secondary }}
                            >
                              {replyTo.content}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setReplyTo(null)}
                          className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                          style={{ color: THEME.text.muted }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Input Bar - Telegram style */}
                  <div
                    className="p-2.5 border-t flex gap-2 items-end shrink-0"
                    style={{ borderColor: THEME.border }}
                  >
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1.5 rounded-full hover:bg-white/5 transition-colors shrink-0"
                      style={{ color: THEME.text.muted }}
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={newMessage}
                      onChange={handleMessageInputChange}
                      onKeyDown={handleMessageKeyDown}
                      maxLength={2000}
                      placeholder="Type a message..."
                      className="flex-1 min-w-0 px-3 py-2 rounded-2xl text-sm outline-none transition-all border resize-none leading-normal"
                      style={{
                        background: "rgba(10, 10, 18, 0.5)",
                        color: THEME.text.primary,
                        borderColor: THEME.border,
                        maxHeight: 100,
                      }}
                    />

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="p-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
                        color: "#fff",
                      }}
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* Emoji Picker */}
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-2 border-t flex flex-wrap gap-1"
                        style={{
                          borderColor: THEME.border,
                          background: "rgba(10, 10, 18, 0.5)",
                        }}
                      >
                        {[
                          "😊",
                          "😂",
                          "❤️",
                          "🔥",
                          "👍",
                          "👏",
                          "🙏",
                          "🎉",
                          "😍",
                          "🤔",
                          "😭",
                          "🥺",
                          "💯",
                          "✨",
                          "🌟",
                          "🎊",
                          "🚀",
                          "💪",
                          "🤗",
                          "🥰",
                          "😎",
                          "🤩",
                          "😇",
                          "🤣",
                          "🥳",
                          "😘",
                          "🤝",
                          "🌍",
                          "🎯",
                          "💡",
                          "🌈",
                          "⭐",
                          "💎",
                          "🎵",
                          "🎶",
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              setNewMessage((prev) => prev + emoji);
                              setShowEmojiPicker(false);
                              textareaRef.current?.focus();
                            }}
                            className="p-1 hover:bg-white/10 rounded-lg text-lg transition-all hover:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <>
                  {/* Participants List - HelloTalk style */}
                  <AnimatePresence>
                    {audioLevel > 0.045 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mx-3 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border"
                        style={{
                          background: "rgba(110,231,183,.08)",
                          borderColor: "rgba(110,231,183,.28)",
                        }}
                        aria-live="polite"
                      >
                        <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-300" />
                        <span className="text-[10px] font-semibold text-emerald-300">
                          Your microphone is picking up your voice
                        </span>
                        <div
                          className="ml-auto flex items-end gap-[2px] h-3"
                          aria-hidden="true"
                        >
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <motion.span
                              key={i}
                              className="w-[2px] rounded-full bg-emerald-300"
                              animate={{
                                height: `${Math.max(3, 3 + audioLevel * (6 + i * 2))}px`,
                              }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="space-y-1.5">
                      {allParticipants.map((p: any) => {
                        const isParticipantHost =
                          hostId === p.userId || p.role === "HOST";
                        const isCurrentUser = p.userId === user?.id;
                        const countryFlag = getCountryFlag(
                          p.country || p.user?.country,
                        );
                        return (
                          <div
                            key={p.userId}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
                            onClick={() =>
                              toast.info(`👤 Viewing ${p.name}'s profile`)
                            }
                          >
                            <div className="relative">
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                                style={{
                                  background: p.avatarUrl
                                    ? `url(${p.avatarUrl}) center/cover`
                                    : `hsl(${hueFromString(p.name)}, 50%, 22%)`,
                                  color: p.avatarUrl
                                    ? "transparent"
                                    : THEME.text.primary,
                                }}
                              >
                                {!p.avatarUrl && initials(p.name)}
                              </div>
                              {p.isSpeaking && (
                                <>
                                  <motion.span
                                    className="absolute -inset-1 rounded-full pointer-events-none"
                                    animate={{
                                      scale: [0.9, 1.22, 0.9],
                                      opacity: [0.7, 0, 0.7],
                                    }}
                                    transition={{
                                      duration: 1,
                                      repeat: Infinity,
                                    }}
                                    style={{
                                      border: `1.5px solid ${THEME.aurora.primary}`,
                                      boxShadow: `0 0 12px ${THEME.aurora.primary}88`,
                                    }}
                                  />
                                  <span
                                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border animate-pulse"
                                    style={{
                                      background: THEME.status.speaking,
                                      borderColor: THEME.surface,
                                      boxShadow: `0 0 8px ${THEME.status.speaking}`,
                                    }}
                                  />
                                </>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-sm font-medium truncate"
                                  style={{ color: THEME.text.primary }}
                                >
                                  {p.name}
                                </span>
                                {isParticipantHost && (
                                  <Crown className="w-3 h-3 text-yellow-400" />
                                )}
                                {isCurrentUser && (
                                  <span
                                    className="text-[7px] px-1 py-0.5 rounded-full"
                                    style={{
                                      background: THEME.aurora.primary,
                                      color: "#fff",
                                    }}
                                  >
                                    You
                                  </span>
                                )}
                                <span className="text-sm">{countryFlag}</span>
                              </div>
                              <div
                                className="flex items-center gap-2 text-[9px]"
                                style={{ color: THEME.text.muted }}
                              >
                                {p.nativeLanguage && (
                                  <span>{p.nativeLanguage}</span>
                                )}
                                {p.learningLanguage && (
                                  <span>→ {p.learningLanguage}</span>
                                )}
                                {p.level && <span>· {p.level}</span>}
                              </div>
                            </div>
                            <div className="flex gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavoriteParticipant(p.userId);
                                }}
                                className="p-1 rounded-lg hover:bg-white/10 transition-all"
                                style={{
                                  color: favoriteParticipants.has(p.userId)
                                    ? THEME.aurora.quaternary
                                    : THEME.text.muted,
                                }}
                                title={
                                  favoriteParticipants.has(p.userId)
                                    ? "Remove favorite"
                                    : "Favorite participant"
                                }
                              >
                                <Star
                                  className="w-3 h-3"
                                  fill={
                                    favoriteParticipants.has(p.userId)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowChat(true);
                                  setActiveTab("chat");
                                  toast.info(`💬 Send a message to ${p.name}`);
                                }}
                                className="p-1 rounded-lg hover:bg-white/10 transition-all"
                                style={{ color: THEME.text.muted }}
                              >
                                <MessageSquare className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Control Bar - Clean and minimal */}
      <footer
        className="relative z-10 px-4 py-2 border-t flex items-center justify-center gap-3 shrink-0 flex-wrap backdrop-blur-xl"
        style={{
          background: "rgba(20, 20, 37, 0.8)",
          borderColor: THEME.border,
        }}
      >
        <div
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full border"
          style={{
            borderColor: THEME.border,
            background: "rgba(255,255,255,.02)",
          }}
        >
          <Mic
            className="w-3 h-3"
            style={{
              color: isMuted ? THEME.text.muted : THEME.status.speaking,
            }}
          />
          <AudioLevelMeter level={audioLevel} muted={isMuted} />
        </div>

        <AdvancedAudioControls
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isDeafened={isDeafened}
          onToggleDeafen={handleToggleDeafen}
          volume={volume}
          onVolumeChange={setVolume}
          onLeave={handleLeave}
          isHost={isHost}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          isRecording={isRecording}
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRaiseHand}
          disabled={isRaisingHand}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs transition-all disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, #FCD34D, #F59E0B)`,
            color: "#0A0A12",
            boxShadow: "0 0 20px rgba(251, 191, 36, 0.15)",
          }}
        >
          <Hand className="w-3.5 h-3.5" />
          {isRaisingHand ? "Raised!" : "Raise Hand"}
        </motion.button>

        <div className="flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-full border hover:bg-white/5 transition-all"
            style={{ borderColor: THEME.border, color: THEME.text.muted }}
            title="Live Translation"
          >
            <Languages className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-full border hover:bg-white/5 transition-all"
            style={{ borderColor: THEME.border, color: THEME.text.muted }}
            title="Send Gift"
            onClick={() => toast.info("🎁 Gift feature coming soon!")}
          >
            <Gift className="w-3.5 h-3.5" />
          </motion.button>
          <button
            onClick={() => setShowRoomDetails((v) => !v)}
            className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
            style={{
              color: showRoomDetails ? THEME.aurora.primary : THEME.text.muted,
            }}
            title="Room details"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowLiveStats(!showLiveStats)}
            className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
            style={{
              color: showLiveStats ? THEME.aurora.primary : THEME.text.muted,
            }}
            title="Live Stats"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* Mobile Quick Actions */}
      <div className="md:hidden fixed bottom-20 right-4 z-20 flex flex-col gap-2">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleRaiseHand}
          className="p-2.5 rounded-full shadow-lg"
          style={{ background: THEME.aurora.quaternary, color: THEME.void }}
        >
          <Hand className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleToggleMute}
          className="p-2.5 rounded-full shadow-lg"
          style={{
            background: isMuted
              ? "rgba(239, 68, 68, 0.2)"
              : THEME.aurora.primary,
            color: isMuted ? "#EF4444" : "#fff",
          }}
        >
          {isMuted ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {sessionNotice && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[75] px-4 py-2 rounded-full border shadow-xl backdrop-blur-xl text-xs"
            style={{
              background: "rgba(20,20,37,.94)",
              borderColor: THEME.border,
              color: THEME.text.primary,
            }}
          >
            <span className="inline-flex items-center gap-2">
              <CheckCheck
                className="w-3.5 h-3.5"
                style={{ color: THEME.status.live }}
              />
              {sessionNotice}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShortcuts && (
          <ShortcutPanel onClose={() => setShowShortcuts(false)} />
        )}
      </AnimatePresence>

      <LeaveConfirmationModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleConfirmLeave}
      />

      <AnimatePresence>
        {showRoomDetails && (
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed right-4 bottom-20 z-30 w-72 rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl"
            style={{
              background: "rgba(20,20,37,.95)",
              borderColor: THEME.border,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p
                  className="text-xs font-semibold"
                  style={{ color: THEME.text.primary }}
                >
                  Room details
                </p>
                <p className="text-[9px]" style={{ color: THEME.text.muted }}>
                  Live session overview
                </p>
              </div>
              <button
                onClick={() => setShowRoomDetails(false)}
                style={{ color: THEME.text.muted }}
              >
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
                value={Math.floor(roomDuration / 60)}
              />
              <SectionPill
                icon={<MessageCircle className="w-3 h-3" />}
                label="Messages"
                value={messages.length}
              />
            </div>
            <SessionInsights
              totalParticipants={totalParticipants}
              onlineParticipants={onlineParticipants.length}
              speakingCount={speakingCount}
              messages={messages.length}
              duration={roomDuration}
              premium={allParticipants.filter((p: any) => p.isPremium).length}
              verified={allParticipants.filter((p: any) => p.isVerified).length}
              languages={roomLanguages}
            />
            <div className="space-y-2 text-[10px] mt-3">
              <div className="flex justify-between">
                <span style={{ color: THEME.text.muted }}>Languages</span>
                <span style={{ color: THEME.text.secondary }}>
                  {roomLanguages.length
                    ? roomLanguages.join(", ")
                    : "Not specified"}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: THEME.text.muted }}>
                  Session activity
                </span>
                <span style={{ color: THEME.text.secondary }}>
                  {Math.max(
                    0,
                    Math.floor((Date.now() - lastActivityAt) / 1000),
                  )}
                  s ago
                </span>
              </div>
              <button
                onClick={copyRoomLink}
                className="w-full mt-2 py-2 rounded-xl border text-[10px] font-semibold hover:bg-white/5"
                style={{
                  borderColor: THEME.border,
                  color: THEME.text.secondary,
                }}
              >
                <Copy className="inline w-3 h-3 mr-1.5" />
                Copy room link
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-24 left-4 z-20 hidden md:block">
        <div className="text-[9px] text-slate-500/60 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
          ⌘+⇧+M mute · Enter send · Esc close chat
        </div>
      </div>

      {/* Room info - HelloTalk style */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-16 left-4 z-20 hidden lg:block"
      >
        <div
          className="p-2.5 rounded-xl backdrop-blur-xl border max-w-[180px]"
          style={{
            background: "rgba(20, 20, 37, 0.8)",
            borderColor: THEME.border,
          }}
        >
          <div className="text-[10px] space-y-0.5">
            <div
              className="flex items-center gap-1.5"
              style={{ color: THEME.text.secondary }}
            >
              <Globe className="w-3 h-3" />
              <span>{room.nativeLanguage || "English"}</span>
              <span>→</span>
              <span>{room.learningLanguage || "Spanish"}</span>
            </div>
            <div style={{ color: THEME.text.muted }}>
              ⭐ {allParticipants.filter((p: any) => p.isPremium).length}{" "}
              Premium
            </div>
            <div style={{ color: THEME.text.muted }}>
              🏆 {allParticipants.filter((p: any) => p.isVerified).length}{" "}
              Verified
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/*
 * Active-speaker UX upgrade:
 * - Multi-ring breathing aura around the speaker profile.
 * - Expanding sound-wave rings synchronized to the speaking state.
 * - Strong avatar glow + subtle scale response to audioLevel.
 * - Animated "SPEAKING" badge with live equalizer bars.
 * - Room-level "Speaking now" banner for instant identification.
 * - Participant-list pulse indicator.
 * - Removed Math.random() from remote speaker level visualization so the UI
 *   stays stable across React renders.
 *
 * The effect relies only on the existing useLiveKitRoom/useVoiceSocket state.
 * Real remote amplitude can be wired into participant.audioLevel later if the
 * LiveKit hook exposes per-participant RMS/volume levels.
 */

/*
 * FULL REALTIME VOICE UX UPDATE
 *
 * This file intentionally preserves the complete original VoiceRoomView.
 * The update adds a truthful local microphone signal, speaker effects and
 * diagnostics without replacing the original room implementation.
 *
 * IMPORTANT:
 * - getUserMedia here is used only as a visual microphone meter.
 * - The actual room audio transport remains the existing LiveKit/WebSocket
 *   implementation in this source.
 * - Remote speaking state must come from the existing voice transport.
 * - No Math.random() should ever be used to represent microphone activity.
 *
 * If the local microphone meter reacts but remote users do not see the
 * speaker effect, the next files to repair are the LiveKit/voice hooks.
 */
