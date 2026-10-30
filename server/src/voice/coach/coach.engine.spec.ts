import {
  FluencyTracker,
  analyzeUtterance,
  buildAirtime,
  buildForms,
  cleanNote,
  coachTip,
  dueAfter,
  matchesMissionWord,
  missionPoints,
  nextBox,
  normalizeLevel,
  normalizeSavedWord,
  pickMissionWord,
  pickQuietest,
  pickTopicCard,
  tokenize,
} from './coach.engine';
import { MISSION_WORDS, TOPIC_CARDS } from './coach.data';

const word = (w: string) => {
  const entry = MISSION_WORDS.find((m) => m.word === w);
  if (!entry) throw new Error(`no mission word ${w}`);
  return entry;
};

describe('tokenize', () => {
  it('lowercases, drops punctuation and keeps apostrophes', () => {
    expect(tokenize("Hello, World! I don’t know.")).toEqual(['hello', 'world', 'i', "don't", 'know']);
  });
  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(undefined as any)).toEqual([]);
  });
});

describe('analyzeUtterance', () => {
  it('counts sound fillers and phrase fillers', () => {
    const a = analyzeUtterance('Um I went to the, uh, market and you know it was basically closed');
    expect(a.fillers).toEqual({ um: 1, uh: 1, 'you know': 1, basically: 1 });
    expect(a.fillerCount).toBe(4);
  });

  it('only counts "like" when it is a filler', () => {
    expect(analyzeUtterance('I like pizza').fillerCount).toBe(0);
    expect(analyzeUtterance('It looks like rain').fillerCount).toBe(0);
    expect(analyzeUtterance('He runs like a champion').fillerCount).toBe(0);
    expect(analyzeUtterance('It was like really big and like crazy').fillers.like).toBe(2);
    expect(analyzeUtterance('Like I went home').fillers.like).toBe(1);
  });

  it('counts stumbles but not natural repeats', () => {
    expect(analyzeUtterance('I I think the the food is very very good').repeats).toBe(2);
  });

  it('counts every occurrence of a phrase filler, including back to back', () => {
    expect(analyzeUtterance('you know you know it').fillers['you know']).toBe(2);
    expect(analyzeUtterance('you know it was fun and you know we tried').fillers['you know']).toBe(2);
    expect(analyzeUtterance('do you know the way').fillerCount).toBe(0);
    expect(analyzeUtterance('as you know how it works').fillerCount).toBe(0);
    expect(analyzeUtterance('I mean it was fine').fillers['i mean']).toBe(1);
    expect(analyzeUtterance('that is what I mean').fillerCount).toBe(0);
  });
});

describe('FluencyTracker', () => {
  const sentence = 'yesterday I walked along the river with my brother and we talked about everything';

  it('has no scores for very little speech', () => {
    const t = new FluencyTracker();
    t.add('hello there');
    const s = t.snapshot(5);
    expect(s.fluency).toBeNull();
    expect(s.wpm).toBeNull();
    expect(coachTip(s)).toBeNull();
  });

  it('computes pace from speaking time', () => {
    const t = new FluencyTracker();
    for (let i = 0; i < 4; i++) t.add(sentence); // 14 words each = 56 words
    const s = t.snapshot(30); // 112 wpm
    expect(s.words).toBe(56);
    expect(s.wpm).toBe(112);
    expect(s.pace).toBe('steady');
    expect(s.scores.pace).toBe(100);
  });

  it('flags a fast pace and tips the speaker', () => {
    const t = new FluencyTracker();
    for (let i = 0; i < 4; i++) t.add(sentence);
    const s = t.snapshot(15); // 224 wpm
    expect(s.pace).toBe('fast');
    expect(s.scores.pace).toBeLessThan(100);
    expect(coachTip(s)?.kind).toBe('pace-fast');
  });

  it('tips about fillers first when there are many', () => {
    const t = new FluencyTracker();
    for (let i = 0; i < 3; i++) t.add('um so I think um that it was um good and um nice for us all today');
    const s = t.snapshot(60);
    expect(s.topFillers[0]).toEqual({ word: 'um', count: 12 });
    expect(s.fillersPer100).toBeGreaterThan(6);
    const tip = coachTip(s);
    expect(tip?.kind).toBe('filler');
    expect(tip?.text).toContain('"um"');
  });

  it('collects rich words and unique words', () => {
    const t = new FluencyTracker();
    t.add('the environment is important for everybody and the environment matters');
    const s = t.snapshot(0);
    expect(s.richWords).toEqual(expect.arrayContaining(['environment', 'important', 'everybody']));
    expect(s.richWords.filter((w) => w === 'environment')).toHaveLength(1);
    expect(s.uniqueWords).toBe(8);
  });

  it('ignores empty text', () => {
    const t = new FluencyTracker();
    t.add('   ');
    expect(t.snapshot(0).utterances).toBe(0);
  });
});

describe('mission word matching', () => {
  it('matches inflected forms', () => {
    expect(matchesMissionWord(word('decide'), 'I decided to stay home')).toBe(true);
    expect(matchesMissionWord(word('enjoy'), 'She is enjoying the trip')).toBe(true);
    expect(matchesMissionWord(word('improve'), 'It improves every week')).toBe(true);
    expect(matchesMissionWord(word('thrive'), 'plants are thriving here')).toBe(true);
    expect(matchesMissionWord(word('realize'), 'I realised my mistake')).toBe(true);
    expect(matchesMissionWord(word('prefer'), 'we preferred the beach')).toBe(true);
  });

  it('matches phrases only as whole words in order', () => {
    expect(matchesMissionWord(word('in hindsight'), 'In hindsight, I was wrong')).toBe(true);
    expect(matchesMissionWord(word('in hindsight'), 'hindsight is in there')).toBe(false);
    expect(matchesMissionWord(word('cope with'), 'I coped with the stress')).toBe(true);
  });

  it('does not match inside other words', () => {
    expect(matchesMissionWord(word('enjoy'), 'the enjoyment was great')).toBe(false);
    expect(matchesMissionWord(word('exactly'), 'exact')).toBe(false);
  });

  it('is false for empty text', () => {
    expect(matchesMissionWord(word('enjoy'), '')).toBe(false);
  });

  it('builds forms for words ending in e and y', () => {
    expect(buildForms(word('decide'))).toEqual(expect.arrayContaining(['decides', 'decided', 'deciding']));
    expect(buildForms({ word: 'carry', level: 'A2', meaning: '', example: '' })).toEqual(
      expect.arrayContaining(['carries', 'carried', 'carrying']),
    );
  });

  it('every mission word matches its own example sentence', () => {
    for (const m of MISSION_WORDS) {
      // Examples use the word or one of its forms; this keeps the data honest
      expect({ word: m.word, ok: matchesMissionWord(m, m.example) }).toEqual({ word: m.word, ok: true });
    }
  });
});

describe('pickMissionWord', () => {
  it('stays at the level and avoids words already taken', () => {
    const taken = new Set<string>();
    const seen = new Set<string>();
    const pool = MISSION_WORDS.filter((w) => w.level === 'B2').length;
    for (let i = 0; i < pool; i++) {
      const pick = pickMissionWord('B2', taken);
      expect(pick.level).toBe('B2');
      expect(seen.has(pick.word)).toBe(false);
      seen.add(pick.word);
      taken.add(pick.word);
    }
    // pool exhausted → still returns a word instead of throwing
    expect(pickMissionWord('B2', taken).level).toBe('B2');
  });
});

describe('levels and points', () => {
  it('normalises levels', () => {
    expect(normalizeLevel('b2')).toBe('B2');
    expect(normalizeLevel('C2')).toBe('C1');
    expect(normalizeLevel('nonsense')).toBe('B1');
    expect(normalizeLevel(undefined)).toBe('B1');
  });
  it('gives speed bonuses to the first finishers only', () => {
    expect(missionPoints(8, 0, [5, 3, 1])).toBe(13);
    expect(missionPoints(8, 2, [5, 3, 1])).toBe(9);
    expect(missionPoints(8, 3, [5, 3, 1])).toBe(8);
  });
});

describe('airtime', () => {
  const people = [
    { userId: 'a', name: 'Ana' },
    { userId: 'b', name: 'Ben' },
    { userId: 'c', name: 'Caro' },
  ];

  it('has no judgement before enough talk', () => {
    const s = buildAirtime(people, { a: 20, b: 10 });
    expect(s.balance).toBeNull();
    expect(s.quiet).toEqual([]);
  });

  it('is perfectly balanced when everyone speaks equally', () => {
    const s = buildAirtime(people, { a: 60, b: 60, c: 60 });
    expect(s.balance).toBe(100);
    expect(s.quiet).toEqual([]);
  });

  it('flags people who barely spoke and orders by time', () => {
    const s = buildAirtime(people, { a: 200, b: 100, c: 5 });
    expect(s.entries.map((e) => e.userId)).toEqual(['a', 'b', 'c']);
    expect(s.quiet).toEqual(['c']);
    expect(s.balance).toBeLessThan(100);
    expect(s.entries[0].share).toBeCloseTo(200 / 305);
  });

  it('counts people with no speech at all as quiet', () => {
    const s = buildAirtime(people, { a: 120, b: 120 });
    expect(s.quiet).toEqual(['c']);
  });

  it('picks the quietest person', () => {
    const s = buildAirtime(people, { a: 200, b: 100 });
    expect(pickQuietest(s)?.userId).toBe('c');
    expect(pickQuietest({ entries: [], totalSeconds: 0, balance: null, quiet: [] })).toBeNull();
  });
});

describe('topic cards', () => {
  it('picks a card at the requested level', () => {
    const c = pickTopicCard({ level: 'B2' });
    expect(c.level).toBe('B2');
  });

  it('avoids cards that were already used', () => {
    const b2 = TOPIC_CARDS.filter((c) => c.level === 'B2');
    const exclude = new Set(b2.slice(1).map((c) => c.id));
    expect(pickTopicCard({ level: 'B2', exclude }).id).toBe(b2[0].id);
  });

  it('still returns a card when every card was used', () => {
    const exclude = new Set(TOPIC_CARDS.map((c) => c.id));
    expect(pickTopicCard({ level: 'A1', exclude }).level).toBe('A1');
  });

  it('respects the category', () => {
    expect(pickTopicCard({ category: 'role-play' }).category).toBe('role-play');
  });

  it('has unique ids', () => {
    expect(new Set(TOPIC_CARDS.map((c) => c.id)).size).toBe(TOPIC_CARDS.length);
  });
});

describe('saved words', () => {
  it('moves up a box when known and back to the start when forgotten', () => {
    expect(nextBox(0, true)).toBe(1);
    expect(nextBox(3, true)).toBe(4);
    expect(nextBox(5, true)).toBe(5); // top box stays
    expect(nextBox(4, false)).toBe(0);
  });

  it('schedules later reviews for higher boxes', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(dueAfter(0, from).toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(dueAfter(3, from).toISOString()).toBe('2026-01-09T00:00:00.000Z');
    expect(dueAfter(99, from).toISOString()).toBe('2026-02-02T00:00:00.000Z');
  });

  it('cleans tapped words', () => {
    expect(normalizeSavedWord('  Perspective, ')).toBe('perspective');
    expect(normalizeSavedWord('“don’t”')).toBe("don't");
    expect(normalizeSavedWord('well-known.')).toBe('well-known');
    expect(normalizeSavedWord('naïve')).toBe('naïve');
    for (const bad of ['', 'a', '123', 'x'.repeat(41), 'two words', 'he<llo>x', null, undefined]) {
      expect(normalizeSavedWord(bad as any)).toBeNull();
    }
  });

  it('trims and caps notes', () => {
    expect(cleanNote('  a   b \n c ', 50)).toBe('a b c');
    expect(cleanNote('x'.repeat(500), 10)).toHaveLength(10);
    expect(cleanNote('   ', 10)).toBeNull();
  });
});

describe('variety score', () => {
  it('does not punish short talks that use different words', () => {
    const t = new FluencyTracker();
    t.add('yesterday I walked along the river with my brother and we talked about our plans for the summer holiday together');
    t.add('today the weather looks lovely so maybe someone could join us outside after lunch');
    const s = t.snapshot(0);
    expect(s.words).toBeGreaterThanOrEqual(25);
    expect(s.scores.variety).toBeGreaterThanOrEqual(80);
    expect(coachTip(s)?.kind).not.toBe('variety');
  });

  it('scores heavy repetition low and tips about it', () => {
    const t = new FluencyTracker();
    for (let i = 0; i < 3; i++) t.add('the food is good and the place is good and the people are good');
    const s = t.snapshot(0);
    expect(s.scores.variety).toBeLessThan(40);
    expect(coachTip(s)?.kind).toBe('variety');
  });

  it('only looks at the most recent words', () => {
    const t = new FluencyTracker();
    for (let i = 0; i < 6; i++) t.add('good good good good good good good good good good');
    expect(t.snapshot(0).scores.variety).toBeLessThan(20);
    // Fifty fresh words push all of the repetition out of the window
    t.add(Array.from({ length: 50 }, (_, i) => `fresh${i}`).join(' '));
    expect(t.snapshot(0).scores.variety).toBe(100);
  });
});
