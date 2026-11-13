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
import { tr } from "../../../i18n/core";

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
      className={`group relative overflow-hidden rounded-3xl border transition-shadow hover:shadow-[0_18px_44px_-18px_var(--card-glow)] ${
        isList ? "flex items-stretch" : ""
      }`}
      style={{
        background: `radial-gradient(80% 90% at 0% 0%, color-mix(in srgb, ${accent} 9%, transparent) 0%, transparent 62%), ${COLORS.surface}`,
        borderColor: isUserInRoom ? `color-mix(in srgb, ${COLORS.live} 45%, transparent)` : COLORS.border,
        boxShadow: "var(--shadow-sm)",
        ["--card-glow" as string]: `color-mix(in srgb, ${accent} 45%, transparent)`,
      }}
    >
      <div
        aria-hidden
        className={isList ? "w-1 shrink-0" : "h-[3px]"}
        style={{ background: `linear-gradient(${isList ? "180deg" : "90deg"}, ${accent}, color-mix(in srgb, ${accent} 12%, transparent))` }}
      />

      <div className={`p-5 ${isList ? "flex-1 min-w-0 flex flex-wrap items-center gap-x-6 gap-y-3" : ""}`}>
        <div className={isList ? "flex-1 min-w-[220px]" : ""}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className="font-display text-xl font-semibold leading-snug tracking-tight line-clamp-2 break-words max-w-full"
                  style={{ color: COLORS.textPrimary }}
                  title={room.name}
                >
                  {room.name}
                </h3>
                {isCreator && (
                  <span
                    className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: COLORS.spotlightDim, color: COLORS.spotlight }}
                  >
                    <Crown className="w-3 h-3" /> HOST
                  </span>
                )}
                {isUserInRoom && !isCreator && (
                  <span
                    className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: COLORS.liveDim, color: COLORS.live }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    INSIDE
                  </span>
                )}
                {room.isRecording && (
                  <span
                    className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
                    style={{ background: "rgba(239, 68, 68, 0.2)", color: COLORS.danger }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {tr("Recording")}</span>
                )}
              </div>
              {room.description && !isList && (
                <p
                  className="text-sm mt-1 line-clamp-2"
                  style={{ color: COLORS.textMuted }}
                >
                  {tr(room.description)}
                </p>
              )}
              <p className="text-[11px] mt-1" style={{ color: COLORS.textSecondary }}>
                {tr("Hosted by")}{" "}{room.creator?.name || tr("someone")}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onToggleFavorite}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? tr("Unpin room") : tr("Pin room")}
                title={isFavorite ? tr("Unpin room") : tr("Pin room")}
                className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-slate-900/[0.05] dark:hover:bg-white/5"
                style={{ color: isFavorite ? COLORS.spotlight : COLORS.textMuted }}
              >
                <Star className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
              </button>
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-full"
                style={{ background: `color-mix(in srgb, ${accent} 13.3%, transparent)`, color: accent }}
              >
                <TypeIcon className="w-3 h-3" />
                {tr(typeConfig.label)}
              </span>
            </div>
          </div>

          {(room.language || room.topics?.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {room.language && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: "var(--sx-bg-255-255-255-60)", color: COLORS.textMuted }}
                >
                  <Globe className="w-3 h-3" />
                  {room.language}
                </span>
              )}
              {(room.topics || []).slice(0, isList ? 2 : 3).map((topic) => (
                <span
                  key={topic}
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: "var(--sx-bg-255-255-255-60)", color: COLORS.textMuted }}
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
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 shadow-sm"
                      style={{
                        background: `hsl(${hue}, 38%, 30%)`,
                        borderColor: COLORS.surface,
                        color: "#fff",
                      }}
                      title={p.user?.name || tr("Unknown")}
                    >
                      {initials(p.user?.name || "?")}
                    </div>
                  );
                })}
                {count > preview.length && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold border-2"
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
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: `color-mix(in srgb, ${status.color} 13.3%, transparent)`, color: status.color }}
            >
              <StatusIcon className="w-3 h-3" />
              {tr(status.label)}
            </span>
          </div>

          {!isList && (
            <div
              className="h-1 rounded-full mt-3 overflow-hidden"
              style={{ background: "var(--sx-bg-255-255-255-60)" }}
              role="progressbar"
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={tr("Room capacity")}
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
                  title={reminder?.mine ? tr("You'll be reminded 10 minutes before") : tr("Get a reminder 10 minutes before it starts")}
                >
                  {reminder?.mine ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                  {reminder?.mine ? tr("Reminder set") : tr("Remind me")}
                  {reminder && reminder.count > 0 && <span className="opacity-70">· {reminder.count}</span>}
                </button>
              )}
              <button
                onClick={() => downloadRoomCalendar(room)}
                className={`${onToggleReminder && !isCreator ? "" : "ml-auto "}inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors hover:bg-white/5`}
                style={{ color: COLORS.textMuted }}
                title={tr("Add to calendar")}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                {tr("Add to calendar")}</button>
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
            className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors hover:bg-slate-900/[0.04] dark:hover:bg-white/5"
              style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
            >
              <Square className="w-3.5 h-3.5" />
              {tr("End Room")}</button>
          )}

          <button
            onClick={onCopyLink}
            className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-slate-900/[0.05] dark:hover:bg-white/5"
            style={{ color: COLORS.textMuted }}
            title={tr("Share room")}
            aria-label={tr("Copy room link")}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
