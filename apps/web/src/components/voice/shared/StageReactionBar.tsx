// apps/web/src/components/voice/shared/StageReactionBar.tsx
import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SmilePlus, X } from "lucide-react";

const QUICK_EMOJIS = ["❤️", "🔥", "👏", "😂", "🎉", "💯", "🙌", "😮"];
const ALL_EMOJIS = [
  "❤️", "🔥", "👏", "😂", "🎉", "💯", "🙌", "😮",
  "🥳", "😍", "🤯", "💪", "✨", "🚀", "🤝", "☕",
  "🙏", "😭", "😎", "💖", "🌟", "⚡", "🎯", "🧠",
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
        "pointer-events-none absolute inset-x-0 bottom-4 z-[65] flex justify-center " +
        (className ?? "")
      }
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="pointer-events-auto flex items-center gap-1 rounded-full border px-2 py-1.5 shadow-2xl backdrop-blur-xl"
        style={{
          background: "rgba(18, 18, 32, 0.82)",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
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
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSend(emoji)}
                  disabled={disabled}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-white/10 hover:scale-110 active:scale-95 transition-all disabled:opacity-40"
                >
                  {emoji}
                </button>
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
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSend(emoji)}
                  disabled={disabled}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-white/10 hover:scale-110 active:scale-95 transition-all disabled:opacity-40"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand / collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          style={{ color: "rgba(255,255,255,0.6)" }}
          title={expanded ? "Show fewer reactions" : "More reactions"}
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