import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export interface ExamPaper {
  id: string;
  part1: { topic: string; questions: string[] };
  part2: { topic: string; prompt: string; points: string[]; prepSeconds: number; speakSeconds: number };
  part3: { questions: string[] };
}

export interface ExamAnswer {
  part: 1 | 2 | 3;
  question: string;
  transcript: string;
  seconds: number;
}

export interface PartScore {
  part: 1 | 2 | 3;
  question: string;
  words: number;
  seconds: number;
  wpm: number | null;
  fillersPer100: number;
  uniqueWords: number;
  richWords: string[];
  completeness: number;
  tooShort: boolean;
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

export interface ExamReport {
  overall: number;
  cefr: string;
  criteria: { fluency: number; vocabulary: number; grammar: number | null };
  grammar: { checked: boolean; slipsPer100: number | null; examples: Array<{ text: string; message: string; suggestion: string | null }> };
  parts: PartScore[];
  totals: { words: number; seconds: number; wpm: number | null; fillersPer100: number };
  tips: Array<{ code: TipCode; params?: Record<string, number | string> }>;
  estimate: true;
  grammarViaPublicServer: boolean;
}

/** A new paper each time `attempt` changes; `id` repeats a paper ("same questions again") */
export const useExamPaper = (attempt: number, id?: string) =>
  useQuery({
    queryKey: ['speaking-exam-paper', attempt, id ?? ''],
    queryFn: async () => (await apiClient.get<ExamPaper>('/speaking-exam/paper', { params: id ? { id } : {} })).data,
    // A paper must not change under someone who is halfway through it
    staleTime: Infinity,
    gcTime: 0,
  });

export const useScoreExam = () =>
  useMutation({
    mutationFn: async (parts: ExamAnswer[]) => (await apiClient.post<ExamReport>('/speaking-exam/score', { parts })).data,
  });

// ---- Your last results, kept on this device ----

export interface ExamHistoryItem {
  at: number;
  overall: number;
  cefr: string;
}

const HISTORY_KEY = 'sb.exam.history';

export function readExamHistory(): ExamHistoryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((r) => typeof r?.at === 'number' && typeof r?.overall === 'number').slice(-10)
      : [];
  } catch {
    return [];
  }
}

export function saveExamResult(report: Pick<ExamReport, 'overall' | 'cefr'>): ExamHistoryItem[] {
  const next = [...readExamHistory(), { at: Date.now(), overall: report.overall, cefr: report.cefr }].slice(-10);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* private mode or full: the report still shows, it just isn't kept */
  }
  return next;
}
