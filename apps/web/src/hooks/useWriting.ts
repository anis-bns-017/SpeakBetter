import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type WritingLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type WritingKind = 'message' | 'email' | 'story' | 'opinion' | 'description' | 'review';
export type IssueKind = 'grammar' | 'spelling' | 'punctuation' | 'style';
export type SpellingVariant = 'en-GB' | 'en-US';

export interface WritingPromptCard {
  id: string;
  level: WritingLevel;
  kind: WritingKind;
  title: string;
  task: string;
  minWords: number;
  maxWords: number;
}

export interface WritingOverview {
  level: WritingLevel;
  /** Today's task id for each level */
  today: Record<WritingLevel, string>;
  prompts: Array<WritingPromptCard & { done: boolean; bestScore: number | null }>;
  recent: Array<{ id: string; promptId: string; title: string; level: string; wordCount: number; score: number | null; finished: boolean; updatedAt: string }>;
  stats: { pieces: number; words: number; averageScore: number | null };
  checker: { publicServer: boolean };
}

export interface WritingIssue {
  id: string;
  offset: number;
  length: number;
  text: string;
  message: string;
  short: string | null;
  replacements: string[];
  kind: IssueKind;
  pattern: string;
  ruleId: string;
}

export type IssueCounts = Record<IssueKind, number>;

export interface WritingPiece {
  id: string;
  promptId: string;
  level: string;
  title: string;
  text: string;
  variant: SpellingVariant;
  wordCount: number;
  score: number | null;
  finished: boolean;
  submittedAt: string | null;
  prompt: (WritingPromptCard & { tips: string[]; phrases: string[] }) | null;
  issues: WritingIssue[] | null;
  counts: IssueCounts | null;
  checker: { publicServer: boolean };
}

export interface CheckResult {
  issues: WritingIssue[];
  words: number;
  score: number | null;
  counts: IssueCounts;
}

export interface FinishResult extends WritingPiece {
  xp: number;
  cardsAdded: number;
  checked: boolean;
}

export const useWritingOverview = () =>
  useQuery({
    queryKey: ['writing'],
    queryFn: async () => (await apiClient.get<WritingOverview>('/writing')).data,
    staleTime: 30_000,
  });

export const useWritingPiece = (id: string | undefined) =>
  useQuery({
    queryKey: ['writing-piece', id],
    queryFn: async () => (await apiClient.get<WritingPiece>(`/writing/pieces/${id}`)).data,
    enabled: !!id,
    // The editor owns the text once it is open; do not refetch under the learner's fingers
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

export const useStartWriting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (promptId: string) => (await apiClient.post<WritingPiece>('/writing/pieces', { promptId })).data,
    onSuccess: (piece) => {
      queryClient.setQueryData(['writing-piece', piece.id], piece);
      queryClient.invalidateQueries({ queryKey: ['writing'] });
    },
  });
};

export const useSaveWriting = (id: string) =>
  useMutation({
    mutationFn: async (input: { text: string; variant: SpellingVariant }) =>
      (await apiClient.put<{ id: string; wordCount: number; updatedAt: string }>(`/writing/pieces/${id}`, input)).data,
  });

export const useCheckWriting = (id: string) =>
  useMutation({
    mutationFn: async (input: { text: string; variant: SpellingVariant }) =>
      (await apiClient.post<CheckResult>(`/writing/pieces/${id}/check`, input)).data,
  });

export const useFinishWriting = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; variant: SpellingVariant }) =>
      (await apiClient.post<FinishResult>(`/writing/pieces/${id}/finish`, input)).data,
    onSuccess: (piece) => {
      queryClient.setQueryData(['writing-piece', id], piece);
      for (const key of ['writing', 'plan-today', 'quests', 'streak', 'learning-dashboard', 'progress', 'review-queue', 'review-mistakes', 'celebrations']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
};

export const useDeleteWriting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/writing/pieces/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['writing'] }),
  });
};

/** Applies one suggestion and moves the issues after it, dropping any it overlapped */
export function applySuggestion(text: string, issues: WritingIssue[], issue: WritingIssue, replacement: string) {
  const next = text.slice(0, issue.offset) + replacement + text.slice(issue.offset + issue.length);
  const delta = replacement.length - issue.length;
  const end = issue.offset + issue.length;
  const remaining = issues
    .filter((i) => i.id !== issue.id && (i.offset + i.length <= issue.offset || i.offset >= end))
    .map((i) => (i.offset >= end ? { ...i, offset: i.offset + delta } : i));
  return { text: next, issues: remaining };
}

export const countWords = (text: string) => (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
