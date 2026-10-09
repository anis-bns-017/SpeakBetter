// apps/web/src/components/voice/shared/CorrectionSheet.tsx
/**
 * CorrectionSheet — modal for submitting a polite correction.
 * Category pills + auto-filled original text + live preview.
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Sparkles,
  SpellCheck,
  BookOpen,
  Mic2,
  MessageSquare,
  Send,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { THEME } from "../VoiceRoomView.theme";
import type { CorrectionCategory } from "../../../hooks/useVoiceCorrections";

interface CorrectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string;
  /** Prefilled original text — usually the last final transcription from target */
  initialOriginal?: string;
  onSubmit: (payload: {
    original: string;
    corrected: string;
    note?: string;
    category: CorrectionCategory;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

const CATEGORIES: {
  key: CorrectionCategory;
  label: string;
  icon: typeof Sparkles;
  color: string;
  hint: string;
}[] = [
  {
    key: "grammar",
    label: "Grammar",
    icon: BookOpen,
    color: "#22d3ee",
    hint: "Word order, tenses, agreement",
  },
  {
    key: "vocabulary",
    label: "Vocabulary",
    icon: Sparkles,
    color: "#a78bfa",
    hint: "A better word for this context",
  },
  {
    key: "pronunciation",
    label: "Pronunciation",
    icon: Mic2,
    color: "#fbbf24",
    hint: "Sound or stress issue",
  },
  {
    key: "word-choice",
    label: "Word choice",
    icon: MessageSquare,
    color: "#34d399",
    hint: "More natural phrasing",
  },
  {
    key: "spelling",
    label: "Spelling",
    icon: SpellCheck,
    color: "#f472b6",
    hint: "Written form",
  },
  {
    key: "other",
    label: "Other",
    icon: Sparkles,
    color: "#94a3b8",
    hint: "Anything else",
  },
];

export const CorrectionSheet: React.FC<CorrectionSheetProps> = ({
  isOpen,
  onClose,
  targetName,
  initialOriginal = "",
  onSubmit,
  isSubmitting = false,
}) => {
  const [original, setOriginal] = useState(initialOriginal);
  const [corrected, setCorrected] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<CorrectionCategory>("grammar");

  useEffect(() => {
    if (isOpen) {
      setOriginal(initialOriginal);
      setCorrected("");
      setNote("");
      setCategory("grammar");
    }
  }, [isOpen, initialOriginal]);

  const canSubmit = useMemo(
    () =>
      original.trim().length > 0 &&
      corrected.trim().length > 0 &&
      !isSubmitting,
    [original, corrected, isSubmitting],
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await onSubmit({
        original: original.trim(),
        corrected: corrected.trim(),
        note: note.trim() || undefined,
        category,
      });
      toast.success(`💬 Correction sent to ${targetName}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Couldn't send correction");
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !isSubmitting) onClose();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-[85] px-4"
          onClick={isSubmitting ? undefined : onClose}
          onKeyDown={handleKey}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="rounded-3xl w-full max-w-lg border overflow-hidden"
            style={{
              background: THEME.colors.background.card,
              borderColor: THEME.colors.border.primary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 pt-5 pb-4 flex items-start justify-between gap-3"
              style={{
                background:
                  "linear-gradient(135deg, rgba(52,211,153,0.12), rgba(129,140,248,0.06))",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.colors.accent.success}, ${THEME.colors.accent.cyan})`,
                  }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3
                    className="text-base font-bold truncate"
                    style={{ color: THEME.colors.text.primary }}
                  >
                    Help {targetName}
                  </h3>
                  <p
                    className="text-xs truncate"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Polite, encouraging correction
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0 disabled:opacity-40"
                style={{ color: THEME.colors.text.muted }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Category pills */}
              <div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider block mb-2"
                  style={{ color: THEME.colors.text.muted }}
                >
                  Category
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    const active = category === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCategory(c.key)}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all hover:-translate-y-0.5"
                        style={{
                          background: active
                            ? `${c.color}22`
                            : "rgba(255,255,255,0.02)",
                          borderColor: active
                            ? `${c.color}66`
                            : THEME.colors.border.primary,
                        }}
                        title={c.hint}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{
                            color: active
                              ? c.color
                              : THEME.colors.text.muted,
                          }}
                        />
                        <span
                          className="text-[10px] font-medium"
                          style={{
                            color: active
                              ? c.color
                              : THEME.colors.text.secondary,
                          }}
                        >
                          {c.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Original */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    What they said
                  </span>
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    {original.length}/300
                  </span>
                </div>
                <textarea
                  value={original}
                  onChange={(e) => setOriginal(e.target.value.slice(0, 300))}
                  placeholder={`Type what ${targetName} said, or paste from the transcript...`}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border resize-none transition-all focus:ring-1"
                  style={{
                    background: THEME.colors.background.primary,
                    borderColor: THEME.colors.border.primary,
                    color: THEME.colors.text.primary,
                  }}
                  disabled={isSubmitting}
                />
              </div>

              {/* Arrow divider */}
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-px"
                  style={{ background: THEME.colors.border.primary }}
                />
                <ArrowRight
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: THEME.colors.accent.success }}
                />
                <div
                  className="flex-1 h-px"
                  style={{ background: THEME.colors.border.primary }}
                />
              </div>

              {/* Corrected */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.accent.success }}
                  >
                    Better way
                  </span>
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    {corrected.length}/300
                  </span>
                </div>
                <textarea
                  value={corrected}
                  onChange={(e) => setCorrected(e.target.value.slice(0, 300))}
                  placeholder="The corrected version"
                  rows={2}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border resize-none transition-all focus:ring-1"
                  style={{
                    background: THEME.colors.background.primary,
                    borderColor:
                      corrected.trim().length > 0
                        ? "rgba(52,211,153,0.35)"
                        : THEME.colors.border.primary,
                    color: THEME.colors.text.primary,
                  }}
                  disabled={isSubmitting}
                />
              </div>

              {/* Optional note */}
              <div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5"
                  style={{ color: THEME.colors.text.muted }}
                >
                  Why? (optional)
                </span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 160))}
                  placeholder="e.g. In Spanish, adjectives come after the noun"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border transition-all focus:ring-1"
                  style={{
                    background: THEME.colors.background.primary,
                    borderColor: THEME.colors.border.primary,
                    color: THEME.colors.text.primary,
                  }}
                  disabled={isSubmitting}
                />
              </div>

              {/* Preview */}
              {original.trim() && corrected.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border p-3 space-y-1.5"
                  style={{
                    background: "rgba(52,211,153,0.04)",
                    borderColor: "rgba(52,211,153,0.2)",
                  }}
                >
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider block"
                    style={{ color: THEME.colors.accent.success }}
                  >
                    Preview
                  </span>
                  <p
                    className="text-xs line-through"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    {original}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: THEME.colors.text.primary }}
                  >
                    <Check
                      className="w-3 h-3 inline mr-1"
                      style={{ color: THEME.colors.accent.success }}
                    />
                    {corrected}
                  </p>
                  {note.trim() && (
                    <p
                      className="text-[10px] italic"
                      style={{ color: THEME.colors.text.muted }}
                    >
                      {note}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-full text-xs font-medium hover:bg-white/5 transition-colors disabled:opacity-40"
                  style={{ color: THEME.colors.text.muted }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.colors.accent.success}, ${THEME.colors.accent.cyan})`,
                    color: "#fff",
                    boxShadow: `0 6px 20px ${THEME.colors.accent.success}44`,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send correction
                    </>
                  )}
                </button>
              </div>

              <p
                className="text-[9px] text-center"
                style={{ color: THEME.colors.text.muted }}
              >
                Be kind — everyone is learning ✨
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CorrectionSheet;