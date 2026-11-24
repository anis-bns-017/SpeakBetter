import { VoiceGateway } from './voice.gateway';

const NOW = Date.parse('2026-11-23T12:00:00Z');
const longAgo = new Date(NOW - 60 * 60_000);

function setup(rows: Array<{ roomId: string; userId: string; joinedAt: Date }>, online: Array<{ userId: string; rooms: string[] }> = []) {
  const prisma: any = {
    voiceParticipant: {
      findMany: jest.fn(async () => rows),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    voiceRoom: { findUnique: jest.fn().mockResolvedValue({ creatorId: 'host' }) },
  };
  const state: any = {
    pendingLeaves: new Map(),
    removeParticipant: jest.fn().mockResolvedValue({ wasPresent: false, remaining: [] }),
    getHost: jest.fn().mockResolvedValue(null),
    setHost: jest.fn(),
  };
  const coachSession: any = { flushSpeaking: jest.fn(), finishCoachSession: jest.fn().mockResolvedValue(undefined) };
  const gateway = new VoiceGateway({} as any, {} as any, prisma, {} as any, state, {} as any, coachSession);
  const sockets = () => online.map((s) => ({ data: { userId: s.userId }, rooms: new Set(s.rooms) }));
  (gateway as any).server = {
    fetchSockets: jest.fn(async () => sockets()),
    in: (room: string) => ({ fetchSockets: async () => sockets().filter((s) => s.rooms.has(room)) }),
    to: () => ({ emit: jest.fn() }),
  };
  return { gateway, prisma, state };
}

describe('VoiceGateway: people who are no longer really in a room', () => {
  it('removes someone only after they are missing on two checks in a row', async () => {
    const { gateway, prisma } = setup([{ roomId: 'r1', userId: 'ghost', joinedAt: longAgo }]);
    expect(await gateway.sweepGhosts(NOW)).toBe(0);
    expect(prisma.voiceParticipant.updateMany).not.toHaveBeenCalled();
    expect(await gateway.sweepGhosts(NOW + 60_000)).toBe(1);
    expect(prisma.voiceParticipant.updateMany).toHaveBeenCalledWith({
      where: { roomId: 'r1', userId: 'ghost', leftAt: null },
      data: { leftAt: expect.any(Date) },
    });
  });

  it('never removes someone who is connected to that room', async () => {
    const { gateway, prisma } = setup([{ roomId: 'r1', userId: 'here', joinedAt: longAgo }], [{ userId: 'here', rooms: ['voice:r1'] }]);
    await gateway.sweepGhosts(NOW);
    expect(await gateway.sweepGhosts(NOW + 60_000)).toBe(0);
    expect(prisma.voiceParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('being connected to a different room does not count', async () => {
    const { gateway } = setup([{ roomId: 'r1', userId: 'u1', joinedAt: longAgo }], [{ userId: 'u1', rooms: ['voice:r2'] }]);
    await gateway.sweepGhosts(NOW);
    expect(await gateway.sweepGhosts(NOW + 60_000)).toBe(1);
  });

  it('gives someone who just joined time to connect', async () => {
    const { gateway } = setup([{ roomId: 'r1', userId: 'new', joinedAt: new Date(NOW - 5_000) }]);
    expect(await gateway.sweepGhosts(NOW)).toBe(0);
    // Still inside the first check's grace: the absence only starts counting after it
    expect(await gateway.sweepGhosts(NOW + 30_000)).toBe(0);
  });

  it('leaves someone alone during their reconnect grace', async () => {
    const { gateway, state } = setup([{ roomId: 'r1', userId: 'u1', joinedAt: longAgo }]);
    state.pendingLeaves.set('r1:u1', setTimeout(() => undefined, 1));
    await gateway.sweepGhosts(NOW);
    expect(await gateway.sweepGhosts(NOW + 60_000)).toBe(0);
    clearTimeout(state.pendingLeaves.get('r1:u1'));
  });

  it('removes nothing when it cannot tell who is connected', async () => {
    const { gateway, prisma } = setup([{ roomId: 'r1', userId: 'u1', joinedAt: longAgo }]);
    (gateway as any).server.fetchSockets = jest.fn().mockRejectedValue(new Error('timeout'));
    await gateway.sweepGhosts(NOW);
    expect(await gateway.sweepGhosts(NOW + 60_000)).toBe(0);
    expect(prisma.voiceParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('a dropped connection that never comes back is written down as having left', async () => {
    const { gateway, prisma } = setup([]);
    await (gateway as any).removeFromRoom('r1', 'u1');
    expect(prisma.voiceParticipant.updateMany).toHaveBeenCalledWith({
      where: { roomId: 'r1', userId: 'u1', leftAt: null },
      data: { leftAt: expect.any(Date) },
    });
  });

  it('but not if they already came back on another connection', async () => {
    const { gateway, prisma } = setup([], [{ userId: 'u1', rooms: ['voice:r1'] }]);
    await (gateway as any).removeFromRoom('r1', 'u1');
    expect(prisma.voiceParticipant.updateMany).not.toHaveBeenCalled();
  });
});
