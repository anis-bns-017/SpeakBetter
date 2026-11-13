// apps/web/src/components/voice/lobby/LobbyOverview.tsx
import React from "react";
import { Crown, Headphones, Radio, Users } from "lucide-react";
import type { VoiceRoom } from "../../../hooks/useVoice";
import { COLORS, TYPE_ACCENTS } from "./lobbyTheme";
import { tr, msg } from "../../../i18n/core";

// ---- Stats strip ----
export const StatsStrip: React.FC<{
  liveRooms: number;
  peopleTalking: number;
  hosting: number;
  inside: number;
}> = ({ liveRooms, peopleTalking, hosting, inside }) => {
  const stats = [
    { label: msg("Live rooms"), value: liveRooms, icon: Radio, color: COLORS.live },
    { label: msg("People talking"), value: peopleTalking, icon: Users, color: COLORS.purple },
    { label: msg("You host"), value: hosting, icon: Crown, color: COLORS.spotlight },
    { label: msg("You are in"), value: inside, icon: Headphones, color: COLORS.info },
  ];
  return (
    <div
      className="vr-enter mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border lg:grid-cols-4"
      style={{ ["--vr-enter-delay" as string]: "160ms", borderColor: COLORS.border, background: COLORS.border }}
    >
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="flex items-center gap-3.5 px-5 py-4" style={{ background: COLORS.surface }}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[28px] font-semibold leading-none tabular-nums" style={{ color: COLORS.textPrimary }}>
              {value}
            </p>
            <p className="mt-1.5 truncate text-xs font-medium" style={{ color: COLORS.textMuted }}>
              {tr(label)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---- Pinned + yours shelf ----
export const YourRoomsShelf: React.FC<{
  rooms: VoiceRoom[];
  hostingIds: Set<string>;
  insideIds: Set<string>;
  pinnedIds: Set<string>;
  onOpen: (room: VoiceRoom) => void;
}> = ({ rooms, hostingIds, insideIds, pinnedIds, onOpen }) => {
  if (rooms.length === 0) return null;
  return (
    <section aria-label={tr("Your rooms")} className="mb-6">
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: COLORS.textMuted }}
      >
        {tr("Your rooms")}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {rooms.map((room) => {
          const accent = TYPE_ACCENTS[room.type] || COLORS.live;
          const role = hostingIds.has(room.id)
            ? "Hosting"
            : insideIds.has(room.id)
              ? "Inside"
              : pinnedIds.has(room.id)
                ? "Pinned"
                : "";
          return (
            <button
              key={room.id}
              onClick={() => onOpen(room)}
              className="shrink-0 text-left rounded-2xl border px-4 py-3 w-56 transition-all hover:-translate-y-0.5"
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: accent }}
                />
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: COLORS.textPrimary }}
                >
                  {room.name}
                </span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>
                {role} {" "}{tr("· {value} in room", { value: room.participants?.length || 0 })}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};
