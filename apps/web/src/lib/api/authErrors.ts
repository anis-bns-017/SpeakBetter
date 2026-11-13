// apps/web/src/lib/api/authErrors.ts

/**
 * Whether a failed "who am I?" means the person is signed out. Only the server saying so (a 4xx answer)
 * counts. No answer at all (the server is restarting, the network dropped) or a server error (5xx) says
 * nothing about the session, so it must not sign anyone out.
 */
export const isSignedOutError = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
};

/** Waits between tries while the server can't be reached: quick at first, then every 10 seconds */
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];
