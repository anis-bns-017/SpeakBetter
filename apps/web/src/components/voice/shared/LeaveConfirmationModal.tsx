// apps/web/src/components/voice/shared/LeaveConfirmationModal.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { PhoneOff } from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';
import type { FluencySnapshot } from '../../../hooks/useRoomCoach';

interface LeaveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Your live coach numbers, shown as a "how it went" recap before you leave */
  summary?: FluencySnapshot | null;
  missionsCompleted?: number;
}

export const LeaveConfirmationModal: React.FC<LeaveConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  summary,
  missionsCompleted = 0,
}) => {
  if (!isOpen) return null;

  const stats = summary && summary.words > 0
    ? [
        { label: 'Words spoken', value: String(summary.words) },
        { label: 'Fluency', value: summary.fluency === null ? '—' : `${summary.fluency}/100` },
        { label: 'Pace', value: summary.wpm === null ? '—' : `${summary.wpm} wpm` },
        { label: 'Fillers', value: String(summary.fillerCount) },
        { label: 'Missions', value: String(missionsCompleted) },
        { label: 'New strong words', value: String(summary.richWords.length) },
      ]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-[70] px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="rounded-3xl w-full max-w-md p-6 border"
        style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(239, 68, 68, 0.15)' }}
          >
            <PhoneOff className="w-8 h-8" style={{ color: '#EF4444' }} />
          </div>
          <h3 className="font-bold text-xl mb-2" style={{ color: THEME.colors.text.primary }}>
            Leave Room?
          </h3>
          <p className="text-sm mb-5" style={{ color: THEME.colors.text.muted }}>
            Are you sure you want to leave this room? You can always join back later.
          </p>

          {stats && (
            <div className="mb-5 text-left">
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: THEME.colors.text.muted }}>
                Your session so far · saved to your progress
              </div>
              <div className="grid grid-cols-3 gap-2">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl px-2 py-2 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="text-sm font-bold" style={{ color: THEME.colors.text.primary }}>
                      {s.value}
                    </div>
                    <div className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: THEME.colors.text.muted }}
            >
              Stay
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-80"
              style={{ background: '#EF4444', color: '#fff' }}
            >
              Leave Room
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
