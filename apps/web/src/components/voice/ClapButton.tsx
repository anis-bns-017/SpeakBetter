// apps/web/src/components/voice/ClapButton.tsx
/**
 * ClapButton — prop-driven applause button.
 * Fires 👏 into the stage reactions (Feature 1) + tracks a local
 * per-session clap streak. No REST, no fake sockets.
 *
 * Particle behavior: emojis float up like soap bubbles — they rise,
 * sway side-to-side, expand as they climb, and pop-fade at the top.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { THEME } from "./VoiceRoomView.theme";

interface ClapButtonProps {
  /** Called when the user taps clap. Wire to sendStageReaction('👏') */
  onClap: () => void;
  /** Optional: called with the new streak when it changes */
  onStreakChange?: (streak: number) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Max claps per session before cooldown kicks in */
  maxClaps?: number;
  /** Cooldown between claps in ms */
  cooldownMs?: number;
  /** Show badge with remaining claps */
  showRemaining?: boolean;
}

interface BubbleParticle {
  id: number;
  drift: number; // final horizontal drift
  rise: number; // final upward rise (negative)
  emoji: string;
  rotate: number;
  scale: number;
  duration: number;
  delay: number;
}

export const ClapButton: React.FC<ClapButtonProps> = ({
  onClap,
  onStreakChange,
  className,
  size = "md",
  maxClaps = 1000,
  cooldownMs = 180,
  showRemaining = true,
}) => {
  const [userClaps, setUserClaps] = useState(0);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [isClapping, setIsClapping] = useState(false);
  const [localParticles, setLocalParticles] = useState<BubbleParticle[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);

  const particleId = useRef(0);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clapTimesRef = useRef<number[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sizeConfig = {
    sm: {
      button: "px-3 py-2 text-xs gap-1.5",
      icon: "text-base",
      count: "text-[10px]",
      particles: 5,
      bubbleSize: "text-2xl",
    },
    md: {
      button: "px-4 py-2.5 text-sm gap-2",
      icon: "text-xl",
      count: "text-xs",
      particles: 8,
      bubbleSize: "text-3xl",
    },
    lg: {
      button: "px-5 py-3.5 text-base gap-2.5",
      icon: "text-2xl",
      count: "text-sm",
      particles: 11,
      bubbleSize: "text-4xl",
    },
  } as const;

  const config = sizeConfig[size];

  // ----------------------------------------------------------
  // Streak calculation — counts claps within the last 2s
  // ----------------------------------------------------------
  const computeStreak = useCallback(() => {
    const now = Date.now();
    clapTimesRef.current = clapTimesRef.current.filter((t) => now - t < 2000);
    return clapTimesRef.current.length;
  }, []);

  const [streak, setStreak] = useState(0);

  useEffect(() => {
    onStreakChange?.(streak);
  }, [streak, onStreakChange]);

  const isOnFire = streak >= 5;

  // ----------------------------------------------------------
  // Bubble particles — rise + sway + grow + fade. No explosion.
  // ----------------------------------------------------------
  const spawnParticles = useCallback((count: number) => {
    // Bias toward 👏 since that's the clap gesture, but keep some variety
    const emojis = ["👏", "👏", "👏", "🎉", "✨", "💫", "⭐", "🌟"];
    const batch: BubbleParticle[] = [];

    for (let i = 0; i < count; i++) {
      batch.push({
        id: particleId.current++,
        // Gentle horizontal drift — bubbles wander, they don't shoot
        drift: (Math.random() - 0.5) * 140,
        // Always rise upward. Bubbles go up, not down.
        rise: -(220 + Math.random() * 260),
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        // Slow gentle rotation as it floats
        rotate: (Math.random() - 0.5) * 50,
        // Bubbles expand as they rise (less pressure)
        scale: 1.4 + Math.random() * 0.9,
        // Stagger duration for organic feel
        duration: 1.9 + Math.random() * 0.7,
        // Tiny stagger so they don't all leave at the exact same frame
        delay: Math.random() * 0.08,
      });
    }

    setLocalParticles((prev) => [...prev, ...batch]);

    // Cleanup — match the longest possible duration
    const maxLifeMs = Math.max(...batch.map((b) => b.duration)) * 1000 + 200;
    window.setTimeout(() => {
      setLocalParticles((prev) =>
        prev.filter((p) => !batch.some((b) => b.id === p.id)),
      );
    }, maxLifeMs);
  }, []);

  // ----------------------------------------------------------
  // Main handler
  // ----------------------------------------------------------
  const handleClap = useCallback(() => {
    if (isCoolingDown) return;

    if (userClaps >= maxClaps) {
      toast.info(
        "You're on fire! Take a breath and let others share the love 🔥",
        {
          duration: 2500,
        },
      );
      return;
    }

    // Record the clap time
    clapTimesRef.current.push(Date.now());
    const nextStreak = computeStreak();
    setStreak(nextStreak);

    // Local counter
    setUserClaps((prev) => prev + 1);
    setIsClapping(true);

    // Bubble burst — floats up like soap bubbles
    spawnParticles(config.particles);

    // Haptic on mobile
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        (navigator as any).vibrate?.(nextStreak >= 5 ? [10, 30, 10] : 10);
      } catch {
        /* ignore */
      }
    }

    // Fire onClap — parent sends to stage reactions
    onClap();

    // Reset animation
    window.setTimeout(() => setIsClapping(false), 220);

    // Cooldown
    setIsCoolingDown(true);
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => {
      setIsCoolingDown(false);
    }, cooldownMs);
  }, [
    isCoolingDown,
    userClaps,
    maxClaps,
    computeStreak,
    spawnParticles,
    config.particles,
    onClap,
    cooldownMs,
  ]);

  // ----------------------------------------------------------
  // Keyboard: Space/Enter when focused
  // ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== buttonRef.current) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleClap();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClap]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  const remaining = maxClaps - userClaps;
  const isMaxed = remaining <= 0;

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <div className={"relative inline-block " + (className ?? "")}>
      {/* Bubble particles — float upward, sway, grow, fade */}
      <AnimatePresence>
        {localParticles.map((p) => {
          // Sway keyframes: bubble wanders side to side as it rises.
          // 0% -> 30% -> 65% -> 100% of the drift creates an organic arc.
          const swayMid1 = p.drift * 0.4;
          const swayMid2 = p.drift * 0.75;
          return (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute left-1/2 top-1/2 z-50 select-none"
              initial={{
                opacity: 0,
                x: 0,
                y: 0,
                scale: 0.3,
                rotate: 0,
              }}
              animate={{
                opacity: [0, 1, 1, 0.65, 0],
                x: [0, swayMid1, swayMid2, p.drift],
                y: [0, p.rise * 0.3, p.rise * 0.65, p.rise * 0.92, p.rise],
                scale: [0.3, 0.85, p.scale * 0.85, p.scale, p.scale * 1.25],
                rotate: [0, p.rotate * 0.5, p.rotate, p.rotate * 1.2],
              }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: "easeOut",
                times: [0, 0.2, 0.5, 0.85, 1],
              }}
            >
              <span
                className={
                  config.bubbleSize +
                  " drop-shadow-[0_4px_12px_rgba(249,115,22,0.35)]"
                }
              >
                {p.emoji}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* On-fire badge with pulsing ring */}
      <AnimatePresence>
        {isOnFire && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-3 -right-3 z-10 pointer-events-none"
          >
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: `${THEME.colors.accent.warning}40`,
              }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <span className="relative text-lg animate-pulse">🔥</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-[10px] whitespace-nowrap pointer-events-none z-30"
            style={{
              background: THEME.colors.background.card,
              border: `1px solid ${THEME.colors.border.primary}`,
              color: THEME.colors.text.primary,
            }}
          >
            {isMaxed ? "You've clapped the max!" : `Clap · ${remaining} left`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glow ring behind button while clapping */}
      <AnimatePresence>
        {isClapping && (
          <motion.div
            key="glow-ring"
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              boxShadow: `0 0 30px 8px ${THEME.colors.accent.warning}55`,
              background: `${THEME.colors.accent.warning}22`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Button */}
      <motion.button
        ref={buttonRef}
        type="button"
        onClick={handleClap}
        disabled={isMaxed}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        animate={
          isClapping ? { scale: [1, 1.18, 0.95, 1.08, 1] } : { scale: 1 }
        }
        transition={
          isClapping ? { duration: 0.42, ease: "easeInOut" } : { duration: 0.2 }
        }
        whileHover={!isMaxed ? { scale: 1.04 } : undefined}
        whileTap={!isMaxed ? { scale: 0.94 } : undefined}
        className={
          "relative flex items-center justify-center rounded-full font-semibold " +
          "shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed " +
          config.button
        }
        style={{
          background: isMaxed
            ? "rgba(255,255,255,0.06)"
            : `linear-gradient(135deg, ${THEME.colors.accent.warning}, #f97316)`,
          color: isMaxed ? THEME.colors.text.muted : "#fff",
          boxShadow: isMaxed
            ? "none"
            : `0 6px 20px ${THEME.colors.accent.warning}55`,
        }}
        title={isMaxed ? "Clap limit reached" : "Clap for the speaker"}
      >
        <span className={config.icon}>👏</span>
        <span>Clap</span>

        {showRemaining && userClaps > 0 && (
          <span
            className={
              "rounded-full px-2 py-0.5 font-mono tabular-nums " + config.count
            }
            style={{
              background: isMaxed
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.22)",
              color: isMaxed ? THEME.colors.text.muted : "#fff",
            }}
          >
            {userClaps}
          </span>
        )}

        {/* Remaining badge on the corner */}
        {showRemaining && !isMaxed && userClaps >= 10 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center text-[9px] font-bold tabular-nums px-1"
            style={{
              borderColor: THEME.colors.background.primary,
              background: THEME.colors.accent.warning,
              color: "#0a0a12",
            }}
          >
            {remaining}
          </span>
        )}
      </motion.button>
    </div>
  );
};

export default ClapButton;
