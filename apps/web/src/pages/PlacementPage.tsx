/**
 * PlacementPage — finds the learner's CEFR level (A1–C2).
 *
 * 16 adaptive questions across grammar, vocabulary, reading and listening; each answer decides how
 * hard the next one is. The server holds the answers and the scoring, so nothing here can reveal
 * them. The level is saved on the profile and used for room filters, random calls and the dashboard.
 * An optional spoken sample shows fluency next to the level (it doesn't change the level).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Headphones,
  Layers,
  Loader2,
  Mic,
  Phone,
  PenLine,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
  AudioLines,
  type LucideIcon,
} from "lucide-react";
import {
  useAnswerPlacement,
  usePlacementStatus,
  useStartPlacement,
  useSubmitSpeaking,
  type PlacementProgress,
  type PlacementResult,
  type PlacementSkill,
  type SpeakingSample,
} from "../hooks/usePlacement";
import { CEFR_CODES, CEFR_INFO } from "../lib/cefr";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import { speechCaptionsSupported, useSpeechCaptions } from "../components/call/useSpeechCaptions";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const SKILL_META: Record<PlacementSkill, { label: string; icon: LucideIcon; tone: string; hint: string }> = {
  GRAMMAR: { label: "Grammar", icon: PenLine, tone: "bg-violet-500/10 text-violet-500", hint: "Choose the correct form" },
  VOCABULARY: { label: "Vocabulary", icon: BookOpen, tone: "bg-emerald-500/10 text-emerald-500", hint: "Choose the right word" },
  READING: { label: "Reading", icon: Layers, tone: "bg-sky-500/10 text-sky-500", hint: "Read, then answer" },
  LISTENING: { label: "Listening", icon: Headphones, tone: "bg-amber-500/10 text-amber-500", hint: "Listen, then answer" },
};

const SPEAKING_PROMPT = "Tell us about your last holiday, or a place you would love to visit and why.";
const SPEAKING_MAX_SECONDS = 60;
const MAX_PLAYS = 3;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

// ============================================================
// Intro
// ============================================================

const Intro: React.FC<{
  resumeAt: number | null;
  total: number;
  starting: boolean;
  onStart: () => void;
}> = ({ resumeAt, total, starting, onStart }) => (
  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 lg:py-16">
    <div className="text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-indigo-500/15">
        <Sparkles className="w-7 h-7 text-white" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-5">Find your English level</h1>
      <p className="text-slate-600 dark:text-slate-300 mt-2">
        {total} questions, about 8 minutes. We adjust the difficulty as you go, then place you from A1 to C2.
      </p>
    </div>

    <div className={`${card} p-5 mt-8 grid grid-cols-2 gap-3`}>
      {(Object.keys(SKILL_META) as PlacementSkill[]).map((skill) => {
        const { label, icon: Icon, tone, hint } = SKILL_META[skill];
        return (
          <div key={skill} className="flex items-center gap-3 p-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
              <p className="text-xs text-slate-500">{hint}</p>
            </div>
          </div>
        );
      })}
    </div>

    <ul className="mt-6 space-y-2 text-sm text-slate-600 dark:text-slate-300">
      <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /> Don't guess — choose “I don't know” when you're unsure. It gives a more accurate level.</li>
      <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /> Use headphones or turn your sound on for the listening questions.</li>
      <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /> No dictionaries or translators. It's only for you, and you can retake it once a day.</li>
    </ul>

    <button
      type="button"
      onClick={onStart}
      disabled={starting}
      className="mt-8 w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
    >
      {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
      {resumeAt !== null ? `Continue — question ${resumeAt + 1} of ${total}` : "Start the test"}
    </button>
  </div>
);

// ============================================================
// Quiz
// ============================================================

const Question: React.FC<{
  progress: PlacementProgress;
  busy: boolean;
  onSubmit: (answer: { choice?: number; skip?: boolean; ms: number }) => void;
}> = ({ progress, busy, onSubmit }) => {
  const { question } = progress;
  const meta = SKILL_META[question.skill];
  const Icon = meta.icon;
  const [selected, setSelected] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shownAt] = useState(() => Date.now());
  const audioAvailable = canSpeak();

  useEffect(() => () => stopSpeaking(), []);

  const play = useCallback(async () => {
    if (!question.audio || playing || plays >= MAX_PLAYS) return;
    setPlays((n) => n + 1);
    setPlaying(true);
    await speak(question.audio, { rate: 0.9 });
    setPlaying(false);
  }, [question.audio, playing, plays]);

  const submit = useCallback(
    (skip: boolean) => {
      if (busy || (!skip && selected === null)) return;
      stopSpeaking();
      const ms = Date.now() - shownAt;
      onSubmit(skip ? { skip: true, ms } : { choice: selected as number, ms });
    },
    [busy, selected, onSubmit, shownAt],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= question.options.length) setSelected(n - 1);
      else if (e.key === "Enter") submit(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question.options.length, submit]);

  return (
    <div className={`${card} p-5 sm:p-7`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.tone}`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{meta.label}</span>
      </div>

      {question.passage && (
        <p className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
          {question.passage}
        </p>
      )}

      {question.audio && (
        <div className="mt-4">
          {audioAvailable ? (
            <button
              type="button"
              onClick={play}
              disabled={playing || plays >= MAX_PLAYS}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-50"
            >
              <Volume2 className={`w-4 h-4 ${playing ? "animate-pulse text-indigo-500" : ""}`} />
              {playing ? "Playing…" : plays === 0 ? "Play audio" : plays >= MAX_PLAYS ? "No plays left" : "Play again"}
              <span className="text-xs font-normal text-slate-400">{MAX_PLAYS - plays} left</span>
            </button>
          ) : (
            <p className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200">
              Audio isn't supported in this browser, so here is the text: “{question.audio}”
            </p>
          )}
        </div>
      )}

      <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mt-5 leading-snug">{question.prompt}</h2>

      <div role="radiogroup" aria-label="Answer options" className="mt-4 space-y-2.5">
        {question.options.map((option, index) => {
          const active = selected === index;
          return (
            <button
              key={`${question.id}-${index}`}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(index)}
              className={`w-full text-left px-4 py-3 rounded-2xl border flex items-center gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                active
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                  : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                  active ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-white/[0.07] text-slate-500"
                }`}
              >
                {index + 1}
              </span>
              <span className="text-[15px] text-slate-800 dark:text-slate-100">{option}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={busy}
          className="h-11 px-4 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
        >
          I don't know
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={busy || selected === null}
          className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {progress.answered + 1 === progress.total ? "Finish" : "Next"}
          {!busy && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
      <p className="hidden sm:block text-center text-[11px] text-slate-400 mt-3">Press 1–4 to choose, Enter to continue</p>
    </div>
  );
};

const Quiz: React.FC<{
  progress: PlacementProgress;
  busy: boolean;
  onSubmit: (answer: { choice?: number; skip?: boolean; ms: number }) => void;
}> = ({ progress, busy, onSubmit }) => {
  const pct = Math.round((progress.answered / progress.total) * 100);
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          Question {progress.answered + 1} <span className="text-slate-400 font-normal">of {progress.total}</span>
        </span>
        <span className="text-slate-400 tabular-nums">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden mb-6"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <Question key={progress.question.id} progress={progress} busy={busy} onSubmit={onSubmit} />
    </div>
  );
};

// ============================================================
// Speaking sample
// ============================================================

const SpeakingCard: React.FC<{ attemptId: string; saved: SpeakingSample | null }> = ({ attemptId, saved }) => {
  const submit = useSubmitSpeaking();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // Finished phrases and the phrase still being recognised, both shown live so you can see you're heard
  const [heard, setHeard] = useState("");
  const [interim, setInterim] = useState("");
  // What the last analysis was based on, so the numbers can be checked against your words
  const [analysed, setAnalysed] = useState("");
  const [sample, setSample] = useState<SpeakingSample | null>(saved);
  const transcript = useRef<string[]>([]);
  // The browser only finalises a phrase after a pause, so keep the latest unfinished one for Stop
  const interimRef = useRef("");
  const supported = speechCaptionsSupported();
  const { mutateAsync: sendSample, isPending: analysing } = submit;

  const { error } = useSpeechCaptions({
    active: recording,
    onText: (text, final) => {
      if (final) {
        transcript.current.push(text);
        interimRef.current = "";
        setHeard(transcript.current.join(" "));
        setInterim("");
      } else {
        interimRef.current = text;
        setInterim(text);
      }
    },
  });

  const finish = useCallback(
    async (elapsed: number) => {
      setRecording(false);
      const text = [...transcript.current, interimRef.current].join(" ").trim();
      transcript.current = [];
      interimRef.current = "";
      setHeard("");
      setInterim("");
      if (!text) {
        toast.error("We didn't hear anything. Check your microphone and try again.");
        return;
      }
      try {
        setSample(await sendSample({ attemptId, transcript: text, seconds: Math.max(1, elapsed) }));
        setAnalysed(text);
      } catch {
        toast.error("Couldn't analyse your speaking sample. Please try again.");
      }
    },
    [attemptId, sendSample],
  );

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= SPEAKING_MAX_SECONDS) {
        window.clearInterval(timer);
        void finish(elapsed);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [recording, finish]);

  if (!supported) {
    return (
      <div className={`${card} p-5`}>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Speaking sample</p>
        <p className="text-sm text-slate-500 mt-1">Speech recognition works in Chrome and Edge. Open the test there to add a spoken sample.</p>
      </div>
    );
  }

  return (
    <div className={`${card} p-5 sm:p-6`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
          <Mic className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add a speaking sample <span className="text-slate-400 font-normal">(optional)</span></p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{SPEAKING_PROMPT} Speak for about 30 seconds.</p>
        </div>
      </div>

      {recording && (
        <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] text-sm text-slate-600 dark:text-slate-300 min-h-[3.5rem]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-rose-500 mb-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Listening · {seconds}s
          </span>
          <p>
            {heard || interim ? (
              <>
                {heard} <span className="text-slate-400">{interim}</span>
              </>
            ) : (
              <span className="text-slate-400">Start speaking… your words appear here as you talk.</span>
            )}
          </p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
      {analysing && (
        <p className="mt-4 text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Analysing what you said…
        </p>
      )}

      {sample && !recording && !analysing && (
        <div className="mt-4 space-y-3">
          {sample.tooShort ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              We only heard {sample.words} word{sample.words === 1 ? "" : "s"}, and we need at least 15 to give feedback.
              Try again and speak for about 30 seconds.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Fluency", value: sample.fluency === null ? "—" : `${sample.fluency}/100` },
                  { label: "Pace", value: sample.wpm === null ? "—" : `${sample.wpm} wpm` },
                  { label: "Fillers", value: `${sample.fillersPer100}/100 words` },
                  { label: "Words", value: String(sample.words) },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04]">
                    <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
              {(sample.fluency === null || sample.wpm === null) && (
                <p className="text-xs text-slate-500">
                  “—” means the sample was too short for that score. Fluency needs about 25 words, pace needs 20 words over at least 15 seconds.
                </p>
              )}
              {sample.richWords.length > 0 && (
                <p className="text-xs text-slate-500">Longer words you used: {sample.richWords.join(", ")}</p>
              )}
            </>
          )}
          {analysed && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer select-none">What we heard</summary>
              <p className="mt-1.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300">{analysed}</p>
            </details>
          )}
          <p className="text-xs text-slate-400">
            Your browser turns your voice into text, and we measure the text: how fast you talk, filler words (um, like, you know), repeated words and word variety.
            This doesn't judge grammar or pronunciation, and it doesn't change your level.
          </p>
        </div>
      )}

      <div className="mt-4">
        {recording ? (
          <button
            type="button"
            onClick={() => finish(seconds)}
            className="h-11 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center gap-2"
          >
            <Square className="w-4 h-4" /> Stop and analyse
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              transcript.current = [];
              interimRef.current = "";
              setHeard("");
              setInterim("");
              setSeconds(0);
              setRecording(true);
            }}
            disabled={analysing}
            className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2"
          >
            {analysing ?<Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {sample && !sample.tooShort ? "Record again" : "Start speaking"}
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Result
// ============================================================

const Result: React.FC<{
  attemptId: string;
  result: PlacementResult;
  speaking: SpeakingSample | null;
  retakeAt: string | null;
  retaking: boolean;
  onRetake: () => void;
}> = ({ attemptId, result, speaking, retakeAt, retaking, onRetake }) => {
  const reduced = Boolean(useReducedMotion());
  const info = CEFR_INFO[result.level];
  const confidenceNote = useMemo(
    () =>
      ({
        high: "We're confident in this result.",
        medium: "A good estimate. Retaking later will sharpen it.",
        low: "A rough estimate: you skipped or missed a lot. Try again when you feel ready.",
      })[result.confidence],
    [result.confidence],
  );

  const steps: Array<{ to: string; title: string; desc: string; icon: LucideIcon; tone: string }> = [
    { to: "/voice", title: "Join a voice room", desc: "Practise live with people around your level", icon: AudioLines, tone: "bg-indigo-500/10 text-indigo-500" },
    { to: "/call", title: "Try a random call", desc: "A 1:1 chat with someone at a similar level", icon: Phone, tone: "bg-rose-500/10 text-rose-500" },
    { to: "/flashcards", title: `Review your ${SKILL_META[result.weakest].label.toLowerCase()}`, desc: `${SKILL_META[result.weakest].label} is your weakest skill`, icon: Layers, tone: "bg-sky-500/10 text-sky-500" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-5">
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-3xl p-7 sm:p-9 text-white bg-gradient-to-br ${info.gradient} shadow-xl`}
      >
        <div className="absolute -top-20 -right-12 w-64 h-64 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.16em] text-white/80">Your English level</p>
        <div className="relative flex items-end gap-4 mt-2">
          <span className="text-6xl sm:text-7xl font-bold tracking-tight leading-none">{result.level}</span>
          <span className="text-xl font-semibold pb-1.5">{info.name}</span>
        </div>
        <p className="relative text-white/90 mt-4 max-w-lg">{info.summary}</p>
        <p className="relative text-sm text-white/75 mt-3">
          {result.correct} of {result.total} correct · {confidenceNote}
        </p>
      </motion.section>

      <section className={`${card} p-5 sm:p-6`}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Skill by skill</h2>
        <div className="mt-4 space-y-4">
          {(Object.keys(SKILL_META) as PlacementSkill[]).map((skill) => {
            const meta = SKILL_META[skill];
            const r = result.skills[skill];
            const Icon = meta.icon;
            const position = ((CEFR_CODES.indexOf(r.level) + 1) / CEFR_CODES.length) * 100;
            return (
              <div key={skill} className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.tone}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {meta.label}
                      {skill === result.strongest && <span className="ml-2 text-[11px] font-semibold text-emerald-600">Strongest</span>}
                      {skill === result.weakest && <span className="ml-2 text-[11px] font-semibold text-amber-600">To improve</span>}
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{r.level}</span> · {r.correct}/{r.total}
                    </span>
                  </div>
                  <div className="h-2 mt-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${CEFR_INFO[r.level].gradient}`} style={{ width: `${position}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <SpeakingCard attemptId={attemptId} saved={speaking} />

      <section className={`${card} p-5 sm:p-6`}>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Where to next</h2>
        <div className="mt-3 grid sm:grid-cols-3 gap-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.tone}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard" className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2">
          Go to dashboard <ArrowRight className="w-4 h-4" />
        </Link>
        {retakeAt ? (
          <span className="text-sm text-slate-500 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> You can retake it {formatWhen(retakeAt)}
          </span>
        ) : (
          <button
            type="button"
            onClick={onRetake}
            disabled={retaking}
            className="h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-60"
          >
            {retaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Retake the test
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Page
// ============================================================

export const PlacementPage: React.FC = () => {
  const { data: status, isLoading, isError, refetch } = usePlacementStatus();
  const start = useStartPlacement();
  const answer = useAnswerPlacement();

  const [progress, setProgress] = useState<PlacementProgress | null>(null);
  // `retakeAt` is set when the test ends, so the result shows the cooldown before the status refetches
  const [finished, setFinished] = useState<{ attemptId: string; result: PlacementResult; retakeAt: string } | null>(null);

  const begin = useCallback(async () => {
    try {
      setFinished(null);
      setProgress(await start.mutateAsync());
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 429) {
        toast.error("You can retake the test once a day. Come back tomorrow!");
        void refetch();
      } else {
        toast.error("Couldn't start the test. Please try again.");
      }
    }
  }, [start, refetch]);

  const submit = useCallback(
    async (a: { choice?: number; skip?: boolean; ms: number }) => {
      if (!progress) return;
      try {
        const reply = await answer.mutateAsync({
          attemptId: progress.attemptId,
          itemId: progress.question.id,
          ...a,
        });
        if (reply.done) {
          setProgress(null);
          setFinished({
            attemptId: reply.attemptId,
            result: reply.result,
            retakeAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
          });
        } else {
          setProgress(reply);
        }
      } catch {
        toast.error("Couldn't save that answer. Please try again.");
      }
    },
    [answer, progress],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">We couldn't load the placement test</p>
        <button type="button" onClick={() => refetch()} className="mt-5 px-4 h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          Try again
        </button>
      </div>
    );
  }

  if (progress) return <Quiz progress={progress} busy={answer.isPending} onSubmit={submit} />;

  const shown =
    finished ??
    (status.result && status.attemptId ? { attemptId: status.attemptId, result: status.result } : null);

  if (shown) {
    return (
      <Result
        attemptId={shown.attemptId}
        result={shown.result}
        speaking={finished ? null : status.speaking}
        retakeAt={status.retakeAvailableAt ?? finished?.retakeAt ?? null}
        retaking={start.isPending}
        onRetake={begin}
      />
    );
  }

  return (
    <Intro
      resumeAt={status.inProgress?.answered ?? null}
      total={status.totalQuestions}
      starting={start.isPending}
      onStart={begin}
    />
  );
};
