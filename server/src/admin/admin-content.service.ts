// server/src/admin/admin-content.service.ts
// What people make and share, for the team: voice rooms (close one that goes wrong), communities (hide or bring
// back), single messages (remove), announcements to many people at once, and the billing picture.

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { LiveKitService } from '../voice/livekit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminAuditService } from './admin-audit.service';
import type { Actor } from './admin.roles';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 25;
/** notify() takes at most 500 people per call */
const BATCH = 500;
/** An announcement reaches at most this many people (a safety net against a mistaken "everyone") */
const MAX_AUDIENCE = 50_000;

export type Audience = 'all' | 'active7' | 'active30' | 'pro' | 'free' | 'staff';

const reasonOf = (value: unknown) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  if (text.length < 3) throw new BadRequestException('Write a reason (at least 3 characters)');
  return text;
};

@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AdminAuditService,
    private livekit: LiveKitService,
    private notifications: NotificationsService,
  ) {}

  // ---------------- voice rooms ----------------

  async rooms(query: { state?: string; q?: string; page?: number }) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const live = query.state !== 'ended';
    const q = (query.q ?? '').trim().slice(0, 80);
    const where: Prisma.VoiceRoomWhereInput = {
      status: live ? { in: ['WAITING', 'ACTIVE'] } : { in: ['ENDED', 'CANCELLED'] },
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { creator: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.voiceRoom.findMany({
        where,
        orderBy: live ? { createdAt: 'desc' } : { endedAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: {
          id: true,
          name: true,
          status: true,
          language: true,
          topics: true,
          maxParticipants: true,
          createdAt: true,
          startedAt: true,
          endedAt: true,
          creator: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { participants: { where: { leftAt: null } }, messages: true } },
        },
      }),
      this.prisma.voiceRoom.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);
    const reports = ids.length
      ? await this.prisma.report.count({ where: { targetType: 'MESSAGE', description: { startsWith: 'Voice room ' }, status: { in: ['PENDING', 'REVIEWING'] } } })
      : 0;
    return {
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      total,
      openRoomReports: reports,
      items: rows.map(({ _count, ...r }) => ({ ...r, inRoom: _count.participants, messages: _count.messages })),
    };
  }

  /** Ends a room for everyone, now */
  async closeRoom(actor: Actor, id: string, reason: unknown) {
    const why = reasonOf(reason);
    const room = await this.prisma.voiceRoom.findUnique({ where: { id }, select: { id: true, name: true, status: true, liveKitRoomId: true, creatorId: true } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === 'ENDED' || room.status === 'CANCELLED') throw new BadRequestException('This room has already ended');
    await this.prisma.voiceRoom.update({ where: { id }, data: { status: 'ENDED', endedAt: new Date() } });
    await this.prisma.voiceParticipant.updateMany({ where: { roomId: id, leftAt: null }, data: { leftAt: new Date() } });
    if (room.liveKitRoomId) {
      try {
        await this.livekit.endRoom(room.liveKitRoomId);
      } catch (error) {
        this.logger.warn(`Could not end the LiveKit room ${room.liveKitRoomId}: ${(error as Error)?.message}`);
      }
    }
    await this.notifications.notify([room.creatorId], {
      type: 'SYSTEM',
      title: 'Your room was closed by a moderator',
      message: `“${room.name}” was closed: ${why}`,
    });
    await this.audit.record(actor, { action: 'room.close', targetType: 'room', targetId: id, summary: `Closed the voice room “${room.name}”: ${why}` });
    return { ok: true };
  }

  // ---------------- communities ----------------

  async communities(query: { state?: string; q?: string; page?: number }) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const q = (query.q ?? '').trim().slice(0, 80);
    const where: Prisma.CommunityWhereInput = {
      ...(query.state === 'hidden' ? { hiddenAt: { not: null } } : query.state === 'visible' ? { hiddenAt: null } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { owner: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.community.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          avatarUrl: true,
          hiddenAt: true,
          hiddenReason: true,
          createdAt: true,
          owner: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { members: true, messages: true, channels: true } },
        },
      }),
      this.prisma.community.count({ where }),
    ]);
    return {
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      total,
      items: rows.map(({ _count, ...c }) => ({ ...c, members: _count.members, messages: _count.messages, channels: _count.channels })),
    };
  }

  async setCommunityHidden(actor: Actor, id: string, hidden: boolean, reason: unknown) {
    const community = await this.prisma.community.findUnique({ where: { id }, select: { id: true, name: true, hiddenAt: true, ownerId: true } });
    if (!community) throw new NotFoundException('Community not found');
    if (hidden) {
      const why = reasonOf(reason);
      if (community.hiddenAt) throw new BadRequestException('This community is already hidden');
      await this.prisma.community.update({ where: { id }, data: { hiddenAt: new Date(), hiddenReason: why } });
      await this.notifications.notify([community.ownerId], {
        type: 'SYSTEM',
        title: 'Your community was hidden by a moderator',
        message: `“${community.name}” is hidden: ${why}`,
      });
      await this.audit.record(actor, { action: 'community.hide', targetType: 'community', targetId: id, summary: `Hid the community “${community.name}”: ${why}` });
    } else {
      if (!community.hiddenAt) throw new BadRequestException('This community is not hidden');
      await this.prisma.community.update({ where: { id }, data: { hiddenAt: null, hiddenReason: null } });
      await this.audit.record(actor, { action: 'community.unhide', targetType: 'community', targetId: id, summary: `Brought back the community “${community.name}”` });
    }
    return { ok: true };
  }

  // ---------------- messages ----------------

  /**
   * Removes one message. Chat and community messages are marked deleted (they show as removed); voice room
   * messages have no such mark, so they are deleted. Either way the text is kept in the audit log.
   */
  async deleteMessage(actor: Actor, kind: string, id: string, reason: unknown) {
    const why = reasonOf(reason);
    if (kind === 'room-message') {
      const message = await this.prisma.voiceRoomMessage.findUnique({ where: { id }, include: { sender: { select: { id: true, name: true } } } });
      if (!message) throw new NotFoundException('Message not found');
      await this.prisma.voiceRoomMessage.delete({ where: { id } });
      await this.audit.record(actor, {
        action: 'message.delete',
        targetType: 'room-message',
        targetId: id,
        summary: `Removed a voice room message by ${message.sender.name}: ${why}`,
        details: { content: message.content, senderId: message.sender.id, roomId: message.roomId },
      });
      return { ok: true };
    }
    if (kind !== 'message') throw new BadRequestException('Unknown message kind');
    const message = await this.prisma.message.findUnique({ where: { id }, include: { sender: { select: { id: true, name: true } } } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.isDeleted) return { ok: true, alreadyDeleted: true };
    await this.prisma.message.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    await this.audit.record(actor, {
      action: 'message.delete',
      targetType: 'message',
      targetId: id,
      summary: `Removed a message by ${message.sender.name}: ${why}`,
      details: { content: message.content, senderId: message.sender.id, chatId: message.chatId, communityId: message.communityId },
    });
    return { ok: true };
  }

  // ---------------- announcements ----------------

  private audienceWhere(audience: Audience): Prisma.UserWhereInput {
    const now = new Date();
    const notSuspended: Prisma.UserWhereInput = { OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: now } }] };
    const pro: Prisma.SubscriptionWhereInput = { plan: 'PRO', status: { in: ['ACTIVE', 'TRIALING'] }, OR: [{ endDate: null }, { endDate: { gt: now } }] };
    switch (audience) {
      case 'active7':
        return { AND: [notSuspended, { profile: { lastActive: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }] };
      case 'active30':
        return { AND: [notSuspended, { profile: { lastActive: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }] };
      case 'pro':
        return { AND: [notSuspended, { subscriptions: { some: pro } }] };
      case 'free':
        return { AND: [notSuspended, { subscriptions: { none: pro } }] };
      case 'staff':
        return { role: { in: ['MODERATOR', 'ADMIN'] } };
      default:
        return notSuspended;
    }
  }

  async audienceSizes() {
    const audiences: Audience[] = ['all', 'active7', 'active30', 'pro', 'free', 'staff'];
    const counts = await Promise.all(audiences.map((a) => this.prisma.user.count({ where: this.audienceWhere(a) })));
    return Object.fromEntries(audiences.map((a, i) => [a, counts[i]])) as Record<Audience, number>;
  }

  /** Sends one announcement (in the bell, and as a push where it is on) to everyone in `audience` */
  async broadcast(actor: Actor, input: { title?: unknown; message?: unknown; link?: unknown; audience?: unknown }) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Only admins can send announcements');
    const title = typeof input.title === 'string' ? input.title.trim().slice(0, 80) : '';
    const message = typeof input.message === 'string' ? input.message.trim().slice(0, 400) : '';
    if (title.length < 3 || message.length < 3) throw new BadRequestException('Write a title and a message');
    const link = typeof input.link === 'string' && input.link.trim() ? input.link.trim() : undefined;
    if (link && !/^\/[\w\-/?=&#.%]*$/.test(link)) throw new BadRequestException('The link must be a page inside the app, like /library');
    const audience = (['all', 'active7', 'active30', 'pro', 'free', 'staff'].includes(String(input.audience)) ? input.audience : 'all') as Audience;

    const recipients = await this.prisma.user.findMany({ where: this.audienceWhere(audience), select: { id: true }, take: MAX_AUDIENCE });
    let sent = 0;
    const stamp = Date.now();
    for (let i = 0; i < recipients.length; i += BATCH) {
      sent += await this.notifications.notify(
        recipients.slice(i, i + BATCH).map((r) => r.id),
        { type: 'SYSTEM', title, message, actionUrl: link, data: { kind: 'announcement' }, dedupeKey: `announce:${stamp}` },
      );
    }
    await this.audit.record(actor, {
      action: 'broadcast.send',
      targetType: 'audience',
      targetId: audience,
      summary: `Sent “${title}” to ${sent} ${sent === 1 ? 'person' : 'people'} (${audience})`,
      details: { title, message, link: link ?? null, audience, recipients: recipients.length, sent },
    });
    return { ok: true, recipients: recipients.length, sent };
  }

  async announcements() {
    return this.prisma.adminAuditLog.findMany({ where: { action: 'broadcast.send' }, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  // ---------------- billing ----------------

  async billing(query: { page?: number }) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const activePro: Prisma.SubscriptionWhereInput = { plan: 'PRO', status: { in: ['ACTIVE', 'TRIALING'] }, OR: [{ endDate: null }, { endDate: { gt: now } }] };
    const [pro, byProvider, revenueAll, revenue30, failed30, payments, paymentsTotal, subscriptions] = await Promise.all([
      this.prisma.subscription.count({ where: activePro }),
      this.prisma.subscription.groupBy({ by: ['provider'], where: activePro, _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: since30 } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: since30 } } }),
      this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: { id: true, amount: true, currency: true, status: true, method: true, plan: true, interval: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.payment.count(),
      this.prisma.subscription.findMany({
        where: activePro,
        orderBy: { endDate: 'asc' },
        take: 50,
        select: { id: true, plan: true, status: true, interval: true, provider: true, startDate: true, endDate: true, cancelAtPeriodEnd: true, user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    return {
      totals: {
        activePro: pro,
        byProvider: byProvider.map((p) => ({ provider: p.provider ?? 'unknown', count: p._count._all })),
        revenueAll: revenueAll._sum.amount ?? 0,
        paymentsAll: revenueAll._count._all,
        revenue30: revenue30._sum.amount ?? 0,
        payments30: revenue30._count._all,
        failed30,
      },
      payments: { page, pages: Math.max(1, Math.ceil(paymentsTotal / PAGE)), total: paymentsTotal, items: payments },
      subscriptions,
    };
  }
}
