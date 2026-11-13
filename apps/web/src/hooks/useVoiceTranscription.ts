// apps/web/src/hooks/useVoiceTranscription.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getRecognitionCtor, type Recognition, type RecognitionEvent } from "../lib/speechRecognition";

/**
 * Why captions are not listening, when the browser's speech recognition stops:
 * blocked = microphone permission refused for speech; network = the browser's speech service cannot be reached
 * (Chrome sends audio to Google; Brave and some other Chromium browsers block it); no-mic = no microphone found.
 */
export type CaptionProblem = "blocked" | "network" | "no-mic" | null;

export interface VoiceTranscription {
  id: string;
  text: string;
  isFinal: boolean;
  speaker: string;
  userId: string;
  user?: { id: string; name: string; avatarUrl?: string };
  confidence?: number;
  timestamp: Date;
  translated?: { text: string; language: string };
  language?: string;
}

interface Options {
  roomId: string;
  userId: string;
  userName: string;
  /** Stop transcribing when the local mic is muted */
  isMuted: boolean;
  socket: Socket | null;
  isConnected: boolean;
  /** BCP-47 language tag, e.g. "en-US", "es-ES" */
  language?: string;
}

/** Lines kept for the room transcript (older ones drop off, so a long room stays light) */
export const TRANSCRIPT_MAX_LINES = 400;
const keepRecent = (list: VoiceTranscription[]) =>
  list.length > TRANSCRIPT_MAX_LINES ? list.slice(-TRANSCRIPT_MAX_LINES) : list;

export const useVoiceTranscription = ({
  roomId,
  userId,
  userName,
  isMuted,
  socket,
  isConnected,
  language = "en-US",
}: Options) => {
  const [transcriptions, setTranscriptions] = useState<VoiceTranscription[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [problem, setProblem] = useState<CaptionProblem>(null);
  /** Network failures in a row, to back off instead of hammering the speech service */
  const failuresRef = useRef(0);
  // Known up front: the browser either has speech recognition or it doesn't
  const [isSupported] = useState(() => getRecognitionCtor() !== null);

  const recognitionRef = useRef<Recognition | null>(null);
  const shouldRunRef = useRef(false);

  // -----------------------------------------------------------
  // Emit local transcription to socket
  // -----------------------------------------------------------
  const emitTranscription = useCallback(
    (text: string, isFinal: boolean, confidence: number) => {
      if (!text.trim()) return;

      const id = `${userId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      // Local echo — instant feedback for the speaker
      setTranscriptions((prev) => {
        // Replace existing partial from same user if not final
        const cleaned = isFinal
          ? prev.filter((t) => t.isFinal || t.userId !== userId)
          : prev.filter((t) => t.isFinal || t.userId !== userId);

        return keepRecent([
          ...cleaned,
          {
            id,
            text: text.trim(),
            isFinal,
            speaker: userName,
            userId,
            user: { id: userId, name: userName },
            confidence,
            timestamp: new Date(),
            language: language.split("-")[0],
          },
        ]);
      });

      // Others see it once the room connection is up; your own caption shows either way
      if (!socket || !isConnected) return;
      socket.emit("voice:transcription", {
        roomId,
        id,
        text: text.trim(),
        isFinal,
        confidence,
        language: language.split("-")[0],
      });
    },
    [socket, isConnected, roomId, userId, userName, language],
  );

  // -----------------------------------------------------------
  // Start / stop the recognizer
  // -----------------------------------------------------------
  const stopRecognition = useCallback(() => {
    shouldRunRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecognition = useCallback(() => {
    const SR = getRecognitionCtor();
    if (!SR) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      shouldRunRef.current = true;
    };

    recognition.onresult = (event: RecognitionEvent) => {
      failuresRef.current = 0;
      setProblem(null);
      let interim = "";
      let finalText = "";
      let finalConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        const confidence = Number(result[0]?.confidence ?? 0);

        if (result.isFinal) {
          finalText += transcript;
          finalConfidence = confidence;
        } else {
          interim += transcript;
        }
      }

      if (finalText) {
        emitTranscription(finalText, true, finalConfidence);
      } else if (interim) {
        emitTranscription(interim, false, 0);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      // "no-speech" is normal — just keep going
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("Speech recognition error:", event.error);
      setIsRecording(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        // Permission refused: retrying would fail the same way, so stop until the user acts
        shouldRunRef.current = false;
        setProblem("blocked");
      } else if (event.error === "audio-capture") {
        shouldRunRef.current = false;
        setProblem("no-mic");
      } else if (event.error === "network") {
        failuresRef.current += 1;
        setProblem("network");
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Auto-restart if we're supposed to be running (Chrome kills it after silence)
      if (shouldRunRef.current) {
        // After network failures wait longer each time (up to 30 s) instead of retrying every 300 ms
        const delay = failuresRef.current ? Math.min(30_000, 2_000 * 2 ** (failuresRef.current - 1)) : 300;
        setTimeout(() => {
          if (shouldRunRef.current) {
            try {
              recognition.start();
            } catch {
              /* ignore */
            }
          }
        }, delay);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.warn("Could not start speech recognition:", err);
    }
  }, [language, emitTranscription]);

  // -----------------------------------------------------------
  // Auto start/stop based on mute
  // -----------------------------------------------------------
  useEffect(() => {
    if (!isSupported || !userId) return;
    if (isMuted) {
      // Stops the browser's recognizer (an outside system) and marks it stopped
      // eslint-disable-next-line react-hooks/set-state-in-effect
      stopRecognition();
    } else {
      startRecognition();
    }
    return () => {
      // Don't stop on every re-render, only on unmount
    };
  }, [isMuted, isSupported, userId, startRecognition, stopRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------
  // Listen for others' transcriptions
  // -----------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const handleRemote = (data: {
      id: string;
      text: string;
      isFinal: boolean;
      userId: string;
      userName?: string;
      confidence?: number;
      language?: string;
      createdAt?: number;
    }) => {
      if (data.userId === userId) return; // ignore echo of our own

      setTranscriptions((prev) => {
        const cleaned = data.isFinal
          ? prev.filter((t) => t.isFinal || t.userId !== data.userId)
          : prev.filter((t) => t.isFinal || t.userId !== data.userId);

        return keepRecent([
          ...cleaned,
          {
            id: data.id,
            text: data.text,
            isFinal: data.isFinal,
            speaker: data.userName || "Someone",
            userId: data.userId,
            user: { id: data.userId, name: data.userName || "Someone" },
            confidence: data.confidence,
            timestamp: new Date(data.createdAt ?? Date.now()),
            language: data.language,
          },
        ]);
      });
    };

    socket.on("voice:transcription", handleRemote);
    return () => {
      socket.off("voice:transcription", handleRemote);
    };
  }, [socket, userId]);

  // -----------------------------------------------------------
  // Manual controls + clear
  // -----------------------------------------------------------
  const clear = useCallback(() => setTranscriptions([]), []);

  const start = useCallback(() => {
    shouldRunRef.current = true;
    failuresRef.current = 0;
    setProblem(null);
    startRecognition();
  }, [startRecognition]);

  const stop = useCallback(() => {
    stopRecognition();
  }, [stopRecognition]);

  return {
    transcriptions,
    isRecording,
    problem,
    isSupported,
    start,
    stop,
    clear,
  };
};

export default useVoiceTranscription;