// server/src/common/learner-day.ts
/**
 * "Today" on the learner's own clock. Streaks, daily plans, daily XP limits and the day-by-day charts all ask
 * this, so a learner in Dhaka gets a new day at their midnight, not at the server's.
 *
 * Days are written as YYYY-MM-DD. Without a known time zone everything falls back to the server's own, which
 * is how the app behaved before.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const isTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (zone?: string | null) => {
  const key = zone && isTimeZone(zone) ? zone : '';
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: key || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(key, formatter);
  }
  return formatter;
};

function partsOf(date: Date, zone?: string | null) {
  const parts = formatterFor(zone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

const pad = (n: number) => String(n).padStart(2, '0');
const utcOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** The calendar day `date` falls on in `zone` */
export function dayIn(date: Date, zone?: string | null): string {
  const p = partsOf(date, zone);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** How far `zone`'s clock is ahead of UTC at `instant`, in milliseconds */
function offsetAt(instant: number, zone?: string | null): number {
  const p = partsOf(new Date(instant), zone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(instant / 1000) * 1000;
}

/** The moment `day` begins in `zone` */
export function startOfDayKey(day: string, zone?: string | null): Date {
  const midnight = utcOf(day);
  // Twice, because the offset can differ between the guess and the answer around a clock change
  let guess = midnight - offsetAt(midnight, zone);
  guess = midnight - offsetAt(guess, zone);
  return new Date(guess);
}

/** The moment today (for `date`) began in `zone` */
export const startOfDayIn = (date: Date, zone?: string | null) => startOfDayKey(dayIn(date, zone), zone);

/** The day `n` days after `day` (negative goes back) */
export function addDays(day: string, n: number): string {
  const d = new Date(utcOf(day) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whole days from `from` to `to` (to minus from) */
export const daysBetween = (from: string, to: string) => Math.round((utcOf(to) - utcOf(from)) / DAY_MS);

// ---------------------------------------------------------------------------
// Whose clock: the time zone the app reported for this learner
// ---------------------------------------------------------------------------

const ZONE_TTL_MS = 10 * 60 * 1000;
const zones = new Map<string, { zone: string | undefined; at: number }>();

interface ProfileReader {
  profile?: { findUnique?: (args: { where: { userId: string }; select: { timezone: true } }) => Promise<{ timezone: string | null } | null> };
}

/** The learner's time zone, or undefined for the server's. Never throws. */
export async function learnerZone(prisma: ProfileReader | unknown, userId: string): Promise<string | undefined> {
  if (!userId) return undefined;
  const hit = zones.get(userId);
  if (hit && Date.now() - hit.at < ZONE_TTL_MS) return hit.zone;
  try {
    const profile = await (prisma as ProfileReader).profile?.findUnique?.({ where: { userId }, select: { timezone: true } });
    const zone = isTimeZone(profile?.timezone) ? (profile?.timezone ?? undefined) : undefined;
    zones.set(userId, { zone, at: Date.now() });
    if (zones.size > 50_000) zones.clear();
    return zone;
  } catch {
    return undefined;
  }
}

/** After saving a new time zone, so this server uses it straight away */
export function rememberZone(userId: string, zone: string | null | undefined) {
  zones.set(userId, { zone: isTimeZone(zone) ? zone : undefined, at: Date.now() });
}

/** For tests */
export function forgetZones() {
  zones.clear();
}
