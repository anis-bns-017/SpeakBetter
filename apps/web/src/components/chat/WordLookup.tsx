// apps/web/src/components/chat/WordLookup.tsx
/**
 * Select a word or short phrase in any chat message to get:
 *  - its meaning in your own language plus the English definition, phonetics and an example
 *    (looked up on our server with free services; only the selected text is sent),
 *  - pronunciation (normal / slow) with the browser's English voice,
 *  - "Save to flashcards" so it comes back in spaced-repetition review.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { BookmarkPlus, Check, Loader2, Turtle, Volume2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "../../lib/api/client";
import { canSpeak, speak } from "../../lib/speech";
import { meaningFrom, useLookupState } from "../../hooks/useLookup";
import { LookupBody } from "../lookup/LookupBody";

export interface WordSelection {
  text: string;
  /** The full message the selection came from (saved as context) */
  context: string;
  /** Viewport rect of the selection, for positioning */
  rect: { top: number; left: number; bottom: number; width: number };
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

export const WordLookup: React.FC<{ selection: WordSelection; onClose: () => void }> = ({ selection, onClose }) => {
  const queryClient = useQueryClient();
  const lookup = useLookupState(selection.text);
  const phonetic = lookup.data?.phonetic ?? null;
  const partOfSpeech = lookup.data?.meanings[0]?.partOfSpeech || null;
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click, Escape, or scrolling the page under it (it would no longer point at the text)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("scroll", onScroll, true);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // The popup lives in <body> (a portal), so a transformed or offset parent cannot shift it. It is measured
  // after it renders, and again whenever its size changes (the meaning arriving makes it taller), then put
  // above the selection when it fits there, otherwise below, and always kept inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const margin = 12;
      const gap = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(340, vw - margin * 2);
      el.style.width = `${width}px`;
      el.style.maxHeight = `${vh - margin * 2}px`;
      const height = el.offsetHeight;
      const { top, bottom, left, width: selectionWidth } = selection.rect;
      const x = Math.min(Math.max(left + selectionWidth / 2 - width / 2, margin), vw - width - margin);
      const roomAbove = top - gap - margin;
      const roomBelow = vh - bottom - gap - margin;
      const above = height <= roomAbove || (height > roomBelow && roomAbove > roomBelow);
      const y = above ? top - gap - height : bottom + gap;
      el.style.left = `${x}px`;
      el.style.top = `${Math.max(margin, Math.min(y, vh - height - margin))}px`;
      el.style.visibility = "visible";
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [selection.rect]);

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const data = lookup.data;
      const definitions = (data?.meanings ?? [])
        .slice(0, 3)
        .map((m) => `${m.partOfSpeech ? `(${m.partOfSpeech}) ` : ""}${m.definition}`);
      const similar = data?.synonyms.length ? `Similar: ${data.synonyms.slice(0, 5).join(", ")}` : "";
      const meaning = [data?.translation, ...definitions, similar].filter(Boolean).join("\n") || meaningFrom(data);
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

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.14 }}
      className="fixed left-0 top-0 z-[90] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-panel shadow-2xl p-3.5"
      // Hidden until it has been measured and placed
      style={{ visibility: "hidden", width: 340 }}
      role="dialog"
      aria-label={`Look up ${selection.text}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-slate-900 dark:text-white leading-tight break-words">{selection.text}</p>
          {(phonetic || partOfSpeech) && (
            <p className="text-xs text-slate-500 mt-0.5">
              {phonetic}
              {phonetic && partOfSpeech ? " · " : ""}
              <span className="italic">{partOfSpeech}</span>
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

      <div className="mt-2.5">
        <LookupBody lookup={lookup} sentence={selection.context} />
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
    </motion.div>,
    document.body,
  );
};

export default WordLookup;
