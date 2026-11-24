import { getDictionary } from '../dictionary/dictionary.data';
import {
  SCRAMBLE_ROUND,
  WORDLE_GUESSES,
  clueFor,
  dayNumber,
  isScrambleRight,
  isValidGuess,
  pickScramble,
  playWordle,
  scoreGuess,
  scrambleLetters,
  wordleAnswerFor,
  wordleAnswers,
  wordleXp,
} from './games.engine';

describe('scoreGuess', () => {
  it('marks right place, wrong place and absent letters', () => {
    expect(scoreGuess('crane', 'crate')).toEqual(['hit', 'hit', 'hit', 'miss', 'hit']);
    expect(scoreGuess('table', 'bleat')).toEqual(['near', 'near', 'near', 'near', 'near']);
  });

  it('does not mark more copies of a letter than the answer has', () => {
    // the answer has one "e" and the last guessed e is a hit, so the earlier ones are misses
    expect(scoreGuess('eerie', 'crane')).toEqual(['miss', 'miss', 'near', 'miss', 'hit']);
    // with no hit, only the first guessed copy is "near"
    expect(scoreGuess('eerie', 'tiled')).toEqual(['near', 'miss', 'miss', 'near', 'miss']);
    // two e's are hits, so the e between them has none left
    expect(scoreGuess('geese', 'siege')).toEqual(['near', 'miss', 'hit', 'near', 'hit']);
    expect(scoreGuess('speed', 'abide')).toEqual(['miss', 'miss', 'near', 'miss', 'near']);
  });

  it('marks every letter right for the answer itself', () => {
    expect(scoreGuess('apple', 'apple').every((m) => m === 'hit')).toBe(true);
  });
});

describe('dayNumber', () => {
  it('counts calendar days and ignores bad text', () => {
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2026-11-22') - dayNumber('2026-11-21')).toBe(1);
    expect(dayNumber('nonsense')).toBe(0);
  });
});

describe('Word Guess with the real dictionary', () => {
  const dict = getDictionary();

  it('has a big enough pool of everyday five-letter answers', () => {
    expect(wordleAnswers(dict).length).toBeGreaterThan(600);
  });

  it('gives everyone the same word on a day, and a different one the next day', () => {
    const a = wordleAnswerFor(dict, '2026-11-22');
    expect(wordleAnswerFor(dict, '2026-11-22').w).toBe(a.w);
    expect(wordleAnswerFor(dict, '2026-11-23').w).not.toBe(a.w);
  });

  it('does not repeat an answer inside two weeks', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 14; d++) seen.add(wordleAnswerFor(dict, `2026-12-${String(d).padStart(2, '0')}`).w);
    expect(seen.size).toBe(14);
  });

  it('accepts real five-letter words and rejects junk', () => {
    expect(isValidGuess(dict, 'house')).toBe(true);
    expect(isValidGuess(dict, 'HOUSE')).toBe(true);
    expect(isValidGuess(dict, 'xxxxx')).toBe(false);
    expect(isValidGuess(dict, 'cat')).toBe(false);
    expect(isValidGuess(dict, 'ab1de')).toBe(false);
  });

  it('replays guesses: solved on the right word, over at six', () => {
    const answer = 'house';
    const solved = playWordle(dict, answer, ['night', 'house']);
    expect('error' in solved).toBe(false);
    if (!('error' in solved)) expect(solved).toMatchObject({ solved: true, over: true });

    const lost = playWordle(dict, answer, Array(WORDLE_GUESSES).fill('night'));
    if (!('error' in lost)) expect(lost).toMatchObject({ solved: false, over: true });

    const open = playWordle(dict, answer, ['night']);
    if (!('error' in open)) expect(open).toMatchObject({ solved: false, over: false });
  });

  it('refuses unknown words and guesses after the win', () => {
    expect(playWordle(dict, 'house', ['qqqqq'])).toHaveProperty('error');
    expect(playWordle(dict, 'house', ['house', 'night'])).toHaveProperty('error');
  });

  it('pays more for solving in fewer guesses', () => {
    expect(wordleXp(1)).toBeGreaterThan(wordleXp(6));
    expect(wordleXp(6)).toBeGreaterThan(0);
  });
});

describe('Unscramble', () => {
  const dict = getDictionary();

  it('never returns the word itself as the scramble', () => {
    for (const word of ['table', 'water', 'happy', 'school', 'aaaab']) {
      for (let i = 0; i < 20; i++) expect(scrambleLetters(word, `s${i}`)).not.toBe(word);
      expect(scrambleLetters(word, 'x').split('').sort().join('')).toBe(word.split('').sort().join(''));
    }
  });

  it('is stable for one seed and builds a full round for every level', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) {
      const round = pickScramble(dict, level, 'user:2026-11-22:0');
      expect(round).toHaveLength(SCRAMBLE_ROUND);
      expect(new Set(round.map((r) => r.id)).size).toBe(SCRAMBLE_ROUND);
      expect(pickScramble(dict, level, 'user:2026-11-22:0')).toEqual(round);
      for (const r of round) {
        expect(r.letters).not.toBe(r.word);
        expect(r.hint.length).toBeGreaterThanOrEqual(12);
        // the clue must not give the word away
        expect(r.hint.toLowerCase()).not.toContain(r.word);
      }
    }
  });

  it('gives another set for another round', () => {
    const a = pickScramble(dict, 'B1', 'u:d:0').map((r) => r.id);
    const b = pickScramble(dict, 'B1', 'u:d:1').map((r) => r.id);
    expect(a).not.toEqual(b);
  });

  it('accepts the word, and another real word from the same letters, but not junk', () => {
    expect(isScrambleRight(dict, 'listen', 'listen')).toBe(true);
    expect(isScrambleRight(dict, 'listen', 'silent')).toBe(true);
    expect(isScrambleRight(dict, 'listen', 'lsnite')).toBe(false);
    expect(isScrambleRight(dict, 'listen', 'liste')).toBe(false);
    expect(isScrambleRight(dict, 'listen', '')).toBe(false);
  });

  it('hides the word inside its clue', () => {
    const w = dict.words.find((x) => x.w === 'garden');
    if (w) expect(clueFor(w).toLowerCase()).not.toContain('garden');
  });
});
