// apps/web/src/components/call/CallScreens.tsx
import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Globe,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Radio,
} from "lucide-react";
import { COLORS } from "../voice/lobby/lobbyTheme";
import { hueFromString, initials } from "../voice/lobby/lobbyUtils";
import { SafetyBar } from "./CallSafety";
import { ConversationCardPanel } from "./ConversationCardPanel";
import type { CardKind, ConversationCard } from "./callApi";
import type { ActiveCall } from "./useRandomCall";

export const CallAvatar: React.FC<{
  name: string;
  avatarUrl?: string | null;
  size?: number;
  speaking?: boolean;
  ring?: string;
}> = ({ name, avatarUrl, size = 96, speaking = false, ring = COLORS.live }) => {
  const reduce = useReducedMotion();
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {speaking && !reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ border: `2px solid ${ring}` }}
          animate={{ scale: [1, 1.28], opacity: [0.7, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold"
        style={{
          background: avatarUrl ? COLORS.surfaceRaised : `hsl(${hueFromString(name)}, 35%, 26%)`,
          color: COLORS.textPrimary,
          fontSize: size * 0.32,
          boxShadow: speaking ? `0 0 0 3px ${ring}` : `0 0 0 2px ${COLORS.border}`,
          transition: "box-shadow 150ms",
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </div>
    </div>
  );
};

/** "en" -> "English"; values that are already names are left alone */
const languageName = (value: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(value) ?? value;
  } catch {
    return value;
  }
};

// ---- Searching ----
const TIPS = [
  "Speak in full sentences, even if they are short.",
  "Do not stop for a mistake. Keep talking, fix it later.",
  "Ask your partner a question every minute or so.",
  "Your first words can be simple: hello, how is your day?",
];

export const SearchingScreen: React.FC<{
  userName: string;
  userAvatar?: string | null;
  waiting: number;
  waitedSeconds: number;
  onCancel: () => void;
}> = ({ userName, userAvatar, waiting, waitedSeconds, onCancel }) => {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), 6000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center py-10 text-center" role="status" aria-live="polite">
      <div className="relative flex h-56 w-56 items-center justify-center">
        {!reduce &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute rounded-full border"
              style={{ borderColor: COLORS.live, width: 112, height: 112 }}
              animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.85, ease: "easeOut" }}
            />
          ))}
        <CallAvatar name={userName} avatarUrl={userAvatar} size={112} ring={COLORS.live} />
      </div>
      <h2 className="mt-2 font-serif text-2xl" style={{ color: COLORS.textPrimary }}>
        Looking for a partner...
      </h2>
      <p className="mt-1 text-sm" style={{ color: COLORS.textMuted }}>
        {waiting > 1 ? `${waiting} people are looking right now` : "You are the first one here"}
        {" · "}
        {waitedSeconds}s
      </p>
      <p className="mt-6 flex min-h-[2.5rem] max-w-xs items-start gap-2 text-xs" style={{ color: COLORS.textSecondary }}>
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: COLORS.spotlight }} />
        {TIPS[tip]}
      </p>
      <button
        onClick={onCancel}
        className="mt-6 rounded-full border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
        style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimary }}
      >
        Cancel
      </button>
    </div>
  );
};

export const TimeoutScreen: React.FC<{
  onRetry: () => void;
  onRooms: () => void;
  onBack: () => void;
}> = ({ onRetry, onRooms, onBack }) => (
  <div className="mx-auto flex w-full max-w-md flex-col items-center py-14 text-center">
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: COLORS.spotlightDim }}>
      <Radio className="h-8 w-8" style={{ color: COLORS.spotlight }} />
    </div>
    <h2 className="font-serif text-2xl" style={{ color: COLORS.textPrimary }}>
      No one is free right now
    </h2>
    <p className="mt-2 text-sm" style={{ color: COLORS.textMuted }}>
      It is quiet at your level. Try again in a moment, or join a live room where people are
      already talking.
    </p>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <button
        onClick={onRetry}
        className="rounded-full px-6 py-2.5 text-sm font-semibold"
        style={{ background: COLORS.spotlight, color: COLORS.void }}
      >
        Keep looking
      </button>
      <button
        onClick={onRooms}
        className="rounded-full border px-6 py-2.5 text-sm font-medium hover:bg-white/5"
        style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimary }}
      >
        Browse voice rooms
      </button>
      <button onClick={onBack} className="rounded-full px-4 py-2.5 text-sm hover:bg-white/5" style={{ color: COLORS.textMuted }}>
        Change settings
      </button>
    </div>
  </div>
);

// ---- In a call ----
const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const TimerRing: React.FC<{ seconds: number; total: number; warn: boolean }> = ({ seconds, total, warn }) => {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, seconds / total));
  const color = warn ? COLORS.danger : COLORS.live;
  return (
    <div className="relative h-16 w-16" role="timer" aria-label={`${formatClock(seconds)} left`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke={COLORS.border} strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 500ms linear, stroke 300ms" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold tabular-nums"
        style={{ color: warn ? COLORS.danger : COLORS.textPrimary }}
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
};

/** "You 62% / Them 38%": a nudge to give the other person room (or to speak up) */
const TalkBalance: React.FC<{ me: number; partner: number }> = ({ me, partner }) => {
  const total = me + partner;
  const mine = total < 3 ? 50 : Math.round((me / total) * 100);
  const hint =
    total < 20
      ? null
      : mine >= 70
        ? "You are doing most of the talking. Ask a question."
        : mine <= 30
          ? "Your partner is talking a lot. Share your thoughts too."
          : "Nice balance.";
  return (
    <div className="w-full">
      <div className="mb-1.5 flex justify-between text-[11px]" style={{ color: COLORS.textMuted }}>
        <span>You {mine}%</span>
        <span>{100 - mine}% Them</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full" style={{ background: COLORS.border }} aria-hidden="true">
        <div style={{ width: `${mine}%`, background: COLORS.spotlight, transition: "width 600ms" }} />
        <div style={{ width: `${100 - mine}%`, background: COLORS.purple, transition: "width 600ms" }} />
      </div>
      {hint && (
        <p className="mt-1.5 text-center text-[11px]" style={{ color: COLORS.textSecondary }}>
          {hint}
        </p>
      )}
    </div>
  );
};

export const InCallScreen: React.FC<{
  call: ActiveCall;
  userName: string;
  userAvatar?: string | null;
  secondsLeft: number;
  card: ConversationCard | null;
  deck: ConversationCard[];
  cardIndex: number;
  drawing: boolean;
  muted: boolean;
  micError: string | null;
  meSpeaking: boolean;
  partnerSpeaking: boolean;
  talk: { me: number; partner: number };
  silent: boolean;
  mediaState: "connecting" | "connected" | "reconnecting";
  partnerWantsExtend: boolean;
  iWantExtend: boolean;
  justExtended: boolean;
  onCard: (index: number) => void;
  onDraw: (kind?: CardKind) => void;
  onMute: () => void;
  onExtend: () => void;
  onEnd: () => void;
  onReport: () => void;
  onBlock: () => void;
  /** Captions, reactions and tips (see CallExtras) */
  extras: {
    reactionFloat: ReactNode;
    captions: ReactNode;
    inbox: ReactNode;
    reactionBar: ReactNode;
    composer: ReactNode;
  };
}> = (p) => {
  const total = 5 * 60;
  const canExtend = p.secondsLeft <= 90 && p.secondsLeft > 0 && p.call.extensions < p.call.maxExtensions;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 py-4">
      {/* Partner header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
            You are talking with
          </p>
          <h2 className="truncate font-serif text-2xl" style={{ color: COLORS.textPrimary }}>
            {p.call.partner.name}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs" style={{ color: COLORS.textMuted }}>
            {p.call.partner.country && (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {p.call.partner.country}
              </span>
            )}
            {p.call.partner.nativeLanguage && <span>Speaks {languageName(p.call.partner.nativeLanguage)}</span>}
            <span className="capitalize">{p.call.partner.level}</span>
          </p>
          {!!p.call.partner.sharedInterests?.length && (
            <p className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>
              You both like <span className="font-semibold" style={{ color: COLORS.textPrimary }}>{p.call.partner.sharedInterests.slice(0, 3).join(", ")}</span>. A good place to start!
            </p>
          )}
        </div>
        <TimerRing seconds={p.secondsLeft} total={total} warn={p.secondsLeft <= 30} />
      </div>

      {/* Both people */}
      <div
        className="relative flex items-center justify-around rounded-3xl border px-4 py-8"
        style={{
          borderColor: COLORS.border,
          background: `radial-gradient(80% 120% at 50% 0%, ${COLORS.purple}1c 0%, transparent 70%), ${COLORS.surface}`,
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <CallAvatar name={p.call.partner.name} avatarUrl={p.call.partner.avatarUrl} speaking={p.partnerSpeaking} ring={COLORS.purple} />
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {p.partnerSpeaking ? "Speaking" : "Listening"}
          </span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <CallAvatar name={p.userName} avatarUrl={p.userAvatar} size={80} speaking={p.meSpeaking && !p.muted} ring={COLORS.spotlight} />
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {p.muted ? "Muted" : p.meSpeaking ? "You are speaking" : "You"}
          </span>
        </div>
        {p.extras.reactionFloat}
        {p.mediaState !== "connected" && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: COLORS.spotlightDim, color: COLORS.spotlight }}
            role="status"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            {p.mediaState === "reconnecting" ? "Reconnecting..." : "Connecting audio..."}
          </span>
        )}
      </div>

      {p.micError && (
        <p className="rounded-xl border px-3 py-2 text-center text-xs" role="alert" style={{ borderColor: `${COLORS.danger}55`, color: COLORS.danger }}>
          {p.micError}
        </p>
      )}

      <TalkBalance me={p.talk.me} partner={p.talk.partner} />

      {p.extras.captions}

      <ConversationCardPanel
        card={p.card}
        deck={p.deck}
        index={p.cardIndex}
        drawing={p.drawing}
        onPrev={() => p.onCard(p.cardIndex - 1)}
        onNext={() => p.onCard(p.cardIndex + 1)}
        onPick={p.onCard}
        onDraw={p.onDraw}
      />

      <div className="space-y-2">{p.extras.inbox}</div>

      {p.silent && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="rounded-2xl border px-4 py-2.5 text-center text-sm"
          style={{ borderColor: `${COLORS.live}44`, background: COLORS.liveDim, color: COLORS.live }}
        >
          Quiet for a moment. Tap “Keep it going” on the card, or press “Surprise me” for a new question.
        </motion.p>
      )}

      {(p.partnerWantsExtend || p.justExtended) && (
        <p
          className="rounded-2xl border px-4 py-2.5 text-center text-sm"
          role="status"
          style={{ borderColor: `${COLORS.spotlight}55`, background: COLORS.spotlightDim, color: COLORS.spotlight }}
        >
          {p.justExtended ? "5 more minutes added. Enjoy!" : `${p.call.partner.name} would like to keep talking.`}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {p.extras.reactionBar}
        {p.extras.composer}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={p.onMute}
          aria-pressed={p.muted}
          aria-label={p.muted ? "Unmute" : "Mute"}
          className="flex h-14 w-14 items-center justify-center rounded-full border transition-colors"
          style={{
            borderColor: p.muted ? COLORS.danger : COLORS.borderLight,
            background: p.muted ? `${COLORS.danger}22` : "transparent",
            color: p.muted ? COLORS.danger : COLORS.textPrimary,
          }}
        >
          {p.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {canExtend && (
          <button
            onClick={p.onExtend}
            disabled={p.iWantExtend}
            className="inline-flex h-14 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-70"
            style={{ background: COLORS.spotlight, color: COLORS.void }}
          >
            <Plus className="h-4 w-4" />
            {p.iWantExtend ? "Waiting for them..." : p.partnerWantsExtend ? "Yes, +5 min" : "Add 5 min"}
          </button>
        )}

        <button
          onClick={p.onEnd}
          aria-label="End call"
          className="flex h-14 items-center gap-2 rounded-full px-6 text-sm font-semibold"
          style={{ background: COLORS.danger, color: "#fff" }}
        >
          <PhoneOff className="h-5 w-5" />
          End call
        </button>
      </div>

      <SafetyBar onReport={p.onReport} onBlock={p.onBlock} />
    </div>
  );
};
