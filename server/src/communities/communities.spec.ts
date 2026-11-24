import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommunitiesService, banIsActive, canManage, isAssignableRole, rankOf } from './communities.service';

describe('community rules', () => {
  it('orders roles and only lets admins manage people below them', () => {
    expect(rankOf('OWNER')).toBeGreaterThan(rankOf('ADMIN'));
    expect(rankOf('ADMIN')).toBeGreaterThan(rankOf('MODERATOR'));
    expect(rankOf(null)).toBeLessThan(rankOf('MEMBER'));
    expect(canManage('OWNER', 'ADMIN')).toBe(true);
    expect(canManage('ADMIN', 'MODERATOR')).toBe(true);
    expect(canManage('ADMIN', 'ADMIN')).toBe(false);
    expect(canManage('ADMIN', 'OWNER')).toBe(false);
    expect(canManage('MODERATOR', 'MEMBER')).toBe(false);
  });

  it('never hands out ownership', () => {
    expect(isAssignableRole('ADMIN')).toBe(true);
    expect(isAssignableRole('OWNER')).toBe(false);
    expect(isAssignableRole('nonsense')).toBe(false);
  });

  it('ends a ban when its time is up', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(banIsActive({ expiresAt: null }, now)).toBe(true);
    expect(banIsActive({ expiresAt: new Date('2026-11-06T12:00:00Z') }, now)).toBe(true);
    expect(banIsActive({ expiresAt: new Date('2026-11-04T12:00:00Z') }, now)).toBe(false);
  });
});

type Role = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

function setup(options: { type?: string; roles?: Record<string, Role>; channelType?: string; locked?: boolean; bans?: any[]; hidden?: boolean } = {}) {
  const roles: Record<string, Role> = options.roles ?? { own: 'OWNER', adm: 'ADMIN', mod: 'MODERATOR', mem: 'MEMBER', mem2: 'MEMBER' };
  const memberRows = () => Object.entries(roles).map(([userId, role]) => ({ id: `m-${userId}`, communityId: 'c1', userId, role, user: { id: userId, name: userId, avatarUrl: null } }));
  const community = { id: 'c1', name: 'Club', ownerId: 'own', type: options.type ?? 'PUBLIC', hiddenAt: options.hidden ? new Date() : null };
  const channel = { id: 'ch1', communityId: 'c1', name: 'general', type: options.channelType ?? 'TEXT', community: { id: 'c1', name: 'Club', hiddenAt: community.hiddenAt } };
  const thread = { id: 't1', title: 'Hello', authorId: 'mem', isLocked: !!options.locked, channelId: 'ch1' };
  const bans = options.bans ?? [];
  const invites = new Map<string, any>();
  const prisma: any = {
    community: {
      findUnique: jest.fn(async ({ include }: any) => {
        if (include?.members?.where) return { ...community, members: memberRows().filter((m) => m.userId === include.members.where.userId) };
        if (include?.members) {
          return {
            ...community,
            owner: { id: 'own', name: 'own', avatarUrl: null },
            members: memberRows(),
            channels: [{ ...channel, threads: [{ id: 't1' }] }],
            roles: [],
            bans,
          };
        }
        return community;
      }),
      update: jest.fn(async () => community),
    },
    communityMember: {
      findUnique: jest.fn(async ({ where }: any) => memberRows().find((m) => m.userId === where.communityId_userId.userId) ?? null),
      create: jest.fn(async ({ data }: any) => {
        roles[data.userId] = data.role;
        return { ...data, user: { id: data.userId } };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        roles[where.communityId_userId.userId] = data.role;
        return { ...data };
      }),
      delete: jest.fn(async ({ where }: any) => delete roles[where.communityId_userId.userId]),
      deleteMany: jest.fn(async ({ where }: any) => {
        const had = where.userId in roles;
        delete roles[where.userId];
        return { count: had ? 1 : 0 };
      }),
    },
    channel: { findUnique: jest.fn(async () => channel), count: jest.fn(async () => 3), create: jest.fn(async ({ data }: any) => data) },
    thread: {
      findUnique: jest.fn(async () => thread),
      create: jest.fn(async ({ data }: any) => ({ id: 't2', ...data })),
      update: jest.fn(async ({ data }: any) => ({ ...thread, ...data })),
      delete: jest.fn(async () => thread),
    },
    threadMessage: {
      create: jest.fn(async ({ data }: any) => ({ id: 'r1', ...data, author: { id: data.authorId, name: data.authorId, avatarUrl: null } })),
      findUnique: jest.fn(async () => ({ id: 'r1', authorId: 'mem', threadId: 't1' })),
      delete: jest.fn(async () => ({})),
    },
    communityRole: { findFirst: jest.fn(async ({ where }: any) => (where.communityId === 'c1' && where.id === 'mine' ? { id: 'mine' } : null)), update: jest.fn(async () => ({})), delete: jest.fn(async () => ({})) },
    communityBan: {
      findUnique: jest.fn(async ({ where }: any) => bans.find((b) => b.userId === where.communityId_userId.userId) ?? null),
      upsert: jest.fn(async ({ create }: any) => create),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    communityInvite: {
      findUnique: jest.fn(async ({ where }: any) => invites.get(where.code) ?? null),
      create: jest.fn(async ({ data }: any) => data),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = [...invites.values()].find((i) => i.id === where.id);
        if (!row || (where.uses?.lt !== undefined && row.uses >= where.uses.lt)) return { count: 0 };
        row.uses += data.uses.increment;
        return { count: 1 };
      }),
    },
    friend: { findFirst: jest.fn(async () => null) },
    report: { findFirst: jest.fn(async () => null), create: jest.fn(async ({ data }: any) => data) },
    user: { findUnique: jest.fn(async ({ where }: any) => ({ id: where.id })) },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  };
  const notifications: any = { notify: jest.fn().mockResolvedValue(1) };
  const addInvite = (code: string, extra: Record<string, unknown> = {}) =>
    invites.set(code, { id: `i-${code}`, code, uses: 0, maxUses: 0, expiresAt: null, community: { id: 'c1', hiddenAt: null }, ...extra });
  return { service: new CommunitiesService(prisma, notifications), prisma, roles, notifications, addInvite };
}

describe('what people can see', () => {
  it('shows the ban list to admins only', async () => {
    const bans = [{ userId: 'x', expiresAt: null, user: { id: 'x' } }];
    expect((await setup({ bans }).service.getCommunityById('c1', 'adm')).bans).toHaveLength(1);
    expect((await setup({ bans }).service.getCommunityById('c1', 'mem')).bans).toHaveLength(0);
    expect((await setup({ bans }).service.getCommunityById('c1', 'visitor')).bans).toHaveLength(0);
  });

  it('keeps posts from visitors of a public community', async () => {
    const view = await setup().service.getCommunityById('c1', 'visitor');
    expect(view.viewer).toMatchObject({ isMember: false, role: null });
    expect(view.channels[0].threads).toEqual([]);
  });

  it('shows only the name of a restricted community, and nothing of a private one', async () => {
    const restricted = await setup({ type: 'RESTRICTED' }).service.getCommunityById('c1', 'visitor');
    expect(restricted).toMatchObject({ name: 'Club', members: [], channels: [], _count: { members: 5 } });
    await expect(setup({ type: 'PRIVATE' }).service.getCommunityById('c1', 'visitor')).rejects.toThrow(ForbiddenException);
  });
});

describe('joining', () => {
  it('lets anyone join a public community, and nobody join the others without an invite', async () => {
    await expect(setup().service.joinCommunity('new', 'c1')).resolves.toBeDefined();
    await expect(setup({ type: 'RESTRICTED' }).service.joinCommunity('new', 'c1')).rejects.toThrow(ForbiddenException);
    await expect(setup({ type: 'PRIVATE' }).service.joinCommunity('new', 'c1')).rejects.toThrow(ForbiddenException);
  });

  it('keeps banned people out until the ban ends', async () => {
    const active = [{ userId: 'new', expiresAt: new Date(Date.now() + 60_000) }];
    await expect(setup({ bans: active }).service.joinCommunity('new', 'c1')).rejects.toThrow(/banned/);
    const over = [{ userId: 'new', expiresAt: new Date(Date.now() - 60_000) }];
    await expect(setup({ bans: over }).service.joinCommunity('new', 'c1')).resolves.toBeDefined();
  });

  it('counts invite uses and refuses a full invite', async () => {
    const { service, addInvite } = setup({ type: 'PRIVATE' });
    addInvite('one', { maxUses: 1 });
    await service.joinByInvite('new', 'one');
    await expect(service.joinByInvite('other', 'one')).rejects.toThrow(/maximum uses/);
  });

  it('takes a member who reopens an invite straight in, without using it up', async () => {
    const { service, addInvite, prisma } = setup({ type: 'PRIVATE' });
    addInvite('code', { maxUses: 1 });
    await expect(service.joinByInvite('mem', 'code')).resolves.toMatchObject({ id: 'c1' });
    expect(prisma.communityInvite.updateMany).not.toHaveBeenCalled();
  });

  it('refuses expired invites', async () => {
    const { service, addInvite } = setup();
    addInvite('old', { expiresAt: new Date(Date.now() - 1000) });
    await expect(service.joinByInvite('new', 'old')).rejects.toThrow(/expired/);
  });

  it('says so when someone who is not a member tries to leave', async () => {
    await expect(setup().service.leaveCommunity('stranger', 'c1')).rejects.toThrow(NotFoundException);
    await expect(setup().service.leaveCommunity('own', 'c1')).rejects.toThrow(BadRequestException);
  });
});

describe('roles and moderation', () => {
  it('lets only the owner change roles, and never to owner', async () => {
    await expect(setup().service.updateMemberRole('adm', 'c1', 'mem', { role: 'ADMIN' })).rejects.toThrow(ForbiddenException);
    await expect(setup().service.updateMemberRole('own', 'c1', 'mem', { role: 'OWNER' as 'ADMIN' })).rejects.toThrow(BadRequestException);
    await expect(setup().service.updateMemberRole('own', 'c1', 'own', { role: 'MEMBER' })).rejects.toThrow(ForbiddenException);
    await expect(setup().service.updateMemberRole('own', 'c1', 'ghost', { role: 'ADMIN' })).rejects.toThrow(NotFoundException);
    const { service, roles } = setup();
    await service.updateMemberRole('own', 'c1', 'mem', { role: 'MODERATOR' });
    expect(roles.mem).toBe('MODERATOR');
  });

  it('stops admins removing or banning their equals and the owner', async () => {
    const twoAdmins: Record<string, Role> = { own: 'OWNER', adm: 'ADMIN', adm2: 'ADMIN', mem: 'MEMBER' };
    await expect(setup({ roles: { ...twoAdmins } }).service.removeMember('adm', 'c1', 'adm2')).rejects.toThrow(ForbiddenException);
    await expect(setup({ roles: { ...twoAdmins } }).service.banMember('adm', 'c1', { userId: 'adm2' })).rejects.toThrow(ForbiddenException);
    await expect(setup().service.banMember('adm', 'c1', { userId: 'own' })).rejects.toThrow(ForbiddenException);
    await expect(setup().service.removeMember('mem', 'c1', 'mem2')).rejects.toThrow(ForbiddenException);
    await expect(setup().service.removeMember('adm', 'c1', 'mem')).resolves.toBeDefined();
  });

  it('refuses a second ban and a ban that ends in the past', async () => {
    await expect(setup({ bans: [{ userId: 'mem', expiresAt: null }] }).service.banMember('adm', 'c1', { userId: 'mem' })).rejects.toThrow(ConflictException);
    await expect(setup().service.banMember('adm', 'c1', { userId: 'mem', expiresAt: '2020-01-01T00:00:00Z' })).rejects.toThrow(BadRequestException);
  });

  it('can only touch roles of its own community', async () => {
    await expect(setup().service.deleteRole('own', 'c1', 'someone-elses')).rejects.toThrow(NotFoundException);
    await expect(setup().service.updateRole('own', 'c1', 'someone-elses', { name: 'x' })).rejects.toThrow(NotFoundException);
    await expect(setup().service.deleteRole('own', 'c1', 'mine')).resolves.toBeDefined();
  });

  it('only adds friends to a community', async () => {
    const { service, prisma } = setup();
    await expect(service.addMember('adm', 'c1', { userId: 'stranger' })).rejects.toThrow(ForbiddenException);
    prisma.friend.findFirst.mockResolvedValueOnce({ id: 'f1' });
    await expect(service.addMember('adm', 'c1', { userId: 'friend', role: 'ADMIN' })).resolves.toMatchObject({ role: 'MEMBER' });
  });
});

describe('posts and replies', () => {
  it('lets members post in text channels, and only the team in announcements', async () => {
    await expect(setup().service.createThread('mem', 'ch1', { title: 'Hi' })).resolves.toMatchObject({ title: 'Hi' });
    await expect(setup({ channelType: 'ANNOUNCEMENT' }).service.createThread('mem', 'ch1', { title: 'Hi' })).rejects.toThrow(ForbiddenException);
    await expect(setup({ channelType: 'ANNOUNCEMENT' }).service.createThread('mod', 'ch1', { title: 'News' })).resolves.toBeDefined();
    await expect(setup({ channelType: 'VOICE' }).service.createThread('own', 'ch1', { title: 'Hi' })).rejects.toThrow(BadRequestException);
    await expect(setup().service.createThread('visitor', 'ch1', { title: 'Hi' })).rejects.toThrow(ForbiddenException);
    await expect(setup().service.createThread('mem', 'ch1', { title: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('tells the author about a reply, but not about their own', async () => {
    const other = setup();
    await other.service.replyToThread('mem2', 't1', { content: 'Nice' });
    expect(other.notifications.notify).toHaveBeenCalledWith(
      ['mem'],
      expect.objectContaining({ title: 'mem2 replied to your post', actionUrl: '/communities/c1?channel=ch1&thread=t1', replace: true }),
    );
    const own = setup();
    await own.service.replyToThread('mem', 't1', { content: 'Me again' });
    expect(own.notifications.notify).not.toHaveBeenCalled();
  });

  it('keeps members out of a locked post, but not moderators', async () => {
    await expect(setup({ locked: true }).service.replyToThread('mem', 't1', { content: 'Hey' })).rejects.toThrow(/locked/);
    await expect(setup({ locked: true }).service.replyToThread('mod', 't1', { content: 'Closing this' })).resolves.toBeDefined();
  });

  it('lets moderators pin and lock, and authors or moderators delete', async () => {
    await expect(setup().service.updateThread('mem', 't1', { isPinned: true })).rejects.toThrow(ForbiddenException);
    await expect(setup().service.updateThread('mod', 't1', { isPinned: true })).resolves.toMatchObject({ isPinned: true });
    await expect(setup().service.deleteThread('mem2', 't1')).rejects.toThrow(ForbiddenException);
    await expect(setup().service.deleteThread('mem', 't1')).resolves.toBeDefined();
    await expect(setup().service.deleteThread('mod', 't1')).resolves.toBeDefined();
    await expect(setup().service.deleteReply('mem2', 'r1')).rejects.toThrow(ForbiddenException);
    await expect(setup().service.deleteReply('mod', 'r1')).resolves.toBeDefined();
  });

  it('sends a reported post to the team, once, and never your own', async () => {
    const { service, prisma } = setup();
    await service.reportPost('mem2', 'thread', 't1', { reason: 'SPAM', details: ' selling things ' });
    expect(prisma.report.create).toHaveBeenCalledWith({
      data: { reportedById: 'mem2', targetType: 'THREAD', targetId: 't1', reason: 'SPAM', description: 'selling things' },
    });
    prisma.report.findFirst.mockResolvedValueOnce({ id: 'r' });
    await service.reportPost('mem2', 'thread', 't1', { reason: 'SPAM' });
    expect(prisma.report.create).toHaveBeenCalledTimes(1);
    await expect(service.reportPost('mem', 'thread', 't1', { reason: 'SPAM' })).rejects.toThrow(BadRequestException);
    await expect(service.reportPost('mem', 'reply', 'r1', { reason: 'SPAM' })).rejects.toThrow(BadRequestException);
    await expect(service.reportPost('visitor', 'thread', 't1', { reason: 'SPAM' })).rejects.toThrow(ForbiddenException);
  });

  it('closes a hidden community to everyone', async () => {
    await expect(setup({ hidden: true }).service.createThread('own', 'ch1', { title: 'Hi' })).rejects.toThrow(NotFoundException);
    await expect(setup({ hidden: true }).service.joinCommunity('new', 'c1')).rejects.toThrow(NotFoundException);
  });
});
