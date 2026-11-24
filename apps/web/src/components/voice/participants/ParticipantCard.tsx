// apps/web/src/components/voice/participants/ParticipantCard.tsx

import React, { useRef, useState } from 'react';
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
import { initials, hueFromString } from '../VoiceRoomView.helpers';
import { CountryFlag } from '../shared/CountryFlag';
import { tr } from "../../../i18n/core";
import { SpeakingEffect } from "../effects/SpeakingEffect";
import { readSpeakingEffect } from "../effects/speakingEffects";
import { useIsPhone } from "./useIsPhone";

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
  /** What plays around their avatar while they talk, chosen in Settings (effects/speakingEffects.ts) */
  speakingEffect?: string | null;
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
  // Avatars stay modest: the people, not the portraits, are the point of a room. Phones get a notch smaller.
  const phone = useIsPhone();
  const sizeMap = phone
    ? {
        sm: { avatar: 40, text: 'text-xs', gap: 'gap-0.5', nameSize: 'text-xs' },
        md: { avatar: 52, text: 'text-xs', gap: 'gap-0.5', nameSize: 'text-[13px]' },
        lg: { avatar: 60, text: 'text-sm', gap: 'gap-1', nameSize: 'text-sm' },
      }
    : {
        sm: { avatar: 44, text: 'text-xs', gap: 'gap-0.5', nameSize: 'text-xs' },
        md: { avatar: 60, text: 'text-sm', gap: 'gap-1', nameSize: 'text-[13px]' },
        lg: { avatar: 72, text: 'text-sm', gap: 'gap-1', nameSize: 'text-sm' },
      };
  const s = sizeMap[size];

  const isOnline = participant.isOnline !== false;
  const isMuted = participant.isMuted;
  const isSpeaking = Boolean(participant.isSpeaking) && !isMuted;
  const raisedHand = participant.raisedHand;
  // 0–1 voice level; if we only know they are speaking (no level), show a gentle middle value
  const voiceLevel = isSpeaking
    ? Math.min(1, Math.max(0.25, Number(participant.audioLevel) || 0.35))
    : 0;
  const effect = readSpeakingEffect(participant.speakingEffect);

  // Tilt toward the pointer with a moving glare. Written straight to CSS variables so hovering never re-renders.
  const tileRef = useRef<HTMLDivElement>(null);
  const handleTilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = tileRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--vr-rx', `${((0.5 - py) * 5).toFixed(2)}deg`);
    el.style.setProperty('--vr-ry', `${((px - 0.5) * 6).toFixed(2)}deg`);
    el.style.setProperty('--vr-gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--vr-gy', `${(py * 100).toFixed(1)}%`);
  };
  const resetTilt = () => {
    const el = tileRef.current;
    if (!el) return;
    el.style.setProperty('--vr-rx', '0deg');
    el.style.setProperty('--vr-ry', '0deg');
  };

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
      {/* The tile: glass that tilts with the pointer and lights up in the speaker's colours while they talk */}
      <div
        ref={tileRef}
        className="vr-tile flex w-full flex-col items-center rounded-[22px] px-2 pb-2.5 sm:px-3 sm:pb-3"
        data-speaking={isSpeaking}
        data-muted={Boolean(isMuted)}
        style={{ ['--vr-level' as string]: voiceLevel } as React.CSSProperties}
        onPointerMove={handleTilt}
        onPointerLeave={resetTilt}
      >
      {/* Room around the avatar for frames: crowns and ears above, ribbons below (the same for everyone, so rows line up) */}
      <div className="cursor-pointer" onClick={onViewProfile} style={{ paddingTop: Math.round(s.avatar * 0.24) }}>
        {/* Exactly the avatar's size and centred: frames and halos centre on THIS box. (It used to stretch to the
            width of the name and language chips below, which pushed every frame to the right of the face.) */}
        <div className="relative mx-auto" style={{ width: s.avatar, height: s.avatar, marginBottom: Math.round(s.avatar * 0.1) }}>
          {/* A chosen frame (Settings → Speaking effect) is always on; its speaking extras play while they talk */}
          {effect !== 'classic' && (
            <SpeakingEffect effect={effect} layer="back" size={s.avatar} level={voiceLevel} talking={isSpeaking} />
          )}

          {/* Speaking halo: a breathing aura, a slowly turning ring and two ripples. The aura and ring follow the
              voice level; everything fades with opacity so it never jumps (see styles/voice-stage.css) */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ opacity: isSpeaking ? 1 : 0, transition: 'opacity 350ms ease' }}
          >
            {isSpeaking && effect === 'classic' && (
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

          {/* The chosen effect's front parts (ears, crowns, petals…) sit over the face */}
          {effect !== 'classic' && (
            <SpeakingEffect effect={effect} layer="front" size={s.avatar} level={voiceLevel} talking={isSpeaking} />
          )}

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
          <div className="absolute -bottom-0.5 -left-0.5 leading-none">
            <CountryFlag country={participant.country} size={phone ? 14 : 16} />
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

        {/* Name, languages and status: three quiet lines, so a tile stays compact */}
        {/* relative: the name stays above a frame's lowest parts */}
        <div className={`relative mt-1 flex w-full flex-col items-center text-center ${s.gap}`}>
          <span
            className={`${s.nameSize} block max-w-full truncate font-semibold tracking-tight`}
            style={{ color: THEME.colors.text.primary }}
          >
            {participant.name}
          </span>

          {(participant.nativeLanguage || participant.learningLanguage) && (
            <span
              className="block max-w-full truncate text-[10.5px] font-medium"
              style={{ color: THEME.colors.text.muted }}
              title={
                participant.nativeLanguage && participant.learningLanguage
                  ? `${participant.nativeLanguage} → ${tr("Learning")} ${participant.learningLanguage}`
                  : participant.nativeLanguage || `${tr("Learning")} ${participant.learningLanguage}`
              }
            >
              {participant.nativeLanguage && participant.learningLanguage
                ? `${participant.nativeLanguage} → ${participant.learningLanguage}`
                : participant.nativeLanguage || `${tr("Learning")} ${participant.learningLanguage}`}
            </span>
          )}

          <span
            className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
            style={{
              background: isMuted
                ? 'rgb(248 113 113 / 0.12)'
                : isSpeaking
                  ? 'rgb(var(--vr-iris) / 0.16)'
                  : 'rgb(255 255 255 / 0.05)',
              color: isMuted
                ? THEME.colors.accent.error
                : isSpeaking
                  ? THEME.colors.accent.primaryLight
                  : THEME.colors.text.muted,
            }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isMuted
                  ? THEME.colors.accent.error
                  : !isOnline
                    ? THEME.colors.text.muted
                    : isSpeaking
                      ? THEME.colors.accent.primaryLight
                      : 'var(--sx-bg-22c55e)',
                boxShadow: isSpeaking && !isMuted ? '0 0 8px 1px rgb(var(--vr-iris) / 0.8)' : 'none',
              }}
            />
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