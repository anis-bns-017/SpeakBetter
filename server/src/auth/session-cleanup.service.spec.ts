import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';
import { SessionCleanupService } from './session-cleanup.service';

const config = (values: Record<string, string> = {}) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('SessionCleanupService (timer)', () => {
  const realEnv = process.env.NODE_ENV;
  let prune: jest.Mock;
  let service: SessionCleanupService;

  const make = (values: Record<string, string> = {}) => {
    prune = jest.fn().mockResolvedValue({ skipped: false, deleted: 0 });
    service = new SessionCleanupService(
      { pruneSessions: prune } as unknown as AuthService,
      config(values),
    );
    return service;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // zero jitter
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    service?.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env.NODE_ENV = realEnv;
  });

  it('does nothing under test or when disabled', async () => {
    process.env.NODE_ENV = 'test';
    make().onModuleInit();
    await jest.advanceTimersByTimeAsync(3 * 60 * 60_000);
    expect(prune).not.toHaveBeenCalled();

    process.env.NODE_ENV = 'production';
    make({ AUTH_SESSION_PRUNE_ENABLED: 'false' }).onModuleInit();
    await jest.advanceTimersByTimeAsync(3 * 60 * 60_000);
    expect(prune).not.toHaveBeenCalled();
  });

  it('first run comes a minute after start, then once per interval (default 60 min)', async () => {
    make().onModuleInit();

    await jest.advanceTimersByTimeAsync(59_000);
    expect(prune).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2_000);
    expect(prune).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(59 * 60_000);
    expect(prune).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2 * 60_000);
    expect(prune).toHaveBeenCalledTimes(2);
  });

  it('honours the configured interval and ignores nonsense values', async () => {
    make({ AUTH_SESSION_PRUNE_INTERVAL_MINUTES: '5' }).onModuleInit();
    await jest.advanceTimersByTimeAsync(61_000); // first run
    await jest.advanceTimersByTimeAsync(5 * 60_000 + 1_000);
    expect(prune).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();

    make({ AUTH_SESSION_PRUNE_INTERVAL_MINUTES: 'abc' }).onModuleInit();
    await jest.advanceTimersByTimeAsync(61_000);
    await jest.advanceTimersByTimeAsync(30 * 60_000);
    expect(prune).toHaveBeenCalledTimes(1); // fell back to 60 min
  });

  it('never overlaps with its own previous run', async () => {
    make();
    let release!: () => void;
    prune.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ skipped: false, deleted: 1 });
        }),
    );

    const first = service.runOnce();
    expect(await service.runOnce()).toBeNull(); // refused while the first is running
    expect(prune).toHaveBeenCalledTimes(1);

    release();
    await first;
    await service.runOnce();
    expect(prune).toHaveBeenCalledTimes(2);
  });

  it('a failing prune is swallowed and the schedule keeps going', async () => {
    make().onModuleInit();
    prune.mockRejectedValueOnce(new Error('db down'));

    await jest.advanceTimersByTimeAsync(61_000);
    expect(prune).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(61 * 60_000);
    expect(prune).toHaveBeenCalledTimes(2);
  });

  it('stops for good on shutdown, even mid-run', async () => {
    make().onModuleInit();
    let release!: () => void;
    prune.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ skipped: false, deleted: 0 });
        }),
    );

    await jest.advanceTimersByTimeAsync(61_000);
    service.onModuleDestroy();
    release();
    await jest.advanceTimersByTimeAsync(3 * 60 * 60_000);
    expect(prune).toHaveBeenCalledTimes(1);
  });
});

// Real database: two "instances" prune at the same moment
const TEST_DB_URL = process.env.AUTH_TEST_DATABASE_URL;
(TEST_DB_URL ? describe : describe.skip)(
  'SessionCleanupService (two instances, PostgreSQL)',
  () => {
    let prisma: PrismaService;
    const emails: string[] = [];

    beforeAll(async () => {
      const dbName = new URL(TEST_DB_URL!).pathname.slice(1);
      if (!/test/i.test(dbName))
        throw new Error(`Refusing to run against "${dbName}"`);
      process.env.DATABASE_URL = TEST_DB_URL;
      prisma = new PrismaService();
      await prisma.$connect();
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.onModuleDestroy();
    });

    it('removes expired sessions exactly once and leaves live ones, whichever instance gets the lock', async () => {
      const email = `cleanup-${Date.now()}@example.test`;
      emails.push(email);
      const user = await prisma.user.create({
        data: { email, name: 'Cleanup', passwordHash: 'x' },
      });
      await prisma.session.createMany({
        data: [
          ...Array.from({ length: 25 }, (_, i) => ({
            userId: user.id,
            tokenHash: `old-${user.id}-${i}`,
            expiresAt: new Date(Date.now() - 60_000),
          })),
          {
            userId: user.id,
            tokenHash: `live-${user.id}`,
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        ],
      });

      const mk = () =>
        new SessionCleanupService(
          new AuthService(prisma, new JwtService({ secret: 's' }), config({})),
          config({}),
        );
      const results = await Promise.all([
        mk().runOnce(),
        mk().runOnce(),
        mk().runOnce(),
      ]);

      expect(results.every((r) => r !== null)).toBe(true);
      const deleted = results.reduce((sum, r) => sum + (r?.deleted ?? 0), 0);
      expect(deleted).toBeGreaterThanOrEqual(25);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(
        1,
      );
    });
  },
);
