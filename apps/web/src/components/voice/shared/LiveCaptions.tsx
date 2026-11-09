// apps/web/src/components/voice/shared/LiveCaptions.tsx
/**
 * LiveCaptions — what people are saying, right in the room (free: each speaker's own browser turns their speech
 * into text, see useVoiceTranscription).
 * - Tap any word in a finished line to see what it means, open it in the Dictionary, and save it (with the
 *   sentence it was heard in) to your word bank; saved words are underlined.
 * - The transcript keeps the whole conversation since you joined, so you can go back over what someone said
 *   after their caption has faded, and copy it.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookA, BookmarkCheck, BookmarkPlus, Captions, CaptionsOff, Check, Copy, ExternalLink, ScrollText, X } from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type { VoiceTranscription } from "../../../hooks/useVoiceTranscription";
import { meaningFrom, useLookupState } from "../../../hooks/useLookup";
import { useFindDictWord } from "../../../hooks/useDictionary";
import { LookupBody } from "../../lookup/LookupBody";
import type { CaptionsStatus } from "./CoachDock";

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
  /** Whether your own speech can be captioned right now, and if not, why */
  status?: CaptionsStatus;
  /** The browser's speech recognition is running */
  listening?: boolean;
  /** Start captions again (after allowing the microphone) */
  onRetry?: () => void;
}

/** What to tell you when there are no lines to show */
const STATUS_HINT: Record<CaptionsStatus, string> = {
  listening: "Listening… start speaking and your words appear here.",
  muted: "Turn your microphone on to caption what you say.",
  unsupported: "This browser can't caption speech. Open the room in Chrome or Edge to caption yourself; you can still read everyone else's captions.",
  blocked: "Captions can't use your microphone. Allow the microphone for this site (the icon in the address bar), then try again.",
  network: "Captions can't reach the browser's speech service. Chrome needs an internet connection, and Brave blocks this service. Trying again…",
  "no-mic": "No microphone was found for captions. Plug one in, then try again.",
};

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

const timeOf = (t: VoiceTranscription) =>
  new Date(t.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** A finished line as tappable words */
const Words: React.FC<{
  line: VoiceTranscription;
  savedWords: Set<string>;
  onPick: (word: string, line: VoiceTranscription) => void;
}> = ({ line, savedWords, onPick }) => (
  <>
    {line.text.split(/\s+/).map((token, i) => {
      const word = clean(token);
      const saved = savedWords.has(word);
      return (
        <React.Fragment key={i}>
          <button
            type="button"
            onClick={() => onPick(word, line)}
            title={saved ? "In your word bank: tap to see it" : "Tap to see what it means"}
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
    })}
  </>
);

/** Level and a link to the Dictionary, when the dictionary has the word */
const DictionaryLink: React.FC<{ word: string }> = ({ word }) => {
  const { data } = useFindDictWord(word);
  if (!data) return null;
  return (
    <a
      href={`/dictionary/${encodeURIComponent(data.id)}`}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs hover:bg-white/5"
      style={{ borderColor: THEME.colors.border.primary, color: THEME.colors.text.secondary }}
      title="Opens in a new tab, so you stay in the room"
    >
      <BookA className="w-4 h-4 shrink-0" style={{ color: THEME.colors.accent.primaryLight }} />
      <span className="min-w-0 flex-1">
        <span className="font-semibold" style={{ color: THEME.colors.text.primary }}>
          {data.word}
        </span>
        {data.word.toLowerCase() !== word && <span> (the word behind “{word}”)</span>}
        <span className="block truncate">
          {data.level} · {data.commonness}
        </span>
      </span>
      <span className="shrink-0 inline-flex items-center gap-1 font-semibold" style={{ color: THEME.colors.accent.primaryLight }}>
        Open in Dictionary <ExternalLink className="w-3 h-3" />
      </span>
    </a>
  );
};

export const LiveCaptions: React.FC<LiveCaptionsProps> = ({
  transcriptions,
  userId,
  savedWords,
  onSave,
  status = "listening",
  listening = false,
  onRetry,
}) => {
  const [enabled, setEnabled] = useState(readEnabled);
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState<{
    word: string;
    sentence: string;
    speakerName: string;
  } | null>(null);
  const [meaning, setMeaning] = useState("");
  const [saving, setSaving] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // What the tapped word means, so saving it does not need typing
  const lookup = useLookupState(picked?.word ?? "");
  const suggested = meaningFrom(lookup.data).slice(0, 120);

  // Old lines fade away; tick only while there is something to age out
  const hasLines = transcriptions.length > 0;
  useEffect(() => {
    if (!enabled || !hasLines || showTranscript) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [enabled, hasLines, showTranscript]);

  const finals = useMemo(() => transcriptions.filter((t) => t.isFinal && t.text.trim()), [transcriptions]);

  // The transcript follows new lines, unless you have scrolled up to read
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !showTranscript) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [finals.length, showTranscript]);

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
    setShowTranscript(false);
  };

  const lines = useMemo(() => {
    const fresh = transcriptions.filter(
      (t) => now - new Date(t.timestamp).getTime() < LINE_TTL_MS && t.text.trim(),
    );
    // One live (partial) line per person, plus the latest finished lines
    const freshFinals = fresh.filter((t) => t.isFinal).slice(-MAX_LINES);
    const partials = fresh.filter((t) => !t.isFinal);
    return [...freshFinals, ...partials].slice(-MAX_LINES);
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
      await onSave({ ...picked, meaning: meaning.trim() || suggested || undefined });
      setPicked(null);
    } finally {
      setSaving(false);
    }
  };

  const copyTranscript = async () => {
    const text = finals.map((t) => `[${timeOf(t)}] ${t.userId === userId ? "You" : t.speaker}: ${t.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the clipboard is blocked; nothing to do */
    }
  };

  const alreadySaved = picked ? savedWords.has(picked.word) : false;
  const nameOf = (t: VoiceTranscription) => (t.userId === userId ? "You" : t.speaker);
  const colourOf = (t: VoiceTranscription) => (t.userId === userId ? THEME.colors.accent.cyan : THEME.colors.accent.primaryLight);

  return (
    // Above the speaker queue while the transcript or a word card is open, so neither is covered
    <div className={`absolute inset-x-0 bottom-28 ${showTranscript || picked ? "z-40" : "z-30"} flex flex-col items-center gap-2 px-4 pointer-events-none`}>
      <AnimatePresence>
        {enabled && picked && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`pointer-events-auto w-[min(92%,420px)] ${showTranscript ? "max-h-[min(30vh,260px)]" : "max-h-[min(40vh,380px)]"} flex flex-col rounded-2xl border p-3 shadow-2xl backdrop-blur-xl`}
            style={{
              background: "var(--sx-bg-14-14-26-970)",
              borderColor: THEME.colors.border.accent,
            }}
            role="dialog"
            aria-label={`The word ${picked.word}`}
          >
            <div className="shrink-0 flex items-start justify-between gap-2">
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
            {/* The meanings scroll; the word and the save row stay in view */}
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <LookupBody lookup={lookup} tone="dark" />
            </div>
            <div className="shrink-0">
              <DictionaryLink word={picked.word} />
            </div>
            <div className="shrink-0 flex gap-2 mt-2">
              <input
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void save()}
                maxLength={120}
                placeholder={suggested ? "Use the meaning above, or type your own" : "Meaning in your words (optional)"}
                aria-label="Meaning (optional)"
                className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none border"
                style={{
                  background: "var(--sx-bg-255-255-255-40)",
                  borderColor: THEME.colors.border.primary,
                  color: THEME.colors.text.primary,
                }}
              />
              <button
                onClick={() => void save()}
                disabled={saving}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                style={{ background: THEME.colors.accent.primary, color: "var(--sx-text-ffffff)" }}
              >
                {alreadySaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                {alreadySaved ? "Update" : "Save word"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The whole conversation since you joined */}
      <AnimatePresence>
        {enabled && showTranscript && (
          <motion.section
            key="transcript"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-auto w-[min(94%,720px)] rounded-2xl border backdrop-blur-xl overflow-hidden"
            style={{ background: "var(--sx-bg-8-8-16-820)", borderColor: THEME.colors.border.primary }}
            aria-label="Room transcript"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: THEME.colors.border.primary }}>
              <ScrollText className="w-4 h-4" style={{ color: THEME.colors.accent.primaryLight }} />
              <h3 className="text-sm font-semibold" style={{ color: THEME.colors.text.primary }}>
                Transcript
              </h3>
              <span className="text-[11px]" style={{ color: THEME.colors.text.muted }}>
                {finals.length} {finals.length === 1 ? "line" : "lines"} since you joined
              </span>
              <span className="flex-1" />
              {finals.length > 0 && (
                <button
                  type="button"
                  onClick={() => void copyTranscript()}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold hover:bg-white/5"
                  style={{ color: copied ? THEME.colors.accent.success : THEME.colors.text.secondary }}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy"}
                </button>
              )}
              <button type="button" onClick={() => setShowTranscript(false)} aria-label="Close transcript" className="p-1 rounded-lg hover:bg-white/5" style={{ color: THEME.colors.text.muted }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Shorter while a word card is open above it, so both fit on screen */}
            <div ref={scrollerRef} className={`${picked ? "max-h-[min(20vh,180px)]" : "max-h-[min(46vh,420px)]"} overflow-y-auto px-4 py-3 space-y-2.5`}>
              {finals.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color: THEME.colors.text.muted }}>
                  Nothing said yet. What people say will appear here.
                </p>
              ) : (
                finals.map((line, i) => {
                  const sameSpeaker = i > 0 && finals[i - 1].userId === line.userId;
                  return (
                    <div key={line.id}>
                      {!sameSpeaker && (
                        <p className="text-[11px] font-semibold mb-0.5" style={{ color: colourOf(line) }}>
                          {nameOf(line)} <span className="font-normal" style={{ color: THEME.colors.text.muted }}>· {timeOf(line)}</span>
                        </p>
                      )}
                      <p className="text-sm leading-relaxed" style={{ color: THEME.colors.text.primary }}>
                        <Words line={line} savedWords={savedWords} onPick={pick} />
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {enabled && !showTranscript && lines.length > 0 && (
          <motion.div
            key="captions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto w-[min(94%,720px)] rounded-2xl border px-4 py-3 space-y-1.5 backdrop-blur-xl"
            style={{
              background: "var(--sx-bg-8-8-16-820)",
              borderColor: THEME.colors.border.primary,
            }}
            aria-live="polite"
            aria-label="Live captions"
          >
            {lines.map((line) => (
              <p key={line.id} className="text-sm leading-relaxed" style={{ color: THEME.colors.text.primary }}>
                <span className="mr-2 text-[11px] font-semibold" style={{ color: colourOf(line) }}>
                  {nameOf(line)}
                </span>
                {line.isFinal ? (
                  <Words line={line} savedWords={savedWords} onPick={pick} />
                ) : (
                  <span className="italic" style={{ color: THEME.colors.text.secondary }}>
                    {line.text}…
                  </span>
                )}
              </p>
            ))}
            <p className="text-[11px]" style={{ color: THEME.colors.text.muted }}>
              Tap a word to see what it means and save it
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nothing to show yet: say whether we are listening, or why not */}
      {enabled && !showTranscript && lines.length === 0 && (status !== "listening" || listening) && (
        <div
          className="pointer-events-auto max-w-[min(94%,560px)] rounded-xl border px-3 py-2 text-xs flex items-center gap-2 backdrop-blur-xl"
          style={{
            background: "var(--sx-bg-14-14-26-800)",
            borderColor: status === "listening" ? THEME.colors.border.primary : THEME.colors.border.accent,
            color: THEME.colors.text.secondary,
          }}
          role="status"
        >
          {status === "listening" && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: THEME.colors.accent.success }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: THEME.colors.accent.success }} />
            </span>
          )}
          <span>{STATUS_HINT[status]}</span>
          {(status === "blocked" || status === "no-mic") && onRetry && (
            <button type="button" onClick={onRetry} className="shrink-0 rounded-lg px-2 py-1 font-semibold hover:bg-white/10" style={{ color: THEME.colors.accent.primaryLight }}>
              Try again
            </button>
          )}
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={enabled ? "Hide live captions" : "Show live captions"}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] backdrop-blur-xl hover:bg-white/5"
          style={{
            background: "var(--sx-bg-14-14-26-800)",
            borderColor: THEME.colors.border.primary,
            color: enabled ? THEME.colors.accent.primaryLight : THEME.colors.text.muted,
          }}
        >
          {enabled ? <Captions className="w-3.5 h-3.5" /> : <CaptionsOff className="w-3.5 h-3.5" />}
          Captions {enabled ? "on" : "off"}
        </button>
        {enabled && (
          <button
            onClick={() => setShowTranscript((v) => !v)}
            aria-pressed={showTranscript}
            aria-label={showTranscript ? "Hide the transcript" : "Show the transcript"}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] backdrop-blur-xl hover:bg-white/5"
            style={{
              background: "var(--sx-bg-14-14-26-800)",
              borderColor: THEME.colors.border.primary,
              color: showTranscript ? THEME.colors.accent.primaryLight : THEME.colors.text.secondary,
            }}
          >
            <ScrollText className="w-3.5 h-3.5" />
            Transcript{finals.length > 0 ? ` (${finals.length})` : ""}
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveCaptions;
