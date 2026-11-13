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
import { tr } from "../../../i18n/core";

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
    sm: { avatar: 56, text: 'text-xs', gap: 'gap-1', nameSize: 'text-xs' },
    md: { avatar: 76, text: 'text-sm', gap: 'gap-1.5', nameSize: 'text-sm' },
    lg: { avatar: 104, text: 'text-base', gap: 'gap-2', nameSize: 'text-base' },
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
          {/* Speaking halo: a breathing aura, a slowly turning ring and two ripples. The aura and ring follow the
              voice level; everything fades with opacity so it never jumps (see styles/voice-stage.css) */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ opacity: isSpeaking ? 1 : 0, transition: 'opacity 350ms ease' }}
          >
            {isSpeaking && (
              <>
                <span className="vr-halo-glow" style={{ opacity: 0.55 + voiceLevel * 0.45, inset: -(8 + voiceLevel * 12) }} />
                <span className="vr-halo-ripple" />
                <span className="vr-halo-ripple" />
                <span className="vr-halo-ring" style={{ padding: 2 + voiceLevel * 2 }} />
              </>
            )}
          </div>

          {/* Avatar */}
          <div
            className="relative rounded-full flex items-center justify-center font-semibold border-2 shadow-lg transition-[border-color,box-shadow,transform] duration-300 group-hover:scale-[1.03]"
            style={{
              width: s.avatar,
              height: s.avatar,
              background: participant.avatarUrl
                ? `url(${participant.avatarUrl}) center/cover`
                : `linear-gradient(145deg, hsl(${hue}, 55%, 34%), hsl(${(hue + 40) % 360}, 50%, 20%))`,
              borderColor: isOnline
                ? isSpeaking
                  ? THEME.colors.accent.primary
                  : THEME.colors.status.online
                : THEME.colors.border.primary,
              color: participant.avatarUrl ? 'transparent' : THEME.colors.text.primary,
              fontSize: s.avatar / 3,
              boxShadow: isOnline && isSpeaking
                ? `0 0 30px color-mix(in srgb, ${THEME.colors.accent.primary} 26.7%, transparent)`
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
                background: isSpeaking ? THEME.colors.accent.primary : 'var(--sx-bg-22c55e)',
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
              <MicOff className="w-1.5 h-1.5" style={{ color: 'var(--sx-text-9ca3af)' }} />
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
              style={{ background: THEME.colors.accent.primary, color: 'var(--sx-text-ffffff)' }}
            >
              {tr("You")}</div>
          )}
        </div>

        {/* Name and details */}
        <div className={`mt-1.5 text-center ${s.gap}`}>
          <span
            className={`${s.nameSize} font-semibold tracking-tight truncate max-w-[120px] block`}
            style={{ color: THEME.colors.text.primary }}
          >
            {participant.name}
          </span>

          <div className="flex flex-col items-center gap-0.5 mt-0.5">
            {participant.nativeLanguage && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: 'rgba(170,162,228, 0.12)',
                  color: THEME.colors.accent.tertiary,
                }}
              >
                {participant.nativeLanguage}
              </span>
            )}
            {participant.learningLanguage && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: 'rgba(52, 211, 153, 0.12)',
                  color: THEME.colors.accent.success,
                }}
              >
                {tr("Learning")}{" "}{participant.learningLanguage}
              </span>
            )}
          </div>

          <span
            className="text-[11px] font-medium"
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
              ? tr("Reconnecting…")
              : isMuted
              ? tr("Muted")
              : isOnline
                ? isSpeaking
                  ? tr("Speaking")
                  : tr("Listening")
                : tr("Away")}
          </span>

          {(participant.spotlighted || participant.missionDone || participant.isQuiet) && (
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {participant.spotlighted && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold animate-pulse"
                  style={{ background: 'rgba(251,191,36,0.18)', color: THEME.colors.accent.warning }}
                >
                  {tr("Spotlight")}</span>
              )}
              {participant.missionDone && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(52,211,153,0.15)', color: THEME.colors.accent.success }}
                >
                  {tr("Mission done")}</span>
              )}
              {participant.isQuiet && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  title={tr("Has spoken much less than the others — try a spotlight")}
                  style={{ background: 'rgba(251,191,36,0.1)', color: THEME.colors.accent.warning }}
                >
                  {tr("Quiet")}</span>
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
              background: 'var(--sx-bg-18-18-31-960)',
              borderColor: THEME.colors.border.primary,
            }}
          >
            <button
              onClick={() => {
                setIsFollowing(!isFollowing);
                onFollow?.();
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title={tr("Follow")}
              style={{
                color: isFollowing ? THEME.colors.accent.primary : THEME.colors.text.muted,
              }}
            >
              <UserPlus className="w-3 h-3" />
            </button>
            <button
              onClick={onSendMessage}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title={tr("Send Message")}
              style={{ color: THEME.colors.text.muted }}
            >
              <MessageSquare className="w-3 h-3" />
            </button>
            {onStageAction && (
              <button
                onClick={onStageAction}
                className={`p-1.5 rounded-lg transition-all ${stageActionKind === 'invite' ? 'hover:bg-emerald-500/20' : 'hover:bg-white/10'}`}
                title={stageActionKind === 'invite' ? tr("Invite to speak") : tr("Move to audience")}
                aria-label={stageActionKind === 'invite' ? tr("Invite {name} to speak", { name: participant.name }) : tr("Move {name} to the audience", { name: participant.name })}
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
                  title={tr("Toggle Mute")}
                  style={{ color: THEME.colors.text.muted }}
                >
                  <VolumeX className="w-3 h-3" />
                </button>
                <button
                  onClick={onKick}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
                  title={tr("Kick")}
                  style={{ color: THEME.colors.text.muted }}
                >
                  <UserX className="w-3 h-3" />
                </button>
                {!isHost && (
                  <button
                    onClick={onPromote}
                    className="p-1.5 rounded-lg hover:bg-yellow-500/20 transition-all"
                    title={tr("Make Host")}
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