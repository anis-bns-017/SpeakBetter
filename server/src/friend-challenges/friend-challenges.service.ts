import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../learning/activity.service';
import { LESSON_BY_ID } from '../grammar/grammar.content';
import { PACK_BY_ID } from '../vocab-packs/packs.content';

export type ChallengeKind = 'grammar' | 'pack' | 'dictation';
export type ChallengeStatus = 'OPEN' | 'BEATEN' | 'HELD' | 'TIED' | 'EXPIRED';

/** How long a friend has to answer a challenge */
export const CHALLENGE_HOURS = 72;
/** XP for beating a friend's score */
export const BEAT_XP = 5;

/** What each kind of challenge is about, and where to go to take it */
export const KINDS: Record<ChallengeKind, { title: (refId: string) => string | null; url: (refId: string) => string }> = {
  grammar: { title: (id) => LESSON_BY_ID.get(id)?.title ?? null, url: (id) => `/grammar/${id}` },
  pack: { title: (id) => PACK_BY_ID.get(id)?.title ?? null, url: (id) => `/packs/${id}` },
  dictation: { title: (id) => (id === 'dictation' ? 'Listening dictation' : null), url: () => '/dictation' },
};

export const isKind = (value: unknown): value is ChallengeKind => typeof value === 'string' && value in KINDS;

/** Who did better, comparing shares so 5/6 and 80/100 can be compared */
export function outcome(challenger: { score: number; total: number }, response: { score: number; total: number }): 'BEATEN' | 'HELD' | 'TIED' {
  const a = challenger.total > 0 ? challenger.score / challenger.total : 0;
  const b = response.total > 0 ? response.score / response.total : 0;
  if (Math.abs(a - b) < 1e-9) return 'TIED';
  return b > a ? 'BEATEN' : 'HELD';
}

const fmt = (score: number, total: number, kind: ChallengeKind) => (kind === 'dictation' ? `${score}%` : `${score}/${total}`);

@Injectable()
export class FriendChallengesService {
  private readonly logger = new Logger(FriendChallengesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activity: ActivityService,
  ) {}

  /** The challenger's own result to beat, read from what they saved (never from the request) */
  private async myScore(userId: string, kind: ChallengeKind, refId: string): Promise<{ score: number; total: number } | null> {
    if (kind === 'grammar') {
      const p = await this.prisma.grammarProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: refId } } });
      return p && p.total > 0 ? { score: p.bestScore, total: p.total } : null;
    }
    if (kind === 'pack') {
      const p = await this.prisma.vocabPackProgress.findUnique({ where: { userId_packId: { userId, packId: refId } } });
      return p && p.total > 0 ? { score: p.bestScore, total: p.total } : null;
    }
    const last = await this.prisma.dictationResult.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { score: true } });
    return last ? { score: last.score, total: 100 } : null;
  }

  /** Challenges a friend to beat your best on a lesson, a pack quiz or a dictation */
  async create(userId: string, input: { friendId?: unknown; kind?: unknown; refId?: unknown }, now = new Date()) {
    const friendId = typeof input.friendId === 'string' ? input.friendId : '';
    if (!isKind(input.kind)) throw new BadRequestException('Say what the challenge is about');
    const kind = input.kind;
    const refId = typeof input.refId === 'string' ? input.refId : '';
    const title = KINDS[kind].title(refId);
    if (!title) throw new NotFoundException('That activity does not exist');
    if (!friendId || friendId === userId) throw new BadRequestException('Pick a friend to challenge');

    const friendship = await this.prisma.friend.findFirst({
      where: { status: 'ACCEPTED', OR: [{ fromUserId: userId, toUserId: friendId }, { fromUserId: friendId, toUserId: userId }] },
      select: { id: true },
    });
    if (!friendship) throw new ForbiddenException('You can only challenge your friends');

    const mine = await this.myScore(userId, kind, refId);
    if (!mine) throw new BadRequestException('Finish it yourself first, then challenge a friend');

    // One open challenge per friend and activity: sending again just returns it
    const open = await this.prisma.friendChallenge.findFirst({
      where: { fromUserId: userId, toUserId: friendId, kind, refId, status: 'OPEN', expiresAt: { gt: now } },
    });
    if (open) return { id: open.id, created: false };

    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, avatarUrl: true } });
    const row = await this.prisma.friendChallenge.create({
      data: {
        fromUserId: userId,
        toUserId: friendId,
        kind,
        refId,
        title,
        score: mine.score,
        total: mine.total,
        expiresAt: new Date(now.getTime() + CHALLENGE_HOURS * 3_600_000),
      },
    });
    void this.notifications.notify([friendId], {
      type: 'FRIEND_CHALLENGE',
      title: `${me?.name ?? 'A friend'} challenged you`,
      message: `Beat ${fmt(mine.score, mine.total, kind)} on ${title}. You have 3 days.`,
      actionUrl: KINDS[kind].url(refId),
      data: { actor: me, challengeId: row.id },
      dedupeKey: `friend-challenge:${row.id}`,
      preference: 'challenges',
    });
    return { id: row.id, created: true };
  }

  /** Challenges you got and challenges you sent, newest first, open ones first */
  async list(userId: string, now = new Date()) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendChallenge.findMany({
        where: { toUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { fromUser: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      this.prisma.friendChallenge.findMany({
        where: { fromUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { toUser: { select: { id: true, name: true, avatarUrl: true } } },
      }),
    ]);
    const view = (c: (typeof incoming)[number] | (typeof outgoing)[number], person: { id: string; name: string; avatarUrl: string | null }) => {
      const kind = c.kind as ChallengeKind;
      const status: ChallengeStatus = c.status === 'OPEN' && c.expiresAt <= now ? 'EXPIRED' : (c.status as ChallengeStatus);
      return {
        id: c.id,
        kind,
        title: c.title,
        url: KINDS[kind]?.url(c.refId) ?? '/dashboard',
        person,
        score: c.score,
        total: c.total,
        responseScore: c.responseScore,
        responseTotal: c.responseTotal,
        status,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
      };
    };
    const openFirst = <T extends { status: ChallengeStatus }>(list: T[]) => [...list.filter((c) => c.status === 'OPEN'), ...list.filter((c) => c.status !== 'OPEN')];
    return {
      incoming: openFirst(incoming.map((c) => view(c, c.fromUser))),
      outgoing: openFirst(outgoing.map((c) => view(c, c.toUser))),
    };
  }

  /**
   * Settles any open challenges a friend sent you for this activity, now that you have a score. Tells the
   * challenger how it went. Never throws: a challenge problem must not break finishing a lesson.
   */
  async resolve(userId: string, kind: ChallengeKind, refId: string, score: number, total: number, now = new Date()) {
    try {
      const open = await this.prisma.friendChallenge.findMany({
        where: { toUserId: userId, kind, refId, status: 'OPEN', expiresAt: { gt: now } },
        include: { fromUser: { select: { id: true, name: true } } },
      });
      if (!open.length) return [];
      const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, avatarUrl: true } });

      const results: Array<{ id: string; from: string; status: 'BEATEN' | 'HELD' | 'TIED'; theirs: string; yours: string }> = [];
      let beatAny = false;
      for (const c of open) {
        const status = outcome({ score: c.score, total: c.total }, { score, total });
        // Only the first answer counts: a challenge is settled once
        const { count } = await this.prisma.friendChallenge.updateMany({
          where: { id: c.id, status: 'OPEN' },
          data: { status, responseScore: score, responseTotal: total, respondedAt: now },
        });
        if (!count) continue;
        if (status === 'BEATEN') beatAny = true;
        const theirs = fmt(c.score, c.total, kind);
        const yours = fmt(score, total, kind);
        results.push({ id: c.id, from: c.fromUser.name, status, theirs, yours });

        const name = me?.name ?? 'Your friend';
        void this.notifications.notify([c.fromUserId], {
          type: 'FRIEND_CHALLENGE',
          title: status === 'BEATEN' ? `${name} beat your score` : status === 'TIED' ? `${name} tied with you` : `You kept your lead over ${name}`,
          message: `${c.title}: ${name} got ${yours}, you had ${theirs}.${status === 'BEATEN' ? ' Time for a rematch?' : ''}`,
          actionUrl: KINDS[kind].url(refId),
          data: { actor: me, challengeId: c.id },
          dedupeKey: `friend-challenge-result:${c.id}`,
          preference: 'challenges',
        });
      }
      if (beatAny) await this.activity.recordActivity(userId, BEAT_XP, 'BONUS');
      return results;
    } catch (error) {
      this.logger.warn(`Could not settle challenges for ${userId}: ${(error as Error)?.message}`);
      return [];
    }
  }
}
