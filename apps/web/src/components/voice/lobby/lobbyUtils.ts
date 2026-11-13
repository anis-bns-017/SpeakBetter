// apps/web/src/components/voice/lobby/lobbyUtils.ts
import type { ElementType } from "react";
import { AlertCircle, Flame, Sparkles, Users } from "lucide-react";
import type { VoiceRoom } from "../../../hooks/useVoice";
import { COLORS } from "./lobbyTheme";
import { msg } from "../../../i18n/core";

export type SortKey = "active" | "newest" | "space" | "soon";

export const SORT_LABELS: Record<SortKey, string> = {
  active: msg("Most active"),
  newest: msg("Newest"),
  space: msg("Most space"),
  soon: msg("Starting soon"),
};

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function hueFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

export function timeSince(date: string | Date) {
  const diffMins = Math.floor(
    (Date.now() - new Date(date).getTime()) / 60000,
  );
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

export const participantCount = (room: VoiceRoom) =>
  room.participants?.length || 0;

export const isRoomFull = (room: VoiceRoom) =>
  participantCount(room) >= (room.maxParticipants || 50);

export function getRoomStatus(room: VoiceRoom): {
  label: string;
  color: string;
  icon: ElementType;
} {
  const percentage = Math.round(
    (participantCount(room) / (room.maxParticipants || 50)) * 100,
  );
  if (percentage >= 90)
    return { label: msg("Almost full"), color: COLORS.danger, icon: AlertCircle };
  if (percentage >= 70)
    return { label: msg("Busy"), color: COLORS.spotlight, icon: Flame };
  if (percentage >= 40)
    return { label: msg("Active"), color: COLORS.live, icon: Sparkles };
  return { label: msg("Quiet"), color: COLORS.textMuted, icon: Users };
}

/** "Starts in 2h 15m", "Starting now", or the date for far-off rooms */
export function formatCountdown(target: string | Date, now = Date.now()) {
  const ms = new Date(target).getTime() - now;
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "Starting now";
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `Starts in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Starts in ${hours}h ${mins % 60}m`;
  return new Date(target).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const icsStamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const icsEscape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Downloads an .ics file so a scheduled room can go into any calendar */
export function downloadRoomCalendar(room: VoiceRoom) {
  if (!room.scheduledFor) return;
  const start = new Date(room.scheduledFor);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const link = `${window.location.origin}/voice/${room.id}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SpeakBetter//Voice Rooms//EN",
    "BEGIN:VEVENT",
    `UID:${room.id}@speakbetter`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(room.name)}`,
    `DESCRIPTION:${icsEscape(`${room.description || "Voice room on SpeakBetter"}\n${link}`)}`,
    `URL:${link}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${room.name.replace(/[^\w-]+/g, "-").slice(0, 40) || "room"}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function sortRooms(rooms: VoiceRoom[], sort: SortKey): VoiceRoom[] {
  const byActive = (a: VoiceRoom, b: VoiceRoom) =>
    participantCount(b) - participantCount(a) ||
    +new Date(b.createdAt) - +new Date(a.createdAt);
  const copy = [...rooms];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    case "space":
      return copy.sort(
        (a, b) =>
          (b.maxParticipants || 50) -
          participantCount(b) -
          ((a.maxParticipants || 50) - participantCount(a)),
      );
    case "soon":
      return copy.sort((a, b) => {
        const at = a.scheduledFor ? +new Date(a.scheduledFor) : Infinity;
        const bt = b.scheduledFor ? +new Date(b.scheduledFor) : Infinity;
        return at - bt || byActive(a, b);
      });
    default:
      return copy.sort(byActive);
  }
}

/**
 * The room worth jumping into right now: open, has space, not one you are
 * already in, preferring rooms with people already talking and your language.
 */
export function pickBestRoom(
  rooms: VoiceRoom[],
  userId: string | undefined,
  preferredLanguage: string | null,
): VoiceRoom | null {
  let best: VoiceRoom | null = null;
  let bestScore = -Infinity;
  for (const room of rooms) {
    if (room.status === "ENDED") continue;
    if (room.type !== "OPEN" && room.type !== "STAGE") continue;
    if (isRoomFull(room)) continue;
    if (userId && room.participants?.some((p) => p.userId === userId)) continue;
    const count = participantCount(room);
    const fill = count / (room.maxParticipants || 50);
    const score =
      Math.min(count, 6) * 2 +
      (count > 0 ? 3 : 0) -
      (fill > 0.85 ? 6 : 0) +
      (preferredLanguage && room.language === preferredLanguage ? 4 : 0);
    if (score > bestScore) {
      best = room;
      bestScore = score;
    }
  }
  return best;
}
