import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { DEFAULT_REMINDER_TIME, localParts, parseTime, reminderDue, reminderText } from './daily-reminder.engine';
import { NotificationsService } from './notifications.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import type { PackLevel } from '../vocab-packs/packs.content';
import { wordOfDay } from '../vocab-packs/word-of-day';

const TICK_MS = 5 * 60 * 1000;
/** Most people checked in one pass */
const MAX_USERS = 2000;

/**
 * Sends the daily practice reminder at the time each person chose in Settings (on their own clock), to people
 * who turned the daily reminder on, have push set up and have not practised yet today. It goes through
 * `notify`, so it also shows in the bell, and the dedupe key keeps it to one a day.
 */
@Injectable()
export class DailyReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyReminderService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass: remind everyone it is due for. Returns how many people were reminded. */
  async tick(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const subscribed = await this.prisma.pushSubscription.findMany({ distinct: ['userId'], select: { userId: true }, take: MAX_USERS });
      const ids = subscribed.map((s) => s.userId);
      if (!ids.length) return 0;

      const [settings, profiles, streaks] = await Promise.all([
        this.prisma.settings.findMany({
          where: { userId: { in: ids } },
          select: { userId: true, dailyReminderEnabled: true, dailyReminderTime: true, pushNotifications: true },
        }),
        this.prisma.profile.findMany({ where: { userId: { in: ids } }, select: { userId: true, timezone: true, level: true } }),
        this.prisma.streak.findMany({ where: { userId: { in: ids } } }),
      ]);
      const settingsOf = new Map(settings.map((s) => [s.userId, s]));
      const zoneOf = new Map(profiles.map((p) => [p.userId, p.timezone]));
      const levelOf = new Map(profiles.map((p) => [p.userId, p.level]));
      const streakOf = new Map(streaks.map((s) => [s.userId, s]));

      let reminded = 0;
      for (const userId of ids) {
        // People without a settings row get the defaults: reminder on, 20:00
        const s = settingsOf.get(userId);
        if (s && (s.dailyReminderEnabled === false || s.pushNotifications === false)) continue;
        const target = parseTime(s?.dailyReminderTime) ?? parseTime(DEFAULT_REMINDER_TIME)!;
        const zone = zoneOf.get(userId);
        const streak = streakOf.get(userId) ?? null;
        const here = localParts(now, zone);
        const lastPracticeDay = streak ? localParts(streak.lastActivityDate, zone).day : null;
        if (!reminderDue(here, target, lastPracticeDay)) continue;

        // The same word the dashboard shows them today
        const word = wordOfDay(practiceLevel(levelOf.get(userId)) as PackLevel, here.day);
        const { title, message } = reminderText(ActivityService.effectiveStreak(streak).current, word);
        const sent = await this.notifications.notify([userId], {
          type: 'REMINDER',
          title,
          message,
          actionUrl: '/dashboard',
          data: { kind: 'daily-reminder', word: word.word },
          dedupeKey: `daily:${here.day}`,
        });
        reminded += sent;
      }
      return reminded;
    } catch (error) {
      this.logger.warn(`Daily reminder pass failed: ${(error as Error)?.message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
