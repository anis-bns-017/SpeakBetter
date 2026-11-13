// apps/web/src/pages/DictationPage.tsx
/**
 * Listening dictation: six sentences at your level are read aloud; you type what you hear and see, word by
 * word, what you got right, misspelled, missed or added. Sentences you miss come back as flashcards.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Headphones, Layers, Loader2, Play, RotateCcw, Trophy, Turtle, Zap } from "lucide-react";
import {
  useCheckDictation,
  useDictationSession,
  useFinishDictation,
  type DictationCheck,
  type DictationResult,
  type DictationToken,
} from "../hooks/useDictation";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { ChallengeFriendButton } from "../components/challenges/ChallengeFriendButton";
import { ChallengeOutcomes } from "../components/challenges/ChallengeOutcomes";
import { tr } from "../i18n/core";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors disabled:opacity-50";

const errorMessage = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** One sentence, marked word by word */
export const MarkedSentence: React.FC<{ tokens: DictationToken[] }> = ({ tokens }) => (
  <p className="text-base leading-8 text-slate-800 dark:text-slate-100" aria-label={tr("Your answer, marked")}>
    {tokens.map((t, i) => {
      const gap = i > 0 ? " " : "";
      switch (t.kind) {
        case "ok":
          return <span key={i}>{gap}<span className="text-emerald-700 dark:text-emerald-400">{t.word}</span></span>;
        case "spelling":
          return (
            <span key={i}>
              {gap}
              <span className="rounded bg-amber-50 dark:bg-amber-500/10 px-1" title={tr("You wrote \"{typed}\"", { typed: t.typed })}>
                <span className="line-through decoration-amber-500/70 text-amber-700 dark:text-amber-400">{t.typed}</span>{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{t.word}</span>
              </span>
            </span>
          );
        case "wrong":
          return (
            <span key={i}>
              {gap}
              <span className="rounded bg-rose-50 dark:bg-rose-500/10 px-1" title={tr("You wrote \"{typed}\"", { typed: t.typed })}>
                <span className="line-through decoration-rose-500/70 text-rose-600 dark:text-rose-400">{t.typed}</span>{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{t.word}</span>
              </span>
            </span>
          );
        case "missing":
          return (
            <span key={i}>
              {gap}
              <span className="font-semibold text-sky-700 dark:text-sky-300 underline decoration-dashed underline-offset-4" title={tr("You missed this word")}>
                {t.word}
              </span>
            </span>
          );
        case "extra":
          return (
            <span key={i}>
              {gap}
              <span className="line-through decoration-rose-500/70 text-rose-500/80" title={tr("Not in the sentence")}>{t.word}</span>
            </span>
          );
      }
    })}
  </p>
);

const Legend: React.FC = () => (
  <p className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
    <span><span className="text-emerald-600">{tr("green")}</span> {" "}{tr("right")}</span>
    <span><span className="text-amber-600">{tr("amber")}</span> {" "}{tr("spelling")}</span>
    <span><span className="text-rose-600">{tr("red")}</span> {" "}{tr("wrong or extra")}</span>
    <span><span className="text-sky-600 underline decoration-dashed">{tr("blue")}</span> {" "}{tr("missed")}</span>
  </p>
);

type Step = "intro" | "running" | "result";

export const DictationPage: React.FC = () => {
  const { data: session, isLoading, isError, refetch, isFetching } = useDictationSession();
  const check = useCheckDictation();
  const finish = useFinishDictation();

  const [step, setStep] = useState<Step>("intro");
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [slow, setSlow] = useState(false);
  const [plays, setPlays] = useState(0);
  const [feedback, setFeedback] = useState<DictationCheck | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DictationResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => stopSpeaking(), []);

  const item = session?.items[index];

  const play = async (text: string) => {
    setPlays((p) => p + 1);
    await speak(text, { rate: slow ? 0.65 : 0.9 });
    inputRef.current?.focus();
  };

  // Read each new sentence once as it appears (the first time follows the Start tap, which browsers allow)
  const sentenceKey = `${step}:${item?.id ?? ""}`;
  const [countedFor, setCountedFor] = useState(sentenceKey);
  if (countedFor !== sentenceKey) {
    setCountedFor(sentenceKey);
    if (step === "running" && item && !feedback) setPlays(0);
  }
  useEffect(() => {
    if (step === "running" && item && !feedback) {
      // Speaking is the outside effect; play() also counts the listen
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void play(item.text);
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
  if (isError || !session) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>{tr("Couldn't load a dictation. Refresh to try again.")}</div>;
  }

  const total = session.items.length;

  const start = async () => {
    if (step === "result") await refetch();
    setStep("running");
    setIndex(0);
    setTyped("");
    setFeedback(null);
    setAnswers({});
    setResult(null);
  };

  const checkNow = async () => {
    if (!item || !typed.trim() || check.isPending) return;
    stopSpeaking();
    try {
      const r = await check.mutateAsync({ id: item.id, typed });
      setAnswers((a) => ({ ...a, [item.id]: typed }));
      setFeedback(r);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't check that. Try again."));
    }
  };

  const next = async () => {
    if (index < total - 1) {
      setIndex(index + 1);
      setTyped("");
      setFeedback(null);
      return;
    }
    try {
      const r = await finish.mutateAsync(answers);
      setResult(r);
      setStep("result");
      if (r.xp > 0) toast.success(tr("Dictation done! +{xp} XP", { xp: r.xp }));
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save your result. Try again."));
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
          <Headphones className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">{tr("Dictation")}</h1>
          <p className="text-sm text-slate-500">{tr("Listen to a sentence and type exactly what you hear.")}</p>
        </div>
        <span className="text-xs text-slate-500 shrink-0">{session.level}</span>
      </header>

      {!canSpeak() && (
        <div className={`${card} p-4 text-sm text-amber-700 dark:text-amber-400`}>
          {tr("This browser can't read text aloud, so dictation won't work here. Try Chrome, Edge or Safari.")}</div>
      )}

      {step === "intro" && (
        <section className={`${card} p-6 text-center space-y-4`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{total} {" "}{tr("sentences at your level")}</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {tr("Each sentence plays once on its own. Play it again or slow it down as often as you like, then type it. Sentences you miss go into your flashcard review.")}</p>
          <p className="text-xs text-slate-400">
            {session.doneToday > 0 ? tr("{doneToday} done today", { doneToday: session.doneToday }) : tr("Your first one today earns XP")}
            {session.bestScore !== null && tr(" · best {bestScore}%", { bestScore: session.bestScore })}
          </p>
          <button type="button" className={primaryBtn} onClick={start} disabled={!canSpeak()}>
            <Play className="w-4 h-4" /> {" "}{tr("Start")}</button>
        </section>
      )}

      {step === "running" && item && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + (feedback ? 1 : 0)}>
              <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${((index + (feedback ? 1 : 0)) / total) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{index + 1}/{total}</span>
          </div>

          <section className={`${card} p-5 sm:p-6 space-y-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void play(item.text)} className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold">
                <Play className="w-4 h-4" /> {plays > 0 ? tr("Play again") : tr("Play")}
              </button>
              <button
                type="button"
                onClick={() => setSlow((s) => !s)}
                aria-pressed={slow}
                className={`inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-sm font-semibold border transition-colors ${
                  slow ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                }`}
              >
                <Turtle className="w-4 h-4" /> {" "}{tr("Slower")}</button>
              <span className="text-xs text-slate-400 ml-auto">{plays} {plays === 1 ? tr("play") : tr("plays")}</span>
            </div>

            {!feedback ? (
              <textarea
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void checkNow();
                  }
                }}
                rows={3}
                maxLength={400}
                placeholder={tr("Type what you hear…")}
                aria-label={tr("What you heard")}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            ) : (
              <div className="space-y-3" role="status">
                <p className={`text-sm font-semibold ${feedback.score === 100 ? "text-emerald-600 dark:text-emerald-400" : feedback.score >= 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {feedback.score === 100 ? tr("Perfect!") : tr("{correct} of {total} words", { correct: feedback.correct, total: feedback.total })} · {feedback.score}%
                </p>
                <MarkedSentence tokens={feedback.tokens} />
                <Legend />
              </div>
            )}
          </section>

          <div className="flex justify-end">
            {!feedback ? (
              <button type="button" className={primaryBtn} onClick={checkNow} disabled={!typed.trim() || check.isPending}>
                {check.isPending && <Loader2 className="w-4 h-4 animate-spin" />} {" "}{tr("Check")}</button>
            ) : (
              <button type="button" className={primaryBtn} onClick={next} disabled={finish.isPending} autoFocus>
                {finish.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {index < total - 1 ? tr("Next sentence") : tr("See results")} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      )}

      {step === "result" && result && (
        <>
          <section className={`${card} p-6 text-center`}>
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="mt-3 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{result.score}%</h2>
            <p className="mt-1 text-sm text-slate-500">
              {result.perfect ? tr("Every word right. Great ears!") : tr("{correctWords} of {totalWords} words right.", { correctWords: result.correctWords, totalWords: result.totalWords })}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {result.xp > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Zap className="w-3.5 h-3.5" /> +{result.xp} XP
                </span>
              )}
              {result.cardsAdded > 0 && (
                <Link to="/flashcards" className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20">
                  <Layers className="w-3.5 h-3.5" /> {result.cardsAdded} {" "}{tr("{value} added to review", { value: result.cardsAdded === 1 ? tr("sentence") : tr("sentences") })}</Link>
              )}
            </div>
          </section>

          <section className={`${card} p-5 space-y-4`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Your sentences")}</h2>
              <Legend />
            </div>
            <ol className="space-y-4">
              {result.results.map((r, i) => (
                <li key={r.id} className="flex gap-3">
                  <span className="text-xs font-bold tabular-nums text-slate-400 mt-2 w-4 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <MarkedSentence tokens={r.tokens} />
                    <p className="text-xs text-slate-400">{r.score}%</p>
                  </div>
                  {canSpeak() && (
                    <button type="button" onClick={() => void speak(r.text, { rate: 0.9 })} aria-label={tr("Listen again")} className="text-slate-400 hover:text-sky-600 shrink-0 mt-1.5">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <ChallengeOutcomes outcomes={result.challenges} />
          <ChallengeFriendButton kind="dictation" refId="dictation" />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={ghostBtn} onClick={start} disabled={isFetching}>
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} {" "}{tr("New dictation")}</button>
            <Link to="/library" className={ghostBtn}>
              {tr("Read stories in the library")}{" "}<ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default DictationPage;
