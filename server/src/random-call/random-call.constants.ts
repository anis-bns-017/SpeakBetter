export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];
export const levelIndex = (level: Level) => LEVELS.indexOf(level);

export const GOALS = ['casual', 'interview', 'work', 'travel', 'fun'] as const;
export type Goal = (typeof GOALS)[number];

export const REPORT_REASONS = [
  'HARASSMENT',
  'SEXUAL',
  'HATE',
  'SPAM',
  'UNDERAGE',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Reasons serious enough that fewer reports trigger a restriction */
export const SEVERE_REASONS: ReadonlySet<string> = new Set(['SEXUAL', 'UNDERAGE']);

/** A call is this long; both people can agree to add more time */
export const CALL_SECONDS = 5 * 60;
export const EXTEND_SECONDS = 5 * 60;
export const MAX_EXTENSIONS = 2;

/** How long someone waits in the queue before we stop and suggest alternatives */
export const QUEUE_TIMEOUT_MS = 90_000;
/** Rematching the same person is avoided for this long (unless the wait is long) */
export const RECENT_PARTNER_WINDOW_MS = 2 * 60 * 60 * 1000;
/** A dropped connection gets this long to come back before the call ends */
export const RECONNECT_GRACE_MS = 15_000;

/** Level gap allowed grows the longer someone waits */
export const WIDEN_TO_ONE_AFTER_MS = 10_000;
export const WIDEN_TO_ANY_AFTER_MS = 30_000;
/** After this wait, people met recently may be matched again */
export const ALLOW_REPEAT_AFTER_MS = 60_000;

/** Reports needed from different people (in 7 days) to restrict someone */
export const REPORTS_TO_RESTRICT = 3;
export const REPORTS_TO_RESTRICT_SEVERE = 2;
/** Someone reporting more than this in 24h stops counting toward restrictions */
export const MAX_COUNTED_REPORTS_PER_DAY = 5;
export const RESTRICTION_DAYS = [3, 14] as const; // then permanent

export const CARD_COUNT = 10;
