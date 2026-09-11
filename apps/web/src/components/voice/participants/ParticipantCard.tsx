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
} from 'lucide-react';
import { THEME } from '../VoiceRoomView.theme';
import { initials, hueFromString, getCountryFlag } from '../VoiceRoomView.helpers';
import { RoomParticipant } from '../VoiceRoomView.types';

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
          {/* Speaking pulse effect */}
          {isSpeaking && (
            <>
              <motion.div
                className="absolute inset-[-8px] rounded-full pointer-events-none"
                animate={{
                  scale: [0.95, 1.1, 0.95],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  background: `radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)`,
                }}
              />
              <motion.div
                className="absolute inset-[-4px] rounded-full pointer-events-none border-2 border-purple-500/50"
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </>
          )}

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
          {isOnline && !isMuted && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
              style={{
                background: isSpeaking ? THEME.colors.accent.primary : '#22C55E',
                borderColor: THEME.colors.background.primary,
              }}
            />
          )}

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

          {/* Speaking badge */}
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-bold tracking-wider whitespace-nowrap border"
              style={{
                background: 'rgba(99,102,241,0.95)',
                borderColor: 'rgba(196,181,253,0.5)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              }}
            >
              <span className="inline-flex items-center gap-1">
                <span className="flex items-end gap-[2px] h-2">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span
                      key={i}
                      className="w-[2px] rounded-full bg-white"
                      animate={{ height: ['3px', '7px', '4px', '6px', '3px'] }}
                      transition={{
                        duration: 0.5,
                        delay: i * 0.07,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </span>
                SPEAKING
              </span>
            </motion.div>
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
            {isMuted
              ? '🔇 Muted'
              : isOnline
                ? isSpeaking
                  ? '🔊 Speaking'
                  : '🎧 Listening'
                : '💤 Away'}
          </span>
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