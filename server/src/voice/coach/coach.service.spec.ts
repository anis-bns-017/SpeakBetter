import { CoachService } from './coach.service';
import { MISSION_WORDS } from './coach.data';

const people = [
  { userId: 'u1', name: 'Ana' },
  { userId: 'u2', name: 'Ben' },
  { userId: 'u3', name: 'Caro' },
];

const makeService = () => {
  const prisma: any = {
    voiceRoom: {
      findUnique: jest.fn().mockResolvedValue({ name: 'English Club', type: 'OPEN', creatorId: 'u1' }),
    },
    voiceParticipant: {
      findMany: jest.fn().mockResolvedValue(
        people.map((p) => ({ userId: p.userId, role: 'LISTENER', user: { name: p.name } })),
      ),
    },
    voiceCorrection: { count: jest.fn().mockResolvedValue(2) },
    voiceSessionReport: { upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)) },
  };
  const activity: any = { recordCappedActivity: jest.fn().mockResolvedValue(undefined) };
  const service = new CoachService(prisma, activity);
  people.forEach((p) => service.join('r1', p.userId, p.name));
  return { service, prisma, activity };
};

/** Deterministic picks: always the first word at the level */
const first = () => 0;

describe('CoachService missions', () => {
  afterEach(() => jest.useRealTimers());

  it('gives everyone a different word and keeps words secret in the public view', () => {
    const { service } = makeService();
    const pub = service.startMission('r1', { level: 'B2', startedBy: 'u1' }, people);
    expect(pub.total).toBe(3);
    expect(pub.completed).toEqual([]);

    const words = people.map((p) => service.missionPrivate('r1', p.userId)!.word);
    expect(new Set(words).size).toBe(3);
    expect(JSON.stringify(pub)).not.toContain(words[0]);
    service.stopMission('r1');
  });

  it('refuses a second round while one is running', () => {
    const { service } = makeService();
    service.startMission('r1', { level: 'A1', startedBy: 'u1' }, people);
    expect(() => service.startMission('r1', { level: 'A1', startedBy: 'u1' }, people)).toThrow(/already running/);
    service.stopMission('r1');
  });

  it('completes a mission from a spoken sentence, awards points and speed bonuses', async () => {
    const { service, activity } = makeService();
    service.startMission('r1', { level: 'B1', startedBy: 'u1' }, people, first);
    const w1 = service.missionPrivate('r1', 'u1')!;
    const w2 = service.missionPrivate('r1', 'u2')!;

    const miss = await service.onFinalUtterance('r1', 'u1', 'this sentence has nothing special', 'a');
    expect(miss.completion).toBeNull();

    const a = await service.onFinalUtterance('r1', 'u1', `I think ${w1.example}`, 'b');
    expect(a.completion).toMatchObject({ userId: 'u1', word: w1.word, place: 1, points: 8 + 5 });
    expect(activity.recordCappedActivity).toHaveBeenCalledWith('u1', 13, 'MISSION_COMPLETED', 60);

    const b = await service.onFinalUtterance('r1', 'u2', w2.example, 'c');
    expect(b.completion).toMatchObject({ userId: 'u2', place: 2, points: 8 + 3 });

    // Saying the word again does not pay twice
    const again = await service.onFinalUtterance('r1', 'u1', w1.example, 'd');
    expect(again.completion).toBeNull();
    expect(activity.recordCappedActivity).toHaveBeenCalledTimes(2);

    const pub = service.missionPublic('r1')!;
    expect(pub.completed.map((c) => c.userId)).toEqual(['u1', 'u2']);
    expect(service.missionPrivate('r1', 'u1')).toMatchObject({ completed: true, points: 13 });
  });

  it('ignores the same caption line when it arrives twice', async () => {
    const { service, activity } = makeService();
    service.startMission('r1', { level: 'B1', startedBy: 'u1' }, people, first);
    const w1 = service.missionPrivate('r1', 'u1')!;
    const one = await service.onFinalUtterance('r1', 'u1', w1.example, 'same');
    const two = await service.onFinalUtterance('r1', 'u1', w1.example, 'same');
    expect(one.completion).not.toBeNull();
    expect(two.live).toBeNull();
    expect(activity.recordCappedActivity).toHaveBeenCalledTimes(1);
  });

  it('allows exactly one swap, and not after completing', async () => {
    const { service } = makeService();
    service.startMission('r1', { level: 'B1', startedBy: 'u1' }, people);
    const before = service.missionPrivate('r1', 'u1')!.word;
    const swapped = service.swapWord('r1', 'u1');
    expect(swapped.word).not.toBe(before);
    expect(swapped.swapped).toBe(true);
    expect(() => service.swapWord('r1', 'u1')).toThrow(/already swapped/);

    const w2 = service.missionPrivate('r1', 'u2')!;
    await service.onFinalUtterance('r1', 'u2', w2.example, 'x');
    expect(() => service.swapWord('r1', 'u2')).toThrow(/already completed/);
  });

  it('hands a word to someone who joins mid-round', () => {
    const { service } = makeService();
    service.startMission('r1', { level: 'A2', startedBy: 'u1' }, people);
    expect(service.missionPrivate('r1', 'late')).toBeNull();
    const late = service.assignLate('r1', 'late', 'Late Larry');
    expect(late?.level).toBe('A2');
    expect(service.assignLate('r1', 'late', 'Late Larry')?.word).toBe(late?.word);
  });

  it('ends a round with a leaderboard that reveals the words', async () => {
    const { service } = makeService();
    service.startMission('r1', { level: 'B1', startedBy: 'u1' }, people, first);
    const w2 = service.missionPrivate('r1', 'u2')!;
    await service.onFinalUtterance('r1', 'u2', w2.example, 'x');

    const result = service.stopMission('r1')!;
    expect(result.reason).toBe('stopped');
    expect(result.results[0]).toMatchObject({ userId: 'u2', completed: true, place: 1 });
    expect(result.results.every((r) => MISSION_WORDS.some((m) => m.word === r.word))).toBe(true);
    expect(service.isMissionActive('r1')).toBe(false);
    expect(service.stopMission('r1')).toBeNull();
  });

  it('ends by itself when time runs out and tells the listener', () => {
    jest.useFakeTimers();
    const { service } = makeService();
    const listener = jest.fn();
    service.onMissionEnd(listener);
    service.startMission('r1', { level: 'B1', durationSec: 90, startedBy: 'u1' }, people);

    jest.advanceTimersByTime(89_000);
    expect(listener).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2_000);
    expect(listener).toHaveBeenCalledWith('r1', expect.objectContaining({ reason: 'timeout' }));
    expect(service.isMissionActive('r1')).toBe(false);
  });

  it('keeps the duration in a sensible range', () => {
    const { service } = makeService();
    const pub = service.startMission('r1', { level: 'B1', durationSec: 5, startedBy: 'u1' }, people);
    expect(pub.endsAt - pub.startedAt).toBe(60_000);
    service.stopMission('r1');
    const long = service.startMission('r1', { level: 'B1', durationSec: 99999, startedBy: 'u1' }, people);
    expect(long.endsAt - long.startedAt).toBe(20 * 60_000);
    service.stopMission('r1');
  });
});

describe('CoachService coaching, airtime and reports', () => {
  it('builds a live snapshot and a tip from caption lines', async () => {
    const { service } = makeService();
    service.noteSpeaking('r1', 'u1', 30);
    let live;
    for (let i = 0; i < 3; i++) {
      ({ live } = await service.onFinalUtterance('r1', 'u1', 'um so I think um that it was um good and um nice for us all today', `l${i}`));
    }
    expect(live?.snapshot.fillerCount).toBe(12);
    expect(live?.snapshot.topFillers[0].word).toBe('um');
    expect(live?.snapshot.wpm).toBe(Math.round(((3 * 17) / 30) * 60)); // 17 words a line
  });

  it('rate-limits tips', async () => {
    const { service } = makeService();
    const line = 'um so I think um that it was um good and um nice for us all today';
    const first = await service.onFinalUtterance('r1', 'u1', line, 'a0'); // 17 words: too little to judge
    const second = await service.onFinalUtterance('r1', 'u1', line, 'a1'); // 34 words: first tip
    const third = await service.onFinalUtterance('r1', 'u1', line, 'a2'); // same 20s window: quiet
    expect(first.live?.tip).toBeNull();
    expect(second.live?.tip?.kind).toBe('filler');
    expect(third.live?.tip).toBeNull();
  });

  it('tracks airtime per person and flags quiet people', async () => {
    const { service } = makeService();
    service.noteSpeaking('r1', 'u1', 200);
    service.noteSpeaking('r1', 'u2', 90);
    const air = await service.airtime('r1');
    expect(air.entries.map((e) => e.userId)).toEqual(['u1', 'u2', 'u3']);
    expect(air.quiet).toEqual(['u3']);
    expect(air.balance).toBeLessThan(100);
  });

  it('spotlights the quietest person by default and honours an explicit one', async () => {
    const { service } = makeService();
    service.noteSpeaking('r1', 'u1', 200);
    service.noteSpeaking('r1', 'u2', 90);
    const auto = await service.spotlight('r1', { level: 'B1' }, first);
    expect(auto.target?.userId).toBe('u3');
    expect(auto.card.level).toBe('B1');

    const picked = await service.spotlight('r1', { targetUserId: 'u1', cardId: 'a1-food' });
    expect(picked.target?.userId).toBe('u1');
    expect(picked.card.id).toBe('a1-food');

    await expect(service.spotlight('r1', { targetUserId: 'nobody' })).rejects.toThrow(/not on the speaking list/);
    await expect(service.spotlight('r1', { cardId: 'nope' })).rejects.toThrow(/does not exist/);
  });

  it('saves a report when someone leaves, with correction counts', async () => {
    const { service, prisma } = makeService();
    service.noteSpeaking('r1', 'u1', 40);
    await service.onFinalUtterance('r1', 'u1', 'yesterday I walked along the river with my brother and we talked about everything', 'l1');
    const saved: any = await service.leave('r1', 'u1');

    expect(prisma.voiceSessionReport.upsert).toHaveBeenCalledTimes(1);
    const arg = prisma.voiceSessionReport.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ roomId_userId: { roomId: 'r1', userId: 'u1' } });
    expect(saved).toMatchObject({
      roomId: 'r1',
      userId: 'u1',
      roomName: 'English Club',
      words: 14,
      correctionsReceived: 2,
      correctionsGiven: 2,
    });
    expect(saved.richWords).toContain('everything');
  });

  it('does not save a report for a quick peek', async () => {
    const { service, prisma } = makeService();
    expect(await service.leave('r1', 'u3')).toBeNull();
    expect(prisma.voiceSessionReport.upsert).not.toHaveBeenCalled();
  });

  it('survives a database failure when saving', async () => {
    const { service, prisma } = makeService();
    service.noteSpeaking('r1', 'u1', 40);
    prisma.voiceSessionReport.upsert.mockRejectedValueOnce(new Error('db down'));
    await expect(service.leave('r1', 'u1')).resolves.toBeNull();
  });

  it('closeRoom saves people who are still in and frees state', async () => {
    const { service, prisma } = makeService();
    service.noteSpeaking('r1', 'u2', 40);
    await service.closeRoom('r1');
    expect(prisma.voiceSessionReport.upsert).toHaveBeenCalledTimes(1);
    expect(service.hasUser('r1', 'u2')).toBe(false);
  });
});
