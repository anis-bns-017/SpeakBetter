// server/src/pronunciation/phoneme.align.ts
// Judges each sound of what was said. The learner's device runs a phone recogniser over the recording and
// sends, for every 20 ms of audio, how sure it is of each sound (never the audio itself). This lines those
// frames up with the sounds the words should have, then looks at each sound: was it there, and if not, what
// was said in its place. Pure functions.

import type { SoundKey } from './pronunciation.data';
import { SOUNDS } from './pronunciation.data';
import { acceptedFor, comparePhones, isVowel, modelPhoneClasses, PHONE_LABEL, type ExpectedPhone } from './phonemes';

/** One 20 ms step of the recording */
export interface Frame {
  /** How sure the recogniser is that no new sound starts here (0-1) */
  blank: number;
  /** Its best guesses at the sound, as English sounds: [sounds the label stands for, probability] */
  phones: Array<{ classes: string[]; p: number }>;
}

export const MAX_FRAMES = 1500;
const MAX_GUESSES = 5;

/**
 * Reads the frames as the device sends them: a number is that many silent frames, a list is one frame as
 * [blank, label, probability, label, probability, ...]. Anything malformed is dropped. Returns null when
 * nothing usable is left.
 */
export function readFrames(raw: unknown): Frame[] | null {
  if (!Array.isArray(raw)) return null;
  const frames: Frame[] = [];
  for (const entry of raw) {
    if (frames.length >= MAX_FRAMES) break;
    if (typeof entry === 'number') {
      const count = Math.min(Math.max(0, Math.floor(entry)), MAX_FRAMES - frames.length);
      for (let i = 0; i < count; i++) frames.push({ blank: 1, phones: [] });
      continue;
    }
    if (!Array.isArray(entry)) continue;
    const blank = typeof entry[0] === 'number' && Number.isFinite(entry[0]) ? Math.min(1, Math.max(0, entry[0])) : 1;
    const phones: Frame['phones'] = [];
    for (let i = 1; i + 1 < entry.length && phones.length < MAX_GUESSES; i += 2) {
      const label = entry[i];
      const p = entry[i + 1];
      if (typeof label !== 'string' || label.length > 12 || typeof p !== 'number' || !Number.isFinite(p) || p <= 0) continue;
      const classes = modelPhoneClasses(label);
      if (classes.length) phones.push({ classes, p: Math.min(1, p) });
    }
    frames.push({ blank, phones });
  }
  return frames.some((f) => f.phones.length) ? frames : null;
}

export interface ExpectedWord {
  /** The plain word ("thursday") */
  word: string;
  /** Every way it may be said; empty when we do not know how the word sounds */
  variants: ExpectedPhone[][];
}

export type PhoneStatus = 'good' | 'close' | 'wrong' | 'missing';

export interface PhoneResult {
  /** The sound expected (see PHONE_LABEL) */
  p: string;
  /** The sound as written for learners ("iː") */
  ipa: string;
  status: PhoneStatus;
  /** What was said in its place, when it was another sound */
  heard?: string;
  heardIpa?: string;
}

export interface SoundWordResult {
  word: string;
  /** Null when we do not know how this word should sound */
  phones: PhoneResult[] | null;
  /** 0-100, null with no sounds to judge */
  score: number | null;
}

export interface SoundTip {
  /** The taught mix-up behind it, if it is one */
  sound: SoundKey | null;
  expected: string;
  heard: string | null;
  /** "th as in think" */
  expectedHint: string;
  heardHint: string | null;
  words: string[];
  tip: string;
}

export interface SoundCheck {
  /** 0-100 over every sound that could be judged */
  score: number;
  /** How many sounds were judged */
  judged: number;
  words: SoundWordResult[];
  tips: SoundTip[];
}

// ---------- lining the frames up with the expected sounds ----------

interface Node {
  kind: 'token' | 'blank' | 'filler';
  /** For a token: the sounds that count as it */
  accepted?: Set<string>;
  word: number;
  variant: number;
  index: number;
  /** Nodes this one can follow (itself is always allowed) */
  from: number[];
  /** May be the first node of the path */
  start: boolean;
}

/** A sound the recogniser gave no weight to is unlikely, not impossible */
const FLOOR = 1e-4;
/** A word we cannot model soaks up whatever was said, at a likelihood no real match would lose to */
const FILLER = 0.3;
const START = -1;

function emission(node: Node, frame: Frame): number {
  if (node.kind === 'blank') return Math.log(Math.max(frame.blank, FLOOR));
  if (node.kind === 'filler') return Math.log(Math.max(frame.blank, FILLER));
  return Math.log(Math.max(massOf(frame, node.accepted as Set<string>), FLOOR));
}

/** How much of the frame's weight is on any of these sounds */
function massOf(frame: Frame, sounds: Set<string>): number {
  let sum = 0;
  for (const guess of frame.phones) if (guess.classes.some((c) => sounds.has(c))) sum += guess.p;
  return Math.min(1, sum);
}

function buildGraph(words: ExpectedWord[]) {
  const nodes: Node[] = [];
  const add = (node: Omit<Node, 'start'>): number => {
    const from = [...new Set(node.from)];
    nodes.push({ ...node, from: from.filter((f) => f !== START), start: from.includes(START) });
    return nodes.length - 1;
  };
  // Silence before the first word
  const lead = add({ kind: 'blank', word: -1, variant: 0, index: 0, from: [START] });
  let entry: number[] = [START, lead];

  words.forEach((word, w) => {
    if (!word.variants.length) {
      const filler = add({ kind: 'filler', word: w, variant: 0, index: 0, from: entry });
      // The word may also not have been said at all
      entry = [...entry, filler];
      return;
    }
    const exits: number[] = [];
    word.variants.forEach((phones, v) => {
      // What may come right before the next sound of this variant
      let incoming = entry;
      phones.forEach((phone, i) => {
        const accepted = new Set(acceptedFor(phone));
        const previous = i > 0 ? phones[i - 1] : null;
        const previousToken = i > 0 ? nodes.length - 2 : -2;
        // The same sound twice in a row needs a gap between, or it would read as one long sound
        const from = previous && accepted.has(previous.p) ? incoming.filter((n) => n !== previousToken) : incoming;
        const token = add({ kind: 'token', accepted, word: w, variant: v, index: i, from });
        const gap = add({ kind: 'blank', word: w, variant: v, index: i, from: [token] });
        incoming = phone.optional ? [...incoming, token, gap] : [token, gap];
      });
      exits.push(...incoming);
    });
    entry = exits;
  });
  return { nodes, finals: new Set(entry.filter((n) => n !== START)) };
}

/** The most likely path through the expected sounds: for each frame, the node it belongs to. Null if none fits. */
function viterbi(frames: Frame[], nodes: Node[], finals: Set<number>): Int32Array | null {
  const T = frames.length;
  const N = nodes.length;
  if (!T || !N) return null;
  let previous = new Float64Array(N).fill(-Infinity);
  let current = new Float64Array(N).fill(-Infinity);
  const back = new Int32Array(T * N).fill(-1);

  for (let n = 0; n < N; n++) if (nodes[n].start) previous[n] = emission(nodes[n], frames[0]);
  for (let t = 1; t < T; t++) {
    const frame = frames[t];
    for (let n = 0; n < N; n++) {
      let best = previous[n];
      let from = n;
      for (const f of nodes[n].from) {
        if (previous[f] > best) {
          best = previous[f];
          from = f;
        }
      }
      if (best === -Infinity) {
        current[n] = -Infinity;
        continue;
      }
      current[n] = best + emission(nodes[n], frame);
      back[t * N + n] = from;
    }
    [previous, current] = [current, previous];
  }

  let end = -1;
  for (const n of finals) if (previous[n] > -Infinity && (end === -1 || previous[n] > previous[end])) end = n;
  if (end === -1) return null;
  const path = new Int32Array(T);
  for (let t = T - 1, n = end; t >= 0; t--) {
    path[t] = n;
    if (t > 0) n = back[t * N + n];
  }
  return path;
}

// ---------- judging each sound ----------

/** At its clearest moment the sound had at least this much weight: it was there */
const HEARD = 0.3;
/** Another sound needs this much weight to be named as what was said instead */
const OTHER = 0.25;
/** ...and this much, with next to nothing for the expected sound, to be called a mistake rather than a near miss */
const CLEARLY_OTHER = 0.5;
const BARELY_THERE = 0.1;

interface Peak {
  expected: number;
  blank: number;
  /** The strongest other sound at that moment */
  other: { classes: string[]; p: number } | null;
}

function peakOf(frames: Frame[], at: number[], accepted: Set<string>): Peak {
  let best: Peak = { expected: 0, blank: 1, other: null };
  let first = true;
  for (const t of at) {
    const frame = frames[t];
    const expected = massOf(frame, accepted);
    const others = frame.phones.filter((g) => !g.classes.some((c) => accepted.has(c)));
    const other = others.reduce<Peak['other']>((top, g) => (!top || g.p > top.p ? g : top), null);
    // The clearest moment: where the expected sound is strongest, or failing that where anything was said
    const better = first || expected > best.expected || (expected === best.expected && (other?.p ?? 0) > (best.other?.p ?? 0));
    if (better) best = { expected, blank: frame.blank, other };
    first = false;
  }
  return best;
}

const SCORE: Record<PhoneStatus, number> = { good: 1, close: 0.6, wrong: 0, missing: 0 };
const FINAL_STOPS = new Set(['t', 'd', 'k', 'p', 'g', 'b']);

/**
 * Lines the recording up with the words and judges every sound. Words whose sound we do not know are skipped
 * (phones: null). Returns null when the recording cannot be matched to the words at all, for example when it
 * is shorter than the sentence.
 */
export function checkSounds(words: ExpectedWord[], frames: Frame[]): SoundCheck | null {
  if (!words.some((w) => w.variants.length)) return null;
  const { nodes, finals } = buildGraph(words);
  const path = viterbi(frames, nodes, finals);
  if (!path) return null;

  const framesOf = new Map<number, number[]>();
  path.forEach((n, t) => {
    if (nodes[n].kind !== 'token') return;
    const list = framesOf.get(n);
    if (list) list.push(t);
    else framesOf.set(n, [t]);
  });
  // Which way of saying each word the path went through
  const chosen = new Map<number, number>();
  for (const n of framesOf.keys()) chosen.set(nodes[n].word, nodes[n].variant);

  const tips = new Map<string, SoundTip>();
  let total = 0;
  let judged = 0;

  const results: SoundWordResult[] = words.map((word, w) => {
    if (!word.variants.length) return { word: word.word, phones: null, score: null };
    const variant = chosen.get(w) ?? 0;
    const expected = word.variants[variant];
    const tokenOf = new Map<number, number>();
    nodes.forEach((node, n) => {
      if (node.kind === 'token' && node.word === w && node.variant === variant) tokenOf.set(node.index, n);
    });

    const phones: PhoneResult[] = [];
    for (let i = 0; i < expected.length; i++) {
      const phone = expected[i];
      const node = tokenOf.get(i) as number;
      const at = framesOf.get(node);
      const label = PHONE_LABEL[phone.p];
      // An optional sound the speaker left out is simply not there to judge
      if (!at) continue;
      const accepted = nodes[node].accepted as Set<string>;
      const peak = peakOf(frames, at, accepted);
      let result: PhoneResult = { p: phone.p, ipa: label.ipa, status: 'good' };

      const heardIt = peak.expected >= HEARD || (peak.expected >= 0.1 && peak.expected >= (peak.other?.p ?? 0));
      // One recogniser label can cover two sounds ("ɑːɹ" for the vowel and r of "car"), heard at either one
      const covered =
        neighbourCovers(frames, framesOf.get(tokenOf.get(i - 1) ?? -1), phone.p) ||
        neighbourCovers(frames, framesOf.get(tokenOf.get(i + 1) ?? -1), phone.p);
      if (!heardIt && !covered && !phone.optional) {
        if (peak.other && peak.other.p >= OTHER && peak.other.p > peak.expected) {
          // The label's most likely reading, unless another reading is just a matter of accent
          const readings = peak.other.classes.map((c) => ({ c, ...comparePhones(phone.p, c) }));
          const kind = readings.find((r) => r.judgement === 'same') ?? readings[0];
          if (kind.judgement !== 'same') {
            // Only a sound that clearly took the place of the expected one counts as a mistake
            const clear = peak.other.p >= CLEARLY_OTHER && peak.expected < BARELY_THERE;
            const wrong = kind.judgement === 'wrong' && clear;
            result = {
              p: phone.p,
              ipa: label.ipa,
              status: wrong ? 'wrong' : 'close',
              heard: kind.c,
              heardIpa: PHONE_LABEL[kind.c]?.ipa ?? kind.c,
            };
            if (clear) noteTip(tips, phone.p, kind.c, kind.sound, word.word, wrong);
          }
        } else if (FINAL_STOPS.has(phone.p) && i === expected.length - 1 && expected.length > 1) {
          // The last t or d of a word is often swallowed in running speech: worth a look, not a mistake
          result = { p: phone.p, ipa: label.ipa, status: 'close' };
        } else if (!(phone.p === 'ə' || (isVowel(phone.p) && peak.blank < 0.5))) {
          // Dropping a weak vowel is how fluent speakers talk ("comf'table"); anything else is a missing sound
          result = { p: phone.p, ipa: label.ipa, status: 'missing' };
          noteTip(tips, phone.p, null, null, word.word, true);
        }
      }
      phones.push(result);
    }

    if (!phones.length) return { word: word.word, phones: null, score: null };
    const sum = phones.reduce((s, p) => s + SCORE[p.status], 0);
    total += sum;
    judged += phones.length;
    return { word: word.word, phones, score: Math.round((100 * sum) / phones.length) };
  });

  if (!judged) return null;
  return {
    score: Math.round((100 * total) / judged),
    judged,
    words: results,
    tips: [...tips.values()].slice(0, 4),
  };
}

/** True when the sound next to this one was heard through a label that also stands for this one */
function neighbourCovers(frames: Frame[], at: number[] | undefined, sound: string): boolean {
  if (!at) return false;
  return at.some((t) => {
    const top = frames[t].phones.reduce<Frame['phones'][number] | null>((best, g) => (!best || g.p > best.p ? g : best), null);
    return !!top && top.p >= HEARD && top.classes.length > 1 && top.classes.includes(sound);
  });
}

function noteTip(
  tips: Map<string, SoundTip>,
  expected: string,
  heard: string | null,
  sound: SoundKey | null,
  word: string,
  mistake: boolean,
) {
  // Near misses only earn advice when they are one of the mix-ups this app teaches
  if (!mistake && !sound) return;
  const key = sound ?? `${expected}>${heard ?? ''}`;
  const existing = tips.get(key);
  if (existing) {
    if (!existing.words.includes(word) && existing.words.length < 4) existing.words.push(word);
    return;
  }
  const expectedHint = PHONE_LABEL[expected]?.hint ?? expected;
  const heardHint = heard ? (PHONE_LABEL[heard]?.hint ?? heard) : null;
  const tip = sound
    ? SOUNDS[sound].tip
    : heard
      ? `We expected the ${expectedHint}, but it sounded like the ${heardHint}. Listen to the word slowly and copy that one sound.`
      : `We did not hear the ${expectedHint}. Say the word slowly and make sure that sound is in it.`;
  tips.set(key, { sound, expected, heard, expectedHint, heardHint, words: [word], tip });
}
