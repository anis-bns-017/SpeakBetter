// apps/web/src/pages/PackPage.tsx
/**
 * One vocabulary pack in two tabs: the words (listen, read the meaning and an example, save to flashcard
 * review) and a short quiz with instant feedback. Words you miss in the quiz are added to your review.
 */

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Layers, Loader2, Plus, RotateCcw, Trophy, Volume2, XCircle, Zap } from "lucide-react";
import {
  useCheckPackAnswer,
  useFinishPackQuiz,
  usePack,
  useSavePackWords,
  type PackCheck,
  type PackResult,
  type PackWord,
} from "../hooks/useVocabPacks";
import { categoryTone, packIcon, topicTone } from "../components/packs/packIcons";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { ChallengeFriendButton } from "../components/challenges/ChallengeFriendButton";
import { ChallengeOutcomes } from "../components/challenges/ChallengeOutcomes";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors";

const errorMessage = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** An example sentence with the word in bold */
const Example: React.FC<{ sentence: string; word: string }> = ({ sentence, word }) => {
  const at = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, at)}
      <strong className="font-semibold text-slate-900 dark:text-white">{sentence.slice(at, at + word.length)}</strong>
      {sentence.slice(at + word.length)}
    </>
  );
};

const FORM_LABEL: Record<string, string> = {
  third: "he/she",
  past: "past",
  pastParticiple: "past participle",
  ing: "-ing",
  plural: "plural",
  comparative: "comparative",
  superlative: "superlative",
};

const FREQUENCY: Record<NonNullable<PackWord["freq"]>, { label: string; tone: string }> = {
  common: { label: "Common", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  uncommon: { label: "Uncommon", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  rare: { label: "Rare", tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
};

/** One labelled line of related words, such as synonyms */
const Detail: React.FC<{ label: string; items: string[] }> = ({ label, items }) =>
  items.length ? (
    <p className="text-xs text-slate-500">
      <span className="font-semibold text-slate-400 uppercase tracking-wide text-[10px] mr-1.5">{label}</span>
      {items.join(", ")}
    </p>
  ) : null;

const WordCard: React.FC<{ word: PackWord; onSave: () => void; saving: boolean }> = ({ word, onSave, saving }) => {
  const forms = Object.entries(word.forms ?? {})
    .filter(([key]) => FORM_LABEL[key])
    .map(([key, value]) => `${FORM_LABEL[key]}: ${value}`);
  const freq = word.freq ? FREQUENCY[word.freq] : null;
  return (
  <li className={`${card} p-4`}>
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold text-slate-900 dark:text-white">{word.word}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-white/[0.07] text-slate-500">{word.pos}</span>
          {word.lv && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">{word.lv}</span>}
          {freq && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${freq.tone}`}>{freq.label}</span>}
          {word.tags?.map((tag) => (
            <span key={tag} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.07] text-slate-500">{tag}</span>
          ))}
          {canSpeak() && (
            <button type="button" onClick={() => void speak(word.word, { rate: 0.85 })} aria-label={`Listen to ${word.word}`} className="text-slate-400 hover:text-indigo-600">
              <Volume2 className="w-4 h-4" />
            </button>
          )}
        </p>
        {word.ipa && <p className="text-xs text-slate-400 font-mono mt-0.5">{word.ipa}</p>}
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{word.meaning}</p>
        {word.example && (
          <p className="mt-2 text-sm text-slate-500 italic">
            “<Example sentence={word.example} word={word.form ?? word.word} />”
          </p>
        )}
        {!!word.examples?.length && (
          <details className="mt-1 text-sm text-slate-500">
            <summary className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 select-none">
              {word.examples.length} more {word.examples.length === 1 ? "example" : "examples"}
            </summary>
            <ul className="mt-1 space-y-1 italic">
              {word.examples.map((sentence) => (
                <li key={sentence}>
                  “<Example sentence={sentence} word={word.form ?? word.word} />”
                </li>
              ))}
            </ul>
          </details>
        )}
        {!!word.senses?.length && (
          <ul className="mt-2 space-y-1.5 border-l-2 border-slate-100 dark:border-white/[0.07] pl-3">
            {word.senses.map((sense, i) => (
              <li key={i} className="text-sm text-slate-600 dark:text-slate-300">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1.5">Also</span>
                {sense.meaning}
                {sense.example && <span className="block text-slate-500 italic">“{sense.example}”</span>}
              </li>
            ))}
          </ul>
        )}
        {(word.syn?.length || word.ant?.length || word.fam?.length || forms.length > 0) && (
          <div className="mt-2 space-y-0.5">
            <Detail label="Similar" items={word.syn ?? []} />
            <Detail label="Opposite" items={word.ant ?? []} />
            <Detail label="Word family" items={word.fam ?? []} />
            <Detail label="Forms" items={forms} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={word.saved || saving}
        aria-label={word.saved ? `${word.word} is saved` : `Save ${word.word} to review`}
        title={word.saved ? "In your review" : "Add to your flashcard review"}
        className={`shrink-0 h-9 w-9 rounded-full border flex items-center justify-center transition-colors ${
          word.saved
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:text-indigo-600"
        }`}
      >
        {word.saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      </button>
    </div>
  </li>
  );
};

type Tab = "words" | "quiz";
type QuizStep = "intro" | "running" | "result";

export const PackPage: React.FC = () => {
  const { packId } = useParams<{ packId: string }>();
  const { data: pack, isLoading, isError, refetch, isFetching } = usePack(packId);
  const save = useSavePackWords(packId ?? "");
  const check = useCheckPackAnswer(packId ?? "");
  const finish = useFinishPackQuiz(packId ?? "");

  const [tab, setTab] = useState<Tab>("words");
  const [step, setStep] = useState<QuizStep>("intro");
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<PackCheck | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PackResult | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // A different pack starts from the top; stop the voice when leaving
  useEffect(() => {
    setTab("words");
    setStep("intro");
    setIndex(0);
    setPick(null);
    setFeedback(null);
    setAnswers({});
    setResult(null);
  }, [packId]);
  useEffect(() => () => stopSpeaking(), []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !pack) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>
        Couldn't load this pack. <Link to="/packs" className="text-indigo-600 underline">Back to word packs</Link>
      </div>
    );
  }

  const Icon = packIcon(pack.icon);
  const savedCount = pack.words.filter((w) => w.saved).length;
  const allSaved = savedCount === pack.words.length;
  const question = pack.quiz[index];

  const saveWords = async (ids?: string[]) => {
    setSavingId(ids?.[0] ?? "all");
    try {
      const r = await save.mutateAsync(ids);
      if (!ids) toast.success(r.added > 0 ? `${r.added} ${r.added === 1 ? "word" : "words"} added to your review` : "Already in your review");
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save that. Try again."));
    } finally {
      setSavingId(null);
    }
  };

  const startQuiz = async () => {
    // Retrying after a result: fetch the next attempt's quiz first
    if (step === "result") await refetch();
    setStep("running");
    setIndex(0);
    setPick(null);
    setFeedback(null);
    setAnswers({});
    setResult(null);
  };

  const checkAnswer = async () => {
    if (pick === null || !question || check.isPending) return;
    try {
      const r = await check.mutateAsync({ questionId: question.id, answer: pick });
      setAnswers((a) => ({ ...a, [question.id]: pick }));
      setFeedback(r);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't check that. Try again."));
    }
  };

  const next = async () => {
    if (index < pack.quiz.length - 1) {
      setIndex(index + 1);
      setPick(null);
      setFeedback(null);
      return;
    }
    try {
      const r = await finish.mutateAsync(answers);
      setResult(r);
      setStep("result");
      if (r.firstPass) toast.success(`Pack passed! +${r.xp} XP`);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save your result. Try again."));
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <Link to="/packs" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" /> Word packs
      </Link>

      <header className="flex items-start gap-3">
        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${pack.category === "everyday" ? topicTone(pack.topic) : categoryTone(pack.category)}`}>
          <Icon className="w-6 h-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{pack.level} · {pack.topic}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{pack.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{pack.summary}</p>
          <p className="mt-2 text-xs text-slate-400">
            {savedCount} of {pack.words.length} saved
            {pack.progress && <> · quiz best {pack.progress.bestScore}/{pack.progress.total}{pack.progress.done ? " · passed" : ""}</>}
          </p>
        </div>
      </header>

      <div className="flex gap-1.5" role="tablist">
        {(["words", "quiz"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 px-4 rounded-full text-sm font-semibold border transition-colors ${
              tab === t
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
            }`}
          >
            {t === "words" ? "Words" : "Quiz"}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------------- words */}
      {tab === "words" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">Tap + to add a word to your flashcard review.</p>
            {allSaved ? (
              <Link to="/flashcards" className={ghostBtn}>
                <Layers className="w-4 h-4" /> Review now
              </Link>
            ) : (
              <button type="button" className={primaryBtn} onClick={() => void saveWords()} disabled={savingId === "all"}>
                {savingId === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save all {pack.words.length - savedCount}
              </button>
            )}
          </div>
          <ul className="space-y-3">
            {pack.words.map((w) => (
              <WordCard key={w.id} word={w} saving={savingId === w.id} onSave={() => void saveWords([w.id])} />
            ))}
          </ul>
          <div className="flex justify-end">
            <button type="button" className={primaryBtn} onClick={() => setTab("quiz")}>
              Take the quiz <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- quiz: intro */}
      {tab === "quiz" && step === "intro" && (
        <section className={`${card} p-6 text-center space-y-4`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{pack.quiz.length} quick questions</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Match words to their meanings and fill the gaps. Get {Math.ceil(pack.quiz.length * 0.7)} right to pass. Words you miss go into your review.
          </p>
          <button type="button" className={primaryBtn} onClick={startQuiz}>
            Start quiz <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      )}

      {/* ---------------------------------------------------------------- quiz: running */}
      {tab === "quiz" && step === "running" && question && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={pack.quiz.length} aria-valuenow={index + (feedback ? 1 : 0)}>
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((index + (feedback ? 1 : 0)) / pack.quiz.length) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{index + 1}/{pack.quiz.length}</span>
          </div>

          <section className={`${card} p-5 sm:p-6 space-y-5`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {question.kind === "meaning" ? "Which word matches this meaning?" : "Which word fills the gap?"}
            </p>
            <p className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-relaxed">
              {question.kind === "meaning" ? question.prompt.charAt(0).toUpperCase() + question.prompt.slice(1) : question.prompt}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup">
              {question.options.map((option, i) => {
                const selected = pick === i;
                const isRight = feedback && option === feedback.correctText;
                const isWrongPick = feedback && selected && !feedback.correct;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!!feedback}
                    onClick={() => setPick(i)}
                    className={`min-h-[3rem] px-4 py-2.5 rounded-2xl border text-left text-sm font-medium transition-colors ${
                      isRight
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : isWrongPick
                          ? "border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300"
                          : selected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-200"
                            : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                    } ${feedback ? "cursor-default" : ""}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div
                role="status"
                className={`rounded-2xl px-4 py-3 text-sm ${
                  feedback.correct ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300"
                }`}
              >
                <p className="font-semibold flex items-center gap-1.5">
                  {feedback.correct ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {feedback.correct ? "Correct!" : <>Not quite. The answer is <strong>{feedback.correctText}</strong></>}
                </p>
                <p className="mt-1 opacity-90">{feedback.meaning}</p>
                <p className="mt-1 italic opacity-90">“{feedback.example}”</p>
              </div>
            )}
          </section>

          <div className="flex justify-end">
            {!feedback ? (
              <button type="button" className={primaryBtn} onClick={checkAnswer} disabled={pick === null || check.isPending}>
                {check.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Check
              </button>
            ) : (
              <button type="button" className={primaryBtn} onClick={next} disabled={finish.isPending} autoFocus>
                {finish.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {index < pack.quiz.length - 1 ? "Next" : "See results"} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- quiz: result */}
      {tab === "quiz" && step === "result" && result && (
        <>
          <section className={`${card} p-6 text-center`}>
            <div
              className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                result.passed ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="mt-3 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              {result.score}/{result.total}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {result.perfect ? "Perfect! You know every word." : result.passed ? "Pack passed. Nice work." : "Almost. Look at the words again and try once more."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {result.xp > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Zap className="w-3.5 h-3.5" /> +{result.xp} XP
                </span>
              )}
              {result.wordsAdded > 0 && (
                <Link to="/flashcards" className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20">
                  <Layers className="w-3.5 h-3.5" /> {result.wordsAdded} missed {result.wordsAdded === 1 ? "word" : "words"} added to review
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
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span className="font-semibold">{r.correctText}</span>
                      <span className="text-slate-500 font-normal">· {r.meaning}</span>
                    </p>
                  ) : (
                    <>
                      <p className="flex items-start gap-2 text-rose-600 dark:text-rose-400">
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span className="line-through decoration-rose-400/60">{r.chosen}</span>
                      </p>
                      <p className="mt-1 flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span className="font-semibold">{r.correctText}</span>
                        <span className="text-slate-500 font-normal">· {r.meaning}</span>
                      </p>
                      <p className="mt-1 ml-6 text-xs text-slate-500 italic">“{r.example}”</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <ChallengeOutcomes outcomes={result.challenges} />
          <ChallengeFriendButton kind="pack" refId={pack.id} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className={ghostBtn} onClick={startQuiz} disabled={isFetching}>
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} New quiz
            </button>
            <div className="flex gap-2">
              <Link to="/packs" className={ghostBtn}>All packs</Link>
              {pack.next && (
                <Link to={`/packs/${pack.next.id}`} className={primaryBtn}>
                  Next: {pack.next.title} <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PackPage;
