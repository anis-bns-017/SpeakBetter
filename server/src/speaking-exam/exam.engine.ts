// server/src/speaking-exam/exam.engine.ts
// Pure scoring for the speaking mock test. Nothing here touches the database or the network, so it is cheap to test.
//
// The bands are ESTIMATES from what a transcript can show (how much was said and how smoothly, how varied the
// words were, how many grammar slips a checker found). They are not a real examiner's mark, and the report says so.
import { analyzeSpeaking, seededRng, type Rng } from '../placement/placement.engine';
import { CUE_CARDS, PART1_TOPICS, type CueCard, type Part1Topic } from './exam.content';

export type ExamPart = 1 | 2 | 3;

export const PART_SECONDS: Record<ExamPart, { target: number; max: number }> = {
  1: { target: 20, max: 45 },
  2: { target: 100, max: 130 },
  3: { target: 35, max: 70 },
};
export const PREP_SECONDS = 60;
export const PART1_QUESTIONS = 3;
export const PART3_QUESTIONS = 3;

export interface ExamPaper {
  id: string;
  part1: { topic: string; questions: string[] };
  part2: { topic: string; prompt: string; points: string[]; prepSeconds: number; speakSeconds: number };
  part3: { questions: string[] };
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A full paper from a seed: the same seed always gives the same paper */
export function buildPaper(seed: string): ExamPaper {
  const rng = seededRng(`exam:${seed}`);
  const topic: Part1Topic = pick(PART1_TOPICS, rng);
  const card: CueCard = pick(CUE_CARDS, rng);
  return {
    id: seed,
    part1: { topic: topic.topic, questions: shuffled(topic.questions, rng).slice(0, PART1_QUESTIONS) },
    part2: {
      topic: card.topic,
      prompt: card.prompt,
      points: card.points,
      prepSeconds: PREP_SECONDS,
      speakSeconds: PART_SECONDS[2].max,
    },
    part3: { questions: shuffled(card.followUps, rng).slice(0, PART3_QUESTIONS) },
  };
}

export interface PartInput {
  part: ExamPart;
  question: string;
  transcript: string;
  seconds: number;
}

export interface PartScore {
  part: ExamPart;
  question: string;
  words: number;
  seconds: number;
  wpm: number | null;
  fillersPer100: number;
  uniqueWords: number;
  richWords: string[];
  /** How much of the expected length was spoken, 0 to 1 */
  completeness: number;
  tooShort: boolean;
  /** An estimated band for this answer alone, 1 to 9 in half steps */
  band: number;
}

export type TipCode =
  | 'speak_longer'
  | 'less_fillers'
  | 'pace_slow'
  | 'pace_fast'
  | 'richer_words'
  | 'grammar_slips'
  | 'part2_longer'
  | 'answers_missing'
  | 'good_all_round';

export interface Tip {
  code: TipCode;
  /** Numbers the web app drops into the message */
  params?: Record<string, number | string>;
}

export interface GrammarSummary {
  checked: boolean;
  /** Real slips per 100 spoken words, or null when not checked */
  slipsPer100: number | null;
  examples: Array<{ text: string; message: string; suggestion: string | null }>;
}

export interface ExamReport {
  /** Estimated overall band, 1 to 9 in half steps */
  overall: number;
  /** Rough CEFR level that band suggests */
  cefr: string;
  criteria: {
    fluency: number;
    vocabulary: number;
    /** null when the grammar checker could not be reached */
    grammar: number | null;
  };
  grammar: GrammarSummary;
  parts: PartScore[];
  totals: { words: number; seconds: number; wpm: number | null; fillersPer100: number };
  tips: Tip[];
  /** Always true: these are estimates from the transcript */
  estimate: true;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const roundHalf = (n: number) => Math.round(n * 2) / 2;

/** Band 1-9 from a 0-1 quality value, spread over the 3 to 8.5 range a transcript can honestly support */
const toBand = (quality: number) => roundHalf(clamp(3 + clamp(quality, 0, 1) * 5.5, 1, 9));

export function cefrForBand(band: number): string {
  if (band >= 8) return 'C2';
  if (band >= 7) return 'C1';
  if (band >= 5.5) return 'B2';
  if (band >= 4.5) return 'B1';
  if (band >= 3.5) return 'A2';
  return 'A1';
}

/** Fluency quality, 0-1, from the tracker's score and how much of the expected time was filled */
function fluencyQuality(fluency: number | null, completeness: number): number {
  const f = (fluency ?? 40) / 100;
  return 0.65 * f + 0.35 * completeness;
}

/** Vocabulary quality, 0-1: variety (unique words per word spoken) and uncommon words used */
function vocabularyQuality(words: number, unique: number, rich: number): number {
  if (words < 8) return 0;
  // Short answers repeat little by chance, so the variety target eases as the answer gets longer
  const targetTtr = words < 40 ? 0.8 : words < 120 ? 0.65 : 0.5;
  const variety = clamp(unique / words / targetTtr, 0, 1);
  const richness = clamp(rich / 5, 0, 1);
  return 0.6 * variety + 0.4 * richness;
}

/** Fast, clear speakers reach about 200 words a minute; beyond this the numbers cannot be real speech */
export const MAX_REAL_WPM = 230;
/** The most a part can score when its pace is impossible (0.35 is about band 5) */
const IMPLAUSIBLE_QUALITY = 0.35;
/** The most any band can be when the pace is impossible */
const IMPLAUSIBLE_BAND_CAP = 5;

export const isImplausiblePace = (wpm: number | null | undefined) => wpm !== null && wpm !== undefined && wpm > MAX_REAL_WPM;

export function scorePart(input: PartInput): PartScore {
  const seconds = clamp(Number(input.seconds) || 0, 0, PART_SECONDS[input.part].max * 2);
  const sample = analyzeSpeaking(input.transcript, seconds);
  const completeness = clamp(seconds / PART_SECONDS[input.part].target, 0, 1);
  const raw = sample.tooShort ? 0.1 : fluencyQuality(sample.fluency, completeness);
  // Nobody speaks faster than this: the time or the text is wrong (pasted text, a stuck timer), so it can't earn a high band
  const pace = sample.wpm ?? (seconds >= 3 && sample.words >= 10 ? Math.round((sample.words / seconds) * 60) : null);
  const quality = isImplausiblePace(pace) ? Math.min(raw, IMPLAUSIBLE_QUALITY) : raw;
  return {
    part: input.part,
    question: input.question,
    words: sample.words,
    seconds: Math.round(seconds),
    wpm: pace,
    fillersPer100: sample.fillersPer100,
    uniqueWords: sample.uniqueWords,
    richWords: sample.richWords,
    completeness: Math.round(completeness * 100) / 100,
    tooShort: sample.tooShort,
    band: toBand(quality),
  };
}

/** Grammar quality 0-1 from slips per 100 words: none is full marks, about 12 or more is the floor */
const grammarQuality = (slipsPer100: number) => clamp(1 - slipsPer100 / 12, 0, 1);

export function buildReport(parts: PartScore[], grammar: GrammarSummary): ExamReport {
  const spoken = parts.filter((p) => !p.tooShort);
  const totalWords = parts.reduce((n, p) => n + p.words, 0);
  const totalSeconds = parts.reduce((n, p) => n + p.seconds, 0);
  const totalFillers = totalWords
    ? (parts.reduce((n, p) => n + (p.fillersPer100 * p.words) / 100, 0) / totalWords) * 100
    : 0;
  const wpm = totalSeconds >= 20 && totalWords > 0 ? Math.round((totalWords / totalSeconds) * 60) : null;

  // Fluency: the answers' own bands averaged, answers left blank dragging it down
  const fluency = parts.length ? roundHalf(parts.reduce((n, p) => n + p.band, 0) / parts.length) : 1;

  const unique = spoken.reduce((n, p) => n + p.uniqueWords, 0);
  const rich = new Set(spoken.flatMap((p) => p.richWords)).size;
  // If the overall pace is impossible, none of the words can be trusted, so no band goes above the cap
  const answered = parts.filter((p) => p.words > 0);
  const tooFast = answered.filter((p) => isImplausiblePace(p.wpm)).length;
  const cap = isImplausiblePace(wpm) || (answered.length > 0 && tooFast * 2 >= answered.length) ? IMPLAUSIBLE_BAND_CAP : 9;
  const vocabulary = Math.min(cap, toBand(vocabularyQuality(totalWords, unique, rich)));

  const grammarBand =
    grammar.checked && grammar.slipsPer100 !== null && totalWords >= 25
      ? Math.min(cap, toBand(grammarQuality(grammar.slipsPer100)))
      : null;

  const considered = [Math.min(cap, fluency), vocabulary, ...(grammarBand !== null ? [grammarBand] : [])];
  const overall = roundHalf(considered.reduce((n, b) => n + b, 0) / considered.length);

  const tips: Tip[] = [];
  const blank = parts.filter((p) => p.tooShort).length;
  if (blank > 0) tips.push({ code: 'answers_missing', params: { count: blank } });
  const part2 = parts.find((p) => p.part === 2);
  if (part2 && !part2.tooShort && part2.seconds < 75) tips.push({ code: 'part2_longer', params: { seconds: part2.seconds } });
  else if (parts.some((p) => p.part !== 2 && !p.tooShort && p.completeness < 0.6)) tips.push({ code: 'speak_longer' });
  if (totalFillers > 6) tips.push({ code: 'less_fillers', params: { per100: Math.round(totalFillers) } });
  if (wpm !== null && wpm < 85) tips.push({ code: 'pace_slow', params: { wpm } });
  const fastest = Math.max(0, ...answered.map((p) => p.wpm ?? 0));
  if (wpm !== null && wpm > 185) tips.push({ code: 'pace_fast', params: { wpm } });
  else if (cap < 9 && fastest > 0) tips.push({ code: 'pace_fast', params: { wpm: fastest } });
  if (vocabulary < 5.5 && totalWords >= 40) tips.push({ code: 'richer_words' });
  if (grammar.checked && grammar.slipsPer100 !== null && grammar.slipsPer100 > 5) {
    tips.push({ code: 'grammar_slips', params: { per100: Math.round(grammar.slipsPer100 * 10) / 10 } });
  }
  if (tips.length === 0) tips.push({ code: 'good_all_round' });

  return {
    overall,
    cefr: cefrForBand(overall),
    criteria: { fluency: Math.min(cap, fluency), vocabulary, grammar: grammarBand },
    grammar,
    parts,
    totals: { words: totalWords, seconds: totalSeconds, wpm, fillersPer100: Math.round(totalFillers * 10) / 10 },
    tips: tips.slice(0, 4),
    estimate: true,
  };
}
