import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { BadgesService } from '../gamification/badges.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { LIBRARY, LIBRARY_LEVELS, optionOrder, readingMinutes, TEXT_BY_ID, type LibraryLevel } from './library.content';

/** XP the first time you finish a text */
export const LIBRARY_XP = 8;

@Injectable()
export class LibraryService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    // Reading badges; optional so the library works (and tests stay simple) without it
    @Optional() private badges?: BadgesService,
  ) {}

  /** Every text with your progress, and your level so the page can start there */
  async list(userId: string) {
    const [profile, progress] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.prisma.libraryProgress.findMany({ where: { userId } }),
    ]);
    const byText = new Map(progress.map((p) => [p.textId, p]));
    const texts = LIBRARY.map((t) => {
      const p = byText.get(t.id);
      return {
        id: t.id,
        level: t.level,
        kind: t.kind,
        title: t.title,
        topic: t.topic,
        summary: t.summary,
        minutes: readingMinutes(t),
        questions: t.questions.length,
        done: !!p?.completedAt,
        bestScore: p?.bestScore ?? null,
      };
    });
    return {
      level: practiceLevel(profile?.level) as LibraryLevel,
      levels: LIBRARY_LEVELS.map((level) => {
        const atLevel = texts.filter((t) => t.level === level);
        return { level, total: atLevel.length, done: atLevel.filter((t) => t.done).length };
      }),
      texts,
      done: texts.filter((t) => t.done).length,
    };
  }

  /** One text to read and listen to, with its questions (options shuffled for this reader, no answers) */
  async get(userId: string, id: string) {
    const text = TEXT_BY_ID.get(id);
    if (!text) throw new NotFoundException('Text not found');
    const progress = await this.prisma.libraryProgress.findUnique({ where: { userId_textId: { userId, textId: id } } });
    // The next text at the same level, for "Read the next one"
    const sameLevel = LIBRARY.filter((t) => t.level === text.level);
    const next = sameLevel[(sameLevel.findIndex((t) => t.id === id) + 1) % sameLevel.length];
    return {
      id: text.id,
      level: text.level,
      kind: text.kind,
      title: text.title,
      topic: text.topic,
      summary: text.summary,
      minutes: readingMinutes(text),
      sentences: text.sentences,
      questions: text.questions.map((q) => {
        const order = optionOrder(`${userId}:${id}:${q.id}`, q.options.length);
        return { id: q.id, question: q.question, options: order.map((i) => q.options[i]) };
      }),
      progress: progress ? { bestScore: progress.bestScore, total: progress.total, attempts: progress.attempts, done: !!progress.completedAt } : null,
      next: next && next.id !== id ? { id: next.id, title: next.title } : null,
    };
  }

  /**
   * Checks the answers (the index of the option chosen, as shown), shows the right ones with an explanation
   * and the sentence that holds each answer, and saves the best score. Finishing a text the first time
   * earns XP.
   */
  async answer(userId: string, id: string, answers: unknown) {
    const text = TEXT_BY_ID.get(id);
    if (!text) throw new NotFoundException('Text not found');
    if (!answers || typeof answers !== 'object') throw new BadRequestException('Send your answers');
    const chosen = answers as Record<string, unknown>;

    const results = text.questions.map((q) => {
      const order = optionOrder(`${userId}:${id}:${q.id}`, q.options.length);
      const pick = Number(chosen[q.id]);
      const answered = Number.isInteger(pick) && pick >= 0 && pick < order.length;
      return {
        id: q.id,
        chosen: answered ? pick : null,
        correct: answered && order[pick] === 0,
        correctIndex: order.indexOf(0),
        explanation: q.explanation,
        sentence: q.sentence,
      };
    });
    if (results.some((r) => r.chosen === null)) throw new BadRequestException('Answer every question first');

    const score = results.filter((r) => r.correct).length;
    const total = results.length;
    const existing = await this.prisma.libraryProgress.findUnique({ where: { userId_textId: { userId, textId: id } } });
    const firstCompletion = !existing?.completedAt;
    await this.prisma.libraryProgress.upsert({
      where: { userId_textId: { userId, textId: id } },
      create: { userId, textId: id, bestScore: score, total, attempts: 1, completedAt: new Date() },
      update: {
        bestScore: Math.max(existing?.bestScore ?? 0, score),
        total,
        attempts: { increment: 1 },
        ...(firstCompletion ? { completedAt: new Date() } : {}),
      },
    });
    if (firstCompletion) {
      await this.activity.recordActivity(userId, LIBRARY_XP, 'LESSON_COMPLETED');
      void this.badges?.evaluate(userId);
    }
    return { score, total, results, firstCompletion, xp: firstCompletion ? LIBRARY_XP : 0 };
  }
}
