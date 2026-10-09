// apps/web/src/components/voice/shared/CorrectionsInbox.tsx
/**
 * CorrectionsInbox — floating panel showing corrections you've received.
 * Accept adds the fix to your personal "practice list" + posts a chat note.
 * Dismiss hides it.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Trash2,
  Sparkles,
  BookOpen,
  Mic2,
  MessageSquare,
  SpellCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type { VoiceCorrection } from "../../../hooks/useVoiceCorrections";

interface CorrectionsInboxProps {
  isOpen: boolean;
  onClose: () => void;
  corrections: VoiceCorrection[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

const CATEGORY_ICONS = {
  grammar: BookOpen,
  vocabulary: Sparkles,
  pronunciation: Mic2,
  "word-choice": MessageSquare,
  spelling: SpellCheck,
  other: Sparkles,
} as const;

export const CorrectionsInbox: React.FC<CorrectionsInboxProps> = ({
  isOpen,
  onClose,
  corrections,
  onAccept,
  onDismiss,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = corrections.filter((c) => c.status === "pending");
  const resolved = corrections.filter((c) => c.status !== "pending");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className="fixed top-16 left-4 w-[min(92vw,380px)] rounded-2xl border shadow-2xl backdrop-blur-2xl z-[80]"
          style={{
            background: "rgba(10, 10, 18, 0.97)",
            borderColor: THEME.colors.border.primary,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between gap-3 border-b"
            style={{
              borderColor: THEME.colors.border.primary,
              background:
                "linear-gradient(135deg, rgba(52,211,153,0.1), rgba(34,211,238,0.05))",
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${THEME.colors.accent.success}, ${THEME.colors.accent.cyan})`,
                }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: THEME.colors.text.primary }}
                >
                  Corrections
                </p>
                <p
                  className="text-[10px] truncate"
                  style={{ color: THEME.colors.text.muted }}
                >
                  {pending.length === 0
                    ? "No new corrections"
                    : `${pending.length} to review`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
              style={{ color: THEME.colors.text.muted }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-3 space-y-2">
            {pending.length === 0 && resolved.length === 0 && (
              <div className="text-center py-8">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "rgba(52,211,153,0.08)" }}
                >
                  <Sparkles
                    className="w-6 h-6"
                    style={{ color: THEME.colors.accent.success }}
                  />
                </div>
                <p
                  className="text-xs"
                  style={{ color: THEME.colors.text.muted }}
                >
                  Corrections will show up here as people help you improve.
                </p>
              </div>
            )}

            {pending.map((c) => {
              const Icon = CATEGORY_ICONS[c.category] ?? Sparkles;
              const isExpanded = expandedId === c.id;

              return (
                <div
                  key={c.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    background: "rgba(52,211,153,0.04)",
                    borderColor: "rgba(52,211,153,0.2)",
                  }}
                >
                  {/* Header row */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : c.id)
                    }
                    className="w-full px-3 py-2.5 flex items-start gap-2 text-left hover:bg-white/5 transition-colors"
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: "rgba(52,211,153,0.15)",
                        color: THEME.colors.accent.success,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[10px] uppercase tracking-wider font-semibold"
                        style={{ color: THEME.colors.accent.success }}
                      >
                        {c.category}
                      </p>
                      <p
                        className="text-xs truncate mt-0.5"
                        style={{ color: THEME.colors.text.primary }}
                      >
                        <span className="line-through opacity-60">
                          {c.original}
                        </span>
                        <span className="mx-1.5 opacity-40">→</span>
                        <span style={{ color: THEME.colors.accent.success }}>
                          {c.corrected}
                        </span>
                      </p>
                      <p
                        className="text-[10px] mt-0.5 truncate"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        from {c.authorName}
                      </p>
                    </div>

                    {isExpanded ? (
                      <ChevronUp
                        className="w-3.5 h-3.5 shrink-0 mt-1"
                        style={{ color: THEME.colors.text.muted }}
                      />
                    ) : (
                      <ChevronDown
                        className="w-3.5 h-3.5 shrink-0 mt-1"
                        style={{ color: THEME.colors.text.muted }}
                      />
                    )}
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="px-3 pb-3 space-y-2.5 border-t"
                          style={{ borderColor: "rgba(52,211,153,0.15)" }}
                        >
                          {c.note && (
                            <div className="pt-2.5">
                              <p
                                className="text-[9px] uppercase tracking-wider font-semibold mb-0.5"
                                style={{ color: THEME.colors.text.muted }}
                              >
                                Why
                              </p>
                              <p
                                className="text-[11px] italic leading-relaxed"
                                style={{ color: THEME.colors.text.secondary }}
                              >
                                {c.note}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                onAccept(c.id);
                                setExpandedId(null);
                              }}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-[11px] transition-all hover:scale-[1.02]"
                              style={{
                                background: `linear-gradient(135deg, ${THEME.colors.accent.success}, ${THEME.colors.accent.cyan})`,
                                color: "#fff",
                              }}
                            >
                              <Check className="w-3 h-3" />
                              Got it
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDismiss(c.id);
                                setExpandedId(null);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium hover:bg-red-500/10 transition-colors"
                              style={{ color: THEME.colors.accent.error }}
                            >
                              <Trash2 className="w-3 h-3" />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Resolved list */}
            {resolved.length > 0 && (
              <div
                className="pt-3 mt-2 border-t"
                style={{ borderColor: THEME.colors.border.primary }}
              >
                <p
                  className="text-[9px] uppercase tracking-wider font-semibold mb-2"
                  style={{ color: THEME.colors.text.muted }}
                >
                  History ({resolved.length})
                </p>
                <div className="space-y-1.5">
                  {resolved.slice(-5).reverse().map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.02)" }}
                    >
                      <span
                        className="text-[10px] shrink-0"
                        style={{
                          color:
                            c.status === "accepted"
                              ? THEME.colors.accent.success
                              : THEME.colors.text.muted,
                        }}
                      >
                        {c.status === "accepted" ? "✓" : "×"}
                      </span>
                      <p
                        className="text-[10px] truncate flex-1"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        <span className="line-through">{c.original}</span>
                        <span className="mx-1">→</span>
                        <span>{c.corrected}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CorrectionsInbox;