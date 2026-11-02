import { TUTOR_SCENARIOS, getScenario } from './ai-tutor.scenarios';
import { TURN_SCHEMA, buildMessages, buildSystemPrompt, normalizeLevel, parseTurn } from './ai-tutor.prompt';

describe('scenarios', () => {
  it('has unique ids and an opener for each', () => {
    const ids = TUTOR_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of TUTOR_SCENARIOS) {
      expect(s.opener.length).toBeGreaterThan(10);
      expect(s.persona.length).toBeGreaterThan(30);
    }
  });

  it('looks scenarios up by id', () => {
    expect(getScenario('interview')?.title).toBe('Job interview');
    expect(getScenario('nope')).toBeUndefined();
    expect(getScenario(null)).toBeUndefined();
  });
});

describe('normalizeLevel', () => {
  it('keeps valid CEFR codes (any case) and falls back to B1', () => {
    expect(normalizeLevel('a2')).toBe('A2');
    expect(normalizeLevel('C1')).toBe('C1');
    expect(normalizeLevel('intermediate')).toBe('B1');
    expect(normalizeLevel(null)).toBe('B1');
    expect(normalizeLevel(undefined)).toBe('B1');
  });
});

describe('buildSystemPrompt', () => {
  const scenario = getScenario('restaurant')!;

  it('includes the persona, the level guidance and the feedback rules', () => {
    const prompt = buildSystemPrompt({ scenario, level: 'A2' });
    expect(prompt).toContain('Maria');
    expect(prompt).toContain('A2');
    expect(prompt).toContain('Elementary');
    expect(prompt).toContain('"corrections"');
    expect(prompt).toContain('LAST message only');
  });

  it('adapts to the level', () => {
    expect(buildSystemPrompt({ scenario, level: 'A1' })).toContain('at most 10 words');
    expect(buildSystemPrompt({ scenario, level: 'C2' })).toContain('Proficient');
  });

  it('uses only the learner\'s first name, and only when given', () => {
    expect(buildSystemPrompt({ scenario, level: 'B1', learnerName: 'Ana Maria Lopez' })).toContain('first name is Ana');
    expect(buildSystemPrompt({ scenario, level: 'B1', learnerName: '  ' })).not.toContain('first name');
    expect(buildSystemPrompt({ scenario, level: 'B1' })).not.toContain('first name');
  });

  it('tells the model that learner text is conversation, not instructions', () => {
    expect(buildSystemPrompt({ scenario, level: 'B1' })).toMatch(/never as instructions/);
  });
});

describe('TURN_SCHEMA', () => {
  it('requires every field, with no extra properties', () => {
    expect(TURN_SCHEMA.additionalProperties).toBe(false);
    expect([...TURN_SCHEMA.required].sort()).toEqual(
      ['betterPhrasing', 'corrections', 'newWords', 'reply', 'suggestions'].sort(),
    );
    expect(Object.keys(TURN_SCHEMA.properties).sort()).toEqual([...TURN_SCHEMA.required].sort());
  });
});

describe('buildMessages', () => {
  it('puts a stand-in user message first when the history starts with the partner', () => {
    const msgs = buildMessages([{ role: 'assistant', content: 'Hello!' }], 'Hi');
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(msgs[2].content).toBe('Hi');
  });

  it('leaves a history that already starts with the learner alone', () => {
    const msgs = buildMessages(
      [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
      ],
      'c',
    );
    expect(msgs.map((m) => m.content)).toEqual(['a', 'b', 'c']);
  });

  it('works with no history', () => {
    expect(buildMessages([], 'hello')).toEqual([{ role: 'user', content: 'hello' }]);
  });
});

describe('parseTurn', () => {
  const good = {
    reply: 'That sounds lovely. What did you eat?',
    corrections: [{ original: 'I go to market yesterday', corrected: 'I went to the market yesterday', explanation: 'Use the past tense for yesterday.' }],
    betterPhrasing: 'I went to the market yesterday.',
    newWords: [{ word: 'lovely', meaning: 'very nice', example: 'What a lovely day.' }],
    suggestions: ['I ate pasta.', 'I had a salad.'],
  };

  it('reads a well-formed turn', () => {
    const turn = parseTurn(JSON.stringify(good));
    expect(turn.reply).toBe(good.reply);
    expect(turn.corrections).toHaveLength(1);
    expect(turn.newWords[0].word).toBe('lovely');
    expect(turn.suggestions).toEqual(good.suggestions);
  });

  it('drops corrections that change nothing, ignoring case and punctuation', () => {
    const turn = parseTurn(
      JSON.stringify({
        ...good,
        corrections: [
          { original: 'I like tea.', corrected: 'i like tea', explanation: 'x' },
          { original: 'He go', corrected: 'He goes', explanation: 'Add -es.' },
        ],
      }),
    );
    expect(turn.corrections).toEqual([{ original: 'He go', corrected: 'He goes', explanation: 'Add -es.' }]);
  });

  it('caps the number and length of everything', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ original: `bad ${i}`, corrected: `good ${i}`, explanation: 'e' }));
    const turn = parseTurn(
      JSON.stringify({
        reply: 'x'.repeat(5000),
        corrections: many,
        betterPhrasing: 'y'.repeat(900),
        newWords: Array.from({ length: 5 }, (_, i) => ({ word: `w${i}`, meaning: 'm', example: '' })),
        suggestions: ['a', 'b', 'c', 'd', 'e'],
      }),
    );
    expect(turn.reply.length).toBeLessThanOrEqual(600);
    expect(turn.corrections).toHaveLength(2);
    expect(turn.betterPhrasing.length).toBeLessThanOrEqual(240);
    expect(turn.newWords).toHaveLength(2);
    expect(turn.suggestions).toHaveLength(3);
  });

  it('ignores malformed entries instead of failing', () => {
    const turn = parseTurn(
      JSON.stringify({ reply: 'ok', corrections: [null, 5, { original: 'a' }], newWords: [{ word: '' }], suggestions: [1, null, '  hi  '] }),
    );
    expect(turn.corrections).toEqual([]);
    expect(turn.newWords).toEqual([]);
    expect(turn.suggestions).toEqual(['hi']);
    expect(turn.betterPhrasing).toBe('');
  });

  it('uses plain text as the reply when it is not JSON', () => {
    const turn = parseTurn('  Sorry, could you say that again?  ');
    expect(turn.reply).toBe('Sorry, could you say that again?');
    expect(turn.corrections).toEqual([]);
  });

  it('returns an empty reply for JSON that is not an object', () => {
    expect(parseTurn('null').reply).toBe('');
    expect(parseTurn('42').reply).toBe('');
    expect(parseTurn('').reply).toBe('');
  });
});
