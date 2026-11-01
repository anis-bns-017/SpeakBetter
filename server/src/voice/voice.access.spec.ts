import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PrismaService } from '../prisma.service';
import { CreateVoiceRoomDto } from './dto/voice.dto';
import { VoiceService } from './voice.service';

/**
 * Private voice rooms against a real PostgreSQL. Same opt-in as the auth
 * suites: AUTH_TEST_DATABASE_URL = a throwaway database (name contains "test")
 * with the migrations applied.
 */
const TEST_DB_URL = process.env.AUTH_TEST_DATABASE_URL;
const describeDb = TEST_DB_URL ? describe : describe.skip;

describeDb('Voice room privacy (PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: VoiceService;
  const emails: string[] = [];
  let counter = 0;

  const user = async (label: string) => {
    const email = `vroom-${label}-${Date.now()}-${counter++}@example.test`;
    emails.push(email);
    return prisma.user.create({
      data: { email, name: label, passwordHash: 'x' },
    });
  };

  const room = (creatorId: string, type: 'OPEN' | 'PRIVATE', extra: any = {}) =>
    prisma.voiceRoom.create({
      data: {
        name: `${type} room`,
        type,
        creatorId,
        status: 'ACTIVE',
        ...extra,
      },
    });

  const setup = async () => {
    const host = await user('host');
    const invited = await user('invited');
    const stranger = await user('stranger');
    const priv = await room(host.id, 'PRIVATE');
    await prisma.voiceParticipant.createMany({
      data: [
        { roomId: priv.id, userId: host.id, role: 'MODERATOR' },
        { roomId: priv.id, userId: invited.id, role: 'LISTENER' },
      ],
    });
    await prisma.voiceRoomMessage.create({
      data: {
        roomId: priv.id,
        senderId: host.id,
        content: 'secret plans',
        type: 'TEXT',
      },
    });
    const open = await room(host.id, 'OPEN');
    return { host, invited, stranger, priv, open };
  };

  beforeAll(async () => {
    const dbName = new URL(TEST_DB_URL!).pathname.slice(1);
    if (!/test/i.test(dbName)) {
      throw new Error(`Refusing to run against "${dbName}"`);
    }
    process.env.DATABASE_URL = TEST_DB_URL;
    prisma = new PrismaService();
    await prisma.$connect();
    const liveKit: any = {
      createRoom: jest.fn().mockResolvedValue(undefined),
      getParticipantToken: jest.fn().mockResolvedValue('token'),
    };
    service = new VoiceService(prisma, liveKit, {} as any);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }); // rooms cascade
    await prisma.onModuleDestroy();
  });

  const ids = (rooms: Array<{ id: string }>) => rooms.map((r) => r.id);

  describe('a stranger', () => {
    it('cannot see a private room in any list', async () => {
      const { stranger, priv, open } = await setup();

      expect(ids(await service.getRooms(stranger.id, {}))).not.toContain(
        priv.id,
      );
      expect(ids(await service.getRooms(stranger.id, {}))).toContain(open.id);

      const discovered = await service.discoverRooms(stranger.id, {
        filter: 'PRIVATE',
        limit: 100,
      } as any);
      expect(ids(discovered.rooms)).not.toContain(priv.id);
      const everything = await service.discoverRooms(stranger.id, {
        limit: 100,
      } as any);
      expect(ids(everything.rooms)).not.toContain(priv.id);

      expect(
        ids(await service.getTrendingRooms(stranger.id, 100)),
      ).not.toContain(priv.id);
      expect(
        ids(await service.getRecommendedRooms(stranger.id, 100)),
      ).not.toContain(priv.id);
    });

    it('gets "not found", not "forbidden", for everything about it (existence is not leaked)', async () => {
      const { stranger, priv } = await setup();

      await expect(
        service.getRoomById(priv.id, stranger.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getRoomParticipants(priv.id, stranger.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getVoiceRoomMessages(stranger.id, priv.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getRecordings(priv.id, stranger.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getActiveParticipants(priv.id, stranger.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getRoomCorrections(priv.id, 100, stranger.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cannot join it, and no participant row appears', async () => {
      const { stranger, priv } = await setup();

      await expect(
        service.joinRoom(stranger.id, priv.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        await prisma.voiceParticipant.count({
          where: { roomId: priv.id, userId: stranger.id },
        }),
      ).toBe(0);
    });
  });

  describe('the host and invited people', () => {
    it('see the room, its people and its chat', async () => {
      const { host, invited, priv } = await setup();

      for (const viewer of [host, invited]) {
        expect(ids(await service.getRooms(viewer.id, {}))).toContain(priv.id);
        expect((await service.getRoomById(priv.id, viewer.id)).id).toBe(
          priv.id,
        );
        expect(
          (await service.getRoomParticipants(priv.id, viewer.id)).length,
        ).toBeGreaterThan(0);
        const messages = await service.getVoiceRoomMessages(viewer.id, priv.id);
        expect(messages.map((m: any) => m.content)).toContain('secret plans');
        expect(
          await service.getActiveParticipants(priv.id, viewer.id),
        ).toBeDefined();
        expect(
          await service.getRoomCorrections(priv.id, 100, viewer.id),
        ).toEqual([]);
      }
    });

    it('can join', async () => {
      const { host, invited, priv } = await setup();
      await expect(
        service.joinRoom(invited.id, priv.id),
      ).resolves.toMatchObject({ token: 'token' });
      await expect(service.joinRoom(host.id, priv.id)).resolves.toMatchObject({
        token: 'token',
      });
    });

    it('a kicked person (row removed) is shut out again', async () => {
      const { invited, priv } = await setup();
      await prisma.voiceParticipant.delete({
        where: { roomId_userId: { roomId: priv.id, userId: invited.id } },
      });
      await expect(
        service.joinRoom(invited.id, priv.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.getVoiceRoomMessages(invited.id, priv.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('someone who used an invite code (row created by the invite) gets in', async () => {
      const { stranger, priv } = await setup();
      await prisma.voiceParticipant.create({
        data: { roomId: priv.id, userId: stranger.id, role: 'LISTENER' },
      });
      await expect(
        service.joinRoom(stranger.id, priv.id),
      ).resolves.toBeDefined();
      expect((await service.getRoomById(priv.id, stranger.id)).id).toBe(
        priv.id,
      );
    });
  });

  describe('open rooms stay open', () => {
    it('anyone can view and join', async () => {
      const { stranger, open } = await setup();
      expect((await service.getRoomById(open.id, stranger.id)).id).toBe(
        open.id,
      );
      await expect(
        service.getVoiceRoomMessages(stranger.id, open.id),
      ).resolves.toEqual([]);
      await expect(
        service.joinRoom(stranger.id, open.id),
      ).resolves.toMatchObject({ token: 'token' });
    });
  });

  describe('inviting people when a room is created', () => {
    it('accepts real user ids (cuids), which the old UUID check rejected', async () => {
      const guest = await user('cuid');
      const dto = plainToInstance(CreateVoiceRoomDto, {
        name: 'Invite test',
        type: 'PRIVATE',
        invitedUserIds: [guest.id],
      });
      expect(await validate(dto)).toEqual([]);

      const bad = plainToInstance(CreateVoiceRoomDto, {
        name: 'Invite test',
        type: 'PRIVATE',
        invitedUserIds: [123, ''],
      });
      expect((await validate(bad)).length).toBeGreaterThan(0);
    });

    it('invited people get in, unknown ids and repeats are ignored, nobody is invited twice', async () => {
      const host = await user('host');
      const friend = await user('friend');
      const stranger = await user('nobody');

      const created = await service.createRoom(host.id, {
        name: 'Friends only',
        type: 'PRIVATE',
        invitedUserIds: [friend.id, friend.id, 'does-not-exist', host.id],
      } as any);

      await expect(
        service.getRoomById(created.id, friend.id),
      ).resolves.toBeDefined();
      await expect(
        service.getRoomById(created.id, stranger.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        await prisma.voiceParticipant.count({ where: { roomId: created.id } }),
      ).toBe(2); // the host and the one real, unique invitee
    });
  });
});
