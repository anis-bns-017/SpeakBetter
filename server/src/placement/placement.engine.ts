// server/src/placement/placement.engine.ts
// Pure logic of the placement test: adaptive question choice and level estimation.
// No I/O here, so every rule can be unit-tested.
//
// Each answer feeds a small one-parameter item-response model: the chance of a correct answer rises
// with (ability − question level), with a 25% floor for guessing among four options. The ability
// estimate is the most likely value given every answer (a gentle prior keeps a lucky streak from
// jumping straight to C2). The next question is the unseen one closest to that estimate.

import { FluencyTracker } from '../voice/coach/coach.engine';
import { PLACEMENT_BANK, SKILLS, type PlacementItem, type PlacementSkill } from './placement.bank';

export const CEFR_CODES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrCode = (typeof CEFR_CODES)[number];

export const QUESTION_COUNT = 16;

const GUESS = 0.25;
const SLOPE = 1.3;
/** Weak pull toward B1 so a handful of answers can't produce an extreme estimate */
const PRIOR = { mean: 2, sd: 2 };
const GRID_MIN = -1;
const GRID_MAX = 6;
const GRID_STEP = 0.05;
/** A learner "is" level k when they handle level-k questions about 3 times out of 4 */
const MASTERY_OFFSET = 0.5;

export interface AnswerRecord {
  itemId: string;
  skill: PlacementSkill;
  level: number;
  correct: boolean;
  ms?: number;
}

export type Rng = () => number;

// ------------------------------------------------------------------
// Seeded randomness (so a question's option order is stable for one attempt)
// ------------------------------------------------------------------

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRng(seed: string): Rng {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** order[i] = index (in the bank's option list) of the option shown at position i */
export function optionOrder(attemptId: string, itemId: string, count = 4): number[] {
  const rng = seededRng(`${attemptId}:${itemId}`);
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// ------------------------------------------------------------------
// Ability estimate
// ------------------------------------------------------------------

const pCorrect = (theta: number, level: number) =>
  GUESS + (1 - GUESS) / (1 + Math.exp(-SLOPE * (theta - level)));

export interface AbilityEstimate {
  theta: number;
  /** Posterior spread: smaller means more certain */
  sd: number;
}

export function estimateAbility(
  responses: ReadonlyArray<{ level: number; correct: boolean }>,
  prior: { mean: number; sd: number } = PRIOR,
): AbilityEstimate {
  const points: { theta: number; logp: number }[] = [];
  let best = -Infinity;
  for (let theta = GRID_MIN; theta <= GRID_MAX + 1e-9; theta += GRID_STEP) {
    let logp = -((theta - prior.mean) ** 2) / (2 * prior.sd ** 2);
    for (const r of responses) {
      const p = pCorrect(theta, r.level);
      logp += Math.log(r.correct ? p : 1 - p);
    }
    points.push({ theta, logp });
    if (logp > best) best = logp;
  }

  let total = 0;
  let mean = 0;
  let modeTheta = GRID_MIN;
  let modeP = -1;
  const weights = points.map((pt) => {
    const w = Math.exp(pt.logp - best);
    if (w > modeP) {
      modeP = w;
      modeTheta = pt.theta;
    }
    total += w;
    mean += w * pt.theta;
    return w;
  });
  mean /= total;
  let variance = 0;
  points.forEach((pt, i) => {
    variance += (weights[i] / total) * (pt.theta - mean) ** 2;
  });
  // The most likely value, not the average: it responds faster at the extremes
  return { theta: round2(modeTheta), sd: round2(Math.sqrt(variance)) };
}

export function thetaToLevelIndex(theta: number): number {
  return Math.min(CEFR_CODES.length - 1, Math.max(0, Math.round(theta - MASTERY_OFFSET)));
}

export const levelCode = (index: number): CefrCode =>
  CEFR_CODES[Math.min(CEFR_CODES.length - 1, Math.max(0, Math.round(index)))];

export type Confidence = 'low' | 'medium' | 'high';

export function confidenceOf(sd: number, answered: number): Confidence {
  if (answered < 8) return 'low';
  if (sd < 0.6) return 'high';
  if (sd < 0.9) return 'medium';
  return 'low';
}

// ------------------------------------------------------------------
// Choosing the next question
// ------------------------------------------------------------------

export function pickNextItem(
  answers: readonly AnswerRecord[],
  rng: Rng,
  bank: readonly PlacementItem[] = PLACEMENT_BANK,
): PlacementItem | null {
  if (answers.length >= QUESTION_COUNT) return null;

  const seen = new Set(answers.map((a) => a.itemId));
  const perSkill = new Map<PlacementSkill, number>(SKILLS.map((s) => [s, 0]));
  answers.forEach((a) => perSkill.set(a.skill, (perSkill.get(a.skill) ?? 0) + 1));

  // The skill asked least so far (ties keep the fixed order, so skills take turns)
  const skill = [...SKILLS].sort((a, b) => (perSkill.get(a) ?? 0) - (perSkill.get(b) ?? 0))[0];

  const { theta } = estimateAbility(answers);
  // A touch above the estimate: questions the learner might miss tell us the most
  const target = theta + 0.25;

  let pool = bank.filter((i) => i.skill === skill && !seen.has(i.id));
  if (pool.length === 0) pool = bank.filter((i) => !seen.has(i.id));
  if (pool.length === 0) return null;

  const distance = (i: PlacementItem) => Math.abs(i.level - target);
  const closest = Math.min(...pool.map(distance));
  const tied = pool.filter((i) => distance(i) - closest < 0.5);
  return tied[Math.floor(rng() * tied.length)];
}

// ------------------------------------------------------------------
// Result
// ------------------------------------------------------------------

export interface SkillResult {
  level: CefrCode;
  correct: number;
  total: number;
}

export interface PlacementResult {
  level: CefrCode;
  theta: number;
  confidence: Confidence;
  correct: number;
  total: number;
  skills: Record<PlacementSkill, SkillResult>;
  strongest: PlacementSkill;
  weakest: PlacementSkill;
}

export function scoreAttempt(answers: readonly AnswerRecord[]): PlacementResult {
  const overall = estimateAbility(answers);

  const skills = {} as Record<PlacementSkill, SkillResult>;
  const skillTheta = {} as Record<PlacementSkill, number>;
  for (const skill of SKILLS) {
    const mine = answers.filter((a) => a.skill === skill);
    // Few answers per skill, so each skill's estimate leans on the overall one
    const est = estimateAbility(mine, { mean: overall.theta, sd: 1 });
    skillTheta[skill] = est.theta;
    skills[skill] = {
      level: levelCode(thetaToLevelIndex(est.theta)),
      correct: mine.filter((a) => a.correct).length,
      total: mine.length,
    };
  }

  const ranked = [...SKILLS].sort((a, b) => skillTheta[b] - skillTheta[a]);
  return {
    level: levelCode(thetaToLevelIndex(overall.theta)),
    theta: overall.theta,
    confidence: confidenceOf(overall.sd, answers.length),
    correct: answers.filter((a) => a.correct).length,
    total: answers.length,
    skills,
    strongest: ranked[0],
    weakest: ranked[ranked.length - 1],
  };
}

// ------------------------------------------------------------------
// Speaking sample (optional, shown next to the level — it doesn't change it)
// ------------------------------------------------------------------

export const SPEAKING_MIN_WORDS = 15;

export interface SpeakingSample {
  words: number;
  seconds: number;
  wpm: number | null;
  fluency: number | null;
  fillersPer100: number;
  uniqueWords: number;
  richWords: string[];
  tooShort: boolean;
}

export function analyzeSpeaking(transcript: string, seconds: number): SpeakingSample {
  const tracker = new FluencyTracker();
  tracker.add(transcript);
  const snap = tracker.snapshot(Math.max(0, seconds));
  return {
    words: snap.words,
    seconds: Math.round(seconds),
    wpm: snap.wpm,
    fluency: snap.fluency,
    fillersPer100: snap.fillersPer100,
    uniqueWords: snap.uniqueWords,
    richWords: snap.richWords.slice(0, 6),
    tooShort: snap.words < SPEAKING_MIN_WORDS,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
