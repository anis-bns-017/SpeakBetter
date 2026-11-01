// apps/web/src/components/voice/lobby/LobbyStates.tsx
import React from "react";
import { motion } from "framer-motion";
import { ChevronDown, Mic, Plus, SearchX } from "lucide-react";
import type { VoiceRoom } from "../../../hooks/useVoice";
import { COLORS } from "./lobbyTheme";
import { timeSince } from "./lobbyUtils";

export const LobbySkeleton: React.FC<{ list: boolean }> = ({ list }) => (
  <div
    className={list ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"}
    aria-busy="true"
    aria-label="Loading rooms"
  >
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="rounded-2xl border p-5 animate-pulse"
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
      >
        <div className="h-5 rounded-lg w-1/3 mb-3" style={{ background: COLORS.surfaceRaised }} />
        <div className="h-4 rounded-lg w-2/3" style={{ background: COLORS.surfaceRaised }} />
        <div className="flex gap-2 mt-3">
          <div className="h-6 rounded-full w-16" style={{ background: COLORS.surfaceRaised }} />
          <div className="h-6 rounded-full w-16" style={{ background: COLORS.surfaceRaised }} />
        </div>
      </div>
    ))}
  </div>
);

export const LobbyEmpty: React.FC<{
  filtered: boolean;
  onCreate: () => void;
  onClear: () => void;
}> = ({ filtered, onCreate, onClear }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 text-center"
  >
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
      style={{ background: COLORS.spotlightDim }}
    >
      {filtered ? (
        <SearchX className="w-10 h-10" style={{ color: COLORS.spotlight }} />
      ) : (
        <Mic className="w-10 h-10" style={{ color: COLORS.spotlight }} />
      )}
    </div>
    <h3 className="text-xl font-semibold mb-2" style={{ color: COLORS.textPrimary }}>
      {filtered ? "No rooms match" : "No active rooms yet"}
    </h3>
    <p className="max-w-sm text-sm mb-6" style={{ color: COLORS.textMuted }}>
      {filtered
        ? "Try a different search, or clear your filters to see every live room."
        : "There are no live conversations right now. Create a room and start speaking with others."}
    </p>
    <div className="flex items-center gap-3">
      {filtered && (
        <button
          onClick={onClear}
          className="px-5 py-3 rounded-full font-semibold border transition-colors hover:bg-white/5"
          style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimary }}
        >
          Clear filters
        </button>
      )}
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all hover:scale-105"
        style={{ background: COLORS.spotlight, color: COLORS.void }}
      >
        <Plus className="w-5 h-5" />
        Create Room
      </button>
    </div>
  </motion.div>
);

export const EndedRooms: React.FC<{ rooms: VoiceRoom[] }> = ({ rooms }) => {
  if (rooms.length === 0) return null;
  return (
    <div className="mt-8 pt-4 border-t" style={{ borderColor: COLORS.border }}>
      <details className="group">
        <summary
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ color: COLORS.textMuted }}
        >
          <span className="text-sm font-medium">Ended Rooms</span>
          <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full">{rooms.length}</span>
          <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-3 space-y-2">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-xl border p-4 opacity-50"
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold" style={{ color: COLORS.textMuted }}>
                    {room.name}
                  </h4>
                  <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                    Ended {timeSince(room.updatedAt)}
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full"
                  style={{ background: COLORS.border, color: COLORS.textMuted }}
                >
                  Ended
                </span>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};
