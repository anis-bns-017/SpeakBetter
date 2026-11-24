// apps/web/src/components/voice/shared/useStageReactions.ts
/**
 * One pipeline for every emoji that floats over the stage (hearts, claps, fire…).
 *
 * Single origin: each reaction records where the reaction dock's emitter is on screen when it is created, and
 * ReactionOverlay launches it from exactly that point. Nothing else spawns bubbles.
 *
 * Single copy: the server broadcasts a reaction to the whole room, the sender included. Your own tap already
 * showed instantly, so the echo of it is swallowed here (that echo used to appear a second time at a random spot).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { tr } from "../../../i18n/core";
import { FLOAT_MS, type StageReaction, type StageMilestone } from "./ReactionOverlay";

const MAX_STAGE_REACTIONS = 72;
/** Per person, per emoji, per window — stops one finger from flooding the room */
const FLOOD_MAX = 8;
/** Clapping is meant to be mashed or held, so it gets a far bigger allowance */
const CLAP_FLOOD_MAX = 60;
const FLOOD_WINDOW_MS = 4000;
/** Reactions leave the list a little after the overlay finishes animating them */
const LIFETIME_MS = FLOAT_MS + 900;
/** Your echo should come back within this long; later than that it is somebody else's (another tab) */
const ECHO_WINDOW_MS = 5000;
/** The room counts as "hot" when this many reactions land inside HEAT_WINDOW_MS */
const HEAT_FULL = 18;
const HEAT_WINDOW_MS = 6000;
/** One clap sends a small burst of 👏; the burst grows while you keep clapping */
const CLAP_EMOJI = "👏";
const CLAP_STREAK_WINDOW_MS = 1400;
const CLAP_BASE = 3;
const CLAP_MAX = 8;
/** Gap between the pieces of a burst, in seconds */
const CLAP_STAGGER_S = 0.075;
/** A burst of confetti every N of your own reactions */
const MILESTONE_EVERY = 10;

interface Options {
  socket?: Socket | null;
  userId?: string;
  userName?: string;
  /** Emits the reaction to the room (useVoice's sendStageReaction) */
  sendStageReaction: (emoji: string) => void;
}

interface RawReaction {
  id?: string;
  userId: string;
  userName?: string;
  emoji: string;
  createdAt?: number;
}

export interface StageReactions {
  reactions: StageReaction[];
  milestones: StageMilestone[];
  /** 0–1: how busy the reactions are right now (drives the dock's heat bar) */
  heat: number;
  /** Attach to the dock's emitter element; every reaction rises from it */
  anchorRef: RefObject<HTMLElement | null>;
  /** React with an emoji: shows it at once and tells the room */
  react: (emoji: string) => void;
  /** Same as react("👏") */
  clap: () => void;
}

/** Where reactions start: the emitter's centre, or bottom-centre of the screen if it isn't on screen */
function readOrigin(el: HTMLElement | null): { x: number; y: number } {
  const rect = el?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return { x: window.innerWidth / 2, y: window.innerHeight - 120 };
}

export function useStageReactions({ socket, userId, userName, sendStageReaction }: Options): StageReactions {
  const [reactions, setReactions] = useState<StageReaction[]>([]);
  const [milestones, setMilestones] = useState<StageMilestone[]>([]);
  const [heat, setHeat] = useState(0);

  const anchorRef = useRef<HTMLElement | null>(null);
  const floodRef = useRef(new Map<string, { count: number; firstAt: number }>());
  const sentRef = useRef<number[]>([]); // when each of my own reactions left, to recognise their echoes
  const recentRef = useRef<number[]>([]); // arrival times of every reaction, for the heat meter
  const ownCountRef = useRef(0);
  const clapTimesRef = useRef<number[]>([]);

  /** Shows one reaction, or a staggered burst of `count` of the same emoji fanning out from the emitter */
  const push = useCallback(
    (r: Omit<StageReaction, "originX" | "originY" | "createdAt" | "delay" | "fan" | "ring"> & { createdAt?: number }, count = 1) => {
      const origin = readOrigin(anchorRef.current);
      const now = Date.now();
      recentRef.current.push(now);
      const pieces: StageReaction[] = Array.from({ length: count }, (_, i) => ({
        ...r,
        id: count === 1 ? r.id : `${r.id}-${i}`,
        originX: origin.x,
        originY: origin.y,
        createdAt: now,
        delay: i * CLAP_STAGGER_S,
        // Spread the burst evenly across the fan, centre piece first-ish, so it never clumps on one side
        fan: count === 1 ? undefined : (i / (count - 1)) * 2 - 1,
        ring: i === 0,
      }));
      setReactions((prev) => {
        if (prev.some((p) => p.id === pieces[0].id)) return prev;
        return [...prev, ...pieces].slice(-MAX_STAGE_REACTIONS);
      });
    },
    [],
  );

  // Somebody else's reaction (or the echo of mine, which we drop)
  useEffect(() => {
    if (!socket) return;
    const onReaction = (data: RawReaction) => {
      if (userId && data.userId === userId) {
        const now = Date.now();
        sentRef.current = sentRef.current.filter((t) => now - t < ECHO_WINDOW_MS);
        if (sentRef.current.length > 0) {
          sentRef.current.shift(); // already on screen from my own tap
          return;
        }
      }
      push(
        {
          id: data.id || `${data.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          emoji: data.emoji,
          userId: data.userId,
          userName: data.userName,
          local: false,
        },
        data.emoji === CLAP_EMOJI ? CLAP_BASE : 1,
      );
    };
    socket.on("voice:stage-reaction", onReaction);
    return () => {
      socket.off("voice:stage-reaction", onReaction);
    };
  }, [socket, userId, push]);

  // Expire old reactions and keep the heat meter fresh while anything is happening
  const active = reactions.length > 0 || heat > 0;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setReactions((prev) => {
        const next = prev.filter((r) => now - r.createdAt < LIFETIME_MS);
        return next.length === prev.length ? prev : next;
      });
      setMilestones((prev) => {
        const next = prev.filter((m) => now - m.createdAt < 2600);
        return next.length === prev.length ? prev : next;
      });
      recentRef.current = recentRef.current.filter((t) => now - t < HEAT_WINDOW_MS);
      const nextHeat = Math.min(1, recentRef.current.length / HEAT_FULL);
      setHeat((h) => (Math.abs(h - nextHeat) < 0.02 ? h : nextHeat));
    }, 400);
    return () => window.clearInterval(id);
  }, [active]);

  const fire = useCallback(
    (emoji: string, count: number) => {
      const uid = userId || "me";
      const now = Date.now();
      const key = `${uid}:${emoji}`;
      const limit = emoji === CLAP_EMOJI ? CLAP_FLOOD_MAX : FLOOD_MAX;
      const entry = floodRef.current.get(key) || { count: 0, firstAt: now };
      if (now - entry.firstAt > FLOOD_WINDOW_MS) {
        entry.count = 0;
        entry.firstAt = now;
      }
      if (entry.count >= limit) {
        toast.warning(tr("Slow down — too many reactions in a row"), { id: "reaction-flood", duration: 1500 });
        return;
      }
      entry.count += 1;
      floodRef.current.set(key, entry);

      push(
        {
          id: `local-${now}-${Math.random().toString(36).slice(2)}`,
          emoji,
          userId: uid,
          userName,
          local: true,
        },
        count,
      );

      // One message to the room however big the burst is; everyone's screen builds its own burst from it
      sentRef.current.push(now);
      sendStageReaction(emoji);

      ownCountRef.current += 1;
      if (ownCountRef.current % MILESTONE_EVERY === 0) {
        const origin = readOrigin(anchorRef.current);
        setMilestones((prev) => [
          ...prev.slice(-2),
          { id: `m-${now}`, originX: origin.x, originY: origin.y, count: ownCountRef.current, createdAt: now },
        ]);
      }
    },
    [userId, userName, push, sendStageReaction],
  );

  const react = useCallback((emoji: string) => fire(emoji, 1), [fire]);

  /** A clap: a burst of 👏, one more piece for every few claps in a row */
  const clap = useCallback(() => {
    const now = Date.now();
    clapTimesRef.current = clapTimesRef.current.filter((t) => now - t < CLAP_STREAK_WINDOW_MS);
    clapTimesRef.current.push(now);
    const streak = clapTimesRef.current.length;
    fire(CLAP_EMOJI, Math.min(CLAP_MAX, CLAP_BASE + Math.floor(streak / 2)));
  }, [fire]);

  return useMemo(
    () => ({ reactions, milestones, heat, anchorRef, react, clap }),
    [reactions, milestones, heat, react, clap],
  );
}
