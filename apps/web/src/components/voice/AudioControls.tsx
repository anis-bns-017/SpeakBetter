// apps/web/src/components/voice/AudioControls.tsx

import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
  Volume1,
  Volume,
  VolumeOff,
  Headphones,
  HeadphoneOff,
  Shield,
  ShieldCheck,
  Radio,
  Waves,
  Zap,
  Sparkles,
  Loader2,
  Users,
  ChevronUp,
  ChevronDown,
  Settings,
  Share2,
  Link,
  Copy,
  Check,
  Bluetooth,
  BluetoothOff,
  Speaker,
  Monitor,
  MonitorOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ---- Types ----
interface AudioControlsProps {
  // Core audio
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened?: boolean;
  onToggleDeafen?: () => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;

  // Call states
  onEndCall?: () => void;
  onAnswerCall?: () => void;
  isCallIncoming?: boolean;
  isCallActive?: boolean;
  isConnecting?: boolean;

  // Connection
  connectionQuality?: "excellent" | "good" | "fair" | "poor" | "disconnected";
  audioLevel?: number;
  isReconnecting?: boolean;

  // Room info
  isHost?: boolean;
  participantCount?: number;
  roomName?: string;
  roomId?: string;

  // Actions
  onShowParticipants?: () => void;
  onShareRoom?: () => void;
  onShowSettings?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;

  // UI variants
  variant?: "default" | "floating" | "mobile" | "compact";
  className?: string;
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
    blue: "#3B82F6",
    green: "#34D399",
    red: "#EF4444",
    orange: "#F59E0B",
    yellow: "#FBBF24",
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
    danger: "#EF4444",
    warning: "#FBBF24",
  },
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

// ---- Volume Slider ----
const VolumeSlider: React.FC<{
  value: number;
  onChange: (value: number) => void;
  isDeafened: boolean;
}> = ({ value, onChange, isDeafened }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  const getVolumeIcon = () => {
    if (isDeafened || value === 0) return <VolumeOff className="w-4 h-4" />;
    if (value < 30) return <Volume1 className="w-4 h-4" />;
    if (value < 70) return <Volume2 className="w-4 h-4" />;
    return <Volume className="w-4 h-4" />;
  };

  const getVolumeColor = () => {
    if (isDeafened || value === 0) return THEME.text.muted;
    if (value < 30) return THEME.aurora.cyan;
    if (value < 70) return THEME.aurora.tertiary;
    return THEME.aurora.primary;
  };

  return (
    <div
      className="flex items-center gap-2 relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <motion.div
        animate={{ color: getVolumeColor() }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
        onClick={() => {
          if (!isDeafened) {
            const newValue = value === 0 ? 80 : 0;
            onChange(newValue);
          }
        }}
      >
        {getVolumeIcon()}
      </motion.div>

      <div className="relative flex items-center h-8">
        <input
          ref={sliderRef}
          type="range"
          min="0"
          max="100"
          value={isDeafened ? 0 : value}
          onChange={(e) => {
            if (!isDeafened) {
              onChange(parseInt(e.target.value));
            }
          }}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          disabled={isDeafened}
          className="w-24 h-1 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, 
              ${getVolumeColor()} ${isDeafened ? 0 : value}%, 
              ${THEME.border} ${isDeafened ? 0 : value}%
            )`,
          }}
        />

        <AnimatePresence>
          {showTooltip && isDragging && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-mono whitespace-nowrap"
              style={{
                background: THEME.surfaceRaised,
                color: THEME.text.primary,
                border: `1px solid ${THEME.border}`,
              }}
            >
              {isDeafened ? "Muted" : `${value}%`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ---- Connection Quality ----
const ConnectionQuality: React.FC<{
  quality: string;
  isReconnecting?: boolean;
}> = ({ quality, isReconnecting }) => {
  const getQualityConfig = () => {
    if (isReconnecting) {
      return { color: THEME.aurora.orange, label: "Reconnecting...", bars: 1 };
    }
    switch (quality) {
      case "excellent":
        return { color: THEME.status.live, label: "Excellent", bars: 4 };
      case "good":
        return { color: THEME.aurora.tertiary, label: "Good", bars: 3 };
      case "fair":
        return { color: THEME.aurora.orange, label: "Fair", bars: 2 };
      case "poor":
        return { color: THEME.status.danger, label: "Poor", bars: 1 };
      case "disconnected":
        return { color: THEME.status.danger, label: "Disconnected", bars: 0 };
      default:
        return { color: THEME.text.muted, label: "Connecting...", bars: 1 };
    }
  };

  const config = getQualityConfig();

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 rounded-full"
      style={{ background: "rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center gap-0.5 h-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full"
            style={{
              height: `${[4, 8, 12, 16][i]}px`,
              background: i < config.bars ? config.color : THEME.border,
              transition: "background 0.3s ease",
            }}
            animate={{
              opacity: i < config.bars ? 1 : 0.3,
            }}
          />
        ))}
      </div>
      <span
        className="text-[10px] font-mono"
        style={{ color: THEME.text.muted }}
      >
        {config.label}
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
    <div className="flex items-center gap-0.5 h-6">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full"
          animate={{
            height: muted
              ? 2
              : `${4 + (safe > i / 7 ? 4 + Math.random() * 6 : 2)}px`,
            background: muted
              ? THEME.text.muted
              : safe > i / 7
                ? THEME.aurora.primary
                : THEME.border,
          }}
          transition={{ duration: 0.1 }}
        />
      ))}
    </div>
  );
};

// ============================================================
// MAIN AUDIO CONTROLS
// ============================================================

export const AudioControls: React.FC<AudioControlsProps> = ({
  isMuted,
  onToggleMute,
  isDeafened = false,
  onToggleDeafen,
  volume = 80,
  onVolumeChange,
  onEndCall,
  onAnswerCall,
  isCallIncoming = false,
  isCallActive = false,
  isConnecting = false,
  connectionQuality = "excellent",
  audioLevel = 0,
  isHost = false,
  participantCount = 0,
  roomName,
  roomId,
  onShowParticipants,
  onShareRoom,
  onShowSettings,
  onToggleFullscreen,
  isFullscreen = false,
  isReconnecting = false,
  variant = "default",
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rippleEffect, setRippleEffect] = useState(false);
  const [copied, setCopied] = useState(false);

  // Audio level animation
  const micPulse = audioLevel > 0.1 && !isMuted;

  const handleMuteToggle = () => {
    setRippleEffect(true);
    onToggleMute();
    setTimeout(() => setRippleEffect(false), 500);
  };

  const handleShareRoom = () => {
    if (onShareRoom) {
      onShareRoom();
    } else if (roomId) {
      const link = `${window.location.origin}/voice/${roomId}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("📋 Room link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ---- Default Variant ----
  if (variant === "default") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative ${className}`}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl border"
          style={{
            background: "rgba(20, 20, 37, 0.8)",
            borderColor: THEME.border,
            boxShadow: isCallActive
              ? `0 0 40px ${THEME.aurora.primary}22`
              : "none",
          }}
        >
          {/* Mute Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleMuteToggle}
            className="relative p-3 rounded-full transition-all"
            style={{
              background: isMuted
                ? "rgba(239, 68, 68, 0.15)"
                : `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
              boxShadow: isMuted
                ? "none"
                : `0 0 30px ${THEME.aurora.primary}33`,
            }}
          >
            <AnimatePresence>
              {rippleEffect && (
                <motion.span
                  initial={{ scale: 0, opacity: 0.8 }}
                  animate={{ scale: 2, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${THEME.aurora.primary}, transparent)`,
                  }}
                />
              )}
            </AnimatePresence>

            {micPulse && (
              <motion.div
                className="absolute inset-[-4px] rounded-full border-2"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.6, 0, 0.6],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ borderColor: THEME.aurora.primary }}
              />
            )}

            {isMuted ? (
              <MicOff className="w-5 h-5 text-red-400" />
            ) : (
              <Mic className="w-5 h-5 text-white" />
            )}

            {!isMuted && (
              <motion.div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                animate={{ scale: micPulse ? [1, 1.3, 1] : 1 }}
                transition={{ duration: 0.5, repeat: micPulse ? Infinity : 0 }}
                style={{
                  background: micPulse ? THEME.status.live : THEME.text.muted,
                }}
              />
            )}
          </motion.button>

          {/* Audio Level Meter */}
          <div className="hidden sm:flex">
            <AudioLevelMeter level={audioLevel} muted={isMuted} />
          </div>

          {/* Deafen */}
          {onToggleDeafen && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleDeafen}
              className={`p-3 rounded-full transition-all ${
                isDeafened
                  ? "bg-red-500/10 hover:bg-red-500/20"
                  : "hover:bg-white/5"
              }`}
              style={{
                color: isDeafened ? "#EF4444" : THEME.text.secondary,
              }}
            >
              {isDeafened ? (
                <HeadphoneOff className="w-5 h-5" />
              ) : (
                <Headphones className="w-5 h-5" />
              )}
            </motion.button>
          )}

          {/* Volume */}
          {onVolumeChange && (
            <VolumeSlider
              value={volume}
              onChange={onVolumeChange}
              isDeafened={isDeafened}
            />
          )}

          <div className="w-px h-8" style={{ background: THEME.border }} />

          {/* Connection Quality */}
          <ConnectionQuality
            quality={connectionQuality}
            isReconnecting={isReconnecting}
          />

          {/* Participant Count */}
          {participantCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onShowParticipants}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:bg-white/5"
              style={{ color: THEME.text.secondary }}
            >
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{participantCount}</span>
            </motion.button>
          )}

          {/* Share */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleShareRoom}
            className="p-2.5 rounded-full hover:bg-white/5 transition-all"
            style={{ color: THEME.text.muted }}
            title="Share Room"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </motion.button>

          {/* Settings */}
          {onShowSettings && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onShowSettings}
              className="p-2.5 rounded-full hover:bg-white/5 transition-all"
              style={{ color: THEME.text.muted }}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </motion.button>
          )}

          {/* Fullscreen */}
          {onToggleFullscreen && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleFullscreen}
              className="p-2.5 rounded-full hover:bg-white/5 transition-all"
              style={{ color: THEME.text.muted }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </motion.button>
          )}

          {/* Host Badge */}
          {isHost && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
              style={{
                background: "rgba(251, 191, 36, 0.15)",
                color: "#FBBF24",
              }}
            >
              <ShieldCheck className="w-3 h-3" />
              Host
            </div>
          )}

          {/* Call Actions */}
          {isCallIncoming && onAnswerCall && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAnswerCall}
              className="p-3 rounded-full transition-all"
              style={{
                background: `linear-gradient(135deg, ${THEME.aurora.tertiary}, ${THEME.aurora.cyan})`,
                boxShadow: `0 0 30px ${THEME.aurora.tertiary}33`,
              }}
            >
              <Phone className="w-5 h-5 text-white" />
            </motion.button>
          )}

          {isCallActive && onEndCall && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEndCall}
              className="p-3 rounded-full transition-all"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              <PhoneOff className="w-5 h-5 text-red-400" />
            </motion.button>
          )}

          {/* Connecting */}
          {isConnecting && (
            <div className="flex items-center gap-2 px-2">
              <Loader2
                className="w-4 h-4 animate-spin"
                style={{ color: THEME.aurora.primary }}
              />
              <span className="text-xs" style={{ color: THEME.text.muted }}>
                Connecting...
              </span>
            </div>
          )}
        </div>

        {/* Bottom Glow */}
        {isCallActive && (
          <motion.div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 rounded-full blur-xl"
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              background: `radial-gradient(circle, ${THEME.aurora.primary}, transparent)`,
            }}
          />
        )}
      </motion.div>
    );
  }

  // ---- Floating Variant ----
  if (variant === "floating") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 ${className}`}
      >
        <div
          className="flex items-center gap-3 px-6 py-4 rounded-full backdrop-blur-2xl border shadow-2xl"
          style={{
            background: "rgba(10, 10, 18, 0.85)",
            borderColor: THEME.border,
            boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 40px ${THEME.aurora.primary}22`,
          }}
        >
          <button
            onClick={handleMuteToggle}
            className={`p-3 rounded-full transition-all ${
              isMuted ? "bg-red-500/20" : "bg-purple-500/20"
            }`}
            style={{
              boxShadow: isMuted
                ? "none"
                : `0 0 30px ${THEME.aurora.primary}33`,
            }}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5 text-red-400" />
            ) : (
              <Mic className="w-5 h-5 text-purple-400" />
            )}
          </button>

          <div className="flex flex-col items-center px-3">
            <span
              className="text-xs font-medium"
              style={{ color: THEME.text.primary }}
            >
              {isCallActive ? "🔴 Live" : "🎧 Listening"}
            </span>
            {participantCount > 0 && (
              <span className="text-[10px]" style={{ color: THEME.text.muted }}>
                {participantCount} in room
              </span>
            )}
          </div>

          {onEndCall && (
            <button
              onClick={onEndCall}
              className="p-3 rounded-full hover:bg-red-500/20 transition-colors"
              style={{ color: "#EF4444" }}
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // ---- Mobile Variant ----
  if (variant === "mobile") {
    return (
      <div
        className={`fixed bottom-0 left-0 right-0 p-4 backdrop-blur-xl border-t ${className}`}
        style={{
          background: "rgba(10, 10, 18, 0.9)",
          borderColor: THEME.border,
        }}
      >
        <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
          <button
            onClick={handleMuteToggle}
            className={`p-4 rounded-full transition-all ${
              isMuted ? "bg-red-500/20" : "bg-purple-500/20"
            }`}
            style={{
              boxShadow: isMuted
                ? "none"
                : `0 0 40px ${THEME.aurora.primary}33`,
            }}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-red-400" />
            ) : (
              <Mic className="w-6 h-6 text-purple-400" />
            )}
          </button>

          {isCallActive && onEndCall && (
            <button
              onClick={onEndCall}
              className="p-4 rounded-full bg-red-500/20"
            >
              <PhoneOff className="w-6 h-6 text-red-400" />
            </button>
          )}

          {isCallIncoming && onAnswerCall && (
            <button
              onClick={onAnswerCall}
              className="p-4 rounded-full bg-green-500/20"
            >
              <Phone className="w-6 h-6 text-green-400" />
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-3 rounded-full hover:bg-white/5"
            style={{ color: THEME.text.muted }}
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-center gap-4 pt-3">
                {onToggleDeafen && (
                  <button
                    onClick={onToggleDeafen}
                    className={`p-3 rounded-full ${
                      isDeafened ? "bg-red-500/20" : "hover:bg-white/5"
                    }`}
                    style={{
                      color: isDeafened ? "#EF4444" : THEME.text.secondary,
                    }}
                  >
                    {isDeafened ? (
                      <HeadphoneOff className="w-5 h-5" />
                    ) : (
                      <Headphones className="w-5 h-5" />
                    )}
                  </button>
                )}

                {onVolumeChange && (
                  <div className="flex items-center gap-2">
                    <Volume2
                      className="w-4 h-4"
                      style={{ color: THEME.text.muted }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isDeafened ? 0 : volume}
                      onChange={(e) =>
                        !isDeafened &&
                        onVolumeChange?.(parseInt(e.target.value))
                      }
                      disabled={isDeafened}
                      className="w-32 h-1 rounded-full appearance-none cursor-pointer disabled:opacity-40"
                      style={{
                        background: `linear-gradient(to right, ${THEME.aurora.primary} ${isDeafened ? 0 : volume}%, ${THEME.border} ${isDeafened ? 0 : volume}%)`,
                      }}
                    />
                  </div>
                )}

                {onShareRoom && (
                  <button
                    onClick={handleShareRoom}
                    className="p-3 rounded-full hover:bg-white/5"
                    style={{ color: THEME.text.muted }}
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ---- Compact Variant ----
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-xl border ${className}`}
      style={{
        background: "rgba(20, 20, 37, 0.8)",
        borderColor: THEME.border,
      }}
    >
      <button
        onClick={handleMuteToggle}
        className="p-1.5 rounded-full hover:bg-white/5 transition-all"
        style={{
          color: isMuted ? THEME.status.danger : THEME.aurora.primary,
        }}
      >
        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {onToggleDeafen && (
        <button
          onClick={onToggleDeafen}
          className="p-1.5 rounded-full hover:bg-white/5 transition-all"
          style={{
            color: isDeafened ? THEME.status.danger : THEME.text.muted,
          }}
        >
          {isDeafened ? (
            <HeadphoneOff className="w-4 h-4" />
          ) : (
            <Headphones className="w-4 h-4" />
          )}
        </button>
      )}

      <div className="w-px h-4" style={{ background: THEME.border }} />

      {onVolumeChange && (
        <VolumeSlider
          value={volume}
          onChange={onVolumeChange}
          isDeafened={isDeafened}
        />
      )}

      <div className="w-px h-4" style={{ background: THEME.border }} />

      <div className="flex items-center gap-1">
        <span className="text-[10px]" style={{ color: THEME.text.muted }}>
          {participantCount}
        </span>
        <Users className="w-3 h-3" style={{ color: THEME.text.muted }} />
      </div>
    </div>
  );
};

// ---- Mobile Optimized Version (Legacy Support) ----
export const MobileAudioControls: React.FC<AudioControlsProps> = (props) => {
  return <AudioControls {...props} variant="mobile" />;
};

// ---- Floating Controls (Legacy Support) ----
export const FloatingAudioControls: React.FC<AudioControlsProps> = (props) => {
  return <AudioControls {...props} variant="floating" />;
};

export default AudioControls;
