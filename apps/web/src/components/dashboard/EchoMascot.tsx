// apps/web/src/components/dashboard/EchoMascot.tsx
/**
 * Echo, the dashboard's practice buddy: a small speech bubble with a face, living in the hero panel.
 *
 * Every movement says something about the learner's day:
 *   - wave:    the first visit of the day (once), with a hello
 *   - cheer:   the daily goal is done (a hop and sparkles once a day, then happy eyes)
 *   - hopeful: a streak is waiting for today's practice (raised brows, a pulsing antenna)
 *   - sleepy:  late at night (heavy eyes, drifting z's)
 *   - idle:    breathing, blinking, eyes that follow the pointer
 * Tapping Echo squishes it and it says a tip; while it talks, the hero's waveform moves (see onTalkingChange).
 *
 * Loops are CSS (styles/mascot.css); gestures are Motion springs. Reduced motion keeps the expressions and the
 * words and drops the movement.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useSpring } from "framer-motion";
import { tr } from "../../i18n/core";

export type EchoMood = "wave" | "cheer" | "hopeful" | "sleepy" | "idle";

interface Props {
  mood: EchoMood;
  /** What Echo says when tapped, in order (it cycles) */
  lines: string[];
  /** Said once on the first visit of the day (wave) or when the goal is first done (cheer) */
  greeting?: string;
  reduced: boolean;
  /** True while the speech bubble is showing, so the page can make the waveform "speak" too */
  onTalkingChange?: (talking: boolean) => void;
  className?: string;
  /**
   * Keeps this Echo's once-a-day hello and cheer apart from the dashboard's ("landing" on the home page).
   * "never" turns them off.
   */
  scope?: string;
}

const SAY_MS = 4600;
const SPRING = { type: "spring", stiffness: 260, damping: 16 } as const;
/** How far the pupils may move toward the pointer, in SVG units */
const LOOK = 3.5;

const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** True the first time `name` is asked for today on this device */
function firstToday(name: string): boolean {
  try {
    const key = `sb.echo.${name}`;
    if (name.startsWith("never.")) return false;
    if (localStorage.getItem(key) === dayKey()) return false;
    localStorage.setItem(key, dayKey());
    return true;
  } catch {
    return false;
  }
}

/** Little four-point stars that burst out around Echo when the goal is done */
const SPARKS = [
  { x: -46, y: -38, r: 0, s: 1 },
  { x: 48, y: -44, r: 20, s: 0.8 },
  { x: -58, y: 6, r: 10, s: 0.7 },
  { x: 60, y: 0, r: -10, s: 1 },
  { x: -30, y: -62, r: 30, s: 0.6 },
  { x: 32, y: -64, r: -20, s: 0.75 },
];
const STAR = "M0 -7 C1 -2 2 -1 7 0 C2 1 1 2 0 7 C-1 2 -2 1 -7 0 C-2 -1 -1 -2 0 -7 Z";

export const EchoMascot: React.FC<Props> = ({ mood, lines, greeting, reduced, onTalkingChange, className, scope }) => {
  const key = (name: string) => (scope ? `${scope}.${name}` : name);
  const [line, setLine] = useState<string | null>(null);
  const [sparkle, setSparkle] = useState(false);
  const [waving, setWaving] = useState(false);
  const nextLine = useRef(0);
  const hideTimer = useRef<number | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  const body = useAnimationControls();

  // Eyes follow the pointer, on a soft spring
  const lookX = useMotionValue(0);
  const lookY = useMotionValue(0);
  const eyeX = useSpring(lookX, { stiffness: 180, damping: 18 });
  const eyeY = useSpring(lookY, { stiffness: 180, damping: 18 });

  const say = useCallback(
    (text: string) => {
      window.clearTimeout(hideTimer.current);
      setLine(text);
      hideTimer.current = window.setTimeout(() => setLine(null), SAY_MS);
    },
    [],
  );

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);
  useEffect(() => onTalkingChange?.(line !== null), [line, onTalkingChange]);

  // Hopeful Echo glances toward the main button (left); otherwise it watches the pointer
  useEffect(() => {
    if (reduced || mood === "sleepy") {
      lookX.set(mood === "hopeful" ? -LOOK : 0);
      lookY.set(0);
      return;
    }
    if (mood === "hopeful") {
      lookX.set(-LOOK);
      lookY.set(-1);
    }
    if (!window.matchMedia?.("(pointer: fine)").matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const update = () => {
      frame = 0;
      const svg = svgRef.current;
      if (!svg || !last) return;
      const box = svg.getBoundingClientRect();
      const dx = last.clientX - (box.left + box.width / 2);
      const dy = last.clientY - (box.top + box.height * 0.45);
      const dist = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, dist / 260);
      lookX.set((dx / dist) * LOOK * pull);
      lookY.set((dy / dist) * LOOK * pull);
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mood, reduced, lookX, lookY]);

  // The day's first visit: wave hello. The goal's first completion: anticipation dip, hop, sparkles.
  // Starts a moment after the page settles; the once-a-day check runs then too, so a cancelled start
  // (React's dev double-run) doesn't use it up.
  useEffect(() => {
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    later(() => {
      if (mood === "cheer" && firstToday(key("cheered"))) {
        if (greeting) say(greeting);
        if (reduced) return;
        setSparkle(true);
        void body.start({
          y: [0, 5, -22, 0, -6, 0],
          scaleX: [1, 1.08, 0.94, 1.06, 0.98, 1],
          scaleY: [1, 0.9, 1.08, 0.94, 1.02, 1],
          transition: { duration: 1.1, times: [0, 0.15, 0.42, 0.66, 0.82, 1], ease: "easeOut" },
        });
        later(() => setSparkle(false), 1400);
      } else if (mood !== "cheer" && firstToday(key("greeted"))) {
        if (greeting) say(greeting);
        if (reduced) return;
        setWaving(true);
        later(() => setWaving(false), 2400);
      }
    }, 500);
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Only on arrival: later mood changes don't replay these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTap = () => {
    if (!reduced) {
      void body.start({
        scaleX: [1, 1.12, 0.95, 1.02, 1],
        scaleY: [1, 0.84, 1.07, 0.98, 1],
        transition: { duration: 0.55, ease: "easeOut" },
      });
    }
    if (lines.length) {
      say(lines[nextLine.current % lines.length]);
      nextLine.current++;
    }
  };

  const happy = mood === "cheer";
  const sleepy = mood === "sleepy";
  const armsUp = happy && sparkle;
  const rightArm = armsUp ? -150 : waving ? [-150, -115, -155, -115, -150] : 0;
  const leftArm = armsUp ? 150 : 0;
  const label = useMemo(() => "Echo, your practice buddy. Tap for a tip.", []);

  return (
    <div className={`relative ${className ?? ""}`}>
      {/* What Echo says: kept mounted so screen readers hear each new line */}
      <div role="status" aria-live="polite" className="pointer-events-none absolute right-[86%] top-0 z-10 flex justify-end">
        <AnimatePresence>
          {line && (
            <motion.p
              key={line}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, x: 12 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 24 }}
              style={{ originX: 1, originY: 0.3 }}
              className="relative w-max max-w-[180px] sm:max-w-[220px] rounded-2xl rounded-tr-md bg-white px-3 py-2 text-[13px] font-medium leading-snug text-indigo-950 shadow-lg"
            >
              {line}
              <span aria-hidden className="absolute -right-1.5 top-3 h-3 w-3 rotate-45 rounded-sm bg-white" />
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={onTap}
        aria-label={tr(label)}
        className="group block w-full cursor-pointer touch-manipulation rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-900"
      >
        <svg ref={svgRef} viewBox="0 0 160 168" className={`echo-svg block w-full overflow-visible ${mood === "hopeful" ? "echo-hopeful" : ""}`} aria-hidden>
          <ellipse className={`fill-black ${reduced ? "" : "echo-shadow"}`} cx="80" cy="158" rx="36" ry="6" opacity="0.25" />

          <g className={reduced ? "" : "echo-float"}>
            <motion.g animate={body} style={{ originX: 0.5, originY: 1 }}>
              {/* Antenna: trails the body a beat behind */}
              <g className={reduced ? "" : "echo-antenna"}>
                <path d="M80 34 C79 24 84 16 92 13" fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-amber-50" />
                <circle className="echo-antenna-dot fill-amber-400" cx="93" cy="12" r="6.5" />
              </g>

              {/* Arms behind the body, raised from the shoulder */}
              <motion.path
                d="M33 96 C21 100 16 108 18 116"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-amber-50"
                style={{ originX: 1, originY: 0 }}
                animate={{ rotate: leftArm }}
                transition={SPRING}
              />
              <motion.path
                d="M127 96 C139 100 144 108 142 116"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-amber-50"
                style={{ originX: 0, originY: 0 }}
                animate={{ rotate: rightArm }}
                transition={waving && !armsUp ? { duration: 2, ease: "easeInOut" } : SPRING}
              />

              {/* Body: a speech bubble with its tail */}
              <path d="M54 114 L36 146 L80 122 Z" strokeWidth="8" strokeLinejoin="round" className="fill-amber-50 stroke-amber-50" />
              <rect x="28" y="32" width="104" height="96" rx="44" className="fill-amber-50" />
              <ellipse cx="56" cy="52" rx="14" ry="7" transform="rotate(-24 56 52)" className="fill-white" opacity="0.75" />

              {/* Cheeks */}
              <ellipse cx="47" cy="94" rx="8.5" ry="5" className="fill-rose-300" opacity={happy ? 0.85 : 0.55} />
              <ellipse cx="113" cy="94" rx="8.5" ry="5" className="fill-rose-300" opacity={happy ? 0.85 : 0.55} />

              {/* Brows: up when hopeful */}
              <AnimatePresence>
                {mood === "hopeful" && (
                  <motion.g initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <path d="M53 63 Q60 58 67 61" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-slate-900" />
                    <path d="M93 61 Q100 58 107 63" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-slate-900" />
                  </motion.g>
                )}
              </AnimatePresence>

              {/* Eyes */}
              {happy ? (
                <g fill="none" strokeWidth="4.5" strokeLinecap="round" className="stroke-slate-900">
                  <path d="M53 81 Q61 71 69 81" />
                  <path d="M91 81 Q99 71 107 81" />
                </g>
              ) : sleepy ? (
                <g fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-slate-900">
                  <path d="M53 78 Q61 85 69 78" />
                  <path d="M91 78 Q99 85 107 78" />
                </g>
              ) : (
                <motion.g style={{ x: eyeX, y: eyeY }}>
                  <g className={reduced ? "" : "echo-blink"}>
                    <ellipse cx="61" cy="78" rx="7.5" ry="9.5" className="fill-slate-900" />
                    <ellipse cx="99" cy="78" rx="7.5" ry="9.5" className="fill-slate-900" />
                    <circle cx="63.5" cy="74" r="2.6" className="fill-white" />
                    <circle cx="101.5" cy="74" r="2.6" className="fill-white" />
                  </g>
                </motion.g>
              )}

              {/* Mouth: talking, grinning, sleepy or a smile */}
              {line ? (
                <ellipse cx="80" cy="100" rx="7" ry="6" className={`fill-slate-900 ${reduced ? "" : "echo-talk"}`} />
              ) : happy ? (
                <path d="M68 96 Q80 112 92 96 Z" strokeWidth="2.5" strokeLinejoin="round" className="fill-slate-900 stroke-slate-900" />
              ) : sleepy ? (
                <ellipse cx="80" cy="100" rx="4" ry="3" className="fill-slate-900" />
              ) : (
                <path d="M70 97 Q80 106 90 97" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-slate-900" />
              )}
            </motion.g>
          </g>

          {sleepy && (
            <g className="fill-amber-50 font-display" fontWeight="700">
              <text className="echo-z" x="122" y="40" fontSize="14">z</text>
              <text className="echo-z" x="130" y="30" fontSize="11">z</text>
              <text className="echo-z" x="136" y="20" fontSize="9">z</text>
            </g>
          )}

          <AnimatePresence>
            {sparkle &&
              SPARKS.map((s, i) => (
                <motion.path
                  key={i}
                  d={STAR}
                  className={i % 2 ? "fill-amber-300" : "fill-white"}
                  initial={{ x: 80, y: 70, scale: 0, rotate: 0, opacity: 1 }}
                  animate={{ x: 80 + s.x, y: 70 + s.y, scale: [0, s.s * 1.4, s.s], rotate: s.r + 90, opacity: [1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, delay: 0.35 + i * 0.03, ease: "easeOut" }}
                />
              ))}
          </AnimatePresence>
        </svg>
      </button>
    </div>
  );
};

export default EchoMascot;
