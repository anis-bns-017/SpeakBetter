// apps/web/src/routes/welcomeGate.ts
import type { User } from "../contexts/useAuth";

/** Pages a new account may open before finishing the first-day guide (the guide sends people to the level test) */
export const ALLOWED_BEFORE_WELCOME = ["/welcome", "/placement"];

/**
 * Whether a signed-in person should be sent to the first-day guide instead of `pathname`.
 * New accounts have onboardedAt === null. undefined means an older server that doesn't know about the guide,
 * so nobody is redirected then.
 */
export const needsWelcome = (user: Pick<User, "profile">, pathname: string): boolean =>
  !!user.profile && user.profile.onboardedAt === null && !ALLOWED_BEFORE_WELCOME.includes(pathname);
