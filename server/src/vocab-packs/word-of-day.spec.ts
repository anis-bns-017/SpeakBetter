import { PACK_LEVELS } from './packs.content';
import { dayNumber, meaningChoices, poolFor, wordOfDay } from './word-of-day';
import { VocabPacksService, cardSourceId } from './packs.service';

/** YYYY-MM-DD for `n` days after 2026-11-01 */
const dayAfter = (n: number) => new Date(Date.UTC(2026, 10, 1 + n)).toISOString().slice(0, 10);

describe('word of the day', () => {
  it('draws from the learner\'s level and the one below', () => {
    expect(new Set(poolFor('A1').map((w) => w.level))).toEqual(new Set(['A1']));
    expect(new Set(poolFor('B1').map((w) => w.level))).toEqual(new Set(['A2', 'B1']));
    expect(new Set(poolFor('C1').map((w) => w.level))).toEqual(new Set(['B2', 'C1']));
    for (const level of PACK_LEVELS) expect(poolFor(level).length).toBeGreaterThanOrEqual(24);
  });

  it('counts days the same way everywhere', () => {
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2026-11-06') - dayNumber('2026-11-05')).toBe(1);
  });

  it('is the same word all day for everyone at a level', () => {
    expect(wordOfDay('B1', '2026-11-05')).toEqual(wordOfDay('B1', '2026-11-05'));
  });

  it('never repeats a word within any run of days as long as the pool, wherever the run starts', () => {
    for (const level of PACK_LEVELS) {
      const size = poolFor(level).length;
      // several starting points, including ones that straddle the end of the pool
      for (const offset of [0, 1, Math.floor(size / 2), size - 3, size + 7]) {
        const seen = new Set<string>();
        for (let d = offset; d < offset + size; d++) {
          const w = wordOfDay(level, dayAfter(d));
          seen.add(`${w.packId}:${w.wordId}`);
        }
        expect(seen.size).toBe(size);
      }
    }
  });

  it('changes every day of the week, including this week', () => {
    for (const start of [0, 3, 30, 57]) {
      const week = new Set(Array.from({ length: 7 }, (_, d) => wordOfDay('A2', dayAfter(start + d)).word));
      expect(week.size).toBe(7);
    }
    expect(dayNumber('2026-11-01')).toBe(20758);
  });

  it('offers three different meanings with the right one marked, steady for the day', () => {
    for (let d = 0; d < 30; d++) {
      const day = dayAfter(d);
      const word = wordOfDay('B2', day);
      const choice = meaningChoices(word, day);
      expect(choice.options).toHaveLength(3);
      expect(new Set(choice.options).size).toBe(3);
      expect(choice.options[choice.answer]).toBe(word.meaning);
      expect(meaningChoices(word, day)).toEqual(choice);
    }
  });
});

describe('VocabPacksService.today', () => {
  function setup(profile: { level: string | null; timezone: string | null } | null, savedCount = 0) {
    const prisma: any = {
      profile: { findUnique: jest.fn().mockResolvedValue(profile) },
      flashcard: { count: jest.fn().mockResolvedValue(savedCount) },
    };
    return { service: new VocabPacksService(prisma, {} as any, {} as any), prisma };
  }

  it('uses the learner\'s level and their own calendar day', async () => {
    // 20:30 UTC on 5 Nov is already 6 Nov in Dhaka
    const at = new Date(Date.UTC(2026, 10, 5, 20, 30));
    const { service } = setup({ level: 'B1', timezone: 'Asia/Dhaka' });
    const today = await service.today('u1', at);
    expect(today.day).toBe('2026-11-06');
    expect(today).toMatchObject(wordOfDay('B1', '2026-11-06'));
    expect(today.options[today.answer]).toBe(today.meaning);
    expect(today.saved).toBe(false);
  });

  it('says when the word is already in their review', async () => {
    const at = new Date(Date.UTC(2026, 10, 5, 9, 0));
    const { service, prisma } = setup({ level: 'A1', timezone: 'UTC' }, 1);
    const today = await service.today('u1', at);
    expect(today.saved).toBe(true);
    expect(prisma.flashcard.count).toHaveBeenCalledWith({ where: { userId: 'u1', source: 'pack', sourceId: cardSourceId(today.packId, today.wordId) } });
  });

  it('works for someone with no profile yet', async () => {
    const { service } = setup(null);
    const today = await service.today('u1', new Date(Date.UTC(2026, 10, 5, 9, 0)));
    expect(today.word).toBeTruthy();
  });
});
