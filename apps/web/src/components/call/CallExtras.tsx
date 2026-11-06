// apps/web/src/components/call/CallExtras.tsx
import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookmarkPlus, Captions, Check, Lightbulb, Send, X } from "lucide-react";
import { COLORS } from "../voice/lobby/lobbyTheme";
import {
  REACTION_EMOJIS,
  type CallTip,
  type FloatingReaction,
} from "./useCallExtras";

// ---- Reactions ----
export const ReactionBar: React.FC<{ onReact: (emoji: string) => void }> = ({ onReact }) => (
  <div
    className="flex items-center justify-center gap-1 rounded-full border px-2 py-1"
    style={{ borderColor: COLORS.border, background: "var(--sx-bg-28-20-48-600)" }}
    role="group"
    aria-label="Send a reaction"
  >
    {REACTION_EMOJIS.map((emoji) => (
      <button
        key={emoji}
        onClick={() => onReact(emoji)}
        aria-label={`React ${emoji}`}
        className="rounded-full px-2 py-1 text-xl transition-transform hover:scale-125 active:scale-95"
      >
        {emoji}
      </button>
    ))}
  </div>
);

/** Emojis float up over the avatars: yours on the right, your partner's on the left */
export const ReactionFloat: React.FC<{ reactions: FloatingReaction[] }> = ({ reactions }) => {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.span
            key={reaction.id}
            initial={{ opacity: 0, y: 40, scale: 0.6 }}
            animate={reduce ? { opacity: 1, y: 0, scale: 1 } : { opacity: [0, 1, 1, 0], y: -90, scale: [0.6, 1.3, 1.1, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.6, ease: "easeOut" }}
            className="absolute bottom-6 text-4xl"
            style={{ left: `${reaction.mine ? 68 + (reaction.id % 4) * 6 : 18 + (reaction.id % 4) * 6}%` }}
          >
            {reaction.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ---- Live captions with tap-to-save ----
const cleanWord = (raw: string) => raw.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");

const CaptionWords: React.FC<{
  text: string;
  saved: Set<string>;
  onSave: (word: string, sentence: string) => void;
  dim?: boolean;
}> = ({ text, saved, onSave, dim }) => (
  <>
    {text.split(/\s+/).map((raw, i) => {
      const word = cleanWord(raw).toLowerCase();
      const canSave = word.length >= 3;
      const isSaved = saved.has(word);
      return (
        <React.Fragment key={`${raw}-${i}`}>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => canSave && onSave(word, text)}
            title={canSave ? (isSaved ? "Saved to your word bank" : "Tap to save this word") : undefined}
            className="rounded px-0.5 transition-colors enabled:hover:bg-white/10 disabled:cursor-default"
            style={{
              color: isSaved ? COLORS.spotlight : dim ? COLORS.textMuted : COLORS.textPrimary,
              textDecoration: isSaved ? "underline dotted" : undefined,
            }}
          >
            {raw}
          </button>{" "}
        </React.Fragment>
      );
    })}
  </>
);

export const CaptionsPanel: React.FC<{
  supported: boolean;
  on: boolean;
  error: string | null;
  partnerName: string;
  lines: string[];
  interim: string;
  myCaption: string;
  saved: Set<string>;
  onToggle: () => void;
  onSaveWord: (word: string, sentence: string) => void;
}> = ({ supported, on, error, partnerName, lines, interim, myCaption, saved, onToggle, onSaveWord }) => (
  <section
    aria-label="Live captions"
    className="rounded-3xl border px-4 py-3"
    style={{ borderColor: COLORS.border, background: "var(--sx-bg-28-20-48-600)" }}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
        <Captions className="h-4 w-4" style={{ color: COLORS.live }} />
        Live captions
      </span>
      <button
        onClick={onToggle}
        aria-pressed={on}
        className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        style={{
          borderColor: on ? COLORS.live : COLORS.border,
          background: on ? COLORS.liveDim : "transparent",
          color: on ? COLORS.live : COLORS.textMuted,
        }}
      >
        {on ? "On" : "Off"}
      </button>
    </div>

    {!supported && on && (
      <p className="mt-2 text-xs" style={{ color: COLORS.textSecondary }}>
        Your browser cannot turn your speech into text, so you can read {partnerName}'s captions but not share yours. Chrome
        and Edge can do both.
      </p>
    )}
    {!on && (
      <p className="mt-2 text-xs" style={{ color: COLORS.textSecondary }}>
        Turn on to read what {partnerName} says (when they share captions too) and tap words to save them. Your own words are
        shared as text with your partner only while this is on.
      </p>
    )}
    {error && (
      <p className="mt-2 text-xs" role="alert" style={{ color: COLORS.danger }}>
        {error}
      </p>
    )}

    {on && (
      <div className="mt-3 space-y-1.5 text-sm leading-relaxed" aria-live="off">
        {lines.length === 0 && !interim && (
          <p className="text-xs" style={{ color: COLORS.textSecondary }}>
            Waiting for {partnerName} to speak with captions on...
          </p>
        )}
        {lines.map((line, i) => (
          <p key={`${i}-${line}`} style={{ opacity: 0.55 + (0.45 * (i + 1)) / lines.length }}>
            <CaptionWords text={line} saved={saved} onSave={onSaveWord} />
          </p>
        ))}
        {interim && (
          <p>
            <CaptionWords text={interim} saved={saved} onSave={onSaveWord} dim />
          </p>
        )}
        {myCaption && (
          <p className="border-t pt-1.5 text-xs italic" style={{ borderColor: COLORS.border, color: COLORS.textSecondary }}>
            You: {myCaption}
          </p>
        )}
      </div>
    )}
  </section>
);

// ---- Friendly correction tips ----
export const TipComposer: React.FC<{
  partnerName: string;
  sentCount: number;
  onSend: (text: string) => void;
}> = ({ partnerName, sentCount, onSend }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [justSent, setJustSent] = useState(false);

  const submit = () => {
    if (text.trim().length < 2) return;
    onSend(text);
    setText("");
    setJustSent(true);
    window.setTimeout(() => setJustSent(false), 2500);
  };

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
        style={{ borderColor: COLORS.border, color: COLORS.textPrimary }}
      >
        <Lightbulb className="h-4 w-4" style={{ color: COLORS.spotlight }} />
        Give {partnerName} a tip
        {sentCount > 0 && (
          <span className="rounded-full px-1.5 text-[11px]" style={{ background: COLORS.spotlightDim, color: COLORS.spotlight }}>
            {sentCount}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                placeholder={'Say "I went" instead of "I goed"'}
                aria-label="Your tip"
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#F5A623]"
                style={{ background: COLORS.surfaceRaised, borderColor: COLORS.border, color: COLORS.textPrimary }}
              />
              <button
                type="submit"
                disabled={text.trim().length < 2}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: COLORS.spotlight, color: COLORS.void }}
              >
                {justSent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {justSent ? "Sent" : "Send"}
              </button>
            </form>
            <p className="mt-1.5 text-[11px]" style={{ color: COLORS.textSecondary }}>
              Be kind and short. {partnerName} keeps your tips after the call.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Tips from your partner, shown during the call; the recap keeps all of them */
export const TipsInbox: React.FC<{
  partnerName: string;
  tips: CallTip[];
  onDismiss: (id: number) => void;
}> = ({ partnerName, tips, onDismiss }) => (
  <AnimatePresence initial={false}>
    {tips.map((tip) => (
      <motion.div
        key={tip.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        role="status"
        className="flex items-start gap-3 rounded-2xl border px-4 py-3"
        style={{ borderColor: `color-mix(in srgb, ${COLORS.spotlight} 33.3%, transparent)`, background: COLORS.spotlightDim }}
      >
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: COLORS.spotlight }} />
        <p className="min-w-0 flex-1 text-sm" style={{ color: COLORS.textPrimary }}>
          <span className="font-semibold">{partnerName} says: </span>
          {tip.text}
        </p>
        <button
          onClick={() => onDismiss(tip.id)}
          aria-label="Dismiss tip"
          className="shrink-0"
          style={{ color: COLORS.textMuted }}
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    ))}
  </AnimatePresence>
);

export const SavedWordsHint: React.FC<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <p className="flex items-center justify-center gap-1.5 text-xs" style={{ color: COLORS.spotlight }}>
      <BookmarkPlus className="h-3.5 w-3.5" />
      {count} word{count > 1 ? "s" : ""} saved from this call
    </p>
  ) : null;
