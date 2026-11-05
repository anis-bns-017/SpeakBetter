import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { BadgesService } from '../gamification/badges.service';
import { FriendChallengesService } from '../friend-challenges/friend-challenges.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { localParts } from '../notifications/daily-reminder.engine';
import type { LibraryLevel } from '../library/library.content';
import { DICTATION_XP, SESSION_SIZE, itemById, markDictation, pickSession } from './dictation.engine';

const MAX_TYPED = 400;

@Injectable()
export class DictationService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private review: ReviewService,
    @Optional() private badges?: BadgesService,
    @Optional() private challenges?: FriendChallengesService,
  ) {}

  private async context(userId: string, now: Date) {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true, timezone: true } });
    const day = localParts(now, profile?.timezone).day;
    const done = await this.prisma.dictationResult.count({ where: { userId, day } });
    return { level: practiceLevel(profile?.level) as LibraryLevel, day, done };
  }

  /**
   * Today's next dictation: six sentences at your level. The text comes along because the browser reads it
   * aloud; the page keeps it hidden until you have answered.
   */
  async session(userId: string, now = new Date()) {
    const { level, day, done } = await this.context(userId, now);
    const [best, total] = await Promise.all([
      this.prisma.dictationResult.findFirst({ where: { userId }, orderBy: { score: 'desc' }, select: { score: true } }),
      this.prisma.dictationResult.count({ where: { userId } }),
    ]);
    return {
      level,
      day,
      attempt: done,
      doneToday: done,
      finished: total,
      bestScore: best?.score ?? null,
      items: pickSession(level, `${userId}:${day}:${done}`).map((i) => ({ id: i.id, text: i.text })),
    };
  }

  /**
   * Sentences to shadow (listen, then say them back): the same graded sentences as dictation, a set of six per
   * round so "New set" gives different ones. Scoring goes through the pronunciation attempts, which already
   * count toward the plan, XP and badges.
   */
  async shadowing(userId: string, round: unknown, now = new Date()) {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true, timezone: true } });
    const level = practiceLevel(profile?.level) as LibraryLevel;
    const day = localParts(now, profile?.timezone).day;
    const r = Math.max(0, Math.min(999, Math.floor(Number(round)) || 0));
    return { level, round: r, items: pickSession(level, `${userId}:${day}:shadow:${r}`).map((i) => ({ id: i.id, text: i.text })) };
  }

  /** Marks one sentence now, for instant feedback. Saves nothing. */
  check(id: string, typed: unknown) {
    const item = itemById(id);
    if (!item) throw new NotFoundException('Sentence not found');
    const text = typeof typed === 'string' ? typed.slice(0, MAX_TYPED) : '';
    if (!text.trim()) throw new BadRequestException('Type what you heard first');
    return { id, text: item.text, ...markDictation(item.text, text) };
  }

  /**
   * Marks the whole dictation and saves it. The first one each day earns XP; every sentence you did not get
   * fully right goes into your flashcard review.
   */
  async finish(userId: string, answers: unknown, now = new Date()) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new BadRequestException('Send your answers');
    const entries = Object.entries(answers as Record<string, unknown>).slice(0, SESSION_SIZE * 2);
    if (!entries.length) throw new BadRequestException('Send your answers');

    const results = entries.map(([id, typed]) => {
      const item = itemById(id);
      if (!item) throw new BadRequestException('Unknown sentence');
      const text = typeof typed === 'string' ? typed.slice(0, MAX_TYPED) : '';
      return { id, text: item.text, typed: text, ...markDictation(item.text, text) };
    });

    const correctWords = results.reduce((s, r) => s + r.correct, 0);
    const totalWords = results.reduce((s, r) => s + r.total, 0);
    const score = totalWords ? Math.round((correctWords / totalWords) * 100) : 0;
    const perfect = results.every((r) => r.correct === r.total);

    const { day, done } = await this.context(userId, now);
    await this.prisma.dictationResult.create({
      data: { userId, day, sentences: results.length, perfectSentences: results.filter((r) => r.correct === r.total).length, correctWords, totalWords, score },
    });

    // Sentences you got wrong come back in review: what you typed on the front, the real sentence on the back
    let cardsAdded = 0;
    for (const r of results) {
      if (r.correct === r.total || !r.typed.trim()) continue;
      const added = await this.review.addCorrectionCard(userId, {
        source: 'dictation',
        sourceId: r.id,
        original: r.typed,
        corrected: r.text,
        note: 'From a listening dictation',
      });
      if (added?.created) cardsAdded++;
    }

    const firstToday = done === 0;
    if (firstToday) await this.activity.recordActivity(userId, DICTATION_XP, 'EXERCISE_COMPLETED');
    void this.badges?.evaluate(userId);
    const challenges = (await this.challenges?.resolve(userId, 'dictation', 'dictation', score, 100)) ?? [];

    return {
      challenges,
      score,
      correctWords,
      totalWords,
      perfect,
      xp: firstToday ? DICTATION_XP : 0,
      cardsAdded,
      results: results.map(({ id, text, typed, tokens, correct, total, score: s }) => ({ id, text, typed, tokens, correct, total, score: s })),
    };
  }
}
