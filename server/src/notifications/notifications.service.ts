import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';

/** Which setting lets a kind of notification through */
export const PREFERENCE_KEYS = ['roomReminders', 'followedLive', 'newFollowers', 'corrections', 'friendRequests', 'achievements', 'challenges'] as const;
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  /** Extra details for the app, such as who did it ({ actor: { id, name, avatarUrl } }) */
  data?: Record<string, unknown>;
  /** The same key never notifies the same person twice ("live:<roomId>") */
  dedupeKey?: string;
  /**
   * With a dedupeKey: instead of staying silent when the same event happens again, the earlier notification
   * is replaced by a fresh, unread one (a new follow after an unfollow shows up again, never twice in the list)
   */
  replace?: boolean;
  /** The setting a person can switch this off with */
  preference?: PreferenceKey;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  data: unknown;
  createdAt: Date;
}

type Emitter = (userId: string, event: string, payload: unknown) => void;

/** Most people one event notifies, so one room going live cannot flood the database */
const MAX_RECIPIENTS = 500;
const PAGE_DEFAULT = 30;
const PAGE_MAX = 100;

const toView = (n: {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  data: Prisma.JsonValue | null;
  createdAt: Date;
}): NotificationView => ({
  id: n.id,
  type: n.type,
  title: n.title,
  message: n.message,
  actionUrl: n.actionUrl,
  isRead: n.isRead,
  data: n.data,
  createdAt: n.createdAt,
});

/**
 * Notifications inside the app: saved so the bell can list them, and pushed live to every open tab through
 * the notifications socket. Other features call `notify`, which never throws, so a notification problem can
 * never break the thing that triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private emit: Emitter | null = null;

  constructor(
    private prisma: PrismaService,
    // Phone and browser push; optional so notifications work (and tests stay simple) without it
    @Optional() private push?: PushService,
  ) {}

  /** Called once by the gateway, with a way to reach a user's open tabs */
  attachEmitter(emit: Emitter) {
    this.emit = emit;
  }

  /** Sends one notification to each of `userIds` who has not switched it off. Returns how many went out. */
  async notify(userIds: Iterable<string>, input: NotifyInput): Promise<number> {
    try {
      let recipients = [...new Set([...userIds].filter(Boolean))].slice(0, MAX_RECIPIENTS);
      if (!recipients.length) return 0;

      if (input.preference) {
        const optedOut = await this.prisma.notificationPreference.findMany({
          where: { userId: { in: recipients }, [input.preference]: false },
          select: { userId: true },
        });
        const off = new Set(optedOut.map((p) => p.userId));
        recipients = recipients.filter((id) => !off.has(id));
      }

      if (input.replace && input.dedupeKey) {
        await this.prisma.notification.deleteMany({ where: { userId: { in: recipients }, dedupeKey: input.dedupeKey } });
      }

      let sent = 0;
      const created: string[] = [];
      for (const userId of recipients) {
        try {
          const row = await this.prisma.notification.create({
            data: {
              userId,
              type: input.type,
              title: input.title.slice(0, 120),
              message: input.message.slice(0, 300),
              actionUrl: input.actionUrl ?? null,
              data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
              dedupeKey: input.dedupeKey ?? null,
            },
          });
          sent++;
          created.push(userId);
          this.emit?.(userId, 'notification:new', toView(row));
        } catch (error) {
          // Already notified about this exact event
          if ((error as { code?: string })?.code === 'P2002') continue;
          throw error;
        }
      }
      // Also reach phones and browsers that are closed. The service worker stays quiet when the app is open.
      if (created.length) {
        // Fire and forget, but never let a rejected push become an unhandled rejection
        void this.push
          ?.sendToUsers(created, {
            title: input.title,
            body: input.message,
            url: input.actionUrl,
            tag: input.dedupeKey ?? input.type,
          })
          .catch((error: Error) => this.logger.warn(`Push for ${input.type} failed: ${error?.message}`));
      }
      return sent;
    } catch (error) {
      this.logger.warn(`Could not send ${input.type} notifications: ${(error as Error)?.message}`);
      return 0;
    }
  }

  async list(userId: string, options: { before?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(Math.floor(options.limit ?? PAGE_DEFAULT) || PAGE_DEFAULT, 1), PAGE_MAX);
    const before = options.before ? new Date(options.before) : null;
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      }),
      this.unreadCount(userId),
    ]);
    return { items: items.slice(0, limit).map(toView), unread, hasMore: items.length > limit };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  /** Marks the given notifications (or all of them) read, and tells the other open tabs */
  async markRead(userId: string, input: { ids?: unknown; all?: unknown }) {
    const ids = Array.isArray(input.ids) ? input.ids.filter((id): id is string => typeof id === 'string').slice(0, 200) : [];
    if (!input.all && !ids.length) throw new BadRequestException('Say which notifications to mark as read');
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false, ...(input.all ? {} : { id: { in: ids } }) },
      data: { isRead: true },
    });
    const unread = await this.unreadCount(userId);
    this.emit?.(userId, 'notification:read', { ids: input.all ? 'all' : ids, unread });
    return { unread };
  }

  async getPreferences(userId: string) {
    const row = await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {} });
    return Object.fromEntries(PREFERENCE_KEYS.map((k) => [k, row[k]])) as Record<PreferenceKey, boolean>;
  }

  async updatePreferences(userId: string, input: Record<string, unknown>) {
    const changes: Partial<Record<PreferenceKey, boolean>> = {};
    for (const key of PREFERENCE_KEYS) if (typeof input[key] === 'boolean') changes[key] = input[key] as boolean;
    if (!Object.keys(changes).length) throw new BadRequestException('Nothing to change');
    await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...changes }, update: changes });
    return this.getPreferences(userId);
  }
}
