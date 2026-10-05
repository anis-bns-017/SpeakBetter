// apps/web/src/components/voice/shared/SectionPill.tsx

import React from "react";
import { THEME } from "../VoiceRoomView.theme";

interface SectionPillProps {
  icon: React.ReactNode;
  label: string;
  value?: string | number;
  active?: boolean;
  onClick?: () => void;
  /** Force the "clickable" hover style even when no onClick is passed */
  interactive?: boolean;
}

export const SectionPill: React.FC<SectionPillProps> = ({
  icon,
  label,
  value,
  active,
  onClick,
  interactive,
}) => {
  const clickable = Boolean(onClick) || interactive;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] transition-all " +
        (clickable
          ? "hover:-translate-y-0.5 cursor-pointer"
          : "cursor-default")
      }
      style={{
        background: active
          ? "rgba(99,102,241,0.12)"
          : "rgba(255,255,255,0.02)",
        borderColor: active
          ? "rgba(99,102,241,0.45)"
          : THEME.colors.border.primary,
        color: active
          ? THEME.colors.text.primary
          : THEME.colors.text.muted,
      }}
    >
      {icon}
      <span>{label}</span>
      {value !== undefined && (
        <strong style={{ color: THEME.colors.text.primary }}>{value}</strong>
      )}
    </button>
  );
};

export default SectionPill;