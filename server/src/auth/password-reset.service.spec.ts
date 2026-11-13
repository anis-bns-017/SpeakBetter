import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { parseSender } from '../mail/mail.service';
import { hashResetToken, passwordProblem, PasswordResetService, RESET_TTL_MINUTES } from './password-reset.service';

interface TokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  ip: string | null;
}

function setup() {
  const users = [{ id: 'u1', name: 'Mina Rahman', email: 'mina@example.test', googleId: null, passwordHash: 'old-hash' }];
  const tokens: TokenRow[] = [];
  const matches = (row: TokenRow, where: any) =>
    (where.id === undefined || row.id === where.id) && (where.userId === undefined || row.userId === where.userId) && (where.usedAt !== null || row.usedAt === null);
  const prisma: any = {
    user: {
      findFirst: jest.fn(async ({ where }) => users.find((u) => u.email === where.email.equals) ?? null),
      update: jest.fn(async ({ where, data }) => Object.assign(users.find((u) => u.id === where.id)!, data)),
    },
    passwordResetToken: {
      updateMany: jest.fn(async ({ where, data }) => {
        const hit = tokens.filter((t) => matches(t, where));
        hit.forEach((t) => Object.assign(t, data));
        return { count: hit.length };
      }),
      create: jest.fn(async ({ data }) => {
        const row = { id: `t${tokens.length + 1}`, usedAt: null, ...data };
        tokens.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const row = tokens.find((t) => t.tokenHash === where.tokenHash);
        return row ? { ...row, user: users.find((u) => u.id === row.userId) } : null;
      }),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const mail = { send: jest.fn().mockResolvedValue(true) };
  const auth = { logoutAll: jest.fn().mockResolvedValue({ success: true, revokedFamilies: 1 }) };
  const config = { get: (key: string) => (key === 'FRONTEND_URL' ? 'http://app.test/' : undefined) };
  const service = new PasswordResetService(prisma, config as any, mail as any, auth as any);
  /** The token from the link in the last email sent */
  const lastToken = () => {
    const text: string = mail.send.mock.calls.at(-1)[0].text;
    return decodeURIComponent(text.match(/token=([^\s]+)/)![1]);
  };
  return { service, prisma, mail, auth, users, tokens, lastToken };
}

describe('passwordProblem', () => {
  it('asks for a reasonable password', () => {
    expect(passwordProblem('short1')).toMatch(/at least 8/);
    expect(passwordProblem('onlyletters')).toMatch(/number or symbol/);
    expect(passwordProblem('12345678')).toMatch(/number or symbol/);
    expect(passwordProblem('mina-2026!', 'mina@example.test')).toMatch(/email name/);
    expect(passwordProblem('blue-river-42', 'mina@example.test')).toBeNull();
    expect(passwordProblem(undefined)).toMatch(/at least 8/);
  });
});

describe('parseSender', () => {
  it('reads "Name <email>" and a bare email', () => {
    expect(parseSender('SpeakBetter <hi@speak.test>')).toEqual({ name: 'SpeakBetter', email: 'hi@speak.test' });
    expect(parseSender('hi@speak.test')).toEqual({ email: 'hi@speak.test' });
  });
});

describe('PasswordResetService', () => {
  it('answers the same for an unknown email and sends nothing', async () => {
    const { service, mail, tokens } = setup();
    expect(await service.request('nobody@example.test')).toEqual({ ok: true });
    expect(await service.request('not-an-email')).toEqual({ ok: true });
    expect(mail.send).not.toHaveBeenCalled();
    expect(tokens).toHaveLength(0);
  });

  it('emails a link and stores only a hash of its token', async () => {
    const { service, mail, tokens, lastToken } = setup();
    expect(await service.request('  MINA@example.test ', '1.2.3.4')).toEqual({ ok: true });
    expect(mail.send).toHaveBeenCalledTimes(1);
    const message = mail.send.mock.calls[0][0];
    expect(message.to).toBe('mina@example.test');
    expect(message.text).toContain('http://app.test/reset-password?token=');
    const token = lastToken();
    expect(tokens[0].tokenHash).toBe(hashResetToken(token));
    expect(tokens[0].tokenHash).not.toContain(token);
    const minutes = (tokens[0].expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(RESET_TTL_MINUTES - 1);
    expect(minutes).toBeLessThanOrEqual(RESET_TTL_MINUTES);
  });

  it('cancels older links when a new one is asked for', async () => {
    const { service, lastToken } = setup();
    await service.request('mina@example.test');
    const first = lastToken();
    await service.request('mina@example.test');
    const second = lastToken();
    expect((await service.check(first)).valid).toBe(false);
    expect((await service.check(second)).valid).toBe(true);
  });

  it('sets the new password once, signs out everywhere and says so by email', async () => {
    const { service, users, auth, mail, lastToken } = setup();
    await service.request('mina@example.test');
    const token = lastToken();
    await expect(service.reset(token, 'weak')).rejects.toThrow(BadRequestException);
    expect(await service.reset(token, 'blue-river-42')).toEqual({ ok: true });
    expect(await bcrypt.compare('blue-river-42', users[0].passwordHash)).toBe(true);
    expect(auth.logoutAll).toHaveBeenCalledWith('u1', 'password_reset');
    expect(mail.send.mock.calls.at(-1)[0].subject).toBe('Your SpeakBetter password was changed');
    // The same link can't be used again
    await expect(service.reset(token, 'another-pass-9')).rejects.toThrow(/expired or was already used/);
  });

  it('refuses an expired or made-up link', async () => {
    const { service, tokens, lastToken } = setup();
    await service.request('mina@example.test');
    tokens[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.reset(lastToken(), 'blue-river-42')).rejects.toThrow(/expired/);
    await expect(service.reset('x'.repeat(43), 'blue-river-42')).rejects.toThrow(/expired/);
    expect((await service.check('short')).valid).toBe(false);
  });
});
