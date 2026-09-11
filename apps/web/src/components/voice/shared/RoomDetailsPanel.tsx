// apps/web/src/components/voice/shared/RoomDetailsPanel.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Users, Mic, Clock, MessageCircle, Copy, PanelRightClose } from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';
import { SectionPill } from './SectionPill';

interface RoomDetailsPanelProps {
  room: any;
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
  room,
  totalParticipants,
  speakingCount,
  onlineCount,
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
      style={{ background: 'rgba(18,18,31,0.95)', borderColor: THEME.colors.border.primary }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: THEME.colors.text.primary }}>
            Room details
          </p>
          <p className="text-[9px]" style={{ color: THEME.colors.text.muted }}>
            Live session overview
          </p>
        </div>
        <button onClick={onClose} style={{ color: THEME.colors.text.muted }}>
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <SectionPill icon={<Users className="w-3 h-3" />} label="People" value={totalParticipants} />
        <SectionPill icon={<Mic className="w-3 h-3" />} label="Speaking" value={speakingCount} />
        <SectionPill icon={<Clock className="w-3 h-3" />} label="Minutes" value={Math.floor(duration / 60)} />
        <SectionPill icon={<MessageCircle className="w-3 h-3" />} label="Messages" value={messages} />
      </div>
      <div className="space-y-2 text-[10px] mt-3">
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Languages</span>
          <span style={{ color: THEME.colors.text.secondary }}>
            {languages.length ? languages.join(', ') : 'Not specified'}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Premium</span>
          <span style={{ color: THEME.colors.text.secondary }}>{premiumCount}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: THEME.colors.text.muted }}>Verified</span>
          <span style={{ color: THEME.colors.text.secondary }}>{verifiedCount}</span>
        </div>
        <button
          onClick={onCopyLink}
          className="w-full mt-2 py-2 rounded-xl border text-[10px] font-semibold hover:bg-white/5"
          style={{ borderColor: THEME.colors.border.primary, color: THEME.colors.text.secondary }}
        >
          <Copy className="inline w-3 h-3 mr-1.5" /> Copy room link
        </button>
      </div>
    </motion.div>
  );
};