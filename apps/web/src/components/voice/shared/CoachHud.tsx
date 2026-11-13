// apps/web/src/components/voice/shared/CoachHud.tsx
/**
 * CoachHud — a small always-visible card with your live fluency, so the coach
 * is part of the room and not hidden behind a button. Click to open the full panel.
 */

import React from "react";
import { Gauge } from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type { CoachTip, FluencySnapshot } from "../../../hooks/useRoomCoach";
import { useNow } from "../../../hooks/useNow";
import { tr } from "../../../i18n/core";

interface CoachHudProps {
  live: FluencySnapshot | null;
  tip: (CoachTip & { at: number }) | null;
  onOpen: () => void;
}

const RADIUS = 18;
const CIRC = 2 * Math.PI * RADIUS;

const ringColor = (score: number) =>
  score >= 75
    ? THEME.colors.accent.success
    : score >= 50
      ? THEME.colors.accent.warning
      : THEME.colors.accent.error;

/** How long a tip stays in the HUD */
const TIP_VISIBLE_MS = 25_000;

export const CoachHud: React.FC<CoachHudProps> = ({ live, tip, onOpen }) => {
  const now = useNow(5_000);
  if (!live || live.words === 0) return null;

  const score = live.fluency;
  const showTip = tip && now - tip.at < TIP_VISIBLE_MS;

  return (
    <button
      onClick={onOpen}
      aria-label={tr("Open room coach. Fluency {value}", { value: score ?? "not yet measured" })}
      className="fixed bottom-36 left-4 z-20 hidden md:flex items-center gap-3 rounded-2xl border px-3 py-2 text-left backdrop-blur-xl transition-transform hover:scale-[1.02]"
      style={{
        background: "var(--sx-bg-10-10-18-850)",
        borderColor: THEME.colors.border.primary,
        maxWidth: 270,
      }}
    >
      <div className="relative w-11 h-11 shrink-0">
        <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={RADIUS} fill="none" stroke="var(--sx-bg-255-255-255-80)" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r={RADIUS}
            fill="none"
            stroke={score === null ? "var(--sx-bg-255-255-255-200)" : ringColor(score)}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - (score ?? 0) / 100)}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-bold"
          style={{ color: THEME.colors.text.primary }}
        >
          {score ?? <Gauge className="w-4 h-4" style={{ color: THEME.colors.text.muted }} />}
        </span>
      </div>

      <div className="min-w-0">
        <div className="text-[11px] font-semibold" style={{ color: THEME.colors.text.primary }}>
          {tr("Your fluency")}</div>
        <div className="text-[11px]" style={{ color: THEME.colors.text.muted }}>
          {live.wpm !== null ? tr("{wpm} wpm · ", { wpm: live.wpm }) : ""}
          {tr("{fillerCount} filler{value} · {words} words", { fillerCount: live.fillerCount, value: live.fillerCount === 1 ? "" : "s", words: live.words })}</div>
        {showTip && (
          <div className="mt-1 text-[11px] leading-snug line-clamp-2" style={{ color: THEME.colors.accent.warning }}>
            💡 {tr(tip.text)}
          </div>
        )}
      </div>
    </button>
  );
};

export default CoachHud;
