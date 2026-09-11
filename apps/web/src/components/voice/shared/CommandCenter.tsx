// apps/web/src/components/voice/shared/CommandCenter.tsx

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeOff,
  Bell,
  BellOff,
  MessageCircle,
  TrendingUp,
  X,
  ShieldCheck,
  Radio,
  Circle,
} from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';

interface CommandCenterProps {
  isHost: boolean;
  isModerator: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  soundEnabled: boolean;
  showChat: boolean;
  showParticipants: boolean;
  showLiveStats: boolean;
  isRecording: boolean;
  onMute: () => void;
  onDeafen: () => void;
  onToggleSound: () => void;
  onToggleChat: () => void;
  onToggleStats: () => void;
  onRecord: () => void;
  onClose: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  isHost,
  isModerator,
  isMuted,
  isDeafened,
  soundEnabled,
  showChat,
  showParticipants,
  showLiveStats,
  isRecording,
  onMute,
  onDeafen,
  onToggleSound,
  onToggleChat,
  onToggleStats,
  onRecord,
  onClose,
}) => {
  const actions = useMemo(() => [
    {
      label: isMuted ? 'Unmute' : 'Mute',
      icon: isMuted ? MicOff : Mic,
      active: isMuted,
      onClick: onMute,
      hint: 'Ctrl/Cmd + Shift + M',
      color: isMuted ? THEME.colors.accent.error : THEME.colors.accent.primary,
    },
    {
      label: isDeafened ? 'Undeafen' : 'Deafen',
      icon: isDeafened ? Volume2 : VolumeOff,
      active: isDeafened,
      onClick: onDeafen,
      hint: 'Local output',
      color: isDeafened ? THEME.colors.accent.warning : THEME.colors.text.secondary,
    },
    {
      label: soundEnabled ? 'Sounds on' : 'Sounds off',
      icon: soundEnabled ? Bell : BellOff,
      active: !soundEnabled,
      onClick: onToggleSound,
      hint: 'Notifications',
      color: soundEnabled ? THEME.colors.text.secondary : THEME.colors.accent.error,
    },
    {
      label: showChat ? 'Hide chat' : 'Show chat',
      icon: MessageCircle,
      active: showChat,
      onClick: onToggleChat,
      hint: 'Chat panel',
      color: showChat ? THEME.colors.accent.primary : THEME.colors.text.secondary,
    },
    {
      label: showLiveStats ? 'Hide stats' : 'Show stats',
      icon: TrendingUp,
      active: showLiveStats,
      onClick: onToggleStats,
      hint: 'Live metrics',
      color: showLiveStats ? THEME.colors.accent.primary : THEME.colors.text.secondary,
    },
  ], [isMuted, isDeafened, soundEnabled, showChat, showLiveStats, onMute, onDeafen, onToggleSound, onToggleChat, onToggleStats]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute top-full right-0 mt-2 w-[min(92vw,360px)] rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl z-[65]"
      style={{
        background: 'rgba(10, 10, 18, 0.98)',
        borderColor: THEME.colors.border.primary,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: THEME.colors.text.primary }}>
            Room controls
          </p>
          <p className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
            Everything you need without leaving the conversation
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: THEME.colors.text.muted }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const isActive = action.active;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="rounded-xl border px-3 py-3 text-center transition-all hover:scale-[1.02] active:scale-95"
              style={{
                background: isActive
                  ? 'rgba(99,102,241,0.12)'
                  : 'rgba(255,255,255,0.02)',
                borderColor: isActive
                  ? 'rgba(99,102,241,0.35)'
                  : THEME.colors.border.primary,
              }}
              title={action.hint}
            >
              <Icon
                className="w-5 h-5 mx-auto mb-1.5"
                style={{
                  color: isActive ? THEME.colors.accent.primary : THEME.colors.text.muted,
                }}
              />
              <span
                className="block text-[10px] leading-tight"
                style={{
                  color: isActive ? THEME.colors.text.primary : THEME.colors.text.muted,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {(isHost || isModerator) && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: THEME.colors.border.primary }}>
          <p
            className="text-[9px] uppercase tracking-wider font-semibold mb-2"
            style={{ color: THEME.colors.text.muted }}
          >
            Moderation
          </p>
          <div className="flex gap-2">
            <span
              className="flex-1 px-3 py-2 rounded-xl text-[10px] flex items-center gap-1.5"
              style={{
                background: 'rgba(251, 191, 36, 0.08)',
                color: THEME.colors.accent.warning,
                border: '1px solid rgba(251, 191, 36, 0.15)',
              }}
            >
              <ShieldCheck className="w-4 h-4" />
              {isHost ? 'Host controls enabled' : 'Moderator controls enabled'}
            </span>
            {isHost && isRecording && (
              <span
                className="px-3 py-2 rounded-xl text-[10px] flex items-center gap-1.5"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: THEME.colors.accent.error,
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                }}
              >
                <Radio className="w-4 h-4" />
                Recording
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onRecord}
        disabled={!isHost}
        className="w-full mt-3 py-2.5 rounded-xl text-[10px] font-semibold border transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-95"
        style={{
          borderColor: isRecording ? 'rgba(239,68,68,0.35)' : THEME.colors.border.primary,
          color: isRecording ? THEME.colors.accent.error : THEME.colors.text.secondary,
          background: isRecording ? 'rgba(239,68,68,0.07)' : 'transparent',
        }}
      >
        {isRecording ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: THEME.colors.accent.error }} />
            Recording active
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Radio className="w-4 h-4" />
            Start room recording
          </span>
        )}
      </button>
    </motion.div>
  );
};