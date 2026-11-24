import { BadRequestException, ForbiddenException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { EmailVerificationService, MAX_EMAILS_PER_DAY, RESEND_GAP_SECONDS, VERIFY_TTL_HOURS, maskEmail } from './email-verification.service';
import { VerifiedEmailGuard, verificationEnforced } from './verified-email.guard';
import { hashResetToken } from './password-reset.service';

function setup(options: { provider?: 'resend' | 'log' | 'none'; verified?: boolean; mailFails?: boolean } = {}) {
  const user: any = { id: 'u1', name: 'Mina Rahman', email: 'mina@example.test', emailVerifiedAt: options.verified ? new Date() : null };
  const tokens: any[] = [];
  const prisma: any = {
    user: {
      findUnique: jest.fn(async () => user),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.emailVerifiedAt === null && user.emailVerifiedAt) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      }),
    },
    emailVerificationToken: {
      findMany: jest.fn(async ({ where }: any) =>
        tokens.filter((t) => t.createdAt >= where.createdAt.gte).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_EMAILS_PER_DAY),
      ),
      findUnique: jest.fn(async ({ where }: any) => {
        const row = tokens.find((t) => t.tokenHash === where.tokenHash);
        return row ? { ...row, user } : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `t${tokens.length + 1}`, usedAt: null, createdAt: new Date(clock), ...data };
        tokens.push(row);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = tokens.filter((t) => (!where.id || t.id === where.id) && (!where.userId || t.userId === where.userId) && t.usedAt === null);
        hit.forEach((t) => Object.assign(t, data));
        return { count: hit.length };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const at = tokens.findIndex((t) => t.tokenHash === where.tokenHash);
        if (at >= 0) tokens.splice(at, 1);
        return { count: at >= 0 ? 1 : 0 };
      }),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  let clock = Date.now();
  const mail: any = { provider: options.provider ?? 'resend', send: jest.fn().mockResolvedValue(!options.mailFails) };
  const config: any = {
    get: (key: string) => (key === 'FRONTEND_URL' ? 'http://app.test/' : key === 'RESEND_API_KEY' && (options.provider ?? 'resend') === 'resend' ? 'k' : undefined),
  };
  const service = new EmailVerificationService(prisma, config, mail);
  const lastToken = () => decodeURIComponent(mail.send.mock.calls.at(-1)[0].text.match(/token=([^\s]+)/)[1]);
  const at = (ms: number) => {
    clock = ms;
    return new Date(ms);
  };
  return { service, user, tokens, mail, lastToken, at, start: clock };
}

describe('maskEmail', () => {
  it('shows enough to recognise your own address', () => {
    expect(maskEmail('mina@gmail.com')).toBe('m***@gmail.com');
  });
});

describe('sending a link', () => {
  it('stores only a hash and links to the confirm page', async () => {
    const { service, tokens, mail, lastToken } = setup();
    expect(await service.send('u1')).toMatchObject({ sent: true, devLog: false });
    expect(mail.send.mock.calls[0][0]).toMatchObject({ to: 'mina@example.test', subject: 'Confirm your SpeakBetter email' });
    expect(mail.send.mock.calls[0][0].text).toContain('http://app.test/verify-email?token=');
    expect(tokens[0].tokenHash).toBe(hashResetToken(lastToken()));
    expect(tokens[0].tokenHash).not.toBe(lastToken());
    expect(tokens[0].expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(VERIFY_TTL_HOURS * 3_600_000);
  });

  it('sends nothing to someone already confirmed', async () => {
    const { service, mail } = setup({ verified: true });
    expect(await service.send('u1')).toMatchObject({ sent: false, verified: true });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('makes people wait between emails, and limits them per day', async () => {
    const { service, at, start } = setup();
    await service.send('u1', at(start));
    await expect(service.send('u1', at(start + 10_000))).rejects.toThrow(HttpException);
    for (let i = 1; i < MAX_EMAILS_PER_DAY; i++) await service.send('u1', at(start + i * (RESEND_GAP_SECONDS + 1) * 1000));
    await expect(service.send('u1', at(start + 3_600_000))).rejects.toThrow(/several links/);
    await expect(service.send('u1', at(start + 25 * 3_600_000))).resolves.toMatchObject({ sent: true });
  });

  it('does not count an email that failed to send', async () => {
    const { service, tokens } = setup({ mailFails: true });
    await expect(service.send('u1')).rejects.toThrow(ServiceUnavailableException);
    expect(tokens).toHaveLength(0);
  });

  it('never stops a sign-up, even when mail is down', async () => {
    await expect(setup({ mailFails: true }).service.sendAfterSignup('u1')).resolves.toBeUndefined();
    await expect(setup({ provider: 'none' }).service.sendAfterSignup('u1')).resolves.toBeUndefined();
  });

  it('tells the app when no email can be sent', async () => {
    expect(await setup({ provider: 'none' }).service.status('u1')).toMatchObject({ verified: false, canSend: false, required: false });
    expect(await setup({ provider: 'log' }).service.status('u1')).toMatchObject({ canSend: true, devLog: true, required: false });
    expect(await setup({ provider: 'resend' }).service.status('u1')).toMatchObject({ canSend: true, devLog: false, required: true });
  });
});

describe('confirming', () => {
  it('opening the link confirms nothing, so a mail scanner cannot do it', async () => {
    const { service, user, lastToken } = setup();
    await service.send('u1');
    expect(await service.check(lastToken())).toEqual({ valid: true, alreadyConfirmed: false, email: 'm***@example.test' });
    expect(user.emailVerifiedAt).toBeNull();
  });

  it('confirms once, and a second click is harmless', async () => {
    const { service, user, lastToken } = setup();
    await service.send('u1');
    const token = lastToken();
    expect(await service.confirm(token)).toEqual({ ok: true, alreadyConfirmed: false });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await service.confirm(token)).toEqual({ ok: true, alreadyConfirmed: true });
    expect(await service.check(token)).toMatchObject({ valid: false, alreadyConfirmed: true });
  });

  it('refuses a replaced, expired or made-up link', async () => {
    const { service, user, lastToken, at, start } = setup();
    await service.send('u1', at(start));
    const old = lastToken();
    await service.send('u1', at(start + (RESEND_GAP_SECONDS + 1) * 1000));
    await expect(service.confirm(old)).rejects.toThrow(BadRequestException);
    const fresh = lastToken();
    await expect(service.confirm(fresh, new Date(start + (VERIFY_TTL_HOURS + 2) * 3_600_000))).rejects.toThrow(/expired/);
    await expect(service.confirm('x'.repeat(43))).rejects.toThrow(BadRequestException);
    await expect(service.confirm(undefined)).rejects.toThrow(BadRequestException);
    expect(user.emailVerifiedAt).toBeNull();
    expect(await service.check('short')).toEqual({ valid: false, alreadyConfirmed: false, email: null });
  });
});

describe('the rule for reaching other people', () => {
  const context = (user: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;
  const withKey = { get: (key: string) => (key === 'BREVO_API_KEY' ? 'k' : undefined) } as any;
  const withoutKey = { get: () => undefined } as any;

  it('only applies once a real email service is connected', () => {
    expect(verificationEnforced(withKey)).toBe(true);
    expect(verificationEnforced(withoutKey)).toBe(false);
    expect(verificationEnforced(undefined)).toBe(false);
    expect(new VerifiedEmailGuard(withoutKey).canActivate(context({ emailVerifiedAt: null }))).toBe(true);
  });

  it('then needs a confirmed email', () => {
    const guard = new VerifiedEmailGuard(withKey);
    expect(guard.canActivate(context({ emailVerifiedAt: new Date() }))).toBe(true);
    expect(() => guard.canActivate(context({ emailVerifiedAt: null }))).toThrow(ForbiddenException);
  });
});
