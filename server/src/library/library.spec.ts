import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LIBRARY, LIBRARY_LEVELS, layoutFor, optionOrder, readingMinutes, topicsOf, wordCount } from './library.content';
import { LIBRARY_XP, LibraryService, wordCardId } from './library.service';

const wholeWord = (word: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu');

describe('library content', () => {
  it('has unique ids and plenty of texts at every level', () => {
    const ids = LIBRARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LIBRARY.length).toBeGreaterThanOrEqual(80);
    for (const level of LIBRARY_LEVELS) expect(LIBRARY.filter((t) => t.level === level).length).toBeGreaterThanOrEqual(10);
  });

  it('lists texts from the easiest level to the hardest', () => {
    const order = LIBRARY.map((t) => LIBRARY_LEVELS.indexOf(t.level));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('gives every text a title, topic, summary, enough sentences and an id that starts with its level', () => {
    for (const t of LIBRARY) {
      expect(t.id.startsWith(`${t.level.toLowerCase()}-`)).toBe(true);
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.topic.length).toBeGreaterThan(2);
      expect(t.summary.length).toBeGreaterThan(10);
      expect(t.sentences.length).toBeGreaterThanOrEqual(7);
      expect(t.sentences.length).toBeLessThanOrEqual(16);
      for (const sentence of t.sentences) expect(sentence.text.trim().length).toBeGreaterThan(3);
      if (t.kind === 'dialogue') expect(t.sentences.every((x) => !!x.speaker)).toBe(true);
    }
  });

  it('points every question at a real sentence and keeps the answer options sound', () => {
    for (const t of LIBRARY) {
      expect(t.questions.length).toBeGreaterThanOrEqual(3);
      expect(new Set(t.questions.map((q) => q.id)).size).toBe(t.questions.length);
      for (const q of t.questions) {
        expect(q.sentence).toBeGreaterThanOrEqual(0);
        expect(q.sentence).toBeLessThan(t.sentences.length);
        expect(q.question.length).toBeGreaterThan(8);
        expect(q.explanation.length).toBeGreaterThan(8);
        if (q.type === 'tfng') {
          expect(q.options).toEqual(['True', 'False', 'Not given']);
          expect(q.fixed).toBe(true);
          expect(q.correct).toBeGreaterThanOrEqual(0);
          expect(q.correct).toBeLessThan(3);
        } else {
          expect(q.options).toHaveLength(4);
          expect(new Set(q.options).size).toBe(4);
          expect(q.fixed).toBeFalsy();
        }
      }
    }
  });

  it('mixes question types: every level has true / false / not given and word-meaning questions', () => {
    for (const level of LIBRARY_LEVELS) {
      const types = new Set(LIBRARY.filter((t) => t.level === level).flatMap((t) => t.questions.map((q) => q.type)));
      expect(types.has('tfng')).toBe(true);
      expect(types.has('detail')).toBe(true);
    }
    for (const level of ['B1', 'B2', 'C1', 'C2'] as const) {
      const types = new Set(LIBRARY.filter((t) => t.level === level).flatMap((t) => t.questions.map((q) => q.type)));
      expect(types.has('vocab') || types.has('inference')).toBe(true);
    }
  });

  it('gives each text key words that really appear in the sentence they point to, without defining a word by itself', () => {
    for (const t of LIBRARY) {
      expect(t.vocab.length).toBeGreaterThanOrEqual(3);
      expect(t.vocab.length).toBeLessThanOrEqual(6);
      expect(new Set(t.vocab.map((w) => w.word.toLowerCase())).size).toBe(t.vocab.length);
      for (const w of t.vocab) {
        expect(t.sentences[w.sentence]).toBeDefined();
        expect({ id: t.id, word: w.word, found: wholeWord(w.word).test(t.sentences[w.sentence].text) }).toEqual({ id: t.id, word: w.word, found: true });
        expect(wholeWord(w.word).test(w.meaning)).toBe(false);
      }
    }
  });

  it('gives each text something to talk about', () => {
    for (const t of LIBRARY) {
      expect(t.discuss.length).toBeGreaterThanOrEqual(2);
      for (const d of t.discuss) expect(d.trim().endsWith('?') || d.trim().endsWith('.')).toBe(true);
    }
  });

  it('gets longer and harder as the levels go up', () => {
    const avg = (level: (typeof LIBRARY_LEVELS)[number]) => {
      const texts = LIBRARY.filter((t) => t.level === level);
      return texts.reduce((n, t) => n + wordCount(t), 0) / texts.length;
    };
    expect(avg('A1')).toBeLessThan(avg('B1'));
    expect(avg('B1')).toBeLessThan(avg('C1'));
  });

  it('covers many topics', () => {
    expect(topicsOf().length).toBeGreaterThanOrEqual(15);
  });

  it('shuffles options the same way for a reader, and differently between readers', () => {
    expect(optionOrder('u1:a1-cafe:q1')).toEqual(optionOrder('u1:a1-cafe:q1'));
    expect([...optionOrder('u1:a1-cafe:q1')].sort()).toEqual([0, 1, 2, 3]);
    const orders = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((u) => optionOrder(`${u}:a1-cafe:q1`).join('')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('keeps True / False / Not given in place', () => {
    const q = LIBRARY.flatMap((t) => t.questions).find((x) => x.type === 'tfng')!;
    const layout = layoutFor('u1', 'x', q);
    expect(layout.order).toEqual([0, 1, 2]);
    expect(layout.correctIndex).toBe(q.correct);
  });

  it('estimates at least a minute of reading', () => {
    for (const t of LIBRARY) expect(readingMinutes(t)).toBeGreaterThanOrEqual(1);
  });
});

function setup(level: string | null = 'B1') {
  const rows = new Map<string, any>();
  const cards: any[] = [];
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level }) },
    libraryProgress: {
      findMany: jest.fn(async () => [...rows.values()]),
      findUnique: jest.fn(async ({ where }) => rows.get(where.userId_textId.textId) ?? null),
      upsert: jest.fn(async ({ where, create, update }) => {
        const id = where.userId_textId.textId;
        const row = rows.get(id);
        if (!row) rows.set(id, { ...create });
        else rows.set(id, { ...row, ...update, attempts: row.attempts + 1 });
        return rows.get(id);
      }),
    },
    flashcard: {
      findMany: jest.fn(async ({ where }) => cards.filter((c) => c.sourceId.startsWith(where.sourceId.startsWith))),
      count: jest.fn(async ({ where }) => cards.filter((c) => c.sourceId === where.sourceId).length),
    },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  const review: any = {
    addWordCard: jest.fn(async (_u: string, input: any) => {
      cards.push({ sourceId: input.sourceId });
      return { created: true };
    }),
  };
  return { service: new LibraryService(prisma, activity, badges, review), activity, badges, review, rows };
}

/** The answers a reader should send to get everything right (the shown index of each right answer) */
const rightAnswers = (userId: string, textId: string) => {
  const text = LIBRARY.find((t) => t.id === textId)!;
  return Object.fromEntries(text.questions.map((q) => [q.id, layoutFor(userId, textId, q).correctIndex]));
};

describe('LibraryService', () => {
  it('lists every text with progress, counts per level, topics and a text to read next', async () => {
    const { service } = setup('B1');
    const list = await service.list('u1');
    expect(list.level).toBe('B1');
    expect(list.texts).toHaveLength(LIBRARY.length);
    expect(list.levels.map((l) => l.level)).toEqual([...LIBRARY_LEVELS]);
    expect(list.levels.find((l) => l.level === 'A1')).toMatchObject({ done: 0, total: LIBRARY.filter((t) => t.level === 'A1').length });
    expect(list.texts[0]).toMatchObject({ done: false, started: false, bestScore: null });
    expect(list.texts[0].words).toBeGreaterThan(20);
    expect(list.topics.length).toBeGreaterThan(10);
    expect(list.recommended).toMatchObject({ level: 'B1' });
    expect(list.stats).toEqual({ wordsRead: 0, minutesRead: 0, perfect: 0 });
  });

  it('recommends the next unread text at your level, then moves up when the level is finished', async () => {
    const { service, rows } = setup('A1');
    const firstA1 = LIBRARY.find((t) => t.level === 'A1')!;
    expect((await service.list('u1')).recommended?.id).toBe(firstA1.id);
    rows.set(firstA1.id, { textId: firstA1.id, bestScore: 4, total: 4, attempts: 1, completedAt: new Date() });
    const secondA1 = LIBRARY.filter((t) => t.level === 'A1')[1];
    const list = await service.list('u1');
    expect(list.recommended?.id).toBe(secondA1.id);
    expect(list.stats.wordsRead).toBe(wordCount(firstA1));
    expect(list.stats.perfect).toBe(1);

    for (const t of LIBRARY.filter((x) => x.level === 'A1')) rows.set(t.id, { textId: t.id, bestScore: 1, total: 4, attempts: 1, completedAt: new Date() });
    expect((await service.list('u1')).recommended?.level).toBe('A2');
  });

  it('gives a text with shuffled options, key words, talking points and never the answers', async () => {
    const { service } = setup();
    const text = await service.get('u1', 'a1-cafe');
    expect(text.sentences.length).toBeGreaterThan(5);
    expect(text.questions[0].options).toHaveLength(4);
    expect(text.vocab.length).toBeGreaterThanOrEqual(3);
    expect(text.vocab[0]).toMatchObject({ saved: false });
    expect(text.discuss.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(text.questions)).not.toMatch(/explanation|correct/);
    expect(text.next).toMatchObject({ id: 'a1-flat' });
    await expect(service.get('u1', 'nope')).rejects.toThrow(NotFoundException);
  });

  it('shows True / False / Not given questions in a fixed order', async () => {
    const { service } = setup();
    const text = await service.get('u1', 'a1-morning');
    const tfng = text.questions.find((q) => q.type === 'tfng')!;
    expect(tfng.options).toEqual(['True', 'False', 'Not given']);
  });

  it('marks answers, keeps the best score, and gives XP only the first time', async () => {
    const { service, activity, badges, rows } = setup();
    const right = rightAnswers('u1', 'a2-cooking');
    const wrongFirst = { ...right, q1: (right.q1 + 1) % 4 };
    const total = LIBRARY.find((t) => t.id === 'a2-cooking')!.questions.length;

    const first = await service.answer('u1', 'a2-cooking', wrongFirst);
    expect(first).toMatchObject({ score: total - 1, total, firstCompletion: true, xp: LIBRARY_XP });
    expect(first.results[0]).toMatchObject({ correct: false, correctIndex: right.q1 });
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', LIBRARY_XP, 'LESSON_COMPLETED');
    expect(badges.evaluate).toHaveBeenCalledWith('u1');

    const second = await service.answer('u1', 'a2-cooking', right);
    expect(second).toMatchObject({ score: total, firstCompletion: false, xp: 0 });
    expect(rows.get('a2-cooking')).toMatchObject({ bestScore: total, attempts: 2 });
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('marks a True / False / Not given answer by its fixed position', async () => {
    const { service } = setup();
    const text = LIBRARY.find((t) => t.id === 'a1-morning')!;
    const tfng = text.questions.find((q) => q.type === 'tfng')!;
    const right = rightAnswers('u1', 'a1-morning');
    const wrong = { ...right, [tfng.id]: ((tfng.correct as number) + 1) % 3 };
    const result = await service.answer('u1', 'a1-morning', wrong);
    const r = result.results.find((x) => x.id === tfng.id)!;
    expect(r).toMatchObject({ correct: false, correctIndex: tfng.correct, type: 'tfng' });
  });

  it('wants an answer to every question', async () => {
    const { service } = setup();
    await expect(service.answer('u1', 'a1-cafe', { q1: 0 })).rejects.toThrow(/every question/);
    await expect(service.answer('u1', 'a1-cafe', null)).rejects.toThrow(BadRequestException);
    await expect(service.answer('u1', 'a1-cafe', { q1: 0, q2: 9, q3: 1 })).rejects.toThrow(/every question/);
  });

  it('saves a key word as a flashcard once, and shows it as saved afterwards', async () => {
    const { service, review } = setup();
    const word = LIBRARY.find((t) => t.id === 'a1-cafe')!.vocab[0];
    const first = await service.saveWord('u1', 'a1-cafe', word.word);
    expect(first).toMatchObject({ saved: true, created: true });
    expect(review.addWordCard).toHaveBeenCalledWith('u1', expect.objectContaining({ source: 'library', sourceId: wordCardId('a1-cafe', word.word), word: word.word, meaning: word.meaning }));
    const again = await service.saveWord('u1', 'a1-cafe', word.word.toUpperCase());
    expect(again).toMatchObject({ saved: true, created: false });
    expect(review.addWordCard).toHaveBeenCalledTimes(1);
    const text = await service.get('u1', 'a1-cafe');
    expect(text.vocab.find((w) => w.word === word.word)).toMatchObject({ saved: true });
  });

  it('only saves the text\'s own key words', async () => {
    const { service } = setup();
    await expect(service.saveWord('u1', 'a1-cafe', 'elephant')).rejects.toThrow(BadRequestException);
    await expect(service.saveWord('u1', 'nope', 'menu')).rejects.toThrow(NotFoundException);
  });
});
