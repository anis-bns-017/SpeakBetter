import { LookupQuotaError, parseDictionary, parseMyMemory } from './lookup.provider';

describe('parseMyMemory', () => {
  it('returns the translation', () => {
    expect(parseMyMemory({ responseStatus: 200, responseData: { translatedText: 'বাড়ি' } })).toBe('বাড়ি');
  });

  it('accepts a status sent as text and decodes entities', () => {
    expect(parseMyMemory({ responseStatus: '200', responseData: { translatedText: 'l&#39;eau &amp; le vin' } })).toBe(
      "l'eau & le vin",
    );
  });

  it('for one word, prefers the short answers that are really for that word', () => {
    const json = {
      responseStatus: 200,
      responseData: { translatedText: 'বাংলা চুক্তি ইজারার মেয়াদ' },
      matches: [
        { segment: 'house', translation: 'বাংলা চুক্তি ইজারার মেয়াদ', match: 0.99 },
        { segment: 'House', translation: 'ঘর', match: 0.98 },
        { segment: 'house.', translation: 'বাড়ি।', match: 0.9 },
        { segment: 'house', translation: 'ঘর', match: 0.8 },
        { segment: 'Build a house', translation: 'একটি বাড়ি বানাও', match: 0.7 },
      ],
    };
    expect(parseMyMemory(json, 'house')).toBe('ঘর · বাড়ি');
    // Not told it is one word, the top answer is used as is
    expect(parseMyMemory(json)).toBe('বাংলা চুক্তি ইজারার মেয়াদ');
  });

  it('falls back to the top answer when no match is for that word', () => {
    const json = {
      responseStatus: 200,
      responseData: { translatedText: 'ঘর' },
      matches: [{ segment: 'a house', translation: 'একটি ঘর', match: 1 }],
    };
    expect(parseMyMemory(json, 'house')).toBe('ঘর');
  });

  it('reports the daily allowance being used up, in either of the ways the service does it', () => {
    expect(() => parseMyMemory({ responseStatus: 429, responseData: { translatedText: 'x' } })).toThrow(LookupQuotaError);
    expect(() =>
      parseMyMemory({
        responseStatus: 200,
        responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.' },
      }),
    ).toThrow(LookupQuotaError);
  });

  it('gives null for errors and empty answers', () => {
    expect(parseMyMemory({ responseStatus: 403, responseData: { translatedText: 'INVALID TARGET LANGUAGE' } })).toBeNull();
    expect(parseMyMemory({ responseStatus: 200, responseData: { translatedText: '  ' } })).toBeNull();
    expect(parseMyMemory({ responseStatus: 200, responseData: { translatedText: 'PLEASE SELECT TWO DISTINCT LANGUAGES' } })).toBeNull();
    expect(parseMyMemory(null)).toBeNull();
    expect(parseMyMemory({})).toBeNull();
  });
});

describe('parseDictionary', () => {
  const entry = [
    {
      word: 'run',
      phonetic: '/rʌn/',
      phonetics: [{ text: '/rʌn/', audio: '' }, { audio: 'https://example.com/run.mp3' }],
      meanings: [
        {
          partOfSpeech: 'verb',
          definitions: [
            { definition: 'To move quickly on foot.', example: 'I run every day.', synonyms: ['sprint'] },
            { definition: 'To operate.' },
            { definition: 'A third sense that is not kept.' },
          ],
          synonyms: ['jog'],
          antonyms: ['walk'],
        },
        { partOfSpeech: 'noun', definitions: [{ definition: 'An act of running.' }] },
      ],
    },
  ];

  it('keeps the phonetic, an https audio link, two meanings per part of speech, and the related words', () => {
    expect(parseDictionary(entry)).toEqual({
      phonetic: '/rʌn/',
      audioUrl: 'https://example.com/run.mp3',
      meanings: [
        { partOfSpeech: 'verb', definition: 'To move quickly on foot.', example: 'I run every day.' },
        { partOfSpeech: 'verb', definition: 'To operate.', example: null },
        { partOfSpeech: 'noun', definition: 'An act of running.', example: null },
      ],
      synonyms: ['jog', 'sprint'],
      antonyms: ['walk'],
    });
  });

  it('ignores audio that is not https, limits the meanings and drops odd related words', () => {
    const many = [
      {
        phonetics: [{ audio: 'http://insecure.example/x.mp3' }],
        meanings: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((d, i) => ({
          partOfSpeech: `pos${i}`,
          definitions: [{ definition: d }],
          synonyms: i === 0 ? ['fine word', '<script>', 'x'.repeat(40)] : [],
        })),
      },
    ];
    const parsed = parseDictionary(many);
    expect(parsed?.audioUrl).toBeNull();
    expect(parsed?.meanings).toHaveLength(6);
    expect(parsed?.synonyms).toEqual(['fine word']);
  });

  it('puts the preferred part of speech first and takes related words from it alone', () => {
    const go = [
      {
        meanings: [
          { partOfSpeech: 'noun', definitions: [{ definition: 'The act of going.' }], synonyms: ['attempt', 'try'] },
          { partOfSpeech: 'verb', definitions: [{ definition: 'To move.' }], synonyms: ['travel'], antonyms: ['stay'] },
        ],
      },
    ];
    const parsed = parseDictionary(go, 'verb');
    expect(parsed?.meanings.map((m) => m.partOfSpeech)).toEqual(['verb', 'noun']);
    expect(parsed?.synonyms).toEqual(['travel']);
    expect(parsed?.antonyms).toEqual(['stay']);
    // A hint the entry cannot satisfy changes nothing
    expect(parseDictionary(go, 'adverb')?.meanings.map((m) => m.partOfSpeech)).toEqual(['noun', 'verb']);
    expect(parseDictionary(go, 'adverb')?.synonyms).toEqual(['attempt', 'try', 'travel']);
  });

  it('gives null when the word is unknown', () => {
    expect(parseDictionary({ title: 'No Definitions Found' })).toBeNull();
    expect(parseDictionary([])).toBeNull();
    expect(parseDictionary(null)).toBeNull();
  });
});
