// apps/web/src/hooks/useDictionary.ts
// The 10,000-word dictionary, the vocabulary size test and the word map.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import { WORDS_KEY } from './useWords';

export type DictLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const DICT_LEVELS: DictLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export type DictStatus = 'new' | 'saved' | 'known';

export interface DictSense {
  p: string;
  d: string;
  x?: string[];
  syn?: string[];
  ant?: string[];
}

export interface DictWord {
  id: string;
  w: string;
  lv: DictLevel;
  est?: boolean;
  r: number;
  pos: string[];
  ipa?: { us?: string; uk?: string };
  s: DictSense[];
  f?: Record<string, string>;
  fam?: string[];
  t?: string[];
  alt?: string[];
  ex?: Array<[string, number]>;
}

export interface DictCard {
  id: string;
  word: string;
  level: DictLevel;
  rank: number;
  pos: string[];
  ipa: string | null;
  meaning: string;
  status: DictStatus;
  topics?: string[];
}

export interface DictSource {
  name: string;
  by: string;
  url: string;
  license?: string;
  use: string;
}

export interface SizeTestSummary {
  id: string;
  estimate: number | null;
  level: DictLevel | null;
  bands: number[] | null;
  finishedAt: string | null;
}

export interface DictOverview {
  count: number;
  levels: Array<{ level: DictLevel; total: number; known: number }>;
  topics: Array<{ name: string; count: number }>;
  sources: DictSource[];
  progress: { known: number; saved: number };
  latestTest: SizeTestSummary | null;
  next: DictCard[];
}

export interface DictListQuery {
  q?: string;
  level?: DictLevel | '';
  topic?: string;
  status?: DictStatus | 'all';
  sort?: 'rank' | 'az';
  page?: number;
  rankFrom?: number;
  rankTo?: number;
}

export interface DictList {
  items: DictCard[];
  total: number;
  page: number;
  pages: number;
}

export interface DictWordPage {
  word: DictWord;
  status: DictStatus;
  commonness: string;
  links: Record<string, string>;
  prev: { id: string; word: string } | null;
  next: { id: string; word: string } | null;
}

export interface WordMapData {
  cells: Array<{ from: number; to: number; known: number; saved: number }>;
  bands: Array<{ band: number; from: number; to: number; known: number; saved: number; tested: number | null }>;
  levels: Array<{ level: DictLevel; total: number; known: number }>;
  latestTest: SizeTestSummary | null;
  next: DictCard[];
}

export interface TestResult {
  estimate: number;
  level: DictLevel;
  bands: number[];
  falseAlarms: number;
  checked: number;
  checkedRight: number;
  knownMarked: number;
  next: DictCard[];
}

export const dictError = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message?.toString() || fallback;

export const useDictionaryOverview = () =>
  useQuery({ queryKey: ['dictionary'], queryFn: async () => (await apiClient.get<DictOverview>('/dictionary')).data });

export const useDictionaryList = (query: DictListQuery) =>
  useQuery({
    queryKey: ['dictionary-list', query],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== 'all'));
      return (await apiClient.get<DictList>('/dictionary/words', { params })).data;
    },
    placeholderData: keepPreviousData,
  });

export const useDictionaryWord = (id: string | undefined) =>
  useQuery({
    queryKey: ['dictionary-word', id],
    queryFn: async () => (await apiClient.get<DictWordPage>(`/dictionary/words/${encodeURIComponent(id!)}`)).data,
    enabled: !!id,
  });

/** The dictionary entry for a word as heard or read ("went" finds "go"); null when the dictionary has none */
export const useFindDictWord = (word: string | null | undefined) =>
  useQuery({
    queryKey: ['dictionary-find', (word ?? '').toLowerCase()],
    queryFn: async () =>
      (await apiClient.get<{ word: (DictCard & { commonness: string }) | null }>('/dictionary/find', { params: { word } })).data.word,
    enabled: !!word && word.trim().length > 0,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

export const useWordMap = () =>
  useQuery({ queryKey: ['dictionary-map'], queryFn: async () => (await apiClient.get<WordMapData>('/dictionary/map')).data });

export const useSizeTests = () =>
  useQuery({ queryKey: ['dictionary-tests'], queryFn: async () => (await apiClient.get<SizeTestSummary[]>('/dictionary/tests')).data });

/** Everything that shows a word's status or the learner's word counts */
function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [['dictionary'], ['dictionary-list'], ['dictionary-word'], ['dictionary-map'], WORDS_KEY, ['review-queue'], ['review-stats'], ['learning-dashboard']]) {
      void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
    }
  };
}

export const useSaveDictWord = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post<{ saved: boolean; added: boolean }>(`/dictionary/words/${encodeURIComponent(id)}/save`)).data,
    onSuccess: refresh,
  });
};

export const useSaveManyDictWords = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (ids: string[]) => (await apiClient.post<{ added: number }>('/dictionary/save', { ids })).data,
    onSuccess: refresh,
  });
};

export const useMarkKnown = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { id: string; known: boolean }) =>
      (await apiClient.put<{ known: boolean }>(`/dictionary/words/${encodeURIComponent(input.id)}/known`, { known: input.known })).data,
    onSuccess: refresh,
  });
};

export const sizeTestApi = {
  start: async () => (await apiClient.post<{ id: string; items: Array<{ key: string; text: string }> }>('/dictionary/tests')).data,
  answer: async (id: string, known: string[]) =>
    (await apiClient.post<{ checks: Array<{ key: string; word: string; options: string[] }> }>(`/dictionary/tests/${id}/answers`, { known })).data,
  finish: async (id: string, answers: Record<string, number>) =>
    (await apiClient.post<TestResult>(`/dictionary/tests/${id}/finish`, { answers })).data,
};

export const useRefreshDictionary = useRefresh;
