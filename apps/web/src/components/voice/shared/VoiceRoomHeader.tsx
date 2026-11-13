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
  Wifi,
  WifiOff,
} from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type { VoiceRoom } from "../../../hooks/useVoice";
import type { MinimizedRoomData } from "../VoiceRoomView.types";
import { tr } from "../../../i18n/core";

// ---- Connection Health badge ----
const ConnectionHealth: React.FC<{
  socketConnected: boolean;
  liveKitConnected: boolean;
  isMockMode?: boolean;
}> = ({ socketConnected, liveKitConnected, isMockMode }) => {
  const healthy = socketConnected && liveKitConnected;
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium"
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
        {isMockMode ? tr("Demo") : healthy ? tr("Connected") : tr("Reconnecting")}
      </span>
    </div>
  );
};

interface VoiceRoomHeaderProps {
  room: VoiceRoom;
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
  onMinimize?: (data: MinimizedRoomData) => void;
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
      className="relative z-10 flex items-center justify-between gap-3 px-3 sm:px-5 py-3 shrink-0"
      style={{
        background: "var(--sx-bg-10-10-18-920)",
        backdropFilter: "blur(24px) saturate(140%)",
        boxShadow: "inset 0 -1px 0 var(--sx-border-255-255-255-60)",
      }}
    >
      {/* LEFT — room identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          {speakingCount > 0 && <span aria-hidden className="vr-halo-glow" style={{ inset: -8 }} />}
          <div
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: THEME.colors.gradient.primary, boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.28), 0 10px 24px -10px var(--sx-shadow-99-102-241-900)" }}
          >
            <Radio className="h-5 w-5 text-white" aria-hidden />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className="font-display text-xl font-semibold truncate"
              style={{ color: THEME.colors.text.primary }}
            >
              {room.name}
            </h2>

            {/* Live / Demo / Connecting badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.14em]"
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
                  isLiveKitConnected ? "vr-live-dot" : ""
                }`}
                style={{
                  background: isLiveKitConnected
                    ? THEME.colors.status.online
                    : THEME.colors.text.muted,
                }}
              />
              {isLiveKitConnected ? tr("Live") : isMockMode ? tr("Demo") : tr("Connecting")}
            </div>

            {/* Host badge */}
            {isHost && (
              <div
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{
                  background: "rgba(251, 191, 36, 0.15)",
                  color: THEME.colors.accent.warning,
                }}
              >
                <Crown className="w-3 h-3" aria-hidden /> {" "}{tr("Host")}</div>
            )}
          </div>

          {/* Stats row */}
          <div
            className="flex items-center gap-2 text-[11px]"
            style={{ color: THEME.colors.text.muted }}
          >
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {totalParticipants}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              {speakingCount > 0 && (
                <span aria-hidden className="flex h-3 items-end gap-[2px]">
                  {[0, 0.25, 0.5].map((d) => (
                    <span key={d} className="vr-bar w-[2px] h-full rounded-full" style={{ background: THEME.colors.accent.primaryLight, animationDelay: `${d}s` }} />
                  ))}
                </span>
              )}
              {speakingCount} {" "}{tr("speaking")}</span>
            <span>·</span>
            <span>{onlineCount} {" "}{tr("online")}</span>
          </div>
        </div>
      </div>

      {/* RIGHT — action buttons */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        {/* Chat toggle + unread badge */}
        <button
          type="button"
          onClick={onToggleChat}
          className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.08] transition-[background-color,transform] active:scale-90"
          style={{
            color: showChat
              ? THEME.colors.accent.primary
              : THEME.colors.text.muted,
          }}
          title={tr("Toggle Chat")}
          aria-label={showChat ? tr("Hide chat") : tr("Show chat")}
          aria-pressed={showChat}
        >
          <MessageCircle className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] text-[10px] rounded-full flex items-center justify-center px-1 font-bold"
              style={{ background: THEME.colors.accent.error, color: "var(--sx-text-ffffff)" }}
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
          className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.08] transition-[background-color,transform] active:scale-90"
          style={{ color: THEME.colors.text.muted }}
          title={tr("Room controls")}
          aria-label={tr("Open room controls")}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Room details — hidden on mobile */}
        <button
          type="button"
          onClick={onShowDetails}
          className="hidden sm:inline-grid relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.08] transition-[background-color,transform] active:scale-90"
          style={{ color: THEME.colors.text.muted }}
          title={tr("Room details")}
          aria-label={tr("Open room details")}
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Keyboard shortcuts — hidden below md */}
        <button
          type="button"
          onClick={onShowShortcuts}
          className="hidden md:inline-grid relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.08] transition-[background-color,transform] active:scale-90"
          style={{ color: THEME.colors.text.muted }}
          title={tr("Keyboard shortcuts")}
          aria-label={tr("Open keyboard shortcuts")}
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
            className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.08] transition-[background-color,transform] active:scale-90"
            style={{ color: THEME.colors.text.muted }}
            title={tr("Minimize")}
            aria-label={tr("Minimize room")}
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        )}

        {/* Share */}
        <button
          type="button"
          onClick={onShare}
          className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.08] transition-[background-color,transform] active:scale-90"
          style={{ color: THEME.colors.text.muted }}
          title={tr("Share Room")}
          aria-label={tr("Copy room link")}
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Leave OR End Room — depends on role */}
        {isHost ? (
          <button
            type="button"
            onClick={onEndRoom}
            className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-red-500/15 transition-[background-color,transform] active:scale-90"
            style={{ color: THEME.colors.accent.error }}
            title={tr("End room for everyone")}
            aria-label={tr("End room")}
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.08] transition-[background-color,transform] active:scale-90"
            style={{ color: THEME.colors.text.muted }}
            title={tr("Leave room")}
            aria-label={tr("Leave room")}
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
