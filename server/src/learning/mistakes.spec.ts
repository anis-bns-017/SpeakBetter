import { MISTAKE_PATTERNS, classifyCorrection, editDistance, isPattern, patternFor, stem, words, type MistakePattern } from './mistakes';

describe('words', () => {
  it('lowercases and drops punctuation but keeps apostrophes', () => {
    expect(words("Hello, World! I don't know.")).toEqual(['hello', 'world', 'i', "don't", 'know']);
    expect(words('')).toEqual([]);
  });
});

describe('stem', () => {
  it.each([
    ['walked', 'walk'],
    ['walking', 'walk'],
    ['walks', 'walk'],
    ['stopped', 'stop'],
    ['studies', 'study'],
    ['studied', 'study'],
    ['making', 'mak'],
    ['make', 'mak'],
    ['watches', 'watch'],
    ['books', 'book'],
  ])('%s -> %s', (word, root) => {
    expect(stem(word)).toBe(root);
  });
});

describe('editDistance', () => {
  it('counts single-letter changes', () => {
    expect(editDistance('recieve', 'receive')).toBe(2);
    expect(editDistance('cat', 'cats')).toBe(1);
    expect(editDistance('same', 'same')).toBe(0);
  });
});

describe('classifyCorrection', () => {
  const cases: Array<[string, string, string, MistakePattern]> = [
    // articles
    ['missing article', 'I have car', 'I have a car', 'ARTICLE'],
    ['wrong article', 'She is a engineer', 'She is an engineer', 'ARTICLE'],
    ['extra article', 'I like the music', 'I like music', 'ARTICLE'],
    // prepositions
    ['wrong preposition', 'I am good in English', 'I am good at English', 'PREPOSITION'],
    ['missing preposition', 'I am waiting you', 'I am waiting for you', 'PREPOSITION'],
    ['missing to', 'I want go home', 'I want to go home', 'PREPOSITION'],
    ['wrong day preposition', 'See you in Monday', 'See you on Monday', 'PREPOSITION'],
    // verb tense and form
    ['past tense', 'Yesterday I go to the market', 'Yesterday I went to the market', 'TENSE'],
    ['regular past', 'She walk to school yesterday', 'She walked to school yesterday', 'TENSE'],
    ['-ing form', 'I am go to school', 'I am going to school', 'TENSE'],
    ['extra helper verb', 'I am agree with you', 'I agree with you', 'TENSE'],
    ['missing helper verb', 'She working today', 'She is working today', 'TENSE'],
    ['past participle', 'I have eat lunch', 'I have eaten lunch', 'TENSE'],
    // agreement
    ['he goes', 'He go to work every day', 'He goes to work every day', 'AGREEMENT'],
    ['is/are', 'They is happy', 'They are happy', 'AGREEMENT'],
    ['has/have', 'She have a dog', 'She has a dog', 'AGREEMENT'],
    ['plural noun', 'I have two brother', 'I have two brothers', 'AGREEMENT'],
    ["don't/doesn't", "He don't like tea", "He doesn't like tea", 'AGREEMENT'],
    // spelling, word choice
    ['spelling', 'I will recieve it tomorrow', 'I will receive it tomorrow', 'SPELLING'],
    ['word choice', 'I made homework last night', 'I did homework last night', 'WORD_CHOICE'],
    ['word choice 2', 'He is very strong rain today', 'He is very heavy rain today', 'WORD_CHOICE'],
    // order, missing, extra
    ['word order', 'Where you are going?', 'Where are you going?', 'WORD_ORDER'],
    ['missing word', 'Is cold today', 'It is cold today', 'MISSING_WORD'],
    ['extra word', 'I very like it', 'I like it', 'EXTRA_WORD'],
    // capitalisation only
    ['capitalisation', 'i like tea', 'I like tea.', 'PUNCTUATION'],
  ];

  it.each(cases)('%s', (_name, original, corrected, expected) => {
    expect(classifyCorrection(original, corrected)).toBe(expected);
  });

  it('files a correction that changes several things under the most useful one', () => {
    // tense and article: tense wins
    expect(classifyCorrection('Yesterday I go to market', 'Yesterday I went to the market')).toBe('TENSE');
  });

  it('returns OTHER when nothing changed', () => {
    expect(classifyCorrection('same text', 'same text')).toBe('OTHER');
  });

  it('handles empty input without throwing', () => {
    expect(classifyCorrection('', '')).toBe('OTHER');
    expect(classifyCorrection('', 'I went home')).toBe('MISSING_WORD');
    expect(classifyCorrection('I went home', '')).toBe('EXTRA_WORD');
  });
});

describe('patternFor', () => {
  it('trusts a person\'s pronunciation or spelling label over the words', () => {
    expect(patternFor('I like cat', 'I like cats', 'pronunciation')).toBe('PRONUNCIATION');
    expect(patternFor('I like cat', 'I like cats', 'spelling')).toBe('SPELLING');
  });

  it('otherwise reads the words', () => {
    expect(patternFor('I have car', 'I have a car', 'grammar')).toBe('ARTICLE');
    expect(patternFor('I have car', 'I have a car')).toBe('ARTICLE');
    expect(patternFor('I have car', 'I have a car', null)).toBe('ARTICLE');
  });
});

describe('MISTAKE_PATTERNS', () => {
  it('has a label and a tip for every pattern', () => {
    for (const [id, info] of Object.entries(MISTAKE_PATTERNS)) {
      expect(isPattern(id)).toBe(true);
      expect(info.label.length).toBeGreaterThan(2);
      expect(info.tip.length).toBeGreaterThan(20);
    }
    expect(isPattern('NOPE')).toBe(false);
    expect(isPattern(undefined)).toBe(false);
  });
});
