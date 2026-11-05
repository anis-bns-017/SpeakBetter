// apps/web/src/pages/ShadowingPage.tsx
/**
 * Shadowing: hear a sentence, then say it back straight away, copying the rhythm and sounds. Each try is
 * scored word by word by the pronunciation checker, so it counts toward your plan and badges like any
 * pronunciation practice.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Loader2, Mic, Play, Repeat2, RotateCcw, Square, Trophy, Turtle } from "lucide-react";
import { apiClient } from "../lib/api/client";
import { canListen, useListenOnce, useSubmitAttempt, type AttemptResult } from "../hooks/usePronunciation";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors disabled:opacity-50";

interface ShadowSet {
  level: string;
  round: number;
  items: Array<{ id: string; text: string }>;
}

const useShadowSet = (round: number) =>
  useQuery({
    queryKey: ["shadowing", round],
    queryFn: async () => (await apiClient.get<ShadowSet>("/dictation/shadowing", { params: { round } })).data,
    staleTime: Infinity,
  });

const scoreTone = (score: number) =>
  score >= 90 ? "text-emerald-600 dark:text-emerald-400" : score >= 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

/** The sentence, each word coloured by how well it came through */
const ScoredWords: React.FC<{ result: AttemptResult }> = ({ result }) => (
  <p className="text-lg leading-9">
    {result.words.map((w, i) => (
      <span key={i}>
        {i > 0 && " "}
        <span
          title={w.status === "good" ? "Clear" : w.heard ? `Heard "${w.heard}"` : "Not heard"}
          className={
            w.status === "good"
              ? "text-emerald-700 dark:text-emerald-400"
              : w.status === "close"
                ? "text-amber-600 dark:text-amber-400 underline decoration-dotted underline-offset-4"
                : "text-rose-600 dark:text-rose-400 underline decoration-wavy underline-offset-4"
          }
        >
          {w.text}
        </span>
      </span>
    ))}
  </p>
);

type Step = "intro" | "running" | "done";

export const ShadowingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [round, setRound] = useState(0);
  const { data, isLoading, isError } = useShadowSet(round);
  const submit = useSubmitAttempt();
  const { listening, listen, stop: stopListening, error: listenError } = useListenOnce();

  const [step, setStep] = useState<Step>("intro");
  const [index, setIndex] = useState(0);
  const [slow, setSlow] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  /** Best score per sentence in this set */
  const [best, setBest] = useState<Record<string, number>>({});

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (listenError) toast.error(listenError);
  }, [listenError]);

  const item = data?.items[index];

  // Each new sentence plays once by itself
  useEffect(() => {
    if (step === "running" && item) {
      setResult(null);
      void speak(item.text, { rate: slow ? 0.7 : 0.92 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, item?.id]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>Couldn't load sentences. Refresh to try again.</div>;
  }

  const supported = canSpeak() && canListen();
  const total = data.items.length;
  const scores = Object.values(best);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const sayIt = async () => {
    if (!item) return;
    if (listening) {
      stopListening();
      return;
    }
    stopSpeaking();
    const started = performance.now();
    const heard = await listen();
    if (!heard) return;
    try {
      const r = await submit.mutateAsync({
        target: item.text,
        heard: heard.alternatives,
        confidence: heard.confidence ?? undefined,
        source: "sentence",
        durationMs: heard.durationMs ?? Math.round(performance.now() - started),
      });
      setResult(r);
      setBest((b) => ({ ...b, [item.id]: Math.max(b[item.id] ?? 0, r.score) }));
    } catch {
      toast.error("Couldn't score that. Try again.");
    }
  };

  const next = () => {
    stopSpeaking();
    if (index < total - 1) setIndex(index + 1);
    else setStep("done");
  };

  const newSet = () => {
    queryClient.removeQueries({ queryKey: ["shadowing", round] });
    setRound((r) => r + 1);
    setBest({});
    setIndex(0);
    setResult(null);
    setStep("running");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 flex items-center justify-center shrink-0">
          <Repeat2 className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Shadowing</h1>
          <p className="text-sm text-slate-500">Listen to a sentence, then say it back the same way.</p>
        </div>
        <span className="text-xs text-slate-500 shrink-0">{data.level}</span>
      </header>

      {!supported && (
        <div className={`${card} p-4 text-sm text-amber-700 dark:text-amber-400`}>
          Shadowing needs a browser that can speak and listen, such as Chrome or Edge, and a microphone.
        </div>
      )}

      {step === "intro" && (
        <section className={`${card} p-6 text-center space-y-4`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{total} sentences at your level</h2>
          <ol className="text-sm text-slate-500 max-w-sm mx-auto text-left list-decimal pl-5 space-y-1">
            <li>Listen. Play it again or slower as often as you like.</li>
            <li>Tap the mic and say it back, copying the rhythm.</li>
            <li>See which words came through clearly, and try again.</li>
          </ol>
          <button type="button" className={primaryBtn} onClick={() => setStep("running")} disabled={!supported}>
            <Play className="w-4 h-4" /> Start
          </button>
        </section>
      )}

      {step === "running" && item && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index}>
              <div className="h-full rounded-full bg-fuchsia-500 transition-all" style={{ width: `${(index / total) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{index + 1}/{total}</span>
          </div>

          <section className={`${card} p-5 sm:p-6 space-y-5`}>
            {result ? (
              <div className="space-y-2" role="status">
                <p className={`text-3xl font-bold tabular-nums ${scoreTone(result.score)}`}>{result.score}</p>
                <ScoredWords result={result} />
                {result.pace && <p className="text-xs text-slate-500">Pace: {result.pace.verdict} · {result.pace.tip}</p>}
                {result.issues[0] && <p className="text-xs text-slate-500">Tip: {result.issues[0].tip}</p>}
              </div>
            ) : (
              <p className="text-xl font-semibold leading-relaxed text-slate-900 dark:text-white">{item.text}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void speak(item.text, { rate: slow ? 0.7 : 0.92 })} className={ghostBtn} disabled={listening}>
                <Play className="w-4 h-4" /> Listen
              </button>
              <button
                type="button"
                onClick={() => setSlow((s) => !s)}
                aria-pressed={slow}
                className={`inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-sm font-semibold border transition-colors ${
                  slow ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                }`}
              >
                <Turtle className="w-4 h-4" /> Slower
              </button>
              <button
                type="button"
                onClick={() => void sayIt()}
                disabled={submit.isPending}
                className={`inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-semibold text-white transition-colors ${
                  listening ? "bg-rose-600 hover:bg-rose-700 animate-pulse" : "bg-fuchsia-600 hover:bg-fuchsia-700"
                }`}
              >
                {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {listening ? "Stop" : result ? "Try again" : "Say it"}
              </button>
            </div>
          </section>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">{best[item.id] !== undefined ? `Best: ${best[item.id]}` : "Say it at least once, or skip"}</span>
            <button type="button" className={primaryBtn} onClick={next}>
              {index < total - 1 ? "Next sentence" : "Finish"} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <section className={`${card} p-6 text-center`}>
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className={`mt-3 text-3xl font-bold tabular-nums ${scores.length ? scoreTone(average) : "text-slate-900 dark:text-white"}`}>{scores.length ? average : "-"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {scores.length ? `Average best score over ${scores.length} of ${total} sentences` : "You skipped every sentence. Give it a go next time!"}
            </p>
          </section>
          {scores.length > 0 && (
            <section className={`${card} p-5`}>
              <ul className="space-y-2">
                {data.items.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{s.text}</span>
                    <span className={`font-bold tabular-nums shrink-0 ${best[s.id] !== undefined ? scoreTone(best[s.id]) : "text-slate-300"}`}>{best[s.id] ?? "-"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={ghostBtn} onClick={newSet}>
              <RotateCcw className="w-4 h-4" /> New set
            </button>
            <Link to="/pronunciation" className={ghostBtn}>
              Practise single sounds <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default ShadowingPage;
