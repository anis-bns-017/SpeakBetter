// apps/web/src/components/call/useRandomCall.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteAudioTrack,
} from "livekit-client";
import { ensureFreshSession } from "../../lib/api/client";
import {
  callApi,
  callSocketUrl,
  type CallGoal,
  type CallLevel,
  type CallStatus,
  type CardKind,
  type ConversationCard,
} from "./callApi";

export type CallPhase =
  | "loading"
  | "setup"
  | "searching"
  | "timeout"
  | "connecting"
  | "in-call"
  | "ended";

export interface ActiveCall {
  callId: string;
  endsAt: number; // ms, in the server's clock
  extensions: number;
  maxExtensions: number;
  goal: string;
  language: string;
  level: string;
  partner: {
    id: string;
    name: string;
    avatarUrl: string | null;
    country: string | null;
    nativeLanguage: string | null;
    level: string;
  };
  deck: ConversationCard[];
  liveKit: { url: string; token: string; room: string };
}

export interface EndedCall {
  callId: string;
  reason: string;
  endedByYou: boolean;
  partnerName: string;
  partnerId: string;
  seconds: number;
  meTalkSeconds: number;
  partnerTalkSeconds: number;
  /** XP this call earned (0 for short or reported calls) */
  xp: number;
}

/** What the server sends when a call starts or resumes */
interface MatchedPayload {
  callId: string;
  serverNow?: number;
  endsAt: string;
  extensions?: number;
  maxExtensions?: number;
  goal: string;
  language: string;
  level: string;
  partner: ActiveCall["partner"];
  deck?: ConversationCard[];
  liveKit: ActiveCall["liveKit"];
}

export interface CallError {
  code: string;
  message: string;
}

/** A call is short: poll who is speaking this often to tally talk time */
const TALK_TICK_MS = 250;
/** Nobody speaking for this long counts as an awkward silence */
const SILENCE_MS = 12_000;

export function useRandomCall() {
  const [phase, setPhase] = useState<CallPhase>("loading");
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [waitedSeconds, setWaitedSeconds] = useState(0);
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [deck, setDeck] = useState<ConversationCard[]>([]);
  const [cardId, setCardId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const deckRef = useRef<ConversationCard[]>([]);
  const drawTimerRef = useRef<number | undefined>(undefined);
  const [partnerWantsExtend, setPartnerWantsExtend] = useState(false);
  const [iWantExtend, setIWantExtend] = useState(false);
  const [justExtended, setJustExtended] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [meSpeaking, setMeSpeaking] = useState(false);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [talk, setTalk] = useState({ me: 0, partner: 0 });
  const [silent, setSilent] = useState(false);
  const [mediaState, setMediaState] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [ended, setEnded] = useState<EndedCall | null>(null);
  const [error, setError] = useState<CallError | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const roomRef = useRef<Room | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const clockOffsetRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastSpeechRef = useRef(0);
  const speakingRef = useRef({ me: false, partner: false });
  const talkRef = useRef({ me: 0, partner: 0 });
  const audioElsRef = useRef<HTMLMediaElement[]>([]);
  const phaseRef = useRef<CallPhase>("loading");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const teardownMedia = useCallback(() => {
    for (const el of audioElsRef.current) el.remove();
    audioElsRef.current = [];
    const room = roomRef.current;
    roomRef.current = null;
    if (room) void room.disconnect();
    setMeSpeaking(false);
    setPartnerSpeaking(false);
  }, []);

  // ---- LiveKit: join the call's two-person audio room ----
  const connectMedia = useCallback(
    async (info: ActiveCall) => {
      teardownMedia();
      setMediaState("connecting");
      setMicError(null);
      const room = new Room({ adaptiveStream: false, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = (track as RemoteAudioTrack).attach();
        el.style.display = "none";
        document.body.appendChild(el);
        audioElsRef.current.push(el);
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const me = speakers.some((s) => s.isLocal);
        const partner = speakers.some((s) => !s.isLocal);
        speakingRef.current = { me, partner };
        setMeSpeaking(me);
        setPartnerSpeaking(partner);
        if (me || partner) lastSpeechRef.current = Date.now();
      });
      room.on(RoomEvent.Reconnecting, () => setMediaState("reconnecting"));
      room.on(RoomEvent.Reconnected, () => setMediaState("connected"));
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) setMediaState("connecting");
      });

      try {
        await room.connect(info.liveKit.url, info.liveKit.token);
        setMediaState("connected");
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch {
          setMicError("We could not use your microphone. Allow it in your browser and try again.");
        }
      } catch {
        setError({ code: "MEDIA", message: "Could not connect the audio. Check your connection." });
      }
    },
    [teardownMedia],
  );

  const startCall = useCallback(
    (payload: MatchedPayload) => {
      const info: ActiveCall = {
        callId: payload.callId,
        endsAt: new Date(payload.endsAt).getTime(),
        extensions: payload.extensions ?? 0,
        maxExtensions: payload.maxExtensions ?? 2,
        goal: payload.goal,
        language: payload.language,
        level: payload.level,
        partner: payload.partner,
        deck: payload.deck ?? [],
        liveKit: payload.liveKit,
      };
      clockOffsetRef.current = (payload.serverNow ?? Date.now()) - Date.now();
      callRef.current = info;
      startedAtRef.current = Date.now();
      lastSpeechRef.current = Date.now();
      talkRef.current = { me: 0, partner: 0 };
      setTalk({ me: 0, partner: 0 });
      setCall(info);
      setNow(Date.now() + clockOffsetRef.current);
      setEndsAt(info.endsAt);
      deckRef.current = info.deck;
      setDeck(info.deck);
      setCardId(info.deck[0]?.id ?? null);
      setDrawing(false);
      setPartnerWantsExtend(false);
      setIWantExtend(false);
      setJustExtended(false);
      setMuted(false);
      setSilent(false);
      setEnded(null);
      setError(null);
      setPhase("in-call");
      void connectMedia(info);
    },
    [connectMedia],
  );

  // ---- Socket ----
  useEffect(() => {
    const socket = io(callSocketUrl(), {
      withCredentials: true,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
      auth: (cb) => {
        void ensureFreshSession().finally(() => cb({}));
      },
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("rc:ready", (s: CallStatus) => {
      setStatus(s);
      setWaiting(s.waiting);
      if (phaseRef.current === "in-call" || phaseRef.current === "connecting") return;
      setPhase(s.queued ? "searching" : "setup");
    });
    socket.on("rc:queued", (d: { waiting: number }) => {
      setWaiting(d.waiting);
      if (phaseRef.current !== "in-call") setPhase((p) => (p === "setup" || p === "timeout" ? "searching" : p));
    });
    socket.on("rc:left", () => setPhase("setup"));
    socket.on("rc:timeout", () => setPhase("timeout"));
    socket.on("rc:matched", (payload: MatchedPayload) => {
      setPhase("connecting");
      startCall(payload);
    });
    socket.on("rc:resume", (payload: MatchedPayload) => startCall(payload));
    socket.on("rc:card", (d: { callId: string; card: ConversationCard }) => {
      if (callRef.current?.callId !== d.callId || !d.card) return;
      // A card drawn at random may not be in this deck yet: add it, then show it
      if (!deckRef.current.some((c) => c.id === d.card.id)) {
        deckRef.current = [...deckRef.current, d.card];
        setDeck(deckRef.current);
      }
      setCardId(d.card.id);
      window.clearTimeout(drawTimerRef.current);
      setDrawing(false);
    });
    socket.on("rc:extend-requested", () => setPartnerWantsExtend(true));
    socket.on("rc:extended", (d: { endsAt: string; extensions: number }) => {
      const next = new Date(d.endsAt).getTime();
      setEndsAt(next);
      setPartnerWantsExtend(false);
      setIWantExtend(false);
      setJustExtended(true);
      setCall((c) => (c ? { ...c, endsAt: next, extensions: d.extensions } : c));
      window.setTimeout(() => setJustExtended(false), 4000);
    });
    socket.on("rc:ended", (d: { callId: string; reason: string; endedByYou: boolean; xp?: number; seconds?: number }) => {
      const info = callRef.current;
      if (!info || info.callId !== d.callId) return;
      teardownMedia();
      setEnded({
        callId: d.callId,
        reason: d.reason,
        endedByYou: d.endedByYou,
        partnerName: info.partner.name,
        partnerId: info.partner.id,
        seconds: d.seconds ?? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)),
        xp: d.xp ?? 0,
        meTalkSeconds: Math.round(talkRef.current.me),
        partnerTalkSeconds: Math.round(talkRef.current.partner),
      });
      setPhase("ended");
    });
    socket.on("rc:error", (e: CallError) => {
      setError(e);
      if (e.code === "VOICE_UNAVAILABLE") setPhase("setup");
      if (e.code === "NEEDS_CONSENT") setPhase("setup");
      if (e.code === "RESTRICTED" || e.code === "BANNED" || e.code === "UNDERAGE") {
        void callApi.status().then(setStatus).catch(() => undefined);
        setPhase("setup");
      }
    });

    return () => {
      // Leaving the page hangs up (otherwise the partner waits for the grace period)
      if (callRef.current && phaseRef.current === "in-call") {
        socket.emit("rc:end", { callId: callRef.current.callId });
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      teardownMedia();
    };
  }, [startCall, teardownMedia]);

  // ---- Clock, talk time and silence while a call is on ----
  useEffect(() => {
    if (phase !== "in-call") return;
    const clock = window.setInterval(() => setNow(Date.now() + clockOffsetRef.current), 500);
    const tally = window.setInterval(() => {
      const dt = TALK_TICK_MS / 1000;
      if (speakingRef.current.me) talkRef.current.me += dt;
      if (speakingRef.current.partner) talkRef.current.partner += dt;
    }, TALK_TICK_MS);
    const publish = window.setInterval(() => {
      setTalk({ ...talkRef.current });
      setSilent(Date.now() - lastSpeechRef.current > SILENCE_MS);
    }, 1000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(tally);
      window.clearInterval(publish);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "searching") return;
    const started = Date.now();
    const id = window.setInterval(
      () => setWaitedSeconds(Math.round((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [phase]);

  // ---- Actions ----
  const join = useCallback(
    (prefs: { level: CallLevel; goal: CallGoal; language: string }) => {
      setError(null);
      setWaitedSeconds(0);
      setPhase("searching");
      socketRef.current?.emit("rc:join", prefs);
    },
    [],
  );

  const cancel = useCallback(() => {
    socketRef.current?.emit("rc:leave");
    setPhase("setup");
  }, []);

  const endCall = useCallback(() => {
    if (callRef.current) socketRef.current?.emit("rc:end", { callId: callRef.current.callId });
  }, []);

  const extend = useCallback(() => {
    if (!callRef.current) return;
    setIWantExtend(true);
    socketRef.current?.emit("rc:extend", { callId: callRef.current.callId });
  }, []);

  /** Shows a card from the deck to both people */
  const goToCard = useCallback((index: number) => {
    const info = callRef.current;
    const cards = deckRef.current;
    if (!info || cards.length === 0) return;
    const next = cards[(index + cards.length) % cards.length];
    setCardId(next.id);
    socketRef.current?.emit("rc:card", { callId: info.callId, cardId: next.id });
  }, []);

  /** The random question generator: the server picks a fresh card for both */
  const drawCard = useCallback((kind?: CardKind) => {
    const info = callRef.current;
    if (!info) return;
    setDrawing(true);
    window.clearTimeout(drawTimerRef.current);
    // if the server does not answer, let the button work again
    drawTimerRef.current = window.setTimeout(() => setDrawing(false), 2500);
    socketRef.current?.emit("rc:draw", {
      callId: info.callId,
      kind,
      exclude: deckRef.current.map((c) => c.id),
    });
  }, []);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch {
      setMicError("Could not change your microphone.");
    }
  }, [muted]);

  const reset = useCallback(() => {
    callRef.current = null;
    setCall(null);
    setEnded(null);
    setError(null);
    setPhase("setup");
    void callApi.status().then((s) => { setStatus(s); setWaiting(s.waiting); }).catch(() => undefined);
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const getSocket = useCallback(() => socketRef.current, []);

  const secondsLeft = call && phase === "in-call" ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;

  return {
    phase,
    status,
    connected,
    waiting,
    waitedSeconds,
    call,
    secondsLeft,
    deck,
    card: deck.find((c) => c.id === cardId) ?? deck[0] ?? null,
    cardIndex: Math.max(0, deck.findIndex((c) => c.id === cardId)),
    drawing,
    partnerWantsExtend,
    iWantExtend,
    justExtended,
    muted,
    micError,
    meSpeaking,
    partnerSpeaking,
    talk,
    silent,
    mediaState,
    ended,
    error,
    setStatus,
    getSocket,
    join,
    cancel,
    endCall,
    extend,
    goToCard,
    drawCard,
    toggleMute,
    reset,
    clearError,
  };
}
