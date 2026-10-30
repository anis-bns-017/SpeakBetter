// apps/web/src/hooks/useWordBank.ts
/**
 * useWordBank — words you tapped in a room's live captions, with spaced-repetition review.
 * Backed by /voice/coach/words (server keeps the review schedule).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "../lib/api/client";

export interface SavedWord {
  id: string;
  word: string;
  sentence: string | null;
  meaning: string | null;
  speakerName: string | null;
  roomName: string | null;
  box: number;
  dueAt: string;
  reviewCount: number;
  createdAt: string;
}

const errorMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  fallback;

export const useWordBank = (enabled = true) => {
  const [words, setWords] = useState<SavedWord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiClient
      .get<SavedWord[]>("/voice/coach/words", { params: { limit: 500 } })
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setWords(res.data);
      })
      .catch(() => {
        /* the word bank is a bonus; captions work without it */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const savedSet = useMemo(
    () => new Set(words.map((w) => w.word)),
    [words],
  );

  const due = useMemo(
    () => words.filter((w) => new Date(w.dueAt).getTime() <= Date.now()),
    [words],
  );

  const save = useCallback(
    async (input: {
      word: string;
      sentence?: string;
      meaning?: string;
      speakerName?: string;
      roomId?: string;
    }) => {
      try {
        const res = await apiClient.post<SavedWord & { created: boolean }>(
          "/voice/coach/words",
          input,
        );
        const saved = res.data;
        setWords((prev) => [saved, ...prev.filter((w) => w.id !== saved.id)]);
        toast.success(
          saved.created ? `📚 Saved "${saved.word}"` : `Updated "${saved.word}"`,
        );
        return saved;
      } catch (e) {
        toast.error(errorMessage(e, "Could not save that word"));
        return null;
      }
    },
    [],
  );

  const review = useCallback(async (id: string, knew: boolean) => {
    try {
      const res = await apiClient.post<SavedWord>(
        `/voice/coach/words/${id}/review`,
        { knew },
      );
      setWords((prev) => prev.map((w) => (w.id === id ? { ...w, ...res.data } : w)));
    } catch (e) {
      toast.error(errorMessage(e, "Could not record that review"));
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/voice/coach/words/${id}`);
      setWords((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      toast.error(errorMessage(e, "Could not remove that word"));
    }
  }, []);

  return { words, due, savedSet, loaded, save, review, remove };
};

export default useWordBank;
