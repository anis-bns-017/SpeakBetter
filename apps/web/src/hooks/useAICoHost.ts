// apps/web/src/hooks/useAICoHost.ts
/**
 * useAICoHost — watches room activity and generates context-aware suggestions.
 *
 * Optional backend: set VITE_AI_COHOST_URL to POST a summary request:
 *   POST { url }
 *   body: { roomName, transcriptSample, participantCount, durationSec }
 *   returns: { summary, keyPoints[], newWords[] }
 *
 * Without a backend it still works:
 *  - Detects quiet periods
 *  - Suggests icebreakers from a rotating pool
 *  - Provides local summary from transcript heuristics
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VoiceTranscription } from "./useVoiceTranscription";

export interface CoHostSuggestion {
  id: string;
  text: string;
  category: "icebreaker" | "topic" | "followup";
  createdAt: number;
}

export interface CoHostSummary {
  generatedAt: number;
  summary: string;
  keyPoints: string[];
  newWords: string[];
  durationSec: number;
  speakersCount: number;
  messagesCount: number;
  transcriptionsCount: number;
}

interface UseAICoHostOptions {
  enabled: boolean;
  roomName: string;
  transcriptions: VoiceTranscription[];
  participantCount: number;
  roomDurationSec: number;
  messagesCount: number;
  /** How long the room can be quiet (ms) before suggesting a new topic */
  quietThresholdMs?: number;
  /** Minimum interval between suggestions */
  cooldownMs?: number;
}

const ICEBREAKER_POOL = [
  "What language are you practicing today?",
  "Try saying a tongue-twister in your target language!",
  "What's the funniest word you know in any language?",
  "How do you say 'hello' where you're from?",
  "What's been the hardest word for you to pronounce?",
  "Share a song lyric in a language you're learning.",
  "What's one cultural habit that surprised you?",
  "Say the same sentence in two different languages!",
  "What's your language-learning goal for this month?",
  "Tell us about your favourite word in your native language.",
  "Which accent is hardest for you to understand?",
  "Introduce yourself in three languages!",
];

const TOPIC_POOL = [
  "Tell us about the last trip you took.",
  "What's a movie you love in another language?",
  "Describe your perfect weekend.",
  "What food would you recommend to a foreign visitor?",
  "Talk about a skill you're currently learning.",
  "What's the most useful phrase you know?",
  "Discuss your favourite childhood memory.",
  "Talk about an app or tool that helps you learn.",
  "Describe your typical morning in 5 sentences.",
  "What's a tradition from your country people should know?",
];

const FOLLOWUP_POOL = [
  "Can someone rephrase what was just said?",
  "Any tips for remembering this?",
  "Who has a different perspective on this?",
  "Let's hear from someone who hasn't spoken yet!",
  "Anyone want to try translating that?",
  "What's a similar expression in your language?",
];

// Simple heuristic — finds recurring non-stopword tokens longer than 4 chars
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "so", "if", "then", "than", "that",
  "this", "these", "those", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "can", "may", "might", "must", "about", "there", "here", "where", "when",
  "what", "which", "who", "whom", "whose", "why", "how", "just", "very",
  "with", "from", "into", "onto", "over", "under", "again", "still", "also",
  "some", "any", "all", "each", "every", "both", "either", "neither",
  "for", "not", "you", "your", "yours", "i'm", "i've", "it's", "don't", "can't",
  "they", "them", "their", "theirs", "we", "us", "our", "ours", "he", "she",
  "his", "her", "hers", "it", "its", "me", "my", "mine", "am", "let", "let's",
]);

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function findRecurringWords(transcriptions: VoiceTranscription[]): string[] {
  const counts = new Map<string, number>();
  for (const t of transcriptions) {
    if (!t.isFinal) continue;
    const tokens = t.text
      .toLowerCase()
      .replace(/[^a-z\s']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOPWORDS.has(w));
    for (const w of tokens) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

function buildLocalSummary(
  transcriptions: VoiceTranscription[],
  participantCount: number,
  durationSec: number,
  messagesCount: number,
): CoHostSummary {
  const finals = transcriptions.filter((t) => t.isFinal);
  const speakers = new Set(finals.map((t) => t.userId));
  const newWords = findRecurringWords(transcriptions);

  // Pick the 3 most recent final quotes as key points
  const keyPoints = finals
    .slice(-20)
    .filter((t) => t.text.length > 20)
    .slice(-3)
    .map((t) => `${t.speaker}: "${truncate(t.text, 90)}"`);

  const summaryLines: string[] = [];
  summaryLines.push(
    `${participantCount} participant${participantCount === 1 ? "" : "s"} joined for ${formatMin(
      durationSec,
    )}.`,
  );
  if (speakers.size > 0) {
    summaryLines.push(
      `${speakers.size} unique voice${speakers.size === 1 ? "" : "s"} spoke.`,
    );
  }
  if (messagesCount > 0) {
    summaryLines.push(`${messagesCount} chat message${messagesCount === 1 ? "" : "s"} exchanged.`);
  }
  if (newWords.length > 0) {
    summaryLines.push(
      `Recurring themes: ${newWords.slice(0, 5).join(", ")}.`,
    );
  } else {
    summaryLines.push("Great session — no dominant keywords detected.");
  }

  return {
    generatedAt: Date.now(),
    summary: summaryLines.join(" "),
    keyPoints,
    newWords,
    durationSec,
    speakersCount: speakers.size,
    messagesCount,
    transcriptionsCount: finals.length,
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function formatMin(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ------------------------------------------------------------

export const useAICoHost = ({
  enabled,
  roomName,
  transcriptions,
  participantCount,
  roomDurationSec,
  messagesCount,
  quietThresholdMs = 45000,
  cooldownMs = 60000,
}: UseAICoHostOptions) => {
  const [suggestion, setSuggestion] = useState<CoHostSuggestion | null>(null);
  const [summary, setSummary] = useState<CoHostSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);

  const lastSpeechAtRef = useRef<number>(Date.now());
  const lastSuggestionAtRef = useRef<number>(0);
  const lastActivityCountRef = useRef(0);

  const backendUrl =
    (import.meta.env.VITE_AI_COHOST_URL as string | undefined) || null;

  // Track last speech time whenever transcriptions arrive
  useEffect(() => {
    const count = transcriptions.length;
    if (count > lastActivityCountRef.current) {
      lastActivityCountRef.current = count;
      lastSpeechAtRef.current = Date.now();
    }
  }, [transcriptions]);

  // Reset last-activity clock when the room changes
  useEffect(() => {
    lastSpeechAtRef.current = Date.now();
  }, [roomName]);

  // ----------------------------------------------------------
  // Suggestion loop — every 10s, check if room is quiet
  // ----------------------------------------------------------
  useEffect(() => {
    if (!isEnabled) return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      const quietFor = now - lastSpeechAtRef.current;
      const sinceLastSuggestion = now - lastSuggestionAtRef.current;

      if (
        quietFor < quietThresholdMs ||
        sinceLastSuggestion < cooldownMs
      ) {
        return;
      }

      // No one to talk to? Skip.
      if (participantCount < 1) return;

      const category: CoHostSuggestion["category"] =
        transcriptions.length < 3
          ? "icebreaker"
          : Math.random() < 0.5
            ? "topic"
            : "followup";

      const pool =
        category === "icebreaker"
          ? ICEBREAKER_POOL
          : category === "topic"
            ? TOPIC_POOL
            : FOLLOWUP_POOL;

      const text = pickRandom(pool);

      setSuggestion({
        id: `sugg-${now}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        category,
        createdAt: now,
      });
      lastSuggestionAtRef.current = now;
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [
    isEnabled,
    quietThresholdMs,
    cooldownMs,
    participantCount,
    transcriptions.length,
  ]);

  // ----------------------------------------------------------
  // Manual "suggest now" (host button)
  // ----------------------------------------------------------
  const suggestNow = useCallback(() => {
    const category: CoHostSuggestion["category"] =
      transcriptions.length < 3
        ? "icebreaker"
        : Math.random() < 0.5
          ? "topic"
          : "followup";

    const pool =
      category === "icebreaker"
        ? ICEBREAKER_POOL
        : category === "topic"
          ? TOPIC_POOL
          : FOLLOWUP_POOL;

    const now = Date.now();
    setSuggestion({
      id: `sugg-${now}-${Math.random().toString(36).slice(2, 6)}`,
      text: pickRandom(pool),
      category,
      createdAt: now,
    });
    lastSuggestionAtRef.current = now;
  }, [transcriptions.length]);

  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  // ----------------------------------------------------------
  // Summary — local + optional backend
  // ----------------------------------------------------------
  const generateSummary = useCallback(async () => {
    setIsSummarizing(true);
    try {
      // If a backend is configured, prefer it
      if (backendUrl) {
        try {
          const transcriptSample = transcriptions
            .filter((t) => t.isFinal)
            .slice(-60)
            .map((t) => `${t.speaker}: ${t.text}`)
            .join("\n");

          const res = await fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomName,
              transcriptSample,
              participantCount,
              durationSec: roomDurationSec,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const result: CoHostSummary = {
              generatedAt: Date.now(),
              summary: data.summary ?? "",
              keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
              newWords: Array.isArray(data.newWords) ? data.newWords : [],
              durationSec: roomDurationSec,
              speakersCount: new Set(
                transcriptions.map((t) => t.userId),
              ).size,
              messagesCount,
              transcriptionsCount: transcriptions.filter((t) => t.isFinal)
                .length,
            };
            setSummary(result);
            return result;
          }
        } catch (err) {
          console.warn("AI co-host backend failed, falling back:", err);
        }
      }

      // Fallback to local heuristic summary
      const local = buildLocalSummary(
        transcriptions,
        participantCount,
        roomDurationSec,
        messagesCount,
      );
      setSummary(local);
      return local;
    } finally {
      setIsSummarizing(false);
    }
  }, [
    backendUrl,
    transcriptions,
    roomName,
    participantCount,
    roomDurationSec,
    messagesCount,
  ]);

  const clearSummary = useCallback(() => setSummary(null), []);

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  const exportSummaryText = useMemo(() => {
    if (!summary) return "";
    const lines = [
      `📋 Session Summary — ${roomName}`,
      `Duration: ${formatMin(summary.durationSec)} · Speakers: ${summary.speakersCount} · Messages: ${summary.messagesCount}`,
      "",
      summary.summary,
      "",
      summary.keyPoints.length > 0 ? "Key points:" : "",
      ...summary.keyPoints.map((p) => `• ${p}`),
      "",
      summary.newWords.length > 0 ? "Words mentioned:" : "",
      ...summary.newWords.map((w) => `• ${w}`),
    ];
    return lines.filter(Boolean).join("\n");
  }, [summary, roomName]);

  return {
    isEnabled,
    setIsEnabled,
    suggestion,
    dismissSuggestion,
    suggestNow,
    summary,
    isSummarizing,
    generateSummary,
    clearSummary,
    exportSummaryText,
  };
};

export default useAICoHost;