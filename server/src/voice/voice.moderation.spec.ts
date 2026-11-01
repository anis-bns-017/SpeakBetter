// The invite controller imports uuid, which ships ES modules jest cannot load
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma.service';
import { InviteController } from './controllers/invite.controller';
import { VoiceService } from './voice.service';

/**
 * Kick bans and host mute against a real PostgreSQL. Same opt-in as the other
 * DB suites: AUTH_TEST_DATABASE_URL = a throwaway database (name contains
 * "test") with the migrations applied.
 */
const TEST_DB_URL = process.env.AUTH_TEST_DATABASE_URL;
const describeDb = TEST_DB_URL ? describe : describe.skip;

describeDb('Voice moderation: kick bans and host mute (PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: VoiceService;
  let liveKit: {
    createRoom: jest.Mock;
    getParticipantToken: jest.Mock;
    setCanPublish: jest.Mock;
    muteParticipant: jest.Mock;
    unmuteParticipant: jest.Mock;
    removeParticipant: jest.Mock;
  };
  const emails: string[] = [];
  let counter = 0;

  const user = async (label: string) => {
    const email = `vmod-${label}-${Date.now()}-${counter++}@example.test`;
    emails.push(email);
    return prisma.user.create({
      data: { email, name: label, passwordHash: 'x' },
    });
  };

  /** An active room (already known to LiveKit) with a host, a moderator and a listener */
  const setup = async (type: 'OPEN' | 'STAGE' = 'OPEN') => {
    const host = await user('host');
    const mod = await user('mod');
    const guest = await user('guest');
    const other = await user('other');
    const room = await prisma.voiceRoom.create({
      data: {
        name: 'Moderation',
        type,
        creatorId: host.id,
        status: 'ACTIVE',
        liveKitRoomId: `lk-${Date.now()}-${counter++}`,
      },
    });
    await prisma.voiceParticipant.createMany({
      data: [
        { roomId: room.id, userId: host.id, role: 'MODERATOR' },
        { roomId: room.id, userId: mod.id, role: 'MODERATOR' },
        { roomId: room.id, userId: guest.id, role: 'LISTENER' },
      ],
    });
    return { host, mod, guest, other, room };
  };

  const participant = (roomId: string, userId: string) =>
    prisma.voiceParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

  beforeAll(async () => {
    const dbName = new URL(TEST_DB_URL!).pathname.slice(1);
    if (!/test/i.test(dbName)) {
      throw new Error(`Refusing to run against "${dbName}"`);
    }
    process.env.DATABASE_URL = TEST_DB_URL;
    prisma = new PrismaService();
    await prisma.$connect();
  });

  beforeEach(() => {
    liveKit = {
      createRoom: jest.fn().mockResolvedValue(undefined),
      getParticipantToken: jest.fn().mockResolvedValue('token'),
      setCanPublish: jest.fn().mockResolvedValue(undefined),
      muteParticipant: jest.fn().mockResolvedValue(undefined),
      unmuteParticipant: jest.fn().mockResolvedValue(undefined),
      removeParticipant: jest.fn().mockResolvedValue(undefined),
    };
    service = new VoiceService(prisma, liveKit as any, {} as any);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.onModuleDestroy();
  });

  // ------------------------------------------------------------------ bans

  describe('kick = ban', () => {
    it('only the host can kick, never the host themselves', async () => {
      const { host, mod, guest, room } = await setup();

      await expect(
        service.kickParticipant(mod.id, room.id, guest.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.kickParticipant(guest.id, room.id, mod.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.kickParticipant(host.id, room.id, host.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.kickParticipant(host.id, 'no-such-room', guest.id),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(
        await prisma.voiceRoomBan.count({ where: { roomId: room.id } }),
      ).toBe(0);
      expect(await participant(room.id, guest.id)).not.toBeNull();
    });

    it('removes the person and records the ban in one step', async () => {
      const { host, guest, room } = await setup();

      await service.kickParticipant(host.id, room.id, guest.id, 'spamming');

      expect(await participant(room.id, guest.id)).toBeNull();
      const ban = await prisma.voiceRoomBan.findUniqueOrThrow({
        where: { roomId_userId: { roomId: room.id, userId: guest.id } },
      });
      expect(ban.bannedById).toBe(host.id);
      expect(ban.reason).toBe('spamming');
    });

    it('a banned person cannot join again, in an open room', async () => {
      const { host, guest, room } = await setup();
      await service.kickParticipant(host.id, room.id, guest.id);

      await expect(service.joinRoom(guest.id, room.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(await participant(room.id, guest.id)).toBeNull();
      expect(liveKit.getParticipantToken).not.toHaveBeenCalled();
    });

    it('nor with an invite code', async () => {
      const { host, guest, room } = await setup();
      await service.kickParticipant(host.id, room.id, guest.id);
      await prisma.voiceRoomInvite.create({
        data: {
          roomId: room.id,
          code: `code-${Date.now()}-${counter++}`,
          createdById: host.id,
          maxUses: 5,
        },
      });
      const invite = await prisma.voiceRoomInvite.findFirstOrThrow({
        where: { roomId: room.id },
      });

      const controller = new InviteController(prisma);
      await expect(
        controller.useInvite(invite.code, { user: { id: guest.id } }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await participant(room.id, guest.id)).toBeNull();
      expect(
        (
          await prisma.voiceRoomInvite.findUniqueOrThrow({
            where: { id: invite.id },
          })
        ).uses,
      ).toBe(0);
    });

    it('the ban only covers that room and that person', async () => {
      const { host, guest, other, room } = await setup();
      const elsewhere = await prisma.voiceRoom.create({
        data: {
          name: 'Elsewhere',
          type: 'OPEN',
          creatorId: host.id,
          status: 'ACTIVE',
        },
      });
      await service.kickParticipant(host.id, room.id, guest.id);

      await expect(
        service.joinRoom(guest.id, elsewhere.id),
      ).resolves.toBeDefined();
      await expect(service.joinRoom(other.id, room.id)).resolves.toBeDefined();
    });

    it('can ban someone who already left, and kicking twice is harmless', async () => {
      const { host, guest, room } = await setup();
      await prisma.voiceParticipant.update({
        where: { roomId_userId: { roomId: room.id, userId: guest.id } },
        data: { leftAt: new Date() },
      });

      await service.kickParticipant(host.id, room.id, guest.id);
      await service.kickParticipant(host.id, room.id, guest.id);

      expect(
        await prisma.voiceRoomBan.count({
          where: { roomId: room.id, userId: guest.id },
        }),
      ).toBe(1);
      await expect(service.joinRoom(guest.id, room.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('the ban list is for the host and moderators; lifting a ban lets the person join again', async () => {
      const { host, mod, guest, other, room } = await setup();
      await service.kickParticipant(host.id, room.id, guest.id, 'rude');

      const list = await service.listBans(mod.id, room.id);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        userId: guest.id,
        reason: 'rude',
        bannedById: host.id,
      });
      expect(list[0].user?.name).toBe('guest');

      await expect(service.listBans(other.id, room.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.unbanParticipant(other.id, room.id, guest.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.joinRoom(guest.id, room.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      await service.unbanParticipant(mod.id, room.id, guest.id);
      expect(await service.listBans(host.id, room.id)).toEqual([]);
      await expect(service.joinRoom(guest.id, room.id)).resolves.toBeDefined();
    });

    it('a kicked invitee of a private room stays out for good, ban or no ban', async () => {
      const host = await user('phost');
      const friend = await user('pfriend');
      const room = await service.createRoom(host.id, {
        name: 'Private',
        type: 'PRIVATE',
        invitedUserIds: [friend.id],
      } as any);
      await service.kickParticipant(host.id, room.id, friend.id);

      await expect(service.joinRoom(friend.id, room.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.getRoomById(room.id, friend.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ------------------------------------------------------------- host mute

  describe('host mute', () => {
    it('only the host or a moderator can mute; the host cannot be muted', async () => {
      const { host, mod, guest, other, room } = await setup();

      await expect(
        service.muteParticipant(guest.id, room.id, mod.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.muteParticipant(other.id, room.id, guest.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.muteParticipant(mod.id, room.id, host.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect((await participant(room.id, guest.id))!.mutedByHost).toBe(false);
    });

    it('sets the flag and takes away the right to publish, not just the track', async () => {
      const { host, guest, room } = await setup();

      await service.muteParticipant(host.id, room.id, guest.id);

      const row = (await participant(room.id, guest.id))!;
      expect(row.isMuted).toBe(true);
      expect(row.mutedByHost).toBe(true);
      expect(liveKit.setCanPublish).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
        false,
      );
      expect(liveKit.muteParticipant).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
      );
    });

    it('survives leaving and rejoining: the new audio token cannot publish', async () => {
      const { host, guest, room } = await setup();
      await service.muteParticipant(host.id, room.id, guest.id);
      await service.leaveRoom(guest.id, room.id);

      liveKit.getParticipantToken.mockClear();
      await service.joinRoom(guest.id, room.id);

      expect(liveKit.getParticipantToken).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
        guest.id,
        { canPublish: false },
      );
      expect((await participant(room.id, guest.id))!.mutedByHost).toBe(true);
    });

    it('also holds when a participant who never left reconnects', async () => {
      const { host, guest, room } = await setup();
      await service.muteParticipant(host.id, room.id, guest.id);

      liveKit.getParticipantToken.mockClear();
      await service.joinRoom(guest.id, room.id);
      expect(liveKit.getParticipantToken).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
        guest.id,
        { canPublish: false },
      );
    });

    it('unmuting clears the flag and gives the right to publish back', async () => {
      const { host, mod, guest, room } = await setup();
      await service.muteParticipant(host.id, room.id, guest.id);

      liveKit.setCanPublish.mockClear();
      await service.unmuteParticipant(mod.id, room.id, guest.id);

      const row = (await participant(room.id, guest.id))!;
      expect(row.isMuted).toBe(false);
      expect(row.mutedByHost).toBe(false);
      expect(liveKit.setCanPublish).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
        true,
      );

      liveKit.getParticipantToken.mockClear();
      await service.joinRoom(guest.id, room.id);
      expect(liveKit.getParticipantToken).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
        guest.id,
        { canPublish: true },
      );
    });

    it('on a stage, unmuting a listener does not turn them into a speaker', async () => {
      const { host, guest, room } = await setup('STAGE');
      await service.muteParticipant(host.id, room.id, guest.id);

      liveKit.setCanPublish.mockClear();
      await service.unmuteParticipant(host.id, room.id, guest.id);
      expect(liveKit.setCanPublish).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
        false,
      );
    });

    it('a role change cannot undo a host mute (stage speaker stays silenced)', async () => {
      const { host, guest, room } = await setup('STAGE');
      await service.applyParticipantRole(room.id, guest.id, 'SPEAKER');
      await service.muteParticipant(host.id, room.id, guest.id);

      liveKit.setCanPublish.mockClear();
      const result = await service.applyParticipantRole(
        room.id,
        guest.id,
        'SPEAKER',
      );

      expect(liveKit.setCanPublish).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
        false,
      );
      expect(result.canSpeak).toBe(true); // the role itself still allows it; the mute is separate
    });

    it('an ordinary self-mute is not a host mute', async () => {
      const { guest, room } = await setup();
      await prisma.voiceParticipant.update({
        where: { roomId_userId: { roomId: room.id, userId: guest.id } },
        data: { isMuted: true },
      });

      liveKit.getParticipantToken.mockClear();
      await service.leaveRoom(guest.id, room.id);
      await service.joinRoom(guest.id, room.id);
      expect(liveKit.getParticipantToken).toHaveBeenCalledWith(
        room.liveKitRoomId,
        guest.id,
        guest.id,
        { canPublish: true },
      );
    });
  });
});
