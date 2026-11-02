import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUTO_CARDS_PER_DAY, REVIEW_XP_DAILY_CAP, ReviewService } from './review.service';

const DAY = 86_400_000;

function setup() {
  const prisma: any = {
    language: { upsert: jest.fn(async () => ({})) },
    flashcard: {
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }) => ({ id: 'f1', ...data })),
      deleteMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => ({ id: 'f1' })),
    },
    flashcardReview: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }) => data),
      update: jest.fn(async ({ data }) => data),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    voiceSavedWord: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => 0),
      update: jest.fn(async () => ({})),
    },
    voiceCorrection: { findMany: jest.fn(async () => []) },
    message: { findMany: jest.fn(async () => []) },
  };
  const activity: any = { recordCappedActivity: jest.fn(async () => undefined) };
  return { service: new ReviewService(prisma, activity), prisma, activity };
}

const input = { source: 'voice' as const, sourceId: 'c1', original: 'I have car', corrected: 'I have a car', note: 'Add an article.' };

describe('addCorrectionCard', () => {
  it('makes a correction card, filed under its mistake pattern, with a review that is due now', async () => {
    const { service, prisma } = setup();
    expect(await service.addCorrectionCard('u1', input)).toEqual({ created: true });

    const data = prisma.flashcard.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'u1',
      language: 'en',
      front: 'I have car',
      back: 'I have a car',
      kind: 'correction',
      source: 'voice',
      sourceId: 'c1',
      pattern: 'ARTICLE',
      note: 'Add an article.',
    });
    expect(data.reviews.create).toMatchObject({ userId: 'u1', interval: 0, reviewCount: 0 });
    expect(data.reviews.create.dueAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(prisma.language.upsert).toHaveBeenCalled();
  });

  it('keeps the original time for history imports and trusts a pronunciation label', async () => {
    const { service, prisma } = setup();
    const when = new Date('2026-10-01T00:00:00Z');
    await service.addCorrectionCard('u1', { ...input, category: 'pronunciation', createdAt: when });
    const data = prisma.flashcard.create.mock.calls[0][0].data;
    expect(data.createdAt).toBe(when);
    expect(data.pattern).toBe('PRONUNCIATION');
  });

  it('does nothing twice for the same correction', async () => {
    const { service, prisma } = setup();
    prisma.flashcard.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );
    expect(await service.addCorrectionCard('u1', input)).toEqual({ created: false });
  });

  it('skips corrections that change nothing or have nothing to show', async () => {
    const { service, prisma } = setup();
    expect(await service.addCorrectionCard('u1', { ...input, corrected: 'i have car.' })).toEqual({ created: false });
    expect(await service.addCorrectionCard('u1', { ...input, original: '  ' })).toEqual({ created: false });
    expect(await service.addCorrectionCard('', input)).toEqual({ created: false });
    expect(prisma.flashcard.create).not.toHaveBeenCalled();
  });

  it('stops after the daily limit, except when importing history', async () => {
    const { service, prisma } = setup();
    prisma.flashcard.count.mockResolvedValue(AUTO_CARDS_PER_DAY);
    expect(await service.addCorrectionCard('u1', input)).toEqual({ created: false });
    expect(prisma.flashcard.create).not.toHaveBeenCalled();
    expect(await service.addCorrectionCard('u1', input, { ignoreDailyLimit: true })).toEqual({ created: true });
  });

  it('never throws: a database failure returns null', async () => {
    const { service, prisma } = setup();
    prisma.flashcard.create.mockRejectedValue(new Error('db down'));
    expect(await service.addCorrectionCard('u1', input)).toBeNull();
  });
});

describe('removeCorrectionCard', () => {
  it('deletes the card made from that correction, and never throws', async () => {
    const { service, prisma } = setup();
    await service.removeCorrectionCard('u1', 'voice', 'c1');
    expect(prisma.flashcard.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', source: 'voice', sourceId: 'c1' } });
    prisma.flashcard.deleteMany.mockRejectedValue(new Error('db down'));
    await expect(service.removeCorrectionCard('u1', 'voice', 'c1')).resolves.toBeUndefined();
  });
});

describe('getQueue', () => {
  const review = (over: any = {}) => ({
    flashcardId: 'f1',
    easeFactor: 2.5,
    interval: 0,
    reviewCount: 0,
    lapses: 0,
    dueAt: new Date(Date.now() - 1000),
    flashcard: { kind: 'correction', front: 'I have car', back: 'I have a car', note: 'Add an article.', pattern: 'ARTICLE' },
    ...over,
  });

  it('gives cards that never had a review a review row first, so they are not lost', async () => {
    const { service, prisma } = setup();
    prisma.flashcard.findMany.mockResolvedValue([{ id: 'old1' }, { id: 'old2' }]);
    await service.getQueue('u1');
    const call = prisma.flashcardReview.createMany.mock.calls[0][0];
    expect(call.data.map((d: any) => d.flashcardId)).toEqual(['old1', 'old2']);
    expect(call.skipDuplicates).toBe(true);
  });

  it('lists due cards with the answer previews and the mistake pattern label', async () => {
    const { service, prisma } = setup();
    prisma.flashcardReview.findMany.mockResolvedValue([review()]);
    prisma.flashcardReview.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.voiceSavedWord.count.mockResolvedValue(4);

    const { items, due } = await service.getQueue('u1');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'card:f1',
      type: 'card',
      kind: 'correction',
      front: 'I have car',
      back: 'I have a car',
      pattern: 'ARTICLE',
      patternLabel: 'Articles (a, an, the)',
      isNew: true,
    });
    expect(items[0].preview).toEqual({ again: 10, hard: 1440, good: 2880, easy: 5760 });
    expect(due).toEqual({ corrections: 3, words: 6, total: 9 });
    expect(prisma.flashcardReview.findMany.mock.calls[0][0].where.dueAt).toBeDefined();
  });

  it('mixes saved words in, oldest due first', async () => {
    const { service, prisma } = setup();
    prisma.flashcardReview.findMany.mockResolvedValue([review({ dueAt: new Date(Date.now() - 1000) })]);
    prisma.voiceSavedWord.findMany.mockResolvedValue([
      { id: 'w1', word: 'lovely', meaning: 'very nice', sentence: 'What a lovely day', box: 1, reviewCount: 2, dueAt: new Date(Date.now() - 5000) },
    ]);
    const { items } = await service.getQueue('u1');
    expect(items.map((i) => i.key)).toEqual(['word:w1', 'card:f1']);
    expect(items[0]).toMatchObject({ type: 'word', kind: 'word', front: 'lovely', back: 'very nice', isNew: false });
    expect(items[0].preview.again).toBe(1440);
    expect(items[0].preview.good).toBe(4 * 1440);
  });

  it('narrows to one mistake pattern or to corrections without saved words', async () => {
    const { service, prisma } = setup();
    await service.getQueue('u1', { pattern: 'TENSE' });
    expect(prisma.flashcardReview.findMany.mock.calls[0][0].where.flashcard).toEqual({ userId: 'u1', pattern: 'TENSE' });
    expect(prisma.voiceSavedWord.findMany).not.toHaveBeenCalled();

    await service.getQueue('u1', { kind: 'correction' });
    expect(prisma.voiceSavedWord.findMany).not.toHaveBeenCalled();
  });

  it('ignores a pattern it does not know, and includes cards not yet due with all=true', async () => {
    const { service, prisma } = setup();
    await service.getQueue('u1', { pattern: 'NOPE', all: true });
    const where = prisma.flashcardReview.findMany.mock.calls[0][0].where;
    expect(where.flashcard).toEqual({ userId: 'u1' });
    expect(where.dueAt).toBeUndefined();
  });

  it('filters by language and leaves out saved words for languages other than English', async () => {
    const { service, prisma } = setup();
    await service.getQueue('u1', { language: 'es' });
    expect(prisma.flashcardReview.findMany.mock.calls[0][0].where.flashcard).toEqual({ userId: 'u1', language: 'es' });
    expect(prisma.voiceSavedWord.findMany).not.toHaveBeenCalled();
    await service.getQueue('u1', { language: 'en' });
    expect(prisma.voiceSavedWord.findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps the list within the limit', async () => {
    const { service, prisma } = setup();
    await service.getQueue('u1', { limit: 5000 });
    expect(prisma.flashcardReview.findMany.mock.calls[0][0].take).toBe(100);
    await service.getQueue('u1', { limit: 0 });
    expect(prisma.flashcardReview.findMany.mock.calls[1][0].take).toBe(30);
  });
});

describe('answer', () => {
  const state = { id: 'r1', easeFactor: 2.5, interval: 10, reviewCount: 3, lapses: 0 };

  it('schedules a card from the answer and awards capped XP', async () => {
    const { service, prisma, activity } = setup();
    prisma.flashcardReview.findFirst.mockResolvedValue(state);
    const r = await service.answer('u1', { type: 'card', id: 'f1', rating: 'good' });
    expect(prisma.flashcardReview.update.mock.calls[0][0].data).toMatchObject({ interval: 25, reviewCount: 4, lapses: 0 });
    expect(r.intervalDays).toBe(25);
    expect(activity.recordCappedActivity).toHaveBeenCalledWith('u1', 2, 'FLASHCARD_REVIEW', REVIEW_XP_DAILY_CAP);
  });

  it('sends a forgotten card back to minutes, counts a lapse, and gives no XP', async () => {
    const { service, prisma, activity } = setup();
    prisma.flashcardReview.findFirst.mockResolvedValue(state);
    await service.answer('u1', { type: 'card', id: 'f1', rating: 'again' });
    expect(prisma.flashcardReview.update.mock.calls[0][0].data).toMatchObject({ interval: 0, lapses: 1 });
    expect(activity.recordCappedActivity).not.toHaveBeenCalled();
  });

  it('starts a review for a card that has none yet', async () => {
    const { service, prisma } = setup();
    await service.answer('u1', { type: 'card', id: 'f1', rating: 'easy' });
    expect(prisma.flashcardReview.create.mock.calls[0][0].data).toMatchObject({ flashcardId: 'f1', userId: 'u1', interval: 4, reviewCount: 1 });
  });

  it('only answers cards and words that belong to the learner', async () => {
    const { service, prisma } = setup();
    prisma.flashcard.findFirst.mockResolvedValue(null);
    await expect(service.answer('u1', { type: 'card', id: 'x', rating: 'good' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.flashcard.findFirst.mock.calls[0][0].where).toEqual({ id: 'x', userId: 'u1' });
    await expect(service.answer('u1', { type: 'word', id: 'x', rating: 'good' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('moves a saved word up a box when remembered and back to the start when forgotten', async () => {
    const { service, prisma, activity } = setup();
    prisma.voiceSavedWord.findFirst.mockResolvedValue({ id: 'w1', box: 2 });
    const knew = await service.answer('u1', { type: 'word', id: 'w1', rating: 'good' });
    expect(prisma.voiceSavedWord.update.mock.calls[0][0].data.box).toBe(3);
    expect(knew.intervalDays).toBe(8);
    expect(activity.recordCappedActivity).toHaveBeenCalledTimes(1);

    const forgot = await service.answer('u1', { type: 'word', id: 'w1', rating: 'again' });
    expect(prisma.voiceSavedWord.update.mock.calls[1][0].data.box).toBe(0);
    expect(forgot.intervalDays).toBe(1);
    expect(activity.recordCappedActivity).toHaveBeenCalledTimes(1);
  });
});

describe('getMistakesReport', () => {
  const card = (pattern: string | null, daysAgo: number, interval = 0) => ({
    pattern,
    front: `wrong ${pattern}`,
    back: `right ${pattern}`,
    note: null,
    createdAt: new Date(Date.now() - daysAgo * DAY),
    reviews: [{ interval }],
  });

  it('groups by pattern, most frequent first, and flags habits', async () => {
    const { service, prisma } = setup();
    prisma.flashcard.findMany.mockResolvedValue([
      card('ARTICLE', 1), card('ARTICLE', 2), card('ARTICLE', 10), card('TENSE', 3), card('TENSE', 20, 30), card(null, 1),
    ]);
    const report = await service.getMistakesReport('u1');
    expect(report.total).toBe(6);
    expect(report.patterns.map((p) => p.pattern)).toEqual(['ARTICLE', 'TENSE', 'OTHER']);

    const article = report.patterns[0];
    expect(article).toMatchObject({ label: 'Articles (a, an, the)', count: 3, repeating: true });
    expect(article.tip.length).toBeGreaterThan(10);
    expect(article.examples[0]).toEqual({ original: 'wrong ARTICLE', corrected: 'right ARTICLE', note: null });
    expect(report.patterns[1]).toMatchObject({ count: 2, repeating: false, learned: 1 });
  });

  it('compares this week with the week before', async () => {
    const { service, prisma } = setup();
    prisma.flashcard.findMany.mockResolvedValue([
      card('ARTICLE', 1), card('ARTICLE', 2), card('ARTICLE', 9), // 2 this week, 1 before: getting worse
      card('TENSE', 1), card('TENSE', 8), card('TENSE', 9), // 1 this week, 2 before: improving
      card('SPELLING', 2), card('SPELLING', 10), // same
    ]);
    const byName = Object.fromEntries((await service.getMistakesReport('u1')).patterns.map((p) => [p.pattern, p]));
    expect(byName.ARTICLE).toMatchObject({ last7: 2, prev7: 1, trend: 'up' });
    expect(byName.TENSE).toMatchObject({ last7: 1, prev7: 2, trend: 'down' });
    expect(byName.SPELLING.trend).toBe('same');
  });

  it('copes with no corrections and keeps the period sensible', async () => {
    const { service, prisma } = setup();
    expect(await service.getMistakesReport('u1')).toEqual({ days: 30, total: 0, patterns: [] });
    expect((await service.getMistakesReport('u1', 3)).days).toBe(7);
    expect((await service.getMistakesReport('u1', 9999)).days).toBe(180);
    expect(prisma.flashcard.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1', kind: 'correction' });
  });
});

describe('syncHistory', () => {
  it('turns recent voice and chat corrections into cards, using the time they were made', async () => {
    const { service, prisma } = setup();
    const made = new Date('2026-10-20T00:00:00Z');
    prisma.voiceCorrection.findMany.mockResolvedValue([
      { id: 'v1', original: 'I go home', corrected: 'I went home', note: null, category: 'grammar', createdAt: made },
    ]);
    prisma.message.findMany.mockResolvedValue([
      { id: 'm1', content: 'She has a dog', metadata: { note: 'has' }, createdAt: made, replyTo: { content: 'She have a dog' } },
      { id: 'm2', content: 'x', metadata: null, createdAt: made, replyTo: null }, // original message is gone
    ]);

    expect(await service.syncHistory('u1')).toEqual({ added: 2 });
    const cards = prisma.flashcard.create.mock.calls.map((c: any) => c[0].data);
    expect(cards.map((c: any) => [c.source, c.sourceId, c.pattern])).toEqual([
      ['voice', 'v1', 'TENSE'],
      ['chat', 'm1', 'AGREEMENT'],
    ]);
    expect(cards[0].createdAt).toBe(made);
    expect(prisma.voiceCorrection.findMany.mock.calls[0][0].where).toMatchObject({ targetUserId: 'u1', status: { not: 'dismissed' } });
  });

  it('does not run again straight away, unless forced', async () => {
    const { service, prisma } = setup();
    await service.syncHistory('u1');
    await service.syncHistory('u1');
    expect(prisma.voiceCorrection.findMany).toHaveBeenCalledTimes(1);
    await service.syncHistory('u1', { force: true });
    expect(prisma.voiceCorrection.findMany).toHaveBeenCalledTimes(2);
    await service.syncHistory('u2');
    expect(prisma.voiceCorrection.findMany).toHaveBeenCalledTimes(3);
  });

  it('counts only cards that were new', async () => {
    const { service, prisma } = setup();
    prisma.voiceCorrection.findMany.mockResolvedValue([
      { id: 'v1', original: 'I go home', corrected: 'I went home', note: null, category: 'grammar', createdAt: new Date() },
    ]);
    prisma.flashcard.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );
    expect(await service.syncHistory('u1')).toEqual({ added: 0 });
  });
});
