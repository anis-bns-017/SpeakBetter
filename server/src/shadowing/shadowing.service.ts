import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { BadgesService } from '../gamification/badges.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { localParts } from '../notifications/daily-reminder.engine';
import { pickSession } from '../dictation/dictation.engine';
import type { LibraryLevel } from '../library/library.content';
import { LESSONS, LESSON_BY_ID, SHADOW_LEVELS, TRACKS, TRACK_BY_ID, type ShadowLesson, type ShadowLevel } from './shadowing.content';
import { annotate, averageOf, bestByLine, buildUp, tune, weakWords } from './shadowing.engine';

/** XP the first time you finish a lesson */
export const SHADOWING_XP = 6;
/** How far back a finish looks for your attempts on the lesson's lines */
const MAX_SESSION_MS = 6 * 60 * 60_000;
const DEFAULT_SESSION_MS = 3 * 60 * 60_000;
const MAX_ATTEMPTS_READ = 600;

type LineScores = Record<string, number>;

const asLineScores = (value: unknown): LineScores =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === 'number')) as LineScores
    : {};

/** Each line with its listening hints and build-up steps */
const lineView = (lessonId: string, lines: string[]) =>
  lines.map((text, i) => ({ id: `${lessonId}:${i}`, text, tokens: annotate(text), tune: tune(text), steps: buildUp(text) }));

/** When the practice started: what the page says, kept within the last six hours */
export function sessionStart(startedAt: unknown, now: Date): Date {
  const earliest = now.getTime() - MAX_SESSION_MS;
  const parsed = typeof startedAt === 'string' || typeof startedAt === 'number' ? new Date(startedAt).getTime() : NaN;
  const at = Number.isFinite(parsed) ? parsed : now.getTime() - DEFAULT_SESSION_MS;
  return new Date(Math.min(now.getTime(), Math.max(earliest, at)));
}

@Injectable()
export class ShadowingService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    @Optional() private badges?: BadgesService,
  ) {}

  /** The course: every track with its lessons and your progress, your numbers, and what to do next */
  async overview(userId: string) {
    const [profile, progress] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.prisma.shadowingProgress.findMany({ where: { userId } }),
    ]);
    const level = practiceLevel(profile?.level) as ShadowLevel;
    const byId = new Map(progress.map((p) => [p.lessonId, p]));
    const summary = (l: ShadowLesson) => {
      const p = byId.get(l.id);
      return { id: l.id, track: l.track, level: l.level, title: l.title, focus: l.focus, lines: l.lines.length, done: !!p, bestScore: p?.bestScore ?? null, times: p?.completions ?? 0 };
    };

    const lessons = LESSONS.map(summary);
    const scored = lessons.map((l) => l.bestScore).filter((s): s is number => s !== null);
    // Next: the first lesson not done at your level, then the levels around it
    const at = SHADOW_LEVELS.indexOf(level);
    const order = [at, at + 1, at - 1, at + 2, at - 2, at + 3, at - 3, at + 4, at - 4].filter((i) => i >= 0 && i < SHADOW_LEVELS.length);
    const next = order.map((i) => lessons.find((l) => l.level === SHADOW_LEVELS[i] && !l.done)).find(Boolean) ?? null;

    return {
      level,
      levels: SHADOW_LEVELS,
      tracks: TRACKS.map((t) => {
        const own = lessons.filter((l) => l.track === t.id);
        return { ...t, lessons: own, done: own.filter((l) => l.done).length };
      }),
      next,
      stats: {
        done: lessons.filter((l) => l.done).length,
        total: lessons.length,
        average: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
        linesSpoken: progress.reduce((n, p) => n + p.linesSpoken, 0),
        sessions: progress.reduce((n, p) => n + p.completions, 0),
      },
    };
  }

  /** One lesson with every line's hints and build-up steps, your best per line and the lesson after it */
  async lesson(userId: string, id: string) {
    const lesson = LESSON_BY_ID.get(id);
    if (!lesson) throw new NotFoundException('Lesson not found');
    const progress = await this.prisma.shadowingProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: id } } });
    const inTrack = LESSONS.filter((l) => l.track === lesson.track);
    const next = inTrack[inTrack.indexOf(lesson) + 1] ?? LESSONS[LESSONS.indexOf(lesson) + 1] ?? null;
    const track = TRACK_BY_ID.get(lesson.track)!;
    return {
      id: lesson.id,
      level: lesson.level,
      title: lesson.title,
      focus: lesson.focus,
      tip: lesson.tip,
      track: { id: track.id, label: track.label, icon: track.icon },
      lines: lineView(lesson.id, lesson.lines),
      progress: progress ? { bestScore: progress.bestScore, times: progress.completions, lineScores: asLineScores(progress.lineScores) } : null,
      next: next ? { id: next.id, title: next.title } : null,
    };
  }

  /** A quick mixed set from the library at your level; "round" gives a different set */
  async daily(userId: string, round: unknown, now = new Date()) {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true, timezone: true } });
    const level = practiceLevel(profile?.level) as LibraryLevel;
    const day = localParts(now, profile?.timezone).day;
    const r = Math.max(0, Math.min(999, Math.floor(Number(round)) || 0));
    const texts = pickSession(level, `${userId}:${day}:shadow:${r}`).map((i) => i.text);
    return {
      id: 'daily',
      level,
      round: r,
      title: 'Daily mix',
      focus: 'Mixed sentences at your level',
      tip: 'Listen once without reading, then shadow with the text. Copy the speed and the music, not just the words.',
      track: null,
      lines: lineView('daily', texts),
      progress: null,
      next: null,
    };
  }

  /**
   * Saves a finished lesson. Scores are not sent by the page: they are your pronunciation attempts on the
   * lesson's lines since you started, so they cannot be made up. The first finish earns XP.
   */
  async finish(userId: string, id: string, startedAt: unknown, now = new Date()) {
    const lesson = LESSON_BY_ID.get(id);
    if (!lesson) throw new NotFoundException('Lesson not found');

    const since = sessionStart(startedAt, now);
    const attempts = await this.prisma.pronunciationAttempt.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ATTEMPTS_READ,
      select: { target: true, score: true, missedWords: true },
    });
    const scores = bestByLine(lesson.lines, attempts);
    const spoken = scores.filter((s) => s !== null).length;
    const average = averageOf(scores);

    const existing = await this.prisma.shadowingProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: id } } });
    const previous = asLineScores(existing?.lineScores);
    const lineScores: LineScores = { ...previous };
    scores.forEach((s, i) => {
      const key = `${id}:${i}`;
      if (s !== null) lineScores[key] = Math.max(previous[key] ?? 0, s);
    });
    const best = average === null ? (existing?.bestScore ?? null) : Math.max(existing?.bestScore ?? 0, average);

    await this.prisma.shadowingProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: id } },
      create: { userId, lessonId: id, bestScore: best, completions: 1, linesSpoken: spoken, lineScores },
      update: { bestScore: best, completions: { increment: 1 }, linesSpoken: { increment: spoken }, lineScores },
    });

    const firstTime = !existing;
    if (firstTime) await this.activity.recordActivity(userId, SHADOWING_XP, 'LESSON_COMPLETED');
    void this.badges?.evaluate(userId);

    return {
      firstTime,
      xp: firstTime ? SHADOWING_XP : 0,
      spoken,
      total: lesson.lines.length,
      average,
      best,
      lines: lesson.lines.map((text, i) => ({ id: `${id}:${i}`, text, score: scores[i], best: lineScores[`${id}:${i}`] ?? null })),
      weakWords: weakWords(lesson.lines, attempts),
    };
  }
}
