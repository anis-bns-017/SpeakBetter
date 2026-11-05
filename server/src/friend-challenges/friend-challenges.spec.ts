import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BEAT_XP, CHALLENGE_HOURS, FriendChallengesService, outcome } from './friend-challenges.service';

describe('outcome', () => {
  it('compares shares, so different totals compare fairly', () => {
    expect(outcome({ score: 5, total: 6 }, { score: 6, total: 6 })).toBe('BEATEN');
    expect(outcome({ score: 5, total: 6 }, { score: 4, total: 6 })).toBe('HELD');
    expect(outcome({ score: 4, total: 8 }, { score: 3, total: 6 })).toBe('TIED');
    expect(outcome({ score: 80, total: 100 }, { score: 81, total: 100 })).toBe('BEATEN');
  });
});

const now = new Date(Date.UTC(2026, 10, 5, 12, 0));

function setup(options: { friends?: boolean; grammar?: { bestScore: number; total: number } | null; dictation?: number | null } = {}) {
  const rows: any[] = [];
  const users: Record<string, any> = { amy: { id: 'amy', name: 'Amy', avatarUrl: null }, bob: { id: 'bob', name: 'Bob', avatarUrl: null } };
  const prisma: any = {
    friend: { findFirst: jest.fn().mockResolvedValue(options.friends === false ? null : { id: 'f1' }) },
    grammarProgress: { findUnique: jest.fn().mockResolvedValue(options.grammar === undefined ? { bestScore: 5, total: 6 } : options.grammar) },
    vocabPackProgress: { findUnique: jest.fn().mockResolvedValue({ bestScore: 6, total: 8 }) },
    dictationResult: { findFirst: jest.fn().mockResolvedValue(options.dictation === null ? null : { score: options.dictation ?? 82 }) },
    user: { findUnique: jest.fn(async ({ where }: any) => users[where.id] ?? null) },
    friendChallenge: {
      findFirst: jest.fn(async ({ where }: any) =>
        rows.find((r) => r.fromUserId === where.fromUserId && r.toUserId === where.toUserId && r.kind === where.kind && r.refId === where.refId && r.status === 'OPEN' && r.expiresAt > where.expiresAt.gt) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `c${rows.length + 1}`, status: 'OPEN', createdAt: now, responseScore: null, responseTotal: null, ...data };
        rows.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where, include }: any) =>
        rows
          .filter((r) =>
            where.toUserId !== undefined && where.kind
              ? r.toUserId === where.toUserId && r.kind === where.kind && r.refId === where.refId && r.status === 'OPEN' && r.expiresAt > where.expiresAt.gt
              : where.toUserId !== undefined
                ? r.toUserId === where.toUserId
                : r.fromUserId === where.fromUserId,
          )
          .map((r) => ({ ...r, ...(include?.fromUser ? { fromUser: users[r.fromUserId] } : {}), ...(include?.toUser ? { toUser: users[r.toUserId] } : {}) })),
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id && r.status === where.status);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
  };
  const notifications: any = { notify: jest.fn().mockResolvedValue(1) };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  return { service: new FriendChallengesService(prisma, notifications, activity), rows, notifications, activity, prisma };
}

describe('FriendChallengesService', () => {
  it('challenges a friend with your saved best, and tells them', async () => {
    const { service, rows, notifications } = setup();
    expect(await service.create('amy', { friendId: 'bob', kind: 'grammar', refId: 'a1-to-be' }, now)).toEqual({ id: 'c1', created: true });
    expect(rows[0]).toMatchObject({ fromUserId: 'amy', toUserId: 'bob', kind: 'grammar', refId: 'a1-to-be', title: 'Am, is, are', score: 5, total: 6 });
    expect(rows[0].expiresAt.getTime() - now.getTime()).toBe(CHALLENGE_HOURS * 3_600_000);
    expect(notifications.notify).toHaveBeenCalledWith(
      ['bob'],
      expect.objectContaining({ type: 'FRIEND_CHALLENGE', title: 'Amy challenged you', message: 'Beat 5/6 on Am, is, are. You have 3 days.', actionUrl: '/grammar/a1-to-be', preference: 'challenges' }),
    );
  });

  it('does not send the same open challenge twice', async () => {
    const { service, rows } = setup();
    await service.create('amy', { friendId: 'bob', kind: 'pack', refId: 'a1-food-drink' }, now);
    expect(await service.create('amy', { friendId: 'bob', kind: 'pack', refId: 'a1-food-drink' }, now)).toEqual({ id: 'c1', created: false });
    expect(rows).toHaveLength(1);
  });

  it('only lets you challenge friends, on real activities you have done', async () => {
    await expect(setup({ friends: false }).service.create('amy', { friendId: 'bob', kind: 'grammar', refId: 'a1-to-be' }, now)).rejects.toThrow(ForbiddenException);
    await expect(setup().service.create('amy', { friendId: 'bob', kind: 'grammar', refId: 'nope' }, now)).rejects.toThrow(NotFoundException);
    await expect(setup().service.create('amy', { friendId: 'bob', kind: 'karaoke', refId: 'x' }, now)).rejects.toThrow(BadRequestException);
    await expect(setup().service.create('amy', { friendId: 'amy', kind: 'grammar', refId: 'a1-to-be' }, now)).rejects.toThrow(BadRequestException);
    await expect(setup({ grammar: null }).service.create('amy', { friendId: 'bob', kind: 'grammar', refId: 'a1-to-be' }, now)).rejects.toThrow(BadRequestException);
  });

  it('uses your latest dictation score as a percentage', async () => {
    const { service, rows, notifications } = setup({ dictation: 82 });
    await service.create('amy', { friendId: 'bob', kind: 'dictation', refId: 'dictation' }, now);
    expect(rows[0]).toMatchObject({ score: 82, total: 100, title: 'Listening dictation' });
    expect(notifications.notify.mock.calls[0][1].message).toBe('Beat 82% on Listening dictation. You have 3 days.');
  });

  it('settles the challenge when the friend finishes, tells the challenger, and pays XP for a win', async () => {
    const { service, rows, notifications, activity } = setup();
    await service.create('amy', { friendId: 'bob', kind: 'grammar', refId: 'a1-to-be' }, now);
    notifications.notify.mockClear();
    const later = new Date(now.getTime() + 3_600_000);
    const results = await service.resolve('bob', 'grammar', 'a1-to-be', 6, 6, later);
    expect(results).toEqual([{ id: 'c1', from: 'Amy', status: 'BEATEN', theirs: '5/6', yours: '6/6' }]);
    expect(rows[0]).toMatchObject({ status: 'BEATEN', responseScore: 6, responseTotal: 6 });
    expect(notifications.notify).toHaveBeenCalledWith(['amy'], expect.objectContaining({ title: 'Bob beat your score', message: 'Am, is, are: Bob got 6/6, you had 5/6. Time for a rematch?' }));
    expect(activity.recordActivity).toHaveBeenCalledWith('bob', BEAT_XP, 'BONUS');
    // Settled once: finishing again changes nothing
    expect(await service.resolve('bob', 'grammar', 'a1-to-be', 2, 6, later)).toEqual([]);
  });

  it('tells the challenger they kept the lead, without XP for the loser', async () => {
    const { service, notifications, activity } = setup();
    await service.create('amy', { friendId: 'bob', kind: 'grammar', refId: 'a1-to-be' }, now);
    const results = await service.resolve('bob', 'grammar', 'a1-to-be', 3, 6, now);
    expect(results[0].status).toBe('HELD');
    expect(notifications.notify).toHaveBeenLastCalledWith(['amy'], expect.objectContaining({ title: 'You kept your lead over Bob' }));
    expect(activity.recordActivity).not.toHaveBeenCalled();
  });

  it('ignores expired challenges and other activities', async () => {
    const { service } = setup();
    await service.create('amy', { friendId: 'bob', kind: 'grammar', refId: 'a1-to-be' }, now);
    const tooLate = new Date(now.getTime() + (CHALLENGE_HOURS + 1) * 3_600_000);
    expect(await service.resolve('bob', 'grammar', 'a1-to-be', 6, 6, tooLate)).toEqual([]);
    expect(await service.resolve('bob', 'grammar', 'a1-articles', 6, 6, now)).toEqual([]);
    const list = await service.list('bob', tooLate);
    expect(list.incoming[0]).toMatchObject({ status: 'EXPIRED', person: { name: 'Amy' }, url: '/grammar/a1-to-be' });
  });

  it('lists what you received and sent, open ones first', async () => {
    const { service } = setup();
    await service.create('amy', { friendId: 'bob', kind: 'grammar', refId: 'a1-to-be' }, now);
    await service.create('amy', { friendId: 'bob', kind: 'pack', refId: 'a1-food-drink' }, now);
    await service.resolve('bob', 'grammar', 'a1-to-be', 6, 6, now);
    const bob = await service.list('bob', now);
    expect(bob.incoming.map((c) => c.status)).toEqual(['OPEN', 'BEATEN']);
    const amy = await service.list('amy', now);
    expect(amy.outgoing).toHaveLength(2);
    expect(amy.outgoing[0].person.name).toBe('Bob');
  });

  it('never throws when settling', async () => {
    const { service, prisma } = setup();
    prisma.friendChallenge.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.resolve('bob', 'grammar', 'a1-to-be', 6, 6, now)).resolves.toEqual([]);
  });
});
