// apps/web/src/components/chat/WordLookup.tsx
/**
 * Select a word or short phrase in any chat message to get:
 *  - its definition, phonetics and an example (single words, via the free
 *    dictionaryapi.dev — only the selected word is sent),
 *  - pronunciation (normal / slow) with the browser's English voice,
 *  - "Save to flashcards" so it comes back in spaced-repetition review.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookmarkPlus, Check, Loader2, Turtle, Volume2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "../../lib/api/client";
import { canSpeak, speak } from "../../lib/speech";

export interface WordSelection {
  text: string;
  /** The full message the selection came from (saved as context) */
  context: string;
  /** Viewport rect of the selection, for positioning */
  rect: { top: number; left: number; bottom: number; width: number };
}

interface DictionaryResult {
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  example?: string;
}

const MAX_PHRASE_WORDS = 6;

/** Reads the current text selection if it's a short phrase inside `container` */
// eslint-disable-next-line react-refresh/only-export-components -- tiny helper used with this component
export function readSelection(container: HTMLElement | null): WordSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !container) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const text = selection.toString().replace(/\s+/g, " ").trim().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
  if (!text || text.length > 60 || text.split(" ").length > MAX_PHRASE_WORDS) return null;

  const bubble = (range.commonAncestorContainer as Element).parentElement?.closest("[data-message-text]");
  const rect = range.getBoundingClientRect();
  return {
    text,
    context: bubble?.getAttribute("data-message-text") || text,
    rect: { top: rect.top, left: rect.left, bottom: rect.bottom, width: rect.width },
  };
}

async function lookUp(word: string, signal: AbortSignal): Promise<DictionaryResult | null> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    phonetic?: string;
    phonetics?: Array<{ text?: string }>;
    meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }>;
  }>;
  const entry = data?.[0];
  if (!entry) return null;
  const meaning = entry.meanings?.[0];
  const def = meaning?.definitions?.find((d) => d.example) ?? meaning?.definitions?.[0];
  return {
    phonetic: entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text,
    partOfSpeech: meaning?.partOfSpeech,
    definition: def?.definition,
    example: def?.example,
  };
}

export const WordLookup: React.FC<{ selection: WordSelection; onClose: () => void }> = ({ selection, onClose }) => {
  const queryClient = useQueryClient();
  const isSingleWord = !selection.text.includes(" ");
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "none">(isSingleWord ? "loading" : "none");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSingleWord) return;
    const controller = new AbortController();
    lookUp(selection.text, controller.signal)
      .then((r) => {
        setResult(r);
        setStatus(r ? "done" : "none");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("none");
      });
    return () => controller.abort();
  }, [isSingleWord, selection.text]);

  // Close on outside click / Escape
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const meaning = result?.definition ? `${result.partOfSpeech ? `(${result.partOfSpeech}) ` : ""}${result.definition}` : "";
      const contextLine = selection.context !== selection.text ? `“${selection.context}”` : "";
      await apiClient.post("/learning/flashcards", {
        front: selection.text,
        back: [meaning, contextLine].filter(Boolean).join("\n\n") || "Saved from chat",
        language: "en",
      });
      setSaved(true);
      toast.success(`“${selection.text}” saved to your flashcards`);
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["learning-dashboard"] });
    } catch {
      toast.error("Couldn't save to flashcards");
    } finally {
      setSaving(false);
    }
  };

  // Place above the selection, flipping below when there's no room; keep inside the viewport
  const width = 300;
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, selection.rect.left + selection.rect.width / 2 - width / 2));
  const placeAbove = selection.rect.top > 260;
  const style: React.CSSProperties = placeAbove
    ? { left, bottom: window.innerHeight - selection.rect.top + 8, width }
    : { left, top: selection.rect.bottom + 8, width };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: placeAbove ? 6 : -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14 }}
      className="fixed z-[90] rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151521] shadow-2xl p-3.5"
      style={style}
      role="dialog"
      aria-label={`Look up ${selection.text}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-slate-900 dark:text-white leading-tight break-words">{selection.text}</p>
          {(result?.phonetic || result?.partOfSpeech) && (
            <p className="text-xs text-slate-500 mt-0.5">
              {result.phonetic}
              {result.phonetic && result.partOfSpeech ? " · " : ""}
              <span className="italic">{result.partOfSpeech}</span>
            </p>
          )}
        </div>
        {canSpeak() && (
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={() => void speak(selection.text)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100" aria-label="Pronounce" title="Pronounce">
              <Volume2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => void speak(selection.text, { rate: 0.6 })} className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200" aria-label="Pronounce slowly" title="Slowly">
              <Turtle className="w-4 h-4" />
            </button>
          </div>
        )}
        <button type="button" onClick={onClose} className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2.5 text-[13px] leading-relaxed">
        {status === "loading" && (
          <p className="flex items-center gap-2 text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking it up…</p>
        )}
        {status === "done" && result?.definition && (
          <>
            <p className="text-slate-700 dark:text-slate-200">{result.definition}</p>
            {result.example && <p className="mt-1.5 text-slate-500 italic">“{result.example}”</p>}
          </>
        )}
        {status === "none" && (
          <p className="text-slate-500">
            {isSingleWord ? "No dictionary entry found." : "Save this phrase to practise it later."}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || saved}
        className={`mt-3 w-full h-9 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors ${
          saved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
        }`}
      >
        {saved ? <><Check className="w-4 h-4" /> Saved to flashcards</> : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><BookmarkPlus className="w-4 h-4" /> Save to flashcards</>}
      </button>
    </motion.div>
  );
};

export default WordLookup;
