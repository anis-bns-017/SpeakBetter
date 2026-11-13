import { apiOrigin } from "./offline";

/**
 * Making SpeakBetter an installable app: registers the service worker and keeps the browser's "install" offer
 * so a button of our own can show it. Imported once at start-up, because `beforeinstallprompt` fires early.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the offer for our own button instead of the browser's mini bar
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/**
 * Running inside the SpeakBetter phone app (apps/mobile), which shows this site in a web view and adds
 * "SpeakBetterApp/<version>" to the browser's name. Install offers and browser alerts don't apply there.
 */
export const isNativeApp = (): boolean => typeof navigator !== "undefined" && /\bSpeakBetterApp\//.test(navigator.userAgent);

/** Opened from the home screen, the installed app window or the phone app, not a browser tab */
export const isStandalone = (): boolean =>
  typeof window !== "undefined" &&
  (isNativeApp() ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** iPhones and iPads (including iPadOS, which calls itself a Mac) only install from Safari's Share menu */
export const isIos = (): boolean =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export interface InstallState {
  /** The browser is ready to show its install dialog */
  canPrompt: boolean;
  installed: boolean;
}

// One object that only changes when something really changed, as useSyncExternalStore needs
let snapshot: InstallState = { canPrompt: false, installed: isStandalone() };

const notify = () => {
  const next = { canPrompt: deferred !== null, installed: installed || isStandalone() };
  if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed) snapshot = next;
  listeners.forEach((l) => l());
};

export const installState = (): InstallState => snapshot;

export const subscribeInstallState = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Shows the browser's install dialog; true when they accepted */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const offer = deferred;
  deferred = null;
  notify();
  await offer.prompt();
  const choice = await offer.userChoice;
  return choice.outcome === "accepted";
}

/** Registers /sw.js once the page has loaded, so it never slows the first paint */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register(`/sw.js?api=${encodeURIComponent(apiOrigin())}`).catch((error) => {
      console.warn("Service worker could not be registered:", error);
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
