import { addDays, dayIn, daysBetween, forgetZones, learnerZone, rememberZone, startOfDayIn, startOfDayKey } from './learner-day';
import { ActivityService } from '../learning/activity.service';
import { planStreak } from '../insights/plan.engine';
import { promptFor } from '../challenges/challenge.prompts';

// 19:00 UTC on 23 Nov: already the 24th in Dhaka, still the 23rd in New York
const EVENING_UTC = new Date('2026-11-23T19:00:00Z');

describe("the learner's own day", () => {
  beforeEach(() => forgetZones());
  afterEach(() => jest.useRealTimers());

  it('reads the calendar day in any time zone', () => {
    expect(dayIn(EVENING_UTC, 'Asia/Dhaka')).toBe('2026-11-24');
    expect(dayIn(EVENING_UTC, 'America/New_York')).toBe('2026-11-23');
    expect(dayIn(EVENING_UTC, 'Pacific/Kiritimati')).toBe('2026-11-24');
    expect(dayIn(EVENING_UTC, 'UTC')).toBe('2026-11-23');
  });

  it("finds the moment a day starts on the learner's clock", () => {
    expect(startOfDayKey('2026-11-24', 'Asia/Dhaka').toISOString()).toBe('2026-11-23T18:00:00.000Z');
    expect(startOfDayIn(EVENING_UTC, 'Asia/Dhaka').toISOString()).toBe('2026-11-23T18:00:00.000Z');
    expect(startOfDayKey('2026-11-23', 'UTC').toISOString()).toBe('2026-11-23T00:00:00.000Z');
    expect(startOfDayKey('2026-11-23', 'Asia/Kolkata').toISOString()).toBe('2026-11-22T18:30:00.000Z');
  });

  it('gets the start of the day right on both sides of a clock change', () => {
    // New York: winter time (UTC-5) on 8 March at midnight, summer time (UTC-4) on 1 November at midnight
    expect(startOfDayKey('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(startOfDayKey('2026-03-09', 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(startOfDayKey('2026-11-01', 'America/New_York').toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(startOfDayKey('2026-11-02', 'America/New_York').toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });

  it('counts days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2026-11-20', '2026-11-24')).toBe(4);
    expect(daysBetween('2026-11-24', '2026-11-20')).toBe(-4);
  });

  it('reads the saved zone, ignores a broken one, and never throws', async () => {
    const prisma = { profile: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Dhaka' }) } };
    expect(await learnerZone(prisma, 'u1')).toBe('Asia/Dhaka');
    await learnerZone(prisma, 'u1');
    expect(prisma.profile.findUnique).toHaveBeenCalledTimes(1); // remembered for a while

    const broken = { profile: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Not/AZone' }) } };
    expect(await learnerZone(broken, 'u2')).toBeUndefined();
    const failing = { profile: { findUnique: jest.fn().mockRejectedValue(new Error('db down')) } };
    expect(await learnerZone(failing, 'u3')).toBeUndefined();
    expect(await learnerZone({}, 'u4')).toBeUndefined();

    rememberZone('u1', 'Europe/London');
    expect(await learnerZone(prisma, 'u1')).toBe('Europe/London');
  });

  it("keeps or loses a streak by the learner's calendar, not the server's", () => {
    // Practised at 23:30 on the 22nd in Dhaka; it is now 01:00 on the 24th there, so the 23rd was missed
    const streak = { currentStreak: 5, lastActivityDate: new Date('2026-11-22T17:30:00Z'), freezes: 0 };
    expect(ActivityService.effectiveStreak(streak, EVENING_UTC, 'Asia/Dhaka').current).toBe(0);
    // On UTC the same moments are the 22nd and the 23rd: yesterday, so still alive
    expect(ActivityService.effectiveStreak(streak, EVENING_UTC, 'UTC').current).toBe(5);
    // A freeze covers the missed day
    expect(ActivityService.effectiveStreak({ ...streak, freezes: 1 }, EVENING_UTC, 'Asia/Dhaka').current).toBe(5);
  });

  it("starts a new streak day at the learner's midnight", async () => {
    jest.useFakeTimers().setSystemTime(EVENING_UTC);
    // Last practice 23:00 on the 23rd in Dhaka; now it is the 24th there
    const row = { userId: 'u9', currentStreak: 3, longestStreak: 3, freezes: 0, lastActivityDate: new Date('2026-11-23T17:00:00Z') };
    const prisma: any = {
      profile: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Dhaka' }), updateMany: jest.fn() },
      streak: { findUnique: jest.fn().mockResolvedValue(row), upsert: jest.fn().mockResolvedValue({}), updateMany: jest.fn() },
      streakFreezeUse: { createMany: jest.fn() },
    };
    await new ActivityService(prisma).touchStreak('u9');
    expect(prisma.streak.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ currentStreak: 4 }) }));

    // The same two moments on a UTC learner's clock are both the 23rd: no new day
    forgetZones();
    prisma.profile.findUnique.mockResolvedValue({ timezone: 'UTC' });
    prisma.streak.upsert.mockClear();
    await new ActivityService(prisma).touchStreak('u9');
    expect(prisma.streak.upsert).not.toHaveBeenCalled();
  });

  it('counts plan streaks and picks challenge questions from day keys', () => {
    expect(planStreak(['2026-11-22', '2026-11-23'], '2026-11-24')).toBe(2);
    expect(planStreak(['2026-11-22', '2026-11-23', '2026-11-24'], '2026-11-24')).toBe(3);
    expect(planStreak(['2026-11-21'], '2026-11-24')).toBe(0);
    // A day key and a Date on the same server day choose the same question
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(promptFor('B1', key).id).toBe(promptFor('B1', today).id);
    expect(promptFor('B1', addDays(key, 1)).id).not.toBe(promptFor('B1', key).id);
  });
});
