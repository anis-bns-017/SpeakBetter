// apps/web/src/components/voice/shared/RoomCoachPanel.tsx
/**
 * RoomCoachPanel — the learner's private coach plus the room's games.
 *   Me      live fluency meters, a gentle tip, words you used, your recent sessions
 *   Mission secret-word rounds (host starts them; everyone gets their own word)
 *   Room    airtime balance, and for hosts: spotlight a quiet voice with a topic card
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Target,
  Gauge,
  Users,
  Flag,
  Shuffle,
  Play,
  Square,
  Lightbulb,
  Trophy,
  Focus as SpotlightIcon,
  Megaphone,
  BookMarked,
  Trash2,
} from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import { apiClient } from "../../../lib/api/client";
import type { SavedWord } from "../../../hooks/useWordBank";
import {
  CEFR_LEVELS,
  type AirtimeSnapshot,
  type CefrLevel,
  type CoachTip,
  type FluencySnapshot,
  type MissionPrivate,
  type MissionPublic,
  type MissionResult,
} from "../../../hooks/useRoomCoach";

type Tab = "me" | "mission" | "room" | "words";

interface SessionReport {
  id: string;
  roomName: string;
  fluencyScore: number | null;
  wpm: number | null;
  words: number;
  fillerCount: number;
  missionsCompleted: number;
  updatedAt: string;
}

interface RoomCoachPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  canManage: boolean;
  roomId: string;
  live: FluencySnapshot | null;
  tip: (CoachTip & { at: number }) | null;
  mission: MissionPublic | null;
  myMission: MissionPrivate | null;
  lastResult: MissionResult | null;
  airtime: AirtimeSnapshot | null;
  initialTab?: Tab;
  /** Ask the panel to switch tabs (change `n` to request the same tab again) */
  openTab?: { tab: Tab; n: number };
  words: SavedWord[];
  dueWords: SavedWord[];
  onReviewWord: (id: string, knew: boolean) => void;
  onRemoveWord: (id: string) => void;
  onStartMission: (level: CefrLevel, durationSec: number) => void;
  onStopMission: () => void;
  onSwapWord: () => void;
  onSpotlight: (opts: {
    targetUserId?: string;
    level?: CefrLevel;
    everyone?: boolean;
  }) => void;
}

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
};

const Meter: React.FC<{
  label: string;
  value: number | null;
  hint: string;
  color: string;
}> = ({ label, value, hint, color }) => (
  <div>
    <div className="flex items-center justify-between text-[11px] mb-1">
      <span style={{ color: THEME.colors.text.secondary }}>{label}</span>
      <span style={{ color: THEME.colors.text.muted }}>
        {value === null ? "—" : value}
      </span>
    </div>
    <div
      className="h-1.5 rounded-full overflow-hidden"
      style={{ background: "rgba(255,255,255,0.06)" }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value ?? 0}%`, background: color }}
      />
    </div>
    <div className="text-[10px] mt-1" style={{ color: THEME.colors.text.muted }}>
      {hint}
    </div>
  </div>
);

const paceHint = (s: FluencySnapshot) =>
  s.wpm === null
    ? "Speak a bit more to measure your pace"
    : `${s.wpm} words/min · ${s.pace === "steady" ? "comfortable" : s.pace}`;

const fillerHint = (s: FluencySnapshot) =>
  s.words === 0
    ? "Waiting for your first sentence"
    : `${s.fillerCount} filler${s.fillerCount === 1 ? "" : "s"}, ${s.repeats} restart${s.repeats === 1 ? "" : "s"} in ${s.words} words`;

export const RoomCoachPanel: React.FC<RoomCoachPanelProps> = ({
  isOpen,
  onClose,
  userId,
  canManage,
  live,
  tip,
  mission,
  myMission,
  lastResult,
  airtime,
  initialTab = "me",
  openTab,
  words,
  dueWords,
  onReviewWord,
  onRemoveWord,
  onStartMission,
  onStopMission,
  onSwapWord,
  onSpotlight,
}) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [minutes, setMinutes] = useState(5);
  const [reports, setReports] = useState<SessionReport[]>([]);
  const now = useNow(isOpen && Boolean(mission));

  // The dock's tiles open the panel straight on the tab they belong to
  useEffect(() => {
    if (openTab) setTab(openTab.tab);
  }, [openTab]);

  // Recent sessions (for the trend), loaded when the panel opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    apiClient
      .get("/voice/coach/reports/me", { params: { limit: 6 } })
      .then((res) => {
        // Sessions where you only listened say nothing about your speaking
        if (!cancelled && Array.isArray(res.data)) {
          setReports(res.data.filter((r: SessionReport) => r.words > 0));
        }
      })
      .catch(() => {
        /* history is a bonus; the live coach works without it */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const previousScores = reports
    .map((r) => r.fluencyScore)
    .filter((s): s is number => s !== null);
  const trend =
    live?.fluency != null && previousScores.length
      ? live.fluency - previousScores[0]
      : null;

  const myTurnDone = myMission?.completed;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className="fixed top-16 left-4 w-[min(92vw,400px)] max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-2xl z-[80]"
          style={{
            background: "rgba(10, 10, 18, 0.97)",
            borderColor: THEME.colors.border.primary,
          }}
          role="dialog"
          aria-label="Room coach"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between gap-3 border-b shrink-0"
            style={{
              borderColor: THEME.colors.border.primary,
              background:
                "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(236,72,153,0.06))",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.2)" }}
              >
                <Gauge className="w-4 h-4" style={{ color: THEME.colors.accent.primaryLight }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: THEME.colors.text.primary }}>
                  Room coach
                </h3>
                <p className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
                  Private feedback · games · fair airtime
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close room coach"
              className="p-1.5 rounded-lg hover:bg-white/5"
              style={{ color: THEME.colors.text.muted }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-2 shrink-0" role="tablist">
            {(
              [
                ["me", "Me", Gauge],
                ["mission", "Mission", Target],
                ["room", "Room", Users],
                ["words", "Words", BookMarked],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: tab === id ? "rgba(99,102,241,0.18)" : "transparent",
                  color: tab === id ? THEME.colors.text.primary : THEME.colors.text.muted,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id === "words" && dueWords.length > 0 && (
                  <span
                    className="min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: THEME.colors.accent.warning, color: "#0a0a12" }}
                  >
                    {dueWords.length}
                  </span>
                )}
                {id === "mission" && mission && !myTurnDone && myMission && (
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: THEME.colors.accent.warning }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto p-4 pt-2 space-y-4">
            {/* ---------------- ME ---------------- */}
            {tab === "me" && (
              <>
                {tip && (
                  <div
                    className="flex gap-2.5 p-3 rounded-xl border text-xs"
                    style={{
                      background: "rgba(251,191,36,0.07)",
                      borderColor: "rgba(251,191,36,0.2)",
                      color: THEME.colors.text.secondary,
                    }}
                  >
                    <Lightbulb className="w-4 h-4 shrink-0" style={{ color: THEME.colors.accent.warning }} />
                    <span>{tip.text}</span>
                  </div>
                )}

                {!live || live.words === 0 ? (
                  <div className="text-center py-6 text-xs" style={{ color: THEME.colors.text.muted }}>
                    Unmute and say a few sentences — your coach listens to your live captions
                    and shows pace, smoothness and variety here. Only you see this.
                  </div>
                ) : (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: THEME.colors.text.muted }}>
                          Fluency
                        </div>
                        <div className="text-3xl font-bold" style={{ color: THEME.colors.text.primary }}>
                          {live.fluency ?? "…"}
                          <span className="text-sm font-normal" style={{ color: THEME.colors.text.muted }}>
                            {live.fluency === null ? "  keep talking" : " / 100"}
                          </span>
                        </div>
                      </div>
                      {trend !== null && (
                        <div
                          className="text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{
                            background: trend >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                            color: trend >= 0 ? THEME.colors.accent.success : THEME.colors.accent.error,
                          }}
                        >
                          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} vs last session
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Meter label="Pace" value={live.scores.pace} hint={paceHint(live)} color={THEME.colors.accent.cyan} />
                      <Meter label="Smoothness" value={live.scores.smoothness} hint={fillerHint(live)} color={THEME.colors.accent.success} />
                      <Meter
                        label="Variety"
                        value={live.scores.variety}
                        hint={`${live.uniqueWords} different words`}
                        color={THEME.colors.accent.secondary}
                      />
                    </div>

                    {live.topFillers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {live.topFillers.map((f) => (
                          <span
                            key={f.word}
                            className="px-2 py-0.5 rounded-full text-[11px]"
                            style={{ background: "rgba(248,113,113,0.1)", color: THEME.colors.accent.error }}
                          >
                            "{f.word}" × {f.count}
                          </span>
                        ))}
                      </div>
                    )}

                    {live.richWords.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: THEME.colors.text.muted }}>
                          Strong words you used
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {live.richWords.slice(0, 8).map((w) => (
                            <span
                              key={w}
                              className="px-2 py-0.5 rounded-full text-[11px]"
                              style={{ background: "rgba(99,102,241,0.14)", color: THEME.colors.accent.primaryLight }}
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {reports.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: THEME.colors.text.muted }}>
                      Recent sessions
                    </div>
                    <ul className="space-y-1">
                      {reports.slice(0, 4).map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.03)", color: THEME.colors.text.secondary }}
                        >
                          <span className="truncate pr-2">{r.roomName}</span>
                          <span className="shrink-0" style={{ color: THEME.colors.text.muted }}>
                            {r.fluencyScore ?? "–"} fluency · {r.words} words
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* ---------------- MISSION ---------------- */}
            {tab === "mission" && (
              <>
                {mission ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: THEME.colors.text.secondary }}>
                        Level {mission.level} · {mission.completed.length}/{mission.total} done
                      </span>
                      <span className="font-mono font-semibold" style={{ color: THEME.colors.accent.warning }}>
                        {fmtClock(mission.endsAt - now)}
                      </span>
                    </div>

                    {myMission ? (
                      <div
                        className="p-4 rounded-2xl border"
                        style={{
                          background: myMission.completed
                            ? "rgba(52,211,153,0.08)"
                            : "linear-gradient(145deg, rgba(99,102,241,0.14), rgba(236,72,153,0.07))",
                          borderColor: myMission.completed ? "rgba(52,211,153,0.3)" : "rgba(99,102,241,0.3)",
                        }}
                      >
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: THEME.colors.text.muted }}>
                          {myMission.completed ? "Completed" : "Your secret word — use it naturally"}
                        </div>
                        <div className="text-2xl font-bold mb-1" style={{ color: THEME.colors.text.primary }}>
                          {myMission.word}
                          {myMission.completed && myMission.points != null && (
                            <span className="ml-2 text-sm" style={{ color: THEME.colors.accent.success }}>
                              +{myMission.points} XP
                            </span>
                          )}
                        </div>
                        <p className="text-xs mb-1" style={{ color: THEME.colors.text.secondary }}>
                          {myMission.meaning}
                        </p>
                        <p className="text-xs italic" style={{ color: THEME.colors.text.muted }}>
                          “{myMission.example}”
                        </p>
                        {!myMission.completed && !myMission.swapped && (
                          <button
                            onClick={onSwapWord}
                            className="mt-3 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg hover:bg-white/5"
                            style={{ color: THEME.colors.text.secondary }}
                          >
                            <Shuffle className="w-3 h-3" /> Swap word (once)
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: THEME.colors.text.muted }}>
                        You don't have a word in this round.
                      </p>
                    )}

                    <p className="text-[11px]" style={{ color: THEME.colors.text.muted }}>
                      Speak with captions on — we hear your word through them. Words stay secret
                      until someone uses theirs.
                    </p>

                    {mission.completed.length > 0 && (
                      <ul className="space-y-1">
                        {mission.completed.map((c) => (
                          <li
                            key={c.userId}
                            className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.03)", color: THEME.colors.text.secondary }}
                          >
                            <span>
                              #{c.place} {c.userId === userId ? "You" : c.userName}
                            </span>
                            <span style={{ color: THEME.colors.accent.success }}>
                              “{c.word}” +{c.points}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {canManage && (
                      <button
                        onClick={onStopMission}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}
                      >
                        <Square className="w-3.5 h-3.5" /> End round now
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {lastResult ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="w-4 h-4" style={{ color: THEME.colors.accent.warning }} />
                          <span className="text-sm font-bold" style={{ color: THEME.colors.text.primary }}>
                            Last round
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {lastResult.results.map((r) => (
                            <li
                              key={r.userId}
                              className="px-2.5 py-1.5 rounded-lg text-xs"
                              style={{ background: "rgba(255,255,255,0.03)" }}
                            >
                              <div className="flex items-center justify-between" style={{ color: THEME.colors.text.secondary }}>
                                <span>
                                  {r.place ? `#${r.place} ` : ""}
                                  {r.userId === userId ? "You" : r.userName}
                                </span>
                                <span style={{ color: r.completed ? THEME.colors.accent.success : THEME.colors.text.muted }}>
                                  {r.completed ? `+${r.points} XP` : "no luck"}
                                </span>
                              </div>
                              <div className="text-[11px]" style={{ color: THEME.colors.text.muted }}>
                                “{r.word}” — {r.meaning}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Target className="w-8 h-8 mx-auto mb-2" style={{ color: THEME.colors.accent.primaryLight }} />
                        <h4 className="text-sm font-bold mb-1" style={{ color: THEME.colors.text.primary }}>
                          Secret word missions
                        </h4>
                        <p className="text-xs" style={{ color: THEME.colors.text.muted }}>
                          Everyone gets a private word at their level. Slip it into the conversation
                          naturally — first to use it earns bonus XP, and you learn the word.
                        </p>
                      </div>
                    )}

                    {canManage ? (
                      <div className="space-y-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: THEME.colors.text.muted }}>
                            Level
                          </div>
                          <div className="flex gap-1.5">
                            {CEFR_LEVELS.map((l) => (
                              <button
                                key={l}
                                onClick={() => setLevel(l)}
                                aria-pressed={level === l}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                                style={{
                                  background: level === l ? THEME.colors.accent.primary : "rgba(255,255,255,0.05)",
                                  color: level === l ? "#fff" : THEME.colors.text.secondary,
                                }}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: THEME.colors.text.muted }}>
                            Length
                          </div>
                          <div className="flex gap-1.5">
                            {[3, 5, 10].map((m) => (
                              <button
                                key={m}
                                onClick={() => setMinutes(m)}
                                aria-pressed={minutes === m}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                                style={{
                                  background: minutes === m ? THEME.colors.accent.primary : "rgba(255,255,255,0.05)",
                                  color: minutes === m ? "#fff" : THEME.colors.text.secondary,
                                }}
                              >
                                {m} min
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => onStartMission(level, minutes * 60)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                          style={{ background: THEME.colors.gradient.primary, color: "#fff" }}
                        >
                          <Play className="w-4 h-4" /> Start a round
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-center" style={{ color: THEME.colors.text.muted }}>
                        Ask the host to start a round.
                      </p>
                    )}
                  </>
                )}
              </>
            )}

            {/* ---------------- ROOM ---------------- */}
            {tab === "room" && (
              <>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: THEME.colors.text.secondary }}>Conversation balance</span>
                    <span className="font-semibold" style={{ color: THEME.colors.text.primary }}>
                      {airtime?.balance == null ? "—" : `${airtime.balance}%`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${airtime?.balance ?? 0}%`,
                        background:
                          (airtime?.balance ?? 0) >= 70
                            ? THEME.colors.accent.success
                            : (airtime?.balance ?? 0) >= 45
                              ? THEME.colors.accent.warning
                              : THEME.colors.accent.error,
                      }}
                    />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: THEME.colors.text.muted }}>
                    {airtime?.balance == null
                      ? "Shows once the room has talked for a minute"
                      : airtime.balance >= 70
                        ? "Everyone is getting a turn — nice!"
                        : "A few voices are doing most of the talking"}
                  </p>
                </div>

                {airtime && airtime.entries.length > 0 && (
                  <ul className="space-y-1.5">
                    {airtime.entries.map((e) => {
                      const quiet = airtime.quiet.includes(e.userId);
                      return (
                        <li key={e.userId}>
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span style={{ color: THEME.colors.text.secondary }}>
                              {e.userId === userId ? "You" : e.name}
                              {quiet && canManage && (
                                <span className="ml-1.5" style={{ color: THEME.colors.accent.warning }}>
                                  · quiet
                                </span>
                              )}
                            </span>
                            <span style={{ color: THEME.colors.text.muted }}>
                              {Math.floor(e.seconds / 60)}m {Math.round(e.seconds % 60)}s
                            </span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round(e.share * 100)}%`,
                                background: quiet ? THEME.colors.accent.warning : THEME.colors.accent.primary,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canManage && (
                  <div className="space-y-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: THEME.colors.text.muted }}>
                      Host tools
                    </div>
                    <button
                      onClick={() => onSpotlight({ level })}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: "rgba(251,191,36,0.14)", color: THEME.colors.accent.warning }}
                    >
                      <SpotlightIcon className="w-3.5 h-3.5" />
                      {airtime?.quiet.length ? "Spotlight a quiet voice" : "Spotlight someone"}
                    </button>
                    <button
                      onClick={() => onSpotlight({ level, everyone: true })}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: "rgba(99,102,241,0.14)", color: THEME.colors.accent.primaryLight }}
                    >
                      <Megaphone className="w-3.5 h-3.5" /> Topic card for everyone
                    </button>
                    <p className="text-[10px] flex items-center gap-1" style={{ color: THEME.colors.text.muted }}>
                      <Flag className="w-3 h-3" /> Cards use the level chosen under Mission ({level}).
                    </p>
                  </div>
                )}
              </>
            )}
            {/* ---------------- WORDS ---------------- */}
            {tab === "words" && (
              <WordsTab
                words={words}
                dueWords={dueWords}
                onReview={onReviewWord}
                onRemove={onRemoveWord}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Flip-card review of due words, then the full list */
const WordsTab: React.FC<{
  words: SavedWord[];
  dueWords: SavedWord[];
  onReview: (id: string, knew: boolean) => void;
  onRemove: (id: string) => void;
}> = ({ words, dueWords, onReview, onRemove }) => {
  const [flipped, setFlipped] = useState(false);
  const current = dueWords[0];

  // A new card starts face down
  useEffect(() => setFlipped(false), [current?.id]);

  if (words.length === 0) {
    return (
      <div className="text-center py-6">
        <BookMarked className="w-8 h-8 mx-auto mb-2" style={{ color: THEME.colors.accent.primaryLight }} />
        <h4 className="text-sm font-bold mb-1" style={{ color: THEME.colors.text.primary }}>
          Your word bank is empty
        </h4>
        <p className="text-xs" style={{ color: THEME.colors.text.muted }}>
          Tap any word in the live captions to save it with the sentence you heard it in. It comes back
          here for review at the right time.
        </p>
      </div>
    );
  }

  return (
    <>
      {current ? (
        <div className="rounded-2xl border p-4" style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.3)" }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: THEME.colors.text.muted }}>
            Review · {dueWords.length} due
          </div>
          <div className="text-2xl font-bold mb-2" style={{ color: THEME.colors.text.primary }}>
            {current.word}
          </div>
          {flipped ? (
            <div className="space-y-1 mb-3">
              {current.meaning && (
                <p className="text-xs" style={{ color: THEME.colors.text.secondary }}>
                  {current.meaning}
                </p>
              )}
              {current.sentence && (
                <p className="text-xs italic" style={{ color: THEME.colors.text.muted }}>
                  “{current.sentence}”
                </p>
              )}
              <p className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
                {[current.speakerName && `heard from ${current.speakerName}`, current.roomName && `in ${current.roomName}`]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </div>
          ) : (
            <p className="text-xs mb-3" style={{ color: THEME.colors.text.muted }}>
              Do you remember what it means and how to use it?
            </p>
          )}
          {flipped ? (
            <div className="flex gap-2">
              <button
                onClick={() => onReview(current.id, false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(248,113,113,0.14)", color: THEME.colors.accent.error }}
              >
                Again
              </button>
              <button
                onClick={() => onReview(current.id, true)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(52,211,153,0.16)", color: THEME.colors.accent.success }}
              >
                Got it
              </button>
            </div>
          ) : (
            <button
              onClick={() => setFlipped(true)}
              className="w-full py-2 rounded-xl text-xs font-semibold"
              style={{ background: THEME.colors.accent.primary, color: "#fff" }}
            >
              Show answer
            </button>
          )}
        </div>
      ) : (
        <div className="text-center text-xs py-3" style={{ color: THEME.colors.accent.success }}>
          🎉 All caught up — nothing to review right now
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: THEME.colors.text.muted }}>
          Saved words · {words.length}
        </div>
        <ul className="space-y-1">
          {words.slice(0, 30).map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(255,255,255,0.03)", color: THEME.colors.text.secondary }}
            >
              <span className="min-w-0 truncate">
                <span className="font-semibold" style={{ color: THEME.colors.text.primary }}>
                  {w.word}
                </span>
                {w.meaning ? ` — ${w.meaning}` : ""}
              </span>
              <span className="shrink-0 flex items-center gap-2">
                <span className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
                  box {w.box + 1}
                </span>
                <button
                  onClick={() => onRemove(w.id)}
                  aria-label={`Remove ${w.word}`}
                  className="p-1 rounded hover:bg-white/5"
                  style={{ color: THEME.colors.text.muted }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default RoomCoachPanel;
