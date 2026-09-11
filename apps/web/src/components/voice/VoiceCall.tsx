// apps/web/src/components/voice/VoiceCall.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  User,
  Users,
  Maximize2,
  Minimize2,
  Clock,
  Activity,
  X,
  Check,
  AlertCircle,
  Loader2,
  Signal,
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothOff,
  Headphones,
  Speaker,
  Settings,
  MoreVertical,
  Smile,
  Camera,
  Image,
  Gift,
  Circle,
  StopCircle,
  Download,
  Share2,
  Link,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Grid,
  List,
  Maximize,
  Minimize,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { useVoiceRoom, useLiveKitRoom, voiceApi } from "../../hooks/useVoice";
import { cn } from "../../lib/utils";

// ---- Types ----
interface VoiceCallProps {
  roomId: string;
  onEnd: () => void;
  isIncoming?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  callerName?: string;
  callerAvatar?: string;
  isVideo?: boolean;
  onToggleVideo?: () => void;
  onToggleScreenShare?: () => void;
  className?: string;
}

interface CallParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  joinedAt: string;
}

// ---- Theme ----
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
    speaking: "#A78BFA",
    speakingGlow: "rgba(167, 139, 250, 0.4)",
    danger: "#EF4444",
    warning: "#FCD34D",
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

// ---- Sub-Components ----

// Connection Quality Indicator
const ConnectionQuality: React.FC<{ quality: string }> = ({ quality }) => {
  const getQualityConfig = () => {
    switch (quality) {
      case "excellent":
        return { color: THEME.status.live, label: "Excellent", bars: 4 };
      case "good":
        return { color: THEME.aurora.tertiary, label: "Good", bars: 3 };
      case "fair":
        return { color: THEME.aurora.quaternary, label: "Fair", bars: 2 };
      case "poor":
        return { color: THEME.status.danger, label: "Poor", bars: 1 };
      default:
        return { color: THEME.text.muted, label: "Connecting...", bars: 1 };
    }
  };

  const config = getQualityConfig();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 h-3">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full"
            style={{
              height: `${[3, 6, 9, 12][i]}px`,
              background: i < config.bars ? config.color : THEME.border,
            }}
            animate={{
              opacity: i < config.bars ? 1 : 0.3,
            }}
          />
        ))}
      </div>
      <span className="text-[10px]" style={{ color: THEME.text.muted }}>
        {config.label}
      </span>
    </div>
  );
};

// Participant Video Tile
const VideoTile: React.FC<{
  participant: CallParticipant;
  isLocal?: boolean;
  isSpeaking?: boolean;
  className?: string;
}> = ({ participant, isLocal = false, isSpeaking = false, className = "" }) => {
  const hue = hueFromString(participant.name);

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden aspect-video",
        "border-2 transition-all",
        isSpeaking ? "border-purple-500/50" : "border-transparent",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 30%, 15%), hsl(${hue}, 30%, 8%))`,
        boxShadow: isSpeaking ? `0 0 30px ${THEME.aurora.primary}33` : "none",
      }}
    >
      {/* Video placeholder / avatar */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-2"
            style={{
              background: `hsl(${hue}, 50%, 25%)`,
              color: THEME.text.primary,
              border: isSpeaking
                ? `2px solid ${THEME.aurora.secondary}`
                : "none",
            }}
          >
            {initials(participant.name)}
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: THEME.text.primary }}
          >
            {participant.name}
            {isLocal && " (You)"}
          </p>
          {participant.isMuted && (
            <span
              className="text-xs flex items-center justify-center gap-1 mt-1"
              style={{ color: THEME.text.muted }}
            >
              <MicOff className="w-3 h-3" /> Muted
            </span>
          )}
          {isSpeaking && (
            <motion.div
              className="text-xs flex items-center justify-center gap-1 mt-1"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ color: THEME.aurora.secondary }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: THEME.aurora.secondary }}
              />
              Speaking
            </motion.div>
          )}
        </div>
      </div>

      {/* Status badges */}
      <div className="absolute top-2 left-2 flex gap-1">
        {participant.isVideoOn && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
          >
            📷
          </span>
        )}
        {participant.isScreenSharing && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
          >
            🖥️
          </span>
        )}
      </div>

      {/* Speaking indicator ring */}
      {isSpeaking && (
        <motion.div
          className="absolute inset-[-2px] rounded-xl pointer-events-none"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{
            border: `2px solid ${THEME.aurora.secondary}`,
            boxShadow: `0 0 40px ${THEME.aurora.secondary}44`,
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const VoiceCall: React.FC<VoiceCallProps> = ({
  roomId,
  onEnd,
  isIncoming = false,
  onAccept,
  onDecline,
  callerName,
  callerAvatar,
  isVideo = false,
  onToggleVideo,
  onToggleScreenShare,
  className = "",
}) => {
  const { user } = useAuth();
  const { data: room, isLoading } = useVoiceRoom(roomId);
  const [token, setToken] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(isVideo);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [volume, setVolume] = useState(80);
  const [audioLevel, setAudioLevel] = useState(0);

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get LiveKit token
  useEffect(() => {
    if (!roomId) return;

    const getToken = async () => {
      try {
        setIsConnecting(true);
        const res = await voiceApi.joinRoom(roomId);
        setToken(res.data.token);
        setIsCallActive(true);
        setIsConnecting(false);
        toast.success("🎧 Connected to call");
      } catch (error) {
        toast.error("Failed to join call");
        setIsConnecting(false);
        onEnd();
      }
    };

    if (!isIncoming) {
      getToken();
    }
  }, [roomId, isIncoming, onEnd]);

  // LiveKit connection
  const liveKitRoomId = room?.liveKitRoomId || "";
  const liveKitResult = useLiveKitRoom(
    token && liveKitRoomId ? liveKitRoomId : "",
    token,
    {
      onAudioLevel: (level: number) => setAudioLevel(level),
      onConnectionQuality: (quality: string) => setConnectionQuality(quality),
    },
  );

  const {
    isConnected,
    toggleMute,
    isMuted: liveKitIsMuted,
    error,
    participants: livekitParticipants,
    isMockMode,
  } = liveKitResult;

  // Sync mute state
  useEffect(() => {
    setIsMuted(liveKitIsMuted);
  }, [liveKitIsMuted]);

  // Call duration timer
  useEffect(() => {
    if (isCallActive) {
      durationIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [isCallActive]);

  // Build participants list
  const participants = useMemo<CallParticipant[]>(() => {
    const list: CallParticipant[] = [];

    // Add current user
    if (user) {
      list.push({
        id: user.id,
        name: user.name || "You",
        avatarUrl: (user as any).avatarUrl,
        isMuted: isMuted,
        isVideoOn: isVideoOn,
        isScreenSharing: isScreenSharing,
        isSpeaking: audioLevel > 0.1,
        audioLevel: audioLevel,
        joinedAt: new Date().toISOString(),
      });
    }

    // Add other participants from room
    if (room?.participants) {
      room.participants.forEach((p: any) => {
        if (p.userId !== user?.id) {
          const liveKitParticipant = livekitParticipants?.find(
            (lp: any) => lp.identity === p.userId,
          );

          list.push({
            id: p.userId,
            name: p.user?.name || "Unknown",
            avatarUrl: p.user?.avatarUrl,
            isMuted: p.isMuted || false,
            isVideoOn: false,
            isScreenSharing: false,
            isSpeaking: liveKitParticipant?.isSpeaking || false,
            audioLevel: liveKitParticipant?.audioLevel || 0,
            joinedAt: p.joinedAt || new Date().toISOString(),
          });
        }
      });
    }

    return list;
  }, [
    user,
    room,
    isMuted,
    isVideoOn,
    isScreenSharing,
    audioLevel,
    livekitParticipants,
  ]);

  const handleEndCall = useCallback(() => {
    setIsCallActive(false);
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    onEnd();
  }, [onEnd]);

  const handleAnswer = useCallback(() => {
    if (onAccept) onAccept();
    setIsCallActive(true);
    const getToken = async () => {
      try {
        const res = await voiceApi.joinRoom(roomId);
        setToken(res.data.token);
        toast.success("🎧 Connected to call");
      } catch (error) {
        toast.error("Failed to join call");
        onEnd();
      }
    };
    getToken();
  }, [onAccept, roomId, onEnd]);

  const handleDecline = useCallback(() => {
    if (onDecline) onDecline();
    onEnd();
  }, [onDecline, onEnd]);

  const handleToggleMute = useCallback(async () => {
    const muted = await toggleMute();
    setIsMuted(muted);
  }, [toggleMute]);

  const handleToggleVideo = useCallback(() => {
    const newState = !isVideoOn;
    setIsVideoOn(newState);
    if (onToggleVideo) onToggleVideo();
    toast.info(newState ? "📷 Video on" : "📷 Video off");
  }, [isVideoOn, onToggleVideo]);

  const handleToggleScreenShare = useCallback(() => {
    const newState = !isScreenSharing;
    setIsScreenSharing(newState);
    if (onToggleScreenShare) onToggleScreenShare();
    toast.info(
      newState ? "🖥️ Screen sharing started" : "🖥️ Screen sharing stopped",
    );
  }, [isScreenSharing, onToggleScreenShare]);

  const handleToggleDeafen = useCallback(() => {
    setIsDeafened(!isDeafened);
    toast.info(isDeafened ? "🔊 Audio restored" : "🔇 Audio muted");
  }, [isDeafened]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("📋 Call link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  }, []);

  if (isLoading || isConnecting) {
    return (
      <div
        className="flex items-center justify-center h-64"
        style={{ background: THEME.void }}
      >
        <div className="text-center">
          <Loader2
            className="w-10 h-10 animate-spin mx-auto mb-3"
            style={{ color: THEME.aurora.primary }}
          />
          <p style={{ color: THEME.text.muted }}>
            {isConnecting ? "Connecting to call..." : "Loading call..."}
          </p>
        </div>
      </div>
    );
  }

  if (!room && !isIncoming) {
    return (
      <div
        className="flex items-center justify-center h-64"
        style={{ background: THEME.void }}
      >
        <div className="text-center">
          <AlertCircle
            className="w-10 h-10 mx-auto mb-3"
            style={{ color: THEME.status.danger }}
          />
          <p style={{ color: THEME.text.muted }}>Call not found</p>
          <button
            onClick={onEnd}
            className="mt-3 px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: THEME.aurora.primary, color: "#fff" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const caller = room?.participants?.find((p: any) => p.userId !== user?.id);

  // Incoming call UI
  if (isIncoming) {
    return (
      <div
        className="flex flex-col items-center justify-center h-96 p-8 rounded-2xl border"
        style={{
          background: THEME.surface,
          borderColor: THEME.border,
        }}
      >
        <motion.div
          className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-4"
          style={{
            background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
            color: "#fff",
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {callerAvatar ? (
            <img
              src={callerAvatar}
              alt="Caller"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials(callerName || "?")
          )}
        </motion.div>

        <h2
          className="text-2xl font-bold"
          style={{ color: THEME.text.primary }}
        >
          {callerName || caller?.user?.name || "Unknown"}
        </h2>
        <p className="text-sm mt-1" style={{ color: THEME.text.muted }}>
          Incoming call...
        </p>

        <div className="flex items-center gap-4 mt-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDecline}
            className="p-4 rounded-full"
            style={{
              background: "rgba(239, 68, 68, 0.2)",
              color: THEME.status.danger,
            }}
          >
            <PhoneOff className="w-6 h-6" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAnswer}
            className="p-4 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${THEME.aurora.tertiary}, ${THEME.aurora.cyan})`,
              color: "#fff",
            }}
          >
            <Phone className="w-6 h-6" />
          </motion.button>
        </div>
      </div>
    );
  }

  // Active call UI
  return (
    <div
      className={cn(
        "flex flex-col h-full overflow-hidden rounded-2xl border",
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : "",
        className,
      )}
      style={{
        background: THEME.void,
        borderColor: THEME.border,
      }}
    >
      {/* Background Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${THEME.aurora.primary}08, transparent 70%)`,
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 px-4 py-3 border-b flex items-center justify-between shrink-0"
        style={{
          borderColor: THEME.border,
          background: `rgba(10, 10, 18, 0.8)`,
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: THEME.aurora.primary }}
            >
              <Phone className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: THEME.text.primary }}
              >
                {room?.name || "Voice Call"}
              </h3>
              <div
                className="flex items-center gap-2 text-[10px]"
                style={{ color: THEME.text.muted }}
              >
                <Clock className="w-3 h-3" />
                <span>{formatDuration(duration)}</span>
                <span>·</span>
                <ConnectionQuality quality={connectionQuality} />
                {isMockMode && (
                  <span
                    className="text-[8px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(252, 211, 77, 0.15)",
                      color: THEME.aurora.quaternary,
                    }}
                  >
                    Demo
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-all relative"
            style={{
              color: showParticipants ? THEME.aurora.primary : THEME.text.muted,
            }}
            title="Toggle participants"
          >
            <Users className="w-4 h-4" />
            {participants.length > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 text-[7px] rounded-full flex items-center justify-center px-1 font-bold"
                style={{ background: THEME.aurora.primary, color: "#fff" }}
              >
                {participants.length}
              </span>
            )}
          </button>

          <button
            onClick={handleFullscreen}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
            style={{ color: THEME.text.muted }}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-all"
            style={{ color: THEME.text.muted }}
            title="Copy link"
          >
            <Link className="w-4 h-4" />
          </button>

          <button
            onClick={handleEndCall}
            className="p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
            style={{ color: THEME.status.danger }}
            title="End call"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex min-h-0 p-4">
        {/* Video Grid */}
        <div
          className="flex-1 grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(participants.length, 2)}, 1fr)`,
          }}
        >
          {participants.map((p) => (
            <VideoTile
              key={p.id}
              participant={p}
              isLocal={p.id === user?.id}
              isSpeaking={p.isSpeaking}
            />
          ))}
          {participants.length === 0 && (
            <div className="flex items-center justify-center">
              <p style={{ color: THEME.text.muted }}>
                Waiting for participants...
              </p>
            </div>
          )}
        </div>

        {/* Participants Sidebar */}
        <AnimatePresence>
          {showParticipants && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-48 ml-3 border-l pl-3 overflow-y-auto shrink-0"
              style={{ borderColor: THEME.border }}
            >
              <p
                className="text-[10px] font-medium uppercase tracking-wider mb-2"
                style={{ color: THEME.text.muted }}
              >
                Participants ({participants.length})
              </p>
              <div className="space-y-1.5">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-all"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold shrink-0"
                      style={{
                        background: `hsl(${hueFromString(p.name)}, 50%, 22%)`,
                        color: THEME.text.primary,
                      }}
                    >
                      {initials(p.name)}
                    </div>
                    <span
                      className="text-xs flex-1 truncate"
                      style={{ color: THEME.text.primary }}
                    >
                      {p.name}
                      {p.id === user?.id && " (You)"}
                    </span>
                    {p.isSpeaking && (
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: THEME.aurora.secondary }}
                      />
                    )}
                    {p.isMuted && (
                      <MicOff
                        className="w-2.5 h-2.5"
                        style={{ color: THEME.text.muted }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Controls */}
      <footer
        className="relative z-10 px-4 py-3 border-t flex items-center justify-center gap-3 shrink-0 flex-wrap"
        style={{
          borderColor: THEME.border,
          background: `rgba(10, 10, 18, 0.9)`,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Mute */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleToggleMute}
          className="p-2.5 rounded-full transition-all"
          style={{
            background: isMuted
              ? "rgba(239, 68, 68, 0.2)"
              : "rgba(110, 231, 183, 0.15)",
          }}
        >
          {isMuted ? (
            <MicOff
              className="w-5 h-5"
              style={{ color: THEME.status.danger }}
            />
          ) : (
            <Mic className="w-5 h-5" style={{ color: THEME.status.live }} />
          )}
        </motion.button>

        {/* Deafen */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleToggleDeafen}
          className="p-2.5 rounded-full hover:bg-white/5 transition-all"
          style={{
            color: isDeafened ? THEME.text.muted : THEME.text.secondary,
          }}
        >
          {isDeafened ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </motion.button>

        {/* Video */}
        {onToggleVideo && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleVideo}
            className="p-2.5 rounded-full hover:bg-white/5 transition-all"
            style={{
              color: isVideoOn ? THEME.aurora.primary : THEME.text.muted,
            }}
          >
            {isVideoOn ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </motion.button>
        )}

        {/* Screen Share */}
        {onToggleScreenShare && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleScreenShare}
            className="p-2.5 rounded-full hover:bg-white/5 transition-all"
            style={{
              color: isScreenSharing ? THEME.aurora.primary : THEME.text.muted,
            }}
          >
            {isScreenSharing ? (
              <ScreenShare className="w-5 h-5" />
            ) : (
              <ScreenShareOff className="w-5 h-5" />
            )}
          </motion.button>
        )}

        <div className="w-px h-8" style={{ background: THEME.border }} />

        {/* End Call */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleEndCall}
          className="p-2.5 rounded-full transition-all"
          style={{
            background: "rgba(239, 68, 68, 0.2)",
            color: THEME.status.danger,
          }}
        >
          <PhoneOff className="w-5 h-5" />
        </motion.button>
      </footer>

      {/* Keyboard shortcut hint */}
      <div
        className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[9px]"
        style={{ color: THEME.text.muted }}
      >
        ⌘+⇧+M mute · Space to unmute · Esc to leave
      </div>
    </div>
  );
};

export default VoiceCall;
