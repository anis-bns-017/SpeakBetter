// server/src/pronunciation/phonemes.ts
// The sounds of English as this app scores them: reading a dictionary's IPA into a list of sounds, reading the
// phone labels of the on-device recogniser (eSpeak symbols, many of them from other languages) as English
// sounds, and judging how far apart two sounds are. Pure data and functions.

import type { SoundKey } from './pronunciation.data';

/** A sound a word is expected to contain */
export interface ExpectedPhone {
  /** One of PHONES */
  p: string;
  /** Leaving it out is fine (the r in "car", the t in "often") */
  optional?: boolean;
  /** Other sounds that are just as right here (the last vowel of "happy" may be short) */
  accept?: string[];
}

export const CONSONANTS = ['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j', 'tʃ', 'dʒ'] as const;
export const VOWELS = ['i', 'ɪ', 'e', 'æ', 'ɑ', 'ɒ', 'ɔ', 'ʊ', 'u', 'ʌ', 'ə', 'ɜ', 'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ'] as const;
export const PHONES: readonly string[] = [...CONSONANTS, ...VOWELS];

const VOWEL_SET = new Set<string>(VOWELS);
export const isVowel = (p: string) => VOWEL_SET.has(p);

/** How each sound is shown to a learner: the usual spelling and a word that has it */
export const PHONE_LABEL: Record<string, { ipa: string; hint: string }> = {
  p: { ipa: 'p', hint: 'p as in pen' },
  b: { ipa: 'b', hint: 'b as in big' },
  t: { ipa: 't', hint: 't as in ten' },
  d: { ipa: 'd', hint: 'd as in day' },
  k: { ipa: 'k', hint: 'k as in cat' },
  g: { ipa: 'ɡ', hint: 'g as in go' },
  f: { ipa: 'f', hint: 'f as in fine' },
  v: { ipa: 'v', hint: 'v as in very' },
  θ: { ipa: 'θ', hint: 'th as in think' },
  ð: { ipa: 'ð', hint: 'th as in this' },
  s: { ipa: 's', hint: 's as in see' },
  z: { ipa: 'z', hint: 'z as in zoo' },
  ʃ: { ipa: 'ʃ', hint: 'sh as in she' },
  ʒ: { ipa: 'ʒ', hint: 's as in vision' },
  h: { ipa: 'h', hint: 'h as in hat' },
  m: { ipa: 'm', hint: 'm as in man' },
  n: { ipa: 'n', hint: 'n as in no' },
  ŋ: { ipa: 'ŋ', hint: 'ng as in sing' },
  l: { ipa: 'l', hint: 'l as in leg' },
  r: { ipa: 'r', hint: 'r as in red' },
  w: { ipa: 'w', hint: 'w as in we' },
  j: { ipa: 'j', hint: 'y as in yes' },
  tʃ: { ipa: 'tʃ', hint: 'ch as in chair' },
  dʒ: { ipa: 'dʒ', hint: 'j as in job' },
  i: { ipa: 'iː', hint: 'ee as in see' },
  ɪ: { ipa: 'ɪ', hint: 'i as in sit' },
  e: { ipa: 'e', hint: 'e as in bed' },
  æ: { ipa: 'æ', hint: 'a as in cat' },
  ɑ: { ipa: 'ɑː', hint: 'a as in father' },
  ɒ: { ipa: 'ɒ', hint: 'o as in hot' },
  ɔ: { ipa: 'ɔː', hint: 'aw as in saw' },
  ʊ: { ipa: 'ʊ', hint: 'oo as in book' },
  u: { ipa: 'uː', hint: 'oo as in food' },
  ʌ: { ipa: 'ʌ', hint: 'u as in cup' },
  ə: { ipa: 'ə', hint: 'a as in about' },
  ɜ: { ipa: 'ɜː', hint: 'ir as in bird' },
  eɪ: { ipa: 'eɪ', hint: 'ay as in day' },
  aɪ: { ipa: 'aɪ', hint: 'i as in my' },
  ɔɪ: { ipa: 'ɔɪ', hint: 'oy as in boy' },
  aʊ: { ipa: 'aʊ', hint: 'ow as in now' },
  oʊ: { ipa: 'oʊ', hint: 'o as in go' },
};

// ---------- dictionary IPA -> expected sounds ----------

/** Longest first, so "tʃ" is read before "t" */
const IPA_TOKENS: Array<[string, ExpectedPhone[]]> = (
  [
    ['tʃ', ['tʃ']],
    ['dʒ', ['dʒ']],
    ['eɪ', ['eɪ']],
    ['aɪ', ['aɪ']],
    ['ɔɪ', ['ɔɪ']],
    ['oɪ', ['ɔɪ']],
    ['aʊ', ['aʊ']],
    ['oʊ', ['oʊ']],
    ['əʊ', ['oʊ']],
    // The centring glides of British English ("near", "air", "sure"): the second half may be an r instead
    ['ɪə', ['ɪ', '?ə']],
    ['iə', ['ɪ', '?ə']],
    ['ɛə', ['e', '?ə']],
    ['eə', ['e', '?ə']],
    ['ʊə', ['ʊ', '?ə']],
    // r-coloured vowels of American English: the r itself may be silent
    ['ɝ', ['ɜ', '?r']],
    ['ɚ', ['ə', '?r']],
    ['i', ['i']],
    ['ɪ', ['ɪ']],
    ['ɨ', ['ɪ']],
    ['ɘ', ['ɪ']],
    ['ɛ', ['e']],
    ['e', ['e']],
    ['æ', ['æ']],
    ['a', ['æ']],
    ['ɑ', ['ɑ']],
    ['ɒ', ['ɒ']],
    ['ɔ', ['ɔ']],
    ['o', ['oʊ']],
    ['ʊ', ['ʊ']],
    ['ɵ', ['ʊ']],
    ['u', ['u']],
    ['ʉ', ['u']],
    ['ʌ', ['ʌ']],
    ['ə', ['ə']],
    ['ɐ', ['ə']],
    ['ɜ', ['ɜ']],
    ['p', ['p']],
    ['b', ['b']],
    ['t', ['t']],
    ['ɾ', ['t']],
    ['ʔ', ['t']],
    ['d', ['d']],
    ['k', ['k']],
    ['ɡ', ['g']],
    ['g', ['g']],
    ['f', ['f']],
    ['v', ['v']],
    ['θ', ['θ']],
    ['ð', ['ð']],
    ['s', ['s']],
    ['z', ['z']],
    ['ʃ', ['ʃ']],
    ['ʒ', ['ʒ']],
    ['h', ['h']],
    ['m', ['m']],
    ['n', ['n']],
    ['ŋ', ['ŋ']],
    ['l', ['l']],
    ['ɫ', ['l']],
    ['ɹ', ['r']],
    ['r', ['r']],
    ['w', ['w']],
    ['ʍ', ['w']],
    ['j', ['j']],
  ] as Array<[string, string[]]>
).map(([ipa, phones]) => [
  ipa,
  phones.map((p) => (p.startsWith('?') ? { p: p.slice(1), optional: true } : { p })),
]);

/** Marks that carry no sound of their own: stress, syllable breaks, length, ties and fine detail */
const IGNORED = /[/[\]ˈˌ.\s\-ː͡‿̯̪̬̈̃ʷʰ]/g;

/**
 * Reads a dictionary pronunciation ("/ˈwɔtɝ/") as a list of sounds. Sounds in brackets are optional, and so
 * is an r that is not followed by a vowel, since British English leaves it out. Returns an empty list when
 * nothing could be read.
 */
export function parseIpa(ipa: string): ExpectedPhone[] {
  const text = String(ipa ?? '').normalize('NFC').replace(IGNORED, '');
  const out: ExpectedPhone[] = [];
  let optional = false;
  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === '(') {
      optional = true;
      i++;
      continue;
    }
    if (ch === ')') {
      optional = false;
      i++;
      continue;
    }
    // A syllabic consonant (the n of "button") is a weak vowel plus the consonant
    if (ch === '̩') {
      const last = out.pop();
      if (last) out.push({ p: 'ə', optional: true }, last);
      i++;
      continue;
    }
    // The r-colouring hook after a vowel
    if (ch === '˞') {
      out.push({ p: 'r', optional: true });
      i++;
      continue;
    }
    const token = IPA_TOKENS.find(([symbol]) => text.startsWith(symbol, i));
    if (!token) {
      i++;
      continue;
    }
    for (const phone of token[1]) out.push(optional ? { ...phone, optional: true } : { ...phone });
    i += token[0].length;
  }

  const vowels = out.filter((p) => isVowel(p.p)).length;
  out.forEach((phone, i) => {
    const next = out[i + 1];
    // "car", "bird": the r is only said before a vowel in British English
    if (phone.p === 'r' && i > 0 && isVowel(out[i - 1].p) && (!next || !isVowel(next.p))) phone.optional = true;
    // "happy", "very": the last vowel is short for many speakers
    if (phone.p === 'i' && !next && vowels > 1) phone.accept = ['ɪ'];
  });
  return out;
}

// ---------- recogniser phones -> English sounds ----------

/**
 * What the recogniser's labels mean in English sounds. A label with several sounds either covers a run of
 * them ("ɑːɹ" is the vowel and the r of "car") or could be any of them (a plain "a"). Sounds of other
 * languages are read as the English sound a listener would take them for, so that a dental t said for "th"
 * is reported as a t.
 */
const MODEL_PHONES: Record<string, string[]> = {
  n: ['n'], s: ['s'], t: ['t'], l: ['l'], k: ['k'], d: ['d'], m: ['m'], p: ['p'], z: ['z'], ð: ['ð'], f: ['f'],
  j: ['j'], v: ['v'], b: ['b'], w: ['w'], h: ['h'], θ: ['θ'], ŋ: ['ŋ'], ʃ: ['ʃ'], ʒ: ['ʒ'], tʃ: ['tʃ'], dʒ: ['dʒ'],
  ɹ: ['r'], ɡ: ['g'], g: ['g'], ɾ: ['t', 'd'], ʔ: ['t'], ɫ: ['l'],
  ə: ['ə'], ɐ: ['ə', 'ʌ'], ɚ: ['ə', 'r'], ɜ: ['ɜ'], ɜː: ['ɜ', 'r'], ɪ: ['ɪ'], ᵻ: ['ɪ'], i: ['i'], iː: ['i'],
  ɛ: ['e'], e: ['e', 'eɪ'], eː: ['eɪ', 'e'], æ: ['æ'], a: ['æ', 'ɑ', 'ʌ'], aː: ['ɑ', 'æ'], ɑ: ['ɑ'], ɑː: ['ɑ'],
  ɔ: ['ɔ'], ɔː: ['ɔ'], ɒ: ['ɒ'], o: ['oʊ', 'ɔ'], oː: ['oʊ', 'ɔ'], oʊ: ['oʊ'], əʊ: ['oʊ'], ʊ: ['ʊ'], u: ['u'], uː: ['u'],
  ʌ: ['ʌ'], eɪ: ['eɪ'], aɪ: ['aɪ'], aʊ: ['aʊ'], ɔɪ: ['ɔɪ'], oɪ: ['ɔɪ'],
  ɑːɹ: ['ɑ', 'r'], ɔːɹ: ['ɔ', 'r'], oːɹ: ['ɔ', 'r'], ɛɹ: ['e', 'r'], ɪɹ: ['ɪ', 'r'], ʊɹ: ['ʊ', 'r'],
  əl: ['ə', 'l'], 'n̩': ['ə', 'n'], 'l̩': ['ə', 'l'], aɪɚ: ['aɪ', 'ə', 'r'], aɪə: ['aɪ', 'ə'], iə: ['ɪ', 'ə', 'i'],
  ʊə: ['ʊ', 'ə'], eə: ['e', 'ə'], ju: ['j', 'u'], ts: ['t', 's'],
  // Sounds English does not have, as an English listener hears them
  r: ['r'], ʁ: ['r'], ɽ: ['r'], ɻ: ['r'], 'r̩': ['r'], ʀ: ['r'],
  't̪': ['t'], ʈ: ['t'], th: ['t'], tʰ: ['t'], 't[': ['t'], 'd̪': ['d'], ɖ: ['d'], 'd[': ['d'], dʰ: ['d'],
  ph: ['p'], pʰ: ['p'], kh: ['k'], kʰ: ['k'], q: ['k'], c: ['k'], bʰ: ['b'], ɡʰ: ['g'],
  x: ['h'], χ: ['h'], ç: ['h'], ħ: ['h'], ɣ: ['g'], β: ['b'], ʋ: ['w'], ɸ: ['f'],
  ɕ: ['ʃ'], ʂ: ['ʃ'], ʑ: ['ʒ'], ʐ: ['ʒ'], tɕ: ['tʃ'], dʑ: ['dʒ'], ɟ: ['dʒ'], ʝ: ['j'],
  ɲ: ['n'], ɳ: ['n'], ɴ: ['ŋ'], ɭ: ['l'], ʎ: ['l'], ɬ: ['l'],
  y: ['u'], yː: ['u'], ʉ: ['u'], ɯ: ['ʊ'], ø: ['ɜ'], øː: ['ɜ'], œ: ['ɜ'], ɨ: ['ɪ'], ɵ: ['ʊ'], ä: ['æ'], ɛː: ['e'],
};

/** Marks of length, softness, breath and tone that do not change which English sound is closest */
const MODEL_DETAIL = /[ːʲʰˤ̝̞̩̪̃̊ᵝ.^:"0-9[\]]/g;

/** The English sounds a recogniser label stands for, most likely first; empty when it is not speech we know */
export function modelPhoneClasses(phone: string): string[] {
  // Some label sets join the two halves of "t͡ʃ" with a tie
  const label = phone.replace(/[͜͡]/g, '');
  const known = MODEL_PHONES[label];
  if (known) return known;
  const plain = label.normalize('NFC').replace(MODEL_DETAIL, '');
  if (plain && plain !== label) return MODEL_PHONES[plain] ?? [];
  return [];
}

// ---------- how far apart two sounds are ----------

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const pairs = (list: Array<[string, string]>) => new Set(list.map(([a, b]) => pairKey(a, b)));

/**
 * Sounds that are both right: the difference is one of accent (American "hot" has the vowel of "father") or
 * of how carefully a weak syllable is said.
 */
const SAME = pairs([
  ['ʌ', 'ə'],
  ['ɜ', 'ə'],
  ['ɑ', 'ɒ'],
  ['ɒ', 'ɔ'],
  ['ɑ', 'ɔ'],
]);

/** Sounds made almost the same way: worth a note, but not a mistake that hides the word */
const NEAR = pairs([
  ['p', 'b'], ['t', 'd'], ['k', 'g'], ['f', 'v'], ['θ', 'ð'], ['ʃ', 'ʒ'], ['tʃ', 'dʒ'],
  ['m', 'n'], ['n', 'ŋ'], ['tʃ', 'ʃ'], ['dʒ', 'ʒ'], ['dʒ', 'z'], ['j', 'i'], ['w', 'u'],
]);

/** The mix-ups this app teaches, as [expected, heard] */
const TAUGHT: Array<{ sound: SoundKey; expected: string; heard: string[]; near?: boolean }> = [
  { sound: 'TH', expected: 'θ', heard: ['s', 't', 'f', 'd', 'z'] },
  { sound: 'TH', expected: 'ð', heard: ['d', 'z', 't', 'v', 's'] },
  { sound: 'V_W', expected: 'v', heard: ['w'] },
  { sound: 'V_W', expected: 'w', heard: ['v'] },
  { sound: 'V_B', expected: 'v', heard: ['b'] },
  { sound: 'V_B', expected: 'b', heard: ['v'] },
  { sound: 'R_L', expected: 'r', heard: ['l'] },
  { sound: 'R_L', expected: 'l', heard: ['r'] },
  { sound: 'I_EE', expected: 'ɪ', heard: ['i'] },
  { sound: 'I_EE', expected: 'i', heard: ['ɪ'] },
  { sound: 'A_E', expected: 'æ', heard: ['e'] },
  { sound: 'A_E', expected: 'e', heard: ['æ'] },
  { sound: 'S_SH', expected: 's', heard: ['ʃ'] },
  { sound: 'S_SH', expected: 'ʃ', heard: ['s'] },
  { sound: 'F_P', expected: 'f', heard: ['p'] },
  { sound: 'F_P', expected: 'p', heard: ['f'] },
  { sound: 'U_OO', expected: 'ʊ', heard: ['u'] },
  { sound: 'U_OO', expected: 'u', heard: ['ʊ'] },
  // Voicing at the end of a word is hard to hear even for people, so this one is only ever "close"
  { sound: 'Z_S', expected: 'z', heard: ['s'], near: true },
  { sound: 'Z_S', expected: 's', heard: ['z'], near: true },
];

export type PhoneJudgement = 'same' | 'close' | 'wrong';

/** How a sound that was heard compares with the one expected, and the taught mix-up it points to (if any) */
export function comparePhones(expected: string, heard: string): { judgement: PhoneJudgement; sound: SoundKey | null } {
  if (expected === heard || SAME.has(pairKey(expected, heard))) return { judgement: 'same', sound: null };
  const taught = TAUGHT.find((t) => t.expected === expected && t.heard.includes(heard));
  if (taught) return { judgement: taught.near ? 'close' : 'wrong', sound: taught.sound };
  // Vowels drift with accent and with speed; only the taught vowel pairs count as mistakes
  if (isVowel(expected) && isVowel(heard)) return { judgement: 'close', sound: null };
  if (NEAR.has(pairKey(expected, heard))) return { judgement: 'close', sound: null };
  return { judgement: 'wrong', sound: null };
}

/** Every sound that counts as right where `phone` is expected */
export function acceptedFor(phone: ExpectedPhone): string[] {
  const accepted = new Set<string>([phone.p, ...(phone.accept ?? [])]);
  for (const other of PHONES) if (SAME.has(pairKey(phone.p, other))) accepted.add(other);
  return [...accepted];
}
