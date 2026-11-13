// server/src/learning/memory-model.service.ts
// Each learner's own memory model: FSRS weights fitted from their review history (fsrs.fit.ts), kept in the
// MemoryModel table and used by the review scheduler once they predict better than the defaults. Fits run in
// the background after enough new reviews, never while the learner waits.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { W, weightsOrDefault, type Weights } from './fsrs';
import { buildHistories, countLessons, fitLearner, MIN_LESSONS, REFIT_EVERY } from './fsrs.fit';

/** How many of a learner's latest log rows a fit reads (the fit itself uses at most MAX_FIT_REVIEWS of them) */
const READ_ROWS = 20_000;
/** Answers between checks of whether a fit is due, so answering a card rarely costs an extra query */
const CHECK_EVERY = 10;

export interface MemoryModelSummary {
  /** The schedule follows this learner's own memory */
  personal: boolean;
  /** Reviews a day or more apart so far (what a fit learns from) */
  lessons: number;
  /** How many a first fit needs */
  needed: number;
  fittedAt: Date | null;
  /** Prediction error (0-1) with the standard weights, and with the learner's own */
  defaultError: number | null;
  fittedError: number | null;
}

@Injectable()
export class MemoryModelService {
  private readonly logger = new Logger(MemoryModelService.name);
  private readonly running = new Set<string>();
  private readonly answers = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  /** The weights to schedule this learner's reviews with */
  async weightsFor(userId: string): Promise<Weights> {
    try {
      const row = await this.prisma.memoryModel.findUnique({ where: { userId }, select: { active: true, weights: true } });
      return row?.active ? weightsOrDefault(row.weights) : W;
    } catch (error) {
      this.logger.warn(`Could not read the memory model of ${userId}: ${(error as Error)?.message}`);
      return W;
    }
  }

  async summary(userId: string): Promise<MemoryModelSummary> {
    const [row, lessonsSoFar] = await Promise.all([
      this.prisma.memoryModel.findUnique({ where: { userId } }).catch(() => null),
      this.prisma.reviewLog.count({ where: { userId, elapsedDays: { gte: 1 } } }),
    ]);
    const personal = !!row?.active;
    return {
      personal,
      // Before a fit, a quick count stands in (it also counts cards started before FSRS, which a fit leaves out)
      lessons: personal ? row.lessons : lessonsSoFar,
      needed: MIN_LESSONS,
      fittedAt: row?.fittedAt ?? null,
      defaultError: personal ? row.defaultError : null,
      fittedError: personal ? row.fittedError : null,
    };
  }

  /** Called after each answer: now and then checks whether a fit is due, and starts it in the background */
  noteAnswer(userId: string) {
    const count = (this.answers.get(userId) ?? 0) + 1;
    this.answers.set(userId, count);
    if (count % CHECK_EVERY !== 1 || this.running.has(userId)) return;
    void this.refitIfDue(userId).catch((error) => this.logger.warn(`Memory model check failed for ${userId}: ${(error as Error)?.message}`));
  }

  async refitIfDue(userId: string): Promise<boolean> {
    const [row, logs, lessons] = await Promise.all([
      this.prisma.memoryModel.findUnique({ where: { userId }, select: { logCount: true } }),
      this.prisma.reviewLog.count({ where: { userId } }),
      this.prisma.reviewLog.count({ where: { userId, elapsedDays: { gte: 1 } } }),
    ]);
    const due = row ? logs - row.logCount >= REFIT_EVERY : lessons >= MIN_LESSONS;
    if (!due) return false;
    await this.refit(userId);
    return true;
  }

  /** Fits this learner's weights from their history and saves the result (used only if it beat the defaults) */
  async refit(userId: string) {
    if (this.running.has(userId)) return null;
    this.running.add(userId);
    try {
      const latest = await this.prisma.reviewLog.findMany({
        where: { userId },
        orderBy: { reviewedAt: 'desc' },
        take: READ_ROWS,
        select: { itemType: true, itemId: true, rating: true, reviewedAt: true, elapsedDays: true },
      });
      const histories = buildHistories(latest.reverse());
      const started = Date.now();
      // Give way to other requests between steps
      const fit = await fitLearner(histories, { pause: () => new Promise((resolve) => setImmediate(resolve)) });
      const logCount = await this.prisma.reviewLog.count({ where: { userId } });

      const data = fit
        ? {
            weights: fit.weights,
            active: fit.adopted,
            lessons: fit.lessons,
            defaultError: fit.defaultError,
            fittedError: fit.fittedError,
            defaultLoss: fit.defaultLoss,
            fittedLoss: fit.fittedLoss,
            logCount,
            fittedAt: new Date(),
          }
        : // Not enough yet: remember the attempt, so the next one waits for more reviews
          { weights: [...W], active: false, lessons: countLessons(histories), logCount, fittedAt: new Date() };
      await this.prisma.memoryModel.upsert({ where: { userId }, create: { userId, ...data }, update: data });
      if (fit) {
        this.logger.log(
          `Memory model for ${userId}: ${fit.adopted ? 'personal' : 'standard kept'}, ${fit.lessons} reviews, error ${fit.defaultError} -> ${fit.fittedError} (${Date.now() - started} ms)`,
        );
      }
      return fit;
    } finally {
      this.running.delete(userId);
    }
  }
}
