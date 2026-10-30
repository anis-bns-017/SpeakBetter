// apps/web/src/components/voice/shared/SpotlightBanner.tsx
/**
 * SpotlightBanner — a topic card the host pushed to the room, aimed at one person
 * (or at everyone). The spotlighted person sees a stronger "your turn" version.
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Focus, MessageCircle } from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type { Spotlight } from "../../../hooks/useRoomCoach";

interface SpotlightBannerProps {
  spotlight: Spotlight | null;
  userId: string;
  onDismiss: () => void;
}

/** How long a card stays up if nobody closes it */
const AUTO_HIDE_MS = 90_000;

export const SpotlightBanner: React.FC<SpotlightBannerProps> = ({
  spotlight,
  userId,
  onDismiss,
}) => {
  useEffect(() => {
    if (!spotlight) return;
    const t = window.setTimeout(onDismiss, AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [spotlight, onDismiss]);

  const mine = spotlight?.target?.userId === userId;

  return (
    <AnimatePresence>
      {spotlight && (
        <motion.div
          key={spotlight.id}
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
<<<<<<< HEAD
          className="fixed top-48 left-1/2 -translate-x-1/2 z-[85] w-[min(94vw,520px)] rounded-2xl border shadow-2xl backdrop-blur-xl"
=======
          className="fixed top-36 left-1/2 -translate-x-1/2 z-[85] w-[min(94vw,520px)] rounded-2xl border shadow-2xl backdrop-blur-xl"
>>>>>>> 2112bb78e7a1183ce9019860e0879b2b233dd4cf
          style={{
            background: mine ? "rgba(40,30,8,0.95)" : "rgba(14,14,26,0.95)",
            borderColor: mine ? "rgba(251,191,36,0.5)" : THEME.colors.border.accent,
            boxShadow: mine ? "0 0 40px rgba(251,191,36,0.2)" : THEME.shadow.xl,
          }}
          role="status"
          aria-live="polite"
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                {mine ? (
                  <Focus className="w-4 h-4" style={{ color: THEME.colors.accent.warning }} />
                ) : (
                  <MessageCircle className="w-4 h-4" style={{ color: THEME.colors.accent.primaryLight }} />
                )}
                <span style={{ color: mine ? THEME.colors.accent.warning : THEME.colors.accent.primaryLight }}>
                  {mine
                    ? "Your turn!"
                    : spotlight.target
                      ? `Spotlight: ${spotlight.target.name}`
                      : "Topic for everyone"}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{ background: "rgba(255,255,255,0.08)", color: THEME.colors.text.muted }}
                >
                  {spotlight.card.level}
                </span>
              </div>
              <button
                onClick={onDismiss}
                aria-label="Dismiss topic card"
                className="p-1 rounded-lg hover:bg-white/5"
                style={{ color: THEME.colors.text.muted }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-sm font-semibold mb-2" style={{ color: THEME.colors.text.primary }}>
              {spotlight.card.prompt}
            </p>

            {spotlight.card.followUps.length > 0 && (
              <ul className="text-xs space-y-0.5 mb-2" style={{ color: THEME.colors.text.secondary }}>
                {spotlight.card.followUps.map((q) => (
                  <li key={q}>• {q}</li>
                ))}
              </ul>
            )}

            {spotlight.card.vocab.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {spotlight.card.vocab.map((v) => (
                  <span
                    key={v}
                    className="px-2 py-0.5 rounded-full text-[11px]"
                    style={{ background: "rgba(99,102,241,0.14)", color: THEME.colors.accent.primaryLight }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SpotlightBanner;
