import { buildSummary, type StoredTutorMessage } from './ai-tutor.summary';

const user = (content: string, corrections: any[] = []): StoredTutorMessage => ({
  role: 'USER',
  content,
  metadata: { corrections, betterPhrasing: '' },
});
const partner = (content: string, newWords: any[] = []): StoredTutorMessage => ({
  role: 'ASSISTANT',
  content,
  metadata: { suggestions: [], newWords },
});

describe('buildSummary', () => {
  it('counts the learner\'s turns and words, not the partner\'s', () => {
    const s = buildSummary([
      partner('Hello! How are you today my friend?'),
      user('I am fine thank you'),
      partner('Great.'),
      user('I like to play football'),
    ]);
    expect(s.turns).toBe(2);
    expect(s.words).toBe(10);
    expect(s.avgWordsPerTurn).toBe(5);
  });

  it('collects corrections, capped at eight, and counts every mistake', () => {
    const fix = (i: number) => ({ original: `bad ${i}`, corrected: `good ${i}`, explanation: 'e' });
    const messages = Array.from({ length: 10 }, (_, i) => user(`message number ${i}`, [fix(i)]));
    const s = buildSummary(messages);
    expect(s.mistakes).toBe(10);
    expect(s.corrections).toHaveLength(8);
    expect(s.corrections[0].original).toBe('bad 0');
  });

  it('collects each new word once, whatever its case', () => {
    const s = buildSummary([
      user('hello'),
      partner('One.', [{ word: 'Lovely', meaning: 'nice', example: '' }]),
      user('hi'),
      partner('Two.', [
        { word: 'lovely', meaning: 'nice again', example: '' },
        { word: 'cozy', meaning: 'warm and comfortable', example: '' },
      ]),
    ]);
    expect(s.newWords.map((w) => w.word)).toEqual(['Lovely', 'cozy']);
  });

  it('only judges fluency once there is enough speech', () => {
    expect(buildSummary([user('I am fine')]).fluency).toBeNull();
    const long = user(
      'Last summer I travelled to the coast with my family and we stayed in a small hotel near the beach and every morning we walked along the water',
    );
    expect(buildSummary([long]).fluency).not.toBeNull();
  });

  it('counts filler words', () => {
    const s = buildSummary([user('um I think uh we should go basically')]);
    expect(s.fillersPer100).toBeGreaterThan(0);
  });

  it('carries the XP earned and copes with empty or missing metadata', () => {
    expect(buildSummary([], 12)).toMatchObject({ turns: 0, words: 0, xpEarned: 12, corrections: [], newWords: [] });
    const bare: StoredTutorMessage[] = [
      { role: 'USER', content: 'hello there' },
      { role: 'ASSISTANT', content: 'hi', metadata: null },
    ];
    expect(buildSummary(bare).turns).toBe(1);
  });
});
