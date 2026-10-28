// apps/web/src/components/chat/CorrectionCard.tsx
/**
 * Language corrections in 1:1 chat (HelloTalk-style).
 *  - CorrectionCard: renders a CORRECTION message as a word diff of the original
 *    (replyTo) vs the corrected text, with the optional note and a "Got it" button
 *    for the person who was corrected.
 *  - CorrectionComposer: inline editor shown above the message box when you tap
 *    "Correct" on someone else's message.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, SpellCheck2, X, Send, Sparkles } from "lucide-react";
import { diffWords } from "../../lib/textDiff";
import type { Message } from "../../hooks/useChat";

// ============================================================
// Card
// ============================================================

export const CorrectionCard: React.FC<{
  message: Message;
  isOwn: boolean;
  /** I'm the person whose message was corrected */
  isRecipient: boolean;
  onAccept?: () => void;
}> = ({ message, isOwn, isRecipient, onAccept }) => {
  const original = message.replyTo?.content ?? "";
  const corrected = message.content ?? "";
  const parts = useMemo(() => diffWords(original, corrected), [original, corrected]);
  const note = typeof message.metadata?.note === "string" ? message.metadata.note : "";
  const accepted = Boolean(message.metadata?.acceptedAt);

  return (
    <div className="min-w-[220px] max-w-[min(420px,80vw)]">
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-2 ${isOwn ? "text-white/80" : "text-violet-600 dark:text-violet-300"}`}>
        <SpellCheck2 className="w-3.5 h-3.5" />
        {isOwn ? "Your correction" : "Correction for you"}
      </div>

      {original ? (
        <p className={`text-[13px] leading-relaxed line-through decoration-rose-400/80 ${isOwn ? "text-white/60" : "text-slate-400 dark:text-slate-500"}`}>
          {original}
        </p>
      ) : (
        <p className={`text-[12px] italic ${isOwn ? "text-white/60" : "text-slate-400"}`}>Original message unavailable</p>
      )}

      <p className={`mt-1.5 text-[14.5px] leading-relaxed ${isOwn ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
        {parts.map((part, i) =>
          part.kind === "same" ? (
            <span key={i}>{part.text}</span>
          ) : part.kind === "added" ? (
            <span
              key={i}
              className={`rounded px-0.5 font-semibold ${isOwn ? "bg-emerald-300/25 text-emerald-100" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}
            >
              {part.text}
            </span>
          ) : (
            <span
              key={i}
              className={`rounded px-0.5 line-through ${isOwn ? "bg-rose-300/20 text-rose-100/80" : "bg-rose-500/10 text-rose-500/90"}`}
            >
              {part.text}
            </span>
          ),
        )}
      </p>

      {note && (
        <p className={`mt-2 text-[12.5px] leading-snug rounded-lg px-2.5 py-1.5 ${isOwn ? "bg-white/10 text-white/90" : "bg-violet-500/[0.07] text-slate-600 dark:text-slate-300"}`}>
          💡 {note}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {accepted ? (
          <span className={`flex items-center gap-1 text-[11.5px] font-semibold ${isOwn ? "text-emerald-200" : "text-emerald-600 dark:text-emerald-400"}`}>
            <CheckCheck className="w-3.5 h-3.5" /> {isRecipient ? "Learned · +5 XP" : "They learned it"}
          </span>
        ) : isRecipient ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAccept?.();
            }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-semibold shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Got it · +5 XP
          </motion.button>
        ) : (
          <span className={`text-[11.5px] ${isOwn ? "text-white/60" : "text-slate-400"}`}>Waiting for them to review</span>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Composer
// ============================================================

export const CorrectionComposer: React.FC<{
  target: Message;
  onSend: (corrected: string, note: string) => void;
  onCancel: () => void;
}> = ({ target, onSend, onCancel }) => {
  const original = target.content ?? "";
  const [text, setText] = useState(original);
  const [note, setNote] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const changed = text.trim().length > 0 && text.trim() !== original.trim();
  const preview = useMemo(() => (changed ? diffWords(original, text) : []), [changed, original, text]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const submit = () => {
    if (!changed) return;
    onSend(text.trim(), note.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="mx-3 mb-2 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/80 dark:bg-violet-500/[0.07] p-3 shadow-sm"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-700 dark:text-violet-300">
          <SpellCheck2 className="w-4 h-4" /> Correct {target.sender?.name?.split(" ")[0] || "their"}'s message
        </span>
        <button type="button" onClick={onCancel} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/70 dark:hover:bg-white/10" aria-label="Cancel correction">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[12.5px] text-slate-500 dark:text-slate-400 line-through decoration-rose-400/70 mb-1.5">{original}</p>

      <textarea
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={Math.min(5, Math.max(2, text.split("\n").length))}
        className="w-full resize-none rounded-xl border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-400/50"
        aria-label="Corrected text"
      />

      {preview.length > 0 && (
        <p className="mt-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
          {preview.map((part, i) =>
            part.kind === "same" ? (
              <span key={i}>{part.text}</span>
            ) : part.kind === "added" ? (
              <span key={i} className="rounded px-0.5 font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{part.text}</span>
            ) : (
              <span key={i} className="rounded px-0.5 line-through bg-rose-500/10 text-rose-500">{part.text}</span>
            ),
          )}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a tip (optional) — e.g. “agree” is already a verb"
          className="flex-1 min-w-0 h-9 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-slate-900/60 px-3 text-[13px] text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-400/50"
          aria-label="Tip for your partner"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!changed}
          className="h-9 px-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold flex items-center gap-1.5 shrink-0"
        >
          <Send className="w-3.5 h-3.5" /> Send
        </button>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
        <Sparkles className="w-3 h-3" /> {changed ? "You earn 3 XP for helping" : "Edit the text above to correct it"}
      </p>
    </motion.div>
  );
};

export default CorrectionCard;
