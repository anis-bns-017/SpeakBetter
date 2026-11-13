// server/src/mail/mail.service.ts
// Sends the app's emails (password reset for now). No library needed: it calls the provider's web API.
//   RESEND_API_KEY -> Resend (free tier: 3,000 emails a month)
//   BREVO_API_KEY  -> Brevo  (free tier: 300 emails a day)
//   MAIL_FROM      -> the sender, e.g. "SpeakBetter <hello@yourdomain.com>" (the domain must be set up with the provider)
// With neither key, in development the email is printed to the server log so links can be tested by hand.
// In production nothing is sent or logged (a reset link in a log would be a way into the account).

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type MailProvider = 'resend' | 'brevo' | 'log' | 'none';

const TIMEOUT_MS = 10_000;

/** "Name <email>" or a bare email, as { name, email } */
export function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || undefined, email: match[2].trim() } : { email: from.trim() };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private config: ConfigService) {}

  get provider(): MailProvider {
    if (this.config.get<string>('RESEND_API_KEY')) return 'resend';
    if (this.config.get<string>('BREVO_API_KEY')) return 'brevo';
    return this.config.get<string>('NODE_ENV') === 'production' ? 'none' : 'log';
  }

  private get from(): string {
    return this.config.get<string>('MAIL_FROM') || 'SpeakBetter <onboarding@resend.dev>';
  }

  /** Sends one email. Never throws: returns whether it went out (the caller decides what that means). */
  async send(message: MailMessage): Promise<boolean> {
    const provider = this.provider;
    try {
      if (provider === 'resend') return await this.sendResend(message);
      if (provider === 'brevo') return await this.sendBrevo(message);
      if (provider === 'log') {
        this.logger.warn(`No email service set (RESEND_API_KEY or BREVO_API_KEY). Email to ${message.to}: "${message.subject}"\n${message.text}`);
        return true;
      }
      this.logger.error(`Email not sent to ${message.to}: no email service is set up (RESEND_API_KEY or BREVO_API_KEY)`);
      return false;
    } catch (error) {
      this.logger.error(`Email to ${message.to} failed (${provider}): ${(error as Error)?.message}`);
      return false;
    }
  }

  private async post(url: string, headers: Record<string, string>, body: unknown) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(`HTTP ${response.status} ${detail}`);
    }
    return true;
  }

  private sendResend(m: MailMessage) {
    return this.post(
      'https://api.resend.com/emails',
      { Authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')}` },
      { from: this.from, to: [m.to], subject: m.subject, text: m.text, html: m.html },
    );
  }

  private sendBrevo(m: MailMessage) {
    return this.post(
      'https://api.brevo.com/v3/smtp/email',
      { 'api-key': this.config.get<string>('BREVO_API_KEY') ?? '' },
      { sender: parseSender(this.from), to: [{ email: m.to }], subject: m.subject, textContent: m.text, htmlContent: m.html },
    );
  }
}
