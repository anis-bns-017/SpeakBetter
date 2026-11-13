// apps/web/src/components/call/MicCheck.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { COLORS } from "../voice/lobby/lobbyTheme";
import { tr } from "../../i18n/core";

type State = "idle" | "starting" | "listening" | "heard" | "denied" | "missing";

/** Listens to your microphone for a few seconds and shows a level meter before you queue */
export const MicCheck: React.FC = () => {
  const [state, setState] = useState<State>("idle");
  const [level, setLevel] = useState(0);
  const [label, setLabel] = useState("");
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    stop();
    setState("starting");
    setLevel(0);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = (error as DOMException)?.name;
      setState(name === "NotFoundError" || name === "OverconstrainedError" ? "missing" : "denied");
      return;
    }
    setLabel(stream.getAudioTracks()[0]?.label ?? "");

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioCtx();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    let frame = 0;
    let heard = false;
    const startedAt = performance.now();
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const sample of data) peak = Math.max(peak, Math.abs(sample - 128));
      const value = Math.min(1, peak / 64);
      setLevel(value);
      if (value > 0.18 && !heard) {
        heard = true;
        setState("heard");
      }
      if (performance.now() - startedAt < 12_000) frame = requestAnimationFrame(tick);
      else cleanup();
    };
    const cleanup = () => {
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((t) => t.stop());
      void context.close();
      setLevel(0);
      setState((s) => (s === "heard" ? "heard" : "idle"));
    };
    stopRef.current = cleanup;
    setState("listening");
    frame = requestAnimationFrame(tick);
  };

  const failed = state === "denied" || state === "missing";

  return (
    <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: COLORS.border }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
            {tr("Check your microphone")}</p>
          <p className="truncate text-xs" style={{ color: failed ? COLORS.danger : COLORS.textMuted }} role={failed ? "alert" : undefined}>
            {state === "idle" && tr("Make sure your partner can hear you.")}
            {state === "starting" && tr("Waiting for permission...")}
            {state === "listening" && tr("Say something, like “hello, how are you?”")}
            {state === "heard" && tr("Your microphone works{value}", { value: label ? `: ${label}` : "." })}
            {state === "denied" && tr("Microphone access is blocked. Allow it in your browser's address bar.")}
            {state === "missing" && tr("No microphone found. Plug one in or pick another device.")}
          </p>
        </div>
        <button
          onClick={state === "listening" ? stop : start}
          disabled={state === "starting"}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5 disabled:opacity-60"
          style={{ borderColor: COLORS.borderLight, color: COLORS.textPrimary }}
        >
          {state === "starting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : failed ? (
            <MicOff className="h-4 w-4" style={{ color: COLORS.danger }} />
          ) : (
            <Mic className="h-4 w-4" style={{ color: COLORS.live }} />
          )}
          {state === "listening" ? tr("Stop") : state === "idle" || failed ? tr("Test") : tr("Test again")}
        </button>
      </div>
      {(state === "listening" || state === "heard") && (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full"
          style={{ background: COLORS.border }}
          role="meter"
          aria-label={tr("Microphone level")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(level * 100)}%`,
              background: level > 0.85 ? COLORS.danger : COLORS.live,
              transition: "width 60ms linear",
            }}
          />
        </div>
      )}
    </div>
  );
};
