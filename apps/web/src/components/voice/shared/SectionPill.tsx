// apps/web/src/components/voice/shared/SectionPill.tsx

import React from 'react';
import { THEME } from '../VoiceRoomView.theme';

interface SectionPillProps {
  icon: React.ReactNode;
  label: string;
  value?: string | number;
  active?: boolean;
  onClick?: () => void;
}

export const SectionPill: React.FC<SectionPillProps> = ({
  icon,
  label,
  value,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] transition-all hover:-translate-y-0.5"
    style={{
      background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
      borderColor: active ? 'rgba(99,102,241,0.45)' : THEME.colors.border.primary,
      color: active ? THEME.colors.text.primary : THEME.colors.text.muted,
    }}
  >
    {icon}
    <span>{label}</span>
    {value !== undefined && <strong>{value}</strong>}
  </button>
);