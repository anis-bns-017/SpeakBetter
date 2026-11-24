// server/src/auth/email-verification.service.ts
// Proving you own your email address.
//   - The link holds a random token; only its SHA-256 hash is stored. It works once, for 24 hours, and asking for a
//     new link cancels the old ones.
//   - Opening the link does not confirm anything: the page asks for one click. Mail scanners open links on their
//     own, and must not be able to confirm an address for someone who signed up with another person's email.
//   - Sending is limited per person, so the button can't be used to flood somebody's inbox.

import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { emailLayout, escapeHtml, hashResetToken } from './password-reset.service';
import { verificationEnforced } from './verified-email.guard';

export const VERIFY_TTL_HOURS = 24;
/** Wait at least this long between two emails */
export const RESEND_GAP_SECONDS = 60;
export const MAX_EMAILS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** m***@gmail.com: enough to recognise your own address, not enough to read someone else's from a link */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name.charAt(0)}***@${domain ?? ''}`;
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  private get appUrl() {
    return (this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/+$/, '');
  }

  /** What the app needs to know to show (or not show) the reminder */
  async status(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
    return {
      verified: !!user?.emailVerifiedAt,
      email: user?.email ?? null,
      /** False on a live server with no email service: the app then stays quiet instead of promising an email */
      canSend: this.mail.provider !== 'none',
      /** With no real email service the link only appears in the server log (development) */
      devLog: this.mail.provider === 'log',
      required: verificationEnforced(this.config),
    };
  }

  /** Emails a new link to the signed-in person */
  async send(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, emailVerifiedAt: true },
    });
    if (!user) throw new BadRequestException('Account not found');
    if (user.emailVerifiedAt) return { sent: false, verified: true, devLog: false };
    if (this.mail.provider === 'none') throw new ServiceUnavailableException('Email is not set up yet. Try again later.');

    const recent = await this.prisma.emailVerificationToken.findMany({
      where: { userId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
      take: MAX_EMAILS_PER_DAY,
    });
    if (recent.length >= MAX_EMAILS_PER_DAY) {
      throw new HttpException('You have asked for several links today. Check your spam folder, or try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent[0] && now.getTime() - recent[0].createdAt.getTime() < RESEND_GAP_SECONDS * 1000) {
      throw new HttpException('We just sent a link. Check your inbox, or try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(token);
    await this.prisma.$transaction([
      // Only the newest link works
      this.prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
      this.prisma.emailVerificationToken.create({
        data: { userId, tokenHash, expiresAt: new Date(now.getTime() + VERIFY_TTL_HOURS * 60 * 60 * 1000) },
      }),
    ]);

    const url = `${this.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const first = user.name.split(/\s+/)[0] || 'there';
    const sent = await this.mail.send({
      to: user.email,
      subject: 'Confirm your SpeakBetter email',
      text: `Hi ${first},\n\nConfirm this email address for your SpeakBetter account (the link works once, for ${VERIFY_TTL_HOURS} hours):\n${url}\n\nIf you didn't create a SpeakBetter account, ignore this email and don't press confirm.\n\nSpeakBetter`,
      html: emailLayout(
        'Confirm your email',
        `<p>Hi ${escapeHtml(first)},</p><p>Confirm this email address for your SpeakBetter account. The link works once, for ${VERIFY_TTL_HOURS} hours.</p>
         <p style="color:#5E5B53;font-size:13px">If you didn't create a SpeakBetter account, ignore this email and don't press confirm.</p>`,
        { label: 'Confirm my email', url },
      ),
    });
    if (!sent) {
      // A link nobody received must not use up the person's allowance
      await this.prisma.emailVerificationToken.deleteMany({ where: { tokenHash } });
      throw new ServiceUnavailableException("We couldn't send the email. Try again in a minute.");
    }
    return { sent: true, verified: false, devLog: this.mail.provider === 'log' };
  }

  /** Straight after signing up. A mail problem must never stop someone from getting in. */
  async sendAfterSignup(userId: string) {
    try {
      await this.send(userId);
    } catch (error) {
      this.logger.warn(`The confirmation link for user ${userId} was not sent: ${(error as Error)?.message}`);
    }
  }

  /** What the link is for, without confirming anything */
  async check(token: unknown) {
    const row = await this.find(token);
    if (!row) return { valid: false, alreadyConfirmed: false, email: null };
    const email = maskEmail(row.user.email);
    if (row.user.emailVerifiedAt) return { valid: false, alreadyConfirmed: true, email };
    return { valid: !row.usedAt && row.expiresAt.getTime() > Date.now(), alreadyConfirmed: false, email };
  }

  /** The one click on the page: marks the address as confirmed */
  async confirm(token: unknown, now = new Date()) {
    const row = await this.find(token);
    if (row?.user.emailVerifiedAt) return { ok: true, alreadyConfirmed: true };
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('This link has expired or was replaced by a newer one. Ask for a new one.');
    }
    // Claiming the token first means the same link can't be used twice at the same moment
    const claimed = await this.prisma.emailVerificationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) return { ok: true, alreadyConfirmed: true };
    await this.prisma.$transaction([
      this.prisma.user.updateMany({ where: { id: row.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } }),
      this.prisma.emailVerificationToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } }),
    ]);
    return { ok: true, alreadyConfirmed: false };
  }

  private async find(token: unknown) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
    return this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: { select: { email: true, emailVerifiedAt: true } } },
    });
  }
}
