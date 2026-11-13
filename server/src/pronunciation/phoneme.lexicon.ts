// server/src/pronunciation/phoneme.lexicon.ts
// How a word is expected to sound: the dictionary's pronunciations, a hand-written list for the small words
// (which have weak forms: "to" is usually "tuh") and common irregular forms, and the regular endings
// (-s, -ed, -ing) worked out from the base word.

import type { Dictionary, DictWord } from '../dictionary/dictionary.data';
import { isVowel, parseIpa, type ExpectedPhone } from './phonemes';

/**
 * Small words and irregular forms. Each may be said in more than one way; any of them is right. These win
 * over the dictionary, whose data for the commonest words is the least reliable.
 */
const COMMON: Record<string, string[]> = {
  the: ['ðə', 'ði'], a: ['ə', 'eɪ'], an: ['ən', 'æn'], to: ['tə', 'tu'], of: ['əv', 'ɒv'], and: ['ənd', 'ænd', 'ən'],
  in: ['ɪn'], is: ['ɪz'], it: ['ɪt'], you: ['ju', 'jə'], that: ['ðæt', 'ðət'], he: ['hi', 'i'],
  was: ['wəz', 'wɒz', 'wʌz'], for: ['fɔɹ', 'fəɹ'], on: ['ɒn'], are: ['ɑɹ', 'əɹ'], with: ['wɪð', 'wɪθ'], as: ['æz', 'əz'],
  his: ['hɪz', 'ɪz'], they: ['ðeɪ'], be: ['bi'], at: ['æt', 'ət'], have: ['hæv', 'həv', 'əv'], this: ['ðɪs'],
  from: ['fɹɒm', 'fɹəm', 'fɹʌm'], or: ['ɔɹ', 'əɹ'], had: ['hæd', 'həd', 'əd'], by: ['baɪ'], but: ['bʌt'], what: ['wɒt', 'wʌt'],
  some: ['sʌm'], we: ['wi'], can: ['kæn', 'kən'], were: ['wɜɹ', 'wəɹ'], your: ['jɔɹ', 'jʊɹ', 'jəɹ'],
  their: ['ðɛɹ'], there: ['ðɛɹ'], them: ['ðɛm', 'ðəm', 'əm'], does: ['dʌz'], do: ['du', 'də'], did: ['dɪd'],
  him: ['hɪm', 'ɪm'], her: ['hɜɹ', 'həɹ', 'əɹ'], us: ['ʌs'], our: ['aʊəɹ', 'ɑɹ'], my: ['maɪ'], me: ['mi'],
  she: ['ʃi'], been: ['bin', 'bɪn'], has: ['hæz', 'həz', 'əz'], would: ['wʊd', 'wəd'], could: ['kʊd', 'kəd'],
  should: ['ʃʊd', 'ʃəd'], will: ['wɪl'], not: ['nɒt'], than: ['ðæn', 'ðən'], then: ['ðɛn'], i: ['aɪ'],
  am: ['æm', 'əm'], these: ['ðiz'], those: ['ðoʊz'], who: ['hu'], says: ['sɛz'], said: ['sɛd'],
  women: ['wɪmɪn'], men: ['mɛn'], children: ['tʃɪldɹən'], read: ['ɹid', 'ɹɛd'], live: ['lɪv', 'laɪv'],
  // Irregular past forms
  made: ['meɪd'], came: ['keɪm'], went: ['wɛnt'], took: ['tʊk'], got: ['ɡɒt'], gave: ['ɡeɪv'], thought: ['θɔt'],
  told: ['toʊld'], found: ['faʊnd'], knew: ['nju', 'nu'], saw: ['sɔ'], left: ['lɛft'], felt: ['fɛlt'],
  caught: ['kɔt'], bought: ['bɔt'], brought: ['bɹɔt'], taught: ['tɔt'], heard: ['hɜɹd'], kept: ['kɛpt'],
  slept: ['slɛpt'], meant: ['mɛnt'], sent: ['sɛnt'], spent: ['spɛnt'], built: ['bɪlt'], lost: ['lɒst'],
  won: ['wʌn'], ate: ['eɪt', 'ɛt'], drank: ['dɹæŋk'], ran: ['ɹæn'], began: ['bɪɡæn'], wrote: ['ɹoʊt'],
  spoke: ['spoʊk'], broke: ['bɹoʊk'], chose: ['tʃoʊz'], drove: ['dɹoʊv'], flew: ['flu'], grew: ['ɡɹu'],
  threw: ['θɹu'], wore: ['wɔɹ'], sat: ['sæt'], stood: ['stʊd'], understood: ['ʌndəɹstʊd'], paid: ['peɪd'],
  held: ['hɛld'], fell: ['fɛl'], sold: ['soʊld'], met: ['mɛt'], done: ['dʌn'], gone: ['ɡɒn'], seen: ['sin'],
  known: ['noʊn'], given: ['ɡɪvən'], taken: ['teɪkən'], written: ['ɹɪtən'], eaten: ['itən'], spoken: ['spoʊkən'],
  broken: ['bɹoʊkən'], chosen: ['tʃoʊzən'], driven: ['dɹɪvən'], forgot: ['fəɹɡɒt'], forgotten: ['fəɹɡɒtən'],
  // Short forms
  "i'm": ['aɪm'], "i'll": ['aɪl'], "i've": ['aɪv'], "i'd": ['aɪd'], "it's": ['ɪts'], "that's": ['ðæts'],
  "don't": ['doʊnt'], "can't": ['kænt', 'kɑnt'], "isn't": ['ɪzənt'], "didn't": ['dɪdənt'], "doesn't": ['dʌzənt'],
  "won't": ['woʊnt'], "wasn't": ['wɒzənt'], "aren't": ['ɑɹnt'], "haven't": ['hævənt'], "couldn't": ['kʊdənt'],
  "wouldn't": ['wʊdənt'], "shouldn't": ['ʃʊdənt'], "you're": ['jɔɹ', 'jʊɹ'], "we're": ['wɪɹ'], "they're": ['ðɛɹ'],
  "he's": ['hiz'], "she's": ['ʃiz'], "what's": ['wɒts'], "let's": ['lɛts'], "there's": ['ðɛɹz'], "we'll": ['wil'],
  "you'll": ['jul'], "they'll": ['ðeɪl'], "we've": ['wiv'], "you've": ['juv'], "they've": ['ðeɪv'],
};

const COMMON_PHONES = new Map<string, ExpectedPhone[][]>(
  Object.entries(COMMON).map(([word, list]) => [word, list.map(parseIpa)]),
);

const SIBILANTS = new Set(['s', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ']);
const VOICELESS = new Set(['p', 't', 'k', 'f', 'θ']);
/** After these (voiceless) sounds, -ed is a t: "walked", "washed" */
const ED_AS_T = new Set(['p', 'k', 'f', 'θ', 's', 'ʃ', 'tʃ']);

/** The sound a word really ends in (an optional r at the end does not count) */
function lastSound(phones: ExpectedPhone[]): string | null {
  for (let i = phones.length - 1; i >= 0; i--) if (!phones[i].optional) return phones[i].p;
  return phones.at(-1)?.p ?? null;
}

const copy = (phones: ExpectedPhone[]): ExpectedPhone[] => phones.map((p) => ({ ...p }));

/** "cats" /s/, "dogs" /z/, "buses" /ɪz/ */
export function addS(base: ExpectedPhone[]): ExpectedPhone[] {
  const last = lastSound(base);
  if (!last) return [];
  if (SIBILANTS.has(last)) return [...copy(base), { p: 'ɪ', accept: ['ə'] }, { p: 'z', accept: ['s'] }];
  if (VOICELESS.has(last)) return [...copy(base), { p: 's' }];
  return [...copy(base), { p: 'z', accept: ['s'] }];
}

/** "walked" /t/, "played" /d/, "wanted" /ɪd/ */
export function addEd(base: ExpectedPhone[]): ExpectedPhone[] {
  const last = lastSound(base);
  if (!last) return [];
  if (last === 't' || last === 'd') return [...copy(base), { p: 'ɪ', accept: ['ə'] }, { p: 'd' }];
  if (ED_AS_T.has(last)) return [...copy(base), { p: 't' }];
  return [...copy(base), { p: 'd' }];
}

/** "walking": the r of "hear" is said in "hearing" */
export function addIng(base: ExpectedPhone[]): ExpectedPhone[] {
  if (!base.length) return [];
  const stem = copy(base);
  const last = stem[stem.length - 1];
  if (last.p === 'r' && last.optional && stem.length > 1 && isVowel(stem[stem.length - 2].p)) delete last.optional;
  return [...stem, { p: 'ɪ' }, { p: 'ŋ', accept: ['n'] }];
}

function dictVariants(word: DictWord | undefined): ExpectedPhone[][] {
  if (!word?.ipa) return [];
  const seen = new Set<string>();
  const out: ExpectedPhone[][] = [];
  for (const ipa of [word.ipa.us, word.ipa.uk]) {
    if (!ipa) continue;
    // "/ˌɛs oʊ ˈbi/" spells a word out letter by letter: not how it is said in a sentence
    const phones = parseIpa(ipa);
    if (!phones.length) continue;
    const key = phones.map((p) => `${p.optional ? '?' : ''}${p.p}`).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phones);
  }
  return out;
}

const ENDINGS: Array<{ ending: RegExp; bases: (stem: string) => string[]; add: (base: ExpectedPhone[]) => ExpectedPhone[] }> = [
  { ending: /'s$/, bases: (s) => [s], add: addS },
  { ending: /ies$/, bases: (s) => [`${s}y`], add: addS },
  { ending: /es$/, bases: (s) => [s, `${s}e`], add: addS },
  { ending: /s$/, bases: (s) => [s], add: addS },
  { ending: /ied$/, bases: (s) => [`${s}y`], add: addEd },
  { ending: /ed$/, bases: (s) => [s, `${s}e`, s.replace(/(.)\1$/, '$1')], add: addEd },
  { ending: /ing$/, bases: (s) => [s, `${s}e`, s.replace(/(.)\1$/, '$1')], add: addIng },
];

/**
 * The ways `word` (plain, lower case) may be said, or an empty list when we do not know. More than one
 * means any of them is right (American and British, strong and weak).
 */
export function pronunciationsOf(dict: Dictionary, word: string): ExpectedPhone[][] {
  const text = word.toLowerCase().replace(/[‘’ʼ]/g, "'");
  const common = COMMON_PHONES.get(text);
  if (common) return common.map(copy);

  const direct = dictVariants(dict.byId.get(dict.byText.get(text) ?? ''));
  if (direct.length) return direct;

  for (const { ending, bases, add } of ENDINGS) {
    if (!ending.test(text)) continue;
    const stem = text.replace(ending, '');
    if (stem.length < 2) continue;
    for (const base of bases(stem)) {
      const known = COMMON_PHONES.get(base) ?? dictVariants(dict.byId.get(dict.byText.get(base) ?? ''));
      const built = known.map(add).filter((phones) => phones.length);
      if (built.length) return built;
    }
  }
  return [];
}
