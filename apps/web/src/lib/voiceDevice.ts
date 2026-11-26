// apps/web/src/lib/voiceDevice.ts
// Phone-specific rules for voice rooms.
import { isNativeApp } from "./pwa";

/** A phone or tablet (or the phone app): one microphone, usually a loudspeaker right next to it */
export function isPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isNativeApp()) return true;
  const data = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (data?.mobile) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

const CAPTION_ME_KEY = "sb.captions.mine";

/**
 * Whether the room should caption your own voice. Captioning uses the microphone a second time; phones handle that
 * badly (the call can lose its echo cancellation or cut out), so there it is off unless you turn it on.
 */
export function readCaptionMe(): boolean {
  try {
    const saved = localStorage.getItem(CAPTION_ME_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {
    /* no storage: use the default */
  }
  return !isPhone();
}

export function saveCaptionMe(on: boolean) {
  try {
    localStorage.setItem(CAPTION_ME_KEY, on ? "1" : "0");
  } catch {
    /* it just isn't remembered */
  }
}

const ECHO_GUARD_KEY = "sb.voice.echoGuard";

/** The echo guard is on unless you turned it off (for example, when you always use headphones) */
export function readEchoGuard(): boolean {
  try {
    return localStorage.getItem(ECHO_GUARD_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveEchoGuard(on: boolean) {
  try {
    localStorage.setItem(ECHO_GUARD_KEY, on ? "1" : "0");
  } catch {
    /* it just isn't remembered */
  }
}
