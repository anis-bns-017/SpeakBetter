import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { dayIn, isTimeZone, learnerZone, startOfDayKey } from '../common/learner-day';
import { ActivityService } from '../learning/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadgesService } from '../gamification/badges.service';
import { planStreak } from '../insights/plan.engine';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import {
  CHALLENGE_LEVELS,
  isChallengeLevel,
  PROMPT_BY_ID,
  promptFor,
  scoreAnswer,
  type AnswerStats,
  type ChallengeLevel,
} from './challenge.prompts';

export const CHALLENGE_XP = 10;
export const REACTIONS = ['👏', '❤️', '🔥', '💡'] as const;
const FEED_LIMIT = 40;
const MIN_SECONDS = 5;
const MAX_SECONDS = 300;
const MAX_TRANSCRIPT = 5000;

const userSelect = { id: true, name: true, avatarUrl: true } as const;

/** Answers play in other people's browsers, so only files uploaded through this app are accepted */
export function isOwnUpload(url: string, cloud = process.env.CLOUDINARY_CLOUD_NAME): boolean {
  if (url.length > 500) return false;
  const base = cloud ? `https://res.cloudinary.com/${cloud}/` : 'https://res.cloudinary.com/';
  return url.startsWith(base) && /\/(video|raw|image)\/upload\//.test(url);
}

type EntryRow = Prisma.ChallengeEntryGetPayload<{ include: { user: { select: typeof userSelect }; reactions: { select: { emoji: true; userId: true } } } }>;

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private notifications: NotificationsService,
    // Badges for answering; optional so the challenge works (and tests stay simple) without it
    @Optional() private badges?: BadgesService,
  ) {}

  private view(entry: EntryRow, viewerId: string) {
    const prompt = PROMPT_BY_ID.get(entry.promptId);
    const counts: Record<string, number> = {};
    for (const r of entry.reactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    const stats = entry.stats as unknown as AnswerStats;
    return {
      id: entry.id,
      user: entry.user,
      level: entry.level,
      promptId: entry.promptId,
      promptTitle: prompt?.title ?? 'Daily challenge',
      audioUrl: entry.audioUrl,
      transcript: entry.transcript,
      durationSec: entry.durationSec,
      visibility: entry.visibility,
      stats,
      reactions: counts,
      totalReactions: entry.reactions.length,
      myReaction: entry.reactions.find((r) => r.userId === viewerId)?.emoji ?? null,
      isMine: entry.userId === viewerId,
      createdAt: entry.createdAt,
    };
  }

  /** Today's prompt for your level (or the one asked for), your answer, and everyone's public answers today */
  async today(userId: string, requested?: unknown) {
    const now = new Date();
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true, timezone: true } });
    const day = dayIn(now, isTimeZone(profile?.timezone) ? profile?.timezone : undefined);
    const ownLevel = practiceLevel(profile?.level) as ChallengeLevel;
    const level: ChallengeLevel = isChallengeLevel(requested) ? requested : ownLevel;
    const prompt = promptFor(level, day);
    const include = { user: { select: userSelect }, reactions: { select: { emoji: true, userId: true } } } as const;

    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const hidden = blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));

    const [mine, feed, days, total] = await Promise.all([
      this.prisma.challengeEntry.findUnique({ where: { userId_day: { userId, day } }, include }),
      this.prisma.challengeEntry.findMany({
        where: { day, visibility: 'public', userId: { notIn: [userId, ...hidden] } },
        include,
        orderBy: { createdAt: 'desc' },
        take: FEED_LIMIT,
      }),
      this.prisma.challengeEntry.findMany({ where: { userId }, select: { day: true }, orderBy: { day: 'desc' }, take: 120 }),
      this.prisma.challengeEntry.count({ where: { userId } }),
    ]);

    return {
      day,
      level,
      ownLevel,
      prompt,
      // Every level's prompt today, so you can try a harder (or easier) one
      levels: CHALLENGE_LEVELS.map((l) => ({ level: l, title: promptFor(l, day).title })),
      mine: mine ? this.view(mine, userId) : null,
      // Most cheered first, then the newest
      feed: feed
        .map((e) => this.view(e, userId))
        .sort((a, b) => b.totalReactions - a.totalReactions || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      streak: planStreak(days.map((d) => d.day), day),
      total,
      reactions: REACTIONS,
    };
  }

  /** Saves today's answer (recording again replaces it). The first answer of the day earns XP. */
  async submit(
    userId: string,
    input: { promptId?: unknown; audioUrl?: unknown; transcript?: unknown; durationSec?: unknown; visibility?: unknown },
  ) {
    const now = new Date();
    const zone = await learnerZone(this.prisma, userId);
    const day = dayIn(now, zone);
    const prompt = typeof input.promptId === 'string' ? PROMPT_BY_ID.get(input.promptId) : undefined;
    if (!prompt || promptFor(prompt.level, day).id !== prompt.id) {
      throw new BadRequestException("That isn't one of today's challenges");
    }
    const audioUrl = typeof input.audioUrl === 'string' ? input.audioUrl.trim() : '';
    if (!audioUrl || !isOwnUpload(audioUrl)) {
      throw new BadRequestException('Record your answer first');
    }
    const durationSec = Math.round(Number(input.durationSec));
    if (!Number.isFinite(durationSec) || durationSec < MIN_SECONDS || durationSec > MAX_SECONDS) {
      throw new BadRequestException(`Answers can be ${MIN_SECONDS} to ${MAX_SECONDS} seconds long`);
    }
    const transcript = typeof input.transcript === 'string' ? input.transcript.replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSCRIPT) : '';
    const visibility = input.visibility === 'private' ? 'private' : 'public';
    const stats = scoreAnswer(prompt, transcript, durationSec);

    const existing = await this.prisma.challengeEntry.findUnique({ where: { userId_day: { userId, day } }, select: { id: true } });
    const data = {
      promptId: prompt.id,
      level: prompt.level,
      audioUrl,
      transcript,
      durationSec,
      visibility,
      stats: stats as unknown as Prisma.InputJsonValue,
    };
    let replaced = !!existing;
    if (!existing) {
      try {
        await this.prisma.challengeEntry.create({ data: { userId, day, ...data } });
      } catch (error) {
        // Sent twice at once: the other request made today's answer, so this one replaces it
        if ((error as { code?: string })?.code !== 'P2002') throw error;
        replaced = true;
      }
    }
    if (replaced) {
      // A new recording is a new answer: reactions to the old one no longer apply
      const current = existing ?? (await this.prisma.challengeEntry.findUnique({ where: { userId_day: { userId, day } }, select: { id: true } }));
      if (current) {
        await this.prisma.challengeReaction.deleteMany({ where: { entryId: current.id } });
        await this.prisma.challengeEntry.update({ where: { id: current.id }, data });
      }
    }
    // Once a day, even if the answer was deleted and recorded again
    let xp = 0;
    if (!replaced) {
      const paid = await this.prisma.xpTransaction.count({
        where: { userId, reason: 'CHALLENGE_COMPLETED', createdAt: { gte: startOfDayKey(day, zone) } },
      });
      if (!paid) {
        xp = CHALLENGE_XP;
        await this.activity.recordActivity(userId, CHALLENGE_XP, 'CHALLENGE_COMPLETED');
      }
    }
    void this.badges?.evaluate(userId);

    const entry = await this.prisma.challengeEntry.findUnique({
      where: { userId_day: { userId, day } },
      include: { user: { select: userSelect }, reactions: { select: { emoji: true, userId: true } } },
    });
    return { entry: entry ? this.view(entry, userId) : null, firstToday: !replaced, xp };
  }

  async removeMine(userId: string) {
    const day = dayIn(new Date(), await learnerZone(this.prisma, userId));
    const { count } = await this.prisma.challengeEntry.deleteMany({ where: { userId, day } });
    if (!count) throw new NotFoundException("You haven't answered today's challenge");
    return { ok: true };
  }

  /** Reacts to someone's answer (null takes the reaction back). The author hears about the first one from you. */
  async react(userId: string, entryId: string, emoji: unknown) {
    const entry = await this.prisma.challengeEntry.findUnique({ where: { id: entryId }, select: { id: true, userId: true, visibility: true, promptId: true } });
    if (!entry || entry.visibility !== 'public') throw new NotFoundException('Answer not found');
    if (entry.userId === userId) throw new ForbiddenException("You can't react to your own answer");
    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: entry.userId },
          { blockerId: entry.userId, blockedId: userId },
        ],
      },
      select: { id: true },
    });
    if (blocked) throw new NotFoundException('Answer not found');

    if (emoji === null || emoji === undefined || emoji === '') {
      await this.prisma.challengeReaction.deleteMany({ where: { entryId, userId } });
    } else {
      if (!(REACTIONS as readonly string[]).includes(emoji as string)) throw new BadRequestException('Unknown reaction');
      await this.prisma.challengeReaction.upsert({
        where: { entryId_userId: { entryId, userId } },
        create: { entryId, userId, emoji: emoji as string },
        update: { emoji: emoji as string },
      });
      const reactor = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
      void this.notifications.notify([entry.userId], {
        type: 'CHALLENGE_REACTION',
        title: `${reactor?.name ?? 'Someone'} reacted ${emoji} to your answer`,
        message: `“${PROMPT_BY_ID.get(entry.promptId)?.title ?? 'Daily challenge'}”`,
        actionUrl: '/challenge',
        data: { actor: reactor, entryId, emoji },
        dedupeKey: `challenge-react:${entryId}:${userId}`,
        preference: 'challenges',
      });
      void this.badges?.evaluate(entry.userId);
    }

    const reactions = await this.prisma.challengeReaction.findMany({ where: { entryId }, select: { emoji: true, userId: true } });
    const counts: Record<string, number> = {};
    for (const r of reactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    return { entryId, reactions: counts, totalReactions: reactions.length, myReaction: reactions.find((r) => r.userId === userId)?.emoji ?? null };
  }
}
