// apps/web/src/components/voice/lobby/useNow.ts
import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs` (for countdowns) */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
