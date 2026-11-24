// server/src/learning/exercises.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { localParts } from '../notifications/daily-reminder.engine';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { ActivityService } from './activity.service';
import { ReviewService } from './review.service';
import {
  EXERCISES_XP,
  EXERCISE_LEVELS,
  EXERCISE_SKILLS,
  SET_SIZE,
  findExercise,
  isExerciseLevel,
  isExerciseSkill,
  judgeExercise,
  passMark,
  pickSet,
  presentExercise,
  setSeed,
} from './exercises.engine';

/** Finished sets are kept with the word games' results */
export const EXERCISES_GAME = 'exercises';
const MAX_ROUND = 9999;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ExercisesService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private review: ReviewService,
  ) {}

  /** The next set at the level and skill asked for (your own level by default) */
  async session(userId: string, query: { level?: unknown; skill?: unknown }, now = new Date()) {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true, timezone: true } });
    const level = isExerciseLevel(query.level) ? query.level : practiceLevel(profile?.level);
    const skill = isExerciseSkill(query.skill) ? query.skill : 'mixed';
    const day = localParts(now, profile?.timezone).day;
    const [doneToday, passedToday] = await Promise.all([
      this.prisma.gameResult.count({ where: { userId, game: EXERCISES_GAME, day } }),
      this.prisma.gameResult.count({ where: { userId, game: EXERCISES_GAME, day, won: true } }),
    ]);
    const round = Math.min(doneToday, MAX_ROUND);
    const items = pickSet(level, skill, setSeed(userId, day, level, skill, round)).map((ref) => presentExercise(ref, userId));
    return {
      level,
      skill,
      day,
      round,
      levels: EXERCISE_LEVELS,
      skills: EXERCISE_SKILLS,
      doneToday,
      xpAvailable: passedToday === 0,
      xp: EXERCISES_XP,
      passMark: passMark(items.length || SET_SIZE),
      items,
    };
  }

  /** Marks one answer now, for instant feedback. Saves nothing. */
  check(userId: string, id: unknown, answer: unknown) {
    const ref = findExercise(id);
    if (!ref) throw new NotFoundException('Exercise not found');
    const result = judgeExercise(ref, answer, userId);
    if (!result.answered) throw new BadRequestException('Send an answer');
    return { id: ref.id, correct: result.correct, correctText: result.corrected, explanation: result.explanation };
  }

  /**
   * Marks a whole set from the server's own copy of it. The first set passed each day earns XP, and every
   * mistake goes into flashcard review.
   */
  async finish(
    userId: string,
    body: { level?: unknown; skill?: unknown; day?: unknown; round?: unknown; answers?: unknown },
    now = new Date(),
  ) {
    const { level, skill, day, round, answers } = body ?? {};
    if (!isExerciseLevel(level) || !isExerciseSkill(skill)) throw new BadRequestException('Choose a level and a skill');
    const roundNumber = Number(round);
    if (!Number.isInteger(roundNumber) || roundNumber < 0 || roundNumber > MAX_ROUND) throw new BadRequestException('This set is not valid');
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new BadRequestException('Send your answers');

    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { timezone: true } });
    const today = localParts(now, profile?.timezone).day;
    // A set started just before midnight can still be finished
    const yesterday = localParts(new Date(now.getTime() - DAY_MS), profile?.timezone).day;
    if (day !== today && day !== yesterday) throw new BadRequestException('This set has expired. Start a new one.');

    const given = answers as Record<string, unknown>;
    const set = pickSet(level, skill, setSeed(userId, day, level, skill, roundNumber));
    const judged = set.map((ref) => ({ ref, result: judgeExercise(ref, given[ref.id], userId) }));
    if (!judged.length || judged.some((j) => !j.result.answered)) throw new BadRequestException('Answer every exercise first');

    const total = judged.length;
    const score = judged.filter((j) => j.result.correct).length;
    const passed = score >= passMark(total);

    const alreadyPassed = await this.prisma.gameResult.count({ where: { userId, game: EXERCISES_GAME, day: today, won: true } });
    await this.prisma.gameResult.create({ data: { userId, game: EXERCISES_GAME, day: today, won: passed, score } });
    const xp = passed && alreadyPassed === 0 ? EXERCISES_XP : 0;
    if (xp) await this.activity.recordActivity(userId, xp, 'EXERCISE_COMPLETED');

    // The same source ids as the lessons and packs, so a mistake never makes a second card
    let cardsAdded = 0;
    for (const { ref, result } of judged) {
      if (result.correct) continue;
      const added =
        ref.skill === 'grammar'
          ? await this.review.addCorrectionCard(
              userId,
              {
                source: 'grammar',
                sourceId: `${ref.lesson.id}:${ref.exercise.id}`,
                original: result.original,
                corrected: result.corrected,
                note: `${ref.lesson.title}: ${ref.exercise.explanation}`,
                pattern: ref.lesson.pattern,
              },
              { ignoreDailyLimit: true },
            )
          : await this.review.addWordCard(userId, {
              source: 'pack',
              sourceId: `${ref.pack.id}:${ref.word.id}`,
              word: ref.word.word,
              meaning: ref.word.meaning,
              example: ref.word.example,
            });
      if (added?.created) cardsAdded++;
    }

    return {
      score,
      total,
      passed,
      perfect: score === total,
      passMark: passMark(total),
      xp,
      cardsAdded,
      results: judged.map(({ ref, result }) => ({
        id: ref.id,
        correct: result.correct,
        original: result.original,
        correctText: result.corrected,
        explanation: result.explanation,
      })),
    };
  }
}
