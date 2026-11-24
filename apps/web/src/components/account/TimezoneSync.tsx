// apps/web/src/components/account/TimezoneSync.tsx
/**
 * Tells the server which time zone this device is in, so streaks, the daily plan and daily goals start at the
 * learner's own midnight. Sent once per account and zone; a trip abroad sends the new one.
 */

import { useEffect } from "react";
import { useAuth } from "../../contexts/useAuth";
import { apiClient } from "../../lib/api/client";

const KEY = "sb.timezone.sent";
/** The one being sent right now, so a second mount doesn't send it twice */
let sending: string | null = null;

const deviceZone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const write = (value: string) => {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* it is just sent again next time */
  }
};

export function TimezoneSync() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    const zone = deviceZone();
    if (!userId || !zone) return;
    const stamp = `${userId}:${zone}`;
    if (read() === stamp || sending === stamp) return;
    sending = stamp;
    apiClient
      .put("/profile/me/timezone", { timezone: zone })
      .then(() => write(stamp))
      .catch(() => {
        /* not important enough to bother anyone: it tries again on the next visit */
      })
      .finally(() => {
        if (sending === stamp) sending = null;
      });
  }, [userId]);

  return null;
}

export default TimezoneSync;
