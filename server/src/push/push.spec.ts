import { BadRequestException } from '@nestjs/common';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));
// eslint-disable-next-line import/first
import * as webpush from 'web-push';
// eslint-disable-next-line import/first
import { MAX_DEVICES, PushService, isValidTimeZone } from './push.service';

const sendNotification = webpush.sendNotification as unknown as jest.Mock;
const setVapidDetails = webpush.setVapidDetails as unknown as jest.Mock;

const sub = (n: number) => ({ endpoint: `https://push.example.com/send/${n}`, keys: { p256dh: `p${n}`, auth: `a${n}` } });

function setup(options: { off?: string[]; subs?: any[] } = {}) {
  const rows = new Map<string, any>();
  for (const s of options.subs ?? []) rows.set(s.endpoint, s);
  const prisma: any = {
    pushSubscription: {
      count: jest.fn(async ({ where }: any) => [...rows.values()].filter((r) => r.userId === where.userId).length),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const row = rows.get(where.endpoint);
        rows.set(where.endpoint, row ? { ...row, ...update } : { id: `s${rows.size + 1}`, ...create });
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const ids: string[] | null = where?.userId?.in ?? null;
        return [...rows.values()]
          .filter((r) => (ids ? ids.includes(r.userId) : r.userId === where.userId))
          .sort((a, b) => (b.lastSeenAt?.getTime?.() ?? 0) - (a.lastSeenAt?.getTime?.() ?? 0));
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        let count = 0;
        for (const [endpoint, r] of rows) {
          const byId = where.id?.in?.includes(r.id);
          const byEndpoint = where.endpoint && where.userId === r.userId && where.endpoint === endpoint;
          if (byId || byEndpoint) {
            rows.delete(endpoint);
            count++;
          }
        }
        return { count };
      }),
    },
    settings: { findMany: jest.fn(async () => (options.off ?? []).map((userId) => ({ userId }))) },
    profile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  return { service: new PushService(prisma), prisma, rows };
}

const payload = { title: 'Sam is live', body: 'Jump in', url: '/voice/r1', tag: 'live:r1' };

describe('PushService', () => {
  const env = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    sendNotification.mockResolvedValue({ statusCode: 201 });
  });
  afterAll(() => {
    process.env = env;
  });

  it('is off without VAPID settings, and then does nothing', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const { service } = setup();
    expect(service.enabled).toBe(false);
    expect(service.publicKey()).toBeNull();
    expect(await service.sendToUser('u1', payload)).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('is off when the VAPID settings are not valid', () => {
    setVapidDetails.mockImplementationOnce(() => {
      throw new Error('bad key');
    });
    expect(setup().service.enabled).toBe(false);
  });

  it('shows the public key when on', () => {
    const { service } = setup();
    expect(service.enabled).toBe(true);
    expect(service.publicKey()).toBe('public-key');
    expect(setVapidDetails).toHaveBeenCalledWith('mailto:test@example.com', 'public-key', 'private-key');
  });

  it('saves a subscription once per browser, and reassigns it to whoever is signed in', async () => {
    const { service, rows } = setup();
    expect(await service.subscribe('u1', sub(1), { userAgent: 'UA' })).toEqual({ enabled: true, devices: 1 });
    await service.subscribe('u2', sub(1));
    expect(rows.size).toBe(1);
    expect(rows.get(sub(1).endpoint).userId).toBe('u2');
  });

  it('rejects subscriptions that are not https or are missing keys', async () => {
    const { service } = setup();
    await expect(service.subscribe('u1', { endpoint: 'http://push.example.com/x', keys: { p256dh: 'p', auth: 'a' } })).rejects.toThrow(BadRequestException);
    await expect(service.subscribe('u1', { endpoint: 'https://push.example.com/x', keys: { p256dh: 'p' } })).rejects.toThrow(BadRequestException);
    await expect(service.subscribe('u1', { endpoint: undefined })).rejects.toThrow(BadRequestException);
    await expect(service.subscribe('u1', { endpoint: 'https://push.example.com/' + 'x'.repeat(2100), keys: { p256dh: 'p', auth: 'a' } })).rejects.toThrow(BadRequestException);
  });

  it('keeps only the newest devices', async () => {
    const { service, rows } = setup();
    for (let n = 1; n <= MAX_DEVICES + 2; n++) {
      await service.subscribe('u1', sub(n));
      // later subscriptions are newer
      rows.get(sub(n).endpoint).lastSeenAt = new Date(2026, 0, n);
    }
    // one more subscribe triggers the trim
    await service.subscribe('u1', sub(99));
    expect([...rows.values()].filter((r) => r.userId === 'u1').length).toBeLessThanOrEqual(MAX_DEVICES);
  });

  it('remembers the time zone only when it is valid and none is saved', async () => {
    const { service, prisma } = setup();
    await service.subscribe('u1', sub(1), { timezone: 'Asia/Dhaka' });
    expect(prisma.profile.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', timezone: null }, data: { timezone: 'Asia/Dhaka' } });
    prisma.profile.updateMany.mockClear();
    await service.subscribe('u1', sub(1), { timezone: 'Not/AZone' });
    expect(prisma.profile.updateMany).not.toHaveBeenCalled();
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(5)).toBe(false);
  });

  it('removes a subscription', async () => {
    const { service, rows } = setup();
    await service.subscribe('u1', sub(1));
    expect(await service.unsubscribe('u1', sub(1).endpoint)).toEqual({ enabled: true, devices: 0 });
    expect(rows.size).toBe(0);
    await expect(service.unsubscribe('u1', undefined)).rejects.toThrow(BadRequestException);
  });

  it('sends to every device of the people asked, skipping anyone who switched push off', async () => {
    const mk = (userId: string, n: number) => ({ id: `s${n}`, userId, endpoint: sub(n).endpoint, p256dh: `p${n}`, auth: `a${n}` });
    const { service } = setup({ subs: [mk('u1', 1), mk('u1', 2), mk('u2', 3)], off: ['u2'] });
    expect(await service.sendToUsers(['u1', 'u2'], payload)).toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [target, body, options] = sendNotification.mock.calls[0];
    expect(target).toEqual({ endpoint: sub(1).endpoint, keys: { p256dh: 'p1', auth: 'a1' } });
    expect(JSON.parse(body)).toEqual({ title: 'Sam is live', body: 'Jump in', url: '/voice/r1', tag: 'live:r1' });
    expect(options).toEqual({ TTL: 86400 });
  });

  it('forgets subscriptions the browser says are gone, and survives other failures', async () => {
    const mk = (userId: string, n: number) => ({ id: `s${n}`, userId, endpoint: sub(n).endpoint, p256dh: `p${n}`, auth: `a${n}` });
    const { service, rows } = setup({ subs: [mk('u1', 1), mk('u1', 2), mk('u1', 3)] });
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('server error'), { statusCode: 500 }))
      .mockResolvedValueOnce({ statusCode: 201 });
    expect(await service.sendToUser('u1', payload)).toBe(1);
    expect(rows.has(sub(1).endpoint)).toBe(false);
    expect(rows.has(sub(2).endpoint)).toBe(true);
    expect(rows.has(sub(3).endpoint)).toBe(true);
  });

  it('never throws, even when the database does', async () => {
    const { service, prisma } = setup();
    prisma.pushSubscription.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.sendToUser('u1', payload)).resolves.toBe(0);
  });
});
