// apps/web/src/components/voice/shared/ActiveSpeakerStrip.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Volume1 } from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';
import { initials, hueFromString } from '../VoiceRoomView.helpers';

interface ActiveSpeakerStripProps {
  participants: any[];
  onSelect?: (id: string) => void;
}

export const ActiveSpeakerStrip: React.FC<ActiveSpeakerStrip