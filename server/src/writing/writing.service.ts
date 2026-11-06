import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { BadgesService } from '../gamification/badges.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { CheckerBusyError, CheckerUnavailableError, LanguageToolClient } from './language-tool.client';
import {
  countByKind,
  countWords,
  reviewCandidates,
  scoreWriting,
  toIssues,
  VARIANTS,
  type SpellingVariant,
  type WritingIssue,
} from './writing.engine';
import {
  FREE_PROMPT_ID,
  PROMPT_BY_ID,
  todaysPrompt,
  WRITING_LEVELS,
  WRITING_PROMPTS,
  type WritingLevel,
  type WritingPrompt,
} from './writing.prompts';

/** XP for finishing a piece, for the first few pieces each day */
export const WRITING_XP = 12;
export const XP_PIECES_PER_DAY = 2;
/** Longest piece the checker gets (the free server takes up to 20 KB a request) */
export const MAX_CHARS = 4000;
/** A finished piece needs at least this much writing */
export const MIN_WORDS_TO_FINISH = 10;
const CARDS_PER_PIECE = 5;
const RECENT = 12;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const variantOf = (value: unknown): SpellingVariant => (VARIANTS.includes(value as SpellingVariant) ? (value as SpellingVariant) : 'en-GB');

const cleanText = (value: unknown): string => {
  const text = String(value ?? '').replace(/\r\n/g, '\n');
  if (text.length > MAX_CHARS) throw new BadRequestException(`Keep it under ${MAX_CHARS} characters`);
  return text;
};

type PieceRow = Prisma.WritingPieceGetPayload<object>;

@Injectable()
export class WritingService {
  private readonly logger = new Logger(WritingService.name);

  constructor(
    private prisma: PrismaService,
    private checker: LanguageToolClient,
    private activity: ActivityService,
    private review: ReviewService,
    @Optional() private badges?: BadgesService,
  ) {}

  /** The tasks for every level with what you have finished, today's task for each level, and your recent writing */
  async overview(userId: string, now = new Date()) {
    const [profile, finished, recent] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.prisma.writingPiece.groupBy({
        by: ['promptId'],
        where: { userId, submittedAt: { not: null } },
        _max: { score: true },
        _count: { _all: true },
      }),
      this.prisma.writingPiece.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: RECENT,
        select: { id: true, promptId: true, title: true, level: true, wordCount: true, score: true, submittedAt: true, updatedAt: true },
      }),
    ]);
    const done = new Map(finished.map((f) => [f.promptId, { best: f._max.score, times: f._count._all }]));
    const totals = await this.prisma.writingPiece.aggregate({
      where: { userId, submittedAt: { not: null } },
      _count: { _all: true },
      _sum: { wordCount: true },
      _avg: { score: true },
    });

    return {
      level: practiceLevel(profile?.level) as WritingLevel,
      today: Object.fromEntries(WRITING_LEVELS.map((l) => [l, todaysPrompt(l, now).id])),
      prompts: WRITING_PROMPTS.map((p) => ({
        ...this.promptCard(p),
        done: done.has(p.id),
        bestScore: done.get(p.id)?.best ?? null,
      })),
      recent: recent.map((r) => ({ ...r, finished: !!r.submittedAt })),
      stats: {
        pieces: totals._count._all,
        words: totals._sum.wordCount ?? 0,
        averageScore: totals._avg.score === null ? null : Math.round(totals._avg.score),
      },
      checker: { publicServer: this.checker.usesPublicServer },
    };
  }

  /** Starts a piece for a task (or free writing), or carries on with the draft already started for it */
  async start(userId: string, promptId: unknown) {
    const id = String(promptId ?? '');
    const prompt = PROMPT_BY_ID.get(id);
    if (!prompt && id !== FREE_PROMPT_ID) throw new NotFoundException('That writing task does not exist');
    const draft = await this.prisma.writingPiece.findFirst({
      where: { userId, promptId: id, submittedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (draft) return this.view(draft);
    const level = prompt?.level ?? (practiceLevel((await this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }))?.level) as WritingLevel);
    const piece = await this.prisma.writingPiece.create({
      data: { userId, promptId: id, level, title: prompt?.title ?? 'Free writing', text: '' },
    });
    return this.view(piece);
  }

  async get(userId: string, pieceId: string) {
    return this.view(await this.own(userId, pieceId));
  }

  /** Autosave while typing */
  async save(userId: string, pieceId: string, input: { text?: unknown; variant?: unknown }) {
    const piece = await this.own(userId, pieceId);
    if (piece.submittedAt) throw new BadRequestException('This piece is finished. Start it again to write a new version.');
    const text = cleanText(input.text);
    const updated = await this.prisma.writingPiece.update({
      where: { id: piece.id },
      data: { text, wordCount: countWords(text), variant: variantOf(input.variant ?? piece.variant) },
    });
    return { id: updated.id, wordCount: updated.wordCount, updatedAt: updated.updatedAt };
  }

  /** Checks the text, keeps the result, and remembers the first check's mistakes for review cards */
  async check(userId: string, pieceId: string, input: { text?: unknown; variant?: unknown }) {
    const piece = await this.own(userId, pieceId);
    if (piece.submittedAt) throw new BadRequestException('This piece is finished');
    const text = cleanText(input.text);
    if (countWords(text) === 0) throw new BadRequestException('Write something first');
    const variant = variantOf(input.variant ?? piece.variant);
    const issues = await this.runChecker(text, variant);
    const words = countWords(text);
    await this.prisma.writingPiece.update({
      where: { id: piece.id },
      data: {
        text,
        variant,
        wordCount: words,
        issues: issues as unknown as Prisma.InputJsonValue,
        checks: { increment: 1 },
        // The first check shows the learner's own mistakes, before the suggestions were applied
        ...(piece.firstIssues ? {} : { firstIssues: issues as unknown as Prisma.InputJsonValue, firstText: text }),
      },
    });
    return { issues, ...this.stats(issues, words) };
  }

  /**
   * Finishes a piece: a last check (free if the text was just checked), the score, XP for the first pieces of
   * the day, and review cards from the mistakes in the first check.
   */
  async finish(userId: string, pieceId: string, input: { text?: unknown; variant?: unknown }, now = new Date()) {
    const piece = await this.own(userId, pieceId);
    if (piece.submittedAt) throw new BadRequestException('This piece is already finished');
    const text = cleanText(input.text);
    const words = countWords(text);
    if (words < MIN_WORDS_TO_FINISH) throw new BadRequestException(`Write at least ${MIN_WORDS_TO_FINISH} words to finish`);
    const variant = variantOf(input.variant ?? piece.variant);

    let issues: WritingIssue[] | null = null;
    try {
      issues = await this.runChecker(text, variant);
    } catch (error) {
      // Finishing still works when the checker is down; the piece just has no score
      if (!(error instanceof HttpException)) throw error;
    }
    const score = issues ? scoreWriting(issues, words) : null;
    const firstText = piece.firstText ?? text;
    const firstIssues = (piece.firstIssues as unknown as WritingIssue[] | null) ?? issues ?? [];

    const { count } = await this.prisma.writingPiece.updateMany({
      where: { id: piece.id, submittedAt: null },
      data: {
        text,
        variant,
        wordCount: words,
        score,
        submittedAt: now,
        ...(issues ? { issues: issues as unknown as Prisma.InputJsonValue } : {}),
        ...(piece.firstIssues ? {} : issues ? { firstIssues: issues as unknown as Prisma.InputJsonValue, firstText: text } : {}),
      },
    });
    if (!count) throw new BadRequestException('This piece is already finished');

    const finishedToday = await this.prisma.writingPiece.count({
      where: { userId, submittedAt: { gte: startOfDay(now) }, id: { not: piece.id } },
    });
    const xp = finishedToday < XP_PIECES_PER_DAY ? WRITING_XP : 0;
    if (xp) await this.activity.recordActivity(userId, xp, 'WRITING_PRACTICE');

    let cardsAdded = 0;
    for (const card of reviewCandidates(firstText, firstIssues, CARDS_PER_PIECE)) {
      const made = await this.review.addCorrectionCard(
        userId,
        { source: 'writing', sourceId: `${piece.id}:${card.key}`, original: card.original, corrected: card.corrected, pattern: card.pattern, note: card.note },
        { ignoreDailyLimit: true },
      );
      if (made?.created) cardsAdded++;
    }
    void this.badges?.evaluate(userId);

    return {
      ...this.view({ ...piece, text, variant, wordCount: words, score, submittedAt: now, issues: (issues ?? piece.issues) as Prisma.JsonValue }),
      xp,
      cardsAdded,
      checked: !!issues,
    };
  }

  async remove(userId: string, pieceId: string) {
    const piece = await this.own(userId, pieceId);
    await this.prisma.writingPiece.delete({ where: { id: piece.id } });
    return { ok: true };
  }

  // ---------------- helpers ----------------

  private async runChecker(text: string, variant: SpellingVariant): Promise<WritingIssue[]> {
    try {
      return toIssues(text, await this.checker.check(text, variant));
    } catch (error) {
      if (error instanceof CheckerBusyError) {
        throw new HttpException(
          { message: `Lots of people are checking right now. Try again in ${error.retryAfterSeconds} seconds.`, retryAfter: error.retryAfterSeconds },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (error instanceof CheckerUnavailableError) {
        throw new ServiceUnavailableException('The grammar checker is not answering right now. Your writing is saved; try again in a minute.');
      }
      throw error;
    }
  }

  private stats(issues: WritingIssue[], words: number) {
    return { words, score: scoreWriting(issues, words), counts: countByKind(issues) };
  }

  private async own(userId: string, pieceId: string): Promise<PieceRow> {
    const piece = await this.prisma.writingPiece.findFirst({ where: { id: String(pieceId), userId } });
    if (!piece) throw new NotFoundException('Writing not found');
    return piece;
  }

  private promptCard(p: WritingPrompt) {
    return { id: p.id, level: p.level, kind: p.kind, title: p.title, task: p.task, minWords: p.minWords, maxWords: p.maxWords };
  }

  private view(piece: Pick<PieceRow, 'id' | 'promptId' | 'level' | 'title' | 'text' | 'wordCount' | 'score' | 'variant' | 'submittedAt' | 'issues'>) {
    const prompt = PROMPT_BY_ID.get(piece.promptId) ?? null;
    const issues = (piece.issues as unknown as WritingIssue[] | null) ?? null;
    return {
      id: piece.id,
      promptId: piece.promptId,
      level: piece.level,
      title: piece.title,
      text: piece.text,
      variant: variantOf(piece.variant),
      wordCount: piece.wordCount,
      score: piece.score,
      finished: !!piece.submittedAt,
      submittedAt: piece.submittedAt,
      prompt: prompt ? { ...this.promptCard(prompt), tips: prompt.tips, phrases: prompt.phrases } : null,
      issues,
      counts: issues ? countByKind(issues) : null,
      checker: { publicServer: this.checker.usesPublicServer },
    };
  }
}
