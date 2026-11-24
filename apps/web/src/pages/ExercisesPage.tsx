// apps/web/src/pages/ExercisesPage.tsx
/**
 * Quick practice: eight questions from the real grammar lessons and word packs, marked by the server one at a
 * time. Mistakes go into flashcard review when the set ends.
 */
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Dumbbell, Layers, Loader2, RotateCcw, Trophy, XCircle, Zap } from "lucide-react";
import {
  useCheckExercise,
  useExerciseSet,
  useFinishExercises,
  type ExerciseCheck,
  type ExerciseLevel,
  type ExerciseResult,
  type ExerciseSkill,
  type PracticeAnswer,
  type PracticeExercise,
} from "../hooks/useExercises";
import { playSfx } from "../lib/sfx";
import { msg, tr } from "../i18n/core";

const card = "rounded-3xl border border-line bg-surface shadow-sm";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const chip = (active: boolean) =>
  `h-9 px-4 rounded-full text-sm font-semibold border transition-colors ${
    active
      ? "bg-indigo-600 text-white border-indigo-600"
      : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
  }`;

const SKILL_LABEL: Record<ExerciseSkill, string> = { mixed: msg("Mixed"), grammar: msg("Grammar"), vocabulary: msg("Vocabulary") };
/** The order exercise's prompt is already its instruction */
const INSTRUCTION: Record<Exclude<PracticeExercise["kind"], "order">, string> = {
  blank: msg("Choose the missing word"),
  gap: msg("Choose the missing word"),
  correct: msg("Choose the correct sentence"),
  meaning: msg("Which word means this?"),
  type: msg("Type the missing word"),
};

const errorMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || tr(fallback);

type Draft = { pick: number | null; placed: number[]; typed: string };
const emptyDraft: Draft = { pick: null, placed: [], typed: "" };

const isReady = (ex: PracticeExercise, d: Draft) =>
  ex.kind === "order" ? d.placed.length === ex.words.length : ex.kind === "type" ? d.typed.trim().length > 0 : d.pick !== null;

const toAnswer = (ex: PracticeExercise, d: Draft): PracticeAnswer =>
  ex.kind === "order" ? d.placed.map((i) => ex.words[i]) : ex.kind === "type" ? d.typed.trim() : (d.pick ?? 0);

type Step = "intro" | "running" | "result";

export const ExercisesPage: React.FC = () => {
  const [level, setLevel] = useState<ExerciseLevel | undefined>();
  const [skill, setSkill] = useState<ExerciseSkill>("mixed");
  const { data: set, isLoading, isError, isFetching, refetch } = useExerciseSet(level, skill);
  const check = useCheckExercise();
  const finish = useFinishExercises();

  const [step, setStep] = useState<Step>("intro");
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [feedback, setFeedback] = useState<ExerciseCheck | null>(null);
  const [answers, setAnswers] = useState<Record<string, PracticeAnswer>>({});
  const [result, setResult] = useState<ExerciseResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const item = set?.items[index];
  useEffect(() => {
    if (step === "running" && item?.kind === "type" && !feedback) inputRef.current?.focus();
  }, [step, item?.id, item?.kind, feedback]);

  const reset = () => {
    setIndex(0);
    setDraft(emptyDraft);
    setFeedback(null);
    setAnswers({});
    setResult(null);
  };

  const start = async () => {
    // After a result the next round is a different set
    if (step === "result") await refetch();
    reset();
    setStep("running");
  };

  const chooseLevel = (next: ExerciseLevel) => {
    setLevel(next);
    setStep("intro");
    reset();
  };
  const chooseSkill = (next: ExerciseSkill) => {
    setSkill(next);
    setStep("intro");
    reset();
  };

  const checkNow = async () => {
    if (!item || !isReady(item, draft) || check.isPending || feedback) return;
    const answer = toAnswer(item, draft);
    try {
      const r = await check.mutateAsync({ id: item.id, answer });
      setAnswers((a) => ({ ...a, [item.id]: answer }));
      setFeedback(r);
      playSfx(r.correct ? "good" : "bad");
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't check that. Try again."));
    }
  };

  const next = async () => {
    if (!set) return;
    if (index < set.items.length - 1) {
      setIndex(index + 1);
      setDraft(emptyDraft);
      setFeedback(null);
      return;
    }
    try {
      const r = await finish.mutateAsync({ level: set.level, skill: set.skill, day: set.day, round: set.round, answers });
      setResult(r);
      setStep("result");
      if (r.passed) playSfx("win");
      if (r.xp > 0) toast.success(tr("Exercise set passed! +{xp} XP", { xp: r.xp }));
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save your result. Try again."));
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-700 dark:text-orange-300 flex items-center justify-center shrink-0">
          <Dumbbell className="w-6 h-6" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">{tr("Exercises")}</h1>
          <p className="text-sm text-slate-500">{tr("Eight quick questions from your grammar lessons and word packs.")}</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" aria-label={tr("Loading")} />
        </div>
      ) : isError || !set ? (
        <div className={`${card} p-8 text-center space-y-3`}>
          <p className="text-sm text-slate-600 dark:text-slate-300">{tr("Failed to load exercises")}</p>
          <button type="button" className={primaryBtn} onClick={() => void refetch()}>
            <RotateCcw className="w-4 h-4" aria-hidden /> {tr("Try again")}
          </button>
        </div>
      ) : (
        <>
          {step !== "running" && (
            <section className={`${card} p-4 space-y-3`} aria-label={tr("Filter Exercises")}>
              <div className="flex flex-wrap gap-1.5">
                {set.levels.map((l) => (
                  <button key={l} type="button" aria-pressed={set.level === l} onClick={() => chooseLevel(l)} className={chip(set.level === l)}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {set.skills.map((s) => (
                  <button key={s} type="button" aria-pressed={skill === s} onClick={() => chooseSkill(s)} className={chip(skill === s)}>
                    {tr(SKILL_LABEL[s])}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === "intro" && (
            <section className={`${card} p-6 text-center space-y-4`}>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tr("{count} questions at {level}", { count: set.items.length, level: set.level })}</h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                {tr("Get {passMark} right to pass. You see each answer straight away, and mistakes go into your flashcard review.", { passMark: set.passMark })}
              </p>
              <p className="text-xs text-slate-400">
                {set.xpAvailable ? tr("Your first pass today earns {xp} XP", { xp: set.xp }) : tr("Today's XP is earned. Keep practising!")}
                {set.doneToday > 0 && <> · {tr("{doneToday} done today", { doneToday: set.doneToday })}</>}
              </p>
              <button type="button" className={primaryBtn} onClick={() => void start()} disabled={!set.items.length || isFetching}>
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Zap className="w-4 h-4" aria-hidden />} {tr("Start")}
              </button>
            </section>
          )}

          {step === "running" && item && (
            <>
              <div className="flex items-center gap-3">
                <div
                  className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={set.items.length}
                  aria-valuenow={index + (feedback ? 1 : 0)}
                >
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((index + (feedback ? 1 : 0)) / set.items.length) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-400 tabular-nums">{index + 1}/{set.items.length}</span>
              </div>

              <section className={`${card} p-5 sm:p-6 space-y-4`}>
                <div>
                  <p className="text-xs font-semibold text-slate-400">{tr(SKILL_LABEL[item.skill])} · {tr(item.topic)}</p>
                  {item.kind !== "order" && <p className="mt-1 text-sm text-slate-500">{tr(INSTRUCTION[item.kind])}</p>}
                  <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{item.prompt}</p>
                </div>

                {"options" in item && (
                  <div className="grid gap-2">
                    {item.options.map((option, i) => (
                      <button
                        key={option}
                        type="button"
                        disabled={!!feedback}
                        aria-pressed={draft.pick === i}
                        onClick={() => setDraft({ ...draft, pick: i })}
                        className={`min-h-11 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                          draft.pick === i
                            ? "border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-100"
                            : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {item.kind === "order" && (
                  <div className="space-y-3">
                    <div className="min-h-12 rounded-xl border border-dashed border-slate-300 dark:border-white/15 p-2 flex flex-wrap gap-1.5" aria-label={tr("Your answer")}>
                      {draft.placed.map((wordIndex, at) => (
                        <button
                          key={wordIndex}
                          type="button"
                          disabled={!!feedback}
                          onClick={() => setDraft({ ...draft, placed: draft.placed.filter((_, p) => p !== at) })}
                          className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-sm font-medium"
                        >
                          {item.words[wordIndex]}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.words.map((word, wordIndex) =>
                        draft.placed.includes(wordIndex) ? null : (
                          <button
                            key={wordIndex}
                            type="button"
                            disabled={!!feedback}
                            onClick={() => setDraft({ ...draft, placed: [...draft.placed, wordIndex] })}
                            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                          >
                            {word}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {item.kind === "type" && (
                  <input
                    ref={inputRef}
                    type="text"
                    value={draft.typed}
                    disabled={!!feedback}
                    maxLength={80}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-label={tr("Your answer")}
                    placeholder={tr("Type your answer here...")}
                    onChange={(e) => setDraft({ ...draft, typed: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void checkNow();
                    }}
                    className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                )}

                {feedback && (
                  <div
                    role="status"
                    className={`rounded-2xl p-4 text-sm ${
                      feedback.correct
                        ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100"
                        : "bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100"
                    }`}
                  >
                    <p className="font-semibold inline-flex items-center gap-1.5">
                      {feedback.correct ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <XCircle className="w-4 h-4" aria-hidden />}
                      {feedback.correct ? tr("Correct!") : feedback.correctText}
                    </p>
                    <p className="mt-1 opacity-90">{feedback.explanation}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  {feedback ? (
                    <button type="button" className={primaryBtn} onClick={() => void next()} disabled={finish.isPending}>
                      {finish.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                      {index < set.items.length - 1 ? tr("Next") : tr("See result")} <ArrowRight className="w-4 h-4" aria-hidden />
                    </button>
                  ) : (
                    <button type="button" className={primaryBtn} onClick={() => void checkNow()} disabled={!isReady(item, draft) || check.isPending}>
                      {check.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} {tr("Check")}
                    </button>
                  )}
                </div>
              </section>
            </>
          )}

          {step === "result" && result && (
            <section className={`${card} p-6 space-y-5`}>
              <div className="text-center space-y-1">
                <Trophy className={`w-8 h-8 mx-auto ${result.passed ? "text-amber-500" : "text-slate-300"}`} aria-hidden />
                <p className="text-4xl font-bold tabular-nums text-slate-900 dark:text-white">{result.score}/{result.total}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {result.perfect
                    ? tr("Perfect!")
                    : result.passed
                      ? tr("You passed!")
                      : tr("Not yet. You need {passMark} to pass.", { passMark: result.passMark })}
                </p>
                {result.xp > 0 && <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">+{result.xp} XP</p>}
              </div>

              {result.results.some((r) => !r.correct) && (
                <ul className="space-y-2">
                  {result.results
                    .filter((r) => !r.correct)
                    .map((r) => (
                      <li key={r.id} className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] p-3 text-sm">
                        <p className="text-slate-500 line-through">{r.original}</p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">{r.correctText}</p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{r.explanation}</p>
                      </li>
                    ))}
                </ul>
              )}

              {result.cardsAdded > 0 && (
                <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" aria-hidden /> {tr("{count} added to your flashcard review", { count: result.cardsAdded })}
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className={primaryBtn} onClick={() => void start()} disabled={isFetching}>
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RotateCcw className="w-4 h-4" aria-hidden />} {tr("New set")}
                </button>
                <Link
                  to="/grammar"
                  className="inline-flex items-center justify-center h-11 px-5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                >
                  {tr("Grammar lessons")}
                </Link>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
