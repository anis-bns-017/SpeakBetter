// server/src/auth/password-reset.service.ts
// "Forgot password": a one-time link by email to choose a new password.
//   - The answer to "send me a link" is always the same, whether or not the email has an account, so the form
//     can't be used to find out who uses SpeakBetter.
//   - The link holds a random token; only its SHA-256 hash is stored. It works once, for 30 minutes, and asking
//     for a new link cancels the old ones.
//   - Setting the new password signs the account out everywhere and sends a "your password was changed" email.

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';

export const RESET_TTL_MINUTES = 30;
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

export const hashResetToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

/** Why a new password is not accepted, or null when it is fine */
export function passwordProblem(password: unknown, email?: string): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters`;
  if (!/[A-Za-z]/.test(password) || !/[^A-Za-z]/.test(password)) return 'Mix letters with at least one number or symbol';
  if (email && password.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) {
    return "Don't use your email name in the password";
  }
  return null;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function emailLayout(title: string, body: string, button?: { label: string; url: string }) {
  const action = button
    ? `<p style="margin:28px 0"><a href="${button.url}" style="background:#3B4FB2;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>
       <p style="color:#5E5B53;font-size:13px">Or paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(button.url)}</span></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#F7F5F1;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1A1916">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <p style="font-weight:700;font-size:18px;color:#3B4FB2;margin:0 0 20px">SpeakBetter</p>
    <div style="background:#ffffff;border:1px solid #E3E0D9;border-radius:20px;padding:28px">
      <h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(title)}</h1>
      ${body}
      ${action}
    </div>
  </div></body></html>`;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
    private auth: AuthService,
  ) {}

  private get appUrl() {
    return (this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/+$/, '');
  }

  /** Emails a reset link if the account exists. Always resolves the same way. */
  async request(rawEmail: unknown, ip?: string | null): Promise<{ ok: true }> {
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase().slice(0, 320) : '';
    if (!email.includes('@')) return { ok: true };

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, name: true, email: true, googleId: true, passwordHash: true },
    });
    if (!user) return { ok: true };

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction([
      // Only the newest link works
      this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
          ip: ip?.slice(0, 64) ?? null,
        },
      }),
    ]);

    const url = `${this.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const first = user.name.split(/\s+/)[0] || 'there';
    const google = !user.passwordHash && user.googleId;
    const intro = google
      ? `You usually sign in with Google. You can also set a password, so you can sign in with your email too.`
      : `Someone (hopefully you) asked to reset the password for your SpeakBetter account.`;
    const sent = await this.mail.send({
      to: user.email,
      subject: 'Reset your SpeakBetter password',
      text: `Hi ${first},\n\n${intro}\n\nChoose a new password here (the link works once, for ${RESET_TTL_MINUTES} minutes):\n${url}\n\nIf you didn't ask for this, you can ignore this email. Your password stays the same.\n\nSpeakBetter`,
      html: emailLayout(
        'Reset your password',
        `<p>Hi ${escapeHtml(first)},</p><p>${escapeHtml(intro)}</p><p>The link works once, for ${RESET_TTL_MINUTES} minutes.</p>
         <p style="color:#5E5B53;font-size:13px">If you didn't ask for this, you can ignore this email. Your password stays the same.</p>`,
        { label: 'Choose a new password', url },
      ),
    });
    if (!sent) this.logger.warn(`The reset link for user ${user.id} could not be emailed`);
    return { ok: true };
  }

  /** Whether a link still works, so the page can say so before the person types a new password */
  async check(token: unknown): Promise<{ valid: boolean }> {
    const row = await this.find(token);
    return { valid: !!row };
  }

  /** Sets the new password from a valid link, then signs the account out everywhere */
  async reset(token: unknown, password: unknown): Promise<{ ok: true }> {
    const row = await this.find(token);
    if (!row) throw new BadRequestException('This link has expired or was already used. Ask for a new one.');
    const problem = passwordProblem(password, row.user.email);
    if (problem) throw new BadRequestException(problem);

    const passwordHash = await bcrypt.hash(password as string, 10);
    const now = new Date();
    // Claim the token first, so the same link can't be used twice at the same moment
    const claimed = await this.prisma.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) throw new BadRequestException('This link has expired or was already used. Ask for a new one.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } }),
    ]);
    await this.auth.logoutAll(row.userId, 'password_reset');

    const first = row.user.name.split(/\s+/)[0] || 'there';
    await this.mail.send({
      to: row.user.email,
      subject: 'Your SpeakBetter password was changed',
      text: `Hi ${first},\n\nYour SpeakBetter password was just changed, and you were signed out on every device.\n\nIf this wasn't you, reset your password straight away at ${this.appUrl}/forgot-password\n\nSpeakBetter`,
      html: emailLayout(
        'Your password was changed',
        `<p>Hi ${escapeHtml(first)},</p><p>Your SpeakBetter password was just changed, and you were signed out on every device.</p>
         <p>If this wasn't you, reset your password straight away.</p>`,
        { label: 'Reset my password', url: `${this.appUrl}/forgot-password` },
      ),
    });
    return { ok: true };
  }

  private async find(token: unknown) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
    return row;
  }
}
