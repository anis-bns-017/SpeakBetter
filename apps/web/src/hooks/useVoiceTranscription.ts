// apps/web/src/hooks/useVoiceTranscription.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

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
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const shouldRunRef = useRef(false);

  // -----------------------------------------------------------
  // Support detection
  // -----------------------------------------------------------
  useEffect(() => {
    const w = window as any;
    setIsSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  // -----------------------------------------------------------
  // Emit local transcription to socket
  // -----------------------------------------------------------
  const emitTranscription = useCallback(
    (text: string, isFinal: boolean, confidence: number) => {
      if (!socket || !isConnected || !text.trim()) return;

      const id = `${userId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      // Local echo — instant feedback for the speaker
      setTranscriptions((prev) => {
        // Replace existing partial from same user if not final
        const cleaned = isFinal
          ? prev.filter((t) => t.isFinal || t.userId !== userId)
          : prev.filter((t) => t.isFinal || t.userId !== userId);

        return [
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
        ];
      });

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
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
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

    recognition.onresult = (event: any) => {
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

    recognition.onerror = (event: any) => {
      // "no-speech" is normal — just keep going
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Auto-restart if we're supposed to be running (Chrome kills it after silence)
      if (shouldRunRef.current) {
        setTimeout(() => {
          if (shouldRunRef.current) {
            try {
              recognition.start();
            } catch {
              /* ignore */
            }
          }
        }, 300);
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

        return [
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
        ];
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
    startRecognition();
  }, [startRecognition]);

  const stop = useCallback(() => {
    stopRecognition();
  }, [stopRecognition]);

  return {
    transcriptions,
    isRecording,
    isSupported,
    start,
    stop,
    clear,
  };
};

export default useVoiceTranscription;