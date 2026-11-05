import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ActivityService } from '../learning/activity.service';
import { PrismaService } from '../prisma.service';
import { LiveKitService } from '../voice/livekit.service';
import { buildDeck } from './conversation-cards';
import { MatchQueue } from './match-queue';
import { QueueEntry, sharedInterests } from './matching';
import { RandomCallBroadcaster } from './random-call.broadcaster';
import {
  CALL_SECONDS,
  EXTEND_SECONDS,
  Goal,
  Level,
  MAX_COUNTED_REPORTS_PER_DAY,
  MAX_EXTENSIONS,
  RECENT_PARTNER_WINDOW_MS,
  XP_MAX_CALLS_PER_DAY,
  XP_MAX_PER_CALL,
  XP_MIN_CALL_SECONDS,
  XP_PER_15_SECONDS,
  REPORT_REASONS,
  REPORTS_TO_RESTRICT,
  REPORTS_TO_RESTRICT_SEVERE,
  RESTRICTION_DAYS,
  SEVERE_REASONS,
  levelIndex,
} from './random-call.constants';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Ratings from others needed before reputation is used for matching */
const MIN_RATINGS_FOR_REPUTATION = 5;

export type CallEndReason = 'COMPLETED' | 'LEFT' | 'REPORTED' | 'DISCONNECTED';

type Denial =
  | 'BANNED'
  | 'RESTRICTED'
  | 'UNDERAGE'
  | 'NEEDS_CONSENT'
  | 'ACCOUNT_TOO_NEW'
  | 'IN_CALL';

const deny = (code: Denial, message: string) =>
  new ForbiddenException({ code, message });

@Injectable()
export class RandomCallService {
  private readonly logger = new Logger(RandomCallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly liveKit: LiveKitService,
    private readonly queue: MatchQueue,
    private readonly broadcaster: RandomCallBroadcaster,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  // ==========================
  // ELIGIBILITY
  // ==========================

  private async ensureProfile(userId: string) {
    try {
      return await this.prisma.randomCallProfile.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
    } catch (error) {
      // Two requests creating the same first-time row at once: the loser reads it
      if ((error as { code?: string })?.code === 'P2002' || /Unique/i.test(String(error))) {
        return this.prisma.randomCallProfile.findUniqueOrThrow({ where: { userId } });
      }
      throw error;
    }
  }

  private async isUnderage(userId: string): Promise<boolean> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { dateOfBirth: true },
    });
    if (!profile?.dateOfBirth) return false;
    const eighteen = new Date(profile.dateOfBirth);
    eighteen.setFullYear(eighteen.getFullYear() + 18);
    return eighteen.getTime() > Date.now();
  }

  /** Why this person cannot use random calls right now, or null if they can */
  async denialFor(userId: string): Promise<{ code: Denial; message: string } | null> {
    const [profile, user, underage] = await Promise.all([
      this.ensureProfile(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      }),
      this.isUnderage(userId),
    ]);
    if (underage) {
      return { code: 'UNDERAGE', message: 'Random calls are for people aged 18 and over.' };
    }
    if (profile.permanentlyBanned) {
      return { code: 'BANNED', message: 'You can no longer use random calls.' };
    }
    if (profile.restrictedUntil && profile.restrictedUntil.getTime() > Date.now()) {
      return {
        code: 'RESTRICTED',
        message: `Random calls are paused for you until ${profile.restrictedUntil.toISOString()}.`,
      };
    }
    const minAgeMinutes = Number(
      this.config.get<string>('RANDOM_CALL_MIN_ACCOUNT_AGE_MINUTES') ?? 0,
    );
    if (
      minAgeMinutes > 0 &&
      user &&
      Date.now() - user.createdAt.getTime() < minAgeMinutes * 60_000
    ) {
      return {
        code: 'ACCOUNT_TOO_NEW',
        message: 'New accounts can use random calls a little later.',
      };
    }
    if (!profile.ageConfirmedAt) {
      return { code: 'NEEDS_CONSENT', message: 'Please confirm you are 18 or older.' };
    }
    return null;
  }

  async assertEligible(userId: string) {
    const denial = await this.denialFor(userId);
    if (denial) throw deny(denial.code, denial.message);
    if (await this.activeCallFor(userId)) {
      throw deny('IN_CALL', 'You are already in a call.');
    }
  }

  async confirmAge(userId: string) {
    if (await this.isUnderage(userId)) {
      throw deny('UNDERAGE', 'Random calls are for people aged 18 and over.');
    }
    await this.prisma.randomCallProfile.upsert({
      where: { userId },
      create: { userId, ageConfirmedAt: new Date() },
      update: { ageConfirmedAt: new Date() },
    });
  }

  async getStatus(userId: string) {
    const [profile, denial, active, waiting] = await Promise.all([
      this.ensureProfile(userId),
      this.denialFor(userId),
      this.activeCallFor(userId),
      this.queue.size(),
    ]);
    return {
      eligible: !denial,
      denial,
      needsConsent: denial?.code === 'NEEDS_CONSENT',
      restrictedUntil: profile.restrictedUntil,
      callsCount: profile.callsCount,
      reputation:
        profile.ratingCount > 0
          ? {
              average: Math.round((profile.ratingSum / profile.ratingCount) * 10) / 10,
              count: profile.ratingCount,
            }
          : null,
      waiting,
      activeCallId: active?.id ?? null,
    };
  }

  // ==========================
  // QUEUE ENTRY
  // ==========================

  async buildEntry(
    userId: string,
    prefs: { level: Level; goal: Goal; language: string },
  ): Promise<QueueEntry> {
    const since = new Date(Date.now() - RECENT_PARTNER_WINDOW_MS);
    const [blocks, recentCalls, profile, learner, goodCalls] = await Promise.all([
      this.prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
        take: 1000,
      }),
      this.prisma.randomCall.findMany({
        where: {
          startedAt: { gte: since },
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        select: { userAId: true, userBId: true },
        take: 50,
      }),
      this.ensureProfile(userId),
      this.prisma.profile.findUnique({ where: { userId }, select: { interests: true } }),
      // Calls this person rated 4 or 5: those partners get a small preference next time
      this.prisma.randomCallRating.findMany({
        where: { raterId: userId, rating: { gte: 4 } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { call: { select: { userAId: true, userBId: true } } },
      }),
    ]);
    const other = (a: string, b: string) => (a === userId ? b : a);
    return {
      userId,
      level: prefs.level,
      goal: prefs.goal,
      language: prefs.language,
      joinedAt: Date.now(),
      blocked: [...new Set(blocks.map((b) => other(b.blockerId, b.blockedId)))],
      recent: [...new Set(recentCalls.map((c) => other(c.userAId, c.userBId)))],
      reputation:
        profile.ratingCount >= MIN_RATINGS_FOR_REPUTATION
          ? profile.ratingSum / profile.ratingCount
          : null,
      interests: (learner?.interests ?? []).map((i) => i.trim().toLowerCase()).filter(Boolean).slice(0, 20),
      liked: [...new Set(goodCalls.map((r) => other(r.call.userAId, r.call.userBId)))],
    };
  }

  // ==========================
  // CALL LIFECYCLE
  // ==========================

  activeCallFor(userId: string) {
    return this.prisma.randomCall.findFirst({
      where: {
        endedAt: null,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });
  }

  /** Creates the call and LiveKit room for two matched people and tells both */
  async createCall(a: QueueEntry, b: QueueEntry): Promise<string | null> {
    const id = randomUUID();
    const room = `rc-${id}`;

    try {
      if (!this.liveKit.isAvailable()) throw new Error('LiveKit is not available');
      await this.liveKit.createRoom(room, {
        name: room,
        maxParticipants: 2,
        emptyTimeout: 60,
        departureTimeout: 30,
      });
    } catch (error) {
      this.logger.error(`Could not open a call room: ${(error as Error).message}`);
      for (const entry of [a, b]) {
        this.broadcaster.emitToUser(entry.userId, 'rc:error', {
          code: 'VOICE_UNAVAILABLE',
          message: 'Voice calls are unavailable right now. Please try again soon.',
        });
      }
      return null;
    }

    const call = await this.prisma.randomCall.create({
      data: {
        id,
        userAId: a.userId,
        userBId: b.userId,
        language: a.language,
        levelA: a.level,
        levelB: b.level,
        // the person who waited longest (a) gets their goal
        goal: a.goal,
        liveKitRoomId: room,
        endsAt: new Date(Date.now() + CALL_SECONDS * 1000),
      },
    });

    try {
      await Promise.all([
        this.sendMatched(call, a.userId),
        this.sendMatched(call, b.userId),
      ]);
    } catch (error) {
      this.logger.error(`Could not hand out call tokens: ${(error as Error).message}`);
      await this.endCall(call.id, null, 'DISCONNECTED');
      return null;
    }
    return call.id;
  }

  /** The payload a client needs to join (or rejoin) a call */
  async buildCallPayload(
    call: NonNullable<Awaited<ReturnType<RandomCallService['activeCallFor']>>>,
    userId: string,
  ) {
    const partnerId = call.userAId === userId ? call.userBId : call.userAId;
    const [partner, mine] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          profile: { select: { country: true, nativeLanguage: true, interests: true } },
        },
      }),
      this.prisma.profile.findUnique({ where: { userId }, select: { interests: true } }),
    ]);
    const token = await this.liveKit.getParticipantToken(call.liveKitRoomId, userId);
    const partnerLevel = call.userAId === userId ? call.levelB : call.levelA;
    const myLevel = call.userAId === userId ? call.levelA : call.levelB;
    const lower = (
      levelIndex(myLevel as Level) <= levelIndex(partnerLevel as Level)
        ? myLevel
        : partnerLevel
    ) as Level;
    return {
      callId: call.id,
      serverNow: Date.now(),
      startedAt: call.startedAt.toISOString(),
      endsAt: call.endsAt.toISOString(),
      extensions: call.extensions,
      maxExtensions: MAX_EXTENSIONS,
      goal: call.goal,
      language: call.language,
      level: myLevel,
      partner: {
        id: partnerId,
        name: partner?.name ?? 'Someone',
        avatarUrl: partner?.avatarUrl ?? null,
        country: partner?.profile?.country ?? null,
        nativeLanguage: partner?.profile?.nativeLanguage ?? null,
        level: partnerLevel,
        sharedInterests: sharedInterests(mine?.interests, partner?.profile?.interests),
      },
      deck: buildDeck(call.id, call.goal as Goal, lower),
      liveKit: {
        url: this.liveKit.getWebSocketUrl() || 'ws://localhost:18080',
        token,
        room: call.liveKitRoomId,
      },
    };
  }

  private async sendMatched(
    call: NonNullable<Awaited<ReturnType<RandomCallService['activeCallFor']>>>,
    userId: string,
  ) {
    this.broadcaster.emitToUser(userId, 'rc:matched', await this.buildCallPayload(call, userId));
  }

  /** Ends a call once (a second end is a no-op) and tells both people */
  async endCall(callId: string, endedById: string | null, reason: CallEndReason) {
    const result = await this.prisma.randomCall.updateMany({
      where: { id: callId, endedAt: null },
      data: { endedAt: new Date(), endedById, endReason: reason },
    });
    if (result.count === 0) return null;

    this.broadcaster.notifyCallEnded?.(callId);

    const call = await this.prisma.randomCall.findUnique({ where: { id: callId } });
    if (!call) return null;

    const seconds = call.endedAt
      ? Math.round((call.endedAt.getTime() - call.startedAt.getTime()) / 1000)
      : 0;
    for (const userId of [call.userAId, call.userBId]) {
      const xp = await this.awardCallXp(userId, seconds, reason);
      this.broadcaster.emitToUser(userId, 'rc:ended', {
        callId,
        reason,
        endedByYou: endedById === userId,
        endedAt: call.endedAt?.toISOString(),
        seconds,
        xp,
      });
      await this.prisma.randomCallProfile
        .upsert({
          where: { userId },
          create: { userId, callsCount: 1 },
          update: { callsCount: { increment: 1 } },
        })
        .catch(() => undefined);
    }
    this.liveKit.endRoom(call.liveKitRoomId).catch((error) => {
      this.logger.debug(`LiveKit room ${call.liveKitRoomId} already gone: ${error?.message}`);
    });
    return call;
  }

  /**
   * XP for a real conversation: 1 per 15 seconds (up to 20) for calls of a
   * minute or more, not for reported calls, and for a limited number of calls
   * a day. Also keeps the daily streak going.
   */
  async awardCallXp(userId: string, seconds: number, reason: CallEndReason): Promise<number> {
    if (reason === 'REPORTED' || seconds < XP_MIN_CALL_SECONDS) return 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = await this.prisma.randomCall.count({
      where: {
        endedAt: { gte: startOfDay },
        endReason: { not: 'REPORTED' },
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });
    // this call is already counted in `today`
    if (today > XP_MAX_CALLS_PER_DAY) return 0;
    const xp = Math.min(XP_MAX_PER_CALL, Math.floor(seconds / 15) * XP_PER_15_SECONDS);
    await this.activity.recordActivity(userId, xp, 'VOICE_SPEAKING');
    return xp;
  }

  /** Ends calls whose time ran out (also covers an instance that restarted mid-call) */
  async endOverdueCalls() {
    const overdue = await this.prisma.randomCall.findMany({
      where: { endedAt: null, endsAt: { lt: new Date(Date.now() - 1500) } },
      select: { id: true },
      take: 50,
    });
    for (const { id } of overdue) await this.endCall(id, null, 'COMPLETED');
    return overdue.length;
  }

  async getParticipantCall(callId: string, userId: string) {
    const call = await this.prisma.randomCall.findUnique({ where: { id: callId } });
    if (!call || (call.userAId !== userId && call.userBId !== userId)) {
      throw new NotFoundException('Call not found');
    }
    return call;
  }

  partnerOf(call: { userAId: string; userBId: string }, userId: string) {
    return call.userAId === userId ? call.userBId : call.userAId;
  }

  /** Both people agree to keep talking: the call gets more time */
  async requestExtend(callId: string, userId: string) {
    const call = await this.getParticipantCall(callId, userId);
    if (call.endedAt) throw new BadRequestException('The call has ended');
    if (call.extensions >= MAX_EXTENSIONS) {
      throw new BadRequestException('This call cannot be extended again');
    }
    if (call.endsAt.getTime() - Date.now() > 90_000) {
      throw new BadRequestException('You can extend in the last 90 seconds');
    }

    const isA = call.userAId === userId;
    await this.prisma.randomCall.updateMany({
      where: { id: callId, endedAt: null },
      data: isA ? { extendA: true } : { extendB: true },
    });
    const fresh = await this.prisma.randomCall.findUnique({ where: { id: callId } });
    if (!fresh || fresh.endedAt) throw new BadRequestException('The call has ended');

    if (fresh.extendA && fresh.extendB) {
      const bumped = await this.prisma.randomCall.updateMany({
        where: {
          id: callId,
          endedAt: null,
          extensions: fresh.extensions,
          extendA: true,
          extendB: true,
        },
        data: {
          endsAt: new Date(fresh.endsAt.getTime() + EXTEND_SECONDS * 1000),
          extensions: { increment: 1 },
          extendA: false,
          extendB: false,
        },
      });
      if (bumped.count === 1) {
        const after = await this.prisma.randomCall.findUnique({ where: { id: callId } });
        for (const id of [fresh.userAId, fresh.userBId]) {
          this.broadcaster.emitToUser(id, 'rc:extended', {
            callId,
            endsAt: after?.endsAt.toISOString(),
            extensions: after?.extensions,
          });
        }
        return { extended: true };
      }
    }
    this.broadcaster.emitToUser(this.partnerOf(fresh, userId), 'rc:extend-requested', { callId });
    return { extended: false };
  }

  // ==========================
  // AFTER THE CALL
  // ==========================

  async rate(
    callId: string,
    userId: string,
    input: { rating: number; keepInTouch: boolean; talkSeconds?: number },
  ) {
    const call = await this.getParticipantCall(callId, userId);
    if (!call.endedAt) throw new BadRequestException('Rate the call once it has ended');
    const partnerId = this.partnerOf(call, userId);

    const previous = await this.prisma.randomCallRating.findUnique({
      where: { callId_raterId: { callId, raterId: userId } },
    });
    await this.prisma.randomCallRating.upsert({
      where: { callId_raterId: { callId, raterId: userId } },
      create: { callId, raterId: userId, rating: input.rating, keepInTouch: input.keepInTouch },
      update: { rating: input.rating, keepInTouch: input.keepInTouch },
    });

    // The rating is about the partner: it feeds *their* reputation
    await this.prisma.randomCallProfile.upsert({
      where: { userId: partnerId },
      create: { userId: partnerId, ratingSum: input.rating, ratingCount: 1 },
      update: {
        ratingSum: { increment: input.rating - (previous?.rating ?? 0) },
        ratingCount: { increment: previous ? 0 : 1 },
      },
    });

    if (typeof input.talkSeconds === 'number') {
      const seconds = Math.max(0, Math.min(3600, Math.round(input.talkSeconds)));
      await this.prisma.randomCall.update({
        where: { id: callId },
        data: call.userAId === userId ? { talkSecondsA: seconds } : { talkSecondsB: seconds },
      });
    }

    let mutualFriend = false;
    if (input.keepInTouch) {
      const theirs = await this.prisma.randomCallRating.findUnique({
        where: { callId_raterId: { callId, raterId: partnerId } },
      });
      if (theirs?.keepInTouch) mutualFriend = await this.ensureFriends(userId, partnerId);
    }
    return { ok: true, mutualFriend };
  }

  /** Friendship only when both said "keep in touch", and nobody blocked anyone */
  private async ensureFriends(a: string, b: string): Promise<boolean> {
    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });
    if (blocked) return false;
    const existing = await this.prisma.friend.findFirst({
      where: {
        OR: [
          { fromUserId: a, toUserId: b },
          { fromUserId: b, toUserId: a },
        ],
      },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.friend.create({
        data: { fromUserId: a, toUserId: b, status: 'ACCEPTED' },
      });
    }
    return true;
  }

  async block(callId: string, userId: string) {
    const call = await this.getParticipantCall(callId, userId);
    const partnerId = this.partnerOf(call, userId);
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: partnerId } },
      create: { blockerId: userId, blockedId: partnerId, reason: 'random-call' },
      update: {},
    });
    await this.endCall(callId, userId, 'LEFT');
    return { ok: true };
  }

  async report(
    callId: string,
    reporterId: string,
    input: { reason: string; details?: string },
  ) {
    if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) {
      throw new BadRequestException('Unknown report reason');
    }
    const call = await this.getParticipantCall(callId, reporterId);
    const reportedId = this.partnerOf(call, reporterId);

    const existing = await this.prisma.randomCallReport.findFirst({
      where: { callId, reporterId },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.randomCallReport.create({
        data: {
          callId,
          reporterId,
          reportedId,
          reason: input.reason,
          details: input.details?.slice(0, 1000),
        },
      });
    }

    // Reporting also blocks: they never meet again
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: reporterId, blockedId: reportedId } },
      create: { blockerId: reporterId, blockedId: reportedId, reason: `random-call:${input.reason}` },
      update: {},
    });
    await this.endCall(callId, reporterId, 'REPORTED');
    await this.evaluateRestriction(reportedId);
    return { ok: true };
  }

  /**
   * Restricts someone once enough *different* people reported them recently.
   * People who report a lot stop counting, so the report button cannot be
   * used to get someone banned.
   */
  async evaluateRestriction(reportedId: string): Promise<boolean> {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const reports = await this.prisma.randomCallReport.findMany({
      where: { reportedId, createdAt: { gte: since }, status: { not: 'DISMISSED' } },
      select: { reporterId: true, reason: true },
    });
    if (reports.length === 0) return false;

    const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
    const dayAgo = new Date(Date.now() - DAY_MS);
    const recent = await this.prisma.randomCallReport.groupBy({
      by: ['reporterId'],
      where: { reporterId: { in: reporterIds }, createdAt: { gte: dayAgo } },
      _count: { _all: true },
    });
    const heavy = new Set(
      recent.filter((r) => r._count._all > MAX_COUNTED_REPORTS_PER_DAY).map((r) => r.reporterId),
    );
    const counted = reports.filter((r) => !heavy.has(r.reporterId));
    const distinct = new Set(counted.map((r) => r.reporterId)).size;
    const severe = counted.some((r) => SEVERE_REASONS.has(r.reason));
    const threshold = severe ? REPORTS_TO_RESTRICT_SEVERE : REPORTS_TO_RESTRICT;
    if (distinct < threshold) return false;
    return this.applyRestriction(reportedId, severe ? 'Serious reports from several people' : 'Reports from several people');
  }

  /** 3 days, then 14 days, then permanent. Returns false if already restricted */
  async applyRestriction(userId: string, reason: string): Promise<boolean> {
    const profile = await this.ensureProfile(userId);
    const active =
      profile.permanentlyBanned ||
      (profile.restrictedUntil && profile.restrictedUntil.getTime() > Date.now());
    if (active) return false;

    const count = profile.restrictionCount + 1;
    const days = RESTRICTION_DAYS[count - 1];
    await this.prisma.randomCallProfile.update({
      where: { userId },
      data: {
        restrictionCount: count,
        restrictionReason: reason,
        ...(days === undefined
          ? { permanentlyBanned: true, restrictedUntil: null }
          : { restrictedUntil: new Date(Date.now() + days * DAY_MS) }),
      },
    });

    await this.queue.claim(userId);
    const active_ = await this.activeCallFor(userId);
    if (active_) await this.endCall(active_.id, null, 'DISCONNECTED');
    this.broadcaster.emitToUser(userId, 'rc:error', {
      code: days === undefined ? 'BANNED' : 'RESTRICTED',
      message: 'Random calls are paused for your account after reports from other people.',
    });
    this.logger.warn(`Random calls restricted for ${userId} (strike ${count}): ${reason}`);
    return true;
  }

  // ==========================
  // HISTORY + ADMIN
  // ==========================

  async history(userId: string) {
    const calls = await this.prisma.randomCall.findMany({
      where: {
        endedAt: { not: null },
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: {
        userA: { select: { id: true, name: true, avatarUrl: true } },
        userB: { select: { id: true, name: true, avatarUrl: true } },
        ratings: { where: { raterId: userId }, select: { rating: true, keepInTouch: true } },
      },
    });
    return calls.map((call) => {
      const mine = call.userAId === userId;
      return {
        id: call.id,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        endReason: call.endReason,
        goal: call.goal,
        seconds: call.endedAt
          ? Math.round((call.endedAt.getTime() - call.startedAt.getTime()) / 1000)
          : 0,
        yourTalkSeconds: mine ? call.talkSecondsA : call.talkSecondsB,
        partner: mine ? call.userB : call.userA,
        yourRating: call.ratings[0]?.rating ?? null,
        keptInTouch: call.ratings[0]?.keepInTouch ?? false,
      };
    });
  }

  isAdmin(userId: string): boolean {
    const ids = (this.config.get<string>('RANDOM_CALL_ADMIN_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return ids.includes(userId);
  }

  listReports(status = 'PENDING') {
    return this.prisma.randomCallReport.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reporter: { select: { id: true, name: true } },
        reported: { select: { id: true, name: true } },
      },
    });
  }

  async resolveReport(reportId: string, adminId: string, action: 'UPHOLD' | 'DISMISS') {
    const report = await this.prisma.randomCallReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    await this.prisma.randomCallReport.update({
      where: { id: reportId },
      data: {
        status: action === 'UPHOLD' ? 'UPHELD' : 'DISMISSED',
        reviewedById: adminId,
      },
    });
    if (action === 'UPHOLD') {
      await this.applyRestriction(report.reportedId, `Report upheld by a moderator (${report.reason})`);
    }
    return { ok: true };
  }

  async liftRestriction(userId: string) {
    await this.prisma.randomCallProfile.upsert({
      where: { userId },
      create: { userId },
      update: { restrictedUntil: null, permanentlyBanned: false, restrictionReason: null },
    });
    return { ok: true };
  }

}
