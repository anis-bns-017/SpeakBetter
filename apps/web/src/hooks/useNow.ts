// apps/web/src/hooks/useNow.ts
import { useEffect, useState } from "react";

/**
 * The current time, refreshed every `everyMs`. Reading Date.now() while rendering gives a different answer each
 * render; this keeps "is it new / is it due / how long ago" stable between ticks.
 */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}
