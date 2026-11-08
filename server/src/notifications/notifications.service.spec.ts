import { NotificationsService } from './notifications.service';

function setup(options: { optedOut?: string[] } = {}) {
  const rows: any[] = [];
  // One person's settings row, as the database would keep it
  const saved: Record<string, boolean> = { roomReminders: true, followedLive: true, newFollowers: true, corrections: true, friendRequests: true };
  const prisma: any = {
    notificationPreference: {
      findMany: jest.fn(async () => (options.optedOut ?? []).map((userId) => ({ userId }))),
      upsert: jest.fn(async ({ update }) => Object.assign(saved, update)),
    },
    notification: {
      create: jest.fn(async ({ data }) => {
        if (data.dedupeKey && rows.some((r) => r.userId === data.userId && r.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const row = { id: `n${rows.length + 1}`, isRead: false, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ take }) => rows.slice().reverse().slice(0, take)),
      count: jest.fn(async () => rows.filter((r) => !r.isRead).length),
      updateMany: jest.fn(async () => {
        rows.forEach((r) => (r.isRead = true));
        return { count: rows.length };
      }),
      deleteMany: jest.fn(async ({ where }) => {
        const keep = rows.filter((r) => !(where.userId.in.includes(r.userId) && r.dedupeKey === where.dedupeKey));
        const removed = rows.length - keep.length;
        rows.splice(0, rows.length, ...keep);
        return { count: removed };
      }),
    },
  };
  const service = new NotificationsService(prisma);
  const emitted: Array<[string, string, any]> = [];
  service.attachEmitter((userId, event, payload) => emitted.push([userId, event, payload]));
  return { service, prisma, rows, emitted };
}

const input = { type: 'ROOM_LIVE' as const, title: 'Sam is live now', message: 'Jump in', actionUrl: '/voice/r1', dedupeKey: 'live:r1' };

describe('NotificationsService push', () => {
  it('also pushes to phones and browsers, once per person who got the notification', async () => {
    const { prisma, rows } = setup();
    const push: any = { sendToUsers: jest.fn().mockResolvedValue(2) };
    const service = new NotificationsService(prisma, push);
    // u1 already has this exact notification, so only u2 is new
    rows.push({ userId: 'u1', dedupeKey: 'live:r1' });
    expect(await service.notify(['u1', 'u2'], input)).toBe(1);
    expect(push.sendToUsers).toHaveBeenCalledTimes(1);
    expect(push.sendToUsers).toHaveBeenCalledWith(['u2'], { title: 'Sam is live now', body: 'Jump in', url: '/voice/r1', tag: 'live:r1' });
  });

  it('does not push when nobody was notified, and a push problem never breaks a notification', async () => {
    const { prisma } = setup();
    const push: any = { sendToUsers: jest.fn().mockRejectedValue(new Error('push down')) };
    const service = new NotificationsService(prisma, push);
    expect(await service.notify([], input)).toBe(0);
    expect(push.sendToUsers).not.toHaveBeenCalled();
    expect(await service.notify(['u3'], input)).toBe(1);
  });
});

describe('NotificationsService', () => {
  it('saves one notification per person and pushes it to their open tabs', async () => {
    const { service, rows, emitted } = setup();
    expect(await service.notify(['u1', 'u2', 'u1', ''], input)).toBe(2);
    expect(rows.map((r) => r.userId)).toEqual(['u1', 'u2']);
    expect(emitted.map(([u, e]) => [u, e])).toEqual([
      ['u1', 'notification:new'],
      ['u2', 'notification:new'],
    ]);
    expect(emitted[0][2]).toMatchObject({ title: 'Sam is live now', actionUrl: '/voice/r1', isRead: false });
  });

  it('with replace, the same event notifies again as a fresh unread one, still only once in the list', async () => {
    const { service, rows, emitted } = setup();
    const follow = { ...input, type: 'NEW_FOLLOWER' as const, dedupeKey: 'follow:a', replace: true };
    expect(await service.notify(['u1'], follow)).toBe(1);
    rows[0].isRead = true;
    expect(await service.notify(['u1'], follow)).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].isRead).toBe(false);
    expect(emitted.filter(([, event]) => event === 'notification:new')).toHaveLength(2);
  });

  it('never sends the same event to someone twice', async () => {
    const { service, rows } = setup();
    await service.notify(['u1'], input);
    expect(await service.notify(['u1', 'u2'], input)).toBe(1);
    expect(rows).toHaveLength(2);
  });

  it('respects the setting a person switched off', async () => {
    const { service, rows, prisma } = setup({ optedOut: ['u2'] });
    await service.notify(['u1', 'u2'], { ...input, preference: 'followedLive' });
    expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['u1', 'u2'] }, followedLive: false },
      select: { userId: true },
    });
    expect(rows.map((r) => r.userId)).toEqual(['u1']);
  });

  it('never throws, whatever goes wrong', async () => {
    const { service, prisma } = setup();
    prisma.notification.create.mockRejectedValueOnce(new Error('database down'));
    await expect(service.notify(['u1'], input)).resolves.toBe(0);
  });

  it('lists with the unread count, and marks read everywhere', async () => {
    const { service, emitted } = setup();
    await service.notify(['u1'], input);
    const list = await service.list('u1');
    expect(list).toMatchObject({ unread: 1, hasMore: false });
    expect(list.items[0].title).toBe('Sam is live now');

    await expect(service.markRead('u1', {})).rejects.toThrow(/which/);
    expect(await service.markRead('u1', { all: true })).toEqual({ unread: 0 });
    expect(emitted.at(-1)).toEqual(['u1', 'notification:read', { ids: 'all', unread: 0 }]);
  });

  it('only changes known settings', async () => {
    const { service } = setup();
    await expect(service.updatePreferences('u1', { nonsense: true })).rejects.toThrow(/Nothing/);
    expect(await service.updatePreferences('u1', { corrections: false, nonsense: true })).toMatchObject({ corrections: false, roomReminders: true });
  });
});
