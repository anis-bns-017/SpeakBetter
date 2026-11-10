import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PACKS } from '../vocab-packs/packs.content';
import { cardSourceId } from '../vocab-packs/packs.service';
import {
  cardSource,
  fromCard,
  fromSavedWord,
  normalWord,
  stageOf,
  summarize,
  validateNewWord,
  type CardWithReview,
  type SavedWordRow,
} from './words.engine';
import { WordsService } from './words.service';

const NOW = new Date('2026-11-06T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const card = (over: Partial<CardWithReview> = {}): CardWithReview => ({
  id: 'c1',
  front: 'reluctant',
  back: 'not wanting to do something',
  note: 'She was reluctant to speak.',
  source: 'pack',
  sourceId: cardSourceId(PACKS[0].id, PACKS[0].words[0].id),
  createdAt: daysAgo(3),
  reviews: [],
  ...over,
});

const review = (over: Record<string, unknown> = {}) => ({
  stability: 10,
  difficulty: 5,
  easeFactor: 2.5,
  interval: 10,
  reviewCount: 3,
  lapses: 0,
  lastReviewedAt: daysAgo(10),
  dueAt: NOW,
  ...over,
});

const savedWord = (over: Partial<SavedWordRow> = {}): SavedWordRow => ({
  id: 'w1',
  word: 'meanwhile',
  meaning: null,
  sentence: 'Meanwhile, I was cooking.',
  roomName: 'Coffee chat',
  createdAt: daysAgo(1),
  stability: null,
  difficulty: null,
  box: 0,
  dueAt: daysAgo(1),
  reviewCount: 0,
  lapses: 0,
  interval: 0,
  lastReviewedAt: null,
  ...over,
});

describe('My words: building the list', () => {
  it('names the pack a word came from, and labels your own words', () => {
    expect(cardSource('pack', cardSourceId(PACKS[0].id, 'x'))).toEqual({
      source: 'pack',
      label: `${PACKS[0].title} pack`,
    });
    expect(cardSource('pack', 'gone-pack:x')).toEqual({
      source: 'pack',
      label: 'Word pack',
    });
    expect(cardSource('mine', 'hello')).toEqual({
      source: 'mine',
      label: 'Added by you',
    });
    expect(cardSource('dict', 'abandon')).toEqual({
      source: 'dict',
      label: 'Dictionary',
    });
    // cards made by hand before My words existed have no source
    expect(cardSource(null, null).source).toBe('mine');
  });

  it('uses the Memory tab stages: new, learning (relearning, no gap yet), learned', () => {
    expect(stageOf({ reviewCount: 0, interval: 0 })).toBe('new');
    expect(stageOf({ reviewCount: 2, interval: 0 })).toBe('learning');
    expect(stageOf({ reviewCount: 2, interval: 4 })).toBe('learned');
  });

  it('treats a word card without a review row as new and due', () => {
    const item = fromCard(card(), NOW);
    expect(item).toMatchObject({
      key: 'card:c1',
      type: 'card',
      word: 'reluctant',
      source: 'pack',
      stage: 'new',
      recall: null,
      due: true,
      reviews: 0,
    });
  });

  it('gives a reviewed card its FSRS recall chance', () => {
    // stability 10 days, last seen 10 days ago: recall is 90%
    const item = fromCard(card({ reviews: [review()] }), NOW);
    expect(item.recall).toBe(90);
    expect(item.stage).toBe('learned');
    expect(item.reviews).toBe(3);
  });

  it('shows words from rooms with the room they were heard in', () => {
    const item = fromSavedWord(savedWord(), NOW);
    expect(item).toMatchObject({
      key: 'word:w1',
      type: 'word',
      source: 'room',
      sourceLabel: 'Heard in Coffee chat',
      meaning: null,
      example: 'Meanwhile, I was cooking.',
      stage: 'new',
      due: true,
    });
    expect(fromSavedWord(savedWord({ roomName: null }), NOW).sourceLabel).toBe(
      'Heard in a room',
    );
  });

  it('estimates recall for room words still on the old boxes', () => {
    // box 2 is a 4-day gap: reviewed 4 days before it fell due, which is now
    const item = fromSavedWord(
      savedWord({ box: 2, reviewCount: 3, dueAt: NOW }),
      NOW,
    );
    expect(item.recall).toBe(90);
    expect(item.stage).toBe('learned');
  });

  it('adds up the totals for the tiles and filters', () => {
    const items = [
      fromCard(card(), NOW),
      fromCard(
        card({
          id: 'c2',
          source: 'mine',
          sourceId: 'hello',
          createdAt: daysAgo(20),
          reviews: [review({ dueAt: new Date(NOW.getTime() + DAY) })],
        }),
        NOW,
      ),
      fromSavedWord(savedWord(), NOW),
    ];
    expect(summarize(items, NOW)).toEqual({
      total: 3,
      due: 2,
      thisWeek: 2,
      averageRecall: 90,
      bySource: { pack: 1, dict: 0, library: 0, room: 1, mine: 1 },
      byStage: { new: 2, learning: 0, learned: 1 },
    });
    expect(summarize([], NOW).averageRecall).toBeNull();
  });
});

describe('My words: checking a word you add', () => {
  it('accepts a word or short phrase with a meaning, trimming quotes and end punctuation', () => {
    expect(
      validateNewWord({
        word: '  “give up”. ',
        meaning: ' to stop trying ',
        example: '',
      }),
    ).toEqual({
      ok: true,
      word: 'give up',
      meaning: 'to stop trying',
      example: null,
    });
    expect(
      validateNewWord({
        word: 'café',
        meaning: 'কফি',
        example: 'Meet me at the café.',
      }),
    ).toMatchObject({ ok: true, example: 'Meet me at the café.' });
  });

  it('refuses empty, letterless, too long or sentence-sized entries, and a missing meaning', () => {
    expect(validateNewWord({ word: '', meaning: 'x' })).toMatchObject({
      ok: false,
    });
    expect(validateNewWord({ word: '1234', meaning: 'x' })).toMatchObject({
      ok: false,
    });
    expect(
      validateNewWord({ word: 'a'.repeat(61), meaning: 'x' }),
    ).toMatchObject({ ok: false });
    expect(
      validateNewWord({
        word: 'this is far too many words for one entry',
        meaning: 'x',
      }),
    ).toMatchObject({ ok: false });
    expect(validateNewWord({ word: 'hello', meaning: '  ' })).toMatchObject({
      ok: false,
      error: 'Add what it means, in any language',
    });
    expect(
      validateNewWord({ word: 'hello', meaning: 'x'.repeat(301) }),
    ).toMatchObject({ ok: false });
    expect(validateNewWord(null)).toMatchObject({ ok: false });
  });

  it('compares words without caring about case or spacing', () => {
    expect(normalWord('  Give   Up ')).toBe('give up');
  });
});

describe('WordsService', () => {
  const setup = () => {
    const prisma = {
      flashcard: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      voiceSavedWord: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    const review = {
      addWordCard: jest.fn().mockResolvedValue({ created: true }),
    };
    const service = new WordsService(prisma as any, review as any);
    return { prisma, review, service };
  };

  it('lists cards and room words together, newest first, only the word kind of card', async () => {
    const { prisma, service } = setup();
    prisma.flashcard.findMany.mockResolvedValue([
      card({ createdAt: daysAgo(5) }),
    ]);
    prisma.voiceSavedWord.findMany.mockResolvedValue([
      savedWord({ createdAt: daysAgo(1) }),
    ]);
    const result = await service.list('u1', NOW);
    expect(prisma.flashcard.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      kind: 'word',
    });
    expect(result.items.map((i) => i.key)).toEqual(['word:w1', 'card:c1']);
    expect(result.summary.total).toBe(2);
  });

  it('adds your own word into review, keyed by the word so it is never saved twice', async () => {
    const { prisma, review, service } = setup();
    prisma.flashcard.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        card({
          id: 'c9',
          front: 'Give up',
          source: 'mine',
          sourceId: 'give up',
          createdAt: NOW,
        }),
      );
    const item = await service.add('u1', {
      word: 'Give up',
      meaning: 'to stop trying',
    });
    expect(review.addWordCard).toHaveBeenCalledWith('u1', {
      source: 'mine',
      sourceId: 'give up',
      word: 'Give up',
      meaning: 'to stop trying',
      example: null,
    });
    expect(item).toMatchObject({
      key: 'card:c9',
      source: 'mine',
      sourceLabel: 'Added by you',
      stage: 'new',
    });
  });

  it('refuses a word you already have, from any source', async () => {
    const { prisma, review, service } = setup();
    prisma.voiceSavedWord.findFirst.mockResolvedValue({ id: 'w1' });
    await expect(
      service.add('u1', { word: 'Meanwhile', meaning: 'at the same time' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.voiceSavedWord.findFirst.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      word: 'meanwhile',
    });
    expect(review.addWordCard).not.toHaveBeenCalled();
  });

  it('refuses a bad word before touching the database', async () => {
    const { prisma, service } = setup();
    await expect(
      service.add('u1', { word: '', meaning: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.flashcard.findFirst).not.toHaveBeenCalled();
  });

  it('edits the meaning of a room word, only your own', async () => {
    const { prisma, service } = setup();
    prisma.voiceSavedWord.updateMany.mockResolvedValue({ count: 1 });
    prisma.voiceSavedWord.findFirst.mockResolvedValue(
      savedWord({ meaning: 'at the same time' }),
    );
    const item = await service.update('u1', 'word', 'w1', {
      meaning: 'at the same time',
      example: '',
    });
    expect(prisma.voiceSavedWord.updateMany).toHaveBeenCalledWith({
      where: { id: 'w1', userId: 'u1' },
      data: { meaning: 'at the same time', sentence: null },
    });
    expect(item.meaning).toBe('at the same time');

    prisma.voiceSavedWord.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update('u1', 'word', 'other', { meaning: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update('u1', 'card', 'c1', { meaning: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes only your own word cards (never a correction card) and room words', async () => {
    const { prisma, service } = setup();
    prisma.flashcard.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.remove('u1', 'card', 'c1')).resolves.toEqual({
      removed: true,
    });
    expect(prisma.flashcard.deleteMany).toHaveBeenCalledWith({
      where: { id: 'c1', userId: 'u1', kind: 'word' },
    });

    prisma.voiceSavedWord.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('u1', 'word', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
