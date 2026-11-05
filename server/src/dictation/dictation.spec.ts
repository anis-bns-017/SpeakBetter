import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LIBRARY_LEVELS } from '../library/library.content';
import { DICTATION_XP, SESSION_SIZE, itemById, markDictation, normalizeWord, pickSession, poolFor } from './dictation.engine';
import { DictationService } from './dictation.service';

const kinds = (target: string, typed: string) => markDictation(target, typed).tokens.map((t) => `${t.kind}:${t.word}${t.typed ? `>${t.typed}` : ''}`);

describe('dictation marking', () => {
  it('ignores case, punctuation and curly apostrophes', () => {
    expect(normalizeWord('“Don’t,')).toBe("don't");
    const m = markDictation("I don't like rainy days.", 'i dont like Rainy days');
    // "dont" is a spelling slip for "don't"
    expect(m.tokens.map((t) => t.kind)).toEqual(['ok', 'spelling', 'ok', 'ok', 'ok']);
    expect(markDictation('Hello, world!', 'hello world').score).toBe(100);
  });

  it('labels spelling slips, different words, missing and extra words', () => {
    expect(kinds('She lives near the station', 'She lifes near station today')).toEqual([
      'ok:She',
      'spelling:lives>lifes',
      'ok:near',
      'missing:the',
      'ok:station',
      'extra:today',
    ]);
    expect(kinds('I bought a new phone', 'I brought a new phone')).toEqual(['ok:I', 'spelling:bought>brought', 'ok:a', 'ok:new', 'ok:phone']);
    expect(kinds('We eat rice', 'We cook rice')).toEqual(['ok:We', 'wrong:eat>cook', 'ok:rice']);
  });

  it('scores the share of words right', () => {
    expect(markDictation('one two three four', 'one two three four').score).toBe(100);
    expect(markDictation('one two three four', 'one two').score).toBe(50);
    expect(markDictation('one two three four', '').score).toBe(0);
    expect(markDictation('one two three four', '').tokens.every((t) => t.kind === 'missing')).toBe(true);
  });
});

describe('dictation sentences', () => {
  it('has enough sentences at every level, each a sensible length', () => {
    for (const level of LIBRARY_LEVELS) {
      const pool = poolFor(level);
      expect(pool.length).toBeGreaterThanOrEqual(SESSION_SIZE * 2);
      for (const item of pool) {
        const n = item.text.split(/\s+/).length;
        expect(n).toBeGreaterThanOrEqual(4);
        expect(n).toBeLessThanOrEqual(18);
        expect(itemById(item.id)?.text).toBe(item.text);
      }
    }
  });

  it('picks six different sentences, the same for the same seed, different for the next attempt', () => {
    const a = pickSession('B1', 'u1:2026-11-05:0');
    expect(a).toHaveLength(SESSION_SIZE);
    expect(new Set(a.map((i) => i.id)).size).toBe(SESSION_SIZE);
    expect(pickSession('B1', 'u1:2026-11-05:0')).toEqual(a);
    expect(pickSession('B1', 'u1:2026-11-05:1').map((i) => i.id)).not.toEqual(a.map((i) => i.id));
  });
});

function setup(options: { doneToday?: number } = {}) {
  const rows: any[] = [];
  for (let i = 0; i < (options.doneToday ?? 0); i++) rows.push({ userId: 'u1', day: '2026-11-05', score: 50 });
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level: 'A2', timezone: 'UTC' }) },
    dictationResult: {
      count: jest.fn(async ({ where }: any) => rows.filter((r) => r.userId === where.userId && (!where.day || r.day === where.day)).length),
      findFirst: jest.fn(async () => (rows.length ? { score: Math.max(...rows.map((r) => r.score)) } : null)),
      create: jest.fn(async ({ data }: any) => rows.push(data)),
    },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const review: any = { addCorrectionCard: jest.fn().mockResolvedValue({ created: true }) };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  return { service: new DictationService(prisma, activity, review, badges), rows, activity, review, badges };
}

const at = new Date(Date.UTC(2026, 10, 5, 10, 0));

describe('DictationService', () => {
  it('gives today\'s sentences at your level, and a new set after you finish one', async () => {
    const { service } = setup();
    const first = await service.session('u1', at);
    expect(first).toMatchObject({ level: 'A2', day: '2026-11-05', attempt: 0, doneToday: 0 });
    expect(first.items).toHaveLength(SESSION_SIZE);
    const again = await service.session('u1', at);
    expect(again.items).toEqual(first.items);
    const { service: after } = setup({ doneToday: 1 });
    expect((await after.session('u1', at)).items).not.toEqual(first.items);
  });

  it('checks one sentence without saving', () => {
    const { service, rows } = setup();
    const item = poolFor('A2')[0];
    const r = service.check(item.id, item.text.toUpperCase());
    expect(r).toMatchObject({ id: item.id, text: item.text, score: 100 });
    expect(() => service.check('nope:1', 'x')).toThrow(NotFoundException);
    expect(() => service.check(item.id, '  ')).toThrow(BadRequestException);
    expect(rows).toHaveLength(0);
  });

  it('saves a finished dictation, pays XP for the first one today, and sends mistakes to review', async () => {
    const { service, rows, activity, review, badges } = setup();
    const [a, b] = poolFor('A2');
    const result = await service.finish('u1', { [a.id]: a.text, [b.id]: 'something else entirely' }, at);
    expect(result.results[0].score).toBe(100);
    expect(result.results[1].score).toBeLessThan(100);
    expect(result.perfect).toBe(false);
    expect(result.xp).toBe(DICTATION_XP);
    expect(result.cardsAdded).toBe(1);
    expect(review.addCorrectionCard).toHaveBeenCalledWith('u1', expect.objectContaining({ source: 'dictation', sourceId: b.id, original: 'something else entirely', corrected: b.text }));
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', DICTATION_XP, 'EXERCISE_COMPLETED');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 'u1', day: '2026-11-05', sentences: 2, perfectSentences: 1 });
    expect(badges.evaluate).toHaveBeenCalled();

    const second = await service.finish('u1', { [a.id]: a.text }, at);
    expect(second).toMatchObject({ xp: 0, perfect: true, score: 100, cardsAdded: 0 });
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('rejects empty or unknown answers', async () => {
    const { service } = setup();
    await expect(service.finish('u1', undefined, at)).rejects.toThrow(BadRequestException);
    await expect(service.finish('u1', {}, at)).rejects.toThrow(BadRequestException);
    await expect(service.finish('u1', ['x'], at)).rejects.toThrow(BadRequestException);
    await expect(service.finish('u1', { 'nope:1': 'x' }, at)).rejects.toThrow(BadRequestException);
  });

  it('gives six sentences to shadow, a different set each round, and treats a bad round as the first', async () => {
    const { service } = setup();
    const first = await service.shadowing('u1', '0', at);
    expect(first).toMatchObject({ level: 'A2', round: 0 });
    expect(first.items).toHaveLength(SESSION_SIZE);
    expect((await service.shadowing('u1', '1', at)).items).not.toEqual(first.items);
    expect((await service.shadowing('u1', 'abc', at)).items).toEqual(first.items);
    expect((await service.shadowing('u1', '-5', at)).round).toBe(0);
    expect((await service.shadowing('u1', '99999', at)).round).toBe(999);
  });

  it('does not make a card for a sentence left empty', async () => {
    const { service, review } = setup();
    const [a] = poolFor('A2');
    const r = await service.finish('u1', { [a.id]: '' }, at);
    expect(r.score).toBe(0);
    expect(review.addCorrectionCard).not.toHaveBeenCalled();
  });
});
