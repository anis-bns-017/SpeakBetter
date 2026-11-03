import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FollowService } from './follow.service';
import { RoomRemindersService } from './room-reminders.service';

function setup() {
  const follows: Array<{ followerId: string; followingId: string }> = [];
  const interests: Array<{ roomId: string; userId: string }> = [];
  const rooms: any[] = [];
  const participants: Array<{ roomId: string; userId: string; leftAt: Date | null }> = [];
  const prisma: any = {
    user: { findUnique: jest.fn(async ({ where }) => ({ id: where.id, name: `Name ${where.id}`, avatarUrl: null })) },
    block: { findFirst: jest.fn().mockResolvedValue(null) },
    profile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    follow: {
      create: jest.fn(async ({ data }) => {
        if (follows.some((f) => f.followerId === data.followerId && f.followingId === data.followingId)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        follows.push(data);
        return data;
      }),
      deleteMany: jest.fn(async ({ where }) => {
        const before = follows.length;
        for (let i = follows.length - 1; i >= 0; i--) {
          if (follows[i].followerId === where.followerId && follows[i].followingId === where.followingId) follows.splice(i, 1);
        }
        return { count: before - follows.length };
      }),
      count: jest.fn(async ({ where }) =>
        follows.filter((f) => (!where.followerId || f.followerId === where.followerId) && (!where.followingId || f.followingId === where.followingId)).length,
      ),
      findMany: jest.fn(async ({ where }) =>
        follows.filter((f) => (where.followingId ? f.followingId === where.followingId : f.followerId === where.followerId)),
      ),
    },
    voiceRoom: {
      findUnique: jest.fn(async ({ where }) => rooms.find((r) => r.id === where.id) ?? null),
      findMany: jest.fn(async () => rooms.filter((r) => r.status === 'WAITING' && !r.reminderSentAt)),
      updateMany: jest.fn(async ({ where, data }) => {
        const room = rooms.find((r) => r.id === where.id && !r.reminderSentAt);
        if (!room) return { count: 0 };
        Object.assign(room, data);
        return { count: 1 };
      }),
    },
    voiceRoomInterest: {
      upsert: jest.fn(async ({ create }) => {
        if (!interests.some((i) => i.roomId === create.roomId && i.userId === create.userId)) interests.push(create);
        return create;
      }),
      deleteMany: jest.fn(async ({ where }) => {
        const keep = interests.filter((i) => !(i.roomId === where.roomId && i.userId === where.userId));
        const removed = interests.length - keep.length;
        interests.splice(0, interests.length, ...keep);
        return { count: removed };
      }),
      count: jest.fn(async ({ where }) => interests.filter((i) => i.roomId === where.roomId).length),
      findMany: jest.fn(async ({ where }) => interests.filter((i) => i.roomId === where.roomId)),
    },
    voiceParticipant: {
      findUnique: jest.fn(async ({ where }) =>
        participants.find((p) => p.roomId === where.roomId_userId.roomId && p.userId === where.roomId_userId.userId) ?? null,
      ),
      findMany: jest.fn(async ({ where }) => participants.filter((p) => p.roomId === where.roomId && !p.leftAt)),
    },
  };
  const notifications: any = { notify: jest.fn(async (ids: string[]) => [...ids].length) };
  const followService = new FollowService(prisma, notifications);
  const reminders = new RoomRemindersService(prisma, notifications, followService);
  return { followService, reminders, prisma, notifications, follows, interests, rooms, participants };
}

describe('FollowService', () => {
  it('follows once, notifies the person, and reports both directions', async () => {
    const { followService, notifications } = setup();
    expect(await followService.follow('a', 'b')).toEqual({ following: true, followedBy: false, followers: 1, followingCount: 0 });
    expect(notifications.notify).toHaveBeenCalledWith(['b'], expect.objectContaining({ type: 'NEW_FOLLOWER', dedupeKey: 'follow:a', preference: 'newFollowers' }));
    // Following again is harmless
    await followService.follow('a', 'b');
    expect(await followService.followerIds('b')).toEqual(['a']);
    expect(await followService.unfollow('a', 'b')).toMatchObject({ following: false, followers: 0 });
  });

  it('refuses yourself and blocked people', async () => {
    const { followService, prisma } = setup();
    await expect(followService.follow('a', 'a')).rejects.toThrow(BadRequestException);
    prisma.block.findFirst.mockResolvedValueOnce({ id: 'x' });
    await expect(followService.follow('a', 'b')).rejects.toThrow(/can't follow/);
  });
});

describe('RoomRemindersService', () => {
  const soon = () => new Date(Date.now() + 5 * 60 * 1000);

  it('remembers who wants a reminder, only for scheduled rooms they can see', async () => {
    const { reminders, rooms } = setup();
    rooms.push({ id: 'r1', type: 'SCHEDULED', creatorId: 'host', status: 'WAITING', scheduledFor: soon() });
    rooms.push({ id: 'r2', type: 'OPEN', creatorId: 'host', status: 'WAITING', scheduledFor: null });
    rooms.push({ id: 'r3', type: 'PRIVATE', creatorId: 'host', status: 'WAITING', scheduledFor: soon() });
    expect(await reminders.setInterest('u1', 'r1', true)).toEqual({ roomId: 'r1', interested: true, count: 1 });
    await expect(reminders.setInterest('u1', 'r2', true)).rejects.toThrow(/scheduled/);
    await expect(reminders.setInterest('u1', 'r3', true)).rejects.toThrow(NotFoundException);
    expect(await reminders.setInterest('u1', 'r1', false)).toMatchObject({ interested: false, count: 0 });
  });

  it('sends "starting soon" once, to the host and the interested people', async () => {
    const { reminders, rooms, interests, notifications } = setup();
    rooms.push({ id: 'r1', name: 'Morning chat', type: 'SCHEDULED', creatorId: 'host', status: 'WAITING', scheduledFor: soon(), reminderSentAt: null });
    interests.push({ roomId: 'r1', userId: 'u1' });
    expect(await reminders.sendDueReminders()).toBe(2);
    expect(notifications.notify).toHaveBeenCalledWith(
      ['host', 'u1'],
      expect.objectContaining({ type: 'ROOM_REMINDER', title: 'Starting in 5 minutes', dedupeKey: 'reminder:r1', preference: 'roomReminders' }),
    );
    expect(await reminders.sendDueReminders()).toBe(0);
  });

  it('announces a live room to interested people and followers, but not to the host or people already in it', async () => {
    const { reminders, follows, interests, participants, notifications } = setup();
    follows.push({ followerId: 'f1', followingId: 'host' }, { followerId: 'u1', followingId: 'host' }, { followerId: 'inside', followingId: 'host' });
    interests.push({ roomId: 'r1', userId: 'u1' });
    participants.push({ roomId: 'r1', userId: 'inside', leftAt: null });
    await reminders.onRoomLive({ id: 'r1', name: 'Morning chat', type: 'OPEN', creatorId: 'host' });
    expect(notifications.notify).toHaveBeenNthCalledWith(1, ['u1'], expect.objectContaining({ type: 'ROOM_LIVE', preference: 'roomReminders' }));
    expect(notifications.notify).toHaveBeenNthCalledWith(2, ['f1'], expect.objectContaining({ type: 'ROOM_LIVE', preference: 'followedLive' }));
  });

  it('keeps private rooms quiet, and tells followers about a room scheduled for later', async () => {
    const { reminders, follows, notifications } = setup();
    follows.push({ followerId: 'f1', followingId: 'host' });
    await reminders.onRoomLive({ id: 'r9', name: 'Secret', type: 'PRIVATE', creatorId: 'host' });
    expect(notifications.notify).not.toHaveBeenCalled();
    await reminders.onRoomScheduled({ id: 'r1', name: 'Morning chat', type: 'SCHEDULED', creatorId: 'host', scheduledFor: new Date(Date.now() + 3600_000) });
    expect(notifications.notify).toHaveBeenCalledWith(['f1'], expect.objectContaining({ type: 'ROOM_SCHEDULED', dedupeKey: 'scheduled:r1' }));
  });
});
