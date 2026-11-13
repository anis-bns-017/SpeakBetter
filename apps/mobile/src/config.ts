// apps/mobile/src/config.ts
// Where the app finds SpeakBetter. The phone app is the website in a native frame, so this is the one
// address that matters.
//
//   EXPO_PUBLIC_WEB_URL=https://app.speakbetter.example   (required for store builds; see .env.example)
//
// Without it, a development build uses the web dev server on the computer running Expo (port 15173): the
// computer's Wi-Fi address on a phone, 10.0.2.2 on the Android emulator, localhost on the iOS simulator.
import Constants from "expo-constants";
import { Platform } from "react-native";

const DEV_WEB_PORT = 15173;

function devWebUrl(): string {
  // "192.168.1.20:8081": the computer Expo is serving from, as this device sees it
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") return `http://${host}:${DEV_WEB_PORT}`;
  return Platform.OS === "android" ? `http://10.0.2.2:${DEV_WEB_PORT}` : `http://localhost:${DEV_WEB_PORT}`;
}

const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();

/** The site to show; null in a store build that was made without EXPO_PUBLIC_WEB_URL */
export const WEB_URL: string | null = (configured || (__DEV__ ? devWebUrl() : "")).replace(/\/+$/, "") || null;

/** "https://host:port" of WEB_URL (React Native's URL has no .origin, so it is read from the text) */
export const WEB_ORIGIN: string | null = WEB_URL?.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i)?.[0].toLowerCase() ?? null;

/**
 * Added to the web view's browser name. The site looks for it (apps/web/src/lib/pwa.ts, isNativeApp) to hide
 * "install the app" offers and browser-only features.
 */
export const APP_USER_AGENT = `SpeakBetterApp/${Constants.expoConfig?.version ?? "1.0.0"}`;
