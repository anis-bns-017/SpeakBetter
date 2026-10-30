// apps/web/src/components/voice/shared/LiveCaptions.tsx
/**
 * LiveCaptions — what people are saying, right in the room.
 * Tap any word in a finished line to save it (with the sentence it was heard in)
 * to your word bank; saved words are underlined so you can see what you already know.
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Captions, CaptionsOff, BookmarkPlus, BookmarkCheck, X } from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type { VoiceTranscription } from "../../../hooks/useVoiceTranscription";

interface LiveCaptionsProps {
  transcriptions: VoiceTranscription[];
  userId: string;
  /** Words (lowercase) already in the word bank */
  savedWords: Set<string>;
  onSave: (input: {
    word: string;
    sentence: string;
    speakerName: string;
    meaning?: string;
  }) => Promise<unknown> | void;
}

const STORAGE_KEY = "sb.captions.on";
/** How long a finished line stays on screen */
const LINE_TTL_MS = 14_000;
const MAX_LINES = 3;

const readEnabled = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
};

/** The word without punctuation around it, lowercase — what gets saved */
const clean = (token: string) =>
  token
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

export const LiveCaptions: React.FC<LiveCaptionsProps> = ({
  transcriptions,
  userId,
  savedWords,
  onSave,
}) => {
  const [enabled, setEnabled] = useState(readEnabled);
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState<{
    word: string;
    sentence: string;
    speakerName: string;
  } | null>(null);
  const [meaning, setMeaning] = useState("");
  const [saving, setSaving] = useState(false);

  // Old lines fade away; tick only while there is something to age out
  const hasLines = transcriptions.length > 0;
  useEffect(() => {
    if (!enabled || !hasLines) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [enabled, hasLines]);

  const toggle = () => {
    setEnabled((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      } catch {
        /* the choice just won't be remembered */
      }
      return !v;
    });
    setPicked(null);
  };

  const lines = useMemo(() => {
    const fresh = transcriptions.filter(
      (t) => now - new Date(t.timestamp).getTime() < LINE_TTL_MS && t.text.trim(),
    );
    // One live (partial) line per person, plus the latest finished lines
    const finals = fresh.filter((t) => t.isFinal).slice(-MAX_LINES);
    const partials = fresh.filter((t) => !t.isFinal);
    return [...finals, ...partials].slice(-MAX_LINES);
  }, [transcriptions, now]);

  const pick = (word: string, line: VoiceTranscription) => {
    if (!word) return;
    setMeaning("");
    setPicked({ word, sentence: line.text, speakerName: line.speaker });
  };

  const save = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      await onSave({ ...picked, meaning: meaning.trim() || undefined });
      setPicked(null);
    } finally {
      setSaving(false);
    }
  };

  const alreadySaved = picked ? savedWords.has(picked.word) : false;

  return (
    <div className="absolute inset-x-0 bottom-28 z-30 flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {enabled && picked && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-auto w-[min(92%,420px)] rounded-2xl border p-3 shadow-2xl backdrop-blur-xl"
            style={{
              background: "rgba(14,14,26,0.97)",
              borderColor: THEME.colors.border.accent,
            }}
            role="dialog"
            aria-label={`Save the word ${picked.word}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-lg font-bold" style={{ color: THEME.colors.text.primary }}>
                  {picked.word}
                </div>
                <div className="text-[11px] italic line-clamp-2" style={{ color: THEME.colors.text.muted }}>
                  “{picked.sentence}” — {picked.speakerName}
                </div>
              </div>
              <button
                onClick={() => setPicked(null)}
                aria-label="Close"
                className="p-1 rounded-lg hover:bg-white/5"
                style={{ color: THEME.colors.text.muted }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void save()}
                maxLength={120}
                placeholder="Meaning in your words (optional)"
                aria-label="Meaning (optional)"
                className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none border"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderColor: THEME.colors.border.primary,
                  color: THEME.colors.text.primary,
                }}
              />
              <button
                onClick={() => void save()}
                disabled={saving}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                style={{ background: THEME.colors.accent.primary, color: "#fff" }}
              >
                {alreadySaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                {alreadySaved ? "Update" : "Save word"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {enabled && lines.length > 0 && (
          <motion.div
            key="captions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto w-[min(94%,720px)] rounded-2xl border px-4 py-3 space-y-1.5 backdrop-blur-xl"
            style={{
              background: "rgba(8,8,16,0.82)",
              borderColor: THEME.colors.border.primary,
            }}
            aria-live="polite"
            aria-label="Live captions"
          >
            {lines.map((line) => (
              <p key={line.id} className="text-sm leading-relaxed" style={{ color: THEME.colors.text.primary }}>
                <span
                  className="mr-2 text-[11px] font-semibold"
                  style={{ color: line.userId === userId ? THEME.colors.accent.cyan : THEME.colors.accent.primaryLight }}
                >
                  {line.userId === userId ? "You" : line.speaker}
                </span>
                {line.isFinal ? (
                  line.text.split(/\s+/).map((token, i) => {
                    const word = clean(token);
                    const saved = savedWords.has(word);
                    return (
                      <React.Fragment key={i}>
                        <button
                          type="button"
                          onClick={() => pick(word, line)}
                          title={saved ? "In your word bank — tap to update" : "Tap to save this word"}
                          className="rounded px-[1px] hover:bg-white/10 focus-visible:outline focus-visible:outline-1"
                          style={
                            saved
                              ? {
                                  textDecoration: "underline dotted",
                                  textDecorationColor: THEME.colors.accent.success,
                                  textUnderlineOffset: 3,
                                }
                              : undefined
                          }
                        >
                          {token}
                        </button>{" "}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <span className="italic" style={{ color: THEME.colors.text.secondary }}>
                    {line.text}…
                  </span>
                )}
              </p>
            ))}
            <p className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
              Tap a word to save it to your word bank
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={enabled ? "Hide live captions" : "Show live captions"}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] backdrop-blur-xl hover:bg-white/5"
        style={{
          background: "rgba(14,14,26,0.8)",
          borderColor: THEME.colors.border.primary,
          color: enabled ? THEME.colors.accent.primaryLight : THEME.colors.text.muted,
        }}
      >
        {enabled ? <Captions className="w-3.5 h-3.5" /> : <CaptionsOff className="w-3.5 h-3.5" />}
        Captions {enabled ? "on" : "off"}
      </button>
    </div>
  );
};

export default LiveCaptions;
