import { ForbiddenException, HttpException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ROOM_PASSWORD_TRIES, VoiceService } from './voice.service';

const hash = bcrypt.hashSync('open-sesame', 4);

function setup(room: Record<string, unknown> | null, existingRow: unknown = null) {
  const prisma = {
    voiceRoom: { findUnique: jest.fn().mockResolvedValue(room) },
    voiceParticipant: {
      findUnique: jest.fn().mockResolvedValue(existingRow),
      create: jest.fn().mockResolvedValue({ id: 'p' }),
    },
    voiceRoomBan: { findUnique: jest.fn().mockResolvedValue(null) },
    voiceRoomSecret: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const service = new VoiceService(prisma as never, {} as never, {} as never);
  return { service, prisma };
}

const privateRoom = {
  id: 'r',
  type: 'PRIVATE',
  creatorId: 'host',
  status: 'ACTIVE',
  secret: { passwordHash: hash },
};

describe('private room passwords', () => {
  it('lets someone in with the right password, without marking them as present yet', async () => {
    const { service, prisma } = setup(privateRoom);
    await service.admitWithPassword('guest', 'r', 'open-sesame');
    const data = prisma.voiceParticipant.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ roomId: 'r', userId: 'guest', role: 'LISTENER' });
    expect(data.leftAt).toBeInstanceOf(Date);
  });

  it('refuses a wrong password', async () => {
    const { service, prisma } = setup(privateRoom);
    await expect(service.admitWithPassword('guest', 'r', 'nope')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.voiceParticipant.create).not.toHaveBeenCalled();
  });

  it('answers the same for a room that does not exist, so a link reveals nothing', async () => {
    const wrong = setup(privateRoom);
    const missing = setup(null);
    const a = await wrong.service.admitWithPassword('g', 'r', 'nope').catch((e: Error) => e.message);
    const b = await missing.service.admitWithPassword('g', 'r', 'nope').catch((e: Error) => e.message);
    expect(a).toBe(b);
  });

  it('refuses a private room with no password, whatever is typed', async () => {
    const { service, prisma } = setup({ ...privateRoom, secret: null });
    await expect(service.admitWithPassword('guest', 'r', 'no-such-room')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.voiceParticipant.create).not.toHaveBeenCalled();
  });

  it('refuses a room that has ended', async () => {
    const { service } = setup({ ...privateRoom, status: 'ENDED' });
    await expect(service.admitWithPassword('guest', 'r', 'open-sesame')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps someone the host removed out, even with the password', async () => {
    const { service, prisma } = setup(privateRoom);
    prisma.voiceRoomBan.findUnique.mockResolvedValue({ id: 'ban' });
    await expect(service.admitWithPassword('guest', 'r', 'open-sesame')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.voiceParticipant.create).not.toHaveBeenCalled();
  });

  it('does nothing for the host, for people already invited, or for open rooms', async () => {
    for (const [room, row, user] of [
      [privateRoom, null, 'host'],
      [privateRoom, { id: 'row' }, 'guest'],
      [{ ...privateRoom, type: 'OPEN' }, null, 'guest'],
    ] as const) {
      const { service, prisma } = setup(room as never, row);
      await service.admitWithPassword(user, 'r', 'anything');
      expect(prisma.voiceParticipant.create).not.toHaveBeenCalled();
    }
  });

  it('pauses after too many wrong tries, even if the next one is right', async () => {
    const { service } = setup(privateRoom);
    const now = 1_000_000;
    for (let i = 0; i < ROOM_PASSWORD_TRIES; i++) {
      await service.admitWithPassword('guest', 'r', 'nope', now).catch(() => undefined);
    }
    const error = await service.admitWithPassword('guest', 'r', 'open-sesame', now + 1000).catch((e: HttpException) => e);
    expect((error as HttpException).getStatus()).toBe(429);
  });

  it('lets them try again after the pause', async () => {
    const { service, prisma } = setup(privateRoom);
    const now = 1_000_000;
    for (let i = 0; i < ROOM_PASSWORD_TRIES; i++) {
      await service.admitWithPassword('guest', 'r', 'nope', now).catch(() => undefined);
    }
    await service.admitWithPassword('guest', 'r', 'open-sesame', now + 16 * 60 * 1000);
    expect(prisma.voiceParticipant.create).toHaveBeenCalledTimes(1);
  });

  it('stores only a hash of the password', async () => {
    const { service, prisma } = setup(privateRoom);
    await service.setRoomPassword('r', 'open-sesame');
    const stored = prisma.voiceRoomSecret.upsert.mock.calls[0][0].create.passwordHash as string;
    expect(stored).not.toContain('open-sesame');
    expect(await bcrypt.compare('open-sesame', stored)).toBe(true);
  });
});
