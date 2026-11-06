/**
 * Turns grammar-checker findings into issues a learner can act on, scores a piece of writing, and picks the
 * mistakes worth turning into review cards. Pure functions: the checker itself lives in language-tool.client.ts.
 */

import { classifyCorrection, type MistakePattern } from '../learning/mistakes';

/** The parts of a LanguageTool match this app uses */
export interface CheckerMatch {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements: Array<{ value: string }>;
  rule: { id: string; issueType?: string; category?: { id?: string; name?: string } };
}

export type IssueKind = 'grammar' | 'spelling' | 'punctuation' | 'style';
export type SpellingVariant = 'en-GB' | 'en-US';
export const VARIANTS: SpellingVariant[] = ['en-GB', 'en-US'];

export interface WritingIssue {
  id: string;
  offset: number;
  length: number;
  /** The words the issue is about */
  text: string;
  message: string;
  short: string | null;
  replacements: string[];
  kind: IssueKind;
  pattern: MistakePattern;
  ruleId: string;
}

const CASING = /UPPERCASE|LOWERCASE|CASING|CAPITALI/;
const PUNCT_RULE = /COMMA|PUNCTUATION|APOS|SENTENCE_END|PERIOD|QUESTION_MARK|WHITESPACE|DOUBLE_SPACE|HYPHEN/;

/** What kind of problem a match is, as the learner sees it */
export function kindOf(match: CheckerMatch): IssueKind {
  const id = match.rule.id.toUpperCase();
  const type = (match.rule.issueType ?? '').toLowerCase();
  const category = (match.rule.category?.id ?? '').toUpperCase();
  if (CASING.test(id) || PUNCT_RULE.test(id) || ['PUNCTUATION', 'CASING', 'TYPOGRAPHY'].includes(category) || type === 'whitespace') {
    return 'punctuation';
  }
  if (/MORFOLOGIK|SPELL/.test(id) || category === 'TYPOS' || type === 'locale-violation') return 'spelling';
  if (type === 'style' || ['STYLE', 'REDUNDANCY', 'PLAIN_ENGLISH', 'COLLOCATIONS'].includes(category)) return 'style';
  return 'grammar';
}

/** Which "mistakes you repeat" group it belongs to, from the rule first and the words second */
export function patternOf(match: CheckerMatch, kind: IssueKind, before: string, after: string, word = ''): MistakePattern {
  const id = match.rule.id.toUpperCase();
  const category = (match.rule.category?.id ?? '').toUpperCase();
  if (kind === 'punctuation') return 'PUNCTUATION';
  if (/A_VS_AN|ARTICLE|MISSING_THE|THE_SUPERLATIVE/.test(id)) return 'ARTICLE';
  if (/AGREEMENT|_AGR\b|_AGR_|NON3PRS|SVA|SINGULAR|PLURAL/.test(id)) return 'AGREEMENT';
  if (/PREPOSITION|PREP_/.test(id)) return 'PREPOSITION';
  if (/WORD_ORDER|_ORDER\b/.test(id)) return 'WORD_ORDER';
  if (/DUPLICATION|REPEAT|REDUNDAN/.test(id) || category === 'REDUNDANCY') return 'EXTRA_WORD';
  if (/MISSING/.test(id)) return 'MISSING_WORD';
  if (/TENSE|PAST|PARTICIPLE|_VB[DGNZ]?\b|BEEN_|HAVE_PART|GERUND|INFINITIVE|BASEFORM|BASE_FORM|MODAL|VERB_FORM/.test(id)) return 'TENSE';
  // "buyed" -> "bought", "teached" -> "taught": an irregular verb made regular is a verb-form mistake
  const fix = match.replacements[0]?.value ?? '';
  if (kind === 'spelling' && /[a-z]ed$/i.test(word) && fix && !/ed$/i.test(fix) && !fix.includes(' ')) return 'TENSE';
  // Then let the word-by-word classifier have a go
  const guess = before && after ? classifyCorrection(before, after) : 'OTHER';
  if (kind === 'spelling') return guess === 'TENSE' || guess === 'AGREEMENT' ? guess : 'SPELLING';
  // A grammar rule fired, so a small change of letters is a different form of the word, not a typo
  if (guess === 'SPELLING') return /VERB|BASE|FORM/.test(id) ? 'TENSE' : 'WORD_CHOICE';
  if (guess !== 'OTHER') return guess;
  if (kind === 'style' || ['CONFUSED_WORDS', 'COLLOCATIONS', 'SEMANTICS'].includes(category)) return 'WORD_CHOICE';
  return 'OTHER';
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** The sentence around a position: [start, end) */
export function sentenceBounds(text: string, offset: number, length: number): [number, number] {
  let start = offset;
  while (start > 0 && !/[.!?\n]/.test(text[start - 1])) start--;
  let end = offset + length;
  while (end < text.length && !/[.!?\n]/.test(text[end])) end++;
  if (end < text.length && /[.!?]/.test(text[end])) end++;
  while (start < offset && /\s/.test(text[start])) start++;
  return [start, end];
}

/** The sentence with the checker's first suggestion applied, for review cards */
export function fixInSentence(text: string, issue: Pick<WritingIssue, 'offset' | 'length' | 'replacements'>) {
  const [start, end] = sentenceBounds(text, issue.offset, issue.length);
  const original = text.slice(start, end).trim();
  const fix = issue.replacements[0];
  if (fix === undefined) return { original, corrected: original };
  const corrected = (text.slice(start, issue.offset) + fix + text.slice(issue.offset + issue.length, end)).trim();
  return { original, corrected };
}

/**
 * Irregular past forms learners often make regular ("goed", "forgetted"). The checker sees these as spelling
 * mistakes and its first guess can be far off ("forgetted" -> "forested"), so the right verb goes first.
 */
export const IRREGULAR_PAST: Record<string, string> = {
  arised: 'arose', becomed: 'became', beginned: 'began', bended: 'bent', bited: 'bit', bleeded: 'bled', blowed: 'blew',
  breaked: 'broke', bringed: 'brought', builded: 'built', buyed: 'bought', catched: 'caught', choosed: 'chose',
  comed: 'came', costed: 'cost', cutted: 'cut', digged: 'dug', drawed: 'drew', drinked: 'drank', drived: 'drove',
  eated: 'ate', falled: 'fell', feeded: 'fed', feeled: 'felt', fighted: 'fought', finded: 'found', flied: 'flew',
  forbidded: 'forbade', forgetted: 'forgot', forgived: 'forgave', freezed: 'froze', getted: 'got', gived: 'gave',
  goed: 'went', growed: 'grew', hanged: 'hung', haved: 'had', heared: 'heard', hided: 'hid', hitted: 'hit',
  holded: 'held', hurted: 'hurt', keeped: 'kept', knowed: 'knew', layed: 'laid', leaded: 'led', leaved: 'left',
  lended: 'lent', letted: 'let', losed: 'lost', maked: 'made', meaned: 'meant', meeted: 'met', payed: 'paid',
  putted: 'put', quitted: 'quit', readed: 'read', rided: 'rode', ringed: 'rang', rised: 'rose', runned: 'ran',
  sayed: 'said', seeked: 'sought', selled: 'sold', sended: 'sent', setted: 'set', shaked: 'shook',
  shined: 'shone', shooted: 'shot', shutted: 'shut', singed: 'sang', sinked: 'sank', sitted: 'sat', sleeped: 'slept',
  speaked: 'spoke', spended: 'spent', standed: 'stood', stealed: 'stole', sticked: 'stuck', striked: 'struck',
  swimmed: 'swam', taked: 'took', teached: 'taught', teared: 'tore', telled: 'told', thinked: 'thought',
  throwed: 'threw', understanded: 'understood', waked: 'woke', weared: 'wore', winned: 'won', writed: 'wrote',
};

const matchCase = (word: string, form: string) => (word[0] === word[0]?.toUpperCase() ? form[0].toUpperCase() + form.slice(1) : form);

/** Matches to issues; drops typographic niggles (curly quotes, dashes) that would only distract a learner */
export function toIssues(text: string, matches: CheckerMatch[]): WritingIssue[] {
  const issues: WritingIssue[] = [];
  for (const m of matches) {
    if ((m.rule.issueType ?? '').toLowerCase() === 'typographical') continue;
    if (m.offset < 0 || m.offset + m.length > text.length) continue;
    const kind = kindOf(m);
    const word = text.slice(m.offset, m.offset + m.length);
    let replacements = m.replacements.map((r) => r.value).filter((v) => v !== undefined);
    let message = m.message;
    const past = kind === 'spelling' ? IRREGULAR_PAST[word.toLowerCase()] : undefined;
    if (past) {
      const form = matchCase(word, past);
      replacements = [form, ...replacements.filter((r) => r.toLowerCase() !== past)];
      message = `“${word.toLowerCase()}” is not a word. This verb is irregular: its past form is “${past}”.`;
    }
    replacements = replacements.slice(0, 4);
    const { original, corrected } = fixInSentence(text, { offset: m.offset, length: m.length, replacements });
    issues.push({
      id: `${m.offset}-${m.rule.id}`,
      offset: m.offset,
      length: m.length,
      text: word,
      message,
      short: m.shortMessage || null,
      replacements,
      kind: past ? 'grammar' : kind,
      pattern: past ? 'TENSE' : patternOf(m, kind, original, corrected, word),
      ruleId: m.rule.id,
    });
  }
  return issues.sort((a, b) => a.offset - b.offset);
}

const WEIGHT: Record<IssueKind, number> = { grammar: 1, spelling: 0.8, punctuation: 0.5, style: 0.3 };

/** 0-100: fewer, smaller problems per 100 words is better. Null when there is too little to judge. */
export function scoreWriting(issues: Pick<WritingIssue, 'kind'>[], words: number): number | null {
  if (words < 10) return null;
  const weighted = issues.reduce((sum, i) => sum + WEIGHT[i.kind], 0);
  const per100 = (weighted / words) * 100;
  return Math.max(0, Math.min(100, Math.round(100 - per100 * 7)));
}

export function countByKind(issues: Pick<WritingIssue, 'kind'>[]): Record<IssueKind, number> {
  const counts: Record<IssueKind, number> = { grammar: 0, spelling: 0, punctuation: 0, style: 0 };
  for (const i of issues) counts[i.kind]++;
  return counts;
}

/**
 * The learner's own mistakes worth reviewing: grammar first, then spelling, at most `max`, one per sentence,
 * only where the checker knows the fix. Style hints are left out: they are advice, not mistakes.
 */
export function reviewCandidates(text: string, issues: WritingIssue[], max = 5) {
  const order: IssueKind[] = ['grammar', 'spelling', 'punctuation'];
  const seen = new Set<string>();
  const out: Array<{ key: string; original: string; corrected: string; pattern: MistakePattern; note: string }> = [];
  for (const kind of order) {
    for (const issue of issues.filter((i) => i.kind === kind && i.replacements.length)) {
      if (out.length >= max) return out;
      const { original, corrected } = fixInSentence(text, issue);
      if (!original || original === corrected || seen.has(original)) continue;
      seen.add(original);
      out.push({ key: `${issue.offset}-${issue.ruleId}`, original, corrected, pattern: issue.pattern, note: issue.message });
    }
  }
  return out;
}
