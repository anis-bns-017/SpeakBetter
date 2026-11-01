// apps/web/src/components/voice/lobby/useLobbyPrefs.ts
import { useCallback, useEffect, useState } from "react";
import type { SortKey } from "./lobbyUtils";

const STORAGE_KEY = "speakbetter:voice-lobby:v1";

interface StoredPrefs {
  viewMode: "grid" | "list";
  sort: SortKey;
  hideFull: boolean;
  favorites: string[];
}

const DEFAULTS: StoredPrefs = {
  viewMode: "grid",
  sort: "active",
  hideFull: false,
  favorites: [],
};

function load(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      viewMode: parsed.viewMode === "list" ? "list" : "grid",
      sort: (["active", "newest", "space", "soon"] as const).includes(
        parsed.sort as SortKey,
      )
        ? (parsed.sort as SortKey)
        : "active",
      hideFull: parsed.hideFull === true,
      favorites: Array.isArray(parsed.favorites)
        ? parsed.favorites.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    // private window or blocked storage: the lobby works without remembering
    return DEFAULTS;
  }
}

/** Lobby choices that should survive a reload: layout, sort, pinned rooms */
export function useLobbyPrefs() {
  const [prefs, setPrefs] = useState<StoredPrefs>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore: storage is a convenience only
    }
  }, [prefs]);

  const setViewMode = useCallback(
    (viewMode: StoredPrefs["viewMode"]) => setPrefs((p) => ({ ...p, viewMode })),
    [],
  );
  const setSort = useCallback(
    (sort: SortKey) => setPrefs((p) => ({ ...p, sort })),
    [],
  );
  const setHideFull = useCallback(
    (hideFull: boolean) => setPrefs((p) => ({ ...p, hideFull })),
    [],
  );
  const toggleFavorite = useCallback(
    (roomId: string) =>
      setPrefs((p) => ({
        ...p,
        favorites: p.favorites.includes(roomId)
          ? p.favorites.filter((id) => id !== roomId)
          : [...p.favorites, roomId],
      })),
    [],
  );

  return {
    viewMode: prefs.viewMode,
    sort: prefs.sort,
    hideFull: prefs.hideFull,
    favorites: new Set(prefs.favorites),
    setViewMode,
    setSort,
    setHideFull,
    toggleFavorite,
  };
}
