// apps/web/src/components/voice/ClapButton.tsx
/**
 * ClapButton — prop-driven applause button.
 *
 * Tap to clap, or press and hold to keep applauding (it repeats, a touch faster the longer you hold). Each clap
 * only calls onClap: the 👏 burst that rises over the stage comes from the shared reaction pipeline
 * (shared/useStageReactions + ReactionOverlay), so a clap shows once, from one place, for you and for everyone.
 *
 * Pointer taps clap on press (not release) so it feels instant; keyboard Enter/Space clap through the native
 * click (detail === 0), so nothing ever fires twice.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { THEME } from "./VoiceRoomView.theme";
import { tr } from "../../i18n/core";

interface ClapButtonProps {
  /** Called on every clap. Wire to the shared reaction hook's clap() */
  onClap: () => void;
  /** Optional: called with the new streak when it changes */
  onStreakChange?: (streak: number) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Max claps per session before the button rests */
  maxClaps?: number;
  /** Minimum gap between claps in ms */
  cooldownMs?: number;
  /** Show badge with remaining claps */
  showRemaining?: boolean;
}

const SIZE_CONFIG = {
  sm: { button: "px-3.5 py-2 text-xs gap-1.5", icon: "text-base", count: "text-[11px]" },
  md: { button: "px-4 py-2.5 text-sm gap-2", icon: "text-xl", count: "text-xs" },
  lg: { button: "px-5 py-3.5 text-base gap-2.5", icon: "text-2xl", count: "text-sm" },
} as const;

/** Holding the button: wait this long, then repeat */
const HOLD_DELAY_MS = 340;
const HOLD_START_INTERVAL_MS = 170;
const HOLD_MIN_INTERVAL_MS = 95;
const STREAK_WINDOW_MS = 2000;

export const ClapButton: React.FC<ClapButtonProps> = ({
  onClap,
  onStreakChange,
  className,
  size = "md",
  maxClaps = 1000,
  cooldownMs = 110,
  showRemaining = true,
}) => {
  const [userClaps, setUserClaps] = useState(0);
  const [pulse, setPulse] = useState(0); // bumps on every clap to retrigger the ring
  const [showTooltip, setShowTooltip] = useState(false);
  const [streak, setStreak] = useState(0);

  const clapTimesRef = useRef<number[]>([]);
  const lastClapAtRef = useRef(0);
  const clapsRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef(0);
  const onClapRef = useRef(onClap);
  useEffect(() => {
    onClapRef.current = onClap;
  }, [onClap]);

  const config = SIZE_CONFIG[size];

  const computeStreak = useCallback(() => {
    const now = Date.now();
    clapTimesRef.current = clapTimesRef.current.filter((t) => now - t < STREAK_WINDOW_MS);
    return clapTimesRef.current.length;
  }, []);

  useEffect(() => {
    onStreakChange?.(streak);
  }, [streak, onStreakChange]);

  // The streak falls back to zero once you stop clapping
  useEffect(() => {
    if (streak === 0) return;
    const id = window.setTimeout(() => setStreak(computeStreak()), STREAK_WINDOW_MS + 100);
    return () => window.clearTimeout(id);
  }, [streak, computeStreak, pulse]);

  const isOnFire = streak >= 5;

  const doClap = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastClapAtRef.current < cooldownMs) return true; // too soon: skip quietly, keep holding
    if (clapsRef.current >= maxClaps) {
      toast.info(tr("You're on fire! Take a breath and let others share the love 🔥"), { id: "clap-max", duration: 2500 });
      return false;
    }
    lastClapAtRef.current = now;
    clapsRef.current += 1;
    clapTimesRef.current.push(now);
    setStreak(computeStreak());
    setUserClaps(clapsRef.current);
    setPulse((p) => p + 1);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(clapTimesRef.current.length >= 5 ? [8, 24, 8] : 8);
      } catch {
        /* ignore */
      }
    }
    onClapRef.current();
    return true;
  }, [cooldownMs, maxClaps, computeStreak]);

  const stopHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // The repeat loop lives in a ref so it can schedule itself without referring to its own declaration
  const scheduleHoldRef = useRef<(delay: number) => void>(() => {});
  useEffect(() => {
    scheduleHoldRef.current = (delay: number) => {
      holdTimerRef.current = window.setTimeout(() => {
        if (!doClap()) {
          stopHold();
          return;
        }
        // The longer you hold, the faster it applauds
        const held = Date.now() - holdStartRef.current;
        scheduleHoldRef.current(Math.max(HOLD_MIN_INTERVAL_MS, HOLD_START_INTERVAL_MS - held / 40));
      }, delay);
    };
  }, [doClap, stopHold]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      stopHold();
      if (!doClap()) return;
      holdStartRef.current = Date.now();
      scheduleHoldRef.current(HOLD_DELAY_MS);
    },
    [doClap, stopHold],
  );

  // Keyboard (Enter/Space) arrives as a click with detail 0; real pointer clicks were already handled on press
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) doClap();
    },
    [doClap],
  );

  // Let go anywhere, even off the button, and the hold ends
  useEffect(() => {
    window.addEventListener("pointerup", stopHold);
    window.addEventListener("pointercancel", stopHold);
    window.addEventListener("blur", stopHold);
    return () => {
      window.removeEventListener("pointerup", stopHold);
      window.removeEventListener("pointercancel", stopHold);
      window.removeEventListener("blur", stopHold);
      stopHold();
    };
  }, [stopHold]);

  const remaining = maxClaps - userClaps;
  const isMaxed = remaining <= 0;

  return (
    <div className={"relative inline-block " + (className ?? "")}>
      {/* On-fire badge with pulsing ring */}
      <AnimatePresence>
        {isOnFire && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 24 }}
            className="pointer-events-none absolute -right-3 -top-3 z-10"
          >
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "rgb(251 113 133 / 0.3)" }}
              animate={{ scale: [1, 1.55, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative text-lg">🔥</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px]"
            style={{
              background: THEME.colors.background.card,
              border: `1px solid ${THEME.colors.border.primary}`,
              color: THEME.colors.text.primary,
            }}
          >
            {isMaxed ? tr("You've clapped the max!") : tr("Tap to clap · hold to keep clapping")}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ring: a fresh one on every clap, so a fast clapper sees a continuous ripple */}
      {pulse > 0 && (
        <span
          key={pulse}
          aria-hidden
          className="vr-clap-ring pointer-events-none absolute inset-0 rounded-full"
        />
      )}

      <motion.button
        type="button"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
        disabled={isMaxed}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        whileHover={!isMaxed ? { y: -1 } : undefined}
        whileTap={!isMaxed ? { scale: 0.92, y: 1 } : undefined}
        transition={{ type: "spring", stiffness: 600, damping: 22 }}
        className={
          "vr-clap relative flex touch-manipulation select-none items-center justify-center overflow-hidden rounded-full font-bold " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:cursor-not-allowed disabled:opacity-50 " +
          (isMaxed ? "" : "vr-sheen ") +
          config.button
        }
        data-streak={Math.min(streak, 8)}
        style={{
          background: isMaxed ? "var(--sx-bg-255-255-255-60)" : "linear-gradient(135deg, #fcd34d 0%, #fb923c 55%, #fb7185 100%)",
          color: isMaxed ? THEME.colors.text.muted : "#2a0f06",
          boxShadow: isMaxed
            ? "none"
            : "0 10px 26px -8px rgb(251 113 133 / 0.65), 0 2px 0 rgb(180 60 40 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.55)",
        }}
        aria-label={isMaxed ? tr("Clap limit reached") : tr("Clap for the speaker")}
      >
        <motion.span
          key={pulse}
          className={"inline-block origin-bottom " + config.icon}
          initial={pulse > 0 ? { rotate: -22, scale: 1.25 } : false}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 700, damping: 14 }}
        >
          👏
        </motion.span>
        <span>{tr("Clap")}</span>

        {showRemaining && userClaps > 0 && (
          <span
            className={"rounded-full px-2 py-0.5 font-mono tabular-nums " + config.count}
            style={{ background: "rgb(42 15 6 / 0.14)", color: isMaxed ? THEME.colors.text.muted : "#2a0f06" }}
          >
            {userClaps}
          </span>
        )}

        {showRemaining && !isMaxed && userClaps >= 10 && (
          <span
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 px-1 text-[9px] font-bold tabular-nums"
            style={{ borderColor: THEME.colors.background.primary, background: "#2a0f06", color: "#fcd34d" }}
          >
            {remaining}
          </span>
        )}
      </motion.button>
    </div>
  );
};

export default ClapButton;
