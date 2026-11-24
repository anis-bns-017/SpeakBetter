import { CheckerBusyError, type LanguageToolClient } from '../writing/language-tool.client';
import type { CheckerMatch } from '../writing/writing.engine';
import { CUE_CARDS, PART1_TOPICS } from './exam.content';
import { MAX_REAL_WPM, buildPaper, buildReport, cefrForBand, isImplausiblePace, roundHalf, scorePart, type PartScore } from './exam.engine';
import { SpeakingExamService, countsAsSlip } from './speaking-exam.service';

const talk = (words: number, vocab = 30) =>
  Array.from({ length: words }, (_, i) => `word${i % vocab}`).join(' ');

describe('exam content', () => {
  it('has enough variety and every part has what it needs', () => {
    expect(PART1_TOPICS.length).toBeGreaterThanOrEqual(12);
    for (const t of PART1_TOPICS) expect(t.questions.length).toBeGreaterThanOrEqual(3);
    expect(CUE_CARDS.length).toBeGreaterThanOrEqual(12);
    for (const c of CUE_CARDS) {
      expect(c.points).toHaveLength(4);
      expect(c.followUps.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('buildPaper', () => {
  it('is the same for the same seed and differs between seeds', () => {
    expect(buildPaper('abc123')).toEqual(buildPaper('abc123'));
    const seeds = Array.from({ length: 12 }, (_, i) => JSON.stringify(buildPaper(`seed${i}`).part2.topic));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('gives three questions in parts 1 and 3 and a prepared cue card', () => {
    const paper = buildPaper('xyz789');
    expect(paper.part1.questions).toHaveLength(3);
    expect(paper.part3.questions).toHaveLength(3);
    expect(paper.part2.prepSeconds).toBe(60);
    expect(paper.part2.points).toHaveLength(4);
  });
});

describe('bands', () => {
  it('rounds to half steps and maps to CEFR', () => {
    expect(roundHalf(6.26)).toBe(6.5);
    expect(roundHalf(6.2)).toBe(6);
    expect(cefrForBand(8)).toBe('C2');
    expect(cefrForBand(7)).toBe('C1');
    expect(cefrForBand(6)).toBe('B2');
    expect(cefrForBand(5)).toBe('B1');
    expect(cefrForBand(4)).toBe('A2');
    expect(cefrForBand(2)).toBe('A1');
  });
});

describe('scorePart', () => {
  it('marks an empty answer low and flags it', () => {
    const s = scorePart({ part: 1, question: 'q', transcript: '', seconds: 0 });
    expect(s.tooShort).toBe(true);
    expect(s.band).toBeLessThanOrEqual(4);
  });

  it('marks a full, varied answer higher than a short one', () => {
    const short = scorePart({ part: 1, question: 'q', transcript: talk(16, 10), seconds: 6 });
    const full = scorePart({ part: 1, question: 'q', transcript: talk(55, 45), seconds: 22 });
    expect(full.band).toBeGreaterThan(short.band);
    expect(full.completeness).toBe(1);
  });

  it('ignores absurd durations', () => {
    const s = scorePart({ part: 1, question: 'q', transcript: talk(30), seconds: 99999 });
    expect(s.seconds).toBeLessThanOrEqual(90);
  });
});

const partScore = (over: Partial<PartScore>): PartScore => ({
  part: 1, question: 'q', words: 50, seconds: 20, wpm: 150, fillersPer100: 1, uniqueWords: 38,
  richWords: ['alternative', 'considerable', 'frequently'], completeness: 1, tooShort: false, band: 6.5, ...over,
});

describe('buildReport', () => {
  const grammarOk = { checked: true, slipsPer100: 1, examples: [] };

  it('combines the criteria into an estimate, never claiming to be real', () => {
    const report = buildReport([partScore({ part: 1 }), partScore({ part: 2, seconds: 100 }), partScore({ part: 3 })], grammarOk);
    expect(report.estimate).toBe(true);
    expect(report.overall).toBeGreaterThanOrEqual(1);
    expect(report.overall).toBeLessThanOrEqual(9);
    expect(report.criteria.grammar).not.toBeNull();
    expect(report.cefr).toMatch(/^(A1|A2|B1|B2|C1|C2)$/);
  });

  it('leaves grammar out (not zero) when the checker was not used', () => {
    const report = buildReport([partScore({}), partScore({ part: 2 }), partScore({ part: 3 })], {
      checked: false, slipsPer100: null, examples: [],
    });
    expect(report.criteria.grammar).toBeNull();
    expect(report.overall).toBeGreaterThan(0);
  });

  it('gives lower grammar bands for more slips', () => {
    const parts = [partScore({}), partScore({ part: 2 }), partScore({ part: 3 })];
    const clean = buildReport(parts, { checked: true, slipsPer100: 0, examples: [] });
    const messy = buildReport(parts, { checked: true, slipsPer100: 9, examples: [] });
    expect(clean.criteria.grammar!).toBeGreaterThan(messy.criteria.grammar!);
  });

  it('suggests fixes for what actually went wrong', () => {
    const report = buildReport(
      [
        partScore({ part: 1, tooShort: true, words: 0, seconds: 0, band: 3 }),
        partScore({ part: 2, seconds: 40, fillersPer100: 12 }),
        partScore({ part: 3 }),
      ],
      { checked: true, slipsPer100: 9, examples: [] },
    );
    const codes = report.tips.map((t) => t.code);
    expect(codes).toContain('answers_missing');
    expect(report.tips.length).toBeLessThanOrEqual(4);
  });

  it('says well done when nothing needs fixing', () => {
    const report = buildReport(
      [partScore({}), partScore({ part: 2, seconds: 110, words: 250, uniqueWords: 120 }), partScore({ part: 3 })],
      grammarOk,
    );
    expect(report.tips.map((t) => t.code)).toEqual(['good_all_round']);
  });
});

describe('countsAsSlip', () => {
  const match = (id: string, category: string, issueType?: string): CheckerMatch => ({
    offset: 0, length: 1, message: 'm', replacements: [], rule: { id, issueType, category: { id: category } },
  });

  it('counts grammar and confused words, not capitals or punctuation', () => {
    expect(countsAsSlip(match('HE_VERB_AGR', 'GRAMMAR'))).toBe(true);
    expect(countsAsSlip(match('YOUR_YOU_RE', 'CONFUSED_WORDS'))).toBe(true);
    expect(countsAsSlip(match('UPPERCASE_SENTENCE_START', 'CASING'))).toBe(false);
    expect(countsAsSlip(match('COMMA_PARENTHESIS_WHITESPACE', 'PUNCTUATION'))).toBe(false);
    expect(countsAsSlip(match('MORFOLOGIK_RULE_EN_GB', 'TYPOS'))).toBe(false);
  });
});

describe('SpeakingExamService', () => {
  const make = (check: jest.Mock) => new SpeakingExamService({ check, usesPublicServer: true } as unknown as LanguageToolClient);
  const answers = [1, 2, 3].map((part) => ({ part, question: 'q', transcript: talk(40, 35), seconds: 25 }));

  it('rejects empty, oversized or malformed submissions', async () => {
    const svc = make(jest.fn());
    await expect(svc.score({})).rejects.toThrow();
    await expect(svc.score({ parts: [] })).rejects.toThrow();
    await expect(svc.score({ parts: Array(12).fill(answers[0]) })).rejects.toThrow();
    await expect(svc.score({ parts: [{ part: 7, transcript: 'x', seconds: 1 }] })).rejects.toThrow();
    await expect(svc.score({ parts: [{ part: 1, transcript: 'x', seconds: -4 }] })).rejects.toThrow();
  });

  it('reports the grammar slips the checker found', async () => {
    const check = jest.fn().mockResolvedValue([
      { offset: 0, length: 5, message: 'Agreement', replacements: [{ value: 'goes' }], rule: { id: 'HE_VERB_AGR', category: { id: 'GRAMMAR' } } },
    ]);
    const report = await make(check).score({ parts: answers });
    expect(report.grammar.checked).toBe(true);
    expect(report.grammar.examples[0].suggestion).toBe('goes');
    expect(report.grammarViaPublicServer).toBe(true);
  });

  it('still scores when the grammar checker is busy', async () => {
    const check = jest.fn().mockRejectedValue(new CheckerBusyError(30));
    const report = await make(check).score({ parts: answers });
    expect(report.grammar.checked).toBe(false);
    expect(report.criteria.grammar).toBeNull();
    expect(report.overall).toBeGreaterThan(0);
  });

  it('does not call the checker for almost nothing said', async () => {
    const check = jest.fn();
    await make(check).score({ parts: [{ part: 1, question: 'q', transcript: 'hello there', seconds: 3 }] });
    expect(check).not.toHaveBeenCalled();
  });

  it('builds a paper, repeating one when given a valid id', () => {
    const svc = make(jest.fn());
    expect(svc.paper('abcdef12').id).toBe('abcdef12');
    expect(svc.paper('abcdef12')).toEqual(svc.paper('abcdef12'));
    expect(svc.paper('not valid!!').id).toMatch(/^[0-9a-f]{10}$/);
  });
});

describe('impossible pace', () => {
  const rich = talk(72, 60);

  it('knows what is too fast to be real', () => {
    expect(isImplausiblePace(MAX_REAL_WPM + 1)).toBe(true);
    expect(isImplausiblePace(150)).toBe(false);
    expect(isImplausiblePace(null)).toBe(false);
  });

  it('does not give a high band for 72 words in 5 seconds', () => {
    const fast = scorePart({ part: 1, question: 'q', transcript: rich, seconds: 5 });
    const normal = scorePart({ part: 1, question: 'q', transcript: rich, seconds: 30 });
    expect(fast.band).toBeLessThanOrEqual(5);
    expect(normal.band).toBeGreaterThanOrEqual(fast.band);
  });

  it('caps every criterion of a whole test spoken at an impossible pace', () => {
    const parts = [1, 2, 3].map((part) =>
      scorePart({ part: part as 1 | 2 | 3, question: 'q', transcript: rich, seconds: 5 }),
    );
    const report = buildReport(parts, { checked: true, slipsPer100: 0, examples: [] });
    expect(report.overall).toBeLessThanOrEqual(5);
    expect(report.criteria.fluency).toBeLessThanOrEqual(5);
    expect(report.criteria.vocabulary).toBeLessThanOrEqual(5);
    expect(report.criteria.grammar!).toBeLessThanOrEqual(5);
    expect(report.tips.map((t) => t.code)).toContain('pace_fast');
  });
});
