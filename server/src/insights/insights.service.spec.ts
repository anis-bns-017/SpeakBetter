import { activityOf, InsightsService, minutesFor } from './insights.service';
import { PlanService, PLAN_BONUS_XP } from './plan.service';
import { dayKey } from './plan.engine';

const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number, hour = 12) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() - days * DAY_MS);
};

describe('activityOf and minutesFor', () => {
  it('groups XP reasons into activities', () => {
    expect(activityOf('VOICE_SPEAKING')).toBe('speaking');
    expect(activityOf('AI_PRACTICE')).toBe('speaking');
    expect(activityOf('FLASHCARD_REVIEW')).toBe('review');
    expect(activityOf('PRONUNCIATION_PRACTICE')).toBe('pronunciation');
    expect(activityOf('CORRECTION_ACCEPTED')).toBe('corrections');
    expect(activityOf('DAILY_PLAN')).toBe('other');
  });

  it('measures speaking and estimates the rest', () => {
    expect(minutesFor('VOICE_SPEAKING', 8)).toBe(2);
    expect(minutesFor('FLASHCARD_REVIEW', 2)).toBe(0.4);
    // Pronunciation is counted from its own attempts, not its capped XP
    expect(minutesFor('PRONUNCIATION_PRACTICE', 2)).toBe(0);
  });

  it('counts time in stories, writing and the daily challenge', () => {
    expect(minutesFor('LESSON_COMPLETED', 10)).toBeGreaterThan(0);
    expect(minutesFor('WRITING_PRACTICE', 10)).toBeGreaterThan(0);
    expect(minutesFor('CHALLENGE_COMPLETED', 10)).toBeGreaterThan(0);
    expect(activityOf('CHALLENGE_COMPLETED')).toBe('speaking');
    expect(activityOf('WRITING_PRACTICE')).toBe('exercises');
  });
});

describe('InsightsService.getProgress', () => {
  function setup() {
    const prisma: any = {
      xpTransaction: {
        findMany: jest.fn().mockResolvedValue([
          { reason: 'VOICE_SPEAKING', amount: 40, createdAt: ago(0) }, // 10 minutes today
          { reason: 'FLASHCARD_REVIEW', amount: 2, createdAt: ago(1) },
          { reason: 'VOICE_SPEAKING', amount: 8, createdAt: ago(8) }, // 2 minutes last week
        ]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500 } }),
      },
      pronunciationAttempt: {
        findMany: jest.fn().mockResolvedValue([
          { score: 60, sound: 'TH', createdAt: ago(0) },
          { score: 80, sound: 'TH', createdAt: ago(2) },
        ]),
      },
      flashcard: {
        findMany: jest.fn().mockResolvedValue([
          { pattern: 'ARTICLE', createdAt: ago(9) },
          { pattern: 'ARTICLE', createdAt: ago(10) },
          { pattern: 'ARTICLE', createdAt: ago(11) },
          { pattern: 'TENSE', createdAt: ago(1) },
        ]),
        count: jest.fn().mockResolvedValue(30),
      },
      flashcardReview: { count: jest.fn().mockResolvedValue(7) },
      dailyPlan: { findMany: jest.fn().mockResolvedValue([{ day: dayKey(ago(0)), completedAt: ago(0) }, { day: dayKey(ago(1)), completedAt: ago(1) }]) },
      placementAttempt: { findMany: jest.fn().mockResolvedValue([{ level: 'A2', completedAt: ago(30) }, { level: 'B1', completedAt: ago(2) }]) },
      streak: { findUnique: jest.fn().mockResolvedValue({ currentStreak: 3, longestStreak: 9, lastActivityDate: new Date() }) },
    };
    return new InsightsService(prisma);
  }

  it('builds the calendar, the week comparison and the trends', async () => {
    const p = await setup().getProgress('u1');
    expect(p.days).toHaveLength(84);
    const today = p.days[p.days.length - 1];
    expect(today.byActivity.speaking).toBe(40);
    expect(today.minutes).toBe(10.5); // 10 speaking + one pronunciation try

    expect(p.thisWeek).toMatchObject({ speakingMinutes: 10, reviews: 1, pronunciationAverage: 70, pronunciationTries: 2, plansCompleted: 2, mistakes: 1 });
    expect(p.lastWeek).toMatchObject({ speakingMinutes: 2, mistakes: 3 });
    expect(p.weeklyMinutes).toHaveLength(12);

    expect(p.mistakes.patterns[0]).toEqual({ key: 'ARTICLE', label: expect.any(String) });
    expect(p.mistakes.byWeek).toHaveLength(8);
    expect(p.mistakes.byWeek[7]).toMatchObject({ weeksAgo: 0, total: 1 });

    expect(p.pronunciation.weakSounds[0]).toMatchObject({ key: 'TH', average: 70, tries: 2 });
    expect(p.levels.map((l) => l.level)).toEqual(['A2', 'B1']);
    expect(p.cards).toEqual({ learned: 7, total: 30 });
    expect(p.streak).toEqual({ current: 3, longest: 9, plan: 2 });
  });

  it('writes a short summary about the week', async () => {
    const p = await setup().getProgress('u1');
    expect(p.summary[0]).toMatch(/best week yet|up from/);
    expect(p.summary.join(' ')).toMatch(/mistakes with articles dropped from 3 to 0/i);
    expect(p.summary.join(' ')).toMatch(/th as in think/i);
    expect(p.summary.join(' ')).toMatch(/2 days in a row/);
  });
});

describe('PlanService', () => {
  function setup(options: { plan?: any; xp?: any[]; reviews?: number; attempts?: number } = {}) {
    let stored: any = options.plan ?? null;
    const prisma: any = {
      settings: { findUnique: jest.fn().mockResolvedValue({ dailyGoalMinutes: 10 }), upsert: jest.fn().mockResolvedValue({}) },
      profile: { findUnique: jest.fn().mockResolvedValue({ level: 'B1' }) },
      dailyPlan: {
        findUnique: jest.fn(async () => stored),
        create: jest.fn(async ({ data }) => (stored = { id: 'p1', completedAt: null, ...data })),
        updateMany: jest.fn(async () => {
          if (stored.completedAt) return { count: 0 };
          stored.completedAt = new Date();
          return { count: 1 };
        }),
        deleteMany: jest.fn(async () => {
          stored = null;
          return { count: 1 };
        }),
        findMany: jest.fn(async () => (stored?.completedAt ? [{ day: stored.day }] : [])),
      },
      pronunciationAttempt: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(options.attempts ?? 0) },
      xpTransaction: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue(options.xp ?? []) },
      flashcard: { count: jest.fn().mockResolvedValue(0) },
      voiceSavedWord: { count: jest.fn().mockResolvedValue(0) },
      flashcardReview: { count: jest.fn().mockResolvedValue(options.reviews ?? 0) },
    };
    const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
    const review: any = {
      getQueue: jest.fn().mockResolvedValue({ due: { total: 12 } }),
      getMistakesReport: jest.fn().mockResolvedValue({ patterns: [{ pattern: 'ARTICLE', label: 'Articles', repeating: true }] }),
    };
    return { service: new PlanService(prisma, activity, review), prisma, activity };
  }

  it("makes today's plan once and keeps it for the day", async () => {
    const { service, prisma } = setup();
    const first = await service.getToday('u1');
    expect(first.tasks.map((t) => t.kind)).toEqual(['REVIEW', 'PRONUNCIATION', 'SPEAK']);
    expect(first.tasks[0].to).toBe('/flashcards?pattern=ARTICLE');
    expect(first).toMatchObject({ done: 0, total: 3, goalMinutes: 10, completedAt: null });
    await service.getToday('u1');
    expect(prisma.dailyPlan.create).toHaveBeenCalledTimes(1);
  });

  it('measures progress from what you did and gives the bonus once when everything is done', async () => {
    const { service, activity } = setup({
      reviews: 9,
      attempts: 6,
      xp: [{ reason: 'VOICE_SPEAKING', amount: 16 }], // 4 minutes
    });
    const plan = await service.getToday('u1');
    expect(plan.tasks.map((t) => [t.kind, t.progress, t.done])).toEqual([
      ['REVIEW', 9, true],
      ['PRONUNCIATION', 6, true],
      // 3 minutes fit into the 10-minute plan; progress stops at the target
      ['SPEAK', 3, true],
    ]);
    expect(plan.completedAt).toBeTruthy();
    expect(plan.bonusJustEarned).toBe(true);
    expect(plan.streak).toBe(1);
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', PLAN_BONUS_XP, 'DAILY_PLAN');

    const again = await service.getToday('u1');
    expect(again.bonusJustEarned).toBe(false);
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('counts a story only once it is passed, and grammar without dictation', async () => {
    const tasks = [
      { id: 'read', kind: 'READ', title: 'Read', detail: '', to: '/library', target: 1, unit: 'texts', minutes: 3 },
      { id: 'exercise', kind: 'EXERCISE', title: 'Grammar', detail: '', to: '/grammar', target: 1, unit: 'exercises', minutes: 3 },
    ];
    const { service, prisma } = setup({
      plan: { id: 'p1', day: dayKey(new Date()), goalMinutes: 10, tasks, completedAt: null },
      xp: [{ reason: 'EXERCISE_COMPLETED', amount: 8 }], // a dictation shares this reason
    });
    prisma.libraryProgress = { count: jest.fn().mockResolvedValue(0) };
    prisma.grammarProgress = { count: jest.fn().mockResolvedValue(0) };
    prisma.gameResult = { count: jest.fn().mockResolvedValue(0) };
    const plan = await service.getToday('u1');
    expect(prisma.libraryProgress.count.mock.calls[0][0].where.completedAt).toEqual({ not: null });
    expect(plan.tasks.map((t) => t.done)).toEqual([false, false]);

    prisma.gameResult.count.mockResolvedValue(1);
    prisma.libraryProgress.count.mockResolvedValue(1);
    const done = await service.getToday('u1');
    expect(done.tasks.map((t) => t.done)).toEqual([true, true]);
  });

  it("finishes yesterday's plan on the next visit, with the bonus but without faking a practice day", async () => {
    const yesterday = dayKey(ago(1));
    const tasks = [{ id: 'pronunciation', kind: 'PRONUNCIATION', title: 'Drill', detail: '', to: '/pronunciation', target: 2, unit: 'tries', minutes: 1 }];
    const { service, prisma, activity } = setup({ attempts: 2 });
    activity.grantXp = jest.fn().mockResolvedValue(undefined);
    const old = { id: 'old', day: yesterday, goalMinutes: 10, tasks, completedAt: null as Date | null };
    const created: any[] = [];
    prisma.dailyPlan.findUnique = jest.fn(async ({ where }: any) => (where.userId_day.day === yesterday ? old : (created[0] ?? null)));
    prisma.dailyPlan.create = jest.fn(async ({ data }: any) => {
      created.push({ id: 'today', completedAt: null, ...data });
      return created[0];
    });
    prisma.dailyPlan.updateMany = jest.fn(async ({ where, data }: any) => {
      if (where.id !== 'old' || old.completedAt) return { count: 0 };
      old.completedAt = data.completedAt;
      return { count: 1 };
    });
    await service.getToday('u1');
    expect(dayKey(old.completedAt as Date)).toBe(yesterday);
    expect(activity.grantXp).toHaveBeenCalledWith('u1', PLAN_BONUS_XP, 'DAILY_PLAN');
    expect(activity.recordActivity).not.toHaveBeenCalled();
    // The attempts were counted inside yesterday only
    const during = prisma.pronunciationAttempt.count.mock.calls[0][0].where.createdAt;
    expect(during.lt).toBeInstanceOf(Date);
  });

  it('only accepts the goal options and rebuilds an unfinished plan', async () => {
    const { service, prisma } = setup();
    await expect(service.setGoal('u1', 7)).rejects.toThrow(/Choose/);
    await service.getToday('u1');
    await service.setGoal('u1', 20);
    expect(prisma.settings.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { dailyGoalMinutes: 20 } }));
    expect(prisma.dailyPlan.deleteMany).toHaveBeenCalled();
    expect(prisma.dailyPlan.create).toHaveBeenCalledTimes(2);
  });
});
