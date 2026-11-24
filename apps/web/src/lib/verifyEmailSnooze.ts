// apps/web/src/lib/verifyEmailSnooze.ts
/** "Not now" on the confirm-your-email reminder: it comes back after a few days, per account on this device. */

export const SNOOZE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const keyFor = (userId: string) => `sb.verifyEmail.snooze.${userId}`;

export function isSnoozed(userId: string | undefined, now = Date.now()): boolean {
  if (!userId) return false;
  try {
    const until = Number(localStorage.getItem(keyFor(userId)));
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export function snooze(userId: string, now = Date.now()) {
  try {
    localStorage.setItem(keyFor(userId), String(now + SNOOZE_DAYS * DAY_MS));
  } catch {
    /* it just shows again next time */
  }
}

export function clearSnooze(userId: string) {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to clear */
  }
}
