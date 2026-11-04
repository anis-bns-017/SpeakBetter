// apps/web/src/pages/LibraryReaderPage.tsx
/**
 * Reading one text: listen to it read aloud with the sentence highlighted, tap any word to see what it means,
 * repeat a sentence after the voice for a pronunciation score, then answer a few questions about it.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mic, Pause, Play, RotateCcw, Square, Turtle, Volume2, XCircle } from "lucide-react";
import { useAnswerLibrary, useLibraryText, type QuizResult } from "../hooks/useLibrary";
import { canListen, useListenOnce, useSubmitAttempt } from "../hooks/usePronunciation";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { WordLookup, type WordSelection } from "../components/chat/WordLookup";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

const scoreTone = (score: number) =>
  score >= 90 ? "text-emerald-600 dark:text-emerald-400" : score >= 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

/** The word under a tap, without the punctuation around it */
const cleanWord = (token: string) => token.replace(/[‘’]/g, "'").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");

export const LibraryReaderPage: React.FC = () => {
  const { textId } = useParams<{ textId: string }>();
  const { data: text, isLoading, isError } = useLibraryText(textId);
  const check = useAnswerLibrary(textId ?? "");
  const submitAttempt = useSubmitAttempt();
  const { listening, listen, stop: stopListening, error: listenError } = useListenOnce();

  const [playing, setPlaying] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  const [lookup, setLookup] = useState<WordSelection | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [shadowing, setShadowing] = useState<number | null>(null);
  const [shadowScores, setShadowScores] = useState<Record<number, number>>({});
  const playToken = useRef(0);

  // Stop the voice when leaving the page
  useEffect(() => () => stopSpeaking(), []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !text) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>
        Couldn't load this text. <Link to="/library" className="text-indigo-600 underline">Back to the library</Link>
      </div>
    );
  }

  const rate = slow ? 0.7 : 0.95;

  const playFrom = async (start: number, once = false) => {
    const token = ++playToken.current;
    stopSpeaking();
    for (let i = start; i < text.sentences.length; i++) {
      if (playToken.current !== token) return;
      setPlaying(i);
      document.getElementById(`s-${i}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      await speak(text.sentences[i].text, { rate });
      if (once) break;
    }
    if (playToken.current === token) setPlaying(null);
  };

  const stopPlaying = () => {
    playToken.current++;
    stopSpeaking();
    setPlaying(null);
  };

  const shadow = async (i: number) => {
    if (listening) {
      stopListening();
      return;
    }
    stopPlaying();
    setShadowing(i);
    const started = performance.now();
    const heard = await listen();
    if (!heard) {
      setShadowing(null);
      return;
    }
    try {
      const r = await submitAttempt.mutateAsync({
        target: text.sentences[i].text,
        heard: heard.alternatives,
        confidence: heard.confidence ?? undefined,
        source: "sentence",
        durationMs: heard.durationMs ?? Math.round(performance.now() - started),
      });
      setShadowScores((s) => ({ ...s, [i]: r.score }));
    } catch {
      toast.error("Couldn't score that. Try again.");
    } finally {
      setShadowing(null);
    }
  };

  const showSentence = (i: number) => {
    document.getElementById(`s-${i}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(i);
    window.setTimeout(() => setFlash((f) => (f === i ? null : f)), 2500);
  };

  const submitAnswers = async () => {
    try {
      const r = await check.mutateAsync(answers);
      setResult(r);
      if (r.firstCompletion) toast.success(`Finished! +${r.xp} XP`);
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Couldn't check your answers");
    }
  };

  const allAnswered = text.questions.every((q) => answers[q.id] !== undefined);
  const isDialogue = text.kind === "dialogue";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <Link to="/library" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" /> Library
      </Link>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {text.level} · {text.kind} · {text.minutes} min
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{text.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{text.summary}</p>
      </header>

      {/* ---------- listening controls ---------- */}
      <div className={`${card} p-3 flex flex-wrap items-center gap-2 sticky top-2 z-10`}>
        {canSpeak() ? (
          <>
            {playing === null ? (
              <button type="button" onClick={() => void playFrom(0)} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5">
                <Play className="w-4 h-4" /> Listen to it all
              </button>
            ) : (
              <button type="button" onClick={stopPlaying} className="h-10 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold inline-flex items-center gap-1.5">
                <Pause className="w-4 h-4" /> Stop
              </button>
            )}
            <button
              type="button"
              onClick={() => setSlow((v) => !v)}
              aria-pressed={slow}
              className={`h-10 px-3 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 border ${
                slow ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Turtle className="w-4 h-4" /> Slower
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-500">Your browser can't read aloud, but you can still read and answer.</p>
        )}
        <p className="text-xs text-slate-400 ml-auto">Tap any word to see what it means</p>
      </div>

      {/* ---------- the text ---------- */}
      <article className={`${card} p-4 sm:p-6 space-y-1`}>
        {text.sentences.map((sentence, i) => {
          const active = playing === i;
          const score = shadowScores[i];
          return (
            <div
              key={i}
              id={`s-${i}`}
              className={`group flex items-start gap-2 rounded-2xl px-2 py-1.5 transition-colors ${
                active ? "bg-indigo-50 dark:bg-indigo-500/10" : flash === i ? "bg-amber-50 dark:bg-amber-500/10" : ""
              }`}
            >
              <div className="min-w-0 flex-1 text-[16px] leading-relaxed text-slate-800 dark:text-slate-100">
                {isDialogue && sentence.speaker && <span className="mr-1.5 text-xs font-bold uppercase tracking-wide text-indigo-500">{sentence.speaker}</span>}
                {sentence.text.split(/\s+/).map((token, w) => {
                  const word = cleanWord(token);
                  return (
                    <React.Fragment key={w}>
                      <button
                        type="button"
                        disabled={!word}
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setLookup({ text: word, context: sentence.text, rect: { top: rect.top, left: rect.left, bottom: rect.bottom, width: rect.width } });
                        }}
                        className="rounded px-[1px] hover:bg-indigo-100/70 dark:hover:bg-indigo-500/20 cursor-pointer"
                      >
                        {token}
                      </button>{" "}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                {score !== undefined && <span className={`text-xs font-bold tabular-nums mr-1 ${scoreTone(score)}`} title="Your pronunciation score">{score}</span>}
                {canSpeak() && (
                  <button type="button" onClick={() => void playFrom(i, true)} aria-label="Listen to this sentence" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5">
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
                {canListen() && (
                  <button
                    type="button"
                    onClick={() => void shadow(i)}
                    disabled={submitAttempt.isPending && shadowing !== i}
                    aria-label={shadowing === i && listening ? "Stop" : "Say this sentence"}
                    title="Repeat it after the voice and get a score"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      shadowing === i ? "bg-rose-500 text-white" : "text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-white/5"
                    }`}
                  >
                    {shadowing === i && submitAttempt.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : shadowing === i ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {listenError && <p className="px-2 pt-2 text-xs text-rose-600">{listenError}</p>}
      </article>

      {/* ---------- questions ---------- */}
      <section className={`${card} p-5 space-y-5`}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Did you understand?</h2>
          {text.progress?.done && !result && (
            <span className="text-xs text-slate-500">
              Best so far: {text.progress.bestScore}/{text.progress.total}
            </span>
          )}
        </div>

        {text.questions.map((q, qi) => {
          const r = result?.results.find((x) => x.id === q.id);
          return (
            <fieldset key={q.id} className="space-y-2">
              <legend className="text-sm font-semibold text-slate-900 dark:text-white">
                {qi + 1}. {q.question}
              </legend>
              <div className="grid gap-1.5">
                {q.options.map((option, oi) => {
                  const picked = answers[q.id] === oi;
                  const isRight = r ? r.correctIndex === oi : false;
                  const isWrongPick = r ? picked && !r.correct : false;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={!!result}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      aria-pressed={picked}
                      className={`text-left text-sm rounded-xl border px-3.5 py-2.5 transition-colors flex items-center gap-2 ${
                        isRight
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
                          : isWrongPick
                            ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100"
                            : picked
                              ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-100"
                              : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      {isRight ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : isWrongPick ? <XCircle className="w-4 h-4 shrink-0" /> : null}
                      {option}
                    </button>
                  );
                })}
              </div>
              {r && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {r.explanation}{" "}
                  <button type="button" onClick={() => showSentence(r.sentence)} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                    Show in the text
                  </button>
                </p>
              )}
            </fieldset>
          );
        })}

        {result ? (
          <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] p-4 flex flex-wrap items-center gap-3">
            <p className={`text-3xl font-bold tabular-nums ${result.score === result.total ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
              {result.score}/{result.total}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 flex-1 min-w-[10rem]">
              {result.score === result.total ? "Perfect! You understood everything." : "Nice work. Check the highlighted answers above."}
            </p>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Try again
            </button>
            {text.next && (
              <Link to={`/library/${text.next.id}`} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5">
                Next: {text.next.title} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void submitAnswers()}
            disabled={!allAnswered || check.isPending}
            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {check.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Check my answers
          </button>
        )}
      </section>

      <AnimatePresence>
        {lookup && <WordLookup key={`${lookup.text}-${lookup.rect.top}`} selection={lookup} onClose={() => setLookup(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default LibraryReaderPage;
