// apps/web/src/components/voice/shared/VoiceRoomHeader.tsx

import React from "react";
import {
  Crown,
  Radio,
  MessageCircle,
  Settings,
  Minimize2,
  Share2,
  Users,
  PanelRight,
  Keyboard,
  LogOut,
  PhoneOff,
} from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";

// ---- Connection Health badge ----
const ConnectionHealth: React.FC<{
  socketConnected: boolean;
  liveKitConnected: boolean;
  isMockMode?: boolean;
}> = ({ socketConnected, liveKitConnected, isMockMode }) => {
  const healthy = socketConnected && liveKitConnected;
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px]"
      style={{
        background: healthy ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)",
        borderColor: healthy ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)",
        color: healthy
          ? THEME.colors.status.online
          : THEME.colors.accent.warning,
      }}
    >
      {healthy ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>
        {isMockMode ? "Demo" : healthy ? "Connected" : "Reconnecting"}
      </span>
    </div>
  );
};

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
  isConnected: boolean;
  onToggleChat: () => void;
  onToggleCommandCenter: () => void;
  onShowDetails: () => void;
  onShowShortcuts: () => void;
  onMinimize?: (data: any) => void;
  onShare: () => void;
  onLeave: () => void;
  onEndRoom: () => void;
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
  isConnected,
  onToggleChat,
  onToggleCommandCenter,
  onShowDetails,
  onShowShortcuts,
  onMinimize,
  onShare,
  onLeave,
  onEndRoom,
}) => {
  return (
    <header
      className="relative z-10 flex items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b shrink-0"
      style={{
        background: "rgba(10, 10, 18, 0.92)",
        backdropFilter: "blur(20px)",
        borderColor: THEME.colors.border.primary,
      }}
    >
      {/* LEFT — room identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: THEME.colors.gradient.primary }}
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

            {/* Live / Demo / Connecting badge */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-wider"
              style={{
                background: isLiveKitConnected
                  ? "rgba(52, 211, 153, 0.15)"
                  : THEME.colors.border.primary,
                color: isLiveKitConnected
                  ? THEME.colors.status.online
                  : THEME.colors.text.muted,
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLiveKitConnected ? "animate-pulse" : ""
                }`}
                style={{
                  background: isLiveKitConnected
                    ? THEME.colors.status.online
                    : THEME.colors.text.muted,
                }}
              />
              {isLiveKitConnected ? "Live" : isMockMode ? "Demo" : "Connecting"}
            </div>

            {/* Host badge */}
            {isHost && (
              <div
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase"
                style={{
                  background: "rgba(251, 191, 36, 0.15)",
                  color: THEME.colors.accent.warning,
                }}
              >
                <Crown className="w-2.5 h-2.5" /> Host
              </div>
            )}
          </div>

          {/* Stats row */}
          <div
            className="flex items-center gap-2 text-[10px]"
            style={{ color: THEME.colors.text.muted }}
          >
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {totalParticipants}
            </span>
            <span>·</span>
            <span>{speakingCount} speaking</span>
            <span>·</span>
            <span>{onlineCount} online</span>
          </div>
        </div>
      </div>

      {/* RIGHT — action buttons */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        {/* Chat toggle + unread badge */}
        <button
          type="button"
          onClick={onToggleChat}
          className="relative p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{
            color: showChat
              ? THEME.colors.accent.primary
              : THEME.colors.text.muted,
          }}
          title="Toggle Chat"
          aria-label={showChat ? "Hide chat" : "Show chat"}
          aria-pressed={showChat}
        >
          <MessageCircle className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] text-[8px] rounded-full flex items-center justify-center px-1 font-bold"
              style={{ background: THEME.colors.accent.error, color: "#fff" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Command center */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCommandCenter();
          }}
          className="p-2 rounded-full hover:bg-white/5 transition-colors relative"
          style={{ color: THEME.colors.text.muted }}
          title="Room controls"
          aria-label="Open room controls"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Room details — hidden on mobile */}
        <button
          type="button"
          onClick={onShowDetails}
          className="hidden sm:inline-flex p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: THEME.colors.text.muted }}
          title="Room details"
          aria-label="Open room details"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Keyboard shortcuts — hidden below md */}
        <button
          type="button"
          onClick={onShowShortcuts}
          className="hidden md:inline-flex p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: THEME.colors.text.muted }}
          title="Keyboard shortcuts"
          aria-label="Open keyboard shortcuts"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Minimize (only if parent provided handler) */}
        {onMinimize && (
          <button
            type="button"
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
            aria-label="Minimize room"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        )}

        {/* Share */}
        <button
          type="button"
          onClick={onShare}
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
          style={{ color: THEME.colors.text.muted }}
          title="Share Room"
          aria-label="Copy room link"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Leave OR End Room — depends on role */}
        {isHost ? (
          <button
            type="button"
            onClick={onEndRoom}
            className="p-2 rounded-full hover:bg-red-500/15 transition-colors"
            style={{ color: THEME.colors.accent.error }}
            title="End room for everyone"
            aria-label="End room"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
            style={{ color: THEME.colors.text.muted }}
            title="Leave room"
            aria-label="Leave room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}

        {/* Connection health — self-manages responsive visibility */}
        <ConnectionHealth
          socketConnected={isConnected}
          liveKitConnected={isLiveKitConnected}
          isMockMode={isMockMode}
        />
      </div>
    </header>
  );
};

export default VoiceRoomHeader;
