// apps/web/src/components/voice/shared/StageReactionBar.tsx
import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SmilePlus, X } from "lucide-react";
import { tr } from "../../../i18n/core";

const QUICK_EMOJIS = ["❤️", "🔥", "👏", "😂", "🎉", "💯", "🙌", "😮"];
const ALL_EMOJIS = [
  "❤️",
  "🔥",
  "👏",
  "😂",
  "🎉",
  "💯",
  "🙌",
  "😮",
  "🥳",
  "😍",
  "🤯",
  "💪",
  "✨",
  "🚀",
  "🤝",
  "☕",
  "🙏",
  "😭",
  "😎",
  "💖",
  "🌟",
  "⚡",
  "🎯",
  "🧠",
];

interface StageReactionBarProps {
  onSend: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Floating bar at bottom-center of the stage.
 * Default: shows 8 quick emojis. Tap the "+" to reveal all 24.
 * Rate-limited — one emoji per 250ms per user.
 */
export const StageReactionBar: React.FC<StageReactionBarProps> = ({
  onSend,
  disabled = false,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const lastSentAt = useRef(0);
  const RATE_LIMIT_MS = 250;

  const handleSend = useCallback(
    (emoji: string) => {
      if (disabled) return;
      const now = Date.now();
      if (now - lastSentAt.current < RATE_LIMIT_MS) return;
      lastSentAt.current = now;
      onSend(emoji);
    },
    [onSend, disabled],
  );

  return (
    <div
      className={
        "pointer-events-none absolute right-4 bottom-4 z-[65] flex justify-end " +
        (className ?? "")
      }
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="pointer-events-auto flex items-center gap-1 rounded-full border px-2.5 py-2 shadow-2xl backdrop-blur-2xl"
        style={{
          background: "var(--sx-bg-18-18-32-820)",
          borderColor: "var(--sx-border-255-255-255-120)",
          boxShadow: "0 16px 44px -12px var(--sx-shadow-0-0-0-600), inset 0 1px 0 rgb(255 255 255 / 0.08)",
        }}
      >
        {/* Expanded mode */}
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-0.5 max-w-[min(88vw,620px)] overflow-x-auto scrollbar-none px-1"
            >
              {ALL_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => handleSend(emoji)}
                  disabled={disabled}
                  aria-label={tr("Send {emoji} reaction", { emoji })}
                  whileHover={{ scale: 1.3, y: -6 }}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 520, damping: 18 }}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[22px] hover:bg-white/[0.08] disabled:opacity-40"
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-0.5"
            >
              {QUICK_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => handleSend(emoji)}
                  disabled={disabled}
                  aria-label={tr("Send {emoji} reaction", { emoji })}
                  whileHover={{ scale: 1.3, y: -6 }}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 520, damping: 18 }}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[22px] hover:bg-white/[0.08] disabled:opacity-40"
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand / collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          style={{ color: "var(--sx-text-255-255-255-600)" }}
          title={expanded ? tr("Show fewer reactions") : tr("More reactions")}
          aria-label={expanded ? tr("Show fewer reactions") : tr("More reactions")}
          aria-expanded={expanded}
        >
          {expanded ? (
            <X className="w-4 h-4" />
          ) : (
            <SmilePlus className="w-4 h-4" />
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default StageReactionBar;
