import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowService } from './follow.service';

/** How long before the start "starting soon" goes out */
export const REMINDER_LEAD_MS = 10 * 60 * 1000;
const TICK_MS = 60 * 1000;
/** Rooms stay in "upcoming" for a little while after their start time, in case the host is late */
const UPCOMING_GRACE_MS = 15 * 60 * 1000;
const UPCOMING_LIMIT = 30;

interface RoomLike {
  id: string;
  name: string;
  type: string;
  creatorId: string;
  scheduledFor?: Date | null;
}

const when = (date: Date) =>
  date.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Scheduled rooms: "Remind me", the upcoming list, the "starting soon" reminder, and telling followers and
 * interested people when a room is scheduled or goes live. The hooks never throw, so rooms work without them.
 */
@Injectable()
export class RoomRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomRemindersService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private follows: FollowService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** May this person see the room (private rooms: only the host and the people invited) */
  private async canSee(userId: string, room: { id: string; type: string; creatorId: string }) {
    if (room.type !== 'PRIVATE' || room.creatorId === userId) return true;
    const invited = await this.prisma.voiceParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
      select: { id: true },
    });
    return !!invited;
  }

  async setInterest(userId: string, roomId: string, interested: boolean) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      select: { id: true, type: true, creatorId: true, status: true, scheduledFor: true },
    });
    if (!room || !(await this.canSee(userId, room))) throw new NotFoundException('Room not found');
    if (interested) {
      if (room.status === 'ENDED' || room.status === 'CANCELLED') throw new BadRequestException('This room is over');
      if (!room.scheduledFor) throw new BadRequestException('Only scheduled rooms can send a reminder');
      await this.prisma.voiceRoomInterest.upsert({
        where: { roomId_userId: { roomId, userId } },
        create: { roomId, userId },
        update: {},
      });
    } else {
      await this.prisma.voiceRoomInterest.deleteMany({ where: { roomId, userId } });
    }
    const count = await this.prisma.voiceRoomInterest.count({ where: { roomId } });
    return { roomId, interested, count };
  }

  /** For the lobby's room cards: how many people want a reminder, and whether you do */
  async interestsFor(userId: string, roomIds: string[]) {
    const ids = [...new Set(roomIds)].slice(0, 100);
    if (!ids.length) return {};
    const [counts, mine] = await Promise.all([
      this.prisma.voiceRoomInterest.groupBy({ by: ['roomId'], where: { roomId: { in: ids } }, _count: { _all: true } }),
      this.prisma.voiceRoomInterest.findMany({ where: { userId, roomId: { in: ids } }, select: { roomId: true } }),
    ]);
    const mineSet = new Set(mine.map((m) => m.roomId));
    return Object.fromEntries(
      ids.map((id) => [id, { count: counts.find((c) => c.roomId === id)?._count._all ?? 0, mine: mineSet.has(id) }]),
    );
  }

  /** Rooms starting soon that you can see, soonest first, with who is hosting and whether you follow them */
  async upcoming(userId: string) {
    const now = Date.now();
    const rooms = await this.prisma.voiceRoom.findMany({
      where: {
        status: 'WAITING',
        scheduledFor: { gte: new Date(now - UPCOMING_GRACE_MS) },
        OR: [{ type: { not: 'PRIVATE' } }, { creatorId: userId }, { participants: { some: { userId } } }],
      },
      orderBy: { scheduledFor: 'asc' },
      take: UPCOMING_LIMIT,
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        language: true,
        topics: true,
        scheduledFor: true,
        creatorId: true,
        creator: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { interests: true } },
      },
    });
    const ids = rooms.map((r) => r.id);
    const [mine, followed] = await Promise.all([
      this.prisma.voiceRoomInterest.findMany({ where: { userId, roomId: { in: ids } }, select: { roomId: true } }),
      this.prisma.follow.findMany({
        where: { followerId: userId, followingId: { in: [...new Set(rooms.map((r) => r.creatorId))] } },
        select: { followingId: true },
      }),
    ]);
    const mineSet = new Set(mine.map((m) => m.roomId));
    const followedSet = new Set(followed.map((f) => f.followingId));
    return rooms.map(({ _count, ...room }) => ({
      ...room,
      interestedCount: _count.interests,
      interested: mineSet.has(room.id),
      followingHost: followedSet.has(room.creatorId),
      isHost: room.creatorId === userId,
    }));
  }

  /** A room was scheduled: tell the host's followers */
  async onRoomScheduled(room: RoomLike) {
    try {
      if (room.type === 'PRIVATE' || !room.scheduledFor || room.scheduledFor.getTime() <= Date.now()) return;
      const [host, followers] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: room.creatorId }, select: { id: true, name: true, avatarUrl: true } }),
        this.follows.followerIds(room.creatorId),
      ]);
      await this.notifications.notify(followers, {
        type: 'ROOM_SCHEDULED',
        title: `${host?.name ?? 'Someone you follow'} scheduled a room`,
        message: `“${room.name}” · ${when(room.scheduledFor)}`,
        actionUrl: '/voice',
        data: { actor: host, roomId: room.id, scheduledFor: room.scheduledFor },
        dedupeKey: `scheduled:${room.id}`,
        preference: 'followedLive',
      });
    } catch (error) {
      this.logger.warn(`Could not tell followers about a scheduled room: ${(error as Error)?.message}`);
    }
  }

  /** A room just went live: tell the people who asked for a reminder, and the host's followers */
  async onRoomLive(room: RoomLike) {
    try {
      if (room.type === 'PRIVATE') return;
      const [host, interested, followers, inRoom] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: room.creatorId }, select: { id: true, name: true, avatarUrl: true } }),
        this.prisma.voiceRoomInterest.findMany({ where: { roomId: room.id }, select: { userId: true } }),
        this.follows.followerIds(room.creatorId),
        this.prisma.voiceParticipant.findMany({ where: { roomId: room.id, leftAt: null }, select: { userId: true } }),
      ]);
      const skip = new Set([room.creatorId, ...inRoom.map((p) => p.userId)]);
      const interestedIds = interested.map((i) => i.userId).filter((id) => !skip.has(id));
      const followerIds = followers.filter((id) => !skip.has(id) && !interestedIds.includes(id));
      const base = {
        type: 'ROOM_LIVE' as const,
        title: `${host?.name ?? 'A room'} is live now`,
        message: `“${room.name}” has started. Jump in!`,
        actionUrl: `/voice/${room.id}`,
        data: { actor: host, roomId: room.id },
        dedupeKey: `live:${room.id}`,
      };
      await this.notifications.notify(interestedIds, { ...base, preference: 'roomReminders' });
      await this.notifications.notify(followerIds, { ...base, preference: 'followedLive' });
    } catch (error) {
      this.logger.warn(`Could not announce a live room: ${(error as Error)?.message}`);
    }
  }

  /** Sends "starting soon" for rooms that start within the next 10 minutes (once per room) */
  async sendDueReminders(now = new Date()) {
    const rooms = await this.prisma.voiceRoom.findMany({
      where: {
        status: 'WAITING',
        reminderSentAt: null,
        scheduledFor: { gt: new Date(now.getTime() - 60 * 1000), lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
      },
      select: { id: true, name: true, creatorId: true, scheduledFor: true },
      take: 50,
    });
    let sent = 0;
    for (const room of rooms) {
      // Claim the room first, so two server instances never both send the reminder
      const { count } = await this.prisma.voiceRoom.updateMany({
        where: { id: room.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (!count) continue;
      const interested = await this.prisma.voiceRoomInterest.findMany({ where: { roomId: room.id }, select: { userId: true } });
      const minutes = Math.max(1, Math.round(((room.scheduledFor as Date).getTime() - now.getTime()) / 60000));
      sent += await this.notifications.notify([room.creatorId, ...interested.map((i) => i.userId)], {
        type: 'ROOM_REMINDER',
        title: `Starting in ${minutes} minute${minutes === 1 ? '' : 's'}`,
        message: `“${room.name}” is about to begin.`,
        actionUrl: `/voice/${room.id}`,
        data: { roomId: room.id, scheduledFor: room.scheduledFor },
        dedupeKey: `reminder:${room.id}`,
        preference: 'roomReminders',
      });
    }
    return sent;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendDueReminders();
    } catch (error) {
      this.logger.warn(`Room reminder tick failed: ${(error as Error)?.message}`);
    } finally {
      this.running = false;
    }
  }
}
