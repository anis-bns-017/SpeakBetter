// apps/web/src/hooks/useRoomCoach.ts
/**
 * useRoomCoach — the live "coach" for a voice room.
 *
 * Everything comes from the server over the voice socket:
 *   - `voice:coach`          private fluency snapshot + a gentle tip after each caption line
 *   - `voice:mission-*`      secret-word rounds (word is private; completions are public)
 *   - `voice:airtime`        who has spoken how much (drives the balance bar)
 *   - `voice:spotlight`      a topic card aimed at one person or the whole room
 *   - `voice:coach-state`    everything above in one go, on join and on request
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";
export const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export interface FluencySnapshot {
  utterances: number;
  words: number;
  uniqueWords: number;
  fillerCount: number;
  fillersPer100: number;
  topFillers: { word: string; count: number }[];
  repeats: number;
  richWords: string[];
  avgUtteranceWords: number;
  wpm: number | null;
  pace: "slow" | "steady" | "fast" | null;
  scores: {
    pace: number | null;
    smoothness: number | null;
    variety: number | null;
  };
  fluency: number | null;
}

export interface CoachTip {
  kind: string;
  text: string;
}

export interface MissionPublic {
  level: CefrLevel;
  startedAt: number;
  endsAt: number;
  startedBy: string;
  total: number;
  completed: {
    userId: string;
    userName: string;
    word: string;
    points: number;
    place: number;
  }[];
}

export interface MissionPrivate {
  word: string;
  meaning: string;
  example: string;
  level: CefrLevel;
  swapped: boolean;
  completed: boolean;
  points: number | null;
}

export interface MissionCompletion {
  userId: string;
  userName: string;
  word: string;
  meaning: string;
  points: number;
  place: number;
  total: number;
}

export interface MissionResult {
  level: CefrLevel;
  reason: "stopped" | "timeout";
  results: {
    userId: string;
    userName: string;
    word: string;
    meaning: string;
    completed: boolean;
    points: number;
    place: number | null;
  }[];
}

export interface AirtimeSnapshot {
  entries: { userId: string; name: string; seconds: number; share: number }[];
  totalSeconds: number;
  balance: number | null;
  quiet: string[];
}

export interface TopicCard {
  id: string;
  level: CefrLevel;
  category: string;
  prompt: string;
  followUps: string[];
  vocab: string[];
}

export interface Spotlight {
  id: string;
  target: { userId: string; name: string } | null;
  card: TopicCard;
  by: string;
  at: number;
}

interface Options {
  roomId: string;
  userId: string;
  socket: Socket | null;
  isConnected: boolean;
}

export const useRoomCoach = ({
  roomId,
  userId,
  socket,
  isConnected,
}: Options) => {
  const [live, setLive] = useState<FluencySnapshot | null>(null);
  const [tip, setTip] = useState<(CoachTip & { at: number }) | null>(null);
  const [mission, setMission] = useState<MissionPublic | null>(null);
  const [myMission, setMyMission] = useState<MissionPrivate | null>(null);
  const [lastResult, setLastResult] = useState<MissionResult | null>(null);
  const [airtime, setAirtime] = useState<AirtimeSnapshot | null>(null);
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  /** Missions you completed since opening this room */
  const [missionsDone, setMissionsDone] = useState(0);

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  });

  useEffect(() => {
    if (!socket) return;

    const onState = (s: {
      coach?: { snapshot: FluencySnapshot };
      mission?: MissionPublic | null;
      myMission?: MissionPrivate | null;
      airtime?: AirtimeSnapshot;
    }) => {
      if (s.coach?.snapshot) setLive(s.coach.snapshot);
      setMission(s.mission ?? null);
      setMyMission(s.myMission ?? null);
      if (s.airtime) setAirtime(s.airtime);
    };

    const onCoach = (c: { snapshot: FluencySnapshot; tip: CoachTip | null }) => {
      if (c?.snapshot) setLive(c.snapshot);
      if (c?.tip) setTip({ ...c.tip, at: Date.now() });
    };

    const onStarted = (m: MissionPublic) => {
      setMission(m);
      setLastResult(null);
      toast.info("🎯 Mission round started! Check your secret word.");
    };

    const onWord = (w: MissionPrivate | null) => setMyMission(w);
    const onProgress = (m: MissionPublic | null) => setMission(m);

    const onComplete = (c: MissionCompletion) => {
      if (c.userId === userIdRef.current) {
        setMissionsDone((n) => n + 1);
        toast.success(
          `🎯 You used "${c.word}"! +${c.points} XP (finished #${c.place})`,
        );
      } else {
        toast(`🎯 ${c.userName} slipped in "${c.word}" (+${c.points})`);
      }
    };

    const onEnded = (r: MissionResult) => {
      setMission(null);
      setMyMission(null);
      setLastResult(r);
      const done = r.results.filter((x) => x.completed).length;
      toast.info(
        r.reason === "timeout"
          ? `⏱️ Mission round over — ${done}/${r.results.length} completed`
          : `🏁 Mission round ended — ${done}/${r.results.length} completed`,
      );
    };

    const onAirtime = (a: AirtimeSnapshot) => setAirtime(a);
    const onSpotlight = (s: Spotlight) => {
      setSpotlight(s);
      if (s.target?.userId === userIdRef.current) {
        toast("🔦 You're in the spotlight — your turn to talk!");
      }
    };

    socket.on("voice:coach-state", onState);
    socket.on("voice:coach", onCoach);
    socket.on("voice:mission-started", onStarted);
    socket.on("voice:mission-word", onWord);
    socket.on("voice:mission-progress", onProgress);
    socket.on("voice:mission-complete", onComplete);
    socket.on("voice:mission-ended", onEnded);
    socket.on("voice:airtime", onAirtime);
    socket.on("voice:spotlight", onSpotlight);

    // The join may already have happened before we listened
    if (socket.connected) socket.emit("voice:coach-get", { roomId });

    return () => {
      socket.off("voice:coach-state", onState);
      socket.off("voice:coach", onCoach);
      socket.off("voice:mission-started", onStarted);
      socket.off("voice:mission-word", onWord);
      socket.off("voice:mission-progress", onProgress);
      socket.off("voice:mission-complete", onComplete);
      socket.off("voice:mission-ended", onEnded);
      socket.off("voice:airtime", onAirtime);
      socket.off("voice:spotlight", onSpotlight);
    };
  }, [socket, roomId]);

  const startMission = useCallback(
    (level: CefrLevel, durationSec: number) => {
      if (socket && isConnected)
        socket.emit("voice:mission-start", { roomId, level, durationSec });
    },
    [socket, isConnected, roomId],
  );

  const stopMission = useCallback(() => {
    if (socket && isConnected) socket.emit("voice:mission-stop", { roomId });
  }, [socket, isConnected, roomId]);

  const swapWord = useCallback(() => {
    if (socket && isConnected) socket.emit("voice:mission-swap", { roomId });
  }, [socket, isConnected, roomId]);

  const sendSpotlight = useCallback(
    (opts: {
      targetUserId?: string;
      level?: CefrLevel;
      category?: string;
      everyone?: boolean;
    }) => {
      if (socket && isConnected) socket.emit("voice:spotlight", { roomId, ...opts });
    },
    [socket, isConnected, roomId],
  );

  const dismissSpotlight = useCallback(() => setSpotlight(null), []);
  const dismissTip = useCallback(() => setTip(null), []);

  return {
    live,
    tip,
    mission,
    myMission,
    lastResult,
    airtime,
    spotlight,
    missionsDone,
    startMission,
    stopMission,
    swapWord,
    sendSpotlight,
    dismissSpotlight,
    dismissTip,
    clearResult: () => setLastResult(null),
  };
};

export default useRoomCoach;
