import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { PrismaService } from '../prisma.service';
import { AuthModule } from './auth.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * HTTP-level checks of the auth endpoints against a real PostgreSQL. Same
 * opt-in as auth.service.spec.ts: set AUTH_TEST_DATABASE_URL to a throwaway
 * database (name containing "test") that has the migrations applied.
 */
const TEST_DB_URL = process.env.AUTH_TEST_DATABASE_URL;
const describeDb = TEST_DB_URL ? describe : describe.skip;

const CONFIG = {
  JWT_SECRET: 'test-access-secret',
  JWT_EXPIRES_IN: '15m',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret',
  REFRESH_EXPIRES_IN: '30d',
  GOOGLE_CLIENT_ID: 'x',
  GOOGLE_CLIENT_SECRET: 'x',
  GOOGLE_CALLBACK_URL: 'http://localhost/cb',
};

type Cookies = Record<string, string>;

/** Name -> value of the cookies a response sets; a cleared cookie has an empty value */
const setCookies = (res: request.Response): Cookies => {
  const out: Cookies = {};
  for (const line of (res.headers['set-cookie'] as unknown as string[]) ?? []) {
    const [pair] = line.split(';');
    const index = pair.indexOf('=');
    out[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return out;
};

const header = (cookies: Cookies) =>
  Object.entries(cookies)
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

describeDb('Auth endpoints (HTTP, PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const emails: string[] = [];
  let counter = 0;

  const UA = 'jest-browser/1.0';

  const register = async () => {
    const email = `authhttp-${Date.now()}-${counter++}@example.test`;
    emails.push(email);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .set('User-Agent', UA)
      .send({ email, password: 'Passw0rd!x', name: 'Http Test' })
      .expect(201);
    return { email, cookies: setCookies(res), body: res.body };
  };

  const call = (
    method: 'get' | 'post',
    path: string,
    cookies: Cookies,
    ua = UA,
  ) =>
    request(app.getHttpServer())
      [method](path)
      .set('User-Agent', ua)
      .set('Cookie', header(cookies));

  beforeAll(async () => {
    const dbName = new URL(TEST_DB_URL!).pathname.slice(1);
    if (!/test/i.test(dbName))
      throw new Error(`Refusing to run against "${dbName}"`);
    process.env.DATABASE_URL = TEST_DB_URL;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => CONFIG],
        }),
        AuthModule,
      ],
      // Same global guard app.module.ts installs
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app?.close();
  });

  it('register sets both cookies and /auth/me works without leaking the password hash', async () => {
    const { cookies, body } = await register();
    expect(cookies.accessToken).toBeTruthy();
    expect(cookies.refreshToken).toBeTruthy();
    expect(body.user.passwordHash).toBeUndefined();

    const me = await call('get', '/auth/me', cookies).expect(200);
    expect(me.body.email).toBeDefined();
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('records where the login came from', async () => {
    const { cookies } = await register();
    const sid = (jwt.decode(cookies.accessToken) as any).sid;
    const row = await prisma.session.findUniqueOrThrow({ where: { id: sid } });
    expect(row.userAgent).toBe(UA);
  });

  it('refresh rotates both cookies and the new access token works', async () => {
    const { cookies } = await register();
    const res = await call('post', '/auth/refresh', cookies).expect(200);
    const fresh = setCookies(res);

    expect(fresh.refreshToken).toBeTruthy();
    expect(fresh.refreshToken).not.toBe(cookies.refreshToken);
    await call('get', '/auth/me', fresh).expect(200);
  });

  it('logout needs no access token, clears both cookies and kills the login', async () => {
    const { cookies } = await register();

    // Only the refresh cookie is sent: the access cookie has lapsed
    const res = await call('post', '/auth/logout', {
      refreshToken: cookies.refreshToken,
    }).expect(200);
    const cleared = setCookies(res);
    expect(cleared).toEqual({ accessToken: '', refreshToken: '' });

    // The old tokens are dead server-side, not just removed from the browser
    await call('get', '/auth/me', cookies).expect(401);
    await call('post', '/auth/refresh', cookies).expect(401);
  });

  it('logout with only an expired access token still ends the login', async () => {
    const { cookies } = await register();
    const claims = jwt.decode(cookies.accessToken) as any;
    const expired = await jwt.signAsync(
      { sub: claims.sub, email: claims.email, sid: claims.sid },
      { expiresIn: '-1h' },
    );

    await call('post', '/auth/logout', { accessToken: expired }).expect(200);
    await call('post', '/auth/refresh', cookies).expect(401);
  });

  it('logout with no cookies at all still succeeds', async () => {
    const res = await call('post', '/auth/logout', {}).expect(200);
    expect(setCookies(res)).toEqual({ accessToken: '', refreshToken: '' });
  });

  it('the access cookie issued before a logout stops working at once (15 min is not waited out)', async () => {
    const { cookies } = await register();
    await call('get', '/auth/me', cookies).expect(200);
    await call('post', '/auth/logout', cookies).expect(200);
    await call('get', '/auth/me', cookies).expect(401);
  });

  it('a stolen old refresh cookie replayed from another client kills the login and clears cookies', async () => {
    const { cookies } = await register();
    const rotated = setCookies(
      await call('post', '/auth/refresh', cookies).expect(200),
    );

    const replay = await call(
      'post',
      '/auth/refresh',
      cookies,
      'attacker/9.9',
    ).expect(401);
    expect(replay.body.code).toBe('REFRESH_REUSED');
    expect(setCookies(replay)).toEqual({ accessToken: '', refreshToken: '' });

    // the legitimate new cookies are now dead too
    await call('post', '/auth/refresh', rotated).expect(401);
    await call('get', '/auth/me', rotated).expect(401);
  });

  it('a tab race answers REFRESH_RACE and does NOT clear cookies', async () => {
    const { cookies } = await register();
    await call('post', '/auth/refresh', cookies).expect(200);

    const loser = await call('post', '/auth/refresh', cookies).expect(401);
    expect(loser.body.code).toBe('REFRESH_RACE');
    expect(loser.headers['set-cookie']).toBeUndefined();
  });

  it('a request with no refresh cookie is a plain 401', async () => {
    await call('post', '/auth/refresh', {}).expect(401);
  });

  it('a deleted user can no longer use an access token that is still unexpired', async () => {
    const { cookies } = await register();
    const userId = (jwt.decode(cookies.accessToken) as any).sub;
    await prisma.user.delete({ where: { id: userId } });
    await call('get', '/auth/me', cookies).expect(401);
  });

  it('protected routes still reject anonymous callers', async () => {
    await call('get', '/auth/me', {}).expect(401);
  });
});
