// apps/web/src/components/call/useSpeechCaptions.ts
import { useEffect, useRef, useState } from "react";

/** The parts of the browser's speech recognition we use (not in TypeScript's DOM types) */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechCaptionsSupported = () => getCtor() !== null;

/**
 * Turns what you say into text using the browser's speech recognition
 * (Chrome and Edge). It listens only while `active` is true, and restarts
 * itself because browsers stop recognition after a pause.
 */
export function useSpeechCaptions(options: {
  active: boolean;
  lang?: string;
  onText: (text: string, final: boolean) => void;
}) {
  const { active, lang = "en-US" } = options;
  const onTextRef = useRef(options.onText);
  useEffect(() => {
    onTextRef.current = options.onText;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Ctor = getCtor();
    if (!active || !Ctor) return;

    let wanted = true;
    let restartTimer: number | undefined;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) onTextRef.current(text, true);
        else interim += (interim ? " " : "") + text;
      }
      if (interim) onTextRef.current(interim, false);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wanted = false;
        setError("Captions need microphone access.");
      } else if (event.error === "audio-capture") {
        wanted = false;
        setError("No microphone was found. Plug one in or pick another input in your system settings.");
      } else if (event.error === "network") {
        // Chrome sends the audio to Google for recognition; without internet (or in Brave) it fails
        wanted = false;
        setError("Speech recognition couldn't reach its service. Check your internet connection, or try Chrome or Edge.");
      } else if (event.error === "language-not-supported") {
        wanted = false;
        setError("Your browser can't recognise this language.");
      }
      // "no-speech" and "aborted" are normal pauses
    };
    recognition.onend = () => {
      if (wanted) restartTimer = window.setTimeout(start, 300);
    };

    function start() {
      try {
        recognition.start();
      } catch {
        // already running: nothing to do
      }
    }
    start();

    return () => {
      wanted = false;
      // A fresh recording shouldn't start with the last one's error still showing
      setError(null);
      window.clearTimeout(restartTimer);
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        // not started
      }
    };
  }, [active, lang]);

  return { supported: speechCaptionsSupported(), error };
}
