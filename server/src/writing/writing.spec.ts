import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { CheckerBusyError, CheckerUnavailableError, LanguageToolClient } from './language-tool.client';
import { countWords, fixInSentence, kindOf, reviewCandidates, scoreWriting, sentenceBounds, toIssues, type CheckerMatch } from './writing.engine';
import { FREE_PROMPT_ID, todaysPrompt, WRITING_LEVELS, WRITING_PROMPTS } from './writing.prompts';
import { WRITING_XP, WritingService, XP_PIECES_PER_DAY } from './writing.service';

// What LanguageTool really returned for this text (trimmed to the fields the app reads)
const SAMPLE = 'She go to school yesterday and buyed a apple. i like it alot';
const rule = (id: string, issueType: string, category: string) => ({ id, issueType, category: { id: category } });
const MATCHES: CheckerMatch[] = [
  { offset: 4, length: 2, message: "The pronoun 'She' is usually used with a third-person or a past tense verb.", replacements: [{ value: 'goes' }, { value: 'went' }], rule: rule('HE_VERB_AGR', 'grammar', 'GRAMMAR') },
  { offset: 31, length: 5, message: 'Possible spelling mistake. Did you mean "bought"?', replacements: [{ value: 'bought' }, { value: 'buyer' }], rule: rule('MORFOLOGIK_RULE_EN_US', 'misspelling', 'TYPOS') },
  { offset: 37, length: 1, message: 'Use "an" instead of "a" if the following word starts with a vowel sound.', replacements: [{ value: 'an' }], rule: rule('EN_A_VS_AN', 'misspelling', 'MISC') },
  { offset: 46, length: 1, message: 'The personal pronoun "I" should be uppercase.', replacements: [{ value: 'I' }], rule: rule('I_LOWERCASE', 'misspelling', 'TYPOS') },
  { offset: 56, length: 4, message: 'Possible spelling mistake found.', replacements: [{ value: 'a lot' }, { value: 'lot' }], rule: rule('MORFOLOGIK_RULE_EN_US', 'misspelling', 'TYPOS') },
];

describe('writing tasks', () => {
  it('has unique ids, sensible lengths and tasks at every level', () => {
    const ids = WRITING_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(FREE_PROMPT_ID);
    for (const level of WRITING_LEVELS) expect(WRITING_PROMPTS.filter((p) => p.level === level).length).toBeGreaterThanOrEqual(5);
    for (const p of WRITING_PROMPTS) {
      expect(p.id.startsWith(p.level.toLowerCase())).toBe(true);
      expect(p.minWords).toBeLessThan(p.maxWords);
      expect(p.phrases.length).toBeGreaterThan(0);
    }
  });

  it("gives everyone at a level the same task today, and a different one tomorrow", () => {
    const day = new Date(2026, 10, 6, 9);
    const next = new Date(2026, 10, 7, 9);
    expect(todaysPrompt('B1', day).level).toBe('B1');
    expect(todaysPrompt('B1', day).id).toBe(todaysPrompt('B1', new Date(2026, 10, 6, 22)).id);
    expect(todaysPrompt('B1', day).id).not.toBe(todaysPrompt('B1', next).id);
  });
});

describe('writing engine', () => {
  it('sorts findings into grammar, spelling and punctuation', () => {
    expect(MATCHES.map(kindOf)).toEqual(['grammar', 'spelling', 'grammar', 'punctuation', 'spelling']);
  });

  it('files each mistake under the right "mistakes you repeat" group', () => {
    const issues = toIssues(SAMPLE, MATCHES);
    expect(issues.map((i) => i.pattern)).toEqual(['AGREEMENT', 'TENSE', 'ARTICLE', 'PUNCTUATION', 'SPELLING']);
    expect(issues[0]).toMatchObject({ text: 'go', replacements: ['goes', 'went'], kind: 'grammar' });
  });

  it('puts the right past form first when a learner makes an irregular verb regular', () => {
    const text = 'I forgetted my keys.';
    const [issue] = toIssues(text, [
      { offset: 2, length: 9, message: 'Possible spelling mistake found.', replacements: [{ value: 'forested' }, { value: 'forgot' }], rule: rule('MORFOLOGIK_RULE_EN_GB', 'misspelling', 'TYPOS') },
    ]);
    expect(issue).toMatchObject({ replacements: ['forgot', 'forested'], kind: 'grammar', pattern: 'TENSE' });
    expect(issue.message).toMatch(/past form is “forgot”/);
    expect(toIssues('Goed home.', [{ offset: 0, length: 4, message: 'x', replacements: [], rule: rule('MORFOLOGIK_RULE_EN_GB', 'misspelling', 'TYPOS') }])[0].replacements[0]).toBe('Went');
  });

  it('never files a grammar finding as spelling', () => {
    const text = "My alarm didn't rang.";
    const [issue] = toIssues(text, [
      { offset: 15, length: 4, message: "The auxiliary verb 'do' requires the base form of the verb.", replacements: [{ value: 'ring' }], rule: rule('DID_BASEFORM', 'grammar', 'GRAMMAR') },
    ]);
    expect(issue).toMatchObject({ kind: 'grammar', pattern: 'TENSE' });
  });

  it('drops typographic niggles and matches that do not fit the text', () => {
    const extra: CheckerMatch[] = [
      { offset: 0, length: 3, message: 'Use curly quotes', replacements: [], rule: rule('EN_QUOTES', 'typographical', 'TYPOGRAPHY') },
      { offset: 999, length: 2, message: 'Out of range', replacements: [], rule: rule('X', 'grammar', 'GRAMMAR') },
    ];
    expect(toIssues(SAMPLE, [...MATCHES, ...extra])).toHaveLength(5);
  });

  it('counts words, including contractions and hyphenated words', () => {
    expect(countWords("I don't like well-known places.")).toBe(5);
    expect(countWords('   ')).toBe(0);
  });

  it('finds the sentence around a mistake and applies the fix inside it', () => {
    const [start, end] = sentenceBounds(SAMPLE, 46, 1);
    expect(SAMPLE.slice(start, end)).toBe('i like it alot');
    expect(fixInSentence(SAMPLE, { offset: 37, length: 1, replacements: ['an'] })).toEqual({
      original: 'She go to school yesterday and buyed a apple.',
      corrected: 'She go to school yesterday and buyed an apple.',
    });
  });

  it('scores cleaner writing higher, and does not score a few words', () => {
    expect(scoreWriting([], 120)).toBe(100);
    expect(scoreWriting([{ kind: 'grammar' }, { kind: 'grammar' }], 100)).toBe(86);
    expect(scoreWriting([{ kind: 'style' }, { kind: 'style' }], 100)).toBeGreaterThan(scoreWriting([{ kind: 'grammar' }, { kind: 'grammar' }], 100)!);
    expect(scoreWriting([{ kind: 'grammar' }], 8)).toBeNull();
    expect(scoreWriting(Array.from({ length: 40 }, () => ({ kind: 'grammar' as const })), 50)).toBe(0);
  });

  it('turns mistakes into review cards: grammar first, one per sentence, never style hints', () => {
    const issues = toIssues(SAMPLE, MATCHES);
    const cards = reviewCandidates(SAMPLE, issues, 5);
    expect(cards.map((c) => c.original)).toEqual(['She go to school yesterday and buyed a apple.', 'i like it alot']);
    expect(cards[0].corrected).toBe('She goes to school yesterday and buyed a apple.');
    const style = toIssues('This is very very good.', [
      { offset: 8, length: 9, message: 'Repeated word', replacements: [{ value: 'very' }], rule: rule('ENGLISH_WORD_REPEAT_RULE', 'style', 'STYLE') },
    ]);
    expect(reviewCandidates('This is very very good.', style)).toEqual([]);
  });
});

describe('LanguageToolClient', () => {
  const config = (values: Record<string, string> = {}) => ({ get: (k: string) => values[k] }) as any;
  const reply = (status: number, body: unknown = { matches: MATCHES }) =>
    Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as Response);
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(() => reply(200));
  });
  afterEach(() => fetchMock.mockRestore());

  it('uses the public server by default, and asks once for the same text', async () => {
    const client = new LanguageToolClient(config());
    expect(client.usesPublicServer).toBe(true);
    await client.check(SAMPLE, 'en-GB');
    await client.check(SAMPLE, 'en-GB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.languagetool.org/v2/check');
    await client.check(SAMPLE, 'en-US');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('can point at a self-hosted server', async () => {
    const client = new LanguageToolClient(config({ LANGUAGETOOL_URL: 'http://localhost:8010/' }));
    expect(client.usesPublicServer).toBe(false);
    await client.check('Hello', 'en-GB');
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://localhost:8010/v2/check');
  });

  it('keeps the whole app under the free per-minute limit', async () => {
    const client = new LanguageToolClient(config({ LANGUAGETOOL_PER_MINUTE: '2' }));
    await client.check('one', 'en-GB');
    await client.check('two', 'en-GB');
    await expect(client.check('three', 'en-GB')).rejects.toBeInstanceOf(CheckerBusyError);
  });

  it('reports a busy or broken checker clearly', async () => {
    const client = new LanguageToolClient(config());
    fetchMock.mockImplementationOnce(() => reply(429));
    await expect(client.check('a', 'en-GB')).rejects.toBeInstanceOf(CheckerBusyError);
    fetchMock.mockImplementationOnce(() => reply(500));
    await expect(client.check('b', 'en-GB')).rejects.toBeInstanceOf(CheckerUnavailableError);
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await expect(client.check('c', 'en-GB')).rejects.toBeInstanceOf(CheckerUnavailableError);
  });
});

describe('WritingService', () => {
  function setup(opts: { checker?: () => Promise<CheckerMatch[]>; finishedToday?: number } = {}) {
    const rows = new Map<string, any>();
    let n = 0;
    const prisma: any = {
      profile: { findUnique: jest.fn(async () => ({ level: 'B1' })) },
      writingPiece: {
        findFirst: jest.fn(async ({ where }) => {
          const all = [...rows.values()].filter((r) => r.userId === where.userId);
          if (where.id) return all.find((r) => r.id === where.id) ?? null;
          return all.find((r) => r.promptId === where.promptId && !r.submittedAt) ?? null;
        }),
        create: jest.fn(async ({ data }) => {
          const row = { id: `p${++n}`, wordCount: 0, variant: 'en-GB', issues: null, firstIssues: null, firstText: null, checks: 0, score: null, submittedAt: null, updatedAt: new Date(), ...data };
          rows.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }) => {
          const row = rows.get(where.id);
          const { checks, ...rest } = data;
          Object.assign(row, rest, checks ? { checks: row.checks + 1 } : {});
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          const row = rows.get(where.id);
          if (!row || row.submittedAt) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }),
        count: jest.fn(async () => opts.finishedToday ?? 0),
        delete: jest.fn(async ({ where }) => rows.delete(where.id)),
      },
    };
    const checker: any = { check: jest.fn(opts.checker ?? (async () => MATCHES)), usesPublicServer: true };
    const activity: any = { recordActivity: jest.fn(async () => undefined) };
    const review: any = { addCorrectionCard: jest.fn(async () => ({ created: true })) };
    const badges: any = { evaluate: jest.fn(async () => []) };
    return { service: new WritingService(prisma, checker, activity, review, badges), rows, checker, activity, review };
  }

  it('starts a task once and carries on with the same draft', async () => {
    const { service } = setup();
    const first = await service.start('u1', 'b1-1');
    expect(first).toMatchObject({ title: 'A problem with an order', level: 'B1', finished: false });
    expect(first.prompt?.phrases.length).toBeGreaterThan(0);
    expect((await service.start('u1', 'b1-1')).id).toBe(first.id);
    expect((await service.start('u1', FREE_PROMPT_ID)).title).toBe('Free writing');
    await expect(service.start('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checks the text and keeps the first check for review cards', async () => {
    const { service, rows } = setup();
    const piece = await service.start('u1', 'a2-1');
    const result = await service.check('u1', piece.id, { text: SAMPLE });
    expect(result.issues).toHaveLength(5);
    // "buyed" is a verb-form mistake, so it counts as grammar
    expect(result.counts).toEqual({ grammar: 3, spelling: 1, punctuation: 1, style: 0 });
    await service.check('u1', piece.id, { text: 'She goes to school.' });
    expect(rows.get(piece.id).firstText).toBe(SAMPLE);
    expect(rows.get(piece.id).checks).toBe(2);
  });

  it('finishes with a score, XP and review cards from the first mistakes', async () => {
    const { service, activity, review } = setup({ checker: async () => [] });
    const piece = await service.start('u1', 'a2-1');
    // The first check found mistakes; the learner fixed them before finishing
    (service as any).checker.check = jest.fn(async () => MATCHES);
    await service.check('u1', piece.id, { text: SAMPLE });
    (service as any).checker.check = jest.fn(async () => []);
    const done = await service.finish('u1', piece.id, { text: 'She went to school yesterday and bought an apple. I like it a lot.' });
    expect(done).toMatchObject({ finished: true, score: 100, xp: WRITING_XP, cardsAdded: 2, checked: true });
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', WRITING_XP, 'WRITING_PRACTICE');
    expect(review.addCorrectionCard.mock.calls[0][1]).toMatchObject({ source: 'writing', original: 'She go to school yesterday and buyed a apple.' });
    await expect(service.save('u1', piece.id, { text: 'more' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.finish('u1', piece.id, { text: 'She went to school yesterday and bought an apple today.' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('gives XP only for the first pieces of the day, and needs enough words', async () => {
    const { service } = setup({ finishedToday: XP_PIECES_PER_DAY });
    const piece = await service.start('u1', 'a1-1');
    await expect(service.finish('u1', piece.id, { text: 'Too short.' })).rejects.toBeInstanceOf(BadRequestException);
    const done = await service.finish('u1', piece.id, { text: 'My name is Sam and I live in a small town near the sea with my family.' });
    expect(done.xp).toBe(0);
  });

  it('still lets you finish when the checker is down, without a score', async () => {
    const { service } = setup({ checker: async () => { throw new CheckerUnavailableError('down'); } });
    const piece = await service.start('u1', 'a1-2');
    await expect(service.check('u1', piece.id, { text: 'Hello there friend' })).rejects.toBeInstanceOf(HttpException);
    const done = await service.finish('u1', piece.id, { text: 'Hi Tom! Do you want to come to my house on Saturday at five?' });
    expect(done).toMatchObject({ finished: true, score: null, checked: false });
  });

  it('refuses text that is too long, and pieces that are not yours', async () => {
    const { service } = setup();
    const piece = await service.start('u1', 'a1-1');
    await expect(service.check('u1', piece.id, { text: 'x '.repeat(3000) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.get('u2', piece.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
