// apps/web/src/components/voice/shared/EmptyParticipantState.tsx

import React from 'react';
import { UserRoundSearch } from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';

interface EmptyParticipantStateProps {
  query?: string;
}

export const EmptyParticipantState: React.FC<EmptyParticipantStateProps> = ({ query }) => (
  <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
    <div
      className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 border"
      style={{ background: THEME.colors.background.card, borderColor: THEME.colors.border.primary }}
    >
      <UserRoundSearch className="w-7 h-7" style={{ color: THEME.colors.accent.tertiary }} />
    </div>
    <p className="text-sm font-semibold" style={{ color: THEME.colors.text.primary }}>
      {query ? 'No matching participants' : 'No participants found'}
    </p>
    <p className="text-xs mt-1 max-w-xs" style={{ color: THEME.colors.text.muted }}>
      {query
        ? 'Try another name, language or status filter.'
        : 'Participants will appear here when they join the room.'}
    </p>
  </div>
);