import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ChatService, GROUP_MAX_OTHERS } from './chat.service';
import { FriendsService } from '../friends/friends.service';

type Person = { id: string; allowDirectMessages?: boolean; allowFriendRequests?: boolean };

function makePrisma(people: Person[], options: { friends?: boolean; blocked?: boolean } = {}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  return {
    block: { findFirst: jest.fn().mockResolvedValue(options.blocked ? { id: 'b' } : null) },
    friend: { findFirst: jest.fn().mockResolvedValue(options.friends ? { id: 'f' } : null) },
    friendRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'r' }),
    },
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const p = byId.get(where.id);
        return Promise.resolve(
          p
            ? {
                id: p.id,
                name: p.id,
                settings: {
                  allowDirectMessages: p.allowDirectMessages ?? true,
                  allowFriendRequests: p.allowFriendRequests ?? true,
                },
              }
            : null,
        );
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    chat: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'chat' }),
      update: jest.fn().mockResolvedValue({ id: 'chat' }),
    },
  };
}

const chatService = (prisma: unknown) => new ChatService(prisma as never, {} as never, {} as never);

describe('starting a private chat', () => {
  it('works for someone who allows direct messages', async () => {
    const prisma = makePrisma([{ id: 'b' }]);
    await expect(chatService(prisma).createPrivateChat('a', 'b')).resolves.toEqual({ id: 'chat' });
  });

  it('is refused when they only accept messages from friends', async () => {
    const prisma = makePrisma([{ id: 'b', allowDirectMessages: false }]);
    await expect(chatService(prisma).createPrivateChat('a', 'b')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chat.create).not.toHaveBeenCalled();
  });

  it('still works between friends', async () => {
    const prisma = makePrisma([{ id: 'b', allowDirectMessages: false }], { friends: true });
    await expect(chatService(prisma).createPrivateChat('a', 'b')).resolves.toEqual({ id: 'chat' });
  });

  it('reopens a chat you already have, whatever the setting says now', async () => {
    const prisma = makePrisma([{ id: 'b', allowDirectMessages: false }]);
    prisma.chat.findFirst.mockResolvedValue({ id: 'old' });
    await expect(chatService(prisma).createPrivateChat('a', 'b')).resolves.toEqual({ id: 'old' });
  });

  it('gives a clear error for a person who does not exist', async () => {
    const prisma = makePrisma([]);
    await expect(chatService(prisma).createPrivateChat('a', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('creating a group', () => {
  it('adds each person once and never adds the creator twice', async () => {
    const prisma = makePrisma([{ id: 'b' }, { id: 'c' }]);
    await chatService(prisma).createGroupChat('a', { type: 'GROUP', name: '  Study club ', participantIds: ['b', 'c', 'b', 'a'] } as never);
    const data = prisma.chat.create.mock.calls[0][0].data;
    expect(data.name).toBe('Study club');
    expect(data.participants.create.map((p: { userId: string }) => p.userId)).toEqual(['a', 'b', 'c']);
  });

  it('needs at least one other person', async () => {
    const prisma = makePrisma([]);
    await expect(
      chatService(prisma).createGroupChat('a', { type: 'GROUP', name: 'x', participantIds: ['a'] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('has a size limit', async () => {
    const ids = Array.from({ length: GROUP_MAX_OTHERS + 1 }, (_, i) => `u${i}`);
    const prisma = makePrisma(ids.map((id) => ({ id })));
    await expect(
      chatService(prisma).createGroupChat('a', { type: 'GROUP', name: 'x', participantIds: ids } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot pull in someone who turned off messages from strangers', async () => {
    const prisma = makePrisma([{ id: 'b' }, { id: 'c', allowDirectMessages: false }]);
    await expect(
      chatService(prisma).createGroupChat('a', { type: 'GROUP', name: 'x', participantIds: ['b', 'c'] } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chat.create).not.toHaveBeenCalled();
  });
});

describe('friend requests', () => {
  it('are refused when the person turned them off', async () => {
    const prisma = makePrisma([{ id: 'a' }, { id: 'b', allowFriendRequests: false }]);
    await expect(new FriendsService(prisma as never).sendFriendRequest('a', { toUserId: 'b' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.friendRequest.create).not.toHaveBeenCalled();
  });
});

describe('people search', () => {
  const whereOf = async (query: string) => {
    const prisma = makePrisma([]);
    await new FriendsService(prisma as never).searchUsers('me', query);
    return prisma.user.findMany.mock.calls[0][0];
  };

  it('never matches on part of an email', async () => {
    const args = await whereOf('gmail');
    expect(JSON.stringify(args.where)).not.toContain('email');
  });

  it('matches an email only when it is typed in full', async () => {
    const args = await whereOf('friend@example.com');
    expect(JSON.stringify(args.where)).toContain('"equals":"friend@example.com"');
    expect(JSON.stringify(args.where)).not.toContain('"contains":"friend@example.com","mode":"insensitive"}},{"email":{"contains"');
  });

  it('never returns an email address', async () => {
    const args = await whereOf('sam');
    expect(args.select.email).toBeUndefined();
  });

  it('hides people who blocked you', async () => {
    const args = await whereOf('sam');
    expect(JSON.stringify(args.where)).toContain('"blockedUsers":{"none":{"blockedId":"me"}}');
  });
});

describe('other people\'s email addresses', () => {
  it.each(['chat/chat.service.ts', 'chat/chat.presenter.ts', 'friends/friends.service.ts', 'communities/communities.service.ts'])(
    'are not selected in %s',
    (file) => {
      expect(readFileSync(join(__dirname, '..', file), 'utf8')).not.toMatch(/email:\s*true/);
    },
  );
});
