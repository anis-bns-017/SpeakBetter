import { AuthService, normalizeEmail } from './auth.service';

describe('email addresses', () => {
  it('treats different capitals as one address', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com');
  });
});

/** Runs the real method on a stand-in, so only what it touches has to exist */
function fakeAuth(existing: Record<string, unknown> | null) {
  const update = jest.fn(async ({ data }: any) => ({ ...existing, ...data }));
  const self: any = {
    prisma: { user: { findUnique: jest.fn(async () => existing), update, create: jest.fn(async ({ data }: any) => ({ id: 'new', ...data })) } },
    logoutAll: jest.fn().mockResolvedValue({ success: true, revokedFamilies: 1 }),
    startSession: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
    sanitizeUser: (u: unknown) => u,
  };
  return { self, update, login: (email: string) => AuthService.prototype.googleLogin.call(self, { email, name: 'Me', googleId: 'g1' }) };
}

describe('signing in with Google', () => {
  it('shuts out whoever set a password on an address they never proved', async () => {
    const { self, update, login } = fakeAuth({ id: 'u1', email: 'me@x.com', passwordHash: 'attacker', googleId: null, suspendedUntil: null });
    await login('Me@X.com');
    expect(self.prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'me@x.com' } }));
    expect(self.logoutAll).toHaveBeenCalledWith('u1', 'google_linked');
    expect(update.mock.calls[0][0].data).toMatchObject({ googleId: 'g1', passwordHash: null, emailVerifiedAt: expect.any(Date) });
  });

  it('leaves an account that already uses Google alone', async () => {
    const { self, update, login } = fakeAuth({ id: 'u1', email: 'me@x.com', passwordHash: 'mine', googleId: 'g1', emailVerifiedAt: new Date(), suspendedUntil: null });
    await login('me@x.com');
    expect(self.logoutAll).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
