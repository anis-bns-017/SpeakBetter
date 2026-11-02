// server/src/ai-tutor/ai-tutor.summary.ts
// The recap at the end of a conversation, built from what was saved: no model call needed.

import { FluencyTracker } from '../voice/coach/coach.engine';
import type { TutorCorrection, TutorWord } from './ai-tutor.prompt';

export interface StoredTutorMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata?: unknown;
}

export interface TutorSummary {
  turns: number;
  words: number;
  uniqueWords: number;
  avgWordsPerTurn: number;
  /** 0–100 once the learner has said enough (about 25 words) to judge */
  fluency: number | null;
  fillersPer100: number;
  richWords: string[];
  mistakes: number;
  corrections: TutorCorrection[];
  newWords: TutorWord[];
  xpEarned: number;
}

const MAX_CORRECTIONS = 8;
const MAX_NEW_WORDS = 8;

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export function buildSummary(messages: readonly StoredTutorMessage[], xpEarned = 0): TutorSummary {
  const tracker = new FluencyTracker();
  const corrections: TutorCorrection[] = [];
  const words = new Map<string, TutorWord>();
  let turns = 0;
  let mistakes = 0;

  for (const m of messages) {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    if (m.role === 'USER') {
      turns++;
      tracker.add(m.content);
      const found = asArray(meta.corrections) as TutorCorrection[];
      mistakes += found.length;
      for (const c of found) if (corrections.length < MAX_CORRECTIONS) corrections.push(c);
    } else if (m.role === 'ASSISTANT') {
      for (const w of asArray(meta.newWords) as TutorWord[]) {
        const key = String(w?.word ?? '').toLowerCase();
        if (key && !words.has(key) && words.size < MAX_NEW_WORDS) words.set(key, w);
      }
    }
  }

  const snap = tracker.snapshot(0);
  return {
    turns,
    words: snap.words,
    uniqueWords: snap.uniqueWords,
    avgWordsPerTurn: snap.avgUtteranceWords,
    fluency: snap.fluency,
    fillersPer100: snap.fillersPer100,
    richWords: snap.richWords.slice(0, 6),
    mistakes,
    corrections,
    newWords: [...words.values()],
    xpEarned,
  };
}
