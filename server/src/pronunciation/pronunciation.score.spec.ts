import { align, paceOf, scoreAttempt, similarity, soundConfusion } from './pronunciation.score';

describe('paceOf', () => {
  it('works out words per minute and says whether it is comfortable', () => {
    expect(paceOf(10, 5000)).toMatchObject({ wordsPerMinute: 120, verdict: 'natural' });
    expect(paceOf(10, 10_000)).toMatchObject({ wordsPerMinute: 60, verdict: 'slow' });
    expect(paceOf(10, 3000)).toMatchObject({ wordsPerMinute: 200, verdict: 'fast' });
  });

  it('says nothing for very short phrases or a missing duration', () => {
    expect(paceOf(3, 2000)).toBeNull();
    expect(paceOf(10, 500)).toBeNull();
    expect(paceOf(10, undefined)).toBeNull();
    expect(paceOf(10, Number.NaN)).toBeNull();
  });
});

describe('similarity', () => {
  it('counts the same word, homophones and digits as the same', () => {
    expect(similarity('think', 'think')).toBe(1);
    expect(similarity('two', 'too')).toBe(1);
    expect(similarity('two', '2')).toBe(1);
    expect(similarity('their', 'there')).toBe(1);
  });

  it('gives part marks for a lost ending or a one-letter slip on a long word', () => {
    expect(similarity('walked', 'walk')).toBe(0.6);
    expect(similarity('village', 'villag')).toBe(0.6);
  });

  it('gives nothing for a different word', () => {
    expect(similarity('think', 'sink')).toBe(0);
    expect(similarity('ship', 'sheep')).toBe(0);
  });
});

describe('align', () => {
  it('keeps the rest in step when a word is missing or extra', () => {
    const missing = align(['i', 'think', 'so'], ['i', 'so']);
    expect(missing.pairs.map((p) => p.heard)).toEqual(['i', null, 'so']);
    const extra = align(['i', 'think', 'so'], ['i', 'um', 'think', 'so']);
    expect(extra.pairs.map((p) => p.heard)).toEqual(['i', 'think', 'so']);
    expect(extra.total).toBe(3);
  });

  it('pairs a wrong word with the target at the same spot', () => {
    const swapped = align(['i', 'think', 'so'], ['i', 'sink', 'so']);
    expect(swapped.pairs.map((p) => p.heard)).toEqual(['i', 'sink', 'so']);
    expect(swapped.pairs[1].sim).toBe(0);
  });
});

describe('soundConfusion', () => {
  it('knows the practice pairs', () => {
    expect(soundConfusion('think', 'sink')).toBe('TH');
    expect(soundConfusion('sheep', 'ship')).toBe('I_EE');
    expect(soundConfusion('very', 'wary')).toBe('V_W');
  });

  it('spots a swapped sound in words outside the pairs', () => {
    expect(soundConfusion('thought', 'taught')).toBe('TH');
    expect(soundConfusion('rock', 'lock')).toBe('R_L');
    expect(soundConfusion('village', 'willage')).toBe('V_W');
    expect(soundConfusion('shop', 'sop')).toBe('S_SH');
  });

  it('says nothing when the words are simply different', () => {
    expect(soundConfusion('table', 'chair')).toBeNull();
  });
});

describe('scoreAttempt', () => {
  it('gives full marks when every word is heard', () => {
    const result = scoreAttempt('I think three of them are thirsty.', ['I think 3 of them are thirsty']);
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('great');
    expect(result.issues).toEqual([]);
    expect(result.words.every((w) => w.status === 'good')).toBe(true);
  });

  it('marks the mixed-up word and explains the sound', () => {
    const result = scoreAttempt('I think so', ['I sink so']);
    expect(result.words.map((w) => w.status)).toEqual(['good', 'missed', 'good']);
    expect(result.words[1]).toMatchObject({ text: 'think', heard: 'sink' });
    expect(result.issues).toEqual([expect.objectContaining({ word: 'think', heard: 'sink', sound: 'TH' })]);
    expect(result.score).toBe(67);
    expect(result.verdict).toBe('try-again');
  });

  it('uses whichever guess of the recogniser fits best', () => {
    const result = scoreAttempt('ship', ['sheep', 'ship']);
    expect(result.score).toBe(100);
    expect(result.heard).toBe('ship');
  });

  it('lowers the score a little when the recogniser was unsure of its first guess', () => {
    expect(scoreAttempt('hello there', ['hello there'], 0.5).score).toBe(93);
    expect(scoreAttempt('hello there', ['hello there'], 1).score).toBe(100);
    // Confidence belongs to the first guess only
    expect(scoreAttempt('ship', ['sheep', 'ship'], 0.2).score).toBe(100);
  });

  it('tells you about words it did not hear at all', () => {
    const result = scoreAttempt('My name is Sam', ['my name Sam']);
    expect(result.words[2]).toMatchObject({ word: 'is', status: 'missed', heard: null });
    expect(result.issues[0].tip).toMatch(/did not hear/);
    expect(result.score).toBe(75);
  });

  it('copes with nothing heard', () => {
    const result = scoreAttempt('hello', []);
    expect(result).toMatchObject({ score: 0, heard: '', verdict: 'try-again' });
    expect(result.words[0].status).toBe('missed');
  });
});
