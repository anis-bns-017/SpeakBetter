// apps/web/src/components/voice/lobby/LobbyHero.tsx
import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Mic, Plus, Zap } from "lucide-react";
import type { VoiceRoom } from "../../../hooks/useVoice";
import { COLORS, TYPE_ACCENTS } from "./lobbyTheme";
import { hueFromString, initials, participantCount } from "./lobbyUtils";
import { Equalizer } from "./Equalizer";

interface LobbyHeroProps {
  /** The busiest room right now, if anyone is talking */
  featured: VoiceRoom | null;
  /** The room Quick join would put you in */
  quickRoom: VoiceRoom | null;
  isJoiningFeatured: boolean;
  onJoinFeatured: () => void;
  onQuickJoin: () => void;
  onCreate: () => void;
}

export const LobbyHero: React.FC<LobbyHeroProps> = ({
  featured,
  quickRoom,
  isJoiningFeatured,
  onJoinFeatured,
  onQuickJoin,
  onCreate,
}) => {
  const accent = featured
    ? TYPE_ACCENTS[featured.type] || COLORS.live
    : COLORS.spotlight;
  const people = featured?.participants || [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Featured room"
      className="relative overflow-hidden rounded-3xl border p-6 sm:p-8 mb-6"
      style={{
        borderColor: `${accent}44`,
        background: `radial-gradient(120% 140% at 0% 0%, ${accent}26 0%, transparent 55%), radial-gradient(90% 120% at 100% 100%, ${COLORS.purple}22 0%, transparent 60%), ${COLORS.surface}`,
      }}
    >
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex-1 min-w-0">
          {featured ? (
            <>
              <span
                className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full"
                style={{ background: `${accent}22`, color: accent }}
              >
                <Equalizer color={accent} bars={3} height={12} />
                Happening now
              </span>
              <h2
                className="font-serif text-3xl sm:text-4xl mt-3 leading-tight break-words"
                style={{ color: COLORS.textPrimary }}
              >
                {featured.name}
              </h2>
              {featured.description && (
                <p
                  className="text-sm sm:text-base mt-2 max-w-xl line-clamp-2"
                  style={{ color: COLORS.textMuted }}
                >
                  {featured.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center -space-x-2">
                  {people.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold border-2"
                      style={{
                        background: `hsl(${hueFromString(p.user?.name || "?")}, 35%, 26%)`,
                        borderColor: COLORS.surface,
                        color: COLORS.textPrimary,
                      }}
                      title={p.user?.name}
                    >
                      {initials(p.user?.name || "?")}
                    </div>
                  ))}
                </div>
                <span className="text-sm" style={{ color: COLORS.textMuted }}>
                  {participantCount(featured)} talking
                  {featured.language ? ` · ${featured.language}` : ""}
                </span>
              </div>
            </>
          ) : (
            <>
              <span
                className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full"
                style={{ background: COLORS.spotlightDim, color: COLORS.spotlight }}
              >
                <Mic className="w-3 h-3" />
                Speak every day
              </span>
              <h2
                className="font-serif text-3xl sm:text-4xl mt-3 leading-tight"
                style={{ color: COLORS.textPrimary }}
              >
                It is quiet right now.
                <br />
                Start the conversation.
              </h2>
              <p
                className="text-sm sm:text-base mt-2 max-w-xl"
                style={{ color: COLORS.textMuted }}
              >
                Open a room, pick a topic, and practise speaking with people who
                are learning too.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:w-56 shrink-0">
          {featured ? (
            <button
              onClick={onJoinFeatured}
              disabled={isJoiningFeatured}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: accent, color: COLORS.void }}
            >
              {isJoiningFeatured ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              Join now
            </button>
          ) : (
            <button
              onClick={onCreate}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105"
              style={{ background: COLORS.spotlight, color: COLORS.void }}
            >
              <Plus className="w-4 h-4" />
              Create a room
            </button>
          )}

          <button
            onClick={onQuickJoin}
            disabled={!quickRoom}
            title={
              quickRoom
                ? `Jump into "${quickRoom.name}"`
                : "No open room with space right now"
            }
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm border transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimary }}
          >
            <Zap className="w-4 h-4" style={{ color: COLORS.spotlight }} />
            Quick join
          </button>
        </div>
      </div>
    </motion.section>
  );
};
