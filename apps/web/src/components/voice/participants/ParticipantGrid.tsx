// apps/web/src/components/voice/participants/ParticipantGrid.tsx

import React from 'react';
import { cn } from '../../../lib/utils';
import { THEME } from '../VoiceRoomView.theme';
import { ActiveSpeakerStrip } from '../shared/ActiveSpeakerStrip';
import { ParticipantCard } from './ParticipantCard';
import { initials, hueFromString, getCountryFlag } from '../VoiceRoomView.helpers';

interface ParticipantGridProps {
  participants: any[];
  isHost: boolean;
  isModerator: boolean;
  currentUserId?: string;
  hostId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: 'all' | 'online' | 'speaking' | 'raised';
  onFilterChange: (filter: 'all' | 'online' | 'speaking' | 'raised') => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  favoriteParticipants: Set<string>;
  onToggleFavorite: (userId: string) => void;
  onMuteUser: (userId: string) => void;
  onKickUser: (userId: string) => void;
  onPromoteHost: (userId: string) => void;
  onSendMessage: (userId: string) => void;
  onViewProfile: (userId: string) => void;
  showChat: boolean;
  className?: string;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  isHost,
  isModerator,
  currentUserId,
  hostId,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  showSearch,
  onToggleSearch,
  favoriteParticipants,
  onToggleFavorite,
  onMuteUser,
  onKickUser,
  onPromoteHost,
  onSendMessage,
  onViewProfile,
  showChat,
  className,
}) => {
  // Filter participants
  const filteredParticipants = participants.filter((p: any) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [p.name, p.nativeLanguage, p.learningLanguage, p.country, p.level]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  }).filter((p: any) => {
    if (filter === 'online') return p.isOnline === true;
    if (filter === 'speaking') return p.isSpeaking === true;
    if (filter === 'raised') return p.raisedHand === true;
    return true;
  });

  const onlineParticipants = participants.filter((p: any) => p.isOnline === true);

  return (
    <section
      className={cn(
        'flex-1 min-w-0 px-4 sm:px-6 py-4 transition-all duration-300 overflow-y-auto',
        className,
      )}
      style={{
        backgroundImage: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(99,102,241,0.05), transparent 70%)',
      }}
    >
      <ActiveSpeakerStrip participants={participants} />

      {/* Toolbar */}
      <div
        className="mb-3 rounded-2xl border p-2.5 backdrop-blur-xl"
        style={{
          background: 'rgba(18,18,31,0.6)',
          borderColor: THEME.colors.border.primary,
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 mr-auto">
            <Users className="w-3.5 h-3.5" style={{ color: THEME.colors.accent.tertiary }} />
            <span className="text-xs font-semibold" style={{ color: THEME.colors.text.primary }}>
              People in room
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(52,211,153,0.1)',
                color: THEME.colors.status.online,
              }}
            >
              {onlineParticipants.length} online
            </span>
          </div>
          <button
            onClick={onToggleSearch}
            className="p-1.5 rounded-lg hover:bg-white/5"
            style={{
              color: showSearch ? THEME.colors.accent.primary : THEME.colors.text.muted,
            }}
            title="Search participants"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1">
            {(['all', 'online', 'speaking', 'raised'] as const).map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className="px-2 py-1 rounded-full text-[9px] capitalize transition-all"
                style={{
                  background: filter === f
                    ? 'rgba(99,102,241,0.15)'
                    : 'transparent',
                  color: filter === f
                    ? THEME.colors.text.primary
                    : THEME.colors.text.muted,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="relative mt-2">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: THEME.colors.text.muted }}
            />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, language, country or level..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
              style={{
                background: THEME.colors.background.primary,
                borderColor: THEME.colors.border.primary,
                color: THEME.colors.text.primary,
              }}
            />
          </div>
        )}
      </div>

      {/* Language filters */}
      <div className="flex items-center gap-1.5 mb-4 px-1 flex-wrap">
        <span className="text-[10px] font-medium" style={{ color: THEME.colors.text.muted }}>
          🌍 Languages:
        </span>
        {['All', '🇺🇸', '🇪🇸', '🇫🇷', '🇯🇵', '🇰🇷', '🇨🇳'].map((lang) => (
          <button
            key={lang}
            className="px-2 py-0.5 rounded-full text-[9px] transition-all hover:scale-105"
            style={{
              background: THEME.colors.background.tertiary,
              color: THEME.colors.text.secondary,
              border: `1px solid ${THEME.colors.border.primary}`,
            }}
          >
            {lang}
          </button>
        ))}
      </div>

      <div className="mb-2 px-1 text-[9px]" style={{ color: THEME.colors.text.muted }}>
        {filteredParticipants.length} shown · {favoriteParticipants.size} favorites
      </div>

      {/* Participant grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-5xl mx-auto">
        {filteredParticipants.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(99,102,241,0.1)' }}
            >
              <UserRoundSearch className="w-8 h-8" style={{ color: THEME.colors.accent.primary }} />
            </div>
            <p className="text-sm" style={{ color: THEME.colors.text.muted }}>
              {searchQuery ? 'No participants match your search' : 'No participants yet'}
            </p>
          </div>
        ) : (
          filteredParticipants.map((p: any) => {
            const isParticipantHost = hostId === p.id || p.role === 'HOST';
            const isCurrentUser = p.id === currentUserId;

            const participant: RoomParticipant = {
              id: p.userId,
              userId: p.userId,
              name: p.name || p.user?.name || 'Anonymous',
              avatarUrl: p.avatarUrl || p.user?.avatarUrl,
              country: p.country || p.user?.country,
              nativeLanguage: p.nativeLanguage || p.user?.nativeLanguage,
              learningLanguage: p.learningLanguage || p.user?.learningLanguage,
              level: p.level || p.user?.level,
              isOnline: p.isOnline === true,
              isSpeaking: p.isSpeaking || false,
              isMuted: Boolean(p.isMuted),
              raisedHand: p.raisedHand || false,
              joinedAt: p.joinedAt || new Date().toISOString(),
              role: p.role || (isParticipantHost ? 'HOST' : 'MEMBER'),
              isListening: p.isListening === true,
              audioLevel: p.audioLevel || 0,
              isVerified: p.isVerified || p.user?.isVerified,
              isPremium: p.isPremium || p.user?.isPremium,
            };

            return (
              <ParticipantCard
                key={p.id}
                participant={participant}
                isHost={isParticipantHost}
                isCurrentUser={isCurrentUser}
                isModerator={isModerator}
                isFavorite={favoriteParticipants.has(p.id)}
                onMute={() => onMuteUser(p.id)}
                onKick={() => onKickUser(p.id)}
                onPromote={() => onPromoteHost(p.id)}
                onFollow={() => onToggleFavorite(p.id)}
                onSendMessage={() => onSendMessage(p.id)}
                onViewProfile={() => onViewProfile(p.id)}
                size="sm"
              />
            );
          })
        )}
      </div>
    </section>
  );
};