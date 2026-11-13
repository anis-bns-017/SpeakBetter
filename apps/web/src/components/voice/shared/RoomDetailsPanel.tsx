// apps/web/src/components/voice/shared/RoomDetailsPanel.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Users, Mic, Clock, MessageCircle, Copy, PanelRightClose } from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';
import { SectionPill } from './SectionPill';
import type { VoiceRoom } from '../../../hooks/useVoice';
import { tr } from "../../../i18n/core";

interface RoomDetailsPanelProps {
  room: VoiceRoom;
  totalParticipants: number;
  speakingCount: number;
  onlineCount: number;
  messages: number;
  duration: number;
  premiumCount: number;
  verifiedCount: number;
  languages: string[];
  onClose: () => void;
  onCopyLink: () => void;
}

export const RoomDetailsPanel: React.FC<RoomDetailsPanelProps> = ({
  totalParticipants,
  speakingCount,
  messages,
  duration,
  premiumCount,
  verifiedCount,
  languages,
  onClose,
  onCopyLink,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-4 bottom-20 z-30 w-72 rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl"
      style={{ background: 'var(--sx-bg-18-18-31-950)', borderColor: THEME.colors.border.primary }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: THEME.colors.text.primary }}>
            {tr("Room details")}</p>
          <p className="text-[9px]" style={{ color: THEME.colors.text.muted }}>
            {tr("Live session overview")}</p>
        </div>
        <button onClick={onClose} style={{ color: THEME.colors.text.muted }}>
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <SectionPill icon={<Users className="w-3 h-3" />} label={tr("People")} value={totalParticipants} />
        <SectionPill icon={<Mic className="w-3 h-3" />} label={tr("Speaking")} value={speakingCount} />
        <SectionPill icon={<Clock className="w-3 h-3" />} label={tr("Minutes")} value={Math.floor(duration / 60)} />
        <SectionPill icon={<MessageCircle className="w-3 h-3" />} label={tr("Messages")} value={messages} />
      </div>
      <div className="space-y-2 text-[11px] mt-3">
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>{tr("Languages")}</span>
          <span style={{ color: THEME.colors.text.secondary }}>
            {languages.length ? languages.join(', ') : tr("Not specified")}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>{tr("Premium")}</span>
          <span style={{ color: THEME.colors.text.secondary }}>{premiumCount}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>{tr("Verified")}</span>
          <span style={{ color: THEME.colors.text.secondary }}>{verifiedCount}</span>
        </div>
        <button
          onClick={onCopyLink}
          className="w-full mt-2 py-2 rounded-xl border text-[11px] font-semibold hover:bg-white/5"
          style={{ borderColor: THEME.colors.border.primary, color: THEME.colors.text.secondary }}
        >
          <Copy className="inline w-3 h-3 mr-1.5" /> {" "}{tr("Copy room link")}</button>
      </div>
    </motion.div>
  );
};