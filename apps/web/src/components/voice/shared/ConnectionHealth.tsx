// apps/web/src/components/voice/shared/ConnectionHealth.tsx

import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';

interface ConnectionHealthProps {
  socketConnected: boolean;
  liveKitConnected: boolean;
  isMockMode?: boolean;
}

export const ConnectionHealth: React.FC<ConnectionHealthProps> = ({
  socketConnected,
  liveKitConnected,
  isMockMode,
}) => {
  const healthy = socketConnected && liveKitConnected;
  return (
    <div
      className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px]"
      style={{
        background: healthy ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)',
        borderColor: healthy ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)',
        color: healthy ? THEME.colors.status.online : THEME.colors.accent.warning,
      }}
      title={`Socket: ${socketConnected ? 'connected' : 'offline'} · Audio: ${liveKitConnected ? 'connected' : 'offline'}`}
    >
      {healthy ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>
        {isMockMode ? 'Demo audio' : healthy ? 'Connected' : 'Reconnecting'}
      </span>
    </div>
  );
};