// server/src/shadowing/shadowing.engine.ts
/**
 * The listening hints shown over each shadowing line, and the build-up steps, worked out from the text.
 * Pure functions (no database), so they are easy to test.
 *
 * - stress: content words (nouns, verbs, adjectives, adverbs, negatives) carry the beat
 * - weak: small words said quickly in the middle of a sentence ("to" as "tuh")
 * - link: a word ending in a consonant sound runs into the next word starting with a vowel ("an_apple")
 * - tune: how the voice moves at the end (statements and wh- questions fall, yes/no questions rise)
 * - build-up: back-chaining, the classic way to learn a long line: say the end first, then add a chunk at a time
 */

/** Small words with a weak form, and how the weak form sounds */
export const WEAK_FORMS: Record<string, string> = {
  a: 'uh',
  an: 'un',
  the: 'thuh',
  to: 'tuh',
  for: 'fer',
  of: 'uv',
  and: "'n",
  but: 'b\'t',
  can: 'k\'n',
  at: "'t",
  from: 'fr\'m',
  was: 'w\'z',
  were: 'wer',
  are: 'er',
  some: 's\'m',
  them: "'em",
  have: "'v",
  has: "'z",
  do: 'duh',
  does: 'd\'z',
  as: "'z",
  than: 'th\'n',
  you: 'yuh',
  your: 'yer',
};

/** Words that are normally not stressed: grammar words, pronouns, auxiliaries, short prepositions */
const FUNCTION_WORDS = new Set([
  ...Object.keys(WEAK_FORMS),
  'i', 'me', 'my', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'we', 'us', 'our', 'they', 'their', 'this', 'that', 'these', 'those',
  'am', 'is', 'be', 'been', 'being', 'had', 'did', 'will', 'would', 'shall', 'should', 'could', 'may', 'might', 'must',
  'in', 'on', 'with', 'by', 'into', 'about', 'or', 'so', 'if', 'there', 'any',
  "i'm", "i've", "i'll", "i'd", "it's", "that's", "there's", "he's", "she's", "we're", "we'll", "we've", "they're", "you're", "you'll", "you've",
  "what's", "let's",
]);

const WH_WORDS = new Set(['what', 'where', 'when', 'why', 'who', 'whom', 'whose', 'which', 'how', "what's", "where's", "how's", "who's"]);

/** Words that start with a vowel letter but a consonant sound ("one", "use"), or the other way round ("hour") */
const STARTS_LIKE_CONSONANT = /^(one|once|uni|use|usu|eu|ewe)/;
const STARTS_LIKE_VOWEL = /^(hour|honest|honou?r|heir)/;

export const coreWord = (token: string): string =>
  token
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');

/** Ends with punctuation that closes a phrase, so no linking and no weak form across it */
const endsPhrase = (token: string) => /[.,;:!?)"”]$/.test(token);

function endsInConsonantSound(word: string): boolean {
  if (!word) return false;
  const last = word[word.length - 1];
  if (/[bcdfgklmnprstvxz]/.test(last)) return true;
  // A silent final e after a consonant: "come", "house", "like"
  return last === 'e' && word.length >= 4 && /[bcdfgklmnprstvz]/.test(word[word.length - 2]) && word[word.length - 3] !== 'e';
}

function startsWithVowelSound(word: string): boolean {
  if (!word) return false;
  if (STARTS_LIKE_VOWEL.test(word)) return true;
  return /^[aeiou]/.test(word) && !STARTS_LIKE_CONSONANT.test(word);
}

export interface LineToken {
  /** As written, with its punctuation */
  text: string;
  stress: boolean;
  /** How the weak form sounds, when this word is said weak here */
  weak: string | null;
  /** Runs straight into the next word */
  link: boolean;
}

export function annotate(text: string): LineToken[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.map((token, i) => {
    const word = coreWord(token);
    const next = tokens[i + 1];
    const last = !next || endsPhrase(token);
    const isFunction = FUNCTION_WORDS.has(word) || word.length === 0;
    // Grammar words at the end of a phrase keep their full form ("Yes, I can." "What are you looking at?")
    const weak = !last && word in WEAK_FORMS ? WEAK_FORMS[word] : null;
    const stress = !isFunction || WH_WORDS.has(word);
    const link = !last && endsInConsonantSound(word) && startsWithVowelSound(coreWord(next));
    return { text: token, stress, weak, link };
  });
}

export type Tune = 'rise' | 'fall' | 'tag';

/** How the voice moves at the end of the line */
export function tune(text: string): Tune {
  const t = text.trim();
  if (!t.endsWith('?')) return 'fall';
  // Question tags: "..., isn't it?" "..., do we?"
  if (/,\s*(\w+n't|is|are|am|was|were|do|does|did|have|has|had|can|could|will|would|shall|should)\s+(i|you|he|she|it|we|they|there)\s*\?$/i.test(t)) return 'tag';
  const first = coreWord(t.split(/\s+/)[0]);
  if (WH_WORDS.has(first)) return 'fall';
  // "Why don't we..." and "How about..." are suggestions and fall too; everything else asks yes or no
  return 'rise';
}

/**
 * Back-chaining: the end of the line first, then a chunk more each time, ending with the whole line. Chunks
 * break at commas where they can, so each step makes sense. Short lines are one step.
 */
export function buildUp(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const n = words.length;
  if (n <= 4) return [words.join(' ')];
  const size = Math.max(3, Math.ceil(n / 4));
  const starts: number[] = [];
  let s = n - size;
  while (s >= 2) {
    let start = s;
    // Prefer to start just after a comma near this point
    for (const k of [s, s - 1, s + 1, s - 2]) {
      if (k >= 2 && k <= n - 2 && /[,;:]$/.test(words[k - 1])) {
        start = k;
        break;
      }
    }
    if (starts.length && start >= starts[starts.length - 1]) start = s;
    starts.push(start);
    s = start - size;
  }
  return [...starts.map((i) => words.slice(i).join(' ')), words.join(' ')];
}

/** Same words, ignoring case, curly quotes and spacing */
export const sameLine = (a: string, b: string): boolean => normalizeLine(a) === normalizeLine(b);
const normalizeLine = (s: string) => s.toLowerCase().replace(/[‘’`]/g, "'").replace(/\s+/g, ' ').trim();

export interface AttemptLike {
  target: string;
  score: number;
  missedWords?: string[];
}

/** Your best score on each line from the pronunciation attempts given (null = not said) */
export function bestByLine(lines: string[], attempts: AttemptLike[]): Array<number | null> {
  return lines.map((line) => {
    const scores = attempts.filter((a) => sameLine(a.target, line)).map((a) => a.score);
    return scores.length ? Math.max(...scores) : null;
  });
}

/** The words you missed most often on these lines, most missed first */
export function weakWords(lines: string[], attempts: AttemptLike[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const a of attempts) {
    if (!lines.some((l) => sameLine(l, a.target))) continue;
    for (const w of a.missedWords ?? []) {
      const word = coreWord(w);
      if (word) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, limit).map(([w]) => w);
}

/** The rounded average of the scores that are numbers, or null when none are */
export function averageOf(scores: Array<number | null>): number | null {
  const said = scores.filter((s): s is number => typeof s === 'number');
  return said.length ? Math.round(said.reduce((a, b) => a + b, 0) / said.length) : null;
}
