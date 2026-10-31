import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma.service';
import { AuthService, SessionMeta } from './auth.service';

/**
 * These tests need a real PostgreSQL (row locks, advisory locks and atomic
 * updates are the point). Point AUTH_TEST_DATABASE_URL at a throwaway database
 * that has the migrations applied, e.g.
 *
 *   createdb authtest_x && DATABASE_URL=.../authtest_x npx prisma migrate deploy
 *   AUTH_TEST_DATABASE_URL=.../authtest_x npx jest src/auth/auth.service.spec.ts
 *
 * Without the variable the suite is skipped. The database name must contain
 * "test": the suite deletes the users it creates and refuses anything else.
 */
const TEST_DB_URL = process.env.AUTH_TEST_DATABASE_URL;
const describeDb = TEST_DB_URL ? describe : describe.skip;

const CONFIG: Record<string, string> = {
  JWT_SECRET: 'test-access-secret',
  JWT_EXPIRES_IN: '15m',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret',
  REFRESH_EXPIRES_IN: '30d',
};

const sha256 = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

const META: SessionMeta = { userAgent: 'UA-laptop', ip: '10.0.0.1' };

describeDb('AuthService sessions (PostgreSQL)', () => {
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;
  let service: AuthService;
  let counter = 0;
  const emails: string[] = [];

  const build = (extra: Record<string, string> = {}) => {
    const values = { ...CONFIG, ...extra };
    config = {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        if (!(key in values)) throw new Error(`missing ${key}`);
        return values[key];
      },
    } as unknown as ConfigService;
    service = new AuthService(prisma, jwt, config);
  };

  const newUser = async () => {
    const email = `authtest-${Date.now()}-${counter++}@example.test`;
    emails.push(email);
    return prisma.user.create({
      data: { email, name: 'Auth Test', passwordHash: 'x' },
    });
  };

  const login = async (meta: SessionMeta = META) => {
    const user = await newUser();
    // register() hashes a password; issue through the same path login uses
    const tokens = await (service as any).startSession(user, meta);
    const session = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: sha256(tokens.refreshToken) },
    });
    return { user, ...tokens, session };
  };

  const code = (error: any) => error?.response?.code;
  const refreshCode = async (token: string, meta: SessionMeta = META) => {
    try {
      await service.refreshToken(token, meta);
      return 'OK';
    } catch (error) {
      return code(error) ?? `ERR:${error?.message}`;
    }
  };

  beforeAll(async () => {
    const dbName = new URL(TEST_DB_URL!).pathname.slice(1);
    if (!/test/i.test(dbName)) {
      throw new Error(
        `Refusing to run against "${dbName}": name must contain "test"`,
      );
    }
    process.env.DATABASE_URL = TEST_DB_URL;
    prisma = new PrismaService();
    await prisma.$connect();
    jwt = new JwtService({
      secret: CONFIG.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    });
    build();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.onModuleDestroy();
  });

  beforeEach(() => build());

  // ---------------------------------------------------------------- issuing

  describe('issuing sessions', () => {
    it('stores only the hash, with the session id in both tokens', async () => {
      const { refreshToken, accessToken, session } = await login();

      expect(session.tokenHash).toBe(sha256(refreshToken));
      expect(session.token).toBeNull();
      expect(jwt.decode(accessToken)).toMatchObject({ sid: session.id });
      expect((jwt.decode(refreshToken, { json: true }) as any).sid).toBe(
        session.id,
      );
      expect(session.userAgent).toBe('UA-laptop');
      expect(session.ip).toBe('10.0.0.1');
    });

    it('row expiry equals the refresh token expiry', async () => {
      const { refreshToken, session } = await login();
      const exp = (jwt.decode(refreshToken, { json: true }) as any).exp;
      expect(session.expiresAt.getTime()).toBe(exp * 1000);
    });

    it('two logins in the same second get different tokens (no unique clash)', async () => {
      const user = await newUser();
      const issue = () => (service as any).startSession(user, META);
      const [a, b, c] = await Promise.all([issue(), issue(), issue()]);

      expect(
        new Set([a.refreshToken, b.refreshToken, c.refreshToken]).size,
      ).toBe(3);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(
        3,
      );
    });
  });

  // --------------------------------------------------------------- rotation

  describe('refresh rotation', () => {
    it('rotates into the same family and links parent to child', async () => {
      const first = await login();
      const result = await service.refreshToken(first.refreshToken, META);

      expect(result.refreshToken).not.toBe(first.refreshToken);
      expect((result.user as any).passwordHash).toBeUndefined();

      const parent = await prisma.session.findUniqueOrThrow({
        where: { id: first.session.id },
      });
      const child = await prisma.session.findUniqueOrThrow({
        where: { tokenHash: sha256(result.refreshToken) },
      });
      expect(parent.rotatedAt).not.toBeNull();
      expect(parent.revokedAt).toBeNull();
      expect(parent.replacedById).toBe(child.id);
      expect(child.familyId).toBe(first.session.familyId);
      expect(child.rotatedAt).toBeNull();
      expect(jwt.decode(result.accessToken)).toMatchObject({ sid: child.id });
    });

    it('the new token can be refreshed again', async () => {
      const first = await login();
      const second = await service.refreshToken(first.refreshToken, META);
      await expect(
        service.refreshToken(second.refreshToken, META),
      ).resolves.toBeDefined();
    });

    it('rejects a bad signature, an expired row, an unknown token and a deleted user', async () => {
      const { refreshToken, session, user } = await login();

      expect(await refreshCode('not.a.jwt')).toBe('REFRESH_INVALID');
      const forged = await jwt.signAsync(
        { sub: user.id, email: user.email, sid: session.id },
        { secret: 'wrong-secret', expiresIn: '1d' },
      );
      expect(await refreshCode(forged)).toBe('REFRESH_INVALID');

      const unknown = await jwt.signAsync(
        { sub: user.id, email: user.email, sid: 'nope' },
        { secret: CONFIG.REFRESH_TOKEN_SECRET, expiresIn: '1d' },
      );
      expect(await refreshCode(unknown)).toBe('REFRESH_INVALID');

      await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(await refreshCode(refreshToken)).toBe('REFRESH_EXPIRED');

      const other = await login();
      await prisma.user.delete({ where: { id: other.user.id } });
      expect(await refreshCode(other.refreshToken)).toBe('REFRESH_INVALID');
    });

    it('rejects a token whose session id belongs to a different session', async () => {
      const a = await login();
      const b = await login();
      // a's valid signature + b's sid claim
      const mixed = await jwt.signAsync(
        { sub: a.user.id, email: a.user.email, sid: b.session.id },
        { secret: CONFIG.REFRESH_TOKEN_SECRET, expiresIn: '1d' },
      );
      expect(await refreshCode(mixed)).toBe('REFRESH_INVALID');
    });
  });

  // ------------------------------------------------- races vs. token reuse

  describe('concurrent refresh vs. token reuse', () => {
    it('two simultaneous refreshes: exactly one wins, the other is a benign race', async () => {
      const first = await login();
      const results = await Promise.all([
        refreshCode(first.refreshToken),
        refreshCode(first.refreshToken),
      ]);

      expect(results.filter((r) => r === 'OK')).toHaveLength(1);
      expect(results.filter((r) => r === 'REFRESH_RACE')).toHaveLength(1);

      // Family untouched: winner's session is alive, only one child exists
      const rows = await prisma.session.findMany({
        where: { familyId: first.session.familyId },
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.revokedAt === null)).toBe(true);
    });

    it('a tolerated replay never issues tokens or rows', async () => {
      const first = await login();
      await service.refreshToken(first.refreshToken, META);
      const before = await prisma.session.count({
        where: { familyId: first.session.familyId },
      });

      expect(await refreshCode(first.refreshToken)).toBe('REFRESH_RACE');

      expect(
        await prisma.session.count({
          where: { familyId: first.session.familyId },
        }),
      ).toBe(before);
    });

    it('replay after the new token was already used revokes the family', async () => {
      const first = await login();
      const second = await service.refreshToken(first.refreshToken, META);
      await service.refreshToken(second.refreshToken, META); // client moved on

      expect(await refreshCode(first.refreshToken)).toBe('REFRESH_REUSED');

      const live = await prisma.session.count({
        where: { familyId: first.session.familyId, revokedAt: null },
      });
      expect(live).toBe(0);
      expect(await refreshCode(second.refreshToken)).toBe('REFRESH_REVOKED');
    });

    it('replay outside the grace window revokes the family', async () => {
      const first = await login();
      const second = await service.refreshToken(first.refreshToken, META);
      await prisma.session.update({
        where: { id: first.session.id },
        data: { rotatedAt: new Date(Date.now() - 60_000) },
      });

      expect(await refreshCode(first.refreshToken)).toBe('REFRESH_REUSED');
      expect(await refreshCode(second.refreshToken)).toBe('REFRESH_REVOKED');
    });

    it('replay from a different client inside the grace window revokes the family', async () => {
      const first = await login();
      const second = await service.refreshToken(first.refreshToken, META);

      expect(
        await refreshCode(first.refreshToken, {
          userAgent: 'UA-attacker',
          ip: META.ip,
        }),
      ).toBe('REFRESH_REUSED');
      expect(await refreshCode(second.refreshToken)).toBe('REFRESH_REVOKED');
    });

    it('a different IP alone is also treated as suspicious', async () => {
      const first = await login();
      await service.refreshToken(first.refreshToken, META);
      expect(
        await refreshCode(first.refreshToken, {
          userAgent: META.userAgent,
          ip: '203.0.113.9',
        }),
      ).toBe('REFRESH_REUSED');
    });

    it('missing client info is unknown, not a mismatch', async () => {
      const first = await login();
      await service.refreshToken(first.refreshToken, META);
      expect(await refreshCode(first.refreshToken, {})).toBe('REFRESH_RACE');
    });

    it('repeated replays are capped even inside the grace window', async () => {
      const first = await login();
      await service.refreshToken(first.refreshToken, META);

      for (let i = 0; i < 3; i++) {
        expect(await refreshCode(first.refreshToken)).toBe('REFRESH_RACE');
      }
      expect(await refreshCode(first.refreshToken)).toBe('REFRESH_REUSED');
    });

    it('grace window is configurable and 0 disables the tolerance', async () => {
      build({ REFRESH_REUSE_GRACE_SECONDS: '0' });
      const first = await login();
      await service.refreshToken(first.refreshToken, META);
      await new Promise((r) => setTimeout(r, 5));
      expect(await refreshCode(first.refreshToken)).toBe('REFRESH_REUSED');
    });
  });

  // ----------------------------------------------------------------- logout

  describe('logout', () => {
    it('revokes the whole family, including later rotations', async () => {
      const first = await login();
      const second = await service.refreshToken(first.refreshToken, META);

      // Logout with the OLD token still kills the newest one
      await service.logout(first.user.id, first.refreshToken);

      expect(await refreshCode(second.refreshToken)).toBe('REFRESH_REVOKED');
      expect(
        await service.authenticateSession({
          sub: first.user.id,
          sid: first.session.id,
        }),
      ).toBeNull();
      const live = await prisma.session.count({
        where: { familyId: first.session.familyId, revokedAt: null },
      });
      expect(live).toBe(0);
      const row = await prisma.session.findUniqueOrThrow({
        where: { id: first.session.id },
      });
      expect(row.revokedReason).toBe('logout');
    });

    it('is idempotent and tolerant of unknown or foreign tokens', async () => {
      const a = await login();
      const b = await login();

      await expect(service.logout(a.user.id, a.refreshToken)).resolves.toEqual({
        success: true,
      });
      await expect(service.logout(a.user.id, a.refreshToken)).resolves.toEqual({
        success: true,
      });
      await expect(service.logout(a.user.id, 'garbage')).resolves.toEqual({
        success: true,
      });
      await expect(service.logoutByRefreshToken('garbage')).resolves.toEqual({
        success: true,
        userId: null,
      });

      // a cannot end b's login
      await service.logout(a.user.id, b.refreshToken);
      expect(
        await prisma.session.count({
          where: { familyId: b.session.familyId, revokedAt: null },
        }),
      ).toBe(1);
    });

    it('without a refresh token it changes nothing (documented no-op)', async () => {
      const a = await login();
      await expect(service.logout(a.user.id)).resolves.toEqual({
        success: true,
      });
      expect(await refreshCode(a.refreshToken)).toBe('OK');
    });

    it('works with an expired refresh token', async () => {
      const a = await login();
      await prisma.session.update({
        where: { id: a.session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await service.logoutByRefreshToken(a.refreshToken);
      const row = await prisma.session.findUniqueOrThrow({
        where: { id: a.session.id },
      });
      expect(row.revokedAt).not.toBeNull();
    });

    it('logout racing a refresh never leaves a live session behind', async () => {
      for (let i = 0; i < 25; i++) {
        const first = await login();
        const delay = () =>
          new Promise((r) => setTimeout(r, Math.floor(Math.random() * 6)));

        const [refreshed] = await Promise.all([
          delay().then(() =>
            service.refreshToken(first.refreshToken, META).catch((e) => e),
          ),
          delay().then(() => service.logout(first.user.id, first.refreshToken)),
        ]);

        const live = await prisma.session.count({
          where: { familyId: first.session.familyId, revokedAt: null },
        });
        expect(live).toBe(0);

        if (refreshed?.refreshToken) {
          // refresh won the race: its new login must still be dead
          expect(await refreshCode(refreshed.refreshToken)).toBe(
            'REFRESH_REVOKED',
          );
          expect(
            await service.authenticateSession({
              sub: first.user.id,
              sid: (jwt.decode(refreshed.accessToken) as any).sid,
            }),
          ).toBeNull();
        }
      }
    });

    it('logout issued while a refresh is mid-transaction waits for it and revokes the new row too', async () => {
      // Forces the interleaving the random test only hits by chance: the refresh
      // has claimed the old row and inserted its child but not committed yet.
      const first = await login();
      let logoutDone = false;
      let logout: Promise<void> = Promise.resolve();

      await prisma.$transaction(async (tx) => {
        const outcome = await (service as any).rotate(
          tx,
          first.session.id,
          first.session.familyId,
          META,
        );
        expect(outcome.kind).toBe('ok');

        logout = service.logout(first.user.id, first.refreshToken).then(() => {
          logoutDone = true;
        });
        await new Promise((r) => setTimeout(r, 300));
        expect(logoutDone).toBe(false); // blocked on the family lock
      });

      await logout;
      expect(logoutDone).toBe(true);

      const live = await prisma.session.count({
        where: { familyId: first.session.familyId, revokedAt: null },
      });
      expect(live).toBe(0);
      expect(
        await prisma.session.count({
          where: { familyId: first.session.familyId },
        }),
      ).toBe(2);
    });

    it('logoutSession ends the login of that session id, only for its owner', async () => {
      const a = await login();
      const b = await login();
      await service.logoutSession(b.user.id, a.session.id); // wrong owner
      expect(await refreshCode(a.refreshToken)).toBe('OK');

      const fresh = await login();
      await service.logoutSession(fresh.user.id, fresh.session.id);
      expect(await refreshCode(fresh.refreshToken)).toBe('REFRESH_REVOKED');
    });

    it('logoutAll ends every login of one user and nobody else', async () => {
      const user = await newUser();
      const one = await (service as any).startSession(user, META);
      const two = await (service as any).startSession(user, {
        userAgent: 'phone',
      });
      const rotated = await service.refreshToken(two.refreshToken, {
        userAgent: 'phone',
      });
      const stranger = await login();

      await expect(service.logoutAll(user.id)).resolves.toEqual({
        success: true,
        revokedFamilies: 2,
      });

      expect(await refreshCode(one.refreshToken)).toBe('REFRESH_REVOKED');
      expect(
        await refreshCode(rotated.refreshToken, { userAgent: 'phone' }),
      ).toBe('REFRESH_REVOKED');
      expect(await refreshCode(stranger.refreshToken)).toBe('OK');
    });
  });

  // ------------------------------------------------ session validation

  describe('authenticateSession (shared by HTTP and sockets)', () => {
    it('accepts a live session and returns the user with profile', async () => {
      const { user, session } = await login();
      const result = await service.authenticateSession({
        sub: user.id,
        sid: session.id,
      });
      expect(result?.id).toBe(user.id);
    });

    it('stays valid after the session was rotated (until the family is revoked)', async () => {
      const first = await login();
      await service.refreshToken(first.refreshToken, META);
      expect(
        await service.authenticateSession({
          sub: first.user.id,
          sid: first.session.id,
        }),
      ).not.toBeNull();
    });

    it('rejects revoked, expired, mismatched, unknown and deleted-user sessions', async () => {
      const { user, session } = await login();
      const other = await login();

      expect(
        await service.authenticateSession({
          sub: other.user.id,
          sid: session.id,
        }),
      ).toBeNull();
      expect(
        await service.authenticateSession({ sub: user.id, sid: 'unknown' }),
      ).toBeNull();
      expect(
        await service.authenticateSession({ sub: '', sid: session.id }),
      ).toBeNull();

      await prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(
        await service.authenticateSession({ sub: user.id, sid: session.id }),
      ).toBeNull();

      await prisma.user.delete({ where: { id: other.user.id } });
      expect(
        await service.authenticateSession({
          sub: other.user.id,
          sid: other.session.id,
        }),
      ).toBeNull();
    });

    it('legacy access tokens (no sid) are accepted unless disabled, and need an existing user', async () => {
      const { user } = await login();
      expect((await service.authenticateSession({ sub: user.id }))?.id).toBe(
        user.id,
      );
      expect(await service.authenticateSession({ sub: 'ghost' })).toBeNull();

      build({ AUTH_ALLOW_LEGACY_ACCESS: 'false' });
      expect(await service.authenticateSession({ sub: user.id })).toBeNull();
    });
  });

  // ---------------------------------------------- legacy rows (rollout)

  describe('backward compatibility with pre-rotation sessions', () => {
    const legacyToken = (user: { id: string; email: string }) =>
      jwt.signAsync(
        { sub: user.id, email: user.email },
        { secret: CONFIG.REFRESH_TOKEN_SECRET, expiresIn: '30d' },
      );

    it('refreshes a legacy row that was backfilled (token + tokenHash)', async () => {
      const user = await newUser();
      const token = await legacyToken(user);
      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });

      const result = await service.refreshToken(token, META);
      expect(await refreshCode(result.refreshToken)).toBe('OK');
      expect(await refreshCode(token)).not.toBe('OK'); // old one is spent
    });

    it('refreshes a legacy row written by an old instance after the migration (no hash yet)', async () => {
      const user = await newUser();
      const token = await legacyToken(user);
      const row = await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      expect(row.tokenHash).toBeNull();

      await service.refreshToken(token, META);
      const after = await prisma.session.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(after.tokenHash).toBe(sha256(token));
      expect(after.rotatedAt).not.toBeNull();
      expect(after.token).toBe(token); // legacy column is left alone
    });

    it('logout revokes a legacy row', async () => {
      const user = await newUser();
      const token = await legacyToken(user);
      const row = await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      await service.logout(user.id, token);
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: row.id } }))
          .revokedAt,
      ).not.toBeNull();
      expect(await refreshCode(token)).toBe('REFRESH_REVOKED');
    });
  });

  // ----------------------------------------------------------------- cleanup

  describe('pruneSessions', () => {
    const lockKey = "hashtextextended('auth:session-prune', 0)";

    it('deletes expired rows only and keeps rotated / revoked ones that can still be replayed', async () => {
      const expired = await login();
      const rotated = await login();
      const revoked = await login();
      await prisma.session.update({
        where: { id: expired.session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await service.refreshToken(rotated.refreshToken, META);
      await service.logout(revoked.user.id, revoked.refreshToken);

      const result = await service.pruneSessions();
      expect(result.skipped).toBe(false);

      expect(
        await prisma.session.findUnique({ where: { id: expired.session.id } }),
      ).toBeNull();
      expect(
        await prisma.session.findUnique({ where: { id: rotated.session.id } }),
      ).not.toBeNull();
      expect(
        await prisma.session.findUnique({ where: { id: revoked.session.id } }),
      ).not.toBeNull();
      // and reuse detection still works for the kept rotated row
      expect(
        await refreshCode(rotated.refreshToken, { userAgent: 'other' }),
      ).toBe('REFRESH_REUSED');
    });

    it('works in batches', async () => {
      const user = await newUser();
      await prisma.session.createMany({
        data: Array.from({ length: 7 }, (_, i) => ({
          userId: user.id,
          tokenHash: `batch-${user.id}-${i}`,
          expiresAt: new Date(Date.now() - 1000 - i),
        })),
      });
      const result = await service.pruneSessions({ batchSize: 3 });
      expect(result.deleted).toBeGreaterThanOrEqual(7);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(
        0,
      );
    });

    it('does nothing while another instance holds the prune lock', async () => {
      const pool = new Pool({ connectionString: TEST_DB_URL });
      const other = await pool.connect();
      try {
        await other.query(`SELECT pg_advisory_lock(${lockKey})`);
        const user = await newUser();
        const row = await prisma.session.create({
          data: {
            userId: user.id,
            tokenHash: `held-${user.id}`,
            expiresAt: new Date(Date.now() - 1000),
          },
        });

        await expect(service.pruneSessions()).resolves.toEqual({
          skipped: true,
          deleted: 0,
        });
        expect(
          await prisma.session.findUnique({ where: { id: row.id } }),
        ).not.toBeNull();
      } finally {
        await other.query(`SELECT pg_advisory_unlock(${lockKey})`);
        other.release();
        await pool.end();
      }
      await expect(service.pruneSessions()).resolves.toMatchObject({
        skipped: false,
      });
    });

    it('two simultaneous runs never conflict', async () => {
      const results = await Promise.all([
        service.pruneSessions(),
        service.pruneSessions(),
      ]);
      expect(results.every((r) => typeof r.deleted === 'number')).toBe(true);
    });
  });
});
