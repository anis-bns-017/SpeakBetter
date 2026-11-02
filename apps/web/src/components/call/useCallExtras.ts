// apps/web/src/components/call/useCallExtras.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useSpeechCaptions } from "./useSpeechCaptions";

export const REACTION_EMOJIS = ["👏", "❤️", "😂", "😮", "🔥", "🙏"] as const;

export interface FloatingReaction {
  id: number;
  emoji: string;
  mine: boolean;
}

export interface CallTip {
  id: number;
  text: string;
  /** Hidden from the screen, but still listed in the recap */
  dismissed: boolean;
}

interface Extras {
  callId: string | null;
  /** The last few finished lines your partner said */
  lines: string[];
  /** What they are saying right now */
  interim: string;
  myCaption: string;
  reactions: FloatingReaction[];
  tips: CallTip[];
  sentTips: number;
  savedWords: string[];
}

const emptyFor = (callId: string | null): Extras => ({
  callId,
  lines: [],
  interim: "",
  myCaption: "",
  reactions: [],
  tips: [],
  sentTips: 0,
  savedWords: [],
});

const CAPTIONS_KEY = "speakbetter:random-call:captions";
const MAX_LINES = 3;
const REACTION_MS = 3000;

const loadCaptions = () => {
  try {
    return localStorage.getItem(CAPTIONS_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * What happens around the talking: live captions of each other, reactions,
 * friendly correction tips and words saved from captions. Everything is
 * remembered per call, so a new call starts clean.
 */
export function useCallExtras(options: {
  /** The call socket (created by useRandomCall); `connected` changes when it is ready */
  getSocket: () => Socket | null;
  connected: boolean;
  callId: string | null;
  inCall: boolean;
  muted: boolean;
}) {
  const { getSocket, connected, callId, inCall, muted } = options;
  const [captionsOn, setCaptionsOnState] = useState(loadCaptions);
  const [store, setStore] = useState<Extras>(() => emptyFor(null));
  const counter = useRef(0);
  const callIdRef = useRef(callId);
  useEffect(() => {
    callIdRef.current = callId;
  });

  // The state of an earlier call is ignored: it is replaced on the next update
  const view = store.callId === callId ? store : emptyFor(callId);

  const update = useCallback((id: string | null, change: (prev: Extras) => Extras) => {
    setStore((prev) => change(prev.callId === id ? prev : emptyFor(id)));
  }, []);

  const setCaptionsOn = useCallback((on: boolean) => {
    setCaptionsOnState(on);
    try {
      localStorage.setItem(CAPTIONS_KEY, on ? "1" : "0");
    } catch {
      // remembering the choice is a convenience only
    }
  }, []);

  // ---- things the partner sends ----
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onCaption = (d: { callId: string; text: string; final: boolean }) => {
      if (d.callId !== callIdRef.current) return;
      update(d.callId, (prev) =>
        d.final
          ? { ...prev, lines: [...prev.lines, d.text].slice(-MAX_LINES), interim: "" }
          : { ...prev, interim: d.text },
      );
    };
    const onReaction = (d: { callId: string; emoji: string }) => {
      if (d.callId !== callIdRef.current) return;
      const id = ++counter.current;
      update(d.callId, (prev) => ({
        ...prev,
        reactions: [...prev.reactions, { id, emoji: d.emoji, mine: false }],
      }));
      window.setTimeout(
        () => update(d.callId, (prev) => ({ ...prev, reactions: prev.reactions.filter((r) => r.id !== id) })),
        REACTION_MS,
      );
    };
    const onNote = (d: { callId: string; text: string }) => {
      if (d.callId !== callIdRef.current) return;
      const id = ++counter.current;
      update(d.callId, (prev) => ({ ...prev, tips: [...prev.tips, { id, text: d.text, dismissed: false }] }));
    };
    const onNoteSent = (d: { callId: string }) => {
      if (d.callId !== callIdRef.current) return;
      update(d.callId, (prev) => ({ ...prev, sentTips: prev.sentTips + 1 }));
    };

    socket.on("rc:caption", onCaption);
    socket.on("rc:reaction", onReaction);
    socket.on("rc:note", onNote);
    socket.on("rc:note-sent", onNoteSent);
    return () => {
      socket.off("rc:caption", onCaption);
      socket.off("rc:reaction", onReaction);
      socket.off("rc:note", onNote);
      socket.off("rc:note-sent", onNoteSent);
    };
  }, [getSocket, connected, update]);

  // ---- what you say, as text, for your partner ----
  const speech = useSpeechCaptions({
    active: captionsOn && inCall && !muted && !!callId,
    onText: (text, final) => {
      const id = callIdRef.current;
      if (!id) return;
      update(id, (prev) => ({ ...prev, myCaption: text }));
      getSocket()?.emit("rc:caption", { callId: id, text, final });
    },
  });

  const sendReaction = useCallback(
    (emoji: string) => {
      const id = callIdRef.current;
      if (!id) return;
      getSocket()?.emit("rc:reaction", { callId: id, emoji });
      const key = ++counter.current;
      update(id, (prev) => ({
        ...prev,
        reactions: [...prev.reactions, { id: key, emoji, mine: true }],
      }));
      window.setTimeout(
        () => update(id, (prev) => ({ ...prev, reactions: prev.reactions.filter((r) => r.id !== key) })),
        REACTION_MS,
      );
    },
    [getSocket, update],
  );

  const sendTip = useCallback(
    (text: string) => {
      const id = callIdRef.current;
      if (id && text.trim()) getSocket()?.emit("rc:note", { callId: id, text: text.trim() });
    },
    [getSocket],
  );

  const dismissTip = useCallback(
    (tipId: number) => {
      const id = callIdRef.current;
      update(id, (prev) => ({
        ...prev,
        tips: prev.tips.map((t) => (t.id === tipId ? { ...t, dismissed: true } : t)),
      }));
    },
    [update],
  );

  const noteSavedWord = useCallback(
    (word: string) => {
      const id = callIdRef.current;
      update(id, (prev) =>
        prev.savedWords.includes(word) ? prev : { ...prev, savedWords: [...prev.savedWords, word] },
      );
    },
    [update],
  );

  return {
    captionsOn,
    setCaptionsOn,
    captionsSupported: speech.supported,
    captionsError: speech.error,
    partnerLines: view.lines,
    partnerInterim: view.interim,
    myCaption: view.myCaption,
    reactions: view.reactions,
    tips: view.tips,
    liveTips: view.tips.filter((t) => !t.dismissed),
    sentTips: view.sentTips,
    savedWords: view.savedWords,
    sendReaction,
    sendTip,
    dismissTip,
    noteSavedWord,
  };
}
