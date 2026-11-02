import { baseForms, partOfSpeechHint } from './inflections';

describe('partOfSpeechHint', () => {
  it('guesses the part of speech of an inflected word', () => {
    expect(partOfSpeechHint('went')).toBe('verb');
    expect(partOfSpeechHint('running')).toBe('verb');
    expect(partOfSpeechHint('stories')).toBe('noun');
    expect(partOfSpeechHint('children')).toBe('noun');
    expect(partOfSpeechHint('quickly')).toBe('adverb');
    expect(partOfSpeechHint('better')).toBe('adjective');
    expect(partOfSpeechHint('hello')).toBeUndefined();
  });
});

describe('baseForms', () => {
  it('knows common irregular forms', () => {
    expect(baseForms('went')).toEqual(['go']);
    expect(baseForms('Children')).toEqual(['child']);
    expect(baseForms('better')).toEqual(['good']);
  });

  it('undoes -ing and -ed, including doubled consonants and a dropped e', () => {
    expect(baseForms('running')).toEqual(['runn', 'run', 'runne']);
    expect(baseForms('making')).toEqual(['mak', 'make']);
    expect(baseForms('stopped')).toEqual(['stopp', 'stop', 'stoppe']);
    expect(baseForms('worked')).toContain('work');
  });

  it('undoes plurals and -s endings', () => {
    expect(baseForms('stories')).toEqual(['story']);
    expect(baseForms('studied')).toEqual(['study']);
    expect(baseForms('boxes')).toEqual(['box', 'boxe']);
    expect(baseForms('cats')).toEqual(['cat']);
    expect(baseForms('class')).toEqual([]);
  });

  it('handles -ly, -er and -est', () => {
    expect(baseForms('quickly')).toEqual(['quick']);
    expect(baseForms('faster')).toContain('fast');
    expect(baseForms('biggest')).toContain('big');
  });

  it('gives nothing for short words, non-words and words it cannot reduce', () => {
    expect(baseForms('at')).toEqual([]);
    expect(baseForms("don't")).toEqual([]);
    expect(baseForms('hello')).toEqual([]);
    expect(baseForms('')).toEqual([]);
  });
});
