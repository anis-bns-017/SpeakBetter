// apps/web/src/components/voice/shared/MissionBar.tsx
/**
 * MissionBar — while a secret-word round is running: countdown, your word (hidden until
 * you tap, so a shared screen doesn't give it away) and how many people have finished.
 * MissionCelebration — a burst for the whole room when anyone completes theirs.
 */

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Target, Eye, EyeOff } from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type {
  MissionCompletion,
  MissionPrivate,
  MissionPublic,
} from "../../../hooks/useRoomCoach";

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

interface MissionBarProps {
  mission: MissionPublic | null;
  myMission: MissionPrivate | null;
  onOpen: () => void;
}

export const MissionBar: React.FC<MissionBarProps> = ({ mission, myMission, onOpen }) => {
  const [now, setNow] = useState(() => Date.now());
  const [reveal, setReveal] = useState(false);
  const active = Boolean(mission);

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [active]);

  // A new word (new round or a swap) starts hidden again
  const word = myMission?.word;
  useEffect(() => setReveal(false), [word]);

  if (!mission) return null;

  const left = mission.endsAt - now;
  const done = mission.completed.length;
  const pct = mission.total ? Math.round((done / mission.total) * 100) : 0;
  const urgent = left < 30_000;

  return (
    <div
      className="fixed top-36 left-4 z-30 hidden md:block w-[250px] rounded-2xl border p-3 backdrop-blur-xl"
      style={{
        background: "rgba(10,10,18,0.88)",
        borderColor: "rgba(99,102,241,0.35)",
        boxShadow: "0 0 30px rgba(99,102,241,0.12)",
      }}
      role="status"
      aria-label="Secret word mission"
    >
      <div className="flex items-center justify-between mb-2">
        <button onClick={onOpen} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: THEME.colors.accent.primaryLight }}>
          <Target className="w-3.5 h-3.5" /> Mission · {mission.level}
        </button>
        <span
          className={`font-mono text-xs font-bold ${urgent ? "animate-pulse" : ""}`}
          style={{ color: urgent ? THEME.colors.accent.error : THEME.colors.accent.warning }}
        >
          {fmtClock(left)}
        </span>
      </div>

      {myMission ? (
        myMission.completed ? (
          <div className="text-sm font-bold" style={{ color: THEME.colors.accent.success }}>
            ✅ “{myMission.word}” +{myMission.points} XP
          </div>
        ) : (
          <button
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide my secret word" : "Show my secret word"}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <span
              className="text-base font-bold transition-[filter]"
              style={{ color: THEME.colors.text.primary, filter: reveal ? "none" : "blur(7px)" }}
            >
              {myMission.word}
            </span>
            {reveal ? (
              <EyeOff className="w-4 h-4" style={{ color: THEME.colors.text.muted }} />
            ) : (
              <Eye className="w-4 h-4" style={{ color: THEME.colors.text.muted }} />
            )}
          </button>
        )
      ) : (
        <div className="text-xs" style={{ color: THEME.colors.text.muted }}>
          You're not in this round.
        </div>
      )}

      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: THEME.colors.text.muted }}>
          <span>
            {done}/{mission.total} finished
          </span>
          {mission.completed[0] && <span>🥇 {mission.completed[0].userName}</span>}
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: THEME.colors.gradient.primary }}
          />
        </div>
      </div>
    </div>
  );
};

const CONFETTI = ["🎉", "✨", "🎯", "⭐", "🎊", "💫"];

interface CelebrationProps {
  celebration: (MissionCompletion & { key: string }) | null;
  userId: string;
  onDone: () => void;
}

const SHOW_MS = 3600;

export const MissionCelebration: React.FC<CelebrationProps> = ({ celebration, userId, onDone }) => {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!celebration) return;
    const t = window.setTimeout(onDone, SHOW_MS);
    return () => window.clearTimeout(t);
  }, [celebration, onDone]);

  const mine = celebration?.userId === userId;

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          key={celebration.key}
          className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {!reduceMotion &&
            Array.from({ length: 22 }).map((_, i) => {
              const angle = (i / 22) * Math.PI * 2;
              const dist = 160 + (i % 5) * 45;
              return (
                <motion.span
                  key={i}
                  className="absolute text-2xl"
                  initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist + 60,
                    scale: 1,
                    opacity: 0,
                    rotate: (i % 2 ? 1 : -1) * 120,
                  }}
                  transition={{ duration: 1.6, ease: "easeOut", delay: (i % 4) * 0.04 }}
                >
                  {CONFETTI[i % CONFETTI.length]}
                </motion.span>
              );
            })}
          <motion.div
            initial={{ scale: 0.7, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 16, stiffness: 260 }}
            className="rounded-3xl border px-7 py-5 text-center backdrop-blur-xl"
            style={{
              background: mine ? "rgba(20,36,28,0.95)" : "rgba(14,14,26,0.95)",
              borderColor: mine ? "rgba(52,211,153,0.5)" : THEME.colors.border.accent,
              boxShadow: mine ? "0 0 60px rgba(52,211,153,0.25)" : THEME.shadow.glowStrong,
            }}
          >
            <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: THEME.colors.text.muted }}>
              Mission complete · #{celebration.place}
            </div>
            <div className="text-xl font-bold" style={{ color: THEME.colors.text.primary }}>
              {mine ? "You" : celebration.userName} used “{celebration.word}”!
            </div>
            <div className="text-xs mt-1" style={{ color: THEME.colors.text.secondary }}>
              {celebration.meaning}
            </div>
            <div className="text-sm font-bold mt-2" style={{ color: THEME.colors.accent.success }}>
              +{celebration.points} XP
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
