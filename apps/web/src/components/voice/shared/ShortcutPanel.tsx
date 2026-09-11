// apps/web/src/components/voice/shared/ShortcutPanel.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';

interface ShortcutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutPanel: React.FC<ShortcutPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
        style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4" style={{ color: THEME.colors.accent.tertiary }} />
            <h3 className="font-semibold text-sm" style={{ color: THEME.colors.text.primary }}>
              Keyboard shortcuts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5"
            style={{ color: THEME.colors.text.muted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {[
            ['Ctrl / Cmd + Shift + M', 'Mute / unmute microphone'],
            ['Ctrl / Cmd + Shift + H', 'Raise your hand'],
            ['Enter', 'Send chat message'],
            ['Shift + Enter', 'New line in chat'],
            ['Esc', 'Close chat / modal'],
          ].map(([key, action]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <span className="text-xs" style={{ color: THEME.colors.text.secondary }}>
                {action}
              </span>
              <kbd
                className="text-[9px] px-2 py-1 rounded-lg border whitespace-nowrap"
                style={{
                  borderColor: THEME.colors.border.primary,
                  color: THEME.colors.text.primary,
                  background: THEME.colors.background.elevated,
                }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};