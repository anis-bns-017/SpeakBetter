/**
 * Shapes and small builders for the reading and listening library. The texts themselves live in the
 * library.texts.* files; library.content.ts puts them together.
 */

export const LIBRARY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type LibraryLevel = (typeof LIBRARY_LEVELS)[number];
export type TextKind = 'story' | 'dialogue' | 'article';

/**
 * What a question tests:
 * - detail: a fact the text states
 * - tfng: True / False / Not given (as in IELTS reading); the options never move
 * - vocab: what a word or phrase means in this text
 * - inference: something the text suggests without saying it, or the writer's purpose or attitude
 */
export type QuestionType = 'detail' | 'tfng' | 'vocab' | 'inference';

export interface Sentence {
  /** Who says it, in a dialogue */
  speaker?: string;
  text: string;
}

export interface Question {
  id: string;
  question: string;
  /** The right answer first, unless `fixed` */
  options: string[];
  explanation: string;
  /** The sentence that holds the answer */
  sentence: number;
  type: QuestionType;
  /** Options keep their order (True / False / Not given); `correct` is the index of the right one */
  fixed?: boolean;
  correct?: number;
}

/** A word worth learning before or after reading, with the meaning it has in this text */
export interface VocabItem {
  /** Exactly as it appears in the text (any capital letter aside) */
  word: string;
  meaning: string;
  /** The sentence of the text that uses it */
  sentence: number;
}

export interface LibraryText {
  id: string;
  level: LibraryLevel;
  kind: TextKind;
  title: string;
  /** Subject area, used to browse: "Food & drink", "Work", "Science" ... */
  topic: string;
  summary: string;
  sentences: Sentence[];
  questions: Question[];
  vocab: VocabItem[];
  /** Things to talk about with someone after reading */
  discuss: string[];
}

export const s = (text: string, speaker?: string): Sentence => (speaker ? { speaker, text } : { text });

/** A multiple-choice question about a detail; the right answer first (the service shuffles) */
export const q = (
  id: string,
  question: string,
  options: [string, string, string, string],
  explanation: string,
  sentence: number,
  type: QuestionType = 'detail',
): Question => ({ id, question, options, explanation, sentence, type });

/** What a word or phrase means in this text */
export const vq = (id: string, question: string, options: [string, string, string, string], explanation: string, sentence: number): Question =>
  q(id, question, options, explanation, sentence, 'vocab');

/** Something the text suggests rather than says */
export const iq = (id: string, question: string, options: [string, string, string, string], explanation: string, sentence: number): Question =>
  q(id, question, options, explanation, sentence, 'inference');

export const TFNG_OPTIONS = ['True', 'False', 'Not given'] as const;
export type TfngAnswer = (typeof TFNG_OPTIONS)[number];

/**
 * "Is this statement true, false or not given in the text?" `sentence` is the sentence that settles it
 * (for "Not given", the sentence that comes closest).
 */
export const tf = (id: string, statement: string, answer: TfngAnswer, explanation: string, sentence: number): Question => ({
  id,
  question: statement,
  options: [...TFNG_OPTIONS],
  explanation,
  sentence,
  type: 'tfng',
  fixed: true,
  correct: TFNG_OPTIONS.indexOf(answer),
});

export const v = (word: string, meaning: string, sentence: number): VocabItem => ({ word, meaning, sentence });
