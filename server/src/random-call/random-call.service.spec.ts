import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MatchQueue } from './match-queue';
import { QueueEntry } from './matching';
import { RandomCallService } from './random-call.service';

/**
 * Random calls against a real PostgreSQL. Same opt-in as the other DB suites:
 * AUTH_TEST_DATABASE_URL = a throwaway database (name contains "test") with
 * the migrations applied.
 */
const TEST_DB_URL = process.env.AUTH_TEST_DATABASE_URL;
const describeDb = TEST_DB_URL ? describe : describe.skip;

describeDb('Random calls (PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: RandomCallService;
  let queue: MatchQueue;
  let emitted: Array<{ userId: string; event: string; payload: any }>;
  const liveKit = {
    isAvailable: jest.fn(() => true),
    createRoom: jest.fn().mockResolvedValue({}),
    getParticipantToken: jest.fn().mockResolvedValue('token'),
    getWebSocketUrl: jest.fn(() => 'ws://livekit.test'),
    endRoom: jest.fn().mockResolvedValue(undefined),
  };
  const activity = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const emails: string[] = [];
  let counter = 0;

  const user = async (label: string, dateOfBirth?: Date) => {
    const email = `rc-${label}-${Date.now()}-${counter++}@example.test`;
    emails.push(email);
    const created = await prisma.user.create({
      data: { email, name: label, passwordHash: 'x' },
    });
    if (dateOfBirth) {
      await prisma.profile.create({ data: { userId: created.id, dateOfBirth } });
    }
    return created;
  };

  const adult = async (label: string) => {
    const u = await user(label);
    await service.confirmAge(u.id);
    return u;
  };

  const entryFor = (userId: string, over: Partial<QueueEntry> = {}): QueueEntry => ({
    userId,
    level: 'intermediate',
    goal: 'casual',
    language: 'English',
    joinedAt: Date.now(),
    blocked: [],
    recent: [],
    reputation: null,
    ...over,
  });

  /** A started call between two adults */
  const startCall = async () => {
    const a = await adult('a');
    const b = await adult('b');
    const callId = await service.createCall(entryFor(a.id), entryFor(b.id));
    expect(callId).toBeTruthy();
    return { a, b, callId: callId! };
  };

  const eventsFor = (userId: string, event: string) =>
    emitted.filter((e) => e.userId === userId && e.event === event);

  beforeAll(async () => {
    const dbName = new URL(TEST_DB_URL!).pathname.slice(1);
    if (!/test/i.test(dbName)) throw new Error(`Refusing to run against "${dbName}"`);
    process.env.DATABASE_URL = TEST_DB_URL;
    prisma = new PrismaService();
    await prisma.$connect();
    queue = new MatchQueue();
    emitted = [];
    const broadcaster: any = {
      emitToUser: (userId: string, event: string, payload: any) =>
        emitted.push({ userId, event, payload }),
    };
    const config: any = { get: () => undefined };
    service = new RandomCallService(prisma, liveKit as any, queue, broadcaster, config, activity as any);
  });

  beforeEach(() => {
    emitted.length = 0;
    activity.recordActivity.mockClear();
    liveKit.isAvailable.mockReturnValue(true);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.onModuleDestroy();
    }
  });

  describe('who may call', () => {
    it('asks for the 18+ confirmation first', async () => {
      const u = await user('new');
      const denial = await service.denialFor(u.id);
      expect(denial?.code).toBe('NEEDS_CONSENT');
      await service.confirmAge(u.id);
      expect(await service.denialFor(u.id)).toBeNull();
    });

    it('survives several first-time requests at once', async () => {
      const u = await user('racy');
      const results = await Promise.all([
        service.getStatus(u.id),
        service.getStatus(u.id),
        service.denialFor(u.id),
        service.confirmAge(u.id),
      ]);
      expect(results[0].needsConsent || results[0].eligible).toBe(true);
      expect(await prisma.randomCallProfile.count({ where: { userId: u.id } })).toBe(1);
    });

    it('turns away someone under 18, even with the confirmation', async () => {
      const young = new Date();
      young.setFullYear(young.getFullYear() - 15);
      const u = await user('young', young);
      await expect(service.confirmAge(u.id)).rejects.toBeInstanceOf(ForbiddenException);
      expect((await service.denialFor(u.id))?.code).toBe('UNDERAGE');
    });

    it('lets an adult with a date of birth through', async () => {
      const old = new Date();
      old.setFullYear(old.getFullYear() - 30);
      const u = await user('grown', old);
      await service.confirmAge(u.id);
      expect(await service.denialFor(u.id)).toBeNull();
    });

    it('does not let someone start a second call', async () => {
      const { a } = await startCall();
      await expect(service.assertEligible(a.id)).rejects.toMatchObject({
        response: { code: 'IN_CALL' },
      });
    });
  });

  describe('a call', () => {
    it('opens a two-person room and gives each person a token and the same deck', async () => {
      const { a, b, callId } = await startCall();
      expect(liveKit.createRoom).toHaveBeenCalledWith(
        `rc-${callId}`,
        expect.objectContaining({ maxParticipants: 2 }),
      );
      const forA = eventsFor(a.id, 'rc:matched')[0].payload;
      const forB = eventsFor(b.id, 'rc:matched')[0].payload;
      expect(forA.liveKit.token).toBe('token');
      expect(forA.partner.id).toBe(b.id);
      expect(forB.partner.id).toBe(a.id);
      expect(forA.deck).toEqual(forB.deck);
    });

    it('tells both people and stops if voice is unavailable', async () => {
      liveKit.isAvailable.mockReturnValue(false);
      const a = await adult('a');
      const b = await adult('b');
      const callId = await service.createCall(entryFor(a.id), entryFor(b.id));
      expect(callId).toBeNull();
      expect(eventsFor(a.id, 'rc:error')[0].payload.code).toBe('VOICE_UNAVAILABLE');
      expect(await service.activeCallFor(a.id)).toBeNull();
    });

    it('ends exactly once, even if both people hang up together', async () => {
      const { a, b, callId } = await startCall();
      const results = await Promise.all([
        service.endCall(callId, a.id, 'LEFT'),
        service.endCall(callId, b.id, 'LEFT'),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(eventsFor(a.id, 'rc:ended')).toHaveLength(1);
      expect(eventsFor(b.id, 'rc:ended')).toHaveLength(1);
      expect(liveKit.endRoom).toHaveBeenCalledWith(`rc-${callId}`);
    });

    it('ends calls whose time has run out', async () => {
      const { a, callId } = await startCall();
      await prisma.randomCall.update({
        where: { id: callId },
        data: { endsAt: new Date(Date.now() - 10_000) },
      });
      expect(await service.endOverdueCalls()).toBeGreaterThanOrEqual(1);
      const call = await prisma.randomCall.findUnique({ where: { id: callId } });
      expect(call?.endReason).toBe('COMPLETED');
      expect(eventsFor(a.id, 'rc:ended')[0].payload.reason).toBe('COMPLETED');
    });
  });

  describe('XP for finished calls', () => {
    /** A call that started `secondsAgo` ago, then ended by `a` */
    const endedAfter = async (secondsAgo: number, reason: 'LEFT' | 'REPORTED' = 'LEFT') => {
      const { a, b, callId } = await startCall();
      await prisma.randomCall.update({
        where: { id: callId },
        data: { startedAt: new Date(Date.now() - secondsAgo * 1000) },
      });
      await service.endCall(callId, a.id, reason);
      return { a, b, callId };
    };

    it('rewards both people for a real conversation, 1 XP per 15 seconds', async () => {
      const { a, b } = await endedAfter(120);
      expect(activity.recordActivity).toHaveBeenCalledWith(a.id, 8, 'VOICE_SPEAKING');
      expect(activity.recordActivity).toHaveBeenCalledWith(b.id, 8, 'VOICE_SPEAKING');
      const told = eventsFor(a.id, 'rc:ended')[0].payload;
      expect(told.xp).toBe(8);
      expect(told.seconds).toBeGreaterThanOrEqual(119);
    });

    it('caps a long call at 20 XP', async () => {
      const { a } = await endedAfter(600);
      expect(eventsFor(a.id, 'rc:ended')[0].payload.xp).toBe(20);
    });

    it('gives nothing for a call under a minute', async () => {
      const { a } = await endedAfter(30);
      expect(activity.recordActivity).not.toHaveBeenCalled();
      expect(eventsFor(a.id, 'rc:ended')[0].payload.xp).toBe(0);
    });

    it('gives nothing for a reported call', async () => {
      const { a } = await endedAfter(200, 'REPORTED');
      expect(activity.recordActivity).not.toHaveBeenCalled();
      expect(eventsFor(a.id, 'rc:ended')[0].payload.xp).toBe(0);
    });

    it('stops rewarding after 12 calls in a day', async () => {
      const a = await adult('grinder');
      const partners = await Promise.all(Array.from({ length: 13 }, (_, i) => adult(`p${i}`)));
      for (const partner of partners) {
        await prisma.randomCall.create({
          data: {
            userAId: a.id,
            userBId: partner.id,
            levelA: 'beginner',
            levelB: 'beginner',
            goal: 'casual',
            liveKitRoomId: `rc-x-${partner.id}`,
            endsAt: new Date(),
            endedAt: new Date(),
            endReason: 'COMPLETED',
          },
        });
      }
      expect(await service.awardCallXp(a.id, 120, 'COMPLETED')).toBe(0);
      const fresh = await adult('fresh');
      expect(await service.awardCallXp(fresh.id, 120, 'COMPLETED')).toBe(8);
    });
  });

  describe('extending a call', () => {
    const nearEnd = (callId: string) =>
      prisma.randomCall.update({
        where: { id: callId },
        data: { endsAt: new Date(Date.now() + 60_000) },
      });

    it('only opens in the last 90 seconds', async () => {
      const { a, callId } = await startCall();
      await expect(service.requestExtend(callId, a.id)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('needs both people to agree', async () => {
      const { a, b, callId } = await startCall();
      await nearEnd(callId);
      const before = (await prisma.randomCall.findUnique({ where: { id: callId } }))!.endsAt;

      expect(await service.requestExtend(callId, a.id)).toEqual({ extended: false });
      expect(eventsFor(b.id, 'rc:extend-requested')).toHaveLength(1);
      expect((await prisma.randomCall.findUnique({ where: { id: callId } }))!.endsAt).toEqual(before);

      expect(await service.requestExtend(callId, b.id)).toEqual({ extended: true });
      const after = (await prisma.randomCall.findUnique({ where: { id: callId } }))!;
      expect(after.endsAt.getTime()).toBe(before.getTime() + 5 * 60_000);
      expect(after.extensions).toBe(1);
      expect(eventsFor(a.id, 'rc:extended')).toHaveLength(1);
    });

    it('allows only two extensions', async () => {
      const { a, b, callId } = await startCall();
      for (let i = 0; i < 2; i++) {
        await nearEnd(callId);
        await service.requestExtend(callId, a.id);
        await service.requestExtend(callId, b.id);
      }
      await nearEnd(callId);
      await expect(service.requestExtend(callId, a.id)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('after the call', () => {
    it('only lets the two people rate, and only once it ended', async () => {
      const { a, callId } = await startCall();
      await expect(
        service.rate(callId, a.id, { rating: 5, keepInTouch: false }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const stranger = await adult('stranger');
      await service.endCall(callId, a.id, 'LEFT');
      await expect(
        service.rate(callId, stranger.id, { rating: 5, keepInTouch: false }),
      ).rejects.toThrow('Call not found');
    });

    it('feeds the partner’s reputation, and re-rating does not double count', async () => {
      const { a, b, callId } = await startCall();
      await service.endCall(callId, a.id, 'LEFT');
      await service.rate(callId, a.id, { rating: 5, keepInTouch: false });
      await service.rate(callId, a.id, { rating: 3, keepInTouch: false });
      const profile = await prisma.randomCallProfile.findUnique({ where: { userId: b.id } });
      expect(profile?.ratingCount).toBe(1);
      expect(profile?.ratingSum).toBe(3);
    });

    it('makes friends only when both say keep in touch', async () => {
      const { a, b, callId } = await startCall();
      await service.endCall(callId, a.id, 'LEFT');
      expect((await service.rate(callId, a.id, { rating: 5, keepInTouch: true })).mutualFriend).toBe(false);
      expect(await prisma.friend.count({ where: { OR: [{ fromUserId: a.id }, { toUserId: a.id }] } })).toBe(0);

      expect((await service.rate(callId, b.id, { rating: 4, keepInTouch: true })).mutualFriend).toBe(true);
      expect(
        await prisma.friend.count({
          where: { OR: [{ fromUserId: a.id, toUserId: b.id }, { fromUserId: b.id, toUserId: a.id }] },
        }),
      ).toBe(1);
    });

    it('does not make friends across a block', async () => {
      const { a, b, callId } = await startCall();
      await service.endCall(callId, a.id, 'LEFT');
      await prisma.block.create({ data: { blockerId: a.id, blockedId: b.id } });
      await service.rate(callId, a.id, { rating: 5, keepInTouch: true });
      expect((await service.rate(callId, b.id, { rating: 5, keepInTouch: true })).mutualFriend).toBe(false);
    });

    it('blocking ends the call and records the block', async () => {
      const { a, b, callId } = await startCall();
      await service.block(callId, a.id);
      expect(await prisma.block.count({ where: { blockerId: a.id, blockedId: b.id } })).toBe(1);
      expect((await prisma.randomCall.findUnique({ where: { id: callId } }))?.endedAt).not.toBeNull();
    });
  });

  describe('reports and restrictions', () => {
    /** One call between `reported` and a new reporter, ending in a report */
    const reportFrom = async (reportedId: string, reason = 'HARASSMENT') => {
      const reporter = await adult('reporter');
      const callId = await service.createCall(entryFor(reporter.id), entryFor(reportedId));
      await service.report(callId!, reporter.id, { reason });
      return reporter;
    };

    it('a report ends the call and blocks the person for the reporter', async () => {
      const { a, b, callId } = await startCall();
      await service.report(callId, a.id, { reason: 'SPAM', details: 'ads' });
      const call = await prisma.randomCall.findUnique({ where: { id: callId } });
      expect(call?.endReason).toBe('REPORTED');
      expect(await prisma.block.count({ where: { blockerId: a.id, blockedId: b.id } })).toBe(1);
      expect(await prisma.randomCallReport.count({ where: { reportedId: b.id } })).toBe(1);
    });

    it('rejects an unknown reason', async () => {
      const { a, callId } = await startCall();
      await expect(service.report(callId, a.id, { reason: 'NOPE' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('does not count the same person twice', async () => {
      const bad = await adult('bad');
      const reporter = await adult('reporter');
      for (let i = 0; i < 3; i++) {
        const id = await service.createCall(entryFor(reporter.id), entryFor(bad.id));
        await service.report(id!, reporter.id, { reason: 'HARASSMENT' });
      }
      expect((await service.denialFor(bad.id))).toBeNull();
    });

    it('restricts after three different people report, then escalates', async () => {
      const bad = await adult('bad');
      await reportFrom(bad.id);
      await reportFrom(bad.id);
      expect(await service.denialFor(bad.id)).toBeNull();
      await reportFrom(bad.id);

      const first = await service.denialFor(bad.id);
      expect(first?.code).toBe('RESTRICTED');
      const profile = await prisma.randomCallProfile.findUnique({ where: { userId: bad.id } });
      const days = (profile!.restrictedUntil!.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(2.9);
      expect(days).toBeLessThan(3.1);
      expect(eventsFor(bad.id, 'rc:error').some((e) => e.payload.code === 'RESTRICTED')).toBe(true);

      // second strike: 14 days
      await prisma.randomCallProfile.update({ where: { userId: bad.id }, data: { restrictedUntil: null } });
      await service.evaluateRestriction(bad.id);
      const second = await prisma.randomCallProfile.findUnique({ where: { userId: bad.id } });
      expect(second?.restrictionCount).toBe(2);
      expect((second!.restrictedUntil!.getTime() - Date.now()) / 86_400_000).toBeGreaterThan(13.9);

      // third strike: permanent
      await prisma.randomCallProfile.update({ where: { userId: bad.id }, data: { restrictedUntil: null } });
      await service.evaluateRestriction(bad.id);
      expect((await service.denialFor(bad.id))?.code).toBe('BANNED');
    });

    it('two serious reports are enough', async () => {
      const bad = await adult('bad');
      await reportFrom(bad.id, 'SEXUAL');
      expect(await service.denialFor(bad.id)).toBeNull();
      await reportFrom(bad.id, 'UNDERAGE');
      expect((await service.denialFor(bad.id))?.code).toBe('RESTRICTED');
    });

    it('ignores reports from someone who reports everybody', async () => {
      const bad = await adult('bad');
      const spammer = await adult('spammer');
      // the spammer files many reports today, so theirs stop counting
      const others = await Promise.all(Array.from({ length: 6 }, (_, i) => adult(`o${i}`)));
      for (const other of others) {
        const id = await service.createCall(entryFor(spammer.id), entryFor(other.id));
        await service.report(id!, spammer.id, { reason: 'OTHER' });
      }
      const id = await service.createCall(entryFor(spammer.id), entryFor(bad.id));
      await service.report(id!, spammer.id, { reason: 'HARASSMENT' });
      await reportFrom(bad.id);
      await reportFrom(bad.id);
      expect(await service.denialFor(bad.id)).toBeNull(); // only 2 counted reporters
    });

    it('removes a restricted person from the queue and ends their call', async () => {
      const bad = await adult('bad');
      await queue.add(entryFor(bad.id));
      await reportFrom(bad.id);
      await reportFrom(bad.id);
      await reportFrom(bad.id);
      expect(await queue.has(bad.id)).toBe(false);
    });

    it('lets a moderator dismiss a report so it stops counting, and lift a restriction', async () => {
      const bad = await adult('bad');
      await reportFrom(bad.id);
      await reportFrom(bad.id);
      const [first] = await prisma.randomCallReport.findMany({ where: { reportedId: bad.id } });
      await service.resolveReport(first.id, 'admin', 'DISMISS');
      await reportFrom(bad.id);
      expect(await service.denialFor(bad.id)).toBeNull(); // 2 live reports

      const second = (await prisma.randomCallReport.findMany({ where: { reportedId: bad.id, status: 'PENDING' } }))[0];
      await service.resolveReport(second.id, 'admin', 'UPHOLD');
      expect((await service.denialFor(bad.id))?.code).toBe('RESTRICTED');
      await service.liftRestriction(bad.id);
      expect(await service.denialFor(bad.id)).toBeNull();
    });
  });

  describe('matching inputs', () => {
    it('knows who is blocked in either direction and who was met lately', async () => {
      const a = await adult('a');
      const b = await adult('b');
      const c = await adult('c');
      await prisma.block.create({ data: { blockerId: b.id, blockedId: a.id } });
      const callId = await service.createCall(entryFor(a.id), entryFor(c.id));
      await service.endCall(callId!, a.id, 'LEFT');
      const built = await service.buildEntry(a.id, { level: 'beginner', goal: 'travel', language: 'English' });
      expect(built.blocked).toEqual([b.id]);
      expect(built.recent).toEqual([c.id]);
      expect(built.reputation).toBeNull();
    });

    it('keeps an average rating once there are enough', async () => {
      const a = await adult('a');
      await prisma.randomCallProfile.update({
        where: { userId: a.id },
        data: { ratingSum: 20, ratingCount: 5 },
      });
      const built = await service.buildEntry(a.id, { level: 'beginner', goal: 'travel', language: 'English' });
      expect(built.reputation).toBe(4);
    });
  });
});
