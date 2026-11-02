import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { getItem, type PlacementItem } from './placement.bank';
import {
  QUESTION_COUNT,
  analyzeSpeaking,
  optionOrder,
  pickNextItem,
  scoreAttempt,
  seededRng,
  type AnswerRecord,
  type PlacementResult,
} from './placement.engine';

/** Retaking is allowed once a day, so the test can't be farmed or guessed through */
export const RETAKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** An unfinished test older than this is left behind and a new one starts */
const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface PublicQuestion {
  id: string;
  skill: PlacementItem['skill'];
  prompt: string;
  passage?: string;
  audio?: string;
  options: string[];
}

@Injectable()
export class PlacementService {
  constructor(private prisma: PrismaService) {}

  /** The question as the learner sees it: shuffled options, no answer, no level */
  present(attemptId: string, item: PlacementItem): PublicQuestion {
    const order = optionOrder(attemptId, item.id, item.options.length);
    return {
      id: item.id,
      skill: item.skill,
      prompt: item.prompt,
      ...(item.passage ? { passage: item.passage } : {}),
      ...(item.audio ? { audio: item.audio } : {}),
      options: order.map((i) => item.options[i]),
    };
  }

  async getStatus(userId: string) {
    const [profile, completed, inProgress] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { level: true, levelAssessedAt: true },
      }),
      this.prisma.placementAttempt.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
      }),
      this.findResumable(userId),
    ]);

    const retakeAt = completed?.completedAt
      ? new Date(completed.completedAt.getTime() + RETAKE_COOLDOWN_MS)
      : null;

    return {
      level: profile?.level ?? null,
      assessedAt: profile?.levelAssessedAt ?? null,
      attemptId: completed?.id ?? null,
      result: (completed?.result as unknown as PlacementResult | null) ?? null,
      speaking: completed?.speaking ?? null,
      inProgress: inProgress
        ? { attemptId: inProgress.id, answered: this.answersOf(inProgress).length }
        : null,
      retakeAvailableAt: retakeAt && retakeAt.getTime() > Date.now() ? retakeAt : null,
      totalQuestions: QUESTION_COUNT,
    };
  }

  async start(userId: string) {
    const resumable = await this.findResumable(userId);
    if (resumable) return this.state(resumable);

    const last = await this.prisma.placementAttempt.findFirst({
      where: { userId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });
    if (last?.completedAt) {
      const retakeAt = new Date(last.completedAt.getTime() + RETAKE_COOLDOWN_MS);
      if (retakeAt.getTime() > Date.now()) {
        throw new HttpException(
          { message: 'You can retake the test once a day.', retryAt: retakeAt.toISOString() },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const created = await this.prisma.placementAttempt.create({ data: { userId } });
    const first = pickNextItem([], seededRng(`${created.id}:next:0`));
    if (!first) throw new BadRequestException('The placement test has no questions');
    const attempt = await this.prisma.placementAttempt.update({
      where: { id: created.id },
      data: { currentItemId: first.id },
    });
    return this.state(attempt);
  }

  /** `choice` is the position of the option shown to the learner; null means "I don't know" */
  async answer(userId: string, attemptId: string, itemId: string, choice: number | null, ms?: number) {
    const attempt = await this.prisma.placementAttempt.findFirst({ where: { id: attemptId, userId } });
    if (!attempt) throw new NotFoundException('Placement test not found');
    if (attempt.status === 'COMPLETED') throw new BadRequestException('This test is already finished');
    if (attempt.currentItemId !== itemId) {
      throw new BadRequestException('That is not the current question');
    }
    const item = getItem(itemId);
    if (!item) throw new BadRequestException('Unknown question');

    const order = optionOrder(attempt.id, item.id, item.options.length);
    if (choice !== null && (!Number.isInteger(choice) || choice < 0 || choice >= order.length)) {
      throw new BadRequestException('Choose one of the listed options');
    }
    // options[0] is the correct answer in the bank
    const correct = choice !== null && order[choice] === 0;

    const answers: AnswerRecord[] = [
      ...this.answersOf(attempt),
      { itemId: item.id, skill: item.skill, level: item.level, correct, ...(ms !== undefined ? { ms } : {}) },
    ];
    const next = pickNextItem(answers, seededRng(`${attempt.id}:next:${answers.length}`));

    if (next) {
      const moved = await this.prisma.placementAttempt.updateMany({
        where: { id: attempt.id, status: 'IN_PROGRESS', currentItemId: itemId },
        data: { answers: answers as any, currentItemId: next.id },
      });
      if (moved.count === 0) throw new ConflictException('That question was already answered');
      return {
        done: false as const,
        attemptId: attempt.id,
        answered: answers.length,
        total: QUESTION_COUNT,
        question: this.present(attempt.id, next),
      };
    }

    const result = scoreAttempt(answers);
    const closed = await this.prisma.placementAttempt.updateMany({
      where: { id: attempt.id, status: 'IN_PROGRESS', currentItemId: itemId },
      data: {
        answers: answers as any,
        status: 'COMPLETED',
        currentItemId: null,
        level: result.level,
        result: result as any,
        completedAt: new Date(),
      },
    });
    if (closed.count === 0) throw new ConflictException('That question was already answered');

    await this.prisma.profile.updateMany({
      where: { userId },
      data: { level: result.level, levelAssessedAt: new Date() },
    });
    return { done: true as const, attemptId: attempt.id, answered: answers.length, total: QUESTION_COUNT, result };
  }

  /** Optional spoken sample, attached to a finished test. It never changes the level. */
  async addSpeaking(userId: string, attemptId: string, transcript: string, seconds: number) {
    const attempt = await this.prisma.placementAttempt.findFirst({ where: { id: attemptId, userId } });
    if (!attempt) throw new NotFoundException('Placement test not found');
    if (attempt.status !== 'COMPLETED') throw new BadRequestException('Finish the questions first');

    const sample = analyzeSpeaking(transcript, seconds);
    if (!sample.tooShort) {
      await this.prisma.placementAttempt.update({
        where: { id: attempt.id },
        data: { speaking: sample as any },
      });
    }
    return sample;
  }

  // ---------------- helpers ----------------

  private answersOf(attempt: { answers: unknown }): AnswerRecord[] {
    return Array.isArray(attempt.answers) ? (attempt.answers as AnswerRecord[]) : [];
  }

  private findResumable(userId: string) {
    return this.prisma.placementAttempt.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS',
        startedAt: { gt: new Date(Date.now() - RESUME_WINDOW_MS) },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  private state(attempt: { id: string; currentItemId: string | null; answers: unknown }) {
    const item = getItem(attempt.currentItemId);
    if (!item) throw new BadRequestException('This test can no longer continue');
    return {
      attemptId: attempt.id,
      answered: this.answersOf(attempt).length,
      total: QUESTION_COUNT,
      question: this.present(attempt.id, item),
    };
  }
}
