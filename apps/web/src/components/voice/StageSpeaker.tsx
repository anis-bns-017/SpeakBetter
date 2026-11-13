// apps/web/src/components/voice/StageSpeaker.tsx

import React, {
  useState,
  useEffect,
  useRef,
} from "react";
import {
  useVoiceRoom,
  useAddToStage,
  useRemoveFromStage,
  useVoiceSocket,
} from "../../hooks/useVoice";
import { useAuth } from "../../contexts/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Hand,
  Crown,
  Mic,
  MicOff,
  X,
  UserPlus,
  ArrowLeft,
  Users,
  ShieldCheck,
  Radio,
  Headphones,
  UserX,
  Loader2,
  Check,
  Share2,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Crown as CrownIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../../lib/utils";
import { tr } from "../../i18n/core";

// ---- Types ----
interface StageSpeakerProps {
  roomId: string;
  onLeave?: () => void;
  onShare?: () => void;
  className?: string;
}

interface Speaker {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  isLive: boolean;
  isHost: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  joinedAt: string;
  speakingTime: number;
  raisedHand: boolean;
}

interface Listener {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  raisedHand: boolean;
  joinedAt: string;
  isVerified?: boolean;
  isPremium?: boolean;
  country?: string;
}

// ---- Theme ----
const THEME = {
  void: "var(--sx-bg-page-0a0a12)",
  surface: "var(--sx-bg-card-141425)",
  surfaceRaised: "var(--sx-bg-raised-1e1e38)",
  surfaceHover: "var(--sx-bg-hover-2a2a4a)",
  border: "var(--sx-border-2a2a4a)",
  borderGlow: "var(--sx-accent-120-80-255-200)",
  aurora: {
    primary: "var(--sx-accent-7c6aff)",
    secondary: "var(--sx-accent-a78bfa)",
    tertiary: "var(--sx-accent-6ee7b7)",
    quaternary: "var(--sx-accent-fcd34d)",
    pink: "var(--sx-accent-f472b6)",
    cyan: "var(--sx-accent-67e8f9)",
    purple: "var(--sx-accent-8b5cf6)",
  },
  gradient: {
    from: "var(--sx-bg-124-106-255-150)",
    to: "var(--sx-bg-167-139-250-50)",
  },
  text: {
    primary: "var(--sx-text-f8f7ff)",
    secondary: "var(--sx-text-b8b0d8)",
    muted: "var(--sx-text-7a72a0)",
    accent: "var(--sx-text-a78bfa)",
  },
  status: {
    live: "var(--sx-accent-6ee7b7)",
    liveGlow: "var(--sx-accent-110-231-183-300)",
    speaking: "var(--sx-accent-a78bfa)",
    speakingGlow: "var(--sx-accent-167-139-250-400)",
    waiting: "var(--sx-accent-fcd34d)",
    waitingGlow: "var(--sx-accent-252-211-77-300)",
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

// ---- Sub-Components ----

// Background Particles
const StageParticles: React.FC = () => {
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
    const count = 60;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.3 + 0.05,
        angle: Math.random() * Math.PI * 2,
        opacity: Math.random() * 0.3 + 0.05,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.angle += 0.005;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(170,162,228, ${p.opacity})`;
        ctx.fill();
      });

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
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

// Stage Spotlight
const StageSpotlight: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      animate={{
        opacity: isActive ? 1 : 0,
      }}
      transition={{ duration: 0.8 }}
      style={{
        background: `radial-gradient(ellipse 60% 40% at 50% 30%, color-mix(in srgb, ${THEME.aurora.primary} 6.7%, transparent), transparent 70%)`,
      }}
    />
  );
};

// Speaker Avatar with Glow
const SpeakerAvatar: React.FC<{
  name: string;
  isLive: boolean;
  isHost: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  size?: number;
  onRemove?: () => void;
  canRemove?: boolean;
  isPending?: boolean;
  speakingTime?: number;
  onMute?: () => void;
  onUnmute?: () => void;
}> = ({
  name,
  isLive,
  isHost,
  isSpeaking = false,
  isMuted = false,
  size = 80,
  onRemove,
  canRemove,
  isPending = false,
  speakingTime = 0,
  onMute,
  onUnmute,
}) => {
  const hue = hueFromString(name);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", damping: 20 }}
      className="flex flex-col items-center group relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="relative">
        {/* Glow Ring */}
        {isLive && (
          <motion.div
            className="absolute inset-[-6px] rounded-full"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${THEME.aurora.primary} 26.7%, transparent), transparent 70%)`,
              filter: "blur(8px)",
            }}
          />
        )}

        {/* Speaking Pulse */}
        {isSpeaking && (
          <motion.div
            className="absolute inset-[-4px] rounded-full border-2"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ borderColor: THEME.aurora.secondary }}
          />
        )}

        {/* Avatar */}
        <motion.div
          className="relative rounded-full flex items-center justify-center font-serif font-bold border-2 shadow-lg transition-all"
          style={{
            width: size,
            height: size,
            background: `hsl(${hue}, 50%, 22%)`,
            borderColor: isLive ? THEME.aurora.primary : THEME.border,
            color: THEME.text.primary,
            boxShadow: isLive ? `0 0 40px color-mix(in srgb, ${THEME.aurora.primary} 20%, transparent)` : "none",
            fontSize: size / 3,
            filter: isMuted ? "grayscale(0.5)" : "none",
            opacity: isMuted ? 0.6 : 1,
          }}
          whileHover={{ scale: 1.03 }}
        >
          {initials(name)}

          {/* Live Dot */}
          {isLive && (
            <motion.div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{
                background: THEME.status.live,
                borderColor: THEME.surface,
                boxShadow: `0 0 12px ${THEME.status.liveGlow}`,
              }}
            />
          )}

          {/* Muted indicator */}
          {isMuted && (
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2"
              style={{
                background: "#4B5563",
                borderColor: THEME.surface,
              }}
            >
              <MicOff className="w-2.5 h-2.5" style={{ color: "var(--sx-text-9ca3af)" }} />
            </div>
          )}
        </motion.div>

        {/* Crown for Host */}
        {isHost && (
          <motion.div
            className="absolute -top-2 -right-2"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Crown className="w-5 h-5 text-yellow-400 drop-shadow-lg" />
          </motion.div>
        )}

        {/* Speaking time badge */}
        {isSpeaking && speakingTime > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-medium whitespace-nowrap"
            style={{
              background: "rgba(170,162,228, 0.9)",
              color: "var(--sx-text-ffffff)",
            }}
          >
            {Math.floor(speakingTime / 60)}m {speakingTime % 60}s
          </motion.div>
        )}

        {/* Actions on hover */}
        <AnimatePresence>
          {showTooltip && canRemove && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -top-2 -right-2 flex gap-0.5"
            >
              {onMute && (
                <button
                  onClick={isMuted ? onUnmute : onMute}
                  className="p-1 rounded-full hover:bg-white/10 transition-all"
                  style={{
                    background: THEME.surfaceRaised,
                    border: `1px solid ${THEME.border}`,
                    color: isMuted ? THEME.aurora.tertiary : THEME.text.muted,
                  }}
                >
                  {isMuted ? (
                    <Mic className="w-3 h-3" />
                  ) : (
                    <MicOff className="w-3 h-3" />
                  )}
                </button>
              )}
              <button
                onClick={onRemove}
                disabled={isPending}
                className="p-1 rounded-full transition-all disabled:opacity-50"
                style={{
                  background: THEME.surfaceRaised,
                  border: `1px solid ${THEME.border}`,
                  color: THEME.text.muted,
                }}
              >
                {isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name */}
      <span
        className="text-sm font-medium mt-2 truncate max-w-[80px] text-center"
        style={{ color: THEME.text.primary }}
      >
        {name}
      </span>

      {/* Status */}
      <span
        className="text-[11px] flex items-center gap-1"
        style={{ color: isMuted ? THEME.text.muted : THEME.text.secondary }}
      >
        {isMuted ? (
          tr("🔇 Muted")
        ) : isSpeaking ? (
          <>
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              🔊
            </motion.span>
            {tr("speaking")}</>
        ) : isLive ? (
          tr("🎧 Listening")
        ) : (
          tr("💤 Away")
        )}
      </span>
    </motion.div>
  );
};

// Listener Card
const ListenerCard: React.FC<{
  listener: Listener;
  isModerator: boolean;
  isFull: boolean;
  isPending: boolean;
  onAddToStage: () => void;
  onKick: () => void;
}> = ({ listener, isModerator, isFull, isPending, onAddToStage, onKick }) => {
  const hue = hueFromString(listener.name);
  const hasRaisedHand = listener.raisedHand;
  const countryFlag = getCountryFlag(listener.country);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
        hasRaisedHand
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-white/5 hover:border-white/10",
      )}
      style={{
        background: hasRaisedHand
          ? "rgba(252, 211, 77, 0.05)"
          : "var(--sx-bg-255-255-255-20)",
      }}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
          style={{
            background: `hsl(${hue}, 40%, 22%)`,
            color: THEME.text.primary,
            border: hasRaisedHand
              ? `2px solid ${THEME.status.waiting}`
              : "none",
          }}
        >
          {initials(listener.name)}
        </div>
        {listener.isPremium && (
          <span className="absolute -top-0.5 -right-0.5 text-[8px]">⭐</span>
        )}
        {listener.isVerified && (
          <span className="absolute -bottom-0.5 -right-0.5 text-[8px]">✅</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium truncate"
            style={{ color: THEME.text.primary }}
          >
            {listener.name}
          </span>
          <span className="text-xs">{countryFlag}</span>
          {hasRaisedHand && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="flex items-center gap-1 text-[11px] font-medium"
              style={{ color: THEME.status.waiting }}
            >
              <Hand className="w-3 h-3" />
              {tr("waiting")}</motion.div>
          )}
        </div>
        <span className="text-[11px]" style={{ color: THEME.text.muted }}>
          {tr("Joined{value}", { value: " " })}{formatDistanceToNow(new Date(listener.joinedAt), {
            addSuffix: true,
          })}
        </span>
      </div>

      {/* Actions */}
      {isModerator && (
        <div className="flex items-center gap-1 shrink-0">
          {hasRaisedHand && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddToStage}
              disabled={isFull || isPending}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-40"
              style={{
                background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
                color: "var(--sx-text-ffffff)",
              }}
            >
              {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                tr("Bring Up")
              )}
            </motion.button>
          )}

          {!hasRaisedHand && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddToStage}
              disabled={isFull || isPending}
              className="p-2 rounded-full transition-colors hover:bg-white/5 disabled:opacity-40"
              style={{ color: THEME.text.muted }}
              title={tr("Invite to stage")}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onKick}
            className="p-2 rounded-full transition-colors hover:bg-red-500/20"
            style={{ color: THEME.text.muted }}
            title={tr("Remove from room")}
          >
            <UserX className="w-4 h-4" />
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const StageSpeaker: React.FC<StageSpeakerProps> = ({
  roomId,
  onLeave,
  onShare,
  className = "",
}) => {
  const { user } = useAuth();
  const { data: room, isLoading, refetch } = useVoiceRoom(roomId);
  const { socket } = useVoiceSocket(roomId, user?.id || "");
  const addToStage = useAddToStage();
  const removeFromStage = useRemoveFromStage();

  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [showHand, setShowHand] = useState(false);
  const [isRaisingHand, setIsRaisingHand] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRaised, setFilterRaised] = useState(false);
  const [showAudience, setShowAudience] = useState(true);
  const [speakerTimers, setSpeakerTimers] = useState<Record<string, number>>(
    {},
  );

  // Speaker timer
  useEffect(() => {
    if (!room) return;

    const speakers = room.stages?.[0]?.speakers || [];
    const interval = setInterval(() => {
      setSpeakerTimers((prev) => {
        const updated = { ...prev };
        speakers.forEach((userId: string) => {
          updated[userId] = (updated[userId] || 0) + 1;
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [room]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: THEME.void }}
      >
        <div className="text-center">
          <Loader2
            className="w-10 h-10 animate-spin mx-auto mb-3"
            style={{ color: THEME.aurora.primary }}
          />
          <p style={{ color: THEME.text.muted }}>{tr("Raising the curtain...")}</p>
        </div>
      </div>
    );
  }

  if (!room || room.type !== "STAGE") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: THEME.void }}
      >
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(170,162,228, 0.1)" }}
          >
            <Radio
              className="w-8 h-8"
              style={{ color: THEME.aurora.primary }}
            />
          </div>
          <h2
            className="text-2xl font-serif mb-2"
            style={{ color: THEME.text.primary }}
          >
            {tr("No Stage Here")}</h2>
          <p style={{ color: THEME.text.muted }}>
            {tr("This room isn't set up as a stage.")}</p>
          {onLeave && (
            <button
              onClick={onLeave}
              className="mt-6 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105"
              style={{ background: THEME.aurora.primary, color: "var(--sx-text-ffffff)" }}
            >
              {tr("Back to Rooms")}</button>
          )}
        </div>
      </div>
    );
  }

  const stage = room.stages?.[0];
  if (!stage) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: THEME.void }}
      >
        <p style={{ color: THEME.text.muted }}>
          {tr("The stage hasn't been built yet.")}</p>
      </div>
    );
  }

  const speakerIds = stage.speakers || [];
  const speakers = speakerIds
    .map((id: string) => {
      const participant = room.participants.find((p) => p.userId === id);
      if (!participant) return null;
      return {
        id: participant.id,
        userId: participant.userId,
        name: participant.user.name,
        avatarUrl: participant.user.avatarUrl,
        isLive: !participant.isMuted,
        isHost: participant.userId === room.creatorId,
        isSpeaking: !participant.isMuted,
        isMuted: participant.isMuted || false,
        joinedAt: participant.joinedAt,
        speakingTime: speakerTimers[id] || 0,
        raisedHand: participant.raisedHand || false,
      };
    })
    .filter(Boolean) as Speaker[];

  const listeners = room.participants
    .filter((p) => p.role === "LISTENER")
    .map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
      raisedHand: p.raisedHand || false,
      joinedAt: p.joinedAt,
      country: p.user.country,
      isVerified: p.user.isVerified,
      isPremium: p.user.isPremium,
    })) as Listener[];

  const isSpeaker = speakerIds.includes(user?.id || "");
  const isModerator = room.participants.some(
    (p) =>
      p.userId === user?.id &&
      (p.role === "MODERATOR" || p.userId === room.creatorId),
  );
  const isHost = room.creatorId === user?.id;
  const isFull = speakers.length >= 5;
  const raisedHandCount = listeners.filter((l) => l.raisedHand).length;

  // Filter listeners
  const query = searchQuery.toLowerCase();
  const filteredListeners = listeners.filter(
    (l) => (!query || l.name.toLowerCase().includes(query)) && (!filterRaised || l.raisedHand),
  );

  // Handlers
  const handleAddToStage = async (userId: string) => {
    if (isFull) {
      toast.error(tr("The stage is full — 5 speakers max"));
      return;
    }
    setPendingUserId(userId);
    try {
      await addToStage.mutateAsync({ roomId, userId });
      toast.success(tr("✨ Invited to the stage!"));
      refetch();
    } catch {
      toast.error(tr("Couldn't add them to the stage"));
    } finally {
      setPendingUserId(null);
    }
  };

  const handleRemoveFromStage = async (userId: string) => {
    setPendingUserId(userId);
    try {
      await removeFromStage.mutateAsync({ roomId, userId });
      toast.success(tr("Stepped off the stage"));
      refetch();
    } catch {
      toast.error(tr("Couldn't remove them from the stage"));
    } finally {
      setPendingUserId(null);
    }
  };

  const handleKickUser = async (_userId: string) => {
    try {
      toast.success(tr("User removed from room"));
      refetch();
    } catch {
      toast.error(tr("Failed to remove user"));
    }
  };

  const handleRaiseHand = () => {
    setIsRaisingHand(true);
    socket?.emit("voice:raise-hand", { roomId, raise: true });
    setShowHand(true);
    toast.success(tr("✋ Hand raised — you're in the queue!"));
    setTimeout(() => setIsRaisingHand(false), 2000);
  };

  const handleLowerHand = () => {
    socket?.emit("voice:raise-hand", { roomId, raise: false });
    setShowHand(false);
    toast.success(tr("Hand lowered"));
  };

  const handleMuteSpeaker = async (_userId: string) => {
    toast.success(tr("Speaker muted"));
    refetch();
  };

  const handleUnmuteSpeaker = async (_userId: string) => {
    toast.success(tr("Speaker unmuted"));
    refetch();
  };

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col relative overflow-hidden",
        className,
      )}
      style={{ background: THEME.void }}
    >
      {/* Background Effects */}
      <StageParticles />
      <StageSpotlight isActive={speakers.length > 0} />

      {/* Top Bar */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-4 border-b shrink-0 backdrop-blur-xl"
        style={{
          background: "var(--sx-bg-10-10-18-800)",
          borderColor: THEME.border,
        }}
      >
        <div className="flex items-center gap-4 min-w-0">
          {onLeave && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLeave}
              className="p-2 rounded-full transition-colors hover:bg-white/5 shrink-0"
              style={{ color: THEME.text.muted }}
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-mono tracking-wider uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5"
                style={{
                  background:
                    speakers.length > 0
                      ? "rgba(110, 231, 183, 0.15)"
                      : THEME.border,
                  color:
                    speakers.length > 0 ? THEME.status.live : THEME.text.muted,
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${speakers.length > 0 ? "animate-pulse" : ""}`}
                  style={{
                    background:
                      speakers.length > 0
                        ? THEME.status.live
                        : THEME.text.muted,
                  }}
                />
                {speakers.length > 0 ? tr("Live") : tr("Quiet")}
              </span>
              <span
                className="text-[11px] font-mono"
                style={{ color: THEME.text.muted }}
              >
                {stage.name || tr("Main Stage")}
              </span>
              {isModerator && (
                <span
                  className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{
                    background: "rgba(252, 211, 77, 0.15)",
                    color: "var(--sx-text-fcd34d)",
                  }}
                >
                  <ShieldCheck className="w-3 h-3" /> {" "}{tr("Moderator")}</span>
              )}
              {isHost && (
                <span
                  className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{
                    background: "rgba(251, 191, 36, 0.15)",
                    color: "var(--sx-text-fbbf24)",
                  }}
                >
                  <CrownIcon className="w-3 h-3" /> {" "}{tr("Host")}</span>
              )}
            </div>
            <h2
              className="text-xl font-serif truncate"
              style={{ color: THEME.text.primary }}
            >
              {room.name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border"
            style={{ color: THEME.text.muted, borderColor: THEME.border }}
          >
            <Users
              className="w-3.5 h-3.5"
              style={{ color: THEME.aurora.primary }}
            />
            <span style={{ color: THEME.aurora.primary }}>
              {speakers.length}
            </span>
            <span>/ 5</span>
            <span className="hidden sm:inline">{tr("speaking")}</span>
          </div>

          <div
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border"
            style={{ color: THEME.text.muted, borderColor: THEME.border }}
          >
            <Headphones className="w-3.5 h-3.5" />
            {listeners.length}
          </div>

          {raisedHandCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(252, 211, 77, 0.15)",
                color: "var(--sx-text-fcd34d)",
                border: "1px solid rgba(252, 211, 77, 0.2)",
              }}
            >
              <Hand className="w-3 h-3" />
              {raisedHandCount}
            </motion.div>
          )}

          {/* Share button */}
          {onShare && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onShare}
              className="p-2 rounded-full hover:bg-white/5 transition-colors"
              style={{ color: THEME.text.muted }}
            >
              <Share2 className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </header>

      {/* The Stage */}
      <section
        className="relative z-10 px-6 pt-12 pb-16 flex-1 overflow-y-auto"
        style={{ minHeight: "300px" }}
      >
        {speakers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(170,162,228, 0.1)" }}
            >
              <Mic
                className="w-10 h-10"
                style={{ color: THEME.aurora.primary }}
              />
            </div>
            <h3
              className="text-2xl font-serif mb-2"
              style={{ color: THEME.text.primary }}
            >
              {tr("The Stage is Empty")}</h3>
            <p style={{ color: THEME.text.muted }}>
              {isModerator
                ? tr("Invite a listener up when you're ready.")
                : tr("Waiting for a speaker to step up.")}
            </p>
            {isModerator && listeners.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const firstListener =
                    listeners.find((l) => l.raisedHand) || listeners[0];
                  if (firstListener) handleAddToStage(firstListener.userId);
                }}
                disabled={isFull}
                className="mt-6 px-6 py-3 rounded-full font-semibold text-sm transition-all"
                style={{
                  background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
                  color: "var(--sx-text-ffffff)",
                }}
              >
                <UserPlus className="w-4 h-4 inline mr-2" />
                {tr("Invite First Speaker")}</motion.button>
            )}
          </motion.div>
        ) : (
          <LayoutGroup>
            <motion.div
              layout
              className="flex flex-wrap justify-center items-start gap-8 max-w-4xl mx-auto"
            >
              {speakers.map((speaker) => {
                const canRemove = isModerator || speaker.userId === user?.id;
                const isCurrentUser = speaker.userId === user?.id;

                return (
                  <SpeakerAvatar
                    key={speaker.userId}
                    name={speaker.name}
                    isLive={speaker.isLive}
                    isHost={speaker.isHost}
                    isSpeaking={speaker.isSpeaking}
                    isMuted={speaker.isMuted}
                    size={96}
                    onRemove={
                      canRemove
                        ? () => handleRemoveFromStage(speaker.userId)
                        : undefined
                    }
                    canRemove={canRemove}
                    isPending={pendingUserId === speaker.userId}
                    speakingTime={speaker.speakingTime}
                    onMute={
                      isModerator && !isCurrentUser
                        ? () => handleMuteSpeaker(speaker.userId)
                        : undefined
                    }
                    onUnmute={
                      isModerator && !isCurrentUser
                        ? () => handleUnmuteSpeaker(speaker.userId)
                        : undefined
                    }
                  />
                );
              })}

              {/* Full indicator */}
              {isFull && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-2 border-dashed text-center"
                  style={{ borderColor: THEME.border }}
                >
                  <span className="text-xs" style={{ color: THEME.text.muted }}>
                    {tr("Stage Full")}</span>
                  <span
                    className="text-[11px]"
                    style={{ color: THEME.text.muted }}
                  >
                    🎤 5/5
                  </span>
                </motion.div>
              )}
            </motion.div>
          </LayoutGroup>
        )}
      </section>

      {/* Divider */}
      <div className="relative z-10 px-6">
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${THEME.aurora.primary}, transparent)`,
            opacity: 0.3,
          }}
        />
      </div>

      {/* Audience Section */}
      <section className="relative z-10 px-6 py-6 flex-1">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: THEME.text.muted }} />
            <h3 className="font-serif" style={{ color: THEME.text.primary }}>
              {tr("Audience")}</h3>
            <span
              className="text-xs font-mono"
              style={{ color: THEME.text.muted }}
            >
              ({listeners.length})
            </span>
            <button
              onClick={() => setShowAudience(!showAudience)}
              className="p-1 rounded hover:bg-white/5 transition-colors"
              style={{ color: THEME.text.muted }}
            >
              {showAudience ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {raisedHandCount > 0 && (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: THEME.status.waiting }}
              >
                <Hand className="w-3.5 h-3.5" />
                {raisedHandCount} {" "}{tr("waiting")}</motion.div>
            )}

            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3"
                style={{ color: THEME.text.muted }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr("Search audience...")}
                className="pl-8 pr-3 py-1.5 rounded-full text-xs outline-none border transition-all focus:border-purple-500"
                style={{
                  background: "var(--sx-bg-255-255-255-50)",
                  borderColor: THEME.border,
                  color: THEME.text.primary,
                }}
              />
            </div>

            <button
              onClick={() => setFilterRaised(!filterRaised)}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                filterRaised
                  ? "bg-amber-500/20 text-amber-400"
                  : "hover:bg-white/5",
              )}
              style={{ color: filterRaised ? "var(--sx-text-fcd34d)" : THEME.text.muted }}
              title={tr("Filter by raised hand")}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showAudience && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {listeners.length === 0 ? (
                <div className="text-center py-8">
                  <p style={{ color: THEME.text.muted }}>
                    {tr("No one in the audience yet.")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredListeners.map((listener) => (
                    <ListenerCard
                      key={listener.id}
                      listener={listener}
                      isModerator={isModerator}
                      isFull={isFull}
                      isPending={pendingUserId === listener.userId}
                      onAddToStage={() => handleAddToStage(listener.userId)}
                      onKick={() => handleKickUser(listener.userId)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Sticky Action Bar */}
      <footer
        className="relative z-10 px-6 py-4 border-t flex justify-center gap-3 shrink-0 backdrop-blur-xl flex-wrap"
        style={{
          background: "var(--sx-bg-10-10-18-800)",
          borderColor: THEME.border,
        }}
      >
        {!isSpeaker && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRaiseHand}
            disabled={isRaisingHand || showHand}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
              color: "var(--sx-text-ffffff)",
              boxShadow: `0 0 40px color-mix(in srgb, ${THEME.aurora.primary} 20%, transparent)`,
            }}
          >
            {isRaisingHand ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : showHand ? (
              <Check className="w-4 h-4" />
            ) : (
              <Hand className="w-4 h-4" />
            )}
            {showHand
              ? tr("Hand Raised ✋")
              : isRaisingHand
                ? tr("Raising...")
                : tr("Raise Hand")}
          </motion.button>
        )}

        {isSpeaker && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLowerHand}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm border transition-all"
            style={{
              borderColor: THEME.border,
              color: THEME.text.primary,
            }}
          >
            <X className="w-4 h-4" />
            {tr("Lower Hand")}</motion.button>
        )}

        {isModerator && (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const waiting = listeners.filter((l) => l.raisedHand);
                if (waiting.length > 0 && !isFull) {
                  handleAddToStage(waiting[0].userId);
                } else if (isFull) {
                  toast.error(tr("Stage is full"));
                } else {
                  toast.info(tr("No one has raised their hand"));
                }
              }}
              disabled={isFull}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm border transition-all disabled:opacity-40"
              style={{
                borderColor: THEME.aurora.primary,
                color: THEME.aurora.primary,
              }}
            >
              <UserPlus className="w-4 h-4" />
              {tr("Bring Next Up")}</motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (speakers.length === 0) {
                  toast.info(tr("No speakers on stage"));
                  return;
                }
                const lastSpeaker = speakers[speakers.length - 1];
                if (lastSpeaker) {
                  handleRemoveFromStage(lastSpeaker.userId);
                }
              }}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm border transition-all"
              style={{
                borderColor: "rgba(239, 68, 68, 0.3)",
                color: "var(--sx-text-ef4444)",
              }}
            >
              <UserX className="w-4 h-4" />
              {tr("Remove Last")}</motion.button>
          </>
        )}
      </footer>
    </div>
  );
};

export default StageSpeaker;
