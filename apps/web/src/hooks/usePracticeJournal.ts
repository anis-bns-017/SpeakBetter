// apps/web/src/hooks/usePracticeJournal.ts
/**
 * usePracticeJournal — personal learning journal persisted to localStorage.
 *
 * Every accepted correction becomes an entry. Entries have:
 *   - original text, corrected text, note, category
 *   - source (room name, helper name)
 *   - mastery state (new → learning → mastered)
 *   - review history for spaced repetition
 *
 * Optional backend sync via VITE_JOURNAL_API — if unset, uses localStorage only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

export type JournalCategory =
  | "grammar"
  | "vocabulary"
  | "pronunciation"
  | "word-choice"
  | "spelling"
  | "other";

export type MasteryLevel = "new" | "learning" | "mastered";

export interface JournalEntry {
  id: string;
  original: string;
  corrected: string;
  note?: string;
  category: JournalCategory;
  sourceRoomName?: string;
  sourceRoomId?: string;
  helperName?: string;
  createdAt: number;
  mastery: MasteryLevel;
  /** Timestamps of each successful review */
  reviews: number[];
  /** Unix ms — next scheduled review (spaced repetition) */
  nextReviewAt: number;
  /** Number of times the user marked "still learning" */
  lapses: number;
}

interface UsePracticeJournalOptions {
  userId: string;
  /** Optional API base for syncing to backend — /journal endpoint */
  apiBaseUrl?: string;
}

const STORAGE_PREFIX = "speakbetter:journal:";

// Spaced repetition intervals (in ms)
const REVIEW_INTERVALS = {
  new: 0,
  learning: 1000 * 60 * 60 * 24, // 1 day
  mastered: 1000 * 60 * 60 * 24 * 7, // 7 days
} as const;

const INCORRECT_PENALTY_MS = 1000 * 60 * 60 * 4; // 4 hours

// ------------------------------------------------------------

function readStore(userId: string): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeStore(userId: string, entries: JournalEntry[]) {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + userId,
      JSON.stringify(entries.slice(-500)), // cap at 500
    );
  } catch {
    // quota exceeded or private mode — ignore
  }
}

export const usePracticeJournal = ({
  userId,
  apiBaseUrl,
}: UsePracticeJournalOptions) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const backendUrl =
    apiBaseUrl ||
    (import.meta.env.VITE_JOURNAL_API as string | undefined) ||
    null;

  // ------------------------------------------------------------
  // Load on mount
  // ------------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);

      // If backend is available, try remote first
      if (backendUrl) {
        try {
          const res = await fetch(
            `${backendUrl}?userId=${encodeURIComponent(userId)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.entries) && !cancelled) {
              setEntries(data.entries);
              writeStore(userId, data.entries);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // fall through to local
        }
      }

      // Local fallback
      if (!cancelled) {
        setEntries(readStore(userId));
        setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, backendUrl]);

  // ------------------------------------------------------------
  // Persist on change
  // ------------------------------------------------------------
  useEffect(() => {
    if (!userId || isLoading) return;
    writeStore(userId, entries);

    // Optional remote sync (fire-and-forget)
    if (backendUrl) {
      fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, entries }),
      }).catch(() => {});
    }
  }, [entries, userId, isLoading, backendUrl]);

  // ------------------------------------------------------------
  // Add entry (from accepted correction)
  // ------------------------------------------------------------
  const addEntry = useCallback(
    (input: {
      original: string;
      corrected: string;
      note?: string;
      category: JournalCategory;
      sourceRoomName?: string;
      sourceRoomId?: string;
      helperName?: string;
    }) => {
      const now = Date.now();
      const entry: JournalEntry = {
        id: `j-${now}-${Math.random().toString(36).slice(2, 8)}`,
        original: input.original.trim(),
        corrected: input.corrected.trim(),
        note: input.note?.trim(),
        category: input.category,
        sourceRoomName: input.sourceRoomName,
        sourceRoomId: input.sourceRoomId,
        helperName: input.helperName,
        createdAt: now,
        mastery: "new",
        reviews: [],
        nextReviewAt: now,
        lapses: 0,
      };

      setEntries((prev) => [entry, ...prev]);
      return entry;
    },
    [],
  );

  // ------------------------------------------------------------
  // Review — mark as learning or mastered
  // ------------------------------------------------------------
  const review = useCallback(
    (id: string, result: "good" | "again") => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;

          const now = Date.now();

          if (result === "again") {
            return {
              ...e,
              mastery: "learning" as MasteryLevel,
              lapses: e.lapses + 1,
              nextReviewAt: now + INCORRECT_PENALTY_MS,
            };
          }

          // Good — advance mastery
          const nextMastery: MasteryLevel =
            e.mastery === "new"
              ? "learning"
              : e.mastery === "learning"
                ? "mastered"
                : "mastered";

          return {
            ...e,
            mastery: nextMastery,
            reviews: [...e.reviews, now],
            nextReviewAt: now + REVIEW_INTERVALS[nextMastery],
          };
        }),
      );
    },
    [],
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
  }, []);

  // ------------------------------------------------------------
  // Derived stats
  // ------------------------------------------------------------
  const stats = useMemo(() => {
    const total = entries.length;
    const byMastery = {
      new: entries.filter((e) => e.mastery === "new").length,
      learning: entries.filter((e) => e.mastery === "learning").length,
      mastered: entries.filter((e) => e.mastery === "mastered").length,
    };

    const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {});

    const now = Date.now();
    const dueForReview = entries.filter((e) => e.nextReviewAt <= now);

    const weekAgo = now - 1000 * 60 * 60 * 24 * 7;
    const thisWeek = entries.filter((e) => e.createdAt >= weekAgo).length;

    const masteryRate =
      total > 0 ? Math.round((byMastery.mastered / total) * 100) : 0;

    return {
      total,
      byMastery,
      byCategory,
      dueForReview,
      thisWeek,
      masteryRate,
    };
  }, [entries]);

  // ------------------------------------------------------------
  // Export
  // ------------------------------------------------------------
  const exportAsText = useCallback(() => {
    const lines: string[] = [
      `📓 Practice Journal`,
      `Total entries: ${entries.length}`,
      `Mastered: ${stats.byMastery.mastered} / Learning: ${stats.byMastery.learning} / New: ${stats.byMastery.new}`,
      "",
    ];

    const grouped = entries.reduce<Record<string, JournalEntry[]>>(
      (acc, e) => {
        if (!acc[e.category]) acc[e.category] = [];
        acc[e.category].push(e);
        return acc;
      },
      {},
    );

    for (const [cat, list] of Object.entries(grouped)) {
      lines.push(`── ${cat.toUpperCase()} ──`);
      for (const e of list) {
        lines.push(`• ${e.original} → ${e.corrected}`);
        if (e.note) lines.push(`  note: ${e.note}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }, [entries, stats]);

  return {
    entries,
    stats,
    isLoading,
    addEntry,
    review,
    removeEntry,
    clearAll,
    exportAsText,
  };
};

export default usePracticeJournal;