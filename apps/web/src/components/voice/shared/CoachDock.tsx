// apps/web/src/components/voice/shared/CoachDock.tsx
/**
 * CoachDock — the always-visible row of coach tiles at the top of the stage, so the
 * features are on screen even when nobody is talking yet:
 *   Fluency (+ whether captions are listening), Mission (one-click start for hosts),
 *   Balance (one-click spotlight for hosts), Word bank.
 */

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Gauge, Target, Users, BookMarked, Play, Focus } from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type {
  AirtimeSnapshot,
  FluencySnapshot,
  MissionPrivate,
  MissionPublic,
} from "../../../hooks/useRoomCoach";

export type CaptionsStatus = "unsupported" | "muted" | "listening";
export type CoachTab = "me" | "mission" | "room" | "words";

interface CoachDockProps {
  canManage: boolean;
  captions: CaptionsStatus;
  live: FluencySnapshot | null;
  mission: MissionPublic | null;
  myMission: MissionPrivate | null;
  airtime: AirtimeSnapshot | null;
  savedCount: number;
  dueCount: number;
  onOpen: (tab: CoachTab) => void;
  onStartMission: () => void;
  onSpotlight: () => void;
}

const STORAGE_KEY = "sb.coachDock.collapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const CAPTION_HINT: Record<CaptionsStatus, string> = {
  listening: "🎙 Captions are listening to you",
  muted: "🔇 Unmute to start captions",
  unsupported: "Captions need Chrome or Edge",
};

const Tile: React.FC<{
  icon: React.ElementType;
  title: string;
  accent: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ icon: Icon, title, accent, onClick, children }) => (
  <div
    className="rounded-xl border p-2.5 min-w-0 flex flex-col gap-1"
    style={{ background: "rgba(14,14,26,0.72)", borderColor: THEME.colors.border.primary }}
  >
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-left"
      style={{ color: accent }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{title}</span>
    </button>
    {children}
  </div>
);

const ActionButton: React.FC<{
  onClick: () => void;
  icon?: React.ElementType;
  children: React.ReactNode;
  tone?: "primary" | "warning";
}> = ({ onClick, icon: Icon, children, tone = "primary" }) => (
  <button
    onClick={onClick}
    className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold"
    style={
      tone === "warning"
        ? { background: "rgba(251,191,36,0.16)", color: THEME.colors.accent.warning }
        : { background: THEME.colors.accent.primary, color: "#fff" }
    }
  >
    {Icon && <Icon className="w-3 h-3" />}
    {children}
  </button>
);

export const CoachDock: React.FC<CoachDockProps> = ({
  canManage,
  captions,
  live,
  mission,
  myMission,
  airtime,
  savedCount,
  dueCount,
  onOpen,
  onStartMission,
  onSpotlight,
}) => {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!mission || collapsed) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [mission, collapsed]);

  const toggle = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      } catch {
        /* the choice just won't be remembered */
      }
      return !v;
    });

  const fluency = live?.fluency ?? null;
  const balance = airtime?.balance ?? null;
  const quietCount = airtime?.quiet.length ?? 0;

  return (
    <div className="px-4 pt-3 relative z-20">
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={toggle}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
          style={{ color: THEME.colors.text.secondary }}
        >
          <Gauge className="w-3.5 h-3.5" style={{ color: THEME.colors.accent.primaryLight }} />
          Room coach
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {collapsed && (
          <span className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
            {mission ? "🎯 mission running · " : ""}
            {dueCount > 0 ? `📚 ${dueCount} to review` : ""}
          </span>
        )}
      </div>

      {!collapsed && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Fluency */}
          <Tile icon={Gauge} title="Your fluency" accent={THEME.colors.accent.cyan} onClick={() => onOpen("me")}>
            <div className="text-xl font-bold leading-none" style={{ color: THEME.colors.text.primary }}>
              {fluency ?? "—"}
              {fluency !== null && (
                <span className="text-[10px] font-normal ml-1" style={{ color: THEME.colors.text.muted }}>
                  / 100
                </span>
              )}
            </div>
            <div className="text-[10px] leading-snug" style={{ color: THEME.colors.text.muted }}>
              {live && live.words > 0
                ? `${live.wpm !== null ? `${live.wpm} wpm · ` : ""}${live.fillerCount} fillers · ${live.words} words`
                : CAPTION_HINT[captions]}
            </div>
          </Tile>

          {/* Mission */}
          <Tile icon={Target} title="Secret-word mission" accent={THEME.colors.accent.primaryLight} onClick={() => onOpen("mission")}>
            {mission ? (
              <>
                <div className="text-xl font-bold leading-none" style={{ color: THEME.colors.accent.warning }}>
                  {fmtClock(mission.endsAt - now)}
                </div>
                <div className="text-[10px]" style={{ color: THEME.colors.text.muted }}>
                  {mission.completed.length}/{mission.total} finished
                  {myMission?.completed ? " · you're done ✅" : ""}
                </div>
                <ActionButton onClick={() => onOpen("mission")}>Open my word</ActionButton>
              </>
            ) : canManage ? (
              <>
                <div className="text-[10px] leading-snug" style={{ color: THEME.colors.text.muted }}>
                  Everyone gets a private word to slip into the conversation.
                </div>
                <ActionButton onClick={onStartMission} icon={Play}>
                  Start a round (B1 · 5 min)
                </ActionButton>
              </>
            ) : (
              <div className="text-[10px] leading-snug" style={{ color: THEME.colors.text.muted }}>
                No round yet — the host can start one.
              </div>
            )}
          </Tile>

          {/* Balance */}
          <Tile icon={Users} title="Conversation balance" accent={THEME.colors.accent.success} onClick={() => onOpen("room")}>
            <div className="text-xl font-bold leading-none" style={{ color: THEME.colors.text.primary }}>
              {balance === null ? "—" : `${balance}%`}
            </div>
            <div className="text-[10px] leading-snug" style={{ color: THEME.colors.text.muted }}>
              {balance === null
                ? "Shows after a minute of talking"
                : quietCount > 0
                  ? `${quietCount} quiet voice${quietCount === 1 ? "" : "s"}`
                  : "Everyone is getting a turn"}
            </div>
            {canManage && (
              <ActionButton onClick={onSpotlight} icon={Focus} tone="warning">
                {quietCount > 0 ? "Spotlight a quiet voice" : "Pick a topic card"}
              </ActionButton>
            )}
          </Tile>

          {/* Word bank */}
          <Tile icon={BookMarked} title="Word bank" accent={THEME.colors.accent.pink} onClick={() => onOpen("words")}>
            <div className="text-xl font-bold leading-none" style={{ color: THEME.colors.text.primary }}>
              {savedCount}
              <span className="text-[10px] font-normal ml-1" style={{ color: THEME.colors.text.muted }}>
                saved
              </span>
            </div>
            <div className="text-[10px] leading-snug" style={{ color: THEME.colors.text.muted }}>
              {savedCount === 0 ? "Tap a word in the captions to save it" : dueCount > 0 ? `${dueCount} ready to review` : "All reviewed for now"}
            </div>
            {dueCount > 0 && <ActionButton onClick={() => onOpen("words")}>Review now</ActionButton>}
          </Tile>
        </div>
      )}
    </div>
  );
};

export default CoachDock;
