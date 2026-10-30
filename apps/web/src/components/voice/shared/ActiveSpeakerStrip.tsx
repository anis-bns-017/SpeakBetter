// apps/web/src/components/voice/shared/ActiveSpeakerStrip.tsx
/**
 * ActiveSpeakerStrip
 * Horizontal strip pinned above the participant grid showing everyone
 * currently speaking, with live waveform + speaking glow.
 * Auto-hides when nobody is talking. Horizontally scrolls if crowded.
 */

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MicOff, Crown, Volume2 } from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import { initials, hueFromString } from "../VoiceRoomView.helpers";

interface ActiveSpeakerStripProps {
  participants: any[];
  currentUserId?: string;
  onSelect?: (id: string) => void;
  /** Also show recently-muted speakers for a moment? default: no */
  showMuted?: boolean;
  className?: string;
  maxVisible?: number;
}

export const ActiveSpeakerStrip: React.FC<ActiveSpeakerStripProps> = ({
  participants,
  currentUserId,
  onSelect,
  showMuted = false,
  className,
  maxVisible = 10,
}) => {
  // Filter to active speakers only
  const speakers = useMemo(() => {
    return participants
      .filter((p) => {
        if (p.isMuted && !showMuted) return false;
        return Boolean(p.isSpeaking);
      })
      .sort((a, b) => {
        const aLevel = Number(a.audioLevel || 0);
        const bLevel = Number(b.audioLevel || 0);
        return bLevel - aLevel;
      })
      .slice(0, maxVisible);
  }, [participants, showMuted, maxVisible]);

  const anyoneSpeaking = speakers.length > 0;

  return (
    <AnimatePresence initial={false}>
      {anyoneSpeaking && (
        <motion.div
          key="active-speaker-strip"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className={className}
          style={{
            background:
              "linear-gradient(180deg, rgba(129,140,248,0.06), rgba(129,140,248,0))",
            borderBottom: `1px solid ${THEME.colors.border.primary}`,
          }}
        >
          <div className="px-3 sm:px-4 py-2 flex items-center gap-2">
            {/* Leading label */}
            <div
              className="flex items-center gap-1.5 shrink-0 pr-2 border-r"
              style={{ borderColor: THEME.colors.border.primary }}
            >
              <Volume2
                className="w-3.5 h-3.5"
                style={{ color: THEME.colors.accent.success }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: THEME.colors.text.muted }}
              >
                {speakers.length === 1 ? "Speaking" : "Live now"}
              </span>
            </div>

            {/* Horizontal scroll row */}
            <div
              className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-none"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {speakers.map((p) => (
                <SpeakerChip
                  key={p.id}
                  participant={p}
                  isMe={p.userId === currentUserId || p.id === currentUserId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ------------------------------------------------------------

const SpeakerChip: React.FC<{
  participant: any;
  isMe?: boolean;
  onSelect?: (id: string) => void;
}> = ({ participant, isMe, onSelect }) => {
  const hue = hueFromString(participant.name || "?");
  const level = Math.max(0, Math.min(1, Number(participant.audioLevel || 0)));
  const isMuted = Boolean(participant.isMuted);
  const isHost = participant.role === "HOST" || Boolean(participant.isHost);

  const handleClick = () => {
    onSelect?.(participant.id || participant.userId);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0.9, x: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.18 }}
      className="group flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border shrink-0 hover:bg-white/5 transition-colors"
      style={{
        background: isMe ? "rgba(129,140,248,0.12)" : "rgba(255,255,255,0.03)",
        borderColor: isMe
          ? "rgba(129,140,248,0.35)"
          : THEME.colors.border.primary,
      }}
      title={`${participant.name}${isMe ? " (You)" : ""}`}
    >
      {/* Avatar with speaking glow */}
      <div className="relative shrink-0">
        <motion.div
          className="absolute inset-[-3px] rounded-full pointer-events-none"
          animate={{
            opacity: [0.4, 0.9, 0.4],
            scale: [1, 1.12, 1],
          }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            border: `2px solid ${THEME.colors.accent.success}`,
          }}
        />
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center font-semibold overflow-hidden relative z-10"
          style={{
            background: participant.avatarUrl
              ? `url(${participant.avatarUrl}) center/cover`
              : `hsl(${hue}, 50%, 30%)`,
            color: participant.avatarUrl
              ? "transparent"
              : THEME.colors.text.primary,
            fontSize: 10,
          }}
        >
          {!participant.avatarUrl && initials(participant.name || "?")}
        </div>

        {/* Host crown */}
        {isHost && (
          <Crown
            className="absolute -top-1 -right-1 w-3 h-3 z-20 drop-shadow"
            style={{ color: "#FBBF24" }}
          />
        )}
      </div>

      {/* Name + waveform */}
      <div className="flex flex-col items-start min-w-0">
        <div className="flex items-center gap-1">
          <span
            className="text-[11px] font-medium truncate max-w-[80px]"
            style={{ color: THEME.colors.text.primary }}
          >
            {participant.name}
          </span>
          {isMe && (
            <span
              className="text-[8px] px-1 rounded font-bold"
              style={{
                background: "rgba(129,140,248,0.25)",
                color: THEME.colors.accent.primary,
              }}
            >
              YOU
            </span>
          )}
          {isMuted && (
            <MicOff
              className="w-2.5 h-2.5"
              style={{ color: THEME.colors.accent.error }}
            />
          )}
        </div>

        {/* Waveform bars */}
        <Waveform level={level} muted={isMuted} />
      </div>
    </motion.button>
  );
};

// ------------------------------------------------------------

const Waveform: React.FC<{ level: number; muted?: boolean }> = ({
  level,
  muted,
}) => {
  const bars = [0, 1, 2, 3, 4];
  return (
    <div className="flex items-end gap-[2px] h-2 mt-0.5">
      {bars.map((i) => {
        const threshold = (i + 1) / bars.length;
        const active = !muted && level >= threshold * 0.7;
        return (
          <motion.span
            key={i}
            className="w-[2px] rounded-full"
            animate={{
              height: active
                ? [`${3 + i}px`, `${5 + i * 1.5}px`, `${3 + i}px`]
                : "3px",
              opacity: active ? 1 : 0.35,
            }}
            transition={
              active
                ? {
                    duration: 0.4 + i * 0.06,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                : { duration: 0.2 }
            }
            style={{
              background: active
                ? THEME.colors.accent.success
                : THEME.colors.text.muted,
            }}
          />
        );
      })}
    </div>
  );
};

export default ActiveSpeakerStrip;
