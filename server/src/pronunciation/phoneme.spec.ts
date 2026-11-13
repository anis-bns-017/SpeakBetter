import { indexDictionary, type DictionaryData } from '../dictionary/dictionary.data';
import { checkSounds, readFrames, type ExpectedWord, type Frame } from './phoneme.align';
import { addEd, addIng, addS, pronunciationsOf } from './phoneme.lexicon';
import { comparePhones, modelPhoneClasses, parseIpa } from './phonemes';

const sounds = (ipa: string) => parseIpa(ipa).map((p) => `${p.optional ? '?' : ''}${p.p}`);

describe('parseIpa', () => {
  it('reads consonants, vowels, diphthongs and affricates', () => {
    expect(sounds('/ˈθɪŋk/')).toEqual(['θ', 'ɪ', 'ŋ', 'k']);
    expect(sounds('/kwˈɛstʃən/')).toEqual(['k', 'w', 'e', 's', 'tʃ', 'ə', 'n']);
    expect(sounds('/ɡəʊ/')).toEqual(['g', 'oʊ']);
    expect(sounds('/ˈvɪɫədʒ/')).toEqual(['v', 'ɪ', 'l', 'ə', 'dʒ']);
  });

  it('makes an r optional unless a vowel follows', () => {
    expect(sounds('/ˈkɑɹ/')).toEqual(['k', 'ɑ', '?r']);
    expect(sounds('/ˈbɝd/')).toEqual(['b', 'ɜ', '?r', 'd']);
    expect(sounds('/ˈvɛɹi/')).toEqual(['v', 'e', 'r', 'i']);
    expect(sounds('/ˈɹɛd/')).toEqual(['r', 'e', 'd']);
  });

  it('treats bracketed sounds and syllabic consonants as optional parts', () => {
    expect(sounds('/ˈɔf(t)ən/')).toEqual(['ɔ', 'f', '?t', 'ə', 'n']);
    expect(sounds('/ˈlɪtl̩/')).toEqual(['l', 'ɪ', 't', '?ə', 'l']);
    expect(sounds('/hɪə(ɹ)/')).toEqual(['h', 'ɪ', '?ə', '?r']);
  });

  it('lets the last vowel of "happy" be short', () => {
    expect(parseIpa('/ˈhæpi/').at(-1)).toEqual({ p: 'i', accept: ['ɪ'] });
    expect(parseIpa('/ʃi/').at(-1)).toEqual({ p: 'i' });
  });
});

describe('modelPhoneClasses', () => {
  it('reads English and foreign labels as English sounds', () => {
    expect(modelPhoneClasses('ɹ')).toEqual(['r']);
    expect(modelPhoneClasses('ɑːɹ')).toEqual(['ɑ', 'r']);
    expect(modelPhoneClasses('t̪')).toEqual(['t']);
    expect(modelPhoneClasses('ʋ')).toEqual(['w']);
    expect(modelPhoneClasses('sʲ')).toEqual(['s']);
    expect(modelPhoneClasses('onɡ5')).toEqual([]);
  });
});

describe('comparePhones', () => {
  it('knows accent differences, taught mix-ups and near misses', () => {
    expect(comparePhones('ʌ', 'ə').judgement).toBe('same');
    expect(comparePhones('ɒ', 'ɑ').judgement).toBe('same');
    expect(comparePhones('θ', 's')).toEqual({ judgement: 'wrong', sound: 'TH' });
    expect(comparePhones('v', 'w')).toEqual({ judgement: 'wrong', sound: 'V_W' });
    expect(comparePhones('ɪ', 'i')).toEqual({ judgement: 'wrong', sound: 'I_EE' });
    expect(comparePhones('z', 's')).toEqual({ judgement: 'close', sound: 'Z_S' });
    expect(comparePhones('eɪ', 'e').judgement).toBe('close');
    expect(comparePhones('p', 'b').judgement).toBe('close');
    expect(comparePhones('m', 'k').judgement).toBe('wrong');
  });
});

describe('word endings', () => {
  const plain = (phones: ReturnType<typeof parseIpa>) => phones.map((p) => p.p).join(' ');
  it('adds -s, -ed and -ing the way they are said', () => {
    expect(plain(addS(parseIpa('kæt')))).toBe('k æ t s');
    expect(plain(addS(parseIpa('dɒɡ')))).toBe('d ɒ g z');
    expect(plain(addS(parseIpa('bʌs')))).toBe('b ʌ s ɪ z');
    expect(plain(addEd(parseIpa('wɔk')))).toBe('w ɔ k t');
    expect(plain(addEd(parseIpa('pleɪ')))).toBe('p l eɪ d');
    expect(plain(addEd(parseIpa('wɒnt')))).toBe('w ɒ n t ɪ d');
    expect(plain(addIng(parseIpa('wɔk')))).toBe('w ɔ k ɪ ŋ');
  });
});

const dict = indexDictionary({
  version: 1,
  count: 3,
  nonwords: [],
  sources: [],
  words: [
    { id: 'think', w: 'think', lv: 'A1', r: 1, pos: ['verb'], s: [], ipa: { us: '/ˈθɪŋk/', uk: '/θˈɪŋk/' } },
    { id: 'car', w: 'car', lv: 'A1', r: 2, pos: ['noun'], s: [], ipa: { us: '/ˈkɑɹ/', uk: '/kˈɑː/' } },
    { id: 'walk', w: 'walk', lv: 'A1', r: 3, pos: ['verb'], s: [], ipa: { us: '/ˈwɑk/', uk: '/wˈɔːk/' } },
  ],
} as DictionaryData);

describe('pronunciationsOf', () => {
  it('finds dictionary words, small words and regular forms', () => {
    expect(pronunciationsOf(dict, 'think')).toHaveLength(1);
    expect(pronunciationsOf(dict, 'car')).toHaveLength(2);
    expect(pronunciationsOf(dict, 'the').map((v) => v.map((p) => p.p).join(''))).toEqual(['ðə', 'ði']);
    expect(pronunciationsOf(dict, 'walked')[0].map((p) => p.p).join(' ')).toBe('w ɑ k t');
    expect(pronunciationsOf(dict, 'thinking')[0].map((p) => p.p).join(' ')).toBe('θ ɪ ŋ k ɪ ŋ');
    expect(pronunciationsOf(dict, 'cars')[0].map((p) => p.p)).toEqual(['k', 'ɑ', 'r', 'z']);
    expect(pronunciationsOf(dict, 'zzyzx')).toEqual([]);
  });
});

// ---------- alignment ----------

/** A recording as the device would report it: each label is one clear frame, with silence around it */
const say = (...labels: Array<string | [string, number, string?, number?]>) => {
  const raw: unknown[] = [3];
  for (const label of labels) {
    if (typeof label === 'string') raw.push([0.05, label, 0.93]);
    else raw.push([0.05, label[0], label[1], ...(label[2] ? [label[2], label[3] ?? 0.05] : [])]);
    raw.push(2);
  }
  return readFrames(raw) as Frame[];
};

const expect1 = (word: string, ...ipa: string[]): ExpectedWord => ({ word, variants: ipa.map(parseIpa) });

describe('readFrames', () => {
  it('expands silent runs and drops what it cannot read', () => {
    const frames = readFrames([2, [0.1, 'θ', 0.8, 'onɡ5', 0.1], 'junk', [0.4, 'ɪ', 'x']]) as Frame[];
    expect(frames).toHaveLength(4);
    expect(frames[2]).toEqual({ blank: 0.1, phones: [{ classes: ['θ'], p: 0.8 }] });
    expect(frames[3].phones).toEqual([]);
  });

  it('gives null without any speech', () => {
    expect(readFrames([5, 3])).toBeNull();
    expect(readFrames('nope')).toBeNull();
  });
});

describe('checkSounds', () => {
  it('passes a word said right', () => {
    const result = checkSounds([expect1('think', '/θɪŋk/')], say('θ', 'ɪ', 'ŋ', 'k'));
    expect(result?.score).toBe(100);
    expect(result?.words[0].phones?.map((p) => p.status)).toEqual(['good', 'good', 'good', 'good']);
    expect(result?.tips).toEqual([]);
  });

  it('names the sound said instead, with the tip for that mix-up', () => {
    const result = checkSounds([expect1('think', '/θɪŋk/')], say('s', 'ɪ', 'ŋ', 'k'));
    const first = result?.words[0].phones?.[0];
    expect(first).toMatchObject({ p: 'θ', status: 'wrong', heard: 's' });
    expect(result?.score).toBe(75);
    expect(result?.tips[0]).toMatchObject({ sound: 'TH', expected: 'θ', heard: 's', words: ['think'] });
  });

  it('hears a dental t for th as a t', () => {
    const result = checkSounds([expect1('three', '/θɹiː/')], say('t̪', 'ɹ', 'iː'));
    expect(result?.words[0].phones?.[0]).toMatchObject({ status: 'wrong', heard: 't' });
  });

  it('flags a sound that is not there', () => {
    const result = checkSounds([expect1('street', '/stɹiːt/')], say('s', 't', 'iː', 't'));
    expect(result?.words[0].phones?.map((p) => p.status)).toEqual(['good', 'good', 'missing', 'good', 'good']);
  });

  it('accepts either accent and a silent r', () => {
    const car = expect1('car', '/ˈkɑɹ/', '/kˈɑː/');
    expect(checkSounds([car], say('k', 'ɑː'))?.score).toBe(100);
    expect(checkSounds([car], say('k', 'ɑːɹ'))?.score).toBe(100);
    expect(checkSounds([car], say('k', 'ɑː', 'ɹ'))?.score).toBe(100);
    // American "hot" has the vowel of "father"
    expect(checkSounds([expect1('hot', '/hɒt/')], say('h', 'ɑː', 't'))?.score).toBe(100);
  });

  it('picks the weak or strong form that was said', () => {
    const the = expect1('the', 'ðə', 'ði');
    expect(checkSounds([the, expect1('car', '/kɑː/')], say('ð', 'ə', 'k', 'ɑː'))?.score).toBe(100);
    expect(checkSounds([the, expect1('car', '/kɑː/')], say('ð', 'iː', 'k', 'ɑː'))?.score).toBe(100);
  });

  it('treats vowel drift as close and a swallowed final t as close', () => {
    const result = checkSounds([expect1('late', '/leɪt/')], say('l', 'ɛ'));
    expect(result?.words[0].phones?.map((p) => p.status)).toEqual(['good', 'close', 'close']);
    expect(result?.tips).toEqual([]);
  });

  it('keeps going past a word it does not know', () => {
    const result = checkSounds(
      [expect1('think', '/θɪŋk/'), { word: 'zzyzx', variants: [] }, expect1('car', '/kɑː/')],
      say('θ', 'ɪ', 'ŋ', 'k', 'z', 'ɪ', 'z', 'ɪ', 'k', 's', 'k', 'ɑː'),
    );
    expect(result?.words.map((w) => w.score)).toEqual([100, null, 100]);
  });

  it('judges a sentence word by word', () => {
    const result = checkSounds(
      [expect1('very', '/ˈvɛɹi/'), expect1('thin', '/θɪn/')],
      say('w', 'ɛ', 'ɹ', 'i', 'θ', 'iː', 'n'),
    );
    expect(result?.words[0].phones?.[0]).toMatchObject({ status: 'wrong', heard: 'w' });
    expect(result?.words[1].phones?.[1]).toMatchObject({ status: 'wrong', heard: 'i' });
    expect(result?.tips.map((t) => t.sound)).toEqual(['V_W', 'I_EE']);
  });

  it('gives null when the recording is shorter than the words or nothing is known', () => {
    expect(checkSounds([expect1('think', '/θɪŋk/')], readFrames([[0.1, 'θ', 0.9]]) as Frame[])).toBeNull();
    expect(checkSounds([{ word: 'zzyzx', variants: [] }], say('z'))).toBeNull();
  });
});
