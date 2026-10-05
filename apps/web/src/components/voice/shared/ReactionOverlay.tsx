// apps/web/src/components/voice/shared/ReactionOverlay.tsx
import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface StageReaction {
  id: string;
  emoji: string;
  userId: string;
  userName?: string;
  /** 10–90 — where it appears horizontally (percent) */
  xPercent: number;
  createdAt: number;
}

interface ReactionOverlayProps {
  reactions: StageReaction[];
  maxVisible?: number;
  /** Lifetime of one emoji before it disappears */
  lifetimeMs?: number;
}

/**
 * Floating emoji overlay for the voice stage.
 * Renders `<FloatingReaction />` per item — absolutely positioned,
 * drifting upward with slight rotation + horizontal sway.
 */
export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({
  reactions,
  maxVisible = 24,
  lifetimeMs = 3400,
}) => {
  const visible = reactions.slice(-maxVisible);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-[70] overflow-hidden"
      aria-hidden="true"
    >
      <AnimatePresence>
        {visible.map((reaction) => (
          <FloatingReaction
            key={reaction.id}
            reaction={reaction}
            lifetimeMs={lifetimeMs}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// ------------------------------------------------------------

const FloatingReaction: React.FC<{
  reaction: StageReaction;
  lifetimeMs: number;
}> = ({ reaction, lifetimeMs }) => {
  // Pre-compute randomness once per mount so the motion stays consistent
  const drift = useRef((Math.random() - 0.5) * 140).current;
  const rotate = useRef((Math.random() - 0.5) * 70).current;
  const scale = useRef(0.85 + Math.random() * 0.55).current;
  const delay = useRef(Math.random() * 0.15).current;

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 40,
        x: 0,
        scale: 0.5,
        rotate: 0,
      }}
      animate={{
        opacity: [0, 1, 1, 0.85, 0],
        y: [40, -20, -140, -300, -460],
        x: [0, drift * 0.15, drift * 0.45, drift * 0.8, drift],
        scale: [0.5, scale * 1.05, scale, scale * 0.95, scale * 0.65],
        rotate: [0, rotate * 0.3, rotate * 0.65, rotate, rotate * 1.15],
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        duration: lifetimeMs / 1000,
        ease: "easeOut",
        delay,
        times: [0, 0.18, 0.5, 0.8, 1],
      }}
      className="absolute bottom-20 select-none"
      style={{
        left: `${reaction.xPercent}%`,
        transform: "translateX(-50%)",
        fontSize: "2.25rem",
        lineHeight: 1,
        filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.45))",
        willChange: "transform, opacity",
      }}
    >
      <span role="img" aria-label="reaction">
        {reaction.emoji}
      </span>
    </motion.div>
  );
};

export default ReactionOverlay;