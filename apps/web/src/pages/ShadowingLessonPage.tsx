// apps/web/src/pages/ShadowingLessonPage.tsx
/**
 * One shadowing lesson (or the daily mix). Four modes: Repeat (hear, then say), Build up (back-chaining: the
 * end of the line first, a chunk more each time), Speak along (talk at the same time as the voice) and Blind
 * (no text until you have tried). Each line shows stress, weak forms, linking and its tune; every try is
 * scored word by word and recorded so you can compare yourself with the model voice.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Keyboard,
  Layers,
  Lightbulb,
  Loader2,
  Mic,
  Play,
  Repeat2,
  RotateCcw,
  Shuffle,
  Square,
  Target,
  Trophy,
  Volume2,
} from "lucide-react";
import { canListen, useListenOnce, useRecorder, useSubmitAttempt, type AttemptResult } from "../hooks/usePronunciation";
import { useFinishShadowing, useShadowLesson, type LineToken, type ShadowLine, type ShadowResult, type Tune } from "../hooks/useShadowing";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { card, scoreTone, trackIcon } from "../components/shadowing/shadowingUi";
import { tr, msg } from "../i18n/core";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-fuchsia-600 hover:bg-fuchsia-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

type Mode = "repeat" | "buildup" | "along" | "blind";
const MODES: Array<{ id: Mode; label: string; icon: typeof Repeat2; hint: string }> = [
  { id: "repeat", label: msg("Repeat"), icon: Repeat2, hint: msg("Listen, then say it back the same way.") },
  { id: "buildup", label: msg("Build up"), icon: Layers, hint: msg("Start with the end of the line and add a chunk each time.") },
  { id: "along", label: msg("Speak along"), icon: Headphones, hint: msg("Speak at the same time as the voice. Headphones help.") },
  { id: "blind", label: msg("Blind"), icon: Target, hint: msg("Shadow by ear. The text appears after you try.") },
];
const SPEEDS = [
  { label: msg("Slow"), rate: 0.65 },
  { label: msg("Steady"), rate: 0.8 },
  { label: msg("Natural"), rate: 0.95 },
  { label: msg("Fast"), rate: 1.1 },
];

/** Small per-browser preferences; storage can be unavailable, so every access is guarded */
function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* not saved, still works */
      }
    },
    [key],
  );
  return [value, set];
}

const TUNES: Record<Tune, { icon: typeof ArrowUpRight; text: string }> = {
  rise: { icon: ArrowUpRight, text: msg("Voice goes up at the end") },
  fall: { icon: ArrowDownRight, text: msg("Voice goes down at the end") },
  tag: { icon: ArrowDownRight, text: msg("Tag: fall if you expect a yes, rise if you really ask") },
};

/** The line with its hints: stressed words bold, weak forms blue, links as ‿; words outside the step faded */
const AnnotatedLine: React.FC<{ tokens: LineToken[]; hints: boolean; fromWord?: number }> = ({ tokens, hints, fromWord = 0 }) => (
  <p className="text-xl sm:text-2xl leading-relaxed">
    {tokens.map((t, i) => {
      const faded = i < fromWord;
      const tone = faded
        ? "text-slate-300 dark:text-slate-600"
        : !hints
          ? "text-slate-900 dark:text-white font-semibold"
          : t.stress
            ? "text-slate-900 dark:text-white font-bold"
            : t.weak
              ? "text-sky-600 dark:text-sky-400 underline decoration-dotted underline-offset-[6px]"
              : "text-slate-500 dark:text-slate-400";
      return (
        <React.Fragment key={i}>
          <span className={tone} title={hints && t.weak && !faded ? tr("Weak form: sounds like \"{weak}\"", { weak: t.weak }) : undefined}>
            {tr(t.text)}
          </span>
          {i < tokens.length - 1 &&
            (hints && t.link && !faded && i + 1 >= fromWord ? (
              <span className="text-fuchsia-500 font-bold" aria-label={tr("linked")}>
                ‿
              </span>
            ) : (
              " "
            ))}
        </React.Fragment>
      );
    })}
  </p>
);

/** What you said, each word coloured by how well it came through */
const ScoredWords: React.FC<{ result: AttemptResult }> = ({ result }) => (
  <p className="text-lg leading-9">
    {result.words.map((w, i) => (
      <span key={i}>
        {i > 0 && " "}
        <span
          title={w.status === "good" ? tr("Clear") : w.heard ? tr("Heard \"{heard}\"", { heard: w.heard }) : tr("Not heard")}
          className={
            w.status === "good"
              ? "text-emerald-700 dark:text-emerald-400"
              : w.status === "close"
                ? "text-amber-600 dark:text-amber-400 underline decoration-dotted underline-offset-4"
                : "text-rose-600 dark:text-rose-400 underline decoration-wavy underline-offset-4"
          }
        >
          {tr(w.text)}
        </span>
      </span>
    ))}
  </p>
);

const pill = (active: boolean) =>
  `inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold border transition-colors ${
    active
      ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
      : "border-line bg-surface text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.08]"
  }`;

/** The page: a fresh player for each lesson and each new daily set, so nothing carries over */
export const ShadowingLessonPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [round, setRound] = useState(0);
  return <LessonPlayer key={`${lessonId}:${round}`} lessonId={lessonId} round={round} onNewSet={() => setRound((r) => r + 1)} />;
};

const LessonPlayer: React.FC<{ lessonId: string | undefined; round: number; onNewSet: () => void }> = ({ lessonId, round, onNewSet }) => {
  const daily = lessonId === "daily";
  const { data, isLoading, isError } = useShadowLesson(lessonId, round);
  const finishLesson = useFinishShadowing(lessonId ?? "");
  const submit = useSubmitAttempt();
  const { listening, interim, listen, stop: stopListening, error: listenError } = useListenOnce();
  const recorder = useRecorder();

  const [mode, setMode] = usePref<Mode>("shadowing.mode", "repeat");
  const [speed, setSpeed] = usePref<number>("shadowing.speed", 2);
  const [hints, setHints] = usePref<boolean>("shadowing.hints", true);
  const [autoplay, setAutoplay] = usePref<boolean>("shadowing.autoplay", true);

  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  /** Full-line scores per line, in order tried */
  const [history, setHistory] = useState<Record<string, number[]>>({});
  /** Lines marked as said without a microphone */
  const [practised, setPractised] = useState<Record<string, true>>({});
  const [finished, setFinished] = useState<ShadowResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const startedAt = useRef(new Date().toISOString());

  const lines = useMemo(() => data?.lines ?? [], [data]);
  const line: ShadowLine | undefined = lines[index];
  const steps = useMemo(() => line?.steps ?? [], [line]);
  const buildUp = mode === "buildup" && steps.length > 1;
  const target = line ? (buildUp ? steps[Math.min(step, steps.length - 1)] : line.text) : "";
  const fromWord = line && buildUp ? line.tokens.length - target.split(/\s+/).length : 0;
  const rate = SPEEDS[speed]?.rate ?? 0.95;
  const micOk = canListen();
  const hideText = mode === "blind" && !revealed && !result;

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (listenError) toast.error(listenError);
  }, [listenError]);

  const playModel = useCallback(async () => {
    if (!target) return;
    setPlaying(true);
    await speak(target, { rate });
    setPlaying(false);
  }, [target, rate]);

  // Each new line (or chunk) plays once by itself, except when speaking along
  useEffect(() => {
    if (line && autoplay && mode !== "along" && !finished) void speak(target, { rate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.id, step, mode]);

  /** Clears the last try when moving to another line, chunk or mode */
  const resetLine = () => {
    setResult(null);
    setRevealed(false);
    recorder.clear();
  };

  const sayIt = useCallback(async () => {
    if (!line || submit.isPending) return;
    if (listening) {
      stopListening();
      return;
    }
    if (mode !== "along") stopSpeaking();
    const recording = recorder.start();
    const started = performance.now();
    const heardPromise = listen();
    if (mode === "along") {
      // Give the microphone a moment, then start the voice so you can speak with it
      await recording;
      setPlaying(true);
      void speak(target, { rate }).then(() => setPlaying(false));
    }
    const heard = await heardPromise;
    const rec = await recorder.stop();
    if (rec && rec.peak < 0.04) toast.message(tr("Your microphone sounds very quiet. Move closer or check the input level."));
    if (!heard) return;
    try {
      const r = await submit.mutateAsync({
        target,
        heard: heard.alternatives,
        confidence: heard.confidence ?? undefined,
        source: "sentence",
        durationMs: heard.durationMs ?? Math.round(performance.now() - started),
      });
      setResult(r);
      setRevealed(true);
      if (target === line.text) setHistory((h) => ({ ...h, [line.id]: [...(h[line.id] ?? []), r.score] }));
    } catch {
      toast.error(tr("Couldn't score that. Try again."));
    }
  }, [line, submit, listening, stopListening, mode, recorder, listen, target, rate]);

  const playMine = () => {
    if (!recorder.url) return;
    stopSpeaking();
    void new Audio(recorder.url).play().catch(() => toast.error(tr("Couldn't play your recording.")));
  };
  const compare = async () => {
    if (!recorder.url) return;
    await playModel();
    await new Promise((r) => setTimeout(r, 300));
    playMine();
  };

  const goTo = (i: number) => {
    stopSpeaking();
    if (listening) stopListening();
    const to = Math.max(0, Math.min(lines.length - 1, i));
    if (to === index) return;
    resetLine();
    setStep(0);
    setIndex(to);
  };
  const nextChunk = () => {
    resetLine();
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const pickMode = (m: Mode) => {
    if (m === mode) return;
    resetLine();
    setStep(0);
    setMode(m);
  };

  const finish = async () => {
    stopSpeaking();
    if (daily || !lessonId) {
      // The daily mix is not saved as a lesson; the summary comes from this session
      const rows = lines.map((l) => {
        const tries = history[l.id] ?? [];
        const best = tries.length ? Math.max(...tries) : null;
        return { id: l.id, text: l.text, score: best, best };
      });
      const said = rows.map((r) => r.score).filter((s): s is number => s !== null);
      setFinished({
        firstTime: false,
        xp: 0,
        spoken: said.length,
        total: lines.length,
        average: said.length ? Math.round(said.reduce((a, b) => a + b, 0) / said.length) : null,
        best: null,
        lines: rows,
        weakWords: [],
      });
      return;
    }
    try {
      setFinished(await finishLesson.mutateAsync(startedAt.current));
    } catch {
      toast.error(tr("Couldn't save the lesson. Try again."));
    }
  };

  const restart = () => {
    resetLine();
    setFinished(null);
    setIndex(0);
    setStep(0);
    setHistory({});
    setPractised({});
    startedAt.current = new Date().toISOString();
  };

  // Keyboard: Space to speak, L to listen, arrows to move between lines
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (finished || !line || (el && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space" && micOk) {
        e.preventDefault();
        void sayIt();
      } else if (e.key.toLowerCase() === "l") void playModel();
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data || !line) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500 space-y-3`}>
        <p>{tr("Couldn't load this lesson.")}</p>
        <Link to="/shadowing" className="text-fuchsia-600 font-semibold">{tr("Back to shadowing")}</Link>
      </div>
    );
  }

  const tuneInfo = TUNES[line.tune];
  const best = (id: string) => {
    const tries = history[id];
    if (tries?.length) return Math.max(...tries);
    return data.progress?.lineScores[id] ?? null;
  };
  const triesHere = history[line.id] ?? [];
  const last = index === lines.length - 1;
  const doneLines = lines.filter((l) => history[l.id]?.length || practised[l.id]).length;

  // ------------------------------------------------------------------ finished
  if (finished) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
        <section className={`${card} p-6 text-center`}>
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
            <Trophy className="w-8 h-8" />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{tr(data.title)}</p>
          <h2 className={`mt-1 text-4xl font-bold tabular-nums ${finished.average !== null ? scoreTone(finished.average) : "text-slate-900 dark:text-white"}`}>
            {finished.average ?? "-"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {finished.spoken
              ? tr("Average over {spoken} of {total} lines said aloud", { spoken: finished.spoken, total: finished.total })
              : tr("No lines were scored this time. Say them aloud to get a score.")}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            {finished.xp > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">+{finished.xp} XP</span>}
            {finished.best !== null && <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">{tr("Best ever:")}{" "}{finished.best}</span>}
          </div>
        </section>

        <section className={`${card} p-5`}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{tr("Line by line")}</h3>
          <ul className="space-y-2.5">
            {finished.lines.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
                <button type="button" onClick={() => void speak(l.text, { rate })} className="text-left text-slate-700 dark:text-slate-200 hover:text-fuchsia-600 inline-flex gap-2">
                  <Volume2 className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  {tr(l.text)}
                </button>
                <span className="shrink-0 text-right tabular-nums">
                  <span className={`font-bold ${l.score !== null ? scoreTone(l.score) : "text-slate-300"}`}>{l.score ?? "-"}</span>
                  {l.best !== null && l.best !== l.score && <span className="block text-[11px] text-slate-400">{tr("best")}{" "}{l.best}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {finished.weakWords.length > 0 && (
          <section className={`${card} p-5`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Words to work on")}</h3>
            <p className="text-xs text-slate-500">{tr("These did not come through clearly. Tap one to hear it.")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {finished.weakWords.map((w) => (
                <button key={w} type="button" onClick={() => void speak(w, { rate: 0.8 })} className={pill(false)}>
                  <Volume2 className="w-3.5 h-3.5" /> {w}
                </button>
              ))}
            </div>
            <Link to="/pronunciation" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400">
              {tr("Practise sounds")}{" "}<ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={restart}>
              <RotateCcw className="w-4 h-4" /> {" "}{tr("Practise again")}</button>
            {daily && (
              <button type="button" className={ghostBtn} onClick={onNewSet}>
                <Shuffle className="w-4 h-4" /> {" "}{tr("New set")}</button>
            )}
          </div>
          {data.next ? (
            <Link to={`/shadowing/${data.next.id}`} className={primaryBtn}>
              {tr("Next:")}{" "}{tr(data.next.title)} <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link to="/shadowing" className={primaryBtn}>
              {tr("Back to course")}{" "}<ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ practising
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-4">
      <Link to="/shadowing" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-3.5 h-3.5" /> {" "}{tr("Shadowing")}</Link>

      <header className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 flex items-center justify-center shrink-0">
          {daily ? <Shuffle className="w-6 h-6" /> : React.createElement(trackIcon(data.track?.icon), { className: "w-6 h-6" })}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">
            {data.level} · {tr(data.track?.label) ?? tr("Daily mix")}
          </p>
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">{tr(data.title)}</h1>
          <p className="text-sm text-slate-500">{data.focus}</p>
        </div>
        {data.progress?.bestScore != null && (
          <span className={`text-xs font-semibold tabular-nums shrink-0 ${scoreTone(data.progress.bestScore)}`}>{tr("Best")}{" "}{data.progress.bestScore}</span>
        )}
      </header>

      <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/[0.07] border border-amber-200/70 dark:border-amber-500/20 p-3.5 flex gap-2.5 text-sm text-amber-900 dark:text-amber-200">
        <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
        <p>{tr(data.tip)}</p>
      </div>

      {!canSpeak() && (
        <div className={`${card} p-4 text-sm text-amber-700 dark:text-amber-400`}>
          {tr("This browser can't read lines aloud. Use Chrome or Edge for shadowing.")}</div>
      )}
      {!micOk && (
        <div className={`${card} p-4 text-sm text-slate-600 dark:text-slate-300`}>
          {tr("This browser can't listen to you, so lines won't be scored. You can still listen, shadow out loud and mark each line as said.")}</div>
      )}

      {/* Settings */}
      <section className={`${card} p-4 space-y-3`}>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr("Practice mode")}>
          {MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => pickMode(m.id)} className={pill(mode === m.id)}>
              <m.icon className="w-3.5 h-3.5" /> {tr(m.label)}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{tr(MODES.find((m) => m.id === mode)?.hint)}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1" role="radiogroup" aria-label={tr("Speed")}>
            {SPEEDS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                role="radio"
                aria-checked={speed === i}
                onClick={() => setSpeed(i)}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  speed === i ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                }`}
              >
                {tr(s.label)}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} className="accent-fuchsia-600" /> {" "}{tr("Stress and linking hints")}</label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} className="accent-fuchsia-600" /> {" "}{tr("Play each line automatically")}</label>
        </div>
      </section>

      {/* Line navigator */}
      <nav className="flex items-center gap-1.5 flex-wrap" aria-label={tr("Lines")}>
        {lines.map((l, i) => {
          const b = best(l.id);
          const said = b !== null || practised[l.id];
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === index ? "step" : undefined}
              title={b !== null ? tr("Best {b}", { b }) : said ? tr("Said") : tr("Not tried yet")}
              className={`w-9 h-9 rounded-full text-xs font-bold tabular-nums border transition-colors ${
                i === index
                  ? "border-fuchsia-500 bg-fuchsia-600 text-white"
                  : said
                    ? `border-transparent bg-slate-100 dark:bg-white/[0.06] ${b !== null ? scoreTone(b) : "text-slate-600"}`
                    : "border-slate-200 dark:border-white/10 text-slate-400"
              }`}
            >
              {b !== null && i !== index ? b : i + 1}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-slate-400 tabular-nums">{doneLines}{tr("/{length} said", { length: lines.length })}</span>
      </nav>

      {/* The line */}
      <section className={`${card} p-5 sm:p-6 space-y-5`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
            {React.createElement(tuneInfo.icon, { className: "w-3.5 h-3.5" })} {tr(tuneInfo.text)}
          </span>
          {buildUp && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 font-semibold">
              <Layers className="w-3.5 h-3.5" /> {" "}{tr("Chunk {value} of", { value: step + 1 })}{" "}{steps.length}
            </span>
          )}
        </div>

        {hideText ? (
          <div className="py-4 text-center space-y-3">
            <p className="text-slate-400 text-sm">{tr("Text hidden. Listen and shadow by ear.")}</p>
            <button type="button" className={pill(false)} onClick={() => setRevealed(true)}>
              <Eye className="w-3.5 h-3.5" /> {" "}{tr("Show text")}</button>
          </div>
        ) : (
          <AnnotatedLine tokens={line.tokens} hints={hints} fromWord={fromWord} />
        )}

        {listening && (
          <p className="text-sm text-fuchsia-600 dark:text-fuchsia-400 min-h-6" aria-live="polite">
            {interim || tr("Listening...")}
          </p>
        )}

        {result && (
          <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-4 space-y-2" role="status">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold tabular-nums ${scoreTone(result.score)}`}>{result.score}</span>
              <span className="text-xs text-slate-500">{result.verdict === "great" ? tr("Great match!") : result.verdict === "good" ? tr("Good, keep polishing") : tr("Try once more")}</span>
            </div>
            <ScoredWords result={result} />
            {result.pace && <p className="text-xs text-slate-500">{tr("Pace: {wordsPerMinute} words a minute, {verdict}.", { wordsPerMinute: result.pace.wordsPerMinute, verdict: result.pace.verdict })}{" "}{tr(result.pace.tip)}</p>}
            {result.issues[0] && <p className="text-xs text-slate-500">{tr("Tip:")}{" "}{tr(result.issues[0].tip)}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void playModel()} className={ghostBtn} disabled={listening || playing}>
            <Play className="w-4 h-4" /> {" "}{tr("Listen")}</button>
          {micOk ? (
            <button
              type="button"
              onClick={() => void sayIt()}
              disabled={submit.isPending}
              className={`inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-semibold text-white transition-colors ${
                listening ? "bg-rose-600 hover:bg-rose-700 animate-pulse" : "bg-fuchsia-600 hover:bg-fuchsia-700"
              }`}
            >
              {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {listening ? tr("Stop") : mode === "along" ? tr("Play and speak") : result ? tr("Try again") : tr("Say it")}
            </button>
          ) : (
            <button type="button" className={ghostBtn} onClick={() => setPractised((p) => ({ ...p, [line.id]: true }))} disabled={!!practised[line.id]}>
              <CheckCircle2 className="w-4 h-4" /> {practised[line.id] ? tr("Marked as said") : tr("I said it")}
            </button>
          )}
          {recorder.url && (
            <>
              <button type="button" className={ghostBtn} onClick={playMine}>
                <Volume2 className="w-4 h-4" /> {" "}{tr("Me")}</button>
              <button type="button" className={ghostBtn} onClick={() => void compare()} disabled={playing}>
                <Headphones className="w-4 h-4" /> {" "}{tr("Model, then me")}</button>
            </>
          )}
          {mode === "blind" && revealed && !result && (
            <button type="button" className={pill(false)} onClick={() => setRevealed(false)}>
              <EyeOff className="w-3.5 h-3.5" /> {" "}{tr("Hide")}</button>
          )}
        </div>

        {listening && <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden"><div className="h-full bg-fuchsia-500 transition-[width]" style={{ width: `${Math.round(recorder.level * 100)}%` }} /></div>}

        {triesHere.length > 0 && (
          <p className="text-xs text-slate-500">
            {tr("Tries on this line:")}{" "}
            {triesHere.map((s, i) => (
              <span key={i} className={`font-semibold tabular-nums ${scoreTone(s)}`}>
                {i > 0 && " → "}
                {s}
              </span>
            ))}
          </p>
        )}
      </section>

      {/* Moving on */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={ghostBtn} onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ArrowLeft className="w-4 h-4" /> {" "}{tr("Back")}</button>
        <div className="flex flex-wrap gap-2">
          {buildUp && step < steps.length - 1 && (
            <button type="button" className={ghostBtn} onClick={nextChunk}>
              <Layers className="w-4 h-4" /> {" "}{tr("Add a chunk")}</button>
          )}
          {last ? (
            <button type="button" className={primaryBtn} onClick={() => void finish()} disabled={finishLesson.isPending}>
              {finishLesson.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />} {" "}{tr("Finish lesson")}</button>
          ) : (
            <button type="button" className={primaryBtn} onClick={() => goTo(index + 1)}>
              {tr("Next line")}{" "}<ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
        <Keyboard className="w-3.5 h-3.5" /> {" "}{tr("Space to speak · L to listen · ← → to move between lines")}{!last && (
          <>
            {" · "}
            <button type="button" className="underline hover:text-slate-600" onClick={() => void finish()}>
              {tr("finish early")}</button>
          </>
        )}
      </p>
    </div>
  );
};

export default ShadowingLessonPage;
