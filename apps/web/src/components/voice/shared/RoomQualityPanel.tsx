// apps/web/src/components/voice/shared/RoomQualityPanel.tsx

import React from 'react';
import { THEME } from '../VoiceRoomView.theme';
import { AudioLevelMeter } from './AudioLevelMeter';

interface RoomQualityPanelProps {
  socketConnected: boolean;
  liveKitConnected: boolean;
  isMockMode?: boolean;
  audioLevel: number;
  volume: number;
}

export const RoomQualityPanel: React.FC<RoomQualityPanelProps> = ({
  socketConnected,
  liveKitConnected,
  isMockMode,
  audioLevel,
  volume,
}) => {
  const quality =
    socketConnected && liveKitConnected
      ? 'Excellent'
      : socketConnected || liveKitConnected
        ? 'Fair'
        : 'Poor';
  return (
    <div
      className="absolute right-0 top-full mt-2 w-64 p-3 rounded-2xl border backdrop-blur-2xl shadow-2xl z-50"
      style={{ background: 'rgba(10,10,18,0.96)', borderColor: THEME.colors.border.primary }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: THEME.colors.text.primary }}>
            Connection quality
          </p>
          <p className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
            Realtime room diagnostics
          </p>
        </div>
        <span
          className="text-[10px] font-semibold"
          style={{
            color:
              quality === 'Excellent'
                ? THEME.colors.status.online
                : THEME.colors.accent.warning,
          }}
        >
          {quality}
        </span>
      </div>
      <div className="space-y-2 text-[10px]">
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Realtime socket</span>
          <span style={{ color: socketConnected ? THEME.colors.status.online : '#EF4444' }}>
            {socketConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Voice transport</span>
          <span style={{ color: liveKitConnected ? THEME.colors.status.online : '#EF4444' }}>
            {isMockMode ? 'Demo' : liveKitConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Output volume</span>
          <span style={{ color: THEME.colors.text.primary }}>{volume}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Mic level</span>
          <AudioLevelMeter level={audioLevel} muted={false} />
        </div>
      </div>
    </div>
  );
};