import { indexDictionary, type DictWord } from './dictionary.data';
import {
  BAND_SIZE,
  TEST_NONWORDS,
  TEST_WORDS_PER_BAND,
  bandOf,
  buildChecks,
  buildTest,
  commonness,
  findWord,
  levelForSize,
  linkedWords,
  listWords,
  nextWords,
  scoreTest,
  statusOf,
  wordMap,
  type Progress,
  type StoredTest,
} from './dictionary.engine';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** 10,000 made-up dictionary words, w1 (most common) to w10000 */
const makeWords = (): DictWord[] =>
  Array.from({ length: 10_000 }, (_, i) => ({
    id: `w${i + 1}`,
    w: `word${String.fromCharCode(97 + (i % 26))}${i + 1}`.replace(/\d/g, (d) =>
      String.fromCharCode(97 + Number(d)),
    ),
    lv: LEVELS[Math.min(5, Math.floor(i / 1700))],
    r: i + 1,
    pos: [i % 2 ? 'verb' : 'noun'],
    s: [{ p: i % 2 ? 'verb' : 'noun', d: `meaning number ${i + 1}` }],
    t: i % 3 ? ['Food & drink'] : ['Animals'],
  }));

const dict = indexDictionary({
  version: 1,
  count: 10_000,
  words: [
    ...makeWords().slice(3),
    {
      id: 'happy',
      w: 'happy',
      lv: 'A1',
      r: 1,
      pos: ['adjective'],
      s: [
        {
          p: 'adjective',
          d: 'feeling or showing pleasure',
          syn: ['glad', 'cheerful'],
          ant: ['sad'],
        },
      ],
      fam: ['happiness'],
      alt: [],
    },
    {
      id: 'sad',
      w: 'sad',
      lv: 'A1',
      r: 2,
      pos: ['adjective'],
      s: [{ p: 'adjective', d: 'feeling unhappy' }],
    },
    {
      id: 'colour',
      w: 'color',
      lv: 'A1',
      r: 3,
      pos: ['noun'],
      s: [{ p: 'noun', d: 'red, blue, green and so on' }],
      alt: ['colour'],
    },
  ],
  nonwords: Array.from(
    { length: 40 },
    (_, i) =>
      `blorf${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
  ),
  sources: [],
});

const empty = (): Progress => ({
  known: new Set(),
  saved: new Set(),
  learned: new Set(),
});
/** A predictable "random" for tests */
const seq = () => {
  let n = 0;
  return (max: number) => (n++ * 7919) % max;
};

describe('dictionary data', () => {
  it('indexes words by id, by text and by other spellings, and counts levels and topics', () => {
    expect(dict.words[0].id).toBe('happy');
    expect(dict.byText.get('colour')).toBe('colour');
    expect(dict.byText.get('color')).toBe('colour');
    expect(Object.values(dict.levelCounts).reduce((a, b) => a + b, 0)).toBe(
      10_000,
    );
    expect(dict.topics.map((t) => t.name)).toContain('Food & drink');
  });
});

describe('browsing and searching', () => {
  it('puts exact and prefix matches before words that only contain the text, then meanings', () => {
    const result = listWords(dict, empty(), { q: 'sad' });
    expect(result.items[0].id).toBe('sad');
    const byMeaning = listWords(dict, empty(), { q: 'pleasure' });
    expect(byMeaning.items.map((i) => i.id)).toEqual(['happy']);
    expect(listWords(dict, empty(), { q: 'colour' }).items[0].id).toBe(
      'colour',
    );
  });

  it('filters by level, topic, status and rank range, and pages the results', () => {
    const progress = empty();
    progress.known.add('happy');
    progress.saved.add('sad');
    expect(
      listWords(dict, progress, { status: 'known' }).items.map((i) => i.id),
    ).toEqual(['happy']);
    expect(
      listWords(dict, progress, { status: 'saved' }).items.map((i) => i.id),
    ).toEqual(['sad']);
    const a1 = listWords(dict, progress, { level: 'A1' });
    expect(a1.items.every((i) => i.level === 'A1')).toBe(true);
    const ranged = listWords(dict, progress, { rankFrom: 101, rankTo: 200 });
    expect(ranged.total).toBe(100);
    expect(ranged.items[0].rank).toBe(101);
    const page2 = listWords(dict, progress, { page: 2 });
    expect(page2.page).toBe(2);
    expect(page2.items[0].rank).toBe(49);
    expect(listWords(dict, progress, { page: 9999 }).page).toBe(page2.pages);
  });

  it('counts a learned My words word as known, and a saved one as saved', () => {
    const progress = empty();
    progress.saved.add('happy');
    expect(statusOf(dict.byId.get('happy')!, progress)).toBe('saved');
    progress.learned.add('happy');
    expect(statusOf(dict.byId.get('happy')!, progress)).toBe('known');
  });

  it('links synonyms, opposites and family words that have their own page', () => {
    expect(linkedWords(dict, dict.byId.get('happy')!)).toEqual({ sad: 'sad' });
  });

  it('says how common a word is in plain words', () => {
    expect(commonness(5)).toMatch(/1,000/);
    expect(commonness(4200)).toMatch(/5,000/);
    expect(commonness(9000)).toMatch(/10,000/);
    expect(commonness(10_000)).toMatch(/10,000 most common/);
    expect(commonness(10_001)).toMatch(/advanced/);
  });
});

describe('vocabulary size test', () => {
  it('asks 5 words from every 1,000-word band and 10 made-up words, shuffled, with unique keys', () => {
    const items = buildTest(dict, seq());
    expect(items).toHaveLength(10 * TEST_WORDS_PER_BAND + TEST_NONWORDS);
    for (let band = 0; band < 10; band++)
      expect(items.filter((i) => i.band === band)).toHaveLength(
        TEST_WORDS_PER_BAND,
      );
    expect(items.filter((i) => !i.wordId)).toHaveLength(TEST_NONWORDS);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(bandOf(1)).toBe(0);
    expect(bandOf(BAND_SIZE)).toBe(0);
    expect(bandOf(BAND_SIZE + 1)).toBe(1);
    expect(bandOf(10_000)).toBe(9);
    expect(bandOf(10_001)).toBe(10);
  });

  it('never asks about the advanced words ranked after the 10,000 most common', () => {
    const advanced: DictWord[] = Array.from({ length: 300 }, (_, i) => ({
      id: `adv${i + 1}`,
      w: `advanced${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
      lv: i % 2 ? 'C2' : 'C1',
      r: 10_001 + i,
      pos: ['adjective'],
      s: [{ p: 'adjective', d: `advanced meaning ${i + 1}` }],
    }));
    const extended = indexDictionary({
      ...dict,
      count: dict.words.length + advanced.length,
      words: [...dict.words, ...advanced],
    });
    for (let run = 0; run < 5; run++) {
      const items = buildTest(extended, seq());
      expect(items).toHaveLength(10 * TEST_WORDS_PER_BAND + TEST_NONWORDS);
      expect(items.filter((i) => i.wordId?.startsWith('adv'))).toHaveLength(0);
      expect(items.filter((i) => i.band === 9)).toHaveLength(
        TEST_WORDS_PER_BAND,
      );
    }
    // A test that says the 10,000 most common words are well known leads on to the advanced ones
    const known = new Set(dict.words.map((w) => w.id));
    const next = nextWords(
      extended,
      { known, saved: new Set(), learned: new Set() },
      Array(10).fill(0.9),
      3,
    );
    expect(next.map((w) => w.id)).toEqual(['adv1', 'adv2', 'adv3']);
  });

  it('checks meanings of words said to be known, with the right meaning among 4', () => {
    const items = buildTest(dict, seq());
    const claimed = new Set(items.filter((i) => i.wordId).map((i) => i.key));
    const checks = buildChecks(dict, items, claimed, seq());
    expect(checks).toHaveLength(10);
    for (const c of checks) {
      expect(c.options).toHaveLength(4);
      expect(c.options[c.answer]).toBe(dict.byId.get(c.wordId)!.s[0].d);
    }
  });

  const answered = (
    knownBands: number,
    nonwordYes: number,
    wrongChecks = 0,
  ) => {
    const items = buildTest(dict, seq());
    const claimed = [
      ...items
        .filter((i) => i.band !== null && i.band < knownBands)
        .map((i) => i.key),
      ...items
        .filter((i) => !i.wordId)
        .slice(0, nonwordYes)
        .map((i) => i.key),
    ];
    const test: StoredTest = {
      items,
      claimed,
      checks: buildChecks(dict, items, new Set(claimed), seq()),
    };
    const answers = Object.fromEntries(
      test.checks!.map((c, i) => [
        c.key,
        i < wrongChecks ? (c.answer + 1) % 4 : c.answer,
      ]),
    );
    return { test, answers };
  };

  it('estimates from the bands known: all of the first 4 bands is about 4,000 words (B2)', () => {
    const { test, answers } = answered(4, 0);
    const result = scoreTest(test, answers);
    expect(result.estimate).toBe(4000);
    expect(result.level).toBe('B2');
    expect(result.bands.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(result.knownIds).toHaveLength(20);
  });

  it('corrects for guessing: yes to made-up words lowers the estimate and marks nothing as known', () => {
    const honest = scoreTest(
      answered(6, 0).test,
      answered(6, 0).answers,
    ).estimate;
    const { test, answers } = answered(6, 5);
    const guessing = scoreTest(test, answers);
    expect(guessing.falseAlarms).toBe(0.5);
    expect(guessing.estimate).toBeLessThan(honest);
    expect(guessing.knownIds).toEqual([]);
  });

  it('wrong meanings count against the estimate', () => {
    const right = scoreTest(answered(5, 0).test, answered(5, 0).answers);
    const { test, answers } = answered(5, 0, 4);
    const wrong = scoreTest(test, answers);
    expect(wrong.checkedRight).toBe(6);
    expect(wrong.estimate).toBeLessThan(right.estimate);
    expect(wrong.knownIds.length).toBe(right.knownIds.length - 4);
  });

  it('maps vocabulary size to a rough level', () => {
    expect(levelForSize(300)).toBe('A1');
    expect(levelForSize(1200)).toBe('A2');
    expect(levelForSize(2500)).toBe('B1');
    expect(levelForSize(4000)).toBe('B2');
    expect(levelForSize(6000)).toBe('C1');
    expect(levelForSize(9000)).toBe('C2');
  });
});

describe('word map', () => {
  it('has 100 cells of 100 words and 10 bands, with known and saved counts', () => {
    const progress = empty();
    progress.known.add('happy');
    progress.saved.add('sad');
    const map = wordMap(dict, progress, null);
    expect(map.cells).toHaveLength(100);
    expect(map.cells[0]).toEqual({ from: 1, to: 100, known: 1, saved: 1 });
    expect(map.bands).toHaveLength(10);
    expect(map.bands[0]).toMatchObject({
      from: 1,
      to: 1000,
      known: 1,
      saved: 1,
      tested: null,
    });
    expect(map.levels.find((l) => l.level === 'A1')!.known).toBe(1);
  });

  it('suggests the most common new words, skipping bands the test says you know', () => {
    const progress = empty();
    progress.known.add('happy');
    expect(nextWords(dict, progress, null, 3).map((w) => w.id)).toEqual([
      'sad',
      'colour',
      'w4',
    ]);
    const testBands = [0.9, 0.9, 0.5, 0, 0, 0, 0, 0, 0, 0];
    expect(nextWords(dict, progress, testBands, 2).map((w) => w.r)).toEqual([
      2001, 2002,
    ]);
  });
});

describe('finding a word as it was heard', () => {
  const small = indexDictionary({
    version: 1,
    count: 4,
    words: [
      {
        id: 'go',
        w: 'go',
        lv: 'A1',
        r: 1,
        pos: ['verb'],
        s: [{ p: 'verb', d: 'to move' }],
        f: {
          third: 'goes',
          past: 'went',
          pastParticiple: 'gone',
          ing: 'going',
        },
      },
      {
        id: 'city',
        w: 'city',
        lv: 'A1',
        r: 2,
        pos: ['noun'],
        s: [{ p: 'noun', d: 'a big town' }],
      },
      {
        id: 'stop',
        w: 'stop',
        lv: 'A1',
        r: 3,
        pos: ['verb'],
        s: [{ p: 'verb', d: 'to end' }],
      },
      {
        id: 'colour',
        w: 'color',
        lv: 'A1',
        r: 4,
        pos: ['noun'],
        s: [{ p: 'noun', d: 'red and so on' }],
        alt: ['colour'],
      },
    ],
    nonwords: [],
    sources: [],
  });

  it('finds the word, another spelling, and listed forms', () => {
    expect(findWord(small, 'Go')?.id).toBe('go');
    expect(findWord(small, 'went')?.id).toBe('go');
    expect(findWord(small, 'colour')?.id).toBe('colour');
  });

  it('strips punctuation and tries regular endings', () => {
    expect(findWord(small, 'cities,')?.id).toBe('city');
    expect(findWord(small, '“stopped”')?.id).toBe('stop');
    expect(findWord(small, 'stopping')?.id).toBe('stop');
    expect(findWord(small, 'city’s')?.id).toBe('city');
  });

  it('returns null for words it does not have, and for junk', () => {
    expect(findWord(small, 'blorf')).toBeNull();
    expect(findWord(small, '')).toBeNull();
    expect(findWord(small, 42)).toBeNull();
  });
});
