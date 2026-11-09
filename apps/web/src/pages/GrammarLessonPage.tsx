// apps/web/src/pages/GrammarLessonPage.tsx
/**
 * One grammar lesson in three steps: learn the rule, practise it one exercise at a time with instant
 * feedback, then see the result. Wrong answers are sent to the flashcard review when the lesson ends.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Layers, Loader2, RotateCcw, Trophy, Volume2, X, XCircle, Zap } from "lucide-react";
import {
  useCheckGrammar,
  useFinishGrammar,
  useGrammarLesson,
  type GrammarAnswer,
  type GrammarCheck,
  type GrammarExercise,
  type GrammarResult,
} from "../hooks/useGrammar";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { ChallengeFriendButton } from "../components/challenges/ChallengeFriendButton";
import { ChallengeOutcomes } from "../components/challenges/ChallengeOutcomes";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors";

const errorMessage = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** What the learner has built so far for one exercise (not yet an answer to send) */
type Draft = { pick: number | null; placed: number[]; typed: string };
const emptyDraft: Draft = { pick: null, placed: [], typed: "" };

const isReady = (ex: GrammarExercise, d: Draft): boolean => {
  switch (ex.kind) {
    case "blank":
    case "correct":
      return d.pick !== null;
    case "order":
      return d.placed.length === ex.words.length;
    case "type":
      return d.typed.trim().length > 0;
  }
};

const toAnswer = (ex: GrammarExercise, d: Draft): GrammarAnswer => {
  switch (ex.kind) {
    case "blank":
    case "correct":
      return d.pick ?? 0;
    case "order":
      return d.placed.map((i) => ex.words[i]);
    case "type":
      return d.typed.trim();
  }
};

type Step = "learn" | "practise" | "result";

export const GrammarLessonPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { data: lesson, isLoading, isError } = useGrammarLesson(lessonId);
  const checkMutation = useCheckGrammar(lessonId ?? "");
  const finishMutation = useFinishGrammar(lessonId ?? "");

  const [step, setStep] = useState<Step>("learn");
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [feedback, setFeedback] = useState<GrammarCheck | null>(null);
  const [answers, setAnswers] = useState<Record<string, GrammarAnswer>>({});
  const [result, setResult] = useState<GrammarResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A different lesson starts from the top; stop the voice when leaving
  useEffect(() => {
    setStep("learn");
    setIndex(0);
    setDraft(emptyDraft);
    setFeedback(null);
    setAnswers({});
    setResult(null);
  }, [lessonId]);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (step === "practise") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, index]);

  const exercise = lesson?.exercises[index];
  useEffect(() => {
    if (exercise?.kind === "type" && !feedback) inputRef.current?.focus();
  }, [exercise?.id, exercise?.kind, feedback]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !lesson) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>
        Couldn't load this lesson. <Link to="/grammar" className="text-indigo-600 underline">Back to grammar</Link>
      </div>
    );
  }

  const total = lesson.exercises.length;

  const restart = () => {
    setStep("practise");
    setIndex(0);
    setDraft(emptyDraft);
    setFeedback(null);
    setAnswers({});
    setResult(null);
  };

  const check = async () => {
    if (!exercise || !isReady(exercise, draft) || checkMutation.isPending) return;
    const answer = toAnswer(exercise, draft);
    try {
      const r = await checkMutation.mutateAsync({ exerciseId: exercise.id, answer });
      setAnswers((a) => ({ ...a, [exercise.id]: answer }));
      setFeedback(r);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't check that. Try again."));
    }
  };

  const next = async () => {
    if (index < total - 1) {
      setIndex(index + 1);
      setDraft(emptyDraft);
      setFeedback(null);
      return;
    }
    try {
      const r = await finishMutation.mutateAsync(answers);
      setResult(r);
      setStep("result");
      if (r.firstPass) toast.success(`Lesson passed! +${r.xp} XP`);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save your result. Try again."));
    }
  };

  const hear = (text: string) => {
    void speak(text.replace(/\s*\(.*?\)\s*/g, " "), { rate: 0.9 });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/grammar" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <ArrowLeft className="w-4 h-4" /> Grammar
        </Link>
        <span className="text-xs text-slate-400">
          {lesson.level} · lesson {lesson.positionInLevel.index} of {lesson.positionInLevel.of}
        </span>
      </div>

      {/* ---------------------------------------------------------------- learn */}
      {step === "learn" && (
        <>
          <header>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{lesson.title}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{lesson.intro}</p>
            {lesson.progress && (
              <p className="mt-2 text-xs text-slate-400">
                Your best: {lesson.progress.bestScore}/{lesson.progress.total}
                {lesson.progress.done ? " · passed" : ""}
              </p>
            )}
          </header>

          <div className="space-y-3">
            {lesson.rules.map((rule, n) => (
              <section key={rule.title} className={`${card} p-5`}>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300 text-xs flex items-center justify-center tabular-nums">{n + 1}</span>
                  {rule.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{rule.body}</p>
                <ul className="mt-3 space-y-1.5">
                  {rule.examples.map((ex) => (
                    <li key={ex} className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
                      <span className="flex-1">{ex}</span>
                      {canSpeak() && (
                        <button type="button" onClick={() => hear(ex)} aria-label={`Listen to: ${ex}`} className="text-slate-400 hover:text-indigo-600 shrink-0 mt-0.5">
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className={`${card} p-5`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Common mistakes</h2>
            <ul className="mt-3 space-y-3">
              {lesson.mistakes.map((m) => (
                <li key={m.wrong} className="text-sm">
                  <p className="flex items-start gap-2 text-rose-600 dark:text-rose-400">
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span className="line-through decoration-rose-400/60">{m.wrong}</span>
                  </p>
                  <p className="mt-1 flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span>{m.right}</span>
                  </p>
                  <p className="mt-1 ml-6 text-xs text-slate-500">{m.why}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-end">
            <button type="button" className={primaryBtn} onClick={() => setStep("practise")}>
              Practise ({total} exercises) <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- practise */}
      {step === "practise" && exercise && (
        <>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setStep("learn")} aria-label="Back to the rules" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + (feedback ? 1 : 0)}>
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((index + (feedback ? 1 : 0)) / total) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{index + 1}/{total}</span>
          </div>

          <section className={`${card} p-5 sm:p-6 space-y-5`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{promptLabel(exercise)}</p>

            {exercise.kind === "blank" && (
              <>
                <Sentence prompt={exercise.prompt} fill={draft.pick !== null ? exercise.options[draft.pick] : null} feedback={feedback} />
                <Options options={exercise.options} draft={draft} setDraft={setDraft} locked={!!feedback} feedback={feedback} />
              </>
            )}

            {exercise.kind === "correct" && (
              <>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{exercise.prompt}</p>
                <Options options={exercise.options} draft={draft} setDraft={setDraft} locked={!!feedback} feedback={feedback} />
              </>
            )}

            {exercise.kind === "order" && <OrderBoard exercise={exercise} draft={draft} setDraft={setDraft} locked={!!feedback} feedback={feedback} />}

            {exercise.kind === "type" && (
              <TypeBlank
                prompt={exercise.prompt}
                value={draft.typed}
                onChange={(typed) => setDraft((d) => ({ ...d, typed }))}
                onEnter={feedback ? next : check}
                locked={!!feedback}
                feedback={feedback}
                inputRef={inputRef}
              />
            )}

            {feedback && (
              <div
                role="status"
                className={`rounded-2xl px-4 py-3 text-sm ${
                  feedback.correct
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300"
                }`}
              >
                <p className="font-semibold flex items-center gap-1.5">
                  {feedback.correct ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {feedback.correct ? "Correct!" : "Not quite"}
                </p>
                {!feedback.correct && <p className="mt-1">Right answer: <strong>{feedback.correctText}</strong></p>}
                <p className="mt-1 opacity-90">{feedback.explanation}</p>
              </div>
            )}
          </section>

          <div className="flex items-center justify-end gap-2">
            {!feedback ? (
              <button type="button" className={primaryBtn} onClick={check} disabled={!isReady(exercise, draft) || checkMutation.isPending}>
                {checkMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Check
              </button>
            ) : (
              <button type="button" className={primaryBtn} onClick={next} disabled={finishMutation.isPending} autoFocus>
                {finishMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {index < total - 1 ? "Next" : "See results"} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- result */}
      {step === "result" && result && (
        <>
          <section className={`${card} p-6 text-center`}>
            <div
              className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                result.passed ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <Trophy className="w-8 h-8" />
            </div>
            <h1 className="mt-3 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              {result.score}/{result.total}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {result.perfect ? "Perfect! Every exercise right." : result.passed ? "Lesson passed. Nice work." : "Almost. Read the rules again and try once more."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {result.xp > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Zap className="w-3.5 h-3.5" /> +{result.xp} XP
                </span>
              )}
              {result.cardsAdded > 0 && (
                <Link to="/flashcards" className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20">
                  <Layers className="w-3.5 h-3.5" /> {result.cardsAdded} new {result.cardsAdded === 1 ? "flashcard" : "flashcards"} to review
                </Link>
              )}
            </div>
          </section>

          <section className={`${card} p-5`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Your answers</h2>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
              {result.results.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  {r.correct ? (
                    <p className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {r.correctText}
                    </p>
                  ) : (
                    <>
                      <p className="flex items-start gap-2 text-rose-600 dark:text-rose-400">
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span className="line-through decoration-rose-400/60">{r.original}</span>
                      </p>
                      <p className="mt-1 flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {r.correctText}
                      </p>
                      <p className="mt-1 ml-6 text-xs text-slate-500">{r.explanation}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <ChallengeOutcomes outcomes={result.challenges} />
          <ChallengeFriendButton kind="grammar" refId={lesson.id} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={ghostBtn} onClick={restart}>
              <RotateCcw className="w-4 h-4" /> Try again
            </button>
            <div className="flex gap-2">
              <Link to="/grammar" className={ghostBtn}>All lessons</Link>
              {lesson.next && (
                <Link to={`/grammar/${lesson.next.id}`} className={primaryBtn}>
                  Next: {lesson.next.title} <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const promptLabel = (ex: GrammarExercise): string => {
  switch (ex.kind) {
    case "blank":
      return "Choose the missing word";
    case "correct":
      return "Choose the correct sentence";
    case "order":
      return ex.prompt;
    case "type":
      return "Type the missing word";
  }
};

/** A sentence with its gap, showing the chosen word in it */
const Sentence: React.FC<{ prompt: string; fill: string | null; feedback: GrammarCheck | null }> = ({ prompt, fill, feedback }) => {
  const [before, after] = prompt.split("___");
  const tone = feedback ? (feedback.correct ? "border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-rose-500 text-rose-600 dark:text-rose-400") : "border-indigo-400 text-indigo-600 dark:text-indigo-300";
  return (
    <p className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-relaxed">
      {before}
      <span className={`inline-block min-w-[4.5rem] mx-1 px-2 text-center border-b-2 ${tone}`}>{fill ?? " "}</span>
      {after}
    </p>
  );
};

const Options: React.FC<{
  options: string[];
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  locked: boolean;
  feedback: GrammarCheck | null;
}> = ({ options, draft, setDraft, locked, feedback }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup">
    {options.map((option, i) => {
      const selected = draft.pick === i;
      const verdict = locked && selected ? (feedback?.correct ? "ok" : "bad") : null;
      return (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={locked}
          onClick={() => setDraft((d) => ({ ...d, pick: i }))}
          className={`min-h-[3rem] px-4 py-2.5 rounded-2xl border text-left text-sm font-medium transition-colors ${
            verdict === "ok"
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : verdict === "bad"
                ? "border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300"
                : selected
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-200"
                  : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
          } ${locked ? "cursor-default" : ""}`}
        >
          {option}
        </button>
      );
    })}
  </div>
);

/** Tap words from the bank to build the sentence; tap a placed word to take it back */
const OrderBoard: React.FC<{
  exercise: Extract<GrammarExercise, { kind: "order" }>;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  locked: boolean;
  feedback: GrammarCheck | null;
}> = ({ exercise, draft, setDraft, locked, feedback }) => {
  const tone = feedback
    ? feedback.correct
      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10"
      : "border-rose-500 bg-rose-50/60 dark:bg-rose-500/10"
    : "border-slate-300 dark:border-white/15";
  const chip = "h-10 px-3.5 rounded-xl border text-sm font-medium transition-colors";
  return (
    <div className="space-y-4">
      <div className={`min-h-[3.5rem] flex flex-wrap gap-2 rounded-2xl border-2 border-dashed p-2.5 ${tone}`} aria-label="Your sentence">
        {draft.placed.length === 0 && <span className="text-sm text-slate-400 self-center px-1">Tap the words below in the right order</span>}
        {draft.placed.map((wordIndex, position) => (
          <button
            key={`${wordIndex}-${position}`}
            type="button"
            disabled={locked}
            onClick={() => setDraft((d) => ({ ...d, placed: d.placed.filter((_, p) => p !== position) }))}
            className={`${chip} border-indigo-300 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-white/[0.1]`}
          >
            {exercise.words[wordIndex]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Word bank">
        {exercise.words.map((word, wordIndex) => {
          const used = draft.placed.includes(wordIndex);
          return (
            <button
              key={`${word}-${wordIndex}`}
              type="button"
              disabled={locked || used}
              onClick={() => setDraft((d) => ({ ...d, placed: [...d.placed, wordIndex] }))}
              className={`${chip} ${
                used
                  ? "border-transparent bg-slate-100 dark:bg-white/[0.04] text-transparent select-none"
                  : "border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>
      {!locked && draft.placed.length > 0 && (
        <button type="button" onClick={() => setDraft((d) => ({ ...d, placed: [] }))} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline">
          Clear
        </button>
      )}
    </div>
  );
};

/** A sentence with a box to type in where the gap is */
const TypeBlank: React.FC<{
  prompt: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  locked: boolean;
  feedback: GrammarCheck | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
}> = ({ prompt, value, onChange, onEnter, locked, feedback, inputRef }) => {
  const [before, afterRaw] = prompt.split("___");
  const tone = feedback
    ? feedback.correct
      ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
      : "border-rose-500 text-rose-600 dark:text-rose-400"
    : "border-indigo-400 focus:border-indigo-600";
  return (
    <p className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-[2.4]">
      {before}
      <input
        ref={inputRef}
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        aria-label="Your answer"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={40}
        className={`inline-block w-36 mx-1.5 px-2 py-0.5 bg-transparent text-center border-b-2 outline-none ${tone}`}
      />
      {afterRaw}
    </p>
  );
};

export default GrammarLessonPage;
