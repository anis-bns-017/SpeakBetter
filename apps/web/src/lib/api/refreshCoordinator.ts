// Decides how a 401 turns into at most one /auth/refresh call. Kept free of
// axios, the DOM and import.meta so it can be exercised on its own.

/** What one call to the refresh endpoint came back with */
export type RefreshResponse =
  | 'ok' // new cookies were set
  | 'race' // the server says another request is rotating this very token
  | 'denied' // refresh token missing, expired, revoked or reused: signed out
  | 'error'; // network failure or 5xx: say nothing about the session

/** What callers learn: can the failed request be retried? */
export type RefreshOutcome =
  | 'refreshed' // cookies are fresh, retry the request
  | 'lost' // the session is over, send the user to sign in
  | 'unavailable'; // could not tell (offline, server down): keep the session

export interface RefreshCoordinatorOptions {
  /** One network call to POST /auth/refresh, classified. Must not throw. */
  refresh: () => Promise<RefreshResponse>;
  /** Runs `task` while holding a lock shared by every tab (Web Locks) */
  withLock?: <T>(task: () => Promise<T>) => Promise<T>;
  /** When any tab last refreshed successfully (ms since epoch), 0 if unknown */
  readLastRefresh?: () => number;
  writeLastRefresh?: (at: number) => void;
  /** How long to wait after a 'race' so the winner's cookies have landed */
  raceSettleMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function createRefreshCoordinator(options: RefreshCoordinatorOptions) {
  const {
    refresh,
    withLock = (task) => task(),
    readLastRefresh = () => 0,
    writeLastRefresh = () => undefined,
    raceSettleMs = 400,
    now = () => Date.now(),
    sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options;

  let inFlight: Promise<RefreshOutcome> | null = null;

  const run = (): Promise<RefreshOutcome> => {
    const requestedAt = now();
    return withLock(async (): Promise<RefreshOutcome> => {
      // Another tab finished a refresh while this one waited for the lock: its
      // cookies are ours too, and rotating again would only invite a race.
      // (Only a refresh that happened AFTER this 401 counts; an older one is
      // exactly what just expired.)
      if (readLastRefresh() >= requestedAt) return 'refreshed';

      const response = await refresh();
      switch (response) {
        case 'ok':
          writeLastRefresh(now());
          return 'refreshed';
        case 'race':
          // Do NOT call refresh again with the same cookie: replaying a
          // rotated token is what the server's reuse detection punishes.
          await sleep(raceSettleMs);
          return 'refreshed';
        case 'denied':
          return 'lost';
        default:
          return 'unavailable';
      }
    });
  };

  return {
    /** Every concurrent 401 in this tab shares one refresh */
    refreshSession(): Promise<RefreshOutcome> {
      if (!inFlight) {
        inFlight = run().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
