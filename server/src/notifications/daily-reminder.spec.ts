import { DEFAULT_REMINDER_TIME, REMINDER_WINDOW_MINUTES, localParts, parseTime, reminderDue, reminderText } from './daily-reminder.engine';
import { DailyReminderService } from './daily-reminder.service';
import { wordOfDay } from '../vocab-packs/word-of-day';

describe('daily reminder engine', () => {
  it('works out the date and time on someone else\'s clock', () => {
    // 2026-11-05 18:30 UTC is 00:30 the next morning in Dhaka (UTC+6) and 13:30 in New York (UTC-5)
    const at = new Date(Date.UTC(2026, 10, 5, 18, 30));
    expect(localParts(at, 'UTC')).toEqual({ day: '2026-11-05', minutes: 18 * 60 + 30 });
    expect(localParts(at, 'Asia/Dhaka')).toEqual({ day: '2026-11-06', minutes: 30 });
    expect(localParts(at, 'America/New_York')).toEqual({ day: '2026-11-05', minutes: 13 * 60 + 30 });
  });

  it('falls back to the server clock for a missing or unknown time zone', () => {
    const at = new Date(Date.UTC(2026, 10, 5, 12, 0));
    expect(localParts(at, null)).toEqual(localParts(at));
    expect(localParts(at, 'Not/AZone')).toEqual(localParts(at));
  });

  it('reads times of day', () => {
    expect(parseTime('20:00')).toBe(1200);
    expect(parseTime('7:05')).toBe(425);
    expect(parseTime('23:59')).toBe(1439);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('8pm')).toBeNull();
    expect(parseTime(undefined)).toBeNull();
    expect(parseTime(DEFAULT_REMINDER_TIME)).toBe(1200);
  });

  it('is due from the chosen time for the length of the window, once you have not practised today', () => {
    const day = '2026-11-05';
    expect(reminderDue({ day, minutes: 1199 }, 1200, null)).toBe(false);
    expect(reminderDue({ day, minutes: 1200 }, 1200, null)).toBe(true);
    expect(reminderDue({ day, minutes: 1200 + REMINDER_WINDOW_MINUTES - 1 }, 1200, '2026-11-04')).toBe(true);
    expect(reminderDue({ day, minutes: 1200 + REMINDER_WINDOW_MINUTES }, 1200, null)).toBe(false);
    // Already practised today: no nagging
    expect(reminderDue({ day, minutes: 1230 }, 1200, day)).toBe(false);
  });

  it('puts the streak first when there is one to lose', () => {
    expect(reminderText(7).title).toBe('Keep your 7-day streak going');
    expect(reminderText(1).title).toBe('Time to practise English');
    expect(reminderText(0).title).toBe('Time to practise English');
  });

  it('teaches today\'s word in the message when there is one', () => {
    const text = reminderText(4, { word: 'commute', meaning: 'to travel to work or school regularly' });
    expect(text.title).toBe('Keep your 4-day streak going');
    expect(text.message).toBe('Today\'s word is "commute": to travel to work or school regularly. Learn it in a minute, then do your plan.');
    expect(reminderText(0, { word: 'x', meaning: 'y'.repeat(400) }).message.length).toBeLessThanOrEqual(300);
  });
});

function setup(options: { settings?: any[]; zone?: string | null; lastActivity?: Date | null; subscribed?: string[]; streak?: number } = {}) {
  const subscribed = options.subscribed ?? ['u1'];
  const prisma: any = {
    pushSubscription: { findMany: jest.fn().mockResolvedValue(subscribed.map((userId) => ({ userId }))) },
    settings: { findMany: jest.fn().mockResolvedValue(options.settings ?? []) },
    profile: { findMany: jest.fn().mockResolvedValue(subscribed.map((userId) => ({ userId, timezone: options.zone ?? 'UTC' }))) },
    streak: {
      findMany: jest.fn().mockResolvedValue(
        options.lastActivity === null
          ? []
          : subscribed.map((userId) => ({
              userId,
              currentStreak: options.streak ?? 3,
              longestStreak: 9,
              lastActivityDate: options.lastActivity ?? new Date(Date.UTC(2026, 10, 4, 12, 0)),
              freezes: 0,
            })),
      ),
    },
  };
  const notifications: any = { notify: jest.fn().mockResolvedValue(1) };
  return { service: new DailyReminderService(prisma, notifications), notifications };
}

describe('DailyReminderService', () => {
  // 2026-11-05 20:10 UTC; yesterday they practised
  const evening = new Date(Date.UTC(2026, 10, 5, 20, 10));

  it('reminds someone at their chosen time, with a once-a-day key and their streak', async () => {
    const { service, notifications } = setup({ streak: 3, lastActivity: new Date(Date.UTC(2026, 10, 4, 12, 0)) });
    expect(await service.tick(evening)).toBe(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({ type: 'REMINDER', title: 'Keep your 3-day streak going', actionUrl: '/dashboard', dedupeKey: 'daily:2026-11-05' }),
    );
    // The same word the dashboard shows that day (no level saved counts as A2)
    const word = wordOfDay('A2', '2026-11-05');
    const sent = notifications.notify.mock.calls[0][1];
    expect(sent.message).toContain(`"${word.word}"`);
    expect(sent.data).toEqual({ kind: 'daily-reminder', word: word.word });
  });

  it('waits for their own clock: 20:10 UTC is the next morning in Dhaka', async () => {
    const { service, notifications } = setup({ zone: 'Asia/Dhaka', settings: [{ userId: 'u1', dailyReminderEnabled: true, dailyReminderTime: '20:00', pushNotifications: true }] });
    await service.tick(evening);
    expect(notifications.notify).not.toHaveBeenCalled();
    // 14:10 UTC is 20:10 in Dhaka
    await service.tick(new Date(Date.UTC(2026, 10, 5, 14, 10)));
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('uses the time they chose in Settings', async () => {
    const { service, notifications } = setup({ settings: [{ userId: 'u1', dailyReminderEnabled: true, dailyReminderTime: '07:30', pushNotifications: true }] });
    await service.tick(evening);
    expect(notifications.notify).not.toHaveBeenCalled();
    await service.tick(new Date(Date.UTC(2026, 10, 5, 7, 40)));
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('skips people who switched the reminder or push off', async () => {
    const off = setup({ settings: [{ userId: 'u1', dailyReminderEnabled: false, dailyReminderTime: '20:00', pushNotifications: true }] });
    await off.service.tick(evening);
    expect(off.notifications.notify).not.toHaveBeenCalled();
    const noPush = setup({ settings: [{ userId: 'u1', dailyReminderEnabled: true, dailyReminderTime: '20:00', pushNotifications: false }] });
    await noPush.service.tick(evening);
    expect(noPush.notifications.notify).not.toHaveBeenCalled();
  });

  it('does not nag someone who has already practised today', async () => {
    const { service, notifications } = setup({ lastActivity: new Date(Date.UTC(2026, 10, 5, 9, 0)) });
    await service.tick(evening);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('reminds people who never practised, without a streak to lose', async () => {
    const { service, notifications } = setup({ lastActivity: null });
    await service.tick(evening);
    expect(notifications.notify).toHaveBeenCalledWith(['u1'], expect.objectContaining({ title: 'Time to practise English' }));
  });

  it('does nothing when nobody has push set up, and survives a database error', async () => {
    const none = setup({ subscribed: [] });
    expect(await none.service.tick(evening)).toBe(0);
    const broken = setup();
    (broken.service as any).prisma.pushSubscription.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(broken.service.tick(evening)).resolves.toBe(0);
  });
});
