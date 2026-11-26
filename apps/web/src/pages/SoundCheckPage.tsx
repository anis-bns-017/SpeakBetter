// apps/web/src/pages/SoundCheckPage.tsx
/**
 * Sound check: record a few seconds with the same microphone settings voice rooms and calls use, listen back, and
 * get a plain verdict (clear, too quiet, distorting, noisy) with what to change. Also plays a test sound for the
 * speakers or headphones, and shows what the browser actually turned on (echo cancellation, noise reduction...).
 * Nothing leaves the device.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AudioLines, CheckCircle2, Headphones, Loader2, Mic, RotateCcw, Square, TriangleAlert, Volume2 } from "lucide-react";
import { PageHeader } from "../components/ui";
import { getMicrophone, microphoneErrorMessage, microphoneSupport, microphoneUnavailableMessage } from "../lib/microphone";
import { SPEECH_CONSTRAINTS } from "../lib/voiceAudio";
import { measureBlock, soundStats, soundVerdict, type SoundStats, type SoundVerdict } from "../lib/soundCheck";
import { tr } from "../i18n/core";

const RECORD_SECONDS = 6;
/** How often the level is measured while recording */
const SAMPLE_MS = 50;
const SENTENCE = "I usually practise English for ten minutes every morning, and I love talking with new people.";

const card = "rounded-3xl border border-line bg-surface shadow-sm";

type Phase = "idle" | "asking" | "recording" | "done" | "error";

interface Result {
  url: string | null;
  stats: SoundStats;
  verdict: SoundVerdict;
}

const audioContextClass = () =>
  (typeof window !== "undefined" &&
    (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) ||
  null;

const VERDICT: Record<SoundVerdict, { title: string; text: string; good: boolean }> = {
  good: {
    title: "Sounds clear",
    text: "Your voice is clear and the room is quiet. This is close to how others will hear you.",
    good: true,
  },
  "no-sound": {
    title: "We couldn't hear you",
    text: "Check that the right microphone is chosen and isn't muted, then speak during the recording.",
    good: false,
  },
  "too-quiet": {
    title: "Your voice is quiet",
    text: "Move the microphone closer, about a hand's width from your mouth, or speak a little louder.",
    good: false,
  },
  "too-loud": {
    title: "Your voice is distorting",
    text: "Move the microphone a little further away or speak a bit softer, so the sound doesn't crackle.",
    good: false,
  },
  noisy: {
    title: "Lots of background noise",
    text: "Find a quieter spot, close the window or turn off the fan. Headphones with a microphone help a lot.",
    good: false,
  },
};

/** What the browser says it turned on for this microphone */
const SettingChip: React.FC<{ label: string; value: boolean | undefined }> = ({ label, value }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
      value === true
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : value === false
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
    }`}
  >
    {tr(label)}: {value === true ? tr("on") : value === false ? tr("off") : tr("not reported")}
  </span>
);

/** A two-note chime, to check the speakers or headphones */
function playChime() {
  const Ctx = audioContextClass();
  if (!Ctx) return;
  const context = new Ctx();
  const start = context.currentTime + 0.05;
  [523.25, 659.25].forEach((frequency, i) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const at = start + i * 0.35;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    osc.connect(gain).connect(context.destination);
    osc.start(at);
    osc.stop(at + 0.65);
  });
  window.setTimeout(() => void context.close().catch(() => undefined), 1500);
}

export const SoundCheckPage: React.FC = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);
  const [result, setResult] = useState<Result | null>(null);
  const [settings, setSettings] = useState<MediaTrackSettings | null>(null);
  const [micName, setMicName] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");

  const live = useRef<{ stream: MediaStream; context: AudioContext | null; timer: number } | null>(null);
  const urlRef = useRef<string | null>(null);
  const mounted = useRef(true);

  const release = useCallback(() => {
    const current = live.current;
    if (!current) return;
    window.clearInterval(current.timer);
    current.stream.getTracks().forEach((t) => t.stop());
    void current.context?.close().catch(() => undefined);
    live.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      release();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [release]);

  const start = async () => {
    release();
    const support = microphoneSupport();
    if (support !== "ok") {
      setError(microphoneUnavailableMessage(support));
      setPhase("error");
      return;
    }
    setPhase("asking");
    setError("");

    let stream: MediaStream;
    try {
      stream = await getMicrophone({ ...SPEECH_CONSTRAINTS, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) });
    } catch (problem) {
      setError(microphoneErrorMessage(problem));
      setPhase("error");
      return;
    }
    // They left while the permission prompt was open: let go of the microphone
    if (!mounted.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const track = stream.getAudioTracks()[0];
    setMicName(track?.label ?? "");
    setSettings(track?.getSettings?.() ?? null);
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((list) => mounted.current && setDevices(list.filter((d) => d.kind === "audioinput" && d.deviceId)))
      .catch(() => undefined);

    const Ctx = audioContextClass();
    const context = Ctx ? new Ctx() : null;
    const analyser = context?.createAnalyser() ?? null;
    if (context && analyser) {
      // Some browsers start it paused until they are sure a person asked for sound; measuring needs it running
      void context.resume?.().catch(() => undefined);
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
    }
    const samples = new Float32Array(analyser?.fftSize ?? 0);
    const rms: number[] = [];
    const peaks: number[] = [];

    // The recording to listen back to (some old browsers can only measure, not record)
    const chunks: Blob[] = [];
    let recorder: MediaRecorder | null = null;
    if (typeof MediaRecorder !== "undefined") {
      try {
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.start();
      } catch {
        recorder = null;
      }
    }

    const startedAt = performance.now();
    setSecondsLeft(RECORD_SECONDS);
    setResult(null);
    setPhase("recording");

    const finish = async () => {
      window.clearInterval(timer);
      const url =
        recorder && recorder.state !== "inactive"
          ? await new Promise<string | null>((resolve) => {
              const r = recorder as MediaRecorder;
              r.onstop = () => resolve(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: r.mimeType || "audio/webm" })) : null);
              r.stop();
            })
          : null;
      release();
      if (!mounted.current) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      const stats = soundStats(rms, peaks);
      setResult({ url, stats, verdict: soundVerdict(stats) });
      setPhase("done");
    };

    const timer = window.setInterval(() => {
      if (analyser) {
        analyser.getFloatTimeDomainData(samples);
        const block = measureBlock(samples);
        rms.push(block.rms);
        peaks.push(block.peak);
        setLevel(Math.min(1, block.rms * 6));
      }
      const elapsed = (performance.now() - startedAt) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(RECORD_SECONDS - elapsed)));
      if (elapsed >= RECORD_SECONDS) void finish();
    }, SAMPLE_MS);
    live.current = { stream, context, timer };
  };

  /** Stops the recording without judging it, and lets go of the microphone */
  const cancel = () => {
    release();
    setPhase("idle");
  };

  const verdict = result ? VERDICT[result.verdict] : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <PageHeader
        icon={Headphones}
        tone="indigo"
        eyebrow={tr("Speak")}
        title={tr("Sound check")}
        subtitle={tr("Record a few seconds and hear yourself the way others hear you in rooms and calls. Nothing leaves your device.")}
      />

      <section className={`${card} p-6`}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Mic className="w-4 h-4 text-indigo-500" /> {tr("1. Your microphone")}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {tr("Stay quiet for a second, then read this out loud:")}
        </p>
        <p className="mt-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] px-4 py-3 text-base font-medium text-slate-900 dark:text-slate-100">“{SENTENCE}”</p>

        {devices.length > 1 && phase !== "recording" && (
          <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {tr("Microphone")}
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">{tr("Default microphone")}</option>
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || tr("Microphone {n}", { n: i + 1 })}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {phase === "recording" ? (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <Square className="w-4 h-4" /> {tr("Cancel")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              disabled={phase === "asking"}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {phase === "asking" ? <Loader2 className="w-4 h-4 animate-spin" /> : phase === "done" ? <RotateCcw className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {phase === "done" ? tr("Record again") : tr("Record {n} seconds", { n: RECORD_SECONDS })}
            </button>
          )}
          {phase === "recording" && (
            <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200" aria-live="polite">
              {tr("Recording… {n} s left", { n: secondsLeft })}
            </span>
          )}
          {phase === "asking" && <span className="text-sm text-slate-500">{tr("Waiting for permission...")}</span>}
        </div>

        {phase === "recording" && (
          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]"
            role="meter"
            aria-label={tr("Microphone level")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
          >
            <div
              className={`h-full rounded-full ${level > 0.9 ? "bg-rose-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.round(level * 100)}%`, transition: "width 60ms linear" }}
            />
          </div>
        )}

        {phase === "error" && (
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </p>
        )}
      </section>

      {result && verdict && (
        <section className={`${card} p-6 space-y-4`} aria-live="polite">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <AudioLines className="w-4 h-4 text-indigo-500" /> {tr("2. Listen back")}
          </h2>
          {result.url ? (
            <audio controls src={result.url} className="w-full h-10" />
          ) : (
            <p className="text-sm text-slate-500">{tr("This browser can't play the recording back, but the check below still works.")}</p>
          )}
          <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${verdict.good ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-amber-50 dark:bg-amber-500/10"}`}>
            {verdict.good ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{tr(verdict.title)}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{tr(verdict.text)}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] px-2 py-2">
              <dt className="text-[11px] text-slate-500">{tr("Voice level")}</dt>
              <dd className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{Math.round(result.stats.voiceDb)} dB</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] px-2 py-2">
              <dt className="text-[11px] text-slate-500">{tr("Background")}</dt>
              <dd className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{Math.round(result.stats.noiseDb)} dB</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] px-2 py-2">
              <dt className="text-[11px] text-slate-500">{tr("Clarity")}</dt>
              <dd className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{Math.max(0, Math.round(result.stats.clarityDb))} dB</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">{tr("Clarity is how far your voice stands out from the background. Above 15 dB is easy to understand; above 30 dB is excellent.")}</p>
        </section>
      )}

      {settings && (
        <section className={`${card} p-6`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{tr("What your browser turned on")}</h2>
          {micName && <p className="mt-1 text-xs text-slate-500 truncate">{micName}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <SettingChip label="Echo cancellation" value={settings.echoCancellation as boolean | undefined} />
            <SettingChip label="Noise reduction" value={settings.noiseSuppression as boolean | undefined} />
            <SettingChip label="Automatic volume" value={settings.autoGainControl as boolean | undefined} />
            {settings.sampleRate ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {tr("{n} kHz", { n: Math.round(settings.sampleRate / 100) / 10 })}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-500">{tr("Voice rooms and calls ask for the same settings. If one shows off, your device or browser doesn't offer it.")}</p>
        </section>
      )}

      <section className={`${card} p-6`}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-500" /> {tr("3. Your speakers or headphones")}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{tr("Play a short sound. If you can't hear it, turn the volume up or check which device is playing.")}</p>
        <button
          type="button"
          onClick={playChime}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
        >
          <Volume2 className="w-4 h-4" /> {tr("Play a test sound")}
        </button>
      </section>

      <section className={`${card} p-6`}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{tr("For the best sound")}</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
          <li>{tr("Wear headphones in voice rooms, so other people's voices don't come back through your microphone as echo.")}</li>
          <li>{tr("Hold your phone about a hand's width from your mouth, not right against it.")}</li>
          <li>{tr("To hear how you sound to others, join a room with a friend on another device, in a different room.")}</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/voice" className="inline-flex h-10 items-center rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">
            {tr("Voice Rooms")}
          </Link>
          <Link to="/call" className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]">
            {tr("Random call")}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default SoundCheckPage;
