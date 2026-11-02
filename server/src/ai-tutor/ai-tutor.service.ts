import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { XpReason } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { TUTOR_SCENARIOS, getScenario } from './ai-tutor.scenarios';
import {
  MAX_REPLY_CHARS,
  buildMessages,
  buildSystemPrompt,
  normalizeLevel,
  parseTurn,
  type TutorCorrection,
  type TutorWord,
} from './ai-tutor.prompt';
import { buildSummary, type TutorSummary } from './ai-tutor.summary';
import { TutorLlm, TutorRefusedError, TutorUnavailableError } from './ai-tutor.llm';

/** Every turn is a paid model call, so a learner can only take so many a day and per conversation */
export const DAILY_TURN_LIMIT = 150;
export const MAX_TURNS_PER_SESSION = 60;
/** Only the latest messages go to the model, which keeps long conversations cheap and fast */
export const HISTORY_MESSAGES = 24;
export const XP_PER_TURN = 2;
export const XP_DAILY_CAP = 60;
/** A conversation left unfinished this long is no longer offered for resuming */
const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').replace(/\s+/g, ' ').trim();

export interface TutorMessageView {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  corrections?: TutorCorrection[];
  betterPhrasing?: string;
  newWords?: TutorWord[];
  suggestions?: string[];
  createdAt: Date;
}

@Injectable()
export class AiTutorService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private llm: TutorLlm,
    private review: ReviewService,
  ) {}

  async getStatus(userId: string) {
    const [profile, turnsToday, active] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.turnsToday(userId),
      this.prisma.aiChat.findFirst({
        where: {
          userId,
          endedAt: null,
          scenario: { not: null },
          createdAt: { gt: new Date(Date.now() - RESUME_WINDOW_MS) },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
    ]);

    return {
      configured: this.llm.isConfigured(),
      level: profile?.level ?? null,
      dailyTurnsLeft: Math.max(0, DAILY_TURN_LIMIT - turnsToday),
      activeSessionId: active?.id ?? null,
      scenarios: TUTOR_SCENARIOS.map(({ id, title, emoji, blurb }) => ({ id, title, emoji, blurb })),
    };
  }

  async startSession(userId: string, scenarioId: string, level?: string) {
    this.requireConfigured();
    const scenario = getScenario(scenarioId);
    if (!scenario) throw new BadRequestException('Unknown conversation type');

    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true } });
    const cefr = normalizeLevel(level ?? profile?.level);

    const chat = await this.prisma.aiChat.create({
      data: {
        userId,
        title: scenario.title,
        scenario: scenario.id,
        level: cefr,
        messages: { create: { role: 'ASSISTANT', content: scenario.opener, metadata: { opener: true } } },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return this.view(chat, await this.turnsToday(userId));
  }

  async getSession(userId: string, sessionId: string) {
    const chat = await this.prisma.aiChat.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!chat) throw new NotFoundException('Conversation not found');
    return this.view(chat, await this.turnsToday(userId));
  }

  async turn(userId: string, sessionId: string, rawText: string) {
    this.requireConfigured();

    const text = String(rawText ?? '').replace(/\s+/g, ' ').trim();
    if (!text) throw new BadRequestException('Say or type something first');
    if (text.length > MAX_REPLY_CHARS) throw new BadRequestException('That message is too long');

    const chat = await this.prisma.aiChat.findFirst({ where: { id: sessionId, userId } });
    if (!chat) throw new NotFoundException('Conversation not found');
    if (chat.endedAt) throw new BadRequestException('This conversation has finished');

    const [sessionTurns, turnsToday] = await Promise.all([
      this.prisma.aiMessage.count({ where: { chatId: chat.id, role: 'USER' } }),
      this.turnsToday(userId),
    ]);
    if (sessionTurns >= MAX_TURNS_PER_SESSION) {
      throw new BadRequestException('This conversation is getting long. Finish it to see your recap, then start a new one.');
    }
    if (turnsToday >= DAILY_TURN_LIMIT) {
      throw new HttpException(
        { message: "You've reached today's practice limit. Come back tomorrow!", limit: DAILY_TURN_LIMIT },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [user, recent] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      this.prisma.aiMessage.findMany({
        where: { chatId: chat.id },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_MESSAGES,
      }),
    ]);
    const history = recent
      .reverse()
      .filter((m) => m.role !== 'SYSTEM')
      .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('assistant' as const), content: m.content }));

    const scenario = getScenario(chat.scenario) ?? TUTOR_SCENARIOS[0];
    const system = buildSystemPrompt({ scenario, level: normalizeLevel(chat.level), learnerName: user?.name });

    let raw: string;
    try {
      raw = await this.llm.complete({ system, messages: buildMessages(history, text) });
    } catch (error) {
      if (error instanceof TutorRefusedError) {
        throw new UnprocessableEntityException("I can't help with that one. Let's talk about something else.");
      }
      if (error instanceof TutorUnavailableError) throw new ServiceUnavailableException(error.message);
      throw error;
    }

    const parsed = parseTurn(raw);
    if (!parsed.reply) throw new ServiceUnavailableException('The AI partner did not answer. Please try again.');
    // "A better way to say it" that is the same sentence is just noise
    if (parsed.betterPhrasing && norm(parsed.betterPhrasing) === norm(text)) parsed.betterPhrasing = '';

    const [userMessage, reply] = await this.prisma.$transaction([
      this.prisma.aiMessage.create({
        data: {
          chatId: chat.id,
          role: 'USER',
          content: text,
          metadata: { corrections: parsed.corrections, betterPhrasing: parsed.betterPhrasing } as any,
        },
      }),
      this.prisma.aiMessage.create({
        data: {
          chatId: chat.id,
          role: 'ASSISTANT',
          content: parsed.reply,
          metadata: { suggestions: parsed.suggestions, newWords: parsed.newWords } as any,
        },
      }),
    ]);

    await this.activity.recordCappedActivity(userId, XP_PER_TURN, XpReason.AI_PRACTICE, XP_DAILY_CAP);

    // Each mistake the partner pointed out becomes a flashcard to review later (never throws)
    parsed.corrections.forEach((c, i) => {
      void this.review.addCorrectionCard(userId, {
        source: 'ai',
        sourceId: `${userMessage.id}:${i}`,
        original: c.original,
        corrected: c.corrected,
        note: c.explanation,
      });
    });

    return {
      userMessage: this.messageView(userMessage),
      reply: this.messageView(reply),
      turnsLeftToday: Math.max(0, DAILY_TURN_LIMIT - turnsToday - 1),
      sessionTurnsLeft: Math.max(0, MAX_TURNS_PER_SESSION - sessionTurns - 1),
    };
  }

  /** Closes the conversation and returns the recap. Calling it again returns the same recap. */
  async endSession(userId: string, sessionId: string) {
    const chat = await this.prisma.aiChat.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!chat) throw new NotFoundException('Conversation not found');
    if (chat.endedAt && chat.summary) {
      return { sessionId: chat.id, summary: chat.summary as unknown as TutorSummary };
    }

    const earned = await this.prisma.xpTransaction.aggregate({
      where: { userId, reason: XpReason.AI_PRACTICE, createdAt: { gte: chat.createdAt } },
      _sum: { amount: true },
    });
    const summary = buildSummary(chat.messages as any, earned._sum.amount ?? 0);

    await this.prisma.aiChat.update({
      where: { id: chat.id },
      data: { endedAt: new Date(), summary: summary as any },
    });
    return { sessionId: chat.id, summary };
  }

  // ---------------- helpers ----------------

  private requireConfigured() {
    if (!this.llm.isConfigured()) {
      throw new ServiceUnavailableException('The AI speaking partner is not set up on this server yet.');
    }
  }

  private turnsToday(userId: string) {
    return this.prisma.aiMessage.count({
      where: { role: 'USER', createdAt: { gte: startOfDay(new Date()) }, chat: { userId } },
    });
  }

  private messageView(m: { id: string; role: string; content: string; metadata?: unknown; createdAt: Date }): TutorMessageView {
    const meta = (m.metadata ?? {}) as Record<string, any>;
    const isUser = m.role === 'USER';
    return {
      id: m.id,
      role: isUser ? 'user' : 'assistant',
      text: m.content,
      createdAt: m.createdAt,
      ...(isUser
        ? {
            corrections: Array.isArray(meta.corrections) ? meta.corrections : [],
            betterPhrasing: typeof meta.betterPhrasing === 'string' ? meta.betterPhrasing : '',
          }
        : {
            suggestions: Array.isArray(meta.suggestions) ? meta.suggestions : [],
            newWords: Array.isArray(meta.newWords) ? meta.newWords : [],
          }),
    };
  }

  private view(
    chat: {
      id: string;
      scenario: string | null;
      level: string | null;
      endedAt: Date | null;
      summary: unknown;
      messages: Array<{ id: string; role: string; content: string; metadata?: unknown; createdAt: Date }>;
    },
    turnsToday: number,
  ) {
    const scenario = getScenario(chat.scenario) ?? TUTOR_SCENARIOS[0];
    return {
      sessionId: chat.id,
      scenario: { id: scenario.id, title: scenario.title, emoji: scenario.emoji },
      level: normalizeLevel(chat.level),
      ended: chat.endedAt !== null,
      summary: (chat.summary as TutorSummary | null) ?? null,
      turnsLeftToday: Math.max(0, DAILY_TURN_LIMIT - turnsToday),
      messages: chat.messages.filter((m) => m.role !== 'SYSTEM').map((m) => this.messageView(m)),
    };
  }
}
