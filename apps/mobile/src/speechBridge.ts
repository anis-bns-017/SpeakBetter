// apps/mobile/src/speechBridge.ts
// The app side of speech recognition in the web view (see speechPolyfill.ts for the page side): it runs the
// phone's own recognizer (Google on Android, Apple on iPhone, via expo-speech-recognition) and sends what it
// hears back to the page.
//
// expo-speech-recognition is a native module, so it exists in development and store builds but not in Expo Go.
// There the bridge is simply off and the site behaves as in a browser without speech recognition.
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { Platform } from "react-native";
import type { WebView, WebViewMessageEvent } from "react-native-webview";
import { SPEECH_POLYFILL } from "./speechPolyfill";

interface Subscription {
  remove(): void;
}
interface Alternative {
  transcript?: string;
  confidence?: number;
}
/** The parts of ExpoSpeechRecognitionModule used here */
interface SpeechModule {
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  isRecognitionAvailable(): boolean;
  addListener(event: string, listener: (event: Record<string, unknown>) => void): Subscription;
}

/** The native module, or null in Expo Go (requiring it there throws) */
function loadSpeechModule(): SpeechModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-recognition").ExpoSpeechRecognitionModule as SpeechModule | undefined;
    return mod && mod.isRecognitionAvailable() ? mod : null;
  } catch {
    return null;
  }
}

const EVENTS = ["start", "audiostart", "speechstart", "speechend", "audioend", "result", "nomatch", "error", "end"] as const;

/** Android 12 and below can't keep listening; the site restarts it after each phrase instead */
const CAN_LISTEN_CONTINUOUSLY = Platform.OS !== "android" || Number(Platform.Version) >= 33;

interface PageMessage {
  channel?: string;
  action?: "start" | "stop" | "abort";
  id?: string;
  options?: { lang?: string; continuous?: boolean; interimResults?: boolean; maxAlternatives?: number };
}

export function useSpeechBridge(webView: RefObject<WebView | null>) {
  const speech = useMemo(loadSpeechModule, []);
  /** The page's recognition object that the phone's recognizer is working for */
  const activeId = useRef<string | null>(null);

  const emit = useCallback(
    (id: string, type: string, payload: unknown = {}) => {
      webView.current?.injectJavaScript(
        `window.__sbSpeech && window.__sbSpeech.emit(${JSON.stringify(id)}, ${JSON.stringify(type)}, ${JSON.stringify(payload)}); true;`,
      );
    },
    [webView],
  );

  // Native events go to whichever page recognition is active
  useEffect(() => {
    if (!speech) return;
    const subs = EVENTS.map((type) =>
      speech.addListener(type, (event) => {
        const id = activeId.current;
        if (!id) return;
        if (type === "result") {
          const results = Array.isArray(event.results) ? (event.results as Alternative[]) : [];
          emit(id, "result", {
            isFinal: Boolean(event.isFinal),
            results: results.map((r) => ({ transcript: r.transcript ?? "", confidence: r.confidence ?? 0 })),
          });
        } else if (type === "error") {
          emit(id, "error", { error: String(event.error ?? "unknown"), message: String(event.message ?? "") });
        } else {
          emit(id, type);
        }
        if (type === "end") activeId.current = null;
      }),
    );
    return () => {
      subs.forEach((s) => s.remove());
      if (activeId.current) speech.abort();
    };
  }, [speech, emit]);

  const start = useCallback(
    async (id: string, options: NonNullable<PageMessage["options"]>) => {
      if (!speech) return;
      // One recognizer at a time: a new start ends the previous one for its page object
      const previous = activeId.current;
      if (previous && previous !== id) {
        speech.abort();
        emit(previous, "end");
      }
      activeId.current = id;
      const permission = await speech.requestPermissionsAsync().catch(() => ({ granted: false }));
      if (activeId.current !== id) return;
      if (!permission.granted) {
        emit(id, "error", { error: "not-allowed", message: "Microphone or speech recognition permission was refused." });
        emit(id, "end");
        activeId.current = null;
        return;
      }
      try {
        speech.start({
          lang: options.lang || "en-US",
          interimResults: Boolean(options.interimResults),
          continuous: Boolean(options.continuous) && CAN_LISTEN_CONTINUOUSLY,
          maxAlternatives: Math.max(1, Math.min(5, options.maxAlternatives ?? 1)),
        });
      } catch (error) {
        emit(id, "error", { error: "audio-capture", message: String(error) });
        emit(id, "end");
        activeId.current = null;
      }
    },
    [speech, emit],
  );

  /** Handles the page's speech messages; returns false for any other message */
  const onMessage = useCallback(
    (event: WebViewMessageEvent): boolean => {
      let message: PageMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as PageMessage;
      } catch {
        return false;
      }
      if (message.channel !== "sb-speech" || !message.id) return false;
      if (message.action === "start") void start(message.id, message.options ?? {});
      else if (message.id === activeId.current) {
        if (message.action === "stop") speech?.stop();
        if (message.action === "abort") speech?.abort();
      }
      return true;
    },
    [start, speech],
  );

  /** A new page loaded: nobody is listening for the old recognition any more */
  const onPageStart = useCallback(() => {
    if (activeId.current) {
      speech?.abort();
      activeId.current = null;
    }
  }, [speech]);

  return {
    available: speech !== null,
    /** Goes into the page before the site's own scripts; empty when there's no recognizer to bridge to */
    injectedScript: speech ? SPEECH_POLYFILL : undefined,
    onMessage,
    onPageStart,
  };
}
