// apps/web/src/hooks/useSpeakingTimes.ts
import { useEffect, useRef, useState } from "react";

export interface SpeakingTime {
  userId: string;
  name: string;
  avatarUrl?: string;
  seconds: number;
  turns: number;
}

interface ParticipantLike {
  userId: string;
  id?: string;
  name: string;
  avatarUrl?: string;
  isSpeaking?: boolean;
}

/**
 * Tracks speaking time per participant.
 * - Increments a per-user counter every 1s while they're speaking
 * - Counts a "turn" each time they transition from silent → speaking
 */
export const useSpeakingTimes = (
  participants: ParticipantLike[],
): SpeakingTime[] => {
  const [times, setTimes] = useState<Record<string, SpeakingTime>>({});

  // Track previous speaking state per user to detect turn transitions
  const prevSpeaking = useRef<Record<string, boolean>>({});

  // Update names/avatars whenever participant list changes
  useEffect(() => {
    setTimes((prev) => {
      const next = { ...prev };
      for (const p of participants) {
        const key = p.userId || p.id || "";
        if (!key) continue;
        const existing = next[key];
        if (!existing) {
          next[key] = {
            userId: key,
            name: p.name || "Anonymous",
            avatarUrl: p.avatarUrl,
            seconds: 0,
            turns: 0,
          };
        } else {
          if (existing.name !== p.name) existing.name = p.name;
          if (existing.avatarUrl !== p.avatarUrl)
            existing.avatarUrl = p.avatarUrl;
        }
      }
      return next;
    });
  }, [participants]);

  // Every second, increment speaking seconds for active speakers
  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimes((prev) => {
        const next = { ...prev };
        let changed = false;

        for (const p of participants) {
          const key = p.userId || p.id || "";
          if (!key) continue;

          const speaking = Boolean(p.isSpeaking);
          const wasSpeaking = prevSpeaking.current[key] ?? false;

          // Turn transition: silent → speaking
          if (speaking && !wasSpeaking) {
            const entry = next[key] ?? {
              userId: key,
              name: p.name || "Anonymous",
              avatarUrl: p.avatarUrl,
              seconds: 0,
              turns: 0,
            };
            next[key] = { ...entry, turns: entry.turns + 1 };
            changed = true;
          }

          // Increment seconds while speaking
          if (speaking) {
            const entry = next[key] ?? {
              userId: key,
              name: p.name || "Anonymous",
              avatarUrl: p.avatarUrl,
              seconds: 0,
              turns: 0,
            };
            next[key] = { ...entry, seconds: entry.seconds + 1 };
            changed = true;
          }

          prevSpeaking.current[key] = speaking;
        }

        return changed ? next : prev;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [participants]);

  return Object.values(times);
};

export default useSpeakingTimes;