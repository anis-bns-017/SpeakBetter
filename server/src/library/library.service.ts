import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { BadgesService } from '../gamification/badges.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { LIBRARY, LIBRARY_LEVELS, layoutFor, readingMinutes, TEXT_BY_ID, topicsOf, wordCount, type LibraryLevel } from './library.content';

/** XP the first time you finish a text */
export const LIBRARY_XP = 8;

/** The id a saved library word has on its flashcard: "<textId>:<word>" */
export const wordCardId = (textId: string, word: string) => `${textId}:${word.toLowerCase()}`;

@Injectable()
export class LibraryService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    // Reading badges; optional so the library works (and tests stay simple) without it
    @Optional() private badges?: BadgesService,
    // Saving key words as flashcards
    @Optional() private review?: ReviewService,
  ) {}

  /** Every text with your progress, your level so the page can start there, and what to read next */
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
        words: wordCount(t),
        questions: t.questions.length,
        keyWords: t.vocab.length,
        done: !!p?.completedAt,
        started: !!p && !p.completedAt,
        bestScore: p?.bestScore ?? null,
      };
    });
    const level = practiceLevel(profile?.level) as LibraryLevel;
    const finished = LIBRARY.filter((t) => byText.get(t.id)?.completedAt);
    // The first unread text at your level; if you have read them all, the first one at the next level
    const start = LIBRARY_LEVELS.indexOf(level);
    const recommended =
      LIBRARY_LEVELS.slice(start)
        .map((lv) => texts.find((t) => t.level === lv && !t.done))
        .find(Boolean) ?? texts.find((t) => !t.done) ?? null;

    return {
      level,
      levels: LIBRARY_LEVELS.map((lv) => {
        const atLevel = texts.filter((t) => t.level === lv);
        return { level: lv, total: atLevel.length, done: atLevel.filter((t) => t.done).length };
      }),
      topics: topicsOf(),
      texts,
      done: texts.filter((t) => t.done).length,
      stats: {
        wordsRead: finished.reduce((n, t) => n + wordCount(t), 0),
        minutesRead: finished.reduce((n, t) => n + readingMinutes(t), 0),
        perfect: [...byText.values()].filter((p) => p.completedAt && p.total > 0 && p.bestScore === p.total).length,
      },
      recommended: recommended ? { id: recommended.id, title: recommended.title, level: recommended.level, minutes: recommended.minutes } : null,
    };
  }

  /** One text to read and listen to, with its questions (options shuffled for this reader, no answers) */
  async get(userId: string, id: string) {
    const text = TEXT_BY_ID.get(id);
    if (!text) throw new NotFoundException('Text not found');
    const [progress, saved] = await Promise.all([
      this.prisma.libraryProgress.findUnique({ where: { userId_textId: { userId, textId: id } } }),
      this.prisma.flashcard?.findMany
        ? this.prisma.flashcard.findMany({ where: { userId, source: 'library', sourceId: { startsWith: `${id}:` } }, select: { sourceId: true } })
        : Promise.resolve([] as Array<{ sourceId: string | null }>),
    ]);
    const savedIds = new Set(saved.map((c: { sourceId: string | null }) => c.sourceId));
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
      words: wordCount(text),
      sentences: text.sentences,
      vocab: text.vocab.map((w) => ({ word: w.word, meaning: w.meaning, sentence: w.sentence, saved: savedIds.has(wordCardId(id, w.word)) })),
      discuss: text.discuss,
      questions: text.questions.map((q) => {
        const { order } = layoutFor(userId, id, q);
        return { id: q.id, type: q.type, question: q.question, options: order.map((i) => q.options[i]) };
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
      const { order, correctIndex } = layoutFor(userId, id, q);
      const pick = Number(chosen[q.id]);
      const answered = Number.isInteger(pick) && pick >= 0 && pick < order.length;
      return {
        id: q.id,
        type: q.type,
        chosen: answered ? pick : null,
        correct: answered && pick === correctIndex,
        correctIndex,
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

  /** Saves one of a text's key words as a flashcard, so it joins spaced review (once per word) */
  async saveWord(userId: string, id: string, word: unknown) {
    const text = TEXT_BY_ID.get(id);
    if (!text) throw new NotFoundException('Text not found');
    const entry = text.vocab.find((w) => w.word.toLowerCase() === String(word ?? '').trim().toLowerCase());
    if (!entry) throw new BadRequestException('That word is not one of this text\'s key words');
    const example = text.sentences[entry.sentence]?.text ?? null;
    const sourceId = wordCardId(id, entry.word);
    const exists = this.prisma.flashcard?.count ? (await this.prisma.flashcard.count({ where: { userId, source: 'library', sourceId } })) > 0 : false;
    if (exists) return { word: entry.word, saved: true, created: false };
    const result = await this.review?.addWordCard(userId, { source: 'library', sourceId, word: entry.word, meaning: entry.meaning, example });
    return { word: entry.word, saved: !!result, created: !!result?.created };
  }
}
