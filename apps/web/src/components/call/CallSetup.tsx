// apps/web/src/components/call/CallSetup.tsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, History, Lock, Loader2, Phone, Star, Users } from "lucide-react";
import { COLORS } from "../voice/lobby/lobbyTheme";
import { Equalizer } from "../voice/lobby/Equalizer";
import {
  callApi,
  type CallGoal,
  type CallHistoryItem,
  type CallLevel,
  type CallStatus,
} from "./callApi";
import { GOAL_OPTIONS, LEVEL_OPTIONS } from "./callOptions";
import { MicCheck } from "./MicCheck";

const PREFS_KEY = "speakbetter:random-call:prefs";

function loadPrefs(): { level: CallLevel; goal: CallGoal } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return {
      level: LEVEL_OPTIONS.some((o) => o.value === raw.level) ? raw.level : "intermediate",
      goal: GOAL_OPTIONS.some((o) => o.value === raw.goal) ? raw.goal : "casual",
    };
  } catch {
    return { level: "intermediate", goal: "casual" };
  }
}

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const Chip: React.FC<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ selected, onClick, children, title }) => (
  <button
    onClick={onClick}
    aria-pressed={selected}
    title={title}
    className="rounded-full border px-4 py-2 text-sm font-medium transition-all"
    style={{
      background: selected ? COLORS.spotlightDim : "transparent",
      borderColor: selected ? COLORS.spotlight : COLORS.border,
      color: selected ? COLORS.spotlight : COLORS.textMuted,
    }}
  >
    {children}
  </button>
);

export const CallSetup: React.FC<{
  status: CallStatus | null;
  waiting: number;
  connected: boolean;
  onStart: (prefs: { level: CallLevel; goal: CallGoal; language: string }) => void;
  onStatusChange: (status: CallStatus) => void;
}> = ({ status, waiting, connected, onStart, onStatusChange }) => {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<CallHistoryItem[]>([]);

  useEffect(() => {
    callApi.history().then(setHistory).catch(() => undefined);
  }, []);

  const needsConsent = !!status?.needsConsent;
  const blocked = !!status && !status.eligible && !needsConsent;

  const start = async () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // remembering the choice is a convenience only
    }
    if (needsConsent) {
      setSaving(true);
      try {
        await callApi.consent();
        onStatusChange({ ...(status as CallStatus), needsConsent: false, eligible: true, denial: null });
      } catch {
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    onStart({ ...prefs, language: "English" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl"
    >
      <div
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
        style={{
          borderColor: `${COLORS.spotlight}44`,
          background: `radial-gradient(120% 140% at 0% 0%, ${COLORS.spotlight}22 0%, transparent 55%), radial-gradient(90% 120% at 100% 100%, ${COLORS.purple}22 0%, transparent 60%), ${COLORS.surface}`,
        }}
      >
        <span
          className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
          style={{ background: COLORS.liveDim, color: COLORS.live }}
        >
          <Equalizer color={COLORS.live} bars={3} height={12} />
          {connected ? `${waiting} looking for a partner` : "Connecting..."}
        </span>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl" style={{ color: COLORS.textPrimary }}>
          Random call
        </h1>
        <p className="mt-2 max-w-lg text-sm sm:text-base" style={{ color: COLORS.textMuted }}>
          A 5-minute one-to-one conversation with someone at your level. You talk about half the
          time, which is the fastest way to get better.
        </p>

        {blocked ? (
          <div
            className="mt-6 flex items-start gap-3 rounded-2xl border p-4"
            style={{ borderColor: `${COLORS.danger}55`, background: `${COLORS.danger}12` }}
          >
            <Lock className="mt-0.5 h-5 w-5 shrink-0" style={{ color: COLORS.danger }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
                Random calls are not available for you
              </p>
              <p className="mt-0.5 text-sm" style={{ color: COLORS.textMuted }}>
                {status?.denial?.message}
              </p>
            </div>
          </div>
        ) : (
          <>
            <fieldset className="mt-6">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
                Your level
              </legend>
              <div className="flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    selected={prefs.level === option.value}
                    onClick={() => setPrefs((p) => ({ ...p, level: option.value }))}
                    title={option.hint}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-1.5 text-xs" style={{ color: COLORS.textSecondary }}>
                {LEVEL_OPTIONS.find((o) => o.value === prefs.level)?.hint}
              </p>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
                What do you want to practise?
              </legend>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    selected={prefs.goal === option.value}
                    onClick={() => setPrefs((p) => ({ ...p, goal: option.value }))}
                  >
                    <span aria-hidden="true">{option.emoji}</span> {option.label}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <MicCheck />

            {needsConsent && (
              <label
                className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm"
                style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
              >
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 accent-[#F5A623]"
                />
                <span>
                  I am <strong style={{ color: COLORS.textPrimary }}>18 or older</strong>. I will be
                  respectful, and I understand people can report me and block me.
                </span>
              </label>
            )}

            <button
              onClick={start}
              disabled={!connected || saving || (needsConsent && !confirmed)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:w-auto"
              style={{
                background: `linear-gradient(135deg, ${COLORS.spotlight}, #FFC857)`,
                color: COLORS.void,
                boxShadow: `0 10px 30px -10px ${COLORS.spotlight}`,
              }}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
              Find a partner
            </button>
          </>
        )}

        {status?.reputation && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs" style={{ color: COLORS.textMuted }}>
            <Star className="h-3.5 w-3.5" style={{ color: COLORS.spotlight }} fill="currentColor" />
            Your partners rate you {status.reputation.average} / 5 ({status.reputation.count} ratings)
          </p>
        )}
      </div>

      {history.length > 0 && (
        <section className="mt-6" aria-label="Recent calls">
          <h2
            className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: COLORS.textMuted }}
          >
            <History className="h-3.5 w-3.5" /> Recent calls
          </h2>
          <ul className="space-y-2">
            {history.slice(0, 5).map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                style={{ background: "rgba(28,20,48,0.6)", borderColor: COLORS.border }}
              >
                <Users className="h-4 w-4 shrink-0" style={{ color: COLORS.textSecondary }} />
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: COLORS.textPrimary }}>
                  {item.partner.name}
                </span>
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: COLORS.textMuted }}>
                  <Clock className="h-3 w-3" />
                  {formatDuration(item.seconds)}
                </span>
                {item.yourRating && (
                  <span className="inline-flex items-center gap-1 text-xs" style={{ color: COLORS.spotlight }}>
                    <Star className="h-3 w-3" fill="currentColor" />
                    {item.yourRating}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </motion.div>
  );
};
