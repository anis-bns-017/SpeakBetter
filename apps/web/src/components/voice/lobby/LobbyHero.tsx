// apps/web/src/components/voice/lobby/LobbyHero.tsx
import React from "react";
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

/** Live pill: a calm expanding dot (styles/voice-stage.css) next to the label */
const Eyebrow: React.FC<{ color: string; children: React.ReactNode; live?: boolean }> = ({ color, children, live }) => (
  <span
    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
    style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
  >
    {live ? <Equalizer color={color} bars={3} height={12} /> : <Mic className="h-3 w-3" aria-hidden />}
    {children}
  </span>
);

export const LobbyHero: React.FC<LobbyHeroProps> = ({ featured, quickRoom, isJoiningFeatured, onJoinFeatured, onQuickJoin, onCreate }) => {
  const accent = featured ? TYPE_ACCENTS[featured.type] || COLORS.live : COLORS.primary;
  const people = featured?.participants || [];

  return (
    <section
      aria-label="Featured room"
      className="vr-edge vr-enter relative mb-6 overflow-hidden rounded-[28px] border p-6 sm:p-9"
      style={{
        ["--vr-enter-delay" as string]: "80ms",
        borderColor: `color-mix(in srgb, ${accent} 24%, ${COLORS.border})`,
        background: `radial-gradient(90% 140% at 0% 0%, color-mix(in srgb, ${accent} 16%, transparent) 0%, transparent 60%), radial-gradient(70% 120% at 100% 100%, color-mix(in srgb, ${COLORS.purple} 14%, transparent) 0%, transparent 62%), ${COLORS.surface}`,
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          {featured ? (
            <>
              <Eyebrow color={accent} live>
                Happening now
              </Eyebrow>
              <h2 className="mt-4 break-words text-[32px] font-semibold leading-[1.08] tracking-tight sm:text-[46px]" style={{ color: COLORS.textPrimary }}>
                {featured.name}
              </h2>
              {featured.description && (
                <p className="mt-3 line-clamp-2 max-w-xl text-[15px] leading-relaxed sm:text-base" style={{ color: COLORS.textMuted }}>
                  {featured.description}
                </p>
              )}
              <div className="mt-5 flex items-center gap-3">
                <div className="flex items-center -space-x-2.5">
                  {people.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-semibold shadow-sm"
                      style={{ background: `hsl(${hueFromString(p.user?.name || "?")}, 38%, 30%)`, borderColor: COLORS.surface, color: "#fff" }}
                      title={p.user?.name}
                    >
                      {initials(p.user?.name || "?")}
                    </div>
                  ))}
                </div>
                <span className="text-sm font-medium" style={{ color: COLORS.textMuted }}>
                  {participantCount(featured)} talking
                  {featured.language ? ` · ${featured.language}` : ""}
                </span>
              </div>
            </>
          ) : (
            <>
              <Eyebrow color={COLORS.primary}>Speak every day</Eyebrow>
              <h2 className="mt-4 text-[32px] font-semibold leading-[1.08] tracking-tight sm:text-[46px]" style={{ color: COLORS.textPrimary }}>
                It is quiet right now.
                <br />
                Start the conversation.
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed sm:text-base" style={{ color: COLORS.textMuted }}>
                Open a room, pick a topic, and practise speaking with people who are learning too.
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:w-56 lg:flex-col">
          {featured ? (
            <button
              type="button"
              onClick={onJoinFeatured}
              disabled={isJoiningFeatured}
              className="inline-flex min-h-12 items-center sm:flex-1 lg:flex-none justify-center gap-2 rounded-full px-6 text-sm font-semibold shadow-md transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
              style={{ background: accent, color: COLORS.void }}
            >
              {isJoiningFeatured ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Join now
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex min-h-12 items-center sm:flex-1 lg:flex-none justify-center gap-2 rounded-full bg-indigo-600 px-6 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.03] hover:bg-indigo-700 active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <Plus className="h-4 w-4" />
              Create a room
            </button>
          )}

          <button
            type="button"
            onClick={onQuickJoin}
            disabled={!quickRoom}
            title={quickRoom ? `Jump into "${quickRoom.name}"` : "No open room with space right now"}
            className="inline-flex min-h-12 items-center sm:flex-1 lg:flex-none justify-center gap-2 rounded-full border px-6 text-sm font-semibold transition-colors hover:bg-slate-900/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5"
            style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimary, background: "var(--sx-bg-28-20-48-600)" }}
          >
            <Zap className="h-4 w-4" style={{ color: COLORS.spotlight }} />
            Quick join
          </button>
        </div>
      </div>
    </section>
  );
};
