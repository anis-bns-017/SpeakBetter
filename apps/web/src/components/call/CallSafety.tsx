// apps/web/src/components/call/CallSafety.tsx
import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Flag, Loader2, ShieldCheck, X } from "lucide-react";
import { COLORS } from "../voice/lobby/lobbyTheme";
import type { ReportReason } from "./callApi";
import { REPORT_OPTIONS } from "./callOptions";

/** Report dialog: choosing a reason ends the call and blocks the person for you */
export const ReportDialog: React.FC<{
  open: boolean;
  partnerName: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
}> = ({ open, partnerName, onClose, onSubmit }) => {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await onSubmit(reason, details.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Report ${partnerName}`}
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            className="w-full max-w-md rounded-3xl border p-6"
            style={{ background: COLORS.surface, borderColor: COLORS.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-xl" style={{ color: COLORS.textPrimary }}>
                  Report {partnerName}
                </h3>
                <p className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>
                  The call ends now and you will never be matched with them again.
                </p>
              </div>
              <button onClick={onClose} aria-label="Close" style={{ color: COLORS.textMuted }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2" role="radiogroup" aria-label="Reason">
              {REPORT_OPTIONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <button
                    key={option.value}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setReason(option.value)}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
                    style={{
                      background: selected ? `color-mix(in srgb, ${COLORS.danger} 10.2%, transparent)` : COLORS.surfaceRaised,
                      borderColor: selected ? COLORS.danger : COLORS.border,
                    }}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border-2"
                      style={{
                        borderColor: selected ? COLORS.danger : COLORS.textSecondary,
                        background: selected ? COLORS.danger : "transparent",
                      }}
                    />
                    <span>
                      <span className="block text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                        {option.label}
                      </span>
                      <span className="block text-[11px]" style={{ color: COLORS.textMuted }}>
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Anything else a moderator should know? (optional)"
              aria-label="Details"
              className="mt-3 w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{
                background: COLORS.surfaceRaised,
                borderColor: COLORS.border,
                color: COLORS.textPrimary,
              }}
            />

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-white/5"
                style={{ color: COLORS.textMuted }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!reason || busy}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ background: COLORS.danger, color: "var(--sx-text-ffffff)" }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                Report and end call
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Always-visible safety strip with one-tap report and block */
export const SafetyBar: React.FC<{
  onReport: () => void;
  onBlock: () => void;
}> = ({ onReport, onBlock }) => (
  <div
    className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-2.5 text-xs"
    style={{ background: "var(--sx-bg-28-20-48-600)", borderColor: COLORS.border, color: COLORS.textMuted }}
  >
    <span className="inline-flex items-center gap-1.5">
      <ShieldCheck className="h-3.5 w-3.5" style={{ color: COLORS.live }} />
      Not recorded. You can leave any time.
    </span>
    <button
      onClick={onReport}
      className="inline-flex items-center gap-1.5 font-medium hover:opacity-80"
      style={{ color: COLORS.danger }}
    >
      <Flag className="h-3.5 w-3.5" /> Report
    </button>
    <button
      onClick={onBlock}
      className="inline-flex items-center gap-1.5 font-medium hover:opacity-80"
      style={{ color: COLORS.textPrimary }}
    >
      <Ban className="h-3.5 w-3.5" /> Block
    </button>
  </div>
);
