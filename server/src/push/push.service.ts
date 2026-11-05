import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  /** The page of the app to open when the notification is tapped */
  url?: string;
  /** A notification with the same tag replaces the one before it instead of stacking */
  tag?: string;
}

export interface SubscribeInput {
  endpoint: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
}

/** Most devices (browsers, phones) one person can have; the oldest go first */
export const MAX_DEVICES = 10;
const MAX_ENDPOINT_LENGTH = 2000;
const MAX_KEY_LENGTH = 200;
/** A push that cannot be delivered for a day is not worth delivering */
const TTL_SECONDS = 24 * 60 * 60;

export const isValidTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/**
 * Phone and browser notifications through the Web Push standard: free, no third-party account, works in
 * Chrome, Edge, Firefox and Safari (iPhone only after the app is added to the home screen). Without
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in the environment push is switched off and every
 * method still works, it just does nothing.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private ready = false;
  private key: string | null = null;

  constructor(private prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (publicKey && privateKey && subject) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.ready = true;
        this.key = publicKey;
      } catch (error) {
        this.logger.warn(`Push is off: the VAPID settings are not valid (${(error as Error)?.message})`);
      }
    } else {
      this.logger.warn('Push is off: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT to turn it on');
    }
  }

  get enabled(): boolean {
    return this.ready;
  }

  /** The public key the browser needs to subscribe, or null when push is off */
  publicKey(): string | null {
    return this.key;
  }

  async status(userId: string) {
    const devices = await this.prisma.pushSubscription.count({ where: { userId } });
    return { enabled: this.ready, devices };
  }

  /** Saves this browser's subscription for the person; the same browser (endpoint) never counts twice */
  async subscribe(userId: string, input: SubscribeInput, options: { userAgent?: string; timezone?: unknown } = {}) {
    const endpoint = input.endpoint;
    const p256dh = input.keys?.p256dh;
    const auth = input.keys?.auth;
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > MAX_ENDPOINT_LENGTH) {
      throw new BadRequestException('That is not a valid push subscription');
    }
    if (typeof p256dh !== 'string' || typeof auth !== 'string' || !p256dh || !auth || p256dh.length > MAX_KEY_LENGTH || auth.length > MAX_KEY_LENGTH) {
      throw new BadRequestException('That is not a valid push subscription');
    }

    const data = { userId, p256dh, auth, userAgent: options.userAgent?.slice(0, 300) ?? null, lastSeenAt: new Date() };
    await this.prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });

    // Keep the newest devices
    const all = await this.prisma.pushSubscription.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' }, select: { id: true } });
    if (all.length > MAX_DEVICES) {
      await this.prisma.pushSubscription.deleteMany({ where: { id: { in: all.slice(MAX_DEVICES).map((s) => s.id) } } });
    }

    // The daily reminder is sent at their local time, so remember their time zone when we do not know it yet
    if (isValidTimeZone(options.timezone)) {
      await this.prisma.profile.updateMany({ where: { userId, timezone: null }, data: { timezone: options.timezone } });
    }
    return this.status(userId);
  }

  async unsubscribe(userId: string, endpoint: unknown) {
    if (typeof endpoint !== 'string' || !endpoint) throw new BadRequestException('Say which subscription to remove');
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return this.status(userId);
  }

  /** Pushes to everything each person has subscribed, unless they switched push off. Never throws. Returns how many devices it reached. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
    if (!this.ready || !userIds.length) return 0;
    try {
      const [subs, off] = await Promise.all([
        this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } }),
        this.prisma.settings.findMany({ where: { userId: { in: userIds }, pushNotifications: false }, select: { userId: true } }),
      ]);
      const muted = new Set(off.map((s) => s.userId));
      const targets = subs.filter((s) => !muted.has(s.userId));
      if (!targets.length) return 0;

      const body = JSON.stringify({
        title: payload.title.slice(0, 120),
        body: payload.body.slice(0, 300),
        url: payload.url ?? '/dashboard',
        tag: payload.tag,
      });
      const results = await Promise.allSettled(
        targets.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: TTL_SECONDS })),
      );

      // The browser says a subscription is gone (404 or 410): forget it
      const gone: string[] = [];
      let delivered = 0;
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          delivered++;
        } else {
          const status = (result.reason as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) gone.push(targets[i].id);
          else this.logger.warn(`A push did not go out (${status ?? 'no status'}): ${(result.reason as Error)?.message}`);
        }
      });
      if (gone.length) await this.prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
      return delivered;
    } catch (error) {
      this.logger.warn(`Could not send push notifications: ${(error as Error)?.message}`);
      return 0;
    }
  }

  sendToUser(userId: string, payload: PushPayload): Promise<number> {
    return this.sendToUsers([userId], payload);
  }
}
