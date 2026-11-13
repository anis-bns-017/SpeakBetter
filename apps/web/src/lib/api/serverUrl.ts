// apps/web/src/lib/api/serverUrl.ts
// Where the server is. The .env files say "localhost", which is right on the developer's computer. On another
// device (a phone on the same Wi-Fi, the SpeakBetter phone app, an Android emulator) "localhost" means that
// device, so in development the address is pointed at the computer that served this page instead.
// Production builds use the configured addresses unchanged.

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/;

export function serverUrl(configured: string | undefined, fallback: string): string {
  const raw = (configured || fallback).replace(/\/+$/, "");
  if (!import.meta.env.DEV || typeof window === "undefined") return raw;
  try {
    const url = new URL(raw);
    const here = window.location.hostname;
    if (LOCAL_HOST.test(url.hostname) && here && !LOCAL_HOST.test(here)) {
      url.hostname = here;
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    /* not a full URL: use it as written */
  }
  return raw;
}

/** The REST API */
export const API_URL = serverUrl(import.meta.env.VITE_API_URL, "http://localhost:3000");
/** Socket.IO voice namespace */
export const SOCKET_URL = serverUrl(import.meta.env.VITE_SOCKET_URL, "http://localhost:3000/voice");
/** LiveKit (voice rooms audio) */
export const LIVEKIT_URL = serverUrl(import.meta.env.VITE_LIVEKIT_URL, "ws://localhost:18080");
