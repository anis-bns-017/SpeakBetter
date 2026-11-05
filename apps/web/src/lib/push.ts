/**
 * Push notifications on this device: asking permission, subscribing through the service worker and telling
 * the server. The API calls live here so signing out can also switch push off for this device.
 */

import { apiClient } from "./api/client";

export type PushPermission = "unsupported" | "default" | "granted" | "denied";

/** Browsers that can do push at all (iPhones only once the app is on the home screen) */
export const pushSupported = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const pushPermission = (): PushPermission => (pushSupported() ? (Notification.permission as PushPermission) : "unsupported");

/** The key the server gave us is URL-safe base64; the browser wants the raw bytes */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  // Waits for the worker to be active (registered at start-up), but not forever
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000)),
  ]);
}

/** This browser's current push subscription, if it has one */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

const timezone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

async function sendToServer(subscription: PushSubscription): Promise<void> {
  // toJSON gives { endpoint, keys: { p256dh, auth } }
  await apiClient.post("/push/subscribe", { subscription: subscription.toJSON(), timezone: timezone() });
}

export class PushError extends Error {
  reason: "unsupported" | "denied" | "dismissed" | "unavailable" | "failed";

  constructor(reason: PushError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

/** Asks permission if needed, subscribes this device and tells the server. Call it from a tap. */
export async function enablePush(publicKey: string): Promise<void> {
  if (!pushSupported()) throw new PushError("unsupported", "This browser can't receive push notifications.");
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission === "denied") throw new PushError("denied", "Notifications are blocked for this site. Allow them in your browser's site settings.");
  if (permission !== "granted") throw new PushError("dismissed", "Notifications were not allowed.");

  const reg = await registration();
  if (!reg) throw new PushError("unavailable", "The app isn't ready yet. Reload the page and try again.");
  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    await sendToServer(subscription);
  } catch (error) {
    if (error instanceof PushError) throw error;
    throw new PushError("failed", "Couldn't turn notifications on in this browser. Try again, or use another browser.");
  }
}

/** Stops push on this device: the server forgets it, then the browser drops it */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  try {
    await apiClient.post("/push/unsubscribe", { endpoint: subscription.endpoint });
  } finally {
    await subscription.unsubscribe().catch(() => undefined);
  }
}

/**
 * Keeps the server's record of this device fresh (and pointed at whoever is signed in now). Only refreshes a
 * subscription the person already turned on; it never asks for permission.
 */
export async function syncPush(): Promise<void> {
  if (pushPermission() !== "granted") return;
  const subscription = await currentSubscription();
  if (subscription) await sendToServer(subscription);
}

/** For signing out: this device must stop getting the previous person's notifications. Never throws. */
export async function removePushOnSignOut(): Promise<void> {
  try {
    await Promise.race([disablePush(), new Promise<void>((resolve) => window.setTimeout(resolve, 3000))]);
  } catch {
    /* signing out matters more */
  }
}
