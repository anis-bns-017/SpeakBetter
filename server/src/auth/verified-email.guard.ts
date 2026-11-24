// server/src/auth/verified-email.guard.ts
// Learning never needs a confirmed email. Reaching people you don't know does, so throwaway and fake addresses
// can't be used to bother them. The rule only applies once a real email service is connected: without one nobody
// could receive the link, and everyone would be locked out.

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';
export const EMAIL_NOT_VERIFIED_MESSAGE = 'Confirm your email first. Open the link we sent you, or ask for a new one.';

/** Whether a confirmed email is required right now */
export const verificationEnforced = (config?: Pick<ConfigService, 'get'> | null): boolean =>
  !!config && (!!config.get<string>('RESEND_API_KEY') || !!config.get<string>('BREVO_API_KEY'));

export const emailNotVerified = () => new ForbiddenException({ code: EMAIL_NOT_VERIFIED, message: EMAIL_NOT_VERIFIED_MESSAGE });

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!verificationEnforced(this.config)) return true;
    const user = context.switchToHttp().getRequest<{ user?: { emailVerifiedAt?: Date | null } }>().user;
    if (!user?.emailVerifiedAt) throw emailNotVerified();
    return true;
  }
}
