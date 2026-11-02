// server/src/learning/mistakes.ts
// Works out what kind of mistake a correction fixed (article, preposition, verb form, ...), so the
// app can show "errors you keep repeating". Rule-based and free: it compares the wrong and the
// corrected sentence word by word. It is a good guess, not a grammar checker.

export const MISTAKE_PATTERNS = {
  TENSE: {
    label: 'Verb tense & form',
    tip: 'Think about when it happened: use the past (went, ate) for finished actions, and keep "be" with -ing together (I am going).',
  },
  AGREEMENT: {
    label: 'Singular & plural',
    tip: 'He, she and it take -s (she works). Plural nouns take -s (two books), and is/are, was/were must match the subject.',
  },
  PREPOSITION: {
    label: 'Prepositions',
    tip: 'Prepositions go with particular words: at 5 pm, on Monday, in July; interested in, good at, depend on. Learn them in small phrases.',
  },
  ARTICLE: {
    label: 'Articles (a, an, the)',
    tip: 'Use a/an for one of many, the for something specific that both of you know, and no article for general plurals (I like cats).',
  },
  WORD_ORDER: {
    label: 'Word order',
    tip: 'Statements go subject, verb, object. Questions go question word, helper verb, subject (Where do you live?).',
  },
  SPELLING: {
    label: 'Spelling',
    tip: 'Say the word slowly in syllables and notice the tricky letters. Writing it three times helps it stick.',
  },
  WORD_CHOICE: {
    label: 'Choosing the right word',
    tip: 'Learn words in phrases (make a decision, do homework, take a photo) so the right partner word comes naturally.',
  },
  MISSING_WORD: {
    label: 'Missing words',
    tip: 'English sentences need a subject and a verb: "It is cold", not "Is cold". Check that nothing is left out.',
  },
  EXTRA_WORD: {
    label: 'Extra words',
    tip: 'Try shorter sentences. Leave out words your first language needs but English does not.',
  },
  PUNCTUATION: {
    label: 'Capitalisation & punctuation',
    tip: 'Start sentences with a capital letter, always write I as a capital, and end with the right mark.',
  },
  PRONUNCIATION: {
    label: 'Pronunciation',
    tip: 'Listen to the word, then say it slowly three times, matching the stress and the sounds.',
  },
  OTHER: { label: 'Other', tip: 'Read the correction aloud a few times so the right version sounds familiar.' },
} as const;

export type MistakePattern = keyof typeof MISTAKE_PATTERNS;

export const isPattern = (value: unknown): value is MistakePattern =>
  typeof value === 'string' && value in MISTAKE_PATTERNS;

const ARTICLES = new Set(['a', 'an', 'the']);
const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'into', 'over', 'under', 'between',
  'during', 'since', 'until', 'through', 'after', 'before', 'across', 'against', 'among', 'without', 'within',
]);
/** Helper verbs: leaving one out or adding one that does not belong is a verb-form mistake */
const AUXILIARIES = new Set([
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'can', 'could', 'should', 'must', 'may', 'might',
]);

/** Forms of the same verb. The agreement pairs below tell apart "is/are" from "went/go". */
const VERB_FAMILIES: string[][] = [
  ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  ['have', 'has', 'had', 'having'],
  ['do', 'does', 'did', 'done', 'doing'],
  ['go', 'goes', 'went', 'gone', 'going'],
  ['see', 'sees', 'saw', 'seen', 'seeing'],
  ['eat', 'eats', 'ate', 'eaten', 'eating'],
  ['take', 'takes', 'took', 'taken', 'taking'],
  ['make', 'makes', 'made', 'making'],
  ['come', 'comes', 'came', 'coming'],
  ['get', 'gets', 'got', 'gotten', 'getting'],
  ['give', 'gives', 'gave', 'given', 'giving'],
  ['know', 'knows', 'knew', 'known', 'knowing'],
  ['think', 'thinks', 'thought', 'thinking'],
  ['buy', 'buys', 'bought', 'buying'],
  ['bring', 'brings', 'brought', 'bringing'],
  ['say', 'says', 'said', 'saying'],
  ['tell', 'tells', 'told', 'telling'],
  ['write', 'writes', 'wrote', 'written', 'writing'],
  ['speak', 'speaks', 'spoke', 'spoken', 'speaking'],
  ['drink', 'drinks', 'drank', 'drunk', 'drinking'],
  ['run', 'runs', 'ran', 'running'],
  ['begin', 'begins', 'began', 'begun', 'beginning'],
  ['read', 'reads', 'reading'],
  ['meet', 'meets', 'met', 'meeting'],
  ['leave', 'leaves', 'left', 'leaving'],
  ['feel', 'feels', 'felt', 'feeling'],
  ['find', 'finds', 'found', 'finding'],
  ['lose', 'loses', 'lost', 'losing'],
  ['sleep', 'sleeps', 'slept', 'sleeping'],
  ['understand', 'understands', 'understood', 'understanding'],
  ['don\'t', 'doesn\'t', 'didn\'t'],
  ['isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t'],
  ['haven\'t', 'hasn\'t', 'hadn\'t'],
];
const AGREEMENT_PAIRS: Array<[string, string]> = [
  ['is', 'are'], ['is', 'am'], ['am', 'are'], ['was', 'were'], ['has', 'have'], ['does', 'do'],
  ["doesn't", "don't"], ["isn't", "aren't"], ["wasn't", "weren't"], ["hasn't", "haven't"],
];

const familyOf = new Map<string, number>();
VERB_FAMILIES.forEach((forms, i) => forms.forEach((f) => familyOf.set(f, i)));
const agreementKey = (a: string, b: string) => [a, b].sort().join('|');
const AGREEMENT = new Set(AGREEMENT_PAIRS.map(([a, b]) => agreementKey(a, b)));

/** Words without capitals or punctuation (apostrophes stay: "don't") */
export function words(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** A rough root of a word, so "walked", "walking" and "walks" meet at "walk" */
export function stem(word: string): string {
  let s = word;
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (s.endsWith('ied') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (s.endsWith('ing') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2);
  else if (/(ches|shes|sses|xes|zes|oes)$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith('s') && !s.endsWith('ss') && s.length > 3) s = s.slice(0, -1);
  if (s.length > 3 && /([^aeiouls])\1$/.test(s)) s = s.slice(0, -1); // stopp -> stop, runn -> run
  if (s.endsWith('e')) s = s.slice(0, -1);
  return s;
}

export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length];
}

interface Hunk {
  removed: string[];
  added: string[];
}

/** Word-level diff: the stretches where the wrong and the corrected sentence differ */
export function diffHunks(a: string[], b: string[]): Hunk[] {
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  const flush = () => {
    if (current) hunks.push(current);
    current = null;
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      i++;
      j++;
      continue;
    }
    current ??= { removed: [], added: [] };
    if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) current.added.push(b[j++]);
    else current.removed.push(a[i++]);
  }
  flush();
  return hunks;
}

const allIn = (tokens: string[], set: Set<string>) => tokens.length > 0 && tokens.every((t) => set.has(t));

/** How two different words relate: another form of the same verb, a plural, a typo, or a different word */
function classifyPair(a: string, b: string): MistakePattern {
  const fa = familyOf.get(a);
  const fb = familyOf.get(b);
  if (fa !== undefined && fa === fb) {
    if (AGREEMENT.has(agreementKey(a, b))) return 'AGREEMENT';
    // go/goes, see/sees, take/takes: the plain form and its third-person -s form
    const [base, thirdPerson] = VERB_FAMILIES[fa];
    if (thirdPerson?.endsWith('s') && agreementKey(a, b) === agreementKey(base, thirdPerson)) return 'AGREEMENT';
    return 'TENSE';
  }

  if (stem(a) === stem(b)) {
    const tense = (w: string) => w.endsWith('ed') || w.endsWith('ing');
    return tense(a) || tense(b) ? 'TENSE' : 'AGREEMENT';
  }
  if (a.length >= 4 && b.length >= 4 && editDistance(a, b) <= 2) return 'SPELLING';
  return 'WORD_CHOICE';
}

function classifyHunk({ removed, added }: Hunk): MistakePattern {
  if (removed.length === 0) {
    if (allIn(added, ARTICLES)) return 'ARTICLE';
    if (added.every((t) => PREPOSITIONS.has(t) || ARTICLES.has(t)) && added.some((t) => PREPOSITIONS.has(t))) return 'PREPOSITION';
    if (added.some((t) => AUXILIARIES.has(t))) return 'TENSE';
    return 'MISSING_WORD';
  }
  if (added.length === 0) {
    if (allIn(removed, ARTICLES)) return 'ARTICLE';
    if (removed.every((t) => PREPOSITIONS.has(t) || ARTICLES.has(t)) && removed.some((t) => PREPOSITIONS.has(t))) return 'PREPOSITION';
    if (removed.some((t) => AUXILIARIES.has(t))) return 'TENSE';
    return 'EXTRA_WORD';
  }
  if (removed.length === added.length) {
    const kinds = removed.map((r, i) => {
      if (ARTICLES.has(r) && ARTICLES.has(added[i])) return 'ARTICLE' as const;
      if (PREPOSITIONS.has(r) && PREPOSITIONS.has(added[i])) return 'PREPOSITION' as const;
      return classifyPair(r, added[i]);
    });
    return pickByPriority(kinds);
  }
  const touched = [...removed, ...added];
  if (allIn(touched, ARTICLES)) return 'ARTICLE';
  if (touched.every((t) => PREPOSITIONS.has(t) || ARTICLES.has(t))) return 'PREPOSITION';
  return 'WORD_CHOICE';
}

/** When one correction fixes several things, report the one most worth practising */
const PRIORITY: MistakePattern[] = [
  'TENSE', 'AGREEMENT', 'PREPOSITION', 'ARTICLE', 'WORD_ORDER', 'SPELLING', 'WORD_CHOICE', 'MISSING_WORD', 'EXTRA_WORD', 'PUNCTUATION',
];
function pickByPriority(kinds: MistakePattern[]): MistakePattern {
  return PRIORITY.find((p) => kinds.includes(p)) ?? 'OTHER';
}

export function classifyCorrection(original: string, corrected: string): MistakePattern {
  const a = words(original);
  const b = words(corrected);
  if (a.join(' ') === b.join(' ')) {
    return String(original).trim() === String(corrected).trim() ? 'OTHER' : 'PUNCTUATION';
  }
  // Same words in a different order
  if (a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ')) return 'WORD_ORDER';

  const hunks = diffHunks(a, b);
  if (hunks.length === 0) return 'OTHER';
  return pickByPriority(hunks.map(classifyHunk));
}

/** The pattern to file a correction under; a person's own category wins where it says more than the words do */
export function patternFor(original: string, corrected: string, category?: string | null): MistakePattern {
  const c = String(category ?? '').toLowerCase();
  if (c === 'pronunciation') return 'PRONUNCIATION';
  if (c === 'spelling') return 'SPELLING';
  return classifyCorrection(original, corrected);
}
