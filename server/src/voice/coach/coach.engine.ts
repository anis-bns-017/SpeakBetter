// server/src/voice/coach/coach.engine.ts
// Pure logic behind the room coach: fluency analysis, mission matching, airtime balance.
// No I/O here, so every rule can be unit-tested.

import {
  CEFR_LEVELS,
  MISSION_WORDS,
  TOPIC_CARDS,
  type CefrLevel,
  type MissionWord,
  type TopicCard,
} from './coach.data';

export type Rng = () => number;

// ------------------------------------------------------------------
// Tokens
// ------------------------------------------------------------------

/** Lowercase words, without punctuation (apostrophes stay: "don't") */
export function tokenize(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

// ------------------------------------------------------------------
// Fluency
// ------------------------------------------------------------------

const SOUND_FILLERS = new Set(['um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'hmm', 'hm', 'ah']);
const WORD_FILLERS = new Set(['basically', 'literally']);
const NONE = new Set<string>();
const PHRASE_FILLERS: Record<string, { notAfter: Set<string>; notBefore: Set<string> }> = {
  'you know': {
    notAfter: new Set(['do', 'did', "don't", 'if', 'as', 'how', 'what', 'that', 'can', 'could', 'will', 'would', 'whether', 'if']),
    notBefore: new Set(['how', 'what', 'where', 'who', 'when', 'why', 'if', 'that', 'the', 'a', 'an', 'this', 'my', 'your', 'her', 'his', 'better', 'best']),
  },
  'i mean': {
    notAfter: new Set(['what', 'that', 'which', 'do', 'did', 'you', 'if', 'as']),
    notBefore: new Set(['what', 'every', 'both']),
  },
  'or something': { notAfter: NONE, notBefore: NONE },
  'and stuff': { notAfter: NONE, notBefore: NONE },
};

/** "like" is only a filler when it isn't a verb, a comparison or part of "looks like..." */
const LIKE_OK_BEFORE = new Set([
  'i', 'you', 'we', 'they', 'he', 'she', 'it', 'do', "don't", 'does', "doesn't", 'did', "didn't",
  'would', "wouldn't", 'really', 'also', 'just', 'to', 'what', 'look', 'looks', 'looked', 'feel',
  'feels', 'felt', 'sound', 'sounds', 'seem', 'seems', 'taste', 'tastes', 'smell', 'smells',
  'something', 'anything', 'nothing', 'someone', 'people', 'who', 'much', 'more', 'most', "i'd",
  "i'll", "we'd", "they'd",
]);
const LIKE_OK_AFTER = new Set([
  'to', 'a', 'an', 'the', 'this', 'that', 'these', 'those', 'it', 'my', 'your', 'his', 'her', 'our',
  'their', 'me', 'him', 'them', 'us', 'you', 'what', 'how', 'when', 'some', 'many', 'one',
]);

/** Repeating these back to back is normal English, not a stumble */
const NATURAL_REPEATS = new Set(['very', 'really', 'so', 'no', 'yes', 'bye', 'ha', 'haha', 'hello', 'hi', 'many', 'more', 'far', 'long']);

export interface UtteranceAnalysis {
  words: number;
  fillers: Record<string, number>;
  fillerCount: number;
  /** Words said twice in a row ("I I think") */
  repeats: number;
  tokens: string[];
}

export function analyzeUtterance(text: string): UtteranceAnalysis {
  const tokens = tokenize(text);
  const fillers: Record<string, number> = {};
  const bump = (key: string) => {
    fillers[key] = (fillers[key] ?? 0) + 1;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (SOUND_FILLERS.has(t) || WORD_FILLERS.has(t)) {
      bump(t);
    } else if (t === 'like') {
      const prev = tokens[i - 1];
      const next = tokens[i + 1];
      if (!(prev && LIKE_OK_BEFORE.has(prev)) && !(next && LIKE_OK_AFTER.has(next))) bump('like');
    }
  }

  for (const [phrase, rule] of Object.entries(PHRASE_FILLERS)) {
    const parts = phrase.split(' ');
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      if (!parts.every((p, j) => tokens[i + j] === p)) continue;
      const prev = tokens[i - 1];
      const next = tokens[i + parts.length];
      // "do you know the way?" and "what I mean is" are real questions/statements, not fillers
      if ((prev && rule.notAfter.has(prev)) || (next && rule.notBefore.has(next))) continue;
      bump(phrase);
    }
  }

  let repeats = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1] && !NATURAL_REPEATS.has(tokens[i]) && !/^\d+$/.test(tokens[i])) {
      repeats++;
    }
  }

  const fillerCount = Object.values(fillers).reduce((a, b) => a + b, 0);
  return { words: tokens.length, fillers, fillerCount, repeats, tokens };
}

export interface FluencySnapshot {
  utterances: number;
  words: number;
  uniqueWords: number;
  fillerCount: number;
  fillersPer100: number;
  topFillers: { word: string; count: number }[];
  repeats: number;
  /** Longer words (8+ letters) the speaker used, most recent first */
  richWords: string[];
  avgUtteranceWords: number;
  /** Words per minute of speaking; null until there is enough speech to be meaningful */
  wpm: number | null;
  pace: 'slow' | 'steady' | 'fast' | null;
  scores: { pace: number | null; smoothness: number | null; variety: number | null };
  /** 0–100 average of the scores that are available; null while there is too little speech */
  fluency: number | null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Comfortable pace for learners; native speakers are usually faster */
export const PACE_BAND = { min: 100, max: 150 } as const;
const MIN_WORDS_FOR_SCORES = 25;
const MIN_SECONDS_FOR_WPM = 15;
const MAX_TRACKED_VOCAB = 2000;
const VARIETY_WINDOW = 50;

export class FluencyTracker {
  private utterances = 0;
  private words = 0;
  private fillerCount = 0;
  private repeats = 0;
  private fillers: Record<string, number> = {};
  private vocab = new Set<string>();
  private rich: string[] = [];
  /** The most recent words, for the variety score */
  private recent: string[] = [];

  add(text: string): UtteranceAnalysis {
    const a = analyzeUtterance(text);
    if (a.words === 0) return a;

    this.utterances++;
    this.words += a.words;
    this.fillerCount += a.fillerCount;
    this.repeats += a.repeats;
    for (const [k, v] of Object.entries(a.fillers)) this.fillers[k] = (this.fillers[k] ?? 0) + v;

    this.recent.push(...a.tokens);
    if (this.recent.length > VARIETY_WINDOW) this.recent.splice(0, this.recent.length - VARIETY_WINDOW);

    for (const t of a.tokens) {
      if (this.vocab.size < MAX_TRACKED_VOCAB) this.vocab.add(t);
      if (t.length >= 8 && /^\p{L}+$/u.test(t) && !this.rich.includes(t)) {
        this.rich.unshift(t);
        if (this.rich.length > 12) this.rich.pop();
      }
    }
    return a;
  }

  snapshot(speakingSeconds: number): FluencySnapshot {
    const words = this.words;
    const fillersPer100 = words > 0 ? round1((this.fillerCount / words) * 100) : 0;
    const topFillers = Object.entries(this.fillers)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([word, count]) => ({ word, count }));

    const enoughSpeech = words >= MIN_WORDS_FOR_SCORES;
    const wpm =
      speakingSeconds >= MIN_SECONDS_FOR_WPM && words >= 20
        ? Math.round(words / (speakingSeconds / 60))
        : null;

    const pace = wpm === null ? null : wpm < PACE_BAND.min ? 'slow' : wpm > PACE_BAND.max ? 'fast' : 'steady';

    const paceScore =
      wpm === null
        ? null
        : Math.round(
            clamp(
              wpm < PACE_BAND.min
                ? 100 - (PACE_BAND.min - wpm) * 1.5
                : wpm > PACE_BAND.max
                  ? 100 - (wpm - PACE_BAND.max) * 1.5
                  : 100,
              20,
              100,
            ),
          );

    const smoothness = enoughSpeech
      ? Math.round(clamp(100 - ((this.fillerCount + this.repeats) / words) * 100 * 8, 10, 100))
      : null;

    // Share of distinct words in the last 50 (a moving window, so the score doesn't depend on
    // how long someone has talked): ~0.5 means lots of repeats, 0.85+ is very varied
    const variety =
      enoughSpeech && this.recent.length >= 20
        ? Math.round(clamp(((new Set(this.recent).size / this.recent.length - 0.5) / 0.35) * 100, 5, 100))
        : null;

    const available = [paceScore, smoothness, variety].filter((s): s is number => s !== null);
    const fluency = enoughSpeech && available.length
      ? Math.round(available.reduce((a, b) => a + b, 0) / available.length)
      : null;

    return {
      utterances: this.utterances,
      words,
      uniqueWords: this.vocab.size,
      fillerCount: this.fillerCount,
      fillersPer100,
      topFillers,
      repeats: this.repeats,
      richWords: [...this.rich],
      avgUtteranceWords: this.utterances ? round1(words / this.utterances) : 0,
      wpm,
      pace,
      scores: { pace: paceScore, smoothness, variety },
      fluency,
    };
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface CoachTip {
  kind: 'filler' | 'restart' | 'pace-fast' | 'pace-slow' | 'variety' | 'praise';
  text: string;
}

/** One gentle, specific suggestion based on how the person is doing so far; null when there is nothing useful to say */
export function coachTip(s: FluencySnapshot): CoachTip | null {
  if (s.words < MIN_WORDS_FOR_SCORES) return null;

  const top = s.topFillers[0];
  if (top && s.fillersPer100 >= 6) {
    return {
      kind: 'filler',
      text: `You said "${top.word}" ${top.count} time${top.count === 1 ? '' : 's'}. Try a quiet pause instead — silence sounds confident.`,
    };
  }
  if (s.repeats >= 3 && ((s.repeats / s.words) * 100) >= 3) {
    return {
      kind: 'restart',
      text: 'You restart words a lot ("I I think"). Plan the first few words, then let the sentence flow.',
    };
  }
  if (s.pace === 'fast' && s.wpm !== null) {
    return {
      kind: 'pace-fast',
      text: `You are speaking fast (${s.wpm} words/min). Slow down a little so everyone can follow you.`,
    };
  }
  if (s.pace === 'slow' && s.wpm !== null && s.wpm < 80) {
    return {
      kind: 'pace-slow',
      text: `Your pace is careful (${s.wpm} words/min). Try linking ideas with "because", "so" and "but" to keep the flow.`,
    };
  }
  if (s.scores.variety !== null && s.scores.variety < 40) {
    return {
      kind: 'variety',
      text: 'You are repeating the same words. Try one new word or a synonym in your next answer.',
    };
  }
  if (s.fluency !== null && s.fluency >= 75) {
    return { kind: 'praise', text: 'Smooth and clear — keep going!' };
  }
  return null;
}

// ------------------------------------------------------------------
// Missions
// ------------------------------------------------------------------

/** Every spoken form that counts as using the word */
export function buildForms(entry: MissionWord): string[] {
  const base = entry.word.toLowerCase().trim();
  const forms = new Set<string>([base, ...(entry.forms ?? []).map((f) => f.toLowerCase())]);

  // Inflections are only generated for single words; phrases list their variants explicitly
  if (!base.includes(' ')) {
    forms.add(`${base}s`);
    forms.add(`${base}es`);
    if (base.endsWith('e')) {
      forms.add(`${base}d`);
      forms.add(`${base.slice(0, -1)}ing`);
    } else if (base.endsWith('y') && base.length > 3) {
      forms.add(`${base.slice(0, -1)}ies`);
      forms.add(`${base.slice(0, -1)}ied`);
      forms.add(`${base}ing`);
    } else {
      forms.add(`${base}ed`);
      forms.add(`${base}ing`);
    }
    forms.add(`${base}ly`);
  }
  return [...forms];
}

/** True when the sentence uses the mission word (any form, or the whole phrase) */
export function matchesMissionWord(entry: MissionWord, text: string): boolean {
  const tokens = tokenize(text);
  if (tokens.length === 0) return false;
  const joined = ` ${tokens.join(' ')} `;
  const tokenSet = new Set(tokens);
  return buildForms(entry).some((form) =>
    form.includes(' ') ? joined.includes(` ${form} `) : tokenSet.has(form),
  );
}

export function normalizeLevel(level: unknown): CefrLevel {
  const l = String(level ?? '').toUpperCase();
  if (l === 'C2') return 'C1';
  return (CEFR_LEVELS as string[]).includes(l) ? (l as CefrLevel) : 'B1';
}

/** A word at the level that nobody in the round has yet (falls back to repeats if the pool runs out) */
export function pickMissionWord(
  level: CefrLevel,
  taken: Set<string>,
  rng: Rng = Math.random,
): MissionWord {
  const pool = MISSION_WORDS.filter((w) => w.level === level);
  const fresh = pool.filter((w) => !taken.has(w.word));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(rng() * from.length)];
}

/** Points for a finished mission: base for the level plus a bonus for the first three finishers */
export function missionPoints(base: number, finishPlace: number, bonuses: readonly number[]): number {
  return base + (bonuses[finishPlace] ?? 0);
}

// ------------------------------------------------------------------
// Airtime
// ------------------------------------------------------------------

export interface AirtimeEntry {
  userId: string;
  name: string;
  seconds: number;
  /** 0–1 share of all speaking time in the room */
  share: number;
}

export interface AirtimeSnapshot {
  entries: AirtimeEntry[];
  totalSeconds: number;
  /** 0–100, 100 = everyone speaks equally; null until there is enough talk to judge */
  balance: number | null;
  /** People who have spoken far less than their fair share */
  quiet: string[];
}

const MIN_SECONDS_FOR_BALANCE = 60;

export function buildAirtime(
  people: { userId: string; name: string }[],
  secondsByUser: Record<string, number>,
): AirtimeSnapshot {
  const totalSeconds = people.reduce((sum, p) => sum + (secondsByUser[p.userId] ?? 0), 0);
  const entries: AirtimeEntry[] = people
    .map((p) => {
      const seconds = secondsByUser[p.userId] ?? 0;
      return { userId: p.userId, name: p.name, seconds, share: totalSeconds > 0 ? seconds / totalSeconds : 0 };
    })
    .sort((a, b) => b.seconds - a.seconds);

  const n = people.length;
  if (n < 2 || totalSeconds < MIN_SECONDS_FOR_BALANCE) {
    return { entries, totalSeconds, balance: null, quiet: [] };
  }

  // Normalised entropy of the shares: 1 when everyone talks equally, towards 0 when one person talks
  const entropy = -entries.reduce((sum, e) => (e.share > 0 ? sum + e.share * Math.log(e.share) : sum), 0);
  const balance = Math.round((entropy / Math.log(n)) * 100);

  const quiet = entries.filter((e) => e.share < 0.5 / n).map((e) => e.userId);
  return { entries, totalSeconds, balance, quiet };
}

/** The person who has had the least airtime (ties are broken randomly) */
export function pickQuietest(snapshot: AirtimeSnapshot, rng: Rng = Math.random): AirtimeEntry | null {
  if (!snapshot.entries.length) return null;
  const min = Math.min(...snapshot.entries.map((e) => e.seconds));
  const ties = snapshot.entries.filter((e) => e.seconds === min);
  return ties[Math.floor(rng() * ties.length)];
}

// ------------------------------------------------------------------
// Topic cards
// ------------------------------------------------------------------

export function pickTopicCard(
  opts: { level?: CefrLevel | null; category?: TopicCard['category'] | null; exclude?: Set<string> },
  rng: Rng = Math.random,
): TopicCard {
  const { level, category, exclude } = opts;
  const matching = (strict: boolean) =>
    TOPIC_CARDS.filter(
      (c) =>
        (!level || c.level === level) &&
        (!category || c.category === category) &&
        (!strict || !exclude?.has(c.id)),
    );
  // Prefer unseen cards; relax step by step so a host always gets something
  const pool = matching(true).length
    ? matching(true)
    : matching(false).length
      ? matching(false)
      : TOPIC_CARDS.filter((c) => !level || c.level === level).length
        ? TOPIC_CARDS.filter((c) => !level || c.level === level)
        : TOPIC_CARDS;
  return pool[Math.floor(rng() * pool.length)];
}

// ------------------------------------------------------------------
// Saved words (spaced repetition)
// ------------------------------------------------------------------

/** Days until a word comes back, by Leitner box */
export const REVIEW_INTERVAL_DAYS = [1, 2, 4, 8, 16, 32] as const;
export const MAX_SAVED_WORDS = 500;

/** Knowing a word moves it up a box; forgetting sends it back to the start */
export function nextBox(box: number, knew: boolean): number {
  return knew ? Math.min(Math.max(box, 0) + 1, REVIEW_INTERVAL_DAYS.length - 1) : 0;
}

export function dueAfter(box: number, from: Date = new Date()): Date {
  const days = REVIEW_INTERVAL_DAYS[Math.min(Math.max(box, 0), REVIEW_INTERVAL_DAYS.length - 1)];
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** A tapped caption word as stored: lowercase letters, apostrophes and hyphens, 2–40 characters; null if it isn't a word */
export function normalizeSavedWord(raw: unknown): string | null {
  const w = String(raw ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .trim()
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
  return w.length >= 2 && w.length <= 40 && /^\p{L}[\p{L}'-]*$/u.test(w) ? w : null;
}

export function cleanNote(raw: unknown, max: number): string | null {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  return s || null;
}
