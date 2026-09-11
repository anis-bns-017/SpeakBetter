// apps/web/src/components/voice/shared/VoiceRoomHeader.tsx

import React from 'react';
import {
  Crown,
  Radio,
  MessageCircle,
  Settings,
  Minimize2,
  Share2,
} from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';

interface VoiceRoomHeaderProps {
  room: any;
  isHost: boolean;
  isLiveKitConnected: boolean;
  isMockMode: boolean;
  totalParticipants: number;
  speakingCount: number;
  onlineCount: number;
  showChat: boolean;
  unreadCount: number;
  onToggleChat: () => void;
  onToggleCommandCenter: () => void;
  onMinimize?: (data: any) => void;
  onShare: () => void;
}

export const VoiceRoomHeader: React.FC<VoiceRoomHeaderProps> = ({
  room,
  isHost,
  isLiveKitConnected,
  isMockMode,
  totalParticipants,
  speakingCount,
  onlineCount,
  showChat,
  unreadCount,
  onToggleChat,
  onToggleCommandCenter,
  onMinimize,
  onShare,
}) => {
  return (
    <header
      className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b shrink-0 backdrop-blur-xl"
      style={{
        background: 'rgba(10, 10, 18, 0.85)',
        borderColor: THEME.colors.border.primary,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
          }}
        >
          <Radio className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className="text-base font-bold truncate"
              style={{ color: THEME.colors.text.primary }}
            >
              {room.name}
            </h2>
            <span
              className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-1.5"
              style={{
                background: isLiveKitConnected
                  ? 'rgba(52, 211, 153, 0.15)'
                  : THEME.colors.border.primary,
                color: isLiveKitConnected
                  ? THEME.colors.status.live
                  : THEME.colors.text.muted,
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isLiveKitConnected ? 'animate-pulse' : ''}`}
                style={{
                  background: isLiveKitConnected
                    ? THEME.colors.status.live
                    : THEME.colors.text.muted,
                }}
              />
              {isLiveKitConnected ? 'Live' : isMockMode ? 'Demo' : 'Connecting'}
            </span>
            {isHost && (
              <span
                className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5"
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: THEME.colors.accent.warning,
                }}
              >
                <Crown className="w-3 h-3" /> Host
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-2 text-[10px]"
            style={{ color: THEME.colors.text.muted }}
          >
            <span>{totalParticipants} participants</span>
            <span>·</span>
            <span>{speakingCount} speaking</span>
            <span>·</span>
            <span>{onlineCount} online</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleChat}
          className="relative p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{
            color: showChat
              ? THEME.colors.accent.primary
              : THEME.colors.text.muted,
          }}
          title="Toggle Chat"
        >
          <MessageCircle className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] text-[8px] rounded-full flex items-center justify-center px-1 font-bold"
              style={{ background: THEME.colors.accent.error, color: '#fff' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={onToggleCommandCenter}
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: THEME.colors.text.muted }}
          title="Room controls"
        >
          <Settings className="w-4 h-4" />
        </button>

        {onMinimize && (
          <button
            onClick={() =>
              onMinimize({
                id: room.id,
                name: room.name,
                participants: [],
                type: room.type,
                participantCount: totalParticipants,
              })
            }
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
            style={{ color: THEME.colors.text.muted }}
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onShare}
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: THEME.colors.text.muted }}
          title="Share Room"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};