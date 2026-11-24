// apps/web/src/components/voice/participants/useIsPhone.ts
import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639px)";

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

/** True on phone-width screens. Avatars take a pixel size (the speaking effects draw to it), so they can't use CSS breakpoints. */
export const useIsPhone = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
