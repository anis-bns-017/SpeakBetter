// apps/web/src/components/voice/participants/ParticipantCard.tsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  MicOff,
  Hand,
  UserPlus,
  MessageSquare,
  VolumeX,
  UserX,
  Star,
  MicVocal,
  ArrowDownFromLine,
} from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';
import { initials, hueFromString, getCountryFlag } from '../VoiceRoomView.helpers';

export interface RoomParticipant {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  country?: string;
  nativeLanguage?: string;
  learningLanguage?: string;
  level?: string;
  bio?: string;
  interests?: string[];
  isOnline?: boolean;
  /** Connection dropped; the server keeps their place for a few seconds */
  isReconnecting?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  raisedHand?: boolean;
  joinedAt?: string;
  role?: string;
  isListening?: boolean;
  audioLevel?: number;
  isVerified?: boolean;
  isPremium?: boolean;
  /** Room coach: has spoken far less than their share (shown to hosts only) */
  isQuiet?: boolean;
  /** Room coach: finished their secret-word mission this round */
  missionDone?: boolean;
  /** Room coach: the host spotlighted them with a topic card */
  spotlighted?: boolean;
}


interface ParticipantCardProps {
  participant: RoomParticipant;
  isHost: boolean;
  isCurrentUser?: boolean;
  isModerator?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onMute?: () => void;
  onKick?: () => void;
  onPromote?: () => void;
  onFollow?: () => void;
  onSendMessage?: () => void;
  onViewProfile?: () => void;
  isFavorite?: boolean;
  /** Stage rooms: host action to invite this person up or move them to the audience */
  onStageAction?: () => void;
  stageActionKind?: 'invite' | 'remove';
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isHost,
  isCurrentUser = false,
  isModerator = false,
  size = 'md',
  onMute,
  onKick,
  onPromote,
  onFollow,
  onSendMessage,
  onViewProfile,
  isFavorite = false,
  onStageAction,
  stageActionKind = 'invite',
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const hue = hueFromString(participant.name);
  const sizeMap = {
    sm: { avatar: 52, text: 'text-xs', gap: 'gap-1', nameSize: 'text-xs' },
    md: { avatar: 68, text: 'text-sm', gap: 'gap-1.5', nameSize: 'text-sm' },
    lg: { avatar: 88, text: 'text-base', gap: 'gap-2', nameSize: 'text-base' },
  };
  const s = sizeMap[size];

  const countryFlag = getCountryFlag(participant.country);
  const isOnline = participant.isOnline !== false;
  const isMuted = participant.isMuted;
  const isSpeaking = Boolean(participant.isSpeaking) && !isMuted;
  const raisedHand = participant.raisedHand;
  // 0–1 voice level; if we only know they are speaking (no level), show a gentle middle value
  const voiceLevel = isSpeaking
    ? Math.min(1, Math.max(0.25, Number(participant.audioLevel) || 0.35))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative flex flex-col items-center group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="cursor-pointer" onClick={onViewProfile}>
        <div className="relative">
          {/* Speaking ring: a steady glow that fades in and out and follows the voice level (no looping pulse) */}
          <div
            aria-hidden
            className="absolute inset-[-4px] rounded-full pointer-events-none"
            style={{
              border: '2px solid rgba(129,140,248,0.9)',
              boxShadow: `0 0 ${6 + voiceLevel * 16}px rgba(129,140,248,${0.25 + voiceLevel * 0.35})`,
              opacity: isSpeaking ? 1 : 0,
              transition: 'opacity 250ms ease, box-shadow 120ms ease-out',
            }}
          />

          {/* Avatar */}
          <div
            className="relative rounded-full flex items-center justify-center font-semibold border-2 shadow-lg transition-all duration-200"
            style={{
              width: s.avatar,
              height: s.avatar,
              background: participant.avatarUrl
                ? `url(${participant.avatarUrl}) center/cover`
                : `hsl(${hue}, 50%, 22%)`,
              borderColor: isOnline
                ? isSpeaking
                  ? THEME.colors.accent.primary
                  : THEME.colors.status.online
                : THEME.colors.border.primary,
              color: participant.avatarUrl ? 'transparent' : THEME.colors.text.primary,
              fontSize: s.avatar / 3,
              boxShadow: isOnline && isSpeaking
                ? `0 0 30px ${THEME.colors.accent.primary}44`
                : 'none',
            }}
          >
            {!participant.avatarUrl && initials(participant.name)}
          </div>

          {/* Online status dot */}
          {isOnline && !isMuted && !isSpeaking && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
              style={{
                background: isSpeaking ? THEME.colors.accent.primary : '#22C55E',
                borderColor: THEME.colors.background.primary,
              }}
            />
          )}

          {/* Sound bars: small badge whose bars rise and fall with the voice while someone speaks */}
          <div
            aria-hidden
            className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full border-2 flex items-end justify-center gap-[1.5px] pb-[3px]"
            style={{
              background: THEME.colors.accent.primary,
              borderColor: THEME.colors.background.primary,
              opacity: isSpeaking ? 1 : 0,
              transform: isSpeaking ? 'scale(1)' : 'scale(0.6)',
              transition: 'opacity 200ms ease, transform 200ms ease',
            }}
          >
            {[0.7, 1, 0.8].map((weight, i) => (
              <span
                key={i}
                className="w-[2px] rounded-full bg-white"
                style={{
                  height: 3 + Math.round(voiceLevel * weight * 7),
                  transition: 'height 110ms ease-out',
                }}
              />
            ))}
          </div>

          {isMuted && isOnline && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 flex items-center justify-center"
              style={{ background: '#4B5563', borderColor: THEME.colors.background.primary }}
            >
              <MicOff className="w-1.5 h-1.5" style={{ color: '#9CA3AF' }} />
            </div>
          )}

          {/* Host crown */}
          {isHost && (
            <motion.div
              className="absolute -top-1 -right-1"
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Crown className="w-3.5 h-3.5 text-yellow-400 drop-shadow-lg" />
            </motion.div>
          )}

          {/* Raised hand */}
          {raisedHand && (
            <motion.div
              className="absolute -top-1 -left-1"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              <Hand className="w-3.5 h-3.5 text-yellow-400 drop-shadow-lg" />
            </motion.div>
          )}

          {/* Country flag */}
          <div className="absolute -bottom-0.5 -left-0.5 text-xs leading-none">
            {countryFlag}
          </div>

          {/* Favorite star */}
          {isFavorite && (
            <div className="absolute -top-1 -left-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
            </div>
          )}

          {isCurrentUser && !isSpeaking && (
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[7px] font-bold whitespace-nowrap"
              style={{ background: THEME.colors.accent.primary, color: '#fff' }}
            >
              You
            </div>
          )}
        </div>

        {/* Name and details */}
        <div className={`mt-1.5 text-center ${s.gap}`}>
          <span
            className={`${s.nameSize} font-medium truncate max-w-[80px] block`}
            style={{ color: THEME.colors.text.primary }}
          >
            {participant.name}
          </span>

          <div className="flex flex-col items-center gap-0.5 mt-0.5">
            {participant.nativeLanguage && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(167, 139, 250, 0.12)',
                  color: THEME.colors.accent.tertiary,
                }}
              >
                {participant.nativeLanguage}
              </span>
            )}
            {participant.learningLanguage && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(52, 211, 153, 0.12)',
                  color: THEME.colors.accent.success,
                }}
              >
                📚 {participant.learningLanguage}
              </span>
            )}
          </div>

          <span
            className="text-[8px]"
            style={{
              color: isMuted
                ? THEME.colors.accent.error
                : isOnline
                  ? isSpeaking
                    ? THEME.colors.accent.primary
                    : THEME.colors.text.muted
                  : THEME.colors.text.muted,
            }}
          >
            {participant.isReconnecting
              ? '📶 Reconnecting…'
              : isMuted
              ? '🔇 Muted'
              : isOnline
                ? isSpeaking
                  ? '🔊 Speaking'
                  : '🎧 Listening'
                : '💤 Away'}
          </span>

          {(participant.spotlighted || participant.missionDone || participant.isQuiet) && (
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {participant.spotlighted && (
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold animate-pulse"
                  style={{ background: 'rgba(251,191,36,0.18)', color: THEME.colors.accent.warning }}
                >
                  🔦 Spotlight
                </span>
              )}
              {participant.missionDone && (
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(52,211,153,0.15)', color: THEME.colors.accent.success }}
                >
                  🎯 Mission done
                </span>
              )}
              {participant.isQuiet && (
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded-full"
                  title="Has spoken much less than the others — try a spotlight"
                  style={{ background: 'rgba(251,191,36,0.1)', color: THEME.colors.accent.warning }}
                >
                  🤫 Quiet
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <AnimatePresence>
        {showActions && !isCurrentUser && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -8 }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-0.5 p-1 rounded-xl backdrop-blur-xl border shadow-lg"
            style={{
              background: 'rgba(18, 18, 31, 0.96)',
              borderColor: THEME.colors.border.primary,
            }}
          >
            <button
              onClick={() => {
                setIsFollowing(!isFollowing);
                onFollow?.();
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title="Follow"
              style={{
                color: isFollowing ? THEME.colors.accent.primary : THEME.colors.text.muted,
              }}
            >
              <UserPlus className="w-3 h-3" />
            </button>
            <button
              onClick={onSendMessage}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title="Send Message"
              style={{ color: THEME.colors.text.muted }}
            >
              <MessageSquare className="w-3 h-3" />
            </button>
            {onStageAction && (
              <button
                onClick={onStageAction}
                className={`p-1.5 rounded-lg transition-all ${stageActionKind === 'invite' ? 'hover:bg-emerald-500/20' : 'hover:bg-white/10'}`}
                title={stageActionKind === 'invite' ? 'Invite to speak' : 'Move to audience'}
                aria-label={stageActionKind === 'invite' ? `Invite ${participant.name} to speak` : `Move ${participant.name} to the audience`}
                style={{ color: stageActionKind === 'invite' ? THEME.colors.status.online : THEME.colors.text.muted }}
              >
                {stageActionKind === 'invite' ? <MicVocal className="w-3 h-3" /> : <ArrowDownFromLine className="w-3 h-3" />}
              </button>
            )}
            {isModerator && (
              <>
                <button
                  onClick={onMute}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                  title="Toggle Mute"
                  style={{ color: THEME.colors.text.muted }}
                >
                  <VolumeX className="w-3 h-3" />
                </button>
                <button
                  onClick={onKick}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                  title="Kick"
                  style={{ color: THEME.colors.text.muted }}
                >
                  <UserX className="w-3 h-3" />
                </button>
                {!isHost && (
                  <button
                    onClick={onPromote}
                    className="p-1.5 rounded-lg hover:bg-yellow-500/20 transition-all"
                    title="Make Host"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    <Crown className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};