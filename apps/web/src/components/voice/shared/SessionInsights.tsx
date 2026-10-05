// apps/web/src/components/voice/shared/SessionInsights.tsx
/**
 * SessionInsights — live host panel showing room health + engagement.
 * Prop-driven. Auto-tracks speaking balance per participant.
 *
 * Usage:
 *   const speakingTimes = useSpeakingTimes(allParticipants);
 *   <SessionInsights
 *     speakingTimes={speakingTimes}
 *     messages={messages.length}
 *     reactions={stageReactions.length}
 *     totalParticipants={totalParticipants}
 *     roomDuration={roomDuration}
 *     onClose={() => setShow(false)}
 *   />
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  X,
  Clock,
  Mic,
  MessageCircle,
  Smile,
  Users,
  Crown,
  TrendingUp,
  Award,
  Timer,
} from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";

export interface SpeakingTime {
  userId: string;
  name: string;
  avatarUrl?: string;
  /** Total seconds spoken in this session */
  seconds: number;
  /** Number of times they started speaking */
  turns: number;
}

interface SessionInsightsProps {
  speakingTimes: SpeakingTime[];
  totalParticipants: number;
  roomDuration: number;
  messages: number;
  reactions: number;
  isHost: boolean;
  isModerator: boolean;
  onClose: () => void;
}

export const SessionInsights: React.FC<SessionInsightsProps> = ({
  speakingTimes,
  totalParticipants,
  roomDuration,
  messages,
  reactions,
  isHost,
  isModerator,
  onClose,
}) => {
  // ---------- derived metrics ----------
  const totalSpeakingSeconds = useMemo(
    () => speakingTimes.reduce((sum, s) => sum + s.seconds, 0),
    [speakingTimes],
  );

  const uniqueSpeakers = useMemo(
    () => speakingTimes.filter((s) => s.seconds > 0).length,
    [speakingTimes],
  );

  const topContributors = useMemo(
    () =>
      [...speakingTimes]
        .filter((s) => s.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 5),
    [speakingTimes],
  );

  const avgSpeakingSeconds = useMemo(() => {
    if (uniqueSpeakers === 0) return 0;
    return Math.round(totalSpeakingSeconds / uniqueSpeakers);
  }, [totalSpeakingSeconds, uniqueSpeakers]);

  const participationRate = useMemo(() => {
    if (totalParticipants === 0) return 0;
    return Math.round((uniqueSpeakers / totalParticipants) * 100);
  }, [uniqueSpeakers, totalParticipants]);

  // Silent listeners = participants with no speaking time
  const silentCount = Math.max(0, totalParticipants - uniqueSpeakers);

  // Max speaking time (for bar chart width)
  const maxSeconds = useMemo(
    () => Math.max(1, ...speakingTimes.map((s) => s.seconds)),
    [speakingTimes],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="fixed top-16 left-4 w-[min(92vw,360px)] rounded-2xl border shadow-2xl backdrop-blur-2xl z-[80]"
      style={{
        background: "rgba(10, 10, 18, 0.97)",
        borderColor: THEME.colors.border.primary,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-3 border-b"
        style={{ borderColor: THEME.colors.border.primary }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(129,140,248,0.2), rgba(167,139,250,0.1))",
            }}
          >
            <BarChart3
              className="w-4 h-4"
              style={{ color: THEME.colors.accent.primary }}
            />
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: THEME.colors.text.primary }}
            >
              Session insights
            </p>
            <p
              className="text-[10px] truncate"
              style={{ color: THEME.colors.text.muted }}
            >
              {isHost ? "Host view" : isModerator ? "Moderator view" : "Live stats"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
          style={{ color: THEME.colors.text.muted }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Top metric tiles */}
      <div className="p-3 grid grid-cols-2 gap-2">
        <MetricTile
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Duration"
          value={formatDuration(roomDuration)}
          color={THEME.colors.accent.primary}
        />
        <MetricTile
          icon={<Mic className="w-3.5 h-3.5" />}
          label="Speakers"
          value={`${uniqueSpeakers}/${totalParticipants}`}
          color={THEME.colors.accent.success}
        />
        <MetricTile
          icon={<MessageCircle className="w-3.5 h-3.5" />}
          label="Messages"
          value={String(messages)}
          color={THEME.colors.accent.cyan}
        />
        <MetricTile
          icon={<Smile className="w-3.5 h-3.5" />}
          label="Reactions"
          value={String(reactions)}
          color={THEME.colors.accent.warning}
        />
      </div>

      {/* Participation bar */}
      <div
        className="mx-3 p-3 rounded-xl border"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: THEME.colors.border.primary,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp
              className="w-3.5 h-3.5"
              style={{ color: THEME.colors.accent.primary }}
            />
            <span
              className="text-[11px] font-semibold"
              style={{ color: THEME.colors.text.secondary }}
            >
              Participation
            </span>
          </div>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: THEME.colors.text.primary }}
          >
            {participationRate}%
          </span>
        </div>

        <div
          className="h-2 rounded-full overflow-hidden flex"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${participationRate}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full"
            style={{
              background: `linear-gradient(90deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
            }}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5 text-[9px]">
          <span style={{ color: THEME.colors.text.muted }}>
            {uniqueSpeakers} spoke
          </span>
          {silentCount > 0 && (
            <span style={{ color: THEME.colors.text.muted }}>
              {silentCount} listening
            </span>
          )}
        </div>
      </div>

      {/* Top contributors */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Award
            className="w-3.5 h-3.5"
            style={{ color: THEME.colors.accent.warning }}
          />
          <span
            className="text-[11px] font-semibold"
            style={{ color: THEME.colors.text.secondary }}
          >
            Top contributors
          </span>
        </div>

        {topContributors.length === 0 ? (
          <div className="text-center py-4">
            <Timer
              className="w-6 h-6 mx-auto mb-1.5"
              style={{ color: THEME.colors.text.muted }}
            />
            <p className="text-[11px]" style={{ color: THEME.colors.text.muted }}>
              No one has spoken yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {topContributors.map((c, idx) => {
              const pct = Math.round((c.seconds / maxSeconds) * 100);
              const share = totalSpeakingSeconds
                ? Math.round((c.seconds / totalSpeakingSeconds) * 100)
                : 0;

              return (
                <div key={c.userId} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {/* Rank badge */}
                    <span
                      className="w-4 text-[9px] font-bold tabular-nums shrink-0"
                      style={{
                        color:
                          idx === 0
                            ? THEME.colors.accent.warning
                            : idx === 1
                              ? "#C0C0C0"
                              : idx === 2
                                ? "#CD7F32"
                                : THEME.colors.text.muted,
                      }}
                    >
                      #{idx + 1}
                    </span>

                    {/* Avatar */}
                    <div
                      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-semibold overflow-hidden"
                      style={{
                        background: c.avatarUrl
                          ? `url(${c.avatarUrl}) center/cover`
                          : `hsl(${hashCode(c.name) % 360}, 45%, 30%)`,
                        color: c.avatarUrl
                          ? "transparent"
                          : THEME.colors.text.primary,
                      }}
                    >
                      {!c.avatarUrl && initials(c.name)}
                    </div>

                    {/* Name + time */}
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <span
                        className="text-[11px] font-medium truncate"
                        style={{ color: THEME.colors.text.primary }}
                      >
                        {c.name}
                      </span>
                      <span
                        className="text-[10px] tabular-nums shrink-0"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        {formatDuration(c.seconds)} · {share}%
                      </span>
                    </div>
                  </div>

                  {/* Speaking bar */}
                  <div
                    className="ml-6 h-1 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          idx === 0
                            ? `linear-gradient(90deg, ${THEME.colors.accent.warning}, #f97316)`
                            : `linear-gradient(90deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="px-3 py-2 border-t text-[9px]"
        style={{
          borderColor: THEME.colors.border.primary,
          color: THEME.colors.text.muted,
        }}
      >
        <div className="flex items-center justify-between">
          <span>Avg per speaker</span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: THEME.colors.text.secondary }}
          >
            {formatDuration(avgSpeakingSeconds)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// ------------------------------------------------------------
// Helpers + sub-components
// ------------------------------------------------------------

const MetricTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div
    className="rounded-xl border p-2.5 flex flex-col gap-1"
    style={{
      background: "rgba(255,255,255,0.02)",
      borderColor: THEME.colors.border.primary,
    }}
  >
    <div className="flex items-center gap-1.5">
      <span
        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, color }}
      >
        {icon}
      </span>
      <span
        className="text-[9px] font-medium uppercase tracking-wider truncate"
        style={{ color: THEME.colors.text.muted }}
      >
        {label}
      </span>
    </div>
    <span
      className="text-sm font-bold tabular-nums"
      style={{ color: THEME.colors.text.primary }}
    >
      {value}
    </span>
  </div>
);

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
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

export default SessionInsights;