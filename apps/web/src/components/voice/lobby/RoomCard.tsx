// apps/web/src/components/voice/lobby/RoomCard.tsx
import React from "react";
import { motion } from "framer-motion";
import {
  Bell,
  BellRing,
  CalendarPlus,
  Clock,
  Crown,
  Globe,
  Loader2,
  Lock,
  LogIn,
  Share2,
  Square,
  Star,
} from "lucide-react";
import type { VoiceRoom } from "../../../hooks/useVoice";
import { COLORS, TYPE_ACCENTS, TYPE_CONFIG } from "./lobbyTheme";
import {
  downloadRoomCalendar,
  formatCountdown,
  getRoomStatus,
  hueFromString,
  initials,
  isRoomFull,
  participantCount,
} from "./lobbyUtils";
import { Equalizer } from "./Equalizer";

interface RoomCardProps {
  room: VoiceRoom;
  variant: "grid" | "list";
  isCreator: boolean;
  isUserInRoom: boolean;
  isJoining: boolean;
  isFavorite: boolean;
  now: number;
  onJoin: () => void;
  onEnd: () => void;
  onCopyLink: () => void;
  onToggleFavorite: () => void;
  /** Scheduled rooms: people waiting for a reminder, and whether you are one of them */
  reminder?: { count: number; mine: boolean };
  onToggleReminder?: () => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  variant,
  isCreator,
  isUserInRoom,
  isJoining,
  isFavorite,
  now,
  onJoin,
  onEnd,
  onCopyLink,
  onToggleFavorite,
  reminder,
  onToggleReminder,
}) => {
  const typeConfig = TYPE_CONFIG[room.type] || TYPE_CONFIG.OPEN;
  const accent = TYPE_ACCENTS[room.type] || TYPE_ACCENTS.OPEN;
  const status = getRoomStatus(room);
  const count = participantCount(room);
  const max = room.maxParticipants || 50;
  const full = isRoomFull(room);
  const fillPct = Math.min(100, Math.round((count / max) * 100));
  const preview = (room.participants || []).slice(0, variant === "list" ? 3 : 4);
  const TypeIcon = typeConfig.icon;
  const StatusIcon = status.icon;
  const isList = variant === "list";
  // Once a scheduled room has started (even early) it is just a live room: no countdown, no reminder
  const upcoming =
    room.type === "SCHEDULED" && room.scheduledFor && room.status === "WAITING"
      ? formatCountdown(room.scheduledFor, now)
      : null;

  const joinLabel = isJoining
    ? "Joining..."
    : full
      ? "Full"
      : isUserInRoom
        ? "Rejoin Room"
        : "Join Room";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -2 }}
      className={`group relative rounded-2xl border overflow-hidden transition-shadow hover:shadow-[0_12px_40px_-12px_var(--card-glow)] ${
        isList ? "flex items-stretch" : ""
      }`}
      style={{
        background: `linear-gradient(160deg, ${COLORS.surface} 0%, rgba(28,20,48,0.72) 100%)`,
        borderColor: isUserInRoom ? `${COLORS.live}66` : COLORS.border,
        ["--card-glow" as string]: `${accent}55`,
      }}
    >
      <div
        className={isList ? "w-1 shrink-0" : "h-1"}
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}55)` }}
      />

      <div className={`p-5 ${isList ? "flex-1 min-w-0 flex flex-wrap items-center gap-x-6 gap-y-3" : ""}`}>
        <div className={isList ? "flex-1 min-w-[220px]" : ""}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className="font-serif text-lg leading-snug line-clamp-2 break-words max-w-full"
                  style={{ color: COLORS.textPrimary }}
                  title={room.name}
                >
                  {room.name}
                </h3>
                {isCreator && (
                  <span
                    className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: COLORS.spotlightDim, color: COLORS.spotlight }}
                  >
                    <Crown className="w-3 h-3" /> HOST
                  </span>
                )}
                {isUserInRoom && !isCreator && (
                  <span
                    className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: COLORS.liveDim, color: COLORS.live }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    INSIDE
                  </span>
                )}
                {room.isRecording && (
                  <span
                    className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
                    style={{ background: "rgba(239, 68, 68, 0.2)", color: COLORS.danger }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Recording
                  </span>
                )}
              </div>
              {room.description && !isList && (
                <p
                  className="text-sm mt-1 line-clamp-2"
                  style={{ color: COLORS.textMuted }}
                >
                  {room.description}
                </p>
              )}
              <p className="text-[11px] mt-1" style={{ color: COLORS.textSecondary }}>
                Hosted by {room.creator?.name || "someone"}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onToggleFavorite}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? "Unpin room" : "Pin room"}
                title={isFavorite ? "Unpin room" : "Pin room"}
                className="p-1.5 rounded-full transition-colors hover:bg-white/5"
                style={{ color: isFavorite ? COLORS.spotlight : COLORS.textSecondary }}
              >
                <Star className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
              </button>
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full"
                style={{ background: `${accent}22`, color: accent }}
              >
                <TypeIcon className="w-3 h-3" />
                {typeConfig.label}
              </span>
            </div>
          </div>

          {(room.language || room.topics?.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {room.language && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: COLORS.textMuted }}
                >
                  <Globe className="w-3 h-3" />
                  {room.language}
                </span>
              )}
              {(room.topics || []).slice(0, isList ? 2 : 3).map((topic) => (
                <span
                  key={topic}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: COLORS.textMuted }}
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={isList ? "flex items-center gap-4 flex-wrap" : "mt-4"}>
          <div className="flex items-center gap-3">
            {preview.length > 0 && (
              <div className="flex items-center -space-x-2">
                {preview.map((p) => {
                  const hue = hueFromString(p.user?.name || "?");
                  return (
                    <div
                      key={p.id}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold border-2"
                      style={{
                        background: `hsl(${hue}, 35%, 24%)`,
                        borderColor: COLORS.surface,
                        color: COLORS.textPrimary,
                      }}
                      title={p.user?.name || "Unknown"}
                    >
                      {initials(p.user?.name || "?")}
                    </div>
                  );
                })}
                {count > preview.length && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold border-2"
                    style={{
                      background: COLORS.surfaceRaised,
                      borderColor: COLORS.surface,
                      color: COLORS.textMuted,
                    }}
                  >
                    +{count - preview.length}
                  </div>
                )}
              </div>
            )}
            {count > 0 && <Equalizer color={accent} />}
            <span className="text-xs font-mono" style={{ color: COLORS.textMuted }}>
              {count}/{max}
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${status.color}22`, color: status.color }}
            >
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>

          {!isList && (
            <div
              className="h-1 rounded-full mt-3 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
              role="progressbar"
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label="Room capacity"
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${fillPct}%`,
                  background: fillPct >= 90 ? COLORS.danger : accent,
                }}
              />
            </div>
          )}

          {upcoming && (
            <div
              className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs font-medium"
              style={{ color: TYPE_ACCENTS.SCHEDULED }}
            >
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                {upcoming}
              </span>
              {onToggleReminder && !isCreator && (
                <button
                  onClick={onToggleReminder}
                  aria-pressed={!!reminder?.mine}
                  className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-white/5"
                  style={{ color: reminder?.mine ? TYPE_ACCENTS.SCHEDULED : COLORS.textMuted }}
                  title={reminder?.mine ? "You'll be reminded 10 minutes before" : "Get a reminder 10 minutes before it starts"}
                >
                  {reminder?.mine ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                  {reminder?.mine ? "Reminder set" : "Remind me"}
                  {reminder && reminder.count > 0 && <span className="opacity-70">· {reminder.count}</span>}
                </button>
              )}
              <button
                onClick={() => downloadRoomCalendar(room)}
                className={`${onToggleReminder && !isCreator ? "" : "ml-auto "}inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors hover:bg-white/5`}
                style={{ color: COLORS.textMuted }}
                title="Add to calendar"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Add to calendar
              </button>
            </div>
          )}
        </div>

        <div
          className={
            isList
              ? "flex items-center gap-2 shrink-0"
              : "flex items-center gap-2 mt-4 pt-3 border-t"
          }
          style={isList ? undefined : { borderColor: COLORS.border }}
        >
          <button
            onClick={onJoin}
            disabled={full || isJoining}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: full ? COLORS.textMuted : accent,
              color: COLORS.void,
            }}
          >
            {isJoining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : room.type === "PRIVATE" ? (
              <Lock className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {joinLabel}
          </button>

          {isCreator && (
            <button
              onClick={onEnd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors hover:bg-white/5 whitespace-nowrap"
              style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
            >
              <Square className="w-3.5 h-3.5" />
              End Room
            </button>
          )}

          <button
            onClick={onCopyLink}
            className="p-2 rounded-full transition-colors hover:bg-white/5"
            style={{ color: COLORS.textMuted }}
            title="Share room"
            aria-label="Copy room link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
