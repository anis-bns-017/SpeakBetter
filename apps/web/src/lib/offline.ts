/**
 * Offline mode, page side. The service worker keeps the last good copy of learning content; this file can
 * fetch everything at once ("Save for offline"), says whether offline saving can work here, and wipes the
 * saved data when someone signs out.
 */

import { apiClient } from "./api/client";

const SAVED_AT_KEY = "sb.offline.savedAt";

/** The API origin, handed to the service worker so it knows which requests are the API */
export const apiOrigin = (): string => {
  try {
    return new URL(import.meta.env.VITE_API_URL || "http://localhost:3000").origin;
  } catch {
    return "http://localhost:3000";
  }
};

/** Offline saving needs an active service worker; some browsers and embedded views block it */
export const offlineReady = (): boolean => typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller;

export const lastSavedAt = (): Date | null => {
  try {
    const v = localStorage.getItem(SAVED_AT_KEY);
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
};

/**
 * Loads every library text, grammar lesson and word pack once, so the service worker keeps a copy of each.
 * Calls `onProgress(done, total)` as it goes. Returns how many items were saved.
 */
export async function saveForOffline(onProgress?: (done: number, total: number) => void): Promise<number> {
  const [library, grammar, packs] = await Promise.all([
    apiClient.get<{ texts: Array<{ id: string }> }>("/library"),
    apiClient.get<{ lessons: Array<{ id: string }> }>("/grammar/lessons"),
    apiClient.get<{ packs: Array<{ id: string }> }>("/vocab-packs"),
  ]);
  const urls = [
    ...library.data.texts.map((t) => `/library/${t.id}`),
    ...grammar.data.lessons.map((l) => `/grammar/lessons/${l.id}`),
    ...packs.data.packs.map((p) => `/vocab-packs/${p.id}`),
    "/vocab-packs/today",
    "/auth/me",
  ];
  let done = 0;
  onProgress?.(0, urls.length);
  // A few at a time, so a phone on a slow connection is not flooded
  for (let i = 0; i < urls.length; i += 4) {
    await Promise.all(
      urls.slice(i, i + 4).map(async (url) => {
        try {
          await apiClient.get(url);
        } catch {
          /* one missing item does not stop the rest */
        }
        done++;
        onProgress?.(done, urls.length);
      }),
    );
  }
  try {
    localStorage.setItem(SAVED_AT_KEY, new Date().toISOString());
  } catch {
    /* only the "last saved" note is lost */
  }
  return done;
}

/** Signing out: nothing from this person stays on the device */
export async function clearOfflineData(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_API_CACHE" });
    if (typeof caches !== "undefined") {
      for (const key of await caches.keys()) if (key.startsWith("sb-api-")) await caches.delete(key);
    }
    localStorage.removeItem(SAVED_AT_KEY);
  } catch {
    /* signing out matters more */
  }
}
