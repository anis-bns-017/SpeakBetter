/** Common irregular forms, which no spelling rule can undo */
const IRREGULAR: Record<string, string> = {
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be',
  has: 'have', had: 'have', does: 'do', did: 'do', done: 'do',
  went: 'go', gone: 'go', said: 'say', made: 'make', took: 'take', taken: 'take',
  came: 'come', saw: 'see', seen: 'see', got: 'get', gave: 'give', given: 'give',
  knew: 'know', known: 'know', thought: 'think', told: 'tell', found: 'find',
  felt: 'feel', left: 'leave', kept: 'keep', brought: 'bring', bought: 'buy',
  ate: 'eat', eaten: 'eat', wrote: 'write', written: 'write', spoke: 'speak', spoken: 'speak',
  began: 'begin', begun: 'begin', ran: 'run', sat: 'sit', stood: 'stand', heard: 'hear',
  met: 'meet', paid: 'pay', sold: 'sell', taught: 'teach', understood: 'understand',
  children: 'child', men: 'man', women: 'woman', people: 'person', feet: 'foot',
  teeth: 'tooth', mice: 'mouse', better: 'good', best: 'good', worse: 'bad', worst: 'bad',
};

const PLURAL_FORMS = new Set(['children', 'men', 'women', 'people', 'feet', 'teeth', 'mice']);
const ADJECTIVE_FORMS = new Set(['better', 'best', 'worse', 'worst']);

/**
 * The part of speech an inflected word most likely is, so its dictionary entry can show that sense first:
 * "went" and "running" are verbs, "stories" a noun, "quickly" an adverb, "faster" an adjective.
 */
export function partOfSpeechHint(raw: string): 'verb' | 'noun' | 'adverb' | 'adjective' | undefined {
  const word = raw.toLowerCase().trim();
  if (PLURAL_FORMS.has(word)) return 'noun';
  if (ADJECTIVE_FORMS.has(word)) return 'adjective';
  if (IRREGULAR[word]) return 'verb';
  if (word.endsWith('ing') || word.endsWith('ed')) return 'verb';
  if (word.endsWith('ly')) return 'adverb';
  if (word.endsWith('er') || word.endsWith('est')) return 'adjective';
  if (word.endsWith('s')) return 'noun';
  return undefined;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** "runn" → "run" (a doubled final consonant added when the ending was attached) */
const undouble = (stem: string) =>
  stem.length > 2 && stem.at(-1) === stem.at(-2) && !VOWELS.has(stem.at(-1) as string) ? stem.slice(0, -1) : null;

/**
 * Likely dictionary forms of an inflected English word ("went" → go, "running" → run, "stories" → story),
 * most likely first. Only used when the word itself has no entry, so a wrong guess costs nothing.
 */
export function baseForms(raw: string): string[] {
  const word = raw.toLowerCase().trim();
  if (word.length < 3 || !/^[a-z]+$/.test(word)) return [];
  const irregular = IRREGULAR[word];
  if (irregular) return [irregular];

  const out: Array<string | null> = [];
  if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3);
    out.push(stem, undouble(stem), `${stem}e`);
  } else if (word.endsWith('ied') || word.endsWith('ies')) {
    out.push(`${word.slice(0, -3)}y`);
  } else if (word.endsWith('ed') && word.length > 4) {
    const stem = word.slice(0, -2);
    out.push(stem, undouble(stem), `${stem}e`);
  } else if (word.endsWith('es') && word.length > 4) {
    out.push(word.slice(0, -2), word.slice(0, -1));
  } else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
    out.push(word.slice(0, -1));
  } else if (word.endsWith('ly') && word.length > 4) {
    out.push(word.slice(0, -2));
  } else if (word.endsWith('est') && word.length > 5) {
    const stem = word.slice(0, -3);
    out.push(stem, undouble(stem), `${stem}e`);
  } else if (word.endsWith('er') && word.length > 4) {
    const stem = word.slice(0, -2);
    out.push(stem, undouble(stem), `${stem}e`);
  }
  return [...new Set(out.filter((f): f is string => !!f && f.length >= 2 && f !== word))];
}
