/**
 * The daily practice reminder: when it is due for someone and what it says. Pure functions, so the choice can
 * be tested without a database or a clock.
 */

export const DEFAULT_REMINDER_TIME = '20:00';
/** How long after the chosen time a reminder can still go out, so a restart or a slow tick does not skip it */
export const REMINDER_WINDOW_MINUTES = 90;

export interface LocalParts {
  /** YYYY-MM-DD on the person's clock */
  day: string;
  /** Minutes since their midnight */
  minutes: number;
}

const isTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** The date and time of day `date` is at in `timeZone` (the server's own time zone when it is missing or unknown) */
export function localParts(date: Date, timeZone?: string | null): LocalParts {
  const zone = timeZone && isTimeZone(timeZone) ? timeZone : undefined;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** "20:30" → 1230 minutes; null when it is not a time of day */
export function parseTime(value: unknown): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Is the reminder due right now? From the chosen time until the window ends, and only if they have not
 * practised today (their own day) yet.
 */
export function reminderDue(now: LocalParts, targetMinutes: number, lastPracticeDay: string | null): boolean {
  if (lastPracticeDay === now.day) return false;
  return now.minutes >= targetMinutes && now.minutes < targetMinutes + REMINDER_WINDOW_MINUTES;
}

/**
 * The wording: a streak at risk is the strongest reason to open the app. Today's word, when there is one, gives
 * them something small to learn straight away.
 */
/**
 * The streak someone still has today, judged on their own calendar (YYYY-MM-DD days in their time zone):
 * alive if they practised today or yesterday, or if their freezes cover the days missed since.
 */
export function streakOnDay(
  streak: { currentStreak: number; freezes?: number | null } | null,
  today: string,
  lastPracticeDay: string | null,
): number {
  if (!streak || !lastPracticeDay || streak.currentStreak <= 0) return 0;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastPracticeDay}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(days)) return 0;
  return days <= 1 || days - 1 <= (streak.freezes ?? 0) ? streak.currentStreak : 0;
}

export function reminderText(streak: number, word?: { word: string; meaning: string } | null): { title: string; message: string } {
  const title = streak >= 2 ? `Keep your ${streak}-day streak going` : 'Time to practise English';
  if (word) {
    return { title, message: `Today's word is "${word.word}": ${word.meaning}. Learn it in a minute, then do your plan.`.slice(0, 300) };
  }
  return {
    title,
    message: streak >= 2 ? 'A few minutes today is all it takes. Your daily plan is ready.' : 'Five minutes today keeps your progress moving. Your daily plan is ready.',
  };
}
