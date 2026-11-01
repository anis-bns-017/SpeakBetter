// apps/web/src/components/voice/lobby/useLobbyShortcuts.ts
import { useEffect, useRef } from "react";

export type LobbyShortcuts = Partial<Record<"/" | "n" | "g" | "r", () => void>>;

/**
 * Single-key shortcuts for the lobby. Ignored while typing in a field, while a
 * modifier is held, and when `enabled` is false (a room or modal is open).
 */
export function useLobbyShortcuts(shortcuts: LobbyShortcuts, enabled: boolean) {
  const latest = useRef(shortcuts);
  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      const action = latest.current[event.key as keyof LobbyShortcuts];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
