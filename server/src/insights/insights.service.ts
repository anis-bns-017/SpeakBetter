import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { addDays, dayIn, daysBetween, learnerZone, startOfDayKey } from '../common/learner-day';
import { ActivityService } from '../learning/activity.service';
import { isPattern, MISTAKE_PATTERNS, type MistakePattern } from '../learning/mistakes';
import { isSoundKey, SOUNDS } from '../pronunciation/pronunciation.data';
import { MINUTES_PER, planStreak } from './plan.engine';

const DAY_MS = 24 * 60 * 60 * 1000;
const CALENDAR_DAYS = 84;
const TREND_WEEKS = 8;
const LEARNED_AFTER_DAYS = 21;

export type ActivityKind = 'speaking' | 'review' | 'pronunciation' | 'corrections' | 'chat' | 'exercises' | 'other';
export const ACTIVITY_KINDS: ActivityKind[] = ['speaking', 'review', 'pronunciation', 'corrections', 'chat', 'exercises', 'other'];

/** Which activity an XP reason belongs to */
export function activityOf(reason: string): ActivityKind {
  switch (reason) {
    case 'VOICE_SPEAKING':
    case 'AI_PRACTICE':
    case 'CHALLENGE_COMPLETED':
      return 'speaking';
    case 'FLASHCARD_REVIEW':
    case 'VOCABULARY_MASTERED':
      return 'review';
    case 'PRONUNCIATION_PRACTICE':
      return 'pronunciation';
    case 'CORRECTION_GIVEN':
    case 'CORRECTION_ACCEPTED':
      return 'corrections';
    case 'CHAT_MESSAGE':
      return 'chat';
    case 'EXERCISE_COMPLETED':
    case 'QUIZ_COMPLETED':
    case 'LESSON_COMPLETED':
    case 'ASSIGNMENT_COMPLETED':
    case 'WRITING_PRACTICE':
    case 'VOCAB_TEST':
      return 'exercises';
    default:
      return 'other';
  }
}

/**
 * About how many minutes of practice one XP record stands for. Speaking is measured (1 XP per 15 seconds);
 * the rest is an estimate per action. Pronunciation is counted from its own attempts instead, since its XP
 * stops at a daily cap.
 */
export function minutesFor(reason: string, amount: number): number {
  switch (reason) {
    case 'VOICE_SPEAKING':
      return (amount * 15) / 60;
    case 'AI_PRACTICE':
      return MINUTES_PER.aiTurn;
    case 'FLASHCARD_REVIEW':
      return MINUTES_PER.card;
    case 'CHAT_MESSAGE':
      return MINUTES_PER.chatMessage;
    case 'EXERCISE_COMPLETED':
    case 'QUIZ_COMPLETED':
      return MINUTES_PER.exercise;
    case 'CORRECTION_GIVEN':
      return MINUTES_PER.correction;
    case 'VOCABULARY_MASTERED':
      return MINUTES_PER.exercise;
    // A finished story, shadowing lesson or role-play
    case 'LESSON_COMPLETED':
      return MINUTES_PER.lesson;
    case 'WRITING_PRACTICE':
      return MINUTES_PER.writing;
    case 'CHALLENGE_COMPLETED':
      return MINUTES_PER.challenge;
    case 'VOCAB_TEST':
      return MINUTES_PER.vocabTest;
    default:
      return 0;
  }
}

export interface WeekStats {
  minutes: number;
  xp: number;
  reviews: number;
  speakingMinutes: number;
  pronunciationAverage: number | null;
  pronunciationTries: number;
  activeDays: number;
  plansCompleted: number;
  mistakes: number;
}

/** A sentence for the summary: the English template and its values, so the app can show it in Bangla too */
export interface SummaryLine {
  text: string;
  vars: Record<string, string | number>;
}

const fillLine = ({ text, vars }: SummaryLine) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));

const round1 = (n: number) => Math.round(n * 10) / 10;
const average = (list: number[]) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async getProgress(userId: string) {
    const now = new Date();
    // Days on the learner's own clock
    const zone = await learnerZone(this.prisma, userId);
    const todayKey = dayIn(now, zone);
    const calendarStartKey = addDays(todayKey, -(CALENDAR_DAYS - 1));
    const calendarStart = startOfDayKey(calendarStartKey, zone);

    const [xpRows, attempts, mistakeCards, learned, totalCards, plans, placements, streakRow, totalXp] = await Promise.all([
      this.prisma.xpTransaction.findMany({
        where: { userId, createdAt: { gte: calendarStart } },
        select: { reason: true, amount: true, createdAt: true },
      }),
      this.prisma.pronunciationAttempt.findMany({
        where: { userId, createdAt: { gte: calendarStart } },
        select: { score: true, sound: true, createdAt: true },
      }),
      this.prisma.flashcard.findMany({
        where: { userId, kind: 'correction', createdAt: { gte: startOfDayKey(addDays(todayKey, -(TREND_WEEKS * 7 - 1)), zone) } },
        select: { pattern: true, createdAt: true },
      }),
      this.prisma.flashcardReview.count({ where: { userId, interval: { gte: LEARNED_AFTER_DAYS } } }),
      this.prisma.flashcard.count({ where: { userId } }),
      this.prisma.dailyPlan.findMany({
        where: { userId, createdAt: { gte: new Date(calendarStart.getTime() - 30 * DAY_MS) } },
        select: { day: true, completedAt: true },
      }),
      this.prisma.placementAttempt.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'asc' },
        select: { level: true, completedAt: true },
        take: 20,
      }),
      this.prisma.streak.findUnique({ where: { userId } }),
      this.prisma.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } }),
    ]);

    // ---------- day by day ----------
    const days = Array.from({ length: CALENDAR_DAYS }, (_, i) => {
      return {
        date: addDays(calendarStartKey, i),
        xp: 0,
        minutes: 0,
        byActivity: Object.fromEntries(ACTIVITY_KINDS.map((k) => [k, 0])) as Record<ActivityKind, number>,
      };
    });
    const index = new Map(days.map((d, i) => [d.date, i]));
    const at = (date: Date) => days[index.get(dayIn(date, zone)) ?? -1];

    for (const row of xpRows) {
      const day = at(row.createdAt);
      if (!day) continue;
      day.xp += row.amount;
      day.minutes += minutesFor(row.reason, row.amount);
      day.byActivity[activityOf(row.reason)] += row.amount;
    }
    for (const a of attempts) {
      const day = at(a.createdAt);
      if (day) day.minutes += MINUTES_PER.pronunciationTry;
    }
    for (const d of days) d.minutes = round1(d.minutes);

    // ---------- weeks (the last 7 days, the 7 before, and so on) ----------
    const weekOf = (date: Date | string) => Math.floor(daysBetween(typeof date === 'string' ? date : dayIn(date, zone), todayKey) / 7);
    const completedDays = new Set(plans.filter((p) => p.completedAt).map((p) => p.day));
    const weekStats = (w: number): WeekStats => {
      const inWeek = days.filter((d) => weekOf(d.date) === w);
      const tries = attempts.filter((a) => weekOf(a.createdAt) === w);
      const speakingXp = xpRows.filter((r) => weekOf(r.createdAt) === w && r.reason === 'VOICE_SPEAKING').reduce((s, r) => s + r.amount, 0);
      const aiTurns = xpRows.filter((r) => weekOf(r.createdAt) === w && r.reason === 'AI_PRACTICE').length;
      return {
        minutes: Math.round(inWeek.reduce((s, d) => s + d.minutes, 0)),
        xp: inWeek.reduce((s, d) => s + d.xp, 0),
        reviews: xpRows.filter((r) => weekOf(r.createdAt) === w && r.reason === 'FLASHCARD_REVIEW').length,
        speakingMinutes: Math.round((speakingXp * 15) / 60 + aiTurns * MINUTES_PER.aiTurn),
        pronunciationAverage: average(tries.map((a) => a.score)),
        pronunciationTries: tries.length,
        activeDays: inWeek.filter((d) => d.xp > 0 || d.minutes > 0).length,
        plansCompleted: inWeek.filter((d) => completedDays.has(d.date)).length,
        mistakes: mistakeCards.filter((c) => weekOf(c.createdAt) === w).length,
      };
    };
    const thisWeek = weekStats(0);
    const lastWeek = weekStats(1);
    const weeklyMinutes = Array.from({ length: CALENDAR_DAYS / 7 }, (_, w) => weekStats(w).minutes);

    // ---------- mistakes by type, per week (oldest first) ----------
    const patternTotals = new Map<MistakePattern, number>();
    for (const c of mistakeCards) {
      const p: MistakePattern = isPattern(c.pattern) ? c.pattern : 'OTHER';
      patternTotals.set(p, (patternTotals.get(p) ?? 0) + 1);
    }
    const topPatterns = [...patternTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p]) => p);
    const mistakesByWeek = Array.from({ length: TREND_WEEKS }, (_, i) => {
      const w = TREND_WEEKS - 1 - i;
      const cards = mistakeCards.filter((c) => weekOf(c.createdAt) === w);
      const byPattern = Object.fromEntries(
        topPatterns.map((p) => [p, cards.filter((c) => (isPattern(c.pattern) ? c.pattern : 'OTHER') === p).length]),
      );
      return { weeksAgo: w, total: cards.length, byPattern };
    });

    // ---------- pronunciation per week (oldest first) and weakest sounds ----------
    const pronunciationByWeek = Array.from({ length: TREND_WEEKS }, (_, i) => {
      const w = TREND_WEEKS - 1 - i;
      const tries = attempts.filter((a) => weekOf(a.createdAt) === w);
      return { weeksAgo: w, average: average(tries.map((a) => a.score)), tries: tries.length };
    });
    const bySound = new Map<string, number[]>();
    for (const a of attempts.filter((x) => weekOf(x.createdAt) < 4)) {
      if (isSoundKey(a.sound)) bySound.set(a.sound, [...(bySound.get(a.sound) ?? []), a.score]);
    }
    const weakSounds = [...bySound.entries()]
      .map(([key, scores]) => ({ key, label: SOUNDS[key as keyof typeof SOUNDS].label, average: average(scores) as number, tries: scores.length }))
      .sort((a, b) => a.average - b.average)
      .slice(0, 3);

    const streak = ActivityService.effectiveStreak(streakRow, now, zone);
    const summary = this.summarise({ thisWeek, lastWeek, weeklyMinutes, mistakesByWeek, topPatterns, weakSounds, plans: completedDays, today: todayKey });

    return {
      days,
      thisWeek,
      lastWeek,
      weeklyMinutes: [...weeklyMinutes].reverse(),
      mistakes: {
        patterns: topPatterns.map((p) => ({ key: p, label: MISTAKE_PATTERNS[p].label })),
        byWeek: mistakesByWeek,
      },
      cards: { learned, total: totalCards },
      pronunciation: { byWeek: pronunciationByWeek, weakSounds },
      levels: placements.filter((p) => p.level && p.completedAt).map((p) => ({ level: p.level as string, date: p.completedAt as Date })),
      streak: { current: streak.current, longest: streakRow?.longestStreak ?? 0, plan: planStreak(completedDays, todayKey) },
      totalXp: totalXp._sum.amount ?? 0,
      summary: summary.map(fillLine),
      summaryLines: summary,
    };
  }

  /** A few plain sentences about the week, most encouraging first */
  private summarise(input: {
    thisWeek: WeekStats;
    lastWeek: WeekStats;
    weeklyMinutes: number[];
    mistakesByWeek: Array<{ weeksAgo: number; byPattern: Record<string, number> }>;
    topPatterns: MistakePattern[];
    weakSounds: Array<{ label: string; average: number }>;
    plans: Set<string>;
    today: string;
  }): SummaryLine[] {
    const { thisWeek, lastWeek, weeklyMinutes } = input;
    const lines: SummaryLine[] = [];
    const say = (text: string, vars: SummaryLine['vars'] = {}) => lines.push({ text, vars });

    if (thisWeek.minutes === 0 && thisWeek.xp === 0) {
      say("No practice yet this week. Today's plan takes just a few minutes — a great way to start.");
    } else {
      const earlierBest = Math.max(0, ...weeklyMinutes.slice(1));
      if (thisWeek.minutes > earlierBest && earlierBest > 0) {
        say('Your best week yet: about {minutes} minutes of practice.', { minutes: thisWeek.minutes });
      } else if (thisWeek.minutes > lastWeek.minutes) {
        say('About {minutes} minutes of practice this week, up from {before}.', { minutes: thisWeek.minutes, before: lastWeek.minutes });
      } else if (lastWeek.minutes > 0 && thisWeek.minutes < lastWeek.minutes) {
        say('A quieter week: about {minutes} minutes, down from {before}. A short plan each day gets you back on track.', { minutes: thisWeek.minutes, before: lastWeek.minutes });
      } else {
        say('About {minutes} minutes of practice this week.', { minutes: thisWeek.minutes });
      }
    }

    const current = input.mistakesByWeek.find((w) => w.weeksAgo === 0)?.byPattern ?? {};
    const previous = input.mistakesByWeek.find((w) => w.weeksAgo === 1)?.byPattern ?? {};
    for (const p of input.topPatterns) {
      const now = current[p] ?? 0;
      const before = previous[p] ?? 0;
      // "Articles (a, an, the)" reads better in a sentence as "articles"
      const label = MISTAKE_PATTERNS[p].label.split(' (')[0].toLowerCase();
      if (before >= 2 && now <= before / 2) {
        say('Mistakes with {label} dropped from {before} to {now}. Nice work.', { label, before, now });
        break;
      }
      if (now >= 3 && now > before) {
        say('Mistakes with {label} keep coming up ({now} this week). Practise them in Review.', { label, now });
        break;
      }
    }

    if (thisWeek.pronunciationAverage !== null && lastWeek.pronunciationAverage !== null && thisWeek.pronunciationAverage - lastWeek.pronunciationAverage >= 5) {
      say('Your pronunciation score rose from {before} to {now}.', { before: lastWeek.pronunciationAverage, now: thisWeek.pronunciationAverage });
    } else if (input.weakSounds[0] && input.weakSounds[0].average < 85) {
      say('Work on {sound} next: it is your weakest sound.', { sound: input.weakSounds[0].label.split(' (')[0] });
    }

    const planDays = planStreak(input.plans, input.today);
    if (planDays >= 2) say('You finished your daily plan {days} days in a row.', { days: planDays });

    return lines.slice(0, 4);
  }
}
