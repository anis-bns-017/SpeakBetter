// apps/web/src/components/voice/shared/SessionInsights.tsx

import React from 'react';
import { Users, Zap, MessageCircle, Timer, Star, ShieldCheck, Languages } from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';

interface SessionInsightsProps {
  totalParticipants: number;
  onlineParticipants: number;
  speakingCount: number;
  messages: number;
  duration: number;
  premium: number;
  verified: number;
  languages: string[];
}

export const SessionInsights: React.FC<SessionInsightsProps> = ({
  totalParticipants,
  onlineParticipants,
  speakingCount,
  messages,
  duration,
  premium,
  verified,
  languages,
}) => {
  const participation = totalParticipants
    ? Math.round((onlineParticipants / totalParticipants) * 100)
    : 0;
  const engagement = Math.min(
    100,
    Math.round(speakingCount * 25 + Math.min(messages, 40) * 1.5),
  );

  const items = [
    {
      label: 'Presence',
      value: `${participation}%`,
      icon: Users,
      note: `${onlineParticipants} online`,
    },
    {
      label: 'Engagement',
      value: `${engagement}%`,
      icon: Zap,
      note: `${speakingCount} speaking`,
    },
    {
      label: 'Messages',
      value: messages,
      icon: MessageCircle,
      note: 'room chat',
    },
    {
      label: 'Duration',
      value: `${Math.floor(duration / 60)}m`,
      icon: Timer,
      note: `${duration % 60}s`,
    },
    {
      label: 'Premium',
      value: premium,
      icon: Star,
      note: 'members',
    },
    {
      label: 'Verified',
      value: verified,
      icon: ShieldCheck,
      note: 'members',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-2xl border p-2.5"
            style={{
              background: 'rgba(255,255,255,0.02)',
              borderColor: THEME.colors.border.primary,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <Icon className="w-3 h-3" style={{ color: THEME.colors.accent.tertiary }} />
              <span className="text-sm font-semibold" style={{ color: THEME.colors.text.primary }}>
                {item.value}
              </span>
            </div>
            <p className="text-[9px] font-medium" style={{ color: THEME.colors.text.secondary }}>
              {item.label}
            </p>
            <p className="text-[8px]" style={{ color: THEME.colors.text.muted }}>
              {item.note}
            </p>
          </div>
        );
      })}
      <div
        className="col-span-2 rounded-2xl border p-2.5"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderColor: THEME.colors.border.primary,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-medium" style={{ color: THEME.colors.text.secondary }}>
            Languages detected
          </span>
          <Languages className="w-3 h-3" style={{ color: THEME.colors.accent.tertiary }} />
        </div>
        <div className="flex flex-wrap gap-1">
          {languages.length ? (
            languages.map((lang) => (
              <span
                key={lang}
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(99,102,241,0.1)',
                  color: THEME.colors.text.secondary,
                }}
              >
                {lang}
              </span>
            ))
          ) : (
            <span className="text-[8px]" style={{ color: THEME.colors.text.muted }}>
              No language data yet
            </span>
          )}
        </div>
      </div>
    </div>
  );
};