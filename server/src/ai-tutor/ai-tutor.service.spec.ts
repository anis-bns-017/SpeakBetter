import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AiTutorService,
  DAILY_TURN_LIMIT,
  HISTORY_MESSAGES,
  MAX_TURNS_PER_SESSION,
  XP_DAILY_CAP,
  XP_PER_TURN,
} from './ai-tutor.service';
import { TutorLlm, TutorRefusedError, TutorUnavailableError, type TutorLlmRequest } from './ai-tutor.llm';

class FakeLlm extends TutorLlm {
  configured = true;
  calls: TutorLlmRequest[] = [];
  next: () => Promise<string> = async () =>
    JSON.stringify({
      reply: 'Nice! What did you do next?',
      corrections: [{ original: 'I go yesterday', corrected: 'I went yesterday', explanation: 'Past tense.' }],
      betterPhrasing: 'I went there yesterday.',
      newWords: [{ word: 'next', meaning: 'after that', example: 'What is next?' }],
      suggestions: ['I went home.', 'I slept.'],
    });
  isConfigured() {
    return this.configured;
  }
  async complete(request: TutorLlmRequest) {
    this.calls.push(request);
    return this.next();
  }
}

/** In-memory stand-in for the three tables the service uses */
function setup() {
  const chats: any[] = [];
  const messages: any[] = [];
  const xp: any[] = [];
  let seq = 0;
  const profile: any = { level: 'B2' };

  const prisma: any = {
    profile: { findUnique: jest.fn(async () => profile) },
    user: { findUnique: jest.fn(async () => ({ name: 'Ana Lopez' })) },
    aiChat: {
      create: jest.fn(async ({ data }) => {
        const { messages: nested, ...rest } = data;
        const chat = { id: `c${++seq}`, endedAt: null, summary: null, createdAt: new Date(), ...rest };
        chats.push(chat);
        const created = [nested.create].map((m: any) => {
          const row = { id: `m${++seq}`, chatId: chat.id, createdAt: new Date(Date.now() + seq), ...m };
          messages.push(row);
          return row;
        });
        return { ...chat, messages: created };
      }),
      findFirst: jest.fn(async ({ where, include }) => {
        const chat = chats.find((c) => (!where.id || c.id === where.id) && c.userId === where.userId && (where.endedAt === undefined || c.endedAt === where.endedAt));
        if (!chat) return null;
        return include ? { ...chat, messages: messages.filter((m) => m.chatId === chat.id) } : { ...chat };
      }),
      update: jest.fn(async ({ where, data }) => {
        Object.assign(chats.find((c) => c.id === where.id), data);
      }),
    },
    aiMessage: {
      count: jest.fn(async ({ where }) => {
        return messages.filter(
          (m) =>
            m.role === where.role &&
            (!where.chatId || m.chatId === where.chatId) &&
            (!where.chat || chats.find((c) => c.id === m.chatId)?.userId === where.chat.userId),
        ).length;
      }),
      findMany: jest.fn(async ({ where, take }) => {
        const rows = messages.filter((m) => m.chatId === where.chatId).sort((a, b) => +b.createdAt - +a.createdAt);
        return rows.slice(0, take);
      }),
      create: jest.fn(async ({ data }) => {
        const row = { id: `m${++seq}`, createdAt: new Date(Date.now() + seq), ...data };
        messages.push(row);
        return row;
      }),
    },
    xpTransaction: {
      aggregate: jest.fn(async () => ({ _sum: { amount: xp.reduce((a, b) => a + b, 0) } })),
    },
    $transaction: jest.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
  };
  const activity: any = {
    recordCappedActivity: jest.fn(async (_u: string, amount: number) => {
      xp.push(amount);
    }),
  };
  const review: any = { addCorrectionCard: jest.fn(async () => ({ created: true })) };
  const llm = new FakeLlm();
  return { service: new AiTutorService(prisma, activity, llm, review), prisma, activity, review, llm, chats, messages, profile };
}

describe('AiTutorService', () => {
  describe('status', () => {
    it('reports availability, level, turns left and scenarios', async () => {
      const { service } = setup();
      const status = await service.getStatus('u1');
      expect(status).toMatchObject({ configured: true, level: 'B2', dailyTurnsLeft: DAILY_TURN_LIMIT });
      expect(status.scenarios.length).toBeGreaterThan(3);
      expect(status.scenarios[0]).not.toHaveProperty('persona');
    });

    it('says when the partner is not set up', async () => {
      const { service, llm } = setup();
      llm.configured = false;
      expect((await service.getStatus('u1')).configured).toBe(false);
    });
  });

  describe('startSession', () => {
    it('opens with the scenario\'s fixed opener, at the profile level, without calling the model', async () => {
      const { service, llm } = setup();
      const s = await service.startSession('u1', 'interview');
      expect(s.scenario.id).toBe('interview');
      expect(s.level).toBe('B2');
      expect(s.messages).toHaveLength(1);
      expect(s.messages[0]).toMatchObject({ role: 'assistant' });
      expect(s.messages[0].text).toMatch(/tell me a little about yourself/);
      expect(llm.calls).toHaveLength(0);
    });

    it('lets the learner pick the level, and falls back to B1 without any level', async () => {
      const { service, profile } = setup();
      expect((await service.startSession('u1', 'free', 'a1')).level).toBe('A1');
      profile.level = null;
      expect((await service.startSession('u1', 'free')).level).toBe('B1');
    });

    it('rejects unknown scenarios and an unconfigured server', async () => {
      const { service, llm } = setup();
      await expect(service.startSession('u1', 'nope')).rejects.toBeInstanceOf(BadRequestException);
      llm.configured = false;
      await expect(service.startSession('u1', 'free')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('turn', () => {
    it('sends the level-aware prompt and history, saves both messages and returns corrections', async () => {
      const { service, llm, messages } = setup();
      const s = await service.startSession('u1', 'travel', 'A2');
      const r = await service.turn('u1', s.sessionId, '  I go   yesterday ');

      const call = llm.calls[0];
      expect(call.system).toContain('Daniel');
      expect(call.system).toContain('A2');
      expect(call.system).toContain('first name is Ana');
      expect(call.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
      expect(call.messages[2].content).toBe('I go yesterday');

      expect(r.userMessage.text).toBe('I go yesterday');
      expect(r.userMessage.corrections).toHaveLength(1);
      expect(r.reply.text).toBe('Nice! What did you do next?');
      expect(r.reply.suggestions).toEqual(['I went home.', 'I slept.']);
      expect(r.reply.newWords?.[0].word).toBe('next');
      expect(messages.map((m) => m.role)).toEqual(['ASSISTANT', 'USER', 'ASSISTANT']);
    });

    it('awards capped XP for each turn', async () => {
      const { service, activity } = setup();
      const s = await service.startSession('u1', 'free');
      await service.turn('u1', s.sessionId, 'hello');
      expect(activity.recordCappedActivity).toHaveBeenCalledWith('u1', XP_PER_TURN, 'AI_PRACTICE', XP_DAILY_CAP);
    });

    it('turns each correction into a flashcard for the learner', async () => {
      const { service, review } = setup();
      const s = await service.startSession('u1', 'free');
      const r = await service.turn('u1', s.sessionId, 'I go yesterday');
      expect(review.addCorrectionCard).toHaveBeenCalledTimes(1);
      expect(review.addCorrectionCard).toHaveBeenCalledWith('u1', {
        source: 'ai',
        sourceId: `${r.userMessage.id}:0`,
        original: 'I go yesterday',
        corrected: 'I went yesterday',
        note: 'Past tense.',
      });
    });

    it('makes no cards when there was nothing to correct', async () => {
      const { service, llm, review } = setup();
      llm.next = async () => JSON.stringify({ reply: 'Great.', corrections: [], betterPhrasing: '', newWords: [], suggestions: [] });
      const s = await service.startSession('u1', 'free');
      await service.turn('u1', s.sessionId, 'I went home');
      expect(review.addCorrectionCard).not.toHaveBeenCalled();
    });

    it('drops a "better phrasing" that repeats what the learner said', async () => {
      const { service, llm } = setup();
      llm.next = async () => JSON.stringify({ reply: 'Good.', corrections: [], betterPhrasing: 'I like tea!', newWords: [], suggestions: [] });
      const s = await service.startSession('u1', 'free');
      const r = await service.turn('u1', s.sessionId, 'i like tea');
      expect(r.userMessage.betterPhrasing).toBe('');
    });

    it('only sends the latest messages to the model', async () => {
      const { service, llm } = setup();
      const s = await service.startSession('u1', 'free');
      for (let i = 0; i < HISTORY_MESSAGES; i++) await service.turn('u1', s.sessionId, `message ${i}`);
      const last = llm.calls[llm.calls.length - 1];
      // history window + the new learner message (+ the stand-in message when it starts with the partner)
      expect(last.messages.length).toBeLessThanOrEqual(HISTORY_MESSAGES + 2);
      expect(last.messages[last.messages.length - 1].content).toBe(`message ${HISTORY_MESSAGES - 1}`);
    });

    it('validates the text and the conversation', async () => {
      const { service, chats } = setup();
      const s = await service.startSession('u1', 'free');
      await expect(service.turn('u1', s.sessionId, '   ')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.turn('u1', s.sessionId, 'x'.repeat(601))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.turn('u1', 'missing', 'hi')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.turn('someone-else', s.sessionId, 'hi')).rejects.toBeInstanceOf(NotFoundException);
      chats[0].endedAt = new Date();
      await expect(service.turn('u1', s.sessionId, 'hi')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stops a conversation that is too long, and a learner who used up the day', async () => {
      const long = setup();
      const s1 = await long.service.startSession('u1', 'free');
      long.prisma.aiMessage.count.mockResolvedValueOnce(MAX_TURNS_PER_SESSION).mockResolvedValueOnce(0);
      await expect(long.service.turn('u1', s1.sessionId, 'hi')).rejects.toBeInstanceOf(BadRequestException);

      const day = setup();
      const s2 = await day.service.startSession('u1', 'free');
      day.prisma.aiMessage.count.mockResolvedValueOnce(0).mockResolvedValueOnce(DAILY_TURN_LIMIT);
      const err = await day.service.turn('u1', s2.sessionId, 'hi').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(429);
      expect(day.llm.calls).toHaveLength(0);
    });

    it('does not save anything when the model fails', async () => {
      const { service, llm, messages, activity } = setup();
      const s = await service.startSession('u1', 'free');
      llm.next = async () => {
        throw new TutorUnavailableError('busy');
      };
      await expect(service.turn('u1', s.sessionId, 'hi')).rejects.toBeInstanceOf(ServiceUnavailableException);
      llm.next = async () => {
        throw new TutorRefusedError();
      };
      await expect(service.turn('u1', s.sessionId, 'hi')).rejects.toBeInstanceOf(UnprocessableEntityException);
      llm.next = async () => JSON.stringify({ reply: '', corrections: [] });
      await expect(service.turn('u1', s.sessionId, 'hi')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(messages).toHaveLength(1); // only the opener
      expect(activity.recordCappedActivity).not.toHaveBeenCalled();
    });

    it('refuses when the partner is not configured', async () => {
      const { service, llm } = setup();
      const s = await service.startSession('u1', 'free');
      llm.configured = false;
      await expect(service.turn('u1', s.sessionId, 'hi')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('getSession and endSession', () => {
    it('returns the whole conversation for resuming', async () => {
      const { service } = setup();
      const s = await service.startSession('u1', 'free');
      await service.turn('u1', s.sessionId, 'I go yesterday');
      const again = await service.getSession('u1', s.sessionId);
      expect(again.messages.map((m) => m.role)).toEqual(['assistant', 'user', 'assistant']);
      expect(again.messages[1].corrections).toHaveLength(1);
      await expect(service.getSession('other', s.sessionId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ends with a recap built from what was said, and returns the same recap again', async () => {
      const { service, chats } = setup();
      const s = await service.startSession('u1', 'free');
      await service.turn('u1', s.sessionId, 'I go yesterday');
      await service.turn('u1', s.sessionId, 'I like football');

      const end = await service.endSession('u1', s.sessionId);
      expect(end.summary.turns).toBe(2);
      expect(end.summary.mistakes).toBe(2);
      expect(end.summary.xpEarned).toBe(XP_PER_TURN * 2);
      expect(end.summary.newWords[0].word).toBe('next');
      expect(chats[0].endedAt).toBeInstanceOf(Date);

      const again = await service.endSession('u1', s.sessionId);
      expect(again.summary).toEqual(end.summary);
      await expect(service.endSession('other', s.sessionId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('can end a conversation where nothing was said', async () => {
      const { service } = setup();
      const s = await service.startSession('u1', 'free');
      const end = await service.endSession('u1', s.sessionId);
      expect(end.summary).toMatchObject({ turns: 0, words: 0, mistakes: 0 });
    });
  });
});
