import { editDistance, stem, words } from '../learning/mistakes';
import { HOMOPHONES, SOUNDS, type SoundKey } from './pronunciation.data';

export type WordStatus = 'good' | 'close' | 'missed';

export interface WordResult {
  /** The word as written in the target ("Thursday,") */
  text: string;
  /** The word without punctuation or capitals ("thursday") */
  word: string;
  status: WordStatus;
  /** What the recogniser heard in its place, if anything */
  heard: string | null;
}

export interface PronunciationIssue {
  word: string;
  heard: string | null;
  sound: SoundKey | null;
  tip: string;
}

export interface ScoredAttempt {
  score: number;
  verdict: 'great' | 'good' | 'try-again';
  /** The recognised text that matched the target best */
  heard: string;
  words: WordResult[];
  issues: PronunciationIssue[];
}

const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven',
  '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen', '14': 'fourteen',
  '15': 'fifteen', '16': 'sixteen', '17': 'seventeen', '18': 'eighteen', '19': 'nineteen', '20': 'twenty',
};

const HOMOPHONE_GROUP = new Map<string, number>();
HOMOPHONES.forEach((group, i) => group.forEach((w) => HOMOPHONE_GROUP.set(w, i)));

/** Recognisers write "2" for "two" and "Mr." for "mister"; compare the spoken forms */
const spoken = (word: string) => NUMBER_WORDS[word] ?? word;

/** How well a heard word stands for the target word: 1 the same, 0.6 nearly, 0 something else */
export function similarity(target: string, heard: string): number {
  const t = spoken(target);
  const h = spoken(heard);
  if (t === h) return 1;
  const group = HOMOPHONE_GROUP.get(t);
  if (group !== undefined && group === HOMOPHONE_GROUP.get(h)) return 1;
  // "walked" for "walk": the word was recognised, but not its ending
  if (t.length > 3 && stem(t) === stem(h)) return 0.6;
  // One letter off on a longer word is usually the recogniser guessing between close spellings
  if (t.length >= 5 && editDistance(t, h) === 1) return 0.6;
  return 0;
}

interface Alignment {
  total: number;
  /** For each target word, the heard word paired with it (or null) and their similarity */
  pairs: Array<{ heard: string | null; sim: number }>;
}

/**
 * Lines the heard words up with the target words (like a diff), so that one missing or extra word does not
 * throw off the rest. A substitution keeps the heard word next to the target, which is what the tips need.
 */
export function align(target: string[], heard: string[]): Alignment {
  const n = target.length;
  const m = heard.length;
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      score[i][j] = Math.max(score[i - 1][j], score[i][j - 1], score[i - 1][j - 1] + similarity(target[i - 1], heard[j - 1]));
    }
  }

  const pairs: Alignment['pairs'] = new Array(n);
  let i = n;
  let j = m;
  while (i > 0) {
    const sim = j > 0 ? similarity(target[i - 1], heard[j - 1]) : 0;
    // Prefer pairing a target word with the heard word at the same spot, even a wrong one
    if (j > 0 && score[i][j] === score[i - 1][j - 1] + sim && (sim > 0 || (score[i - 1][j] <= score[i - 1][j - 1] && score[i][j - 1] <= score[i - 1][j - 1]))) {
      pairs[i - 1] = { heard: heard[j - 1], sim };
      i--;
      j--;
    } else if (j > 0 && score[i][j] === score[i][j - 1]) {
      j--;
    } else {
      pairs[i - 1] = { heard: null, sim: 0 };
      i--;
    }
  }
  return { total: score[n][m], pairs };
}

/** Letter swaps that point to a sound being mixed up: think→sink is the th sound */
const SWAPS: Array<{ sound: SoundKey; from: string; to: string[] }> = [
  { sound: 'TH', from: 'th', to: ['s', 't', 'f', 'd', 'z'] },
  { sound: 'S_SH', from: 'sh', to: ['s'] },
  { sound: 'S_SH', from: 's', to: ['sh'] },
  { sound: 'V_W', from: 'v', to: ['w', 'wh'] },
  { sound: 'V_W', from: 'w', to: ['v'] },
  { sound: 'V_B', from: 'v', to: ['b'] },
  { sound: 'V_B', from: 'b', to: ['v'] },
  { sound: 'R_L', from: 'r', to: ['l'] },
  { sound: 'R_L', from: 'l', to: ['r'] },
  { sound: 'I_EE', from: 'i', to: ['ee', 'ea'] },
  { sound: 'I_EE', from: 'ee', to: ['i'] },
  { sound: 'I_EE', from: 'ea', to: ['i'] },
  { sound: 'A_E', from: 'a', to: ['e', 'ea'] },
  { sound: 'A_E', from: 'e', to: ['a'] },
  { sound: 'Z_S', from: 'z', to: ['s', 'ss'] },
  { sound: 'Z_S', from: 's', to: ['z'] },
  { sound: 'F_P', from: 'f', to: ['p'] },
  { sound: 'F_P', from: 'p', to: ['f'] },
  { sound: 'U_OO', from: 'u', to: ['oo'] },
  { sound: 'U_OO', from: 'oo', to: ['u'] },
];

const PAIR_SOUND = new Map<string, SoundKey>();
for (const set of Object.values(SOUNDS)) {
  for (const [a, b] of set.pairs) {
    PAIR_SOUND.set(`${a}|${b}`, set.key);
    PAIR_SOUND.set(`${b}|${a}`, set.key);
  }
}

/** Which sound was probably mixed up when `target` was heard as `heard`, or null when it is not clear */
export function soundConfusion(target: string, heard: string): SoundKey | null {
  const known = PAIR_SOUND.get(`${target}|${heard}`);
  if (known) return known;
  const before = editDistance(target, heard);
  let best: { sound: SoundKey; distance: number } | null = null;
  for (const swap of SWAPS) {
    let at = target.indexOf(swap.from);
    while (at !== -1) {
      for (const to of swap.to) {
        const changed = target.slice(0, at) + to + target.slice(at + swap.from.length);
        const distance = editDistance(changed, heard);
        // The swap has to explain most of the difference, not just nudge it
        if (distance < before && distance <= 1 && (!best || distance < best.distance)) best = { sound: swap.sound, distance };
      }
      at = target.indexOf(swap.from, at + 1);
    }
  }
  return best?.sound ?? null;
}

const MISSING_TIP = 'We did not hear this word. Say every word, including the small ones, and do not rush the end.';
const UNCLEAR_TIP = 'This sounded like a different word. Listen to it slowly, then say it again, one sound at a time.';
const ENDING_TIP = 'The ending was not clear. Finish the word fully (for example the -s, -ed or -ing).';

export interface Pace {
  wordsPerMinute: number;
  verdict: 'slow' | 'natural' | 'fast';
  tip: string;
}

/** Comfortable, clear speech for a learner sits roughly between these (words per minute) */
const PACE_SLOW = 80;
const PACE_FAST = 170;

/**
 * How fast a sentence was said. Needs a few words and a real duration, otherwise it says nothing:
 * the pace of one word means little.
 */
export function paceOf(wordCount: number, durationMs: number | null | undefined): Pace | null {
  if (wordCount < 4 || typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 1000) return null;
  const wordsPerMinute = Math.round(wordCount / (durationMs / 60_000));
  if (wordsPerMinute < PACE_SLOW) {
    return { wordsPerMinute, verdict: 'slow', tip: 'A little slow. Try linking the words together instead of saying them one by one.' };
  }
  if (wordsPerMinute > PACE_FAST) {
    return { wordsPerMinute, verdict: 'fast', tip: 'Quite fast. Slow down a little so every word comes through clearly.' };
  }
  return { wordsPerMinute, verdict: 'natural', tip: 'A natural, easy pace.' };
}

/** Words of the target, keeping how they were written, paired with their plain form */
function targetWords(target: string) {
  return target
    .split(/\s+/)
    .map((text) => ({ text, word: words(text).join('') }))
    .filter((t) => t.word);
}

/**
 * Scores one attempt at saying `target`. `alternatives` are the recogniser's guesses, best first; the one
 * that matches the target best is used, since the first guess is not always the one you meant.
 * `confidence` (0–1) from the recogniser lowers the score a little when it was unsure.
 */
export function scoreAttempt(target: string, alternatives: string[], confidence?: number | null): ScoredAttempt {
  const expected = targetWords(target);
  const targetPlain = expected.map((t) => t.word);
  const options = alternatives.filter((a) => typeof a === 'string' && a.trim()).slice(0, 5);

  let best: { alignment: Alignment; text: string; index: number } | null = null;
  options.forEach((text, index) => {
    const alignment = align(targetPlain, words(text));
    if (!best || alignment.total > best.alignment.total) best = { alignment, text, index };
  });

  const chosen = best as { alignment: Alignment; text: string; index: number } | null;
  const results: WordResult[] = expected.map((t, i) => {
    const pair = chosen?.alignment.pairs[i] ?? { heard: null, sim: 0 };
    const status: WordStatus = pair.sim >= 1 ? 'good' : pair.sim > 0 ? 'close' : 'missed';
    return { text: t.text, word: t.word, status, heard: status === 'good' ? null : pair.heard };
  });

  let score = expected.length ? (100 * (chosen?.alignment.total ?? 0)) / expected.length : 0;
  // Only the first guess comes with the recogniser's confidence
  if (chosen?.index === 0 && typeof confidence === 'number' && confidence > 0 && confidence <= 1) {
    score *= 0.85 + 0.15 * confidence;
  }
  score = Math.round(Math.max(0, Math.min(100, score)));

  const issues: PronunciationIssue[] = [];
  for (const r of results) {
    if (r.status === 'good') continue;
    const sound = r.heard ? soundConfusion(r.word, r.heard) : null;
    const tip = sound
      ? SOUNDS[sound].tip
      : !r.heard
        ? MISSING_TIP
        : r.status === 'close'
          ? ENDING_TIP
          : UNCLEAR_TIP;
    issues.push({ word: r.word, heard: r.heard, sound, tip });
  }

  return {
    score,
    verdict: score >= 90 ? 'great' : score >= 70 ? 'good' : 'try-again',
    heard: chosen?.text ?? '',
    words: results,
    issues,
  };
}
