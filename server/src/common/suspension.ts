// server/src/common/suspension.ts
// Account suspension, shared by sign-in (auth) and the admin section. A suspended account cannot sign in, and
// its open sessions stop working on their next request.

import { ForbiddenException } from '@nestjs/common';

/** Stored as the end date of a permanent suspension */
export const PERMANENT_SUSPENSION = new Date('9999-12-31T00:00:00.000Z');

export interface Suspendable {
  suspendedUntil?: Date | null;
  suspensionReason?: string | null;
}

export const isSuspended = (user: Suspendable, now = new Date()): boolean =>
  !!user.suspendedUntil && user.suspendedUntil.getTime() > now.getTime();

export const isPermanentSuspension = (until: Date | null | undefined): boolean =>
  !!until && until.getUTCFullYear() >= 9999;

/** What a suspended person is told when they try to sign in */
export function suspensionMessage(user: Suspendable): string {
  const until = user.suspendedUntil;
  const when = isPermanentSuspension(until)
    ? 'Your account has been closed by our moderators'
    : `Your account is suspended until ${until!.toUTCString().replace(/:\d\d GMT$/, ' UTC')}`;
  return user.suspensionReason ? `${when}. Reason: ${user.suspensionReason}` : `${when}.`;
}

/** Throws 403 ACCOUNT_SUSPENDED when the account may not be used right now */
export function assertNotSuspended(user: Suspendable) {
  if (!isSuspended(user)) return;
  throw new ForbiddenException({
    statusCode: 403,
    code: 'ACCOUNT_SUSPENDED',
    message: suspensionMessage(user),
    until: user.suspendedUntil,
  });
}
