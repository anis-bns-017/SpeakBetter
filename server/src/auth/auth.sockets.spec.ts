import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';
import { VoiceGateway } from '../voice/voice.gateway';
import { ChatGateway } from '../chat/chat.gateway';

/**
 * Socket authentication goes through the same session checks as HTTP, and a
 * logout closes the sockets of that login. Gateways are driven with fake
 * sockets; the database is real. Same opt-in as auth.service.spec.ts.
 */
const TEST_DB_URL = process.env.AUTH_TEST_DATABASE_URL;
const describeDb = TEST_DB_URL ? describe : describe.skip;

const CONFIG: Record<string, string> = {
  JWT_SECRET: 'test-access-secret',
  JWT_EXPIRES_IN: '15m',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret',
  REFRESH_EXPIRES_IN: '30d',
};

interface FakeSocket {
  id: string;
  data: Record<string, any>;
  handshake: { headers: { cookie?: string }; auth?: any; query?: any };
  disconnect: jest.Mock;
  emit: jest.Mock;
  join: jest.Mock;
  to: jest.Mock;
}

const fakeSocket = (id: string, accessToken?: string): FakeSocket => ({
  id,
  data: {},
  handshake: {
    headers: { cookie: accessToken ? `accessToken=${accessToken}` : undefined },
  },
  disconnect: jest.fn(),
  emit: jest.fn(),
  join: jest.fn(),
  to: jest.fn().mockReturnValue({ emit: jest.fn() }),
});

describeDb('Socket authentication (PostgreSQL)', () => {
  let prisma: PrismaService;
  let jwt: JwtService;
  let auth: AuthService;
  let voice: VoiceGateway;
  let chat: ChatGateway;
  let sockets: FakeSocket[] = [];
  const emails: string[] = [];
  let counter = 0;

  const login = async (existing?: { id: string; email: string }) => {
    let user = existing;
    if (!user) {
      const email = `authsock-${Date.now()}-${counter++}@example.test`;
      emails.push(email);
      user = await prisma.user.create({
        data: { email, name: 'Sock Test', passwordHash: 'x' },
      });
    }
    const tokens = await (auth as any).startSession(user, { userAgent: 'ua' });
    return { user, ...tokens } as {
      user: { id: string; email: string };
      accessToken: string;
      refreshToken: string;
    };
  };

  beforeAll(async () => {
    const dbName = new URL(TEST_DB_URL!).pathname.slice(1);
    if (!/test/i.test(dbName))
      throw new Error(`Refusing to run against "${dbName}"`);
    process.env.DATABASE_URL = TEST_DB_URL;

    prisma = new PrismaService();
    await prisma.$connect();
    jwt = new JwtService({
      secret: CONFIG.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    });
    const config = {
      get: (key: string) => CONFIG[key],
      getOrThrow: (key: string) => CONFIG[key],
    } as unknown as ConfigService;
    auth = new AuthService(prisma, jwt, config);

    voice = new VoiceGateway(auth, {} as any, prisma, {
      onMissionEnd: jest.fn(),
    } as any);
    chat = new ChatGateway(
      auth,
      {} as any,
      prisma,
      {
        get: async () => ({ showOnlineStatus: false }),
        getMany: async () => new Map(),
      } as any,
      {
        markDeliveredFor: async () => ({ chatIds: [], at: new Date() }),
      } as any,
    );
    // Gateways are wired to a fake namespace that serves the fake sockets
    const server = {
      fetchSockets: async () => sockets,
      to: () => ({ emit: jest.fn() }),
      in: () => ({ fetchSockets: async () => [] }),
    };
    (voice as any).server = server;
    (chat as any).server = server;
    voice.onModuleInit();
    chat.onModuleInit();
  });

  afterAll(async () => {
    voice?.onModuleDestroy();
    chat?.onModuleDestroy();
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.onModuleDestroy();
    }
  });

  beforeEach(() => {
    sockets = [];
  });

  describe('authenticateAccessToken', () => {
    it('accepts a live session and reports its family', async () => {
      const { accessToken, user } = await login();
      const result = await auth.authenticateAccessToken(accessToken);
      expect(result?.user.id).toBe(user.id);
      expect(result?.familyId).toBeTruthy();
    });

    it('rejects garbage, a wrong secret, an expired token and a revoked session', async () => {
      const { accessToken, refreshToken, user } = await login();
      expect(await auth.authenticateAccessToken('nope')).toBeNull();
      expect(
        await auth.authenticateAccessToken(
          await new JwtService({ secret: 'other' }).signAsync({ sub: user.id }),
        ),
      ).toBeNull();
      expect(
        await auth.authenticateAccessToken(
          await jwt.signAsync({ sub: user.id }, { expiresIn: '-1h' }),
        ),
      ).toBeNull();

      await auth.logoutByRefreshToken(refreshToken);
      expect(await auth.authenticateAccessToken(accessToken)).toBeNull();
    });

    it('rejects a token whose user no longer exists', async () => {
      const { accessToken, user } = await login();
      await prisma.user.delete({ where: { id: user.id } });
      expect(await auth.authenticateAccessToken(accessToken)).toBeNull();
    });
  });

  describe('voice gateway', () => {
    it('lets a live session in and remembers its family', async () => {
      const { accessToken, user } = await login();
      const socket = fakeSocket('v1', accessToken);
      await voice.handleConnection(socket as any);

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.data.userId).toBe(user.id);
      expect(socket.data.familyId).toBeTruthy();
    });

    it('turns away missing, revoked and deleted-user tokens', async () => {
      const none = fakeSocket('v2');
      await voice.handleConnection(none as any);
      expect(none.disconnect).toHaveBeenCalled();

      const revoked = await login();
      await auth.logoutByRefreshToken(revoked.refreshToken);
      const revokedSocket = fakeSocket('v3', revoked.accessToken);
      await voice.handleConnection(revokedSocket as any);
      expect(revokedSocket.disconnect).toHaveBeenCalled();
      expect(revokedSocket.data.userId).toBeUndefined();

      const gone = await login();
      await prisma.user.delete({ where: { id: gone.user.id } });
      const goneSocket = fakeSocket('v4', gone.accessToken);
      await voice.handleConnection(goneSocket as any);
      expect(goneSocket.disconnect).toHaveBeenCalled();
    });

    it("logout closes that login's sockets and leaves the same user's other login alone", async () => {
      const first = await login();
      const second = await login(first.user);

      const a = fakeSocket('va', first.accessToken);
      const b = fakeSocket('vb', second.accessToken);
      await voice.handleConnection(a as any);
      await voice.handleConnection(b as any);
      sockets = [a, b];

      await auth.logoutByRefreshToken(first.refreshToken);
      await new Promise((r) => setTimeout(r, 50));

      expect(a.disconnect).toHaveBeenCalledWith(true);
      expect(b.disconnect).not.toHaveBeenCalled();
    });

    it("logoutAll closes every socket of the user and nobody else's", async () => {
      const first = await login();
      const second = await login(first.user);
      const stranger = await login();

      const sockets3 = [
        fakeSocket('vc', first.accessToken),
        fakeSocket('vd', second.accessToken),
        fakeSocket('ve', stranger.accessToken),
      ];
      for (const s of sockets3) await voice.handleConnection(s as any);
      sockets = sockets3;

      await auth.logoutAll(first.user.id);
      await new Promise((r) => setTimeout(r, 50));

      expect(sockets3[0].disconnect).toHaveBeenCalledWith(true);
      expect(sockets3[1].disconnect).toHaveBeenCalledWith(true);
      expect(sockets3[2].disconnect).not.toHaveBeenCalled();
    });

    it('reuse detection also closes the sockets', async () => {
      const first = await login();
      const socket = fakeSocket('vf', first.accessToken);
      await voice.handleConnection(socket as any);
      sockets = [socket];

      await auth.refreshToken(first.refreshToken, { userAgent: 'ua' });
      await expect(
        auth.refreshToken(first.refreshToken, { userAgent: 'attacker' }),
      ).rejects.toMatchObject({ response: { code: 'REFRESH_REUSED' } });
      await new Promise((r) => setTimeout(r, 50));

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('a token refresh does NOT close a connected socket', async () => {
      const first = await login();
      const socket = fakeSocket('vg', first.accessToken);
      await voice.handleConnection(socket as any);
      sockets = [socket];

      await auth.refreshToken(first.refreshToken, { userAgent: 'ua' });
      await new Promise((r) => setTimeout(r, 50));
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('chat gateway', () => {
    it('lets a live session in', async () => {
      const { accessToken, user } = await login();
      const socket = fakeSocket('c1', accessToken);
      await chat.handleConnection(socket as any);

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.data.userId).toBe(user.id);
      expect(socket.data.familyId).toBeTruthy();
    });

    it('turns away revoked sessions and unknown users', async () => {
      const revoked = await login();
      await auth.logoutByRefreshToken(revoked.refreshToken);
      const socket = fakeSocket('c2', revoked.accessToken);
      await chat.handleConnection(socket as any);
      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.data.userId).toBeUndefined();
    });

    it('logout closes the chat sockets of that login', async () => {
      const first = await login();
      const socket = fakeSocket('c3', first.accessToken);
      await chat.handleConnection(socket as any);
      sockets = [socket];

      await auth.logout(first.user.id, first.refreshToken);
      await new Promise((r) => setTimeout(r, 50));
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });
  });
});
