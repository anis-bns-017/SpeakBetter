import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api/client";

export type LetterMark = "hit" | "near" | "miss";

export interface GamesToday {
  day: string;
  wordle: { length: number; maxGuesses: number; done: boolean; won: boolean; played: number; wins: number };
  scramble: { round: number; pass: number; done: boolean; score: number | null };
}

export interface WordleReveal {
  id: string;
  word: string;
  level: string;
  pos: string;
  meaning: string;
  example: string;
  ipa: string;
}

export interface WordleResult {
  rows: Array<{ guess: string; marks: LetterMark[] }>;
  solved: boolean;
  over: boolean;
  xp: number;
  reveal: WordleReveal | null;
}

export interface ScrambleItem {
  id: string;
  letters: string;
  hint: string;
  pos: string;
  length: number;
}

export interface ScrambleRound {
  level: string;
  round: number;
  items: ScrambleItem[];
}

export interface ScrambleResult {
  score: number;
  total: number;
  won: boolean;
  xp: number;
  results: Array<{ id: string; word: string; typed: string; right: boolean }>;
}

export const useGamesToday = () =>
  useQuery({
    queryKey: ["games", "today"],
    queryFn: async () => (await apiClient.get<GamesToday>("/games/today")).data,
    staleTime: 30_000,
  });

export const useCheckWordle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guesses: string[]) => (await apiClient.post<WordleResult>("/games/wordle/check", { guesses })).data,
    onSuccess: (r) => {
      if (r.over) void qc.invalidateQueries({ queryKey: ["games", "today"] });
    },
  });
};

export const useScrambleRound = (round: number, enabled: boolean) =>
  useQuery({
    queryKey: ["games", "scramble", round],
    queryFn: async () => (await apiClient.get<ScrambleRound>("/games/scramble", { params: { round } })).data,
    enabled,
    staleTime: Infinity,
  });

export const useCheckScramble = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { round: number; answers: Record<string, string> }) =>
      (await apiClient.post<ScrambleResult>("/games/scramble/check", input)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["games", "today"] }),
  });
};

// What the page remembers on this device so a refresh doesn't lose today's guesses
const wordleKey = (day: string) => `sb.wordle.${day}`;

export function readWordleGuesses(day: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(wordleKey(day)) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((g): g is string => typeof g === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function saveWordleGuesses(day: string, guesses: string[]) {
  try {
    localStorage.setItem(wordleKey(day), JSON.stringify(guesses));
  } catch {
    // storage blocked: the game still works, it just won't survive a refresh
  }
}
