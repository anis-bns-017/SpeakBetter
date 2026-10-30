// apps/web/src/components/voice/shared/AICoHost.tsx
/**
 * AICoHost — floating AI assistant panel.
 * Shows icebreakers when the room is quiet + a post-session summary.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Send,
  Check,
  Copy,
  RefreshCcw,
  FileText,
  Loader2,
  Wand2,
  Lightbulb,
  Download,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { THEME } from "../VoiceRoomView.theme";
import type {
  CoHostSuggestion,
  CoHostSummary,
} from "../../../hooks/useAICoHost";

interface AICoHostProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  isModerator: boolean;
  suggestion: CoHostSuggestion | null;
  onDismissSuggestion: () => void;
  onSuggestNow: () => void;
  summary: CoHostSummary | null;
  isSummarizing: boolean;
  onGenerateSummary: () => Promise<CoHostSummary | null>;
  onClearSummary: () => void;
  exportText: string;
  /** Called when host wants to insert a suggestion into chat */
  onUseSuggestion: (text: string) => void;
}

export const AICoHost: React.FC<AICoHostProps> = ({
  isOpen,
  onClose,
  isHost,
  isModerator,
  suggestion,
  onDismissSuggestion,
  onSuggestNow,
  summary,
  isSummarizing,
  onGenerateSummary,
  onClearSummary,
  exportText,
  onUseSuggestion,
}) => {
  const [copied, setCopied] = useState(false);

  const handleUseSuggestion = (text: string) => {
    onUseSuggestion(text);
    toast.success("Added to chat input");
    onDismissSuggestion();
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      toast.success("Summary copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy summary");
    }
  };

  const handleDownloadSummary = () => {
    try {
      const blob = new Blob([exportText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-summary-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Summary downloaded");
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed top-16 left-4 w-[min(92vw,380px)] rounded-2xl border shadow-2xl backdrop-blur-2xl z-[80] overflow-hidden"
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
                "linear-gradient(135deg, rgba(129,140,248,0.14), rgba(167,139,250,0.06))",
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
                }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: THEME.colors.text.primary }}
                >
                  AI Co-host
                </p>
                <p
                  className="text-[10px] truncate"
                  style={{ color: THEME.colors.text.muted }}
                >
                  Keeps the conversation flowing
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

          {/* Body */}
          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {/* Current suggestion */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Lightbulb
                    className="w-3.5 h-3.5"
                    style={{ color: THEME.colors.accent.warning }}
                  />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Live suggestion
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onSuggestNow}
                  className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
                  style={{ color: THEME.colors.accent.primary }}
                >
                  <RefreshCcw className="w-3 h-3" />
                  Regenerate
                </button>
              </div>

              <AnimatePresence mode="wait">
                {suggestion ? (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-xl border p-3"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(129,140,248,0.08), rgba(167,139,250,0.03))",
                      borderColor: THEME.colors.border.primary,
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                        style={{
                          background:
                            suggestion.category === "icebreaker"
                              ? "rgba(34,211,238,0.15)"
                              : suggestion.category === "topic"
                                ? "rgba(129,140,248,0.15)"
                                : "rgba(251,191,36,0.15)",
                          color:
                            suggestion.category === "icebreaker"
                              ? THEME.colors.accent.cyan
                              : suggestion.category === "topic"
                                ? THEME.colors.accent.primary
                                : THEME.colors.accent.warning,
                        }}
                      >
                        {suggestion.category}
                      </span>
                    </div>

                    <p
                      className="text-sm leading-snug mb-3"
                      style={{ color: THEME.colors.text.primary }}
                    >
                      {suggestion.text}
                    </p>

                    {(isHost || isModerator) && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUseSuggestion(suggestion.text)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-[11px] transition-all hover:scale-[1.02] active:scale-95"
                          style={{
                            background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
                            color: "#fff",
                          }}
                        >
                          <Send className="w-3 h-3" />
                          Share with room
                        </button>
                        <button
                          type="button"
                          onClick={onDismissSuggestion}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 transition-colors"
                          style={{ color: THEME.colors.text.muted }}
                        >
                          Skip
                        </button>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border p-4 text-center"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      borderColor: THEME.colors.border.primary,
                    }}
                  >
                    <Wand2
                      className="w-6 h-6 mx-auto mb-2"
                      style={{ color: THEME.colors.accent.primary }}
                    />
                    <p
                      className="text-xs"
                      style={{ color: THEME.colors.text.muted }}
                    >
                      Monitoring the room. A suggestion will appear when
                      things get quiet.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Summary section */}
            <div className="pt-3 border-t" style={{ borderColor: THEME.colors.border.primary }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <FileText
                    className="w-3.5 h-3.5"
                    style={{ color: THEME.colors.accent.cyan }}
                  />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Session summary
                  </span>
                </div>
                {summary && (
                  <button
                    type="button"
                    onClick={onClearSummary}
                    className="text-[10px] hover:underline"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {isSummarizing ? (
                <div
                  className="rounded-xl border p-4 text-center"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    borderColor: THEME.colors.border.primary,
                  }}
                >
                  <Loader2
                    className="w-5 h-5 mx-auto animate-spin mb-2"
                    style={{ color: THEME.colors.accent.primary }}
                  />
                  <p
                    className="text-[11px]"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Generating summary…
                  </p>
                </div>
              ) : summary ? (
                <div
                  className="rounded-xl border p-3 space-y-2.5"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    borderColor: THEME.colors.border.primary,
                  }}
                >
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: THEME.colors.text.primary }}
                  >
                    {summary.summary}
                  </p>

                  {summary.keyPoints.length > 0 && (
                    <div>
                      <p
                        className="text-[9px] font-semibold uppercase tracking-wider mb-1"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        Key points
                      </p>
                      <ul className="space-y-1">
                        {summary.keyPoints.map((p, i) => (
                          <li
                            key={i}
                            className="text-[11px] flex gap-1.5"
                            style={{ color: THEME.colors.text.secondary }}
                          >
                            <span
                              style={{ color: THEME.colors.accent.primary }}
                            >
                              •
                            </span>
                            <span className="flex-1">{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.newWords.length > 0 && (
                    <div>
                      <p
                        className="text-[9px] font-semibold uppercase tracking-wider mb-1"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        Words mentioned
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {summary.newWords.map((w) => (
                          <span
                            key={w}
                            className="text-[10px] px-1.5 py-0.5 rounded-md"
                            style={{
                              background: "rgba(129,140,248,0.12)",
                              color: THEME.colors.accent.primary,
                            }}
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 transition-colors"
                      style={{ color: THEME.colors.text.secondary }}
                    >
                      {copied ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSummary}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium hover:bg-white/5 transition-colors"
                      style={{ color: THEME.colors.text.secondary }}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onGenerateSummary}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-[11px] border transition-all hover:-translate-y-0.5"
                  style={{
                    borderColor: THEME.colors.border.primary,
                    color: THEME.colors.accent.primary,
                    background: "rgba(129,140,248,0.06)",
                  }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Generate summary
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AICoHost;