// apps/web/src/components/common/SpeakBetterLogo.tsx
/**
 * The SpeakBetter logo. The mark is a speech bubble holding a rising equalizer: you speak, and it gets
 * better. It sits on an aurora tile that slowly turns, with a spark above the tallest bar.
 *
 * Motion lives in speakBetterLogo.css: an intro (bubble pops, bars grow, underline draws), a quiet idle loop
 * (the voice moves, the spark twinkles) and a hover burst (bounce, sound rings) on any `.group` parent.
 * Everything stays still for people who ask their system for reduced motion.
 */

import React, { useId } from "react";
import "./speakBetterLogo.css";
import { tr } from "../../i18n/core";

/** The bars, left to right: x, and height (they all stand on the same line) */
const BARS: Array<[number, number]> = [
  [13.7, 4.5],
  [18.2, 7],
  [22.7, 9.5],
  [27.2, 12],
  [31.7, 14.5],
];
const BAR_BOTTOM = 29.5;
const BAR_WIDTH = 2.6;

/** The bubble, with its tail at the lower left (48 x 48 grid) */
const BUBBLE =
  "M17 11H31A7 7 0 0 1 38 18V26A7 7 0 0 1 31 33H21L14.2 38.4C13.5 38.9 12.7 38.3 13 37.5L14.6 32.6A7 7 0 0 1 10 26V18A7 7 0 0 1 17 11Z";
/** A four-point spark */
const SPARK = "M40.5 4.5L41.6 8.4L45.5 9.5L41.6 10.6L40.5 14.5L39.4 10.6L35.5 9.5L39.4 8.4Z";

interface MarkProps {
  /** Pixels */
  size?: number;
  animated?: boolean;
  className?: string;
}

/** The mark alone: the tile with the bubble, bars and spark */
export const LogoMark: React.FC<MarkProps> = ({ size = 36, animated = true, className = "" }) => {
  const id = useId().replace(/:/g, "");
  const radius = Math.round(size * 0.3);
  return (
    <span
      className={`sb-logo ${animated ? "" : "sb-logo-still"} relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Glow and sound rings sit behind and around the tile */}
      <span className="sb-logo-glow pointer-events-none absolute -inset-2 rounded-full bg-violet-500/30 blur-lg" />
      {[0, 1].map((i) => (
        <span
          key={i}
          className="sb-logo-ring pointer-events-none absolute inset-0"
          style={{ borderRadius: radius, ["--i" as string]: i } as React.CSSProperties}
        />
      ))}

      <span
        className="relative block w-full h-full overflow-hidden shadow-md shadow-violet-500/15 ring-1 ring-white/20"
        style={{ borderRadius: radius }}
      >
        <span className="sb-logo-aurora absolute -inset-1/2 block" />
        {/* Light from the top left, so the tile has depth */}
        <span className="absolute inset-0 block bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.45),transparent_55%)]" />
        <svg viewBox="0 0 48 48" className="relative block w-full h-full">
          <defs>
            <linearGradient id={`${id}-bars`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#4f46e5" />
              <stop offset="0.55" stopColor="#7c3aed" />
              <stop offset="1" stopColor="#c026d3" />
            </linearGradient>
            <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#1e1b4b" floodOpacity="0.35" />
            </filter>
          </defs>
          {/* Two layers so the hover bounce never replays the pop-in */}
          <g className="sb-logo-bubble-in">
            <g className="sb-logo-bubble" filter={`url(#${id}-shadow)`}>
              <path d={BUBBLE} fill="#fff" />
              {BARS.map(([x, h], i) => (
                <rect
                  key={i}
                  className="sb-logo-bar"
                  style={{ ["--i" as string]: i } as React.CSSProperties}
                  x={x}
                  y={BAR_BOTTOM - h}
                  width={BAR_WIDTH}
                  height={h}
                  rx={BAR_WIDTH / 2}
                  fill={`url(#${id}-bars)`}
                />
              ))}
            </g>
          </g>
          <path className="sb-logo-spark" d={SPARK} fill="#fff" />
        </svg>
      </span>
    </span>
  );
};

/** The full logo for the sidebar: the mark, "SpeakBetter" with a drawn voice-wave underline, and the tagline */
export function SpeakBetterLogo({ animated = true }: { animated?: boolean }) {
  return (
    <span className={`sb-logo ${animated ? "" : "sb-logo-still"} group relative flex items-center gap-2.5 select-none`}>
      <LogoMark size={38} animated={animated} />
      <span className="sb-logo-fade relative min-w-0 text-left">
        <span className="block text-[17px] font-extrabold leading-none tracking-[-0.04em] text-slate-900 dark:text-white">
          {/* The brand name is never translated */}
          Speak<span className="relative inline-block">
            <span className="sb-logo-shimmer bg-clip-text text-transparent">Better</span>
            {/* A little voice wave draws itself under "Better" */}
            <svg viewBox="0 0 52 6" className="absolute left-0 -bottom-[5px] w-full h-[6px] overflow-visible" aria-hidden="true">
              <path
                className="sb-logo-wave"
                d="M1 3C4 3 5 1 8 1S12 5 15 5 19 1 22 1 26 5 29 5 33 1 36 1 40 5 43 5 47 3 51 3"
                fill="none"
                stroke="url(#sb-logo-wave-gradient)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="sb-logo-wave-gradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="#6366f1" />
                  <stop offset="1" stopColor="#d946ef" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </span>
        <span className="mt-2 block whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{tr("English · out loud")}</span>
      </span>
    </span>
  );
}
