// apps/web/src/hooks/useDebounce.ts
import { useEffect, useState } from "react";

/** Returns `value` once it has stopped changing for `delay` ms (e.g. search-as-you-type) */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
