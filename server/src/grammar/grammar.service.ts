import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { MISTAKE_PATTERNS, isPattern } from '../learning/mistakes';
import { BadgesService } from '../gamification/badges.service';
import { FriendChallengesService } from '../friend-challenges/friend-challenges.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { optionOrder } from '../library/library.content';
import { GRAMMAR, GRAMMAR_LEVELS, LESSON_BY_ID, type GrammarExercise, type GrammarLevel, type GrammarLesson } from './grammar.content';
import { GRAMMAR_XP, judge, passMark, seedFor, shuffledWords } from './grammar.engine';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Mistakes of one kind in the last month before a lesson is suggested for it */
const REPEAT_FROM = 2;

const patternLabel = (pattern: string | null) => (pattern && isPattern(pattern) ? MISTAKE_PATTERNS[pattern].label : null);

@Injectable()
export class GrammarService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private review: ReviewService,
    // Grammar badges; optional so lessons work (and tests stay simple) without it
    @Optional() private badges?: BadgesService,
    // "Beat my score" challenges from friends on this lesson
    @Optional() private challenges?: FriendChallengesService,
  ) {}

  /** Every lesson with your progress, your level, and the lesson to do next */
  async list(userId: string) {
    const [profile, progress, repeating] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.prisma.grammarProgress.findMany({ where: { userId } }),
      this.prisma.flashcard.groupBy({
        by: ['pattern'],
        where: { userId, kind: 'correction', pattern: { not: null }, createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) } },
        _count: { _all: true },
      }),
    ]);
    const level = practiceLevel(profile?.level) as GrammarLevel;
    const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
    const lessons = GRAMMAR.map((l) => {
      const p = byLesson.get(l.id);
      return {
        id: l.id,
        level: l.level,
        title: l.title,
        summary: l.summary,
        pattern: l.pattern,
        patternLabel: patternLabel(l.pattern),
        exercises: l.exercises.length,
        done: !!p?.completedAt,
        bestScore: p?.bestScore ?? null,
        tried: !!p,
      };
    });
    return {
      level,
      levels: GRAMMAR_LEVELS.map((lv) => {
        const atLevel = lessons.filter((l) => l.level === lv);
        return { level: lv, total: atLevel.length, done: atLevel.filter((l) => l.done).length };
      }),
      lessons,
      done: lessons.filter((l) => l.done).length,
      recommended: this.recommend(lessons, level, repeating),
    };
  }

  /** The lesson to suggest: one for the mistake you keep making, else the next one at your level, else any */
  private recommend(
    lessons: Array<{ id: string; level: GrammarLevel; pattern: string | null; done: boolean }>,
    level: GrammarLevel,
    repeating: Array<{ pattern: string | null; _count: { _all: number } }>,
  ): { id: string; reason: string } | null {
    const top = repeating
      .filter((r) => r.pattern && r._count._all >= REPEAT_FROM)
      .sort((a, b) => b._count._all - a._count._all)
      .find((r) => lessons.some((l) => !l.done && l.pattern === r.pattern));
    if (top?.pattern) {
      const lesson = lessons.find((l) => !l.done && l.pattern === top.pattern);
      if (lesson) return { id: lesson.id, reason: `You keep making ${patternLabel(top.pattern)?.toLowerCase()} mistakes` };
    }
    const mine = lessons.find((l) => !l.done && l.level === level);
    if (mine) return { id: mine.id, reason: `Next at your level (${level})` };
    const any = lessons.find((l) => !l.done);
    return any ? { id: any.id, reason: 'Your next lesson' } : null;
  }

  /** One lesson: the rules, the common mistakes, and the exercises (options shuffled for this learner, no answers) */
  async get(userId: string, id: string) {
    const lesson = LESSON_BY_ID.get(id);
    if (!lesson) throw new NotFoundException('Lesson not found');
    const progress = await this.prisma.grammarProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: id } } });
    const sameLevel = GRAMMAR.filter((l) => l.level === lesson.level);
    const index = GRAMMAR.findIndex((l) => l.id === id);
    const next = GRAMMAR[index + 1];
    return {
      id: lesson.id,
      level: lesson.level,
      title: lesson.title,
      summary: lesson.summary,
      intro: lesson.intro,
      pattern: lesson.pattern,
      patternLabel: patternLabel(lesson.pattern),
      rules: lesson.rules,
      mistakes: lesson.mistakes,
      exercises: lesson.exercises.map((ex) => this.present(userId, lesson, ex)),
      positionInLevel: { index: sameLevel.findIndex((l) => l.id === id) + 1, of: sameLevel.length },
      progress: progress ? { bestScore: progress.bestScore, total: progress.total, attempts: progress.attempts, done: !!progress.completedAt } : null,
      next: next ? { id: next.id, title: next.title, level: next.level } : null,
    };
  }

  /** What the page needs to show one exercise, without the answer */
  private present(userId: string, lesson: GrammarLesson, ex: GrammarExercise) {
    const seed = seedFor(userId, lesson.id, ex.id);
    switch (ex.kind) {
      case 'blank':
      case 'correct': {
        // The same shuffle the judge uses, so what is shown and what is marked always agree.
        // order[i] is the index in the bank (0 = right) of the option shown at position i.
        const order = optionOrder(seed, ex.options.length);
        return { id: ex.id, kind: ex.kind, prompt: ex.prompt, options: order.map((i) => ex.options[i]) };
      }
      case 'order':
        return { id: ex.id, kind: ex.kind, prompt: ex.prompt, words: shuffledWords(seed, ex.words) };
      case 'type':
        return { id: ex.id, kind: ex.kind, prompt: ex.prompt };
    }
  }

  /** Marks one answer straight away so the page can show feedback while you practise. Saves nothing. */
  check(userId: string, lessonId: string, exerciseId: string, answer: unknown) {
    const lesson = LESSON_BY_ID.get(lessonId);
    const ex = lesson?.exercises.find((e) => e.id === exerciseId);
    if (!lesson || !ex) throw new NotFoundException('Exercise not found');
    const result = judge(ex, answer, seedFor(userId, lessonId, exerciseId));
    if (!result.answered) throw new BadRequestException('Send an answer');
    return { id: ex.id, correct: result.correct, correctText: result.corrected, explanation: ex.explanation };
  }

  /**
   * Marks the whole lesson. Passing it the first time earns XP; every wrong answer becomes a flashcard
   * (once per exercise) so it comes back in spaced review, filed under the lesson's mistake type.
   */
  async finish(userId: string, lessonId: string, answers: unknown) {
    const lesson = LESSON_BY_ID.get(lessonId);
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (!answers || typeof answers !== 'object') throw new BadRequestException('Send your answers');
    const given = answers as Record<string, unknown>;

    const judged = lesson.exercises.map((ex) => ({ ex, result: judge(ex, given[ex.id], seedFor(userId, lessonId, ex.id)) }));
    if (judged.some((j) => !j.result.answered)) throw new BadRequestException('Answer every exercise first');

    const total = judged.length;
    const score = judged.filter((j) => j.result.correct).length;
    const passed = score >= passMark(total);

    const existing = await this.prisma.grammarProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
    const firstPass = passed && !existing?.completedAt;
    await this.prisma.grammarProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, bestScore: score, total, attempts: 1, ...(passed ? { completedAt: new Date() } : {}) },
      update: {
        bestScore: Math.max(existing?.bestScore ?? 0, score),
        total,
        attempts: { increment: 1 },
        ...(firstPass ? { completedAt: new Date() } : {}),
      },
    });

    // Wrong answers go to the review loop; a repeat of the same exercise never makes a second card
    let cardsAdded = 0;
    for (const { ex, result } of judged) {
      if (result.correct) continue;
      const added = await this.review.addCorrectionCard(
        userId,
        {
          source: 'grammar',
          sourceId: `${lessonId}:${ex.id}`,
          original: result.original,
          corrected: result.corrected,
          note: `${lesson.title}: ${ex.explanation}`,
          pattern: lesson.pattern,
        },
        { ignoreDailyLimit: true },
      );
      if (added?.created) cardsAdded++;
    }

    if (firstPass) {
      await this.activity.recordActivity(userId, GRAMMAR_XP, 'EXERCISE_COMPLETED');
    }
    if (passed) void this.badges?.evaluate(userId);
    const challenges = (await this.challenges?.resolve(userId, 'grammar', lessonId, score, total)) ?? [];

    return {
      challenges,
      score,
      total,
      passed,
      perfect: score === total,
      firstPass,
      xp: firstPass ? GRAMMAR_XP : 0,
      cardsAdded,
      results: judged.map(({ ex, result }) => ({
        id: ex.id,
        correct: result.correct,
        original: result.original,
        correctText: result.corrected,
        explanation: ex.explanation,
      })),
    };
  }
}
