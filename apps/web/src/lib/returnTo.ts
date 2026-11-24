/**
 * Where someone was headed when they had to sign in or do the first-day guide: a room invite, a community link, a
 * notification. Kept for this tab only (it survives the trip to Google sign-in) and used once.
 */
const KEY = "sb.returnTo";

/** Pages that are a start, not a destination */
const NOT_A_DESTINATION = ["/", "/dashboard", "/welcome", "/login", "/register", "/auth/callback", "/forgot-password", "/reset-password"];

let signedOut = false;

/** Only paths inside this app: never "//evil.example" or a full address */
export function isSafeReturn(path: unknown): path is string {
  if (typeof path !== "string" || path.length > 500) return false;
  if (!/^\/(?![/\\])/.test(path) || /[\r\n\t]/.test(path) || path.includes("\\")) return false;
  const pathname = path.split(/[?#]/)[0];
  return !NOT_A_DESTINATION.includes(pathname);
}

export function rememberReturn(path: string) {
  if (signedOut || !isSafeReturn(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // storage blocked: they just land on the dashboard
  }
}

export function peekReturn(): string | null {
  try {
    const stored = sessionStorage.getItem(KEY);
    return isSafeReturn(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function clearReturn() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

/** Signing out on purpose: the page you were on is not somewhere the next person should land */
export function forgetReturnOnSignOut() {
  signedOut = true;
  clearReturn();
}

/** For tests */
export function resetReturnState() {
  signedOut = false;
  clearReturn();
}
