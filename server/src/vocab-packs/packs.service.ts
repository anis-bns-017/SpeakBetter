import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { BadgesService } from '../gamification/badges.service';
import { FriendChallengesService } from '../friend-challenges/friend-challenges.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { CATEGORIES, PACKS, PACK_BY_ID, PACK_LEVELS, type PackLevel, type VocabPack } from './packs.content';
import { PACK_XP, buildQuiz, judge, passMark, quizSeed, shownOrder } from './packs.engine';
import { meaningChoices, wordOfDay } from './word-of-day';
import { localParts } from '../notifications/daily-reminder.engine';

/** Flashcard.sourceId for a pack word, so the same word never makes two cards */
export const cardSourceId = (packId: string, wordId: string) => `${packId}:${wordId}`;

@Injectable()
export class VocabPacksService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private review: ReviewService,
    // Pack badges; optional so packs work (and tests stay simple) without it
    @Optional() private badges?: BadgesService,
    @Optional() private challenges?: FriendChallengesService,
  ) {}

  /** Ids of the pack words this learner already has as flashcards, grouped by pack */
  private async savedWords(userId: string, packId?: string): Promise<Map<string, Set<string>>> {
    const cards = await this.prisma.flashcard.findMany({
      where: { userId, source: 'pack', ...(packId ? { sourceId: { startsWith: `${packId}:` } } : {}) },
      select: { sourceId: true },
    });
    const byPack = new Map<string, Set<string>>();
    for (const { sourceId } of cards) {
      const [pack, word] = String(sourceId).split(':');
      if (!pack || !word) continue;
      if (!byPack.has(pack)) byPack.set(pack, new Set());
      byPack.get(pack)!.add(word);
    }
    return byPack;
  }

  /** Every pack with your progress, your level, and the pack to start next */
  async list(userId: string) {
    const [profile, progress, saved] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.prisma.vocabPackProgress.findMany({ where: { userId } }),
      this.savedWords(userId),
    ]);
    const level = practiceLevel(profile?.level) as PackLevel;
    const byPack = new Map(progress.map((p) => [p.packId, p]));
    const packs = PACKS.map((p) => {
      const pr = byPack.get(p.id);
      return {
        id: p.id,
        level: p.level,
        category: p.category,
        title: p.title,
        topic: p.topic,
        icon: p.icon,
        summary: p.summary,
        words: p.words.length,
        saved: saved.get(p.id)?.size ?? 0,
        done: !!pr?.completedAt,
        bestScore: pr?.bestScore ?? null,
        total: pr?.total ?? null,
      };
    });
    return {
      level,
      levels: PACK_LEVELS.map((lv) => {
        const atLevel = packs.filter((p) => p.level === lv);
        return { level: lv, total: atLevel.length, done: atLevel.filter((p) => p.done).length };
      }),
      categories: CATEGORIES.map((c) => {
        const inside = packs.filter((p) => p.category === c.id);
        return { ...c, total: inside.length, done: inside.filter((p) => p.done).length, words: inside.reduce((n, p) => n + p.words, 0) };
      }),
      packs,
      done: packs.filter((p) => p.done).length,
      wordsSaved: packs.reduce((n, p) => n + p.saved, 0),
      recommended: (packs.find((p) => !p.done && p.level === level) ?? packs.find((p) => !p.done))?.id ?? null,
    };
  }

  /**
   * Today's word for this learner: chosen by their level and their own calendar day, with three meanings for a
   * quick "Do you know it?" and whether it is already in their review. Nothing is at stake, so the right answer
   * comes with it.
   */
  async today(userId: string, now = new Date()) {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true, timezone: true } });
    const level = practiceLevel(profile?.level) as PackLevel;
    const day = localParts(now, profile?.timezone).day;
    const word = wordOfDay(level, day);
    const saved = (await this.prisma.flashcard.count({ where: { userId, source: 'pack', sourceId: cardSourceId(word.packId, word.wordId) } })) > 0;
    return { day, ...word, saved, ...meaningChoices(word, day) };
  }

  /** One pack: its words (with which are saved), and this attempt's quiz without the answers */
  async get(userId: string, id: string) {
    const pack = this.pack(id);
    const [progress, saved] = await Promise.all([
      this.prisma.vocabPackProgress.findUnique({ where: { userId_packId: { userId, packId: id } } }),
      this.savedWords(userId, id),
    ]);
    const seed = quizSeed(userId, id, progress?.attempts ?? 0);
    const savedIds = saved.get(id) ?? new Set<string>();
    const index = PACKS.findIndex((p) => p.id === id);
    const next = PACKS[index + 1];
    return {
      id: pack.id,
      level: pack.level,
      category: pack.category,
      title: pack.title,
      topic: pack.topic,
      icon: pack.icon,
      summary: pack.summary,
      words: pack.words.map((w) => ({ id: w.id, word: w.word, pos: w.pos, meaning: w.meaning, example: w.example, saved: savedIds.has(w.id) })),
      quiz: buildQuiz(pack, seed).map((q) => ({
        id: q.id,
        kind: q.kind,
        prompt: q.prompt,
        options: shownOrder(seed, q).map((i) => q.options[i]),
      })),
      progress: progress ? { bestScore: progress.bestScore, total: progress.total, attempts: progress.attempts, done: !!progress.completedAt } : null,
      next: next ? { id: next.id, title: next.title } : null,
    };
  }

  /** Puts words from the pack into your flashcard review; all of them when no ids are given */
  async save(userId: string, id: string, wordIds?: unknown) {
    const pack = this.pack(id);
    const wanted = Array.isArray(wordIds) ? new Set(wordIds.map(String)) : null;
    const words = pack.words.filter((w) => !wanted || wanted.has(w.id));
    if (!words.length) throw new BadRequestException('No words to save');
    let added = 0;
    for (const w of words) {
      const result = await this.review.addWordCard(userId, { source: 'pack', sourceId: cardSourceId(id, w.id), word: w.word, meaning: w.meaning, example: w.example });
      if (result?.created) added++;
    }
    const saved = (await this.savedWords(userId, id)).get(id)?.size ?? 0;
    void this.badges?.evaluate(userId);
    return { added, saved, total: pack.words.length };
  }

  /** Marks one quiz answer straight away for feedback. Saves nothing. */
  async check(userId: string, id: string, questionId: string, answer: unknown) {
    const pack = this.pack(id);
    const progress = await this.prisma.vocabPackProgress.findUnique({ where: { userId_packId: { userId, packId: id } } });
    const seed = quizSeed(userId, id, progress?.attempts ?? 0);
    const question = buildQuiz(pack, seed).find((q) => q.id === questionId);
    if (!question) throw new NotFoundException('Question not found');
    const result = judge(question, answer, seed);
    if (!result.answered) throw new BadRequestException('Send an answer');
    const word = pack.words.find((w) => w.id === question.wordId)!;
    return { id: question.id, correct: result.correct, correctText: result.right, meaning: word.meaning, example: word.example };
  }

  /**
   * Marks the whole quiz. Passing it the first time earns XP, and every word you missed goes into your
   * flashcard review so it comes back.
   */
  async finish(userId: string, id: string, answers: unknown) {
    const pack = this.pack(id);
    if (!answers || typeof answers !== 'object') throw new BadRequestException('Send your answers');
    const given = answers as Record<string, unknown>;

    const existing = await this.prisma.vocabPackProgress.findUnique({ where: { userId_packId: { userId, packId: id } } });
    const seed = quizSeed(userId, id, existing?.attempts ?? 0);
    const quiz = buildQuiz(pack, seed);
    const judged = quiz.map((q) => ({ q, result: judge(q, given[q.id], seed) }));
    if (judged.some((j) => !j.result.answered)) throw new BadRequestException('Answer every question first');

    const total = judged.length;
    const score = judged.filter((j) => j.result.correct).length;
    const passed = score >= passMark(total);
    const firstPass = passed && !existing?.completedAt;

    await this.prisma.vocabPackProgress.upsert({
      where: { userId_packId: { userId, packId: id } },
      create: { userId, packId: id, bestScore: score, total, attempts: 1, ...(passed ? { completedAt: new Date() } : {}) },
      update: {
        bestScore: Math.max(existing?.bestScore ?? 0, score),
        total,
        attempts: { increment: 1 },
        ...(firstPass ? { completedAt: new Date() } : {}),
      },
    });

    let wordsAdded = 0;
    for (const { q, result } of judged) {
      if (result.correct) continue;
      const word = pack.words.find((w) => w.id === q.wordId)!;
      const added = await this.review.addWordCard(userId, { source: 'pack', sourceId: cardSourceId(id, word.id), word: word.word, meaning: word.meaning, example: word.example });
      if (added?.created) wordsAdded++;
    }

    if (firstPass) await this.activity.recordActivity(userId, PACK_XP, 'VOCABULARY_MASTERED');
    if (passed || wordsAdded) void this.badges?.evaluate(userId);
    const challenges = (await this.challenges?.resolve(userId, 'pack', id, score, total)) ?? [];

    return {
      challenges,
      score,
      total,
      passed,
      perfect: score === total,
      firstPass,
      xp: firstPass ? PACK_XP : 0,
      wordsAdded,
      results: judged.map(({ q, result }) => {
        const word = pack.words.find((w) => w.id === q.wordId)!;
        return { id: q.id, correct: result.correct, chosen: result.chosen, correctText: result.right, meaning: word.meaning, example: word.example };
      }),
    };
  }

  private pack(id: string): VocabPack {
    const pack = PACK_BY_ID.get(id);
    if (!pack) throw new NotFoundException('Pack not found');
    return pack;
  }
}
