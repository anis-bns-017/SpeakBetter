import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export interface LookupMeaning {
  partOfSpeech: string;
  definition: string;
  example: string | null;
}

export interface LookupResult {
  text: string;
  kind: 'word' | 'phrase';
  target: { code: string; name: string } | null;
  translation: string | null;
  phonetic: string | null;
  audioUrl: string | null;
  meanings: LookupMeaning[];
  synonyms: string[];
  antonyms: string[];
  /** When the word is a form of another ("went"), the word the meanings are for ("go") */
  baseForm: string | null;
  /** no-language: pick one; limit: the free allowance is used up; unavailable: could not be reached */
  notice: 'no-language' | 'limit' | 'unavailable' | null;
}

export interface LookupLanguage {
  code: string;
  name: string;
}

/** "en" means "do not translate, only show the English meaning" */
export const NO_TRANSLATION = 'en';
const STORAGE_KEY = 'sb.lookup.lang';

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const useLookupLanguages = () =>
  useQuery({
    queryKey: ['lookup-languages'],
    queryFn: async () => (await apiClient.get<LookupLanguage[]>('/translate/languages')).data,
    staleTime: Infinity,
  });

/** One lookup. `language` null means "whatever your profile says". */
export const useLookupQuery = (text: string, language: string | null) => {
  const trimmed = text.trim();
  return useQuery({
    queryKey: ['lookup', trimmed.toLowerCase(), language ?? ''],
    queryFn: async () =>
      (
        await apiClient.get<LookupResult>('/translate/lookup', {
          params: { text: trimmed, ...(language ? { target: language } : {}) },
        })
      ).data,
    enabled: trimmed.length > 0,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
};

/** The supported language that matches the browser's own language, if any ("bn-BD" → Bengali) */
export function browserLanguage(languages: LookupLanguage[]): LookupLanguage | null {
  const raw = typeof navigator !== 'undefined' ? navigator.language : '';
  const base = raw.split('-')[0]?.toLowerCase();
  if (!base || base === 'en') return null;
  return languages.find((l) => l.code.toLowerCase() === raw.toLowerCase() || l.code.split('-')[0].toLowerCase() === base) ?? null;
}

/**
 * Looks up a word or phrase. The language is the one you picked last (remembered in this browser);
 * until you pick one, the server uses the native language from your profile.
 */
export function useLookupState(text: string) {
  const [language, setLanguageState] = useState<string | null>(readStored);
  const languages = useLookupLanguages();
  const query = useLookupQuery(text, language);

  const setLanguage = useCallback((code: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* the choice just will not be remembered */
    }
    setLanguageState(code);
  }, []);

  return {
    data: query.data,
    isLoading: query.isFetching && !query.data,
    isError: query.isError,
    /** What the language picker shows: your choice, else what the server used */
    language: language ?? query.data?.target?.code ?? '',
    setLanguage,
    languages: languages.data ?? [],
  };
}

export type LookupState = ReturnType<typeof useLookupState>;

/** The words to keep on a card or in the word bank: translation first, then the English meaning */
export function meaningFrom(data: LookupResult | undefined): string {
  if (!data) return '';
  const first = data.meanings[0];
  const english = first ? `${first.partOfSpeech ? `(${first.partOfSpeech}) ` : ''}${first.definition}` : '';
  return [data.translation, english].filter(Boolean).join(' — ');
}

/** For places that save a word with one tap: its meaning if we can get it quickly, otherwise nothing */
export async function fetchMeaning(word: string): Promise<string | undefined> {
  try {
    const target = readStored();
    const { data } = await apiClient.get<LookupResult>('/translate/lookup', {
      params: { text: word, ...(target ? { target } : {}) },
      timeout: 4000,
    });
    return meaningFrom(data).slice(0, 120) || undefined;
  } catch {
    return undefined;
  }
}
