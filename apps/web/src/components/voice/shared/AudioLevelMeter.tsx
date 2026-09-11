// apps/web/src/components/voice/shared/AudioLevelMeter.tsx

import React from 'react';
import { THEME } from '../VoiceRoomView.theme';

interface AudioLevelMeterProps {
  level: number;
  muted: boolean;
}

export const AudioLevelMeter: React.FC<AudioLevelMeterProps> = ({ level, muted }) => {
  const safe = Math.max(0, Math.min(1, level || 0));
  return (
    <div
      className="flex items-center gap-1"
      title={muted ? 'Microphone muted' : 'Microphone level'}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-1 rounded-full transition-all duration-100"
          style={{
            height: `${5 + i * 2}px`,
            background:
              !muted && safe > i / 6 ? THEME.colors.accent.primary : THEME.colors.border.primary,
            opacity: !muted && safe > i / 6 ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
};