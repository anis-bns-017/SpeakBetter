// apps/web/src/components/voice/lobby/Equalizer.tsx
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Little animated bars that say "people are talking here" */
export const Equalizer: React.FC<{
  color: string;
  bars?: number;
  height?: number;
  active?: boolean;
}> = ({ color, bars = 4, height = 16, active = true }) => {
  const reduce = useReducedMotion();
  return (
    <span
      className="inline-flex items-end gap-[2px]"
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }, (_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: color, height: height * 0.35 }}
          animate={
            active && !reduce
              ? { height: [height * 0.3, height, height * 0.5, height * 0.85, height * 0.3] }
              : { height: height * 0.35 }
          }
          transition={{
            duration: 1.1 + i * 0.17,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.12,
          }}
        />
      ))}
    </span>
  );
};
