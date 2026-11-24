// apps/web/src/pages/SpeakingExamPage.tsx
/**
 * Speaking mock test: three parts like the common spoken English exams.
 *   Part 1: three short questions on one topic. Part 2: a cue card, one minute to prepare then up to two to talk.
 *   Part 3: three deeper follow-up questions.
 * Your words are captured by the browser's speech recognition (nothing is recorded or uploaded); the server turns the
 * transcripts into an estimated band for fluency, vocabulary and grammar, with tips. It is practice, not a real mark.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, ClipboardCheck, Loader2, Mic, RotateCcw, Square, Timer, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, PageHeader } from "../components/ui";
import { speechCaptionsSupported, useSpeechCaptions } from "../components/call/useSpeechCaptions";
import {
  readExamHistory,
  saveExamResult,
  useExamPaper,
  useScoreExam,
  type ExamAnswer,
  type ExamHistoryItem,
  type ExamPaper,
  type ExamReport,
  type TipCode,
} from "../hooks/useSpeakingExam";
import { tr, msg } from "../i18n/core";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ============================================================
// The steps of one test
// ============================================================

interface Step {
  part: 1 | 2 | 3;
  question: string;
  /** Part 2 only: the bullet points on the cue card */
  points?: string[];
  prepSeconds?: number;
  /** The answer stops by itself here */
  maxSeconds: number;
  /** The length a good answer reaches */
  targetSeconds: number;
}

function buildSteps(paper: ExamPaper): Step[] {
  return [
    ...paper.part1.questions.map((question): Step => ({ part: 1, question, maxSeconds: 45, targetSeconds: 20 })),
    {
      part: 2,
      question: paper.part2.prompt,
      points: paper.part2.points,
      prepSeconds: paper.part2.prepSeconds,
      maxSeconds: paper.part2.speakSeconds,
      targetSeconds: 100,
    },
    ...paper.part3.questions.map((question): Step => ({ part: 3, question, maxSeconds: 70, targetSeconds: 35 })),
  ];
}

const PART_TITLE: Record<1 | 2 | 3, string> = {
  1: msg("Part 1 · About you"),
  2: msg("Part 2 · Your talk"),
  3: msg("Part 3 · Discussion"),
};

/** Reads the question aloud with the device's own voice, like an examiner (free, offline) */
function speakAloud(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* no voice available: the question is on screen anyway */
  }
}

// ============================================================
// Answering one question
// ============================================================

type Phase = "ready" | "prep" | "speaking";

const Runner: React.FC<{ steps: Step[]; onFinish: (answers: ExamAnswer[]) => void }> = ({ steps, onFinish }) => {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [prepLeft, setPrepLeft] = useState(step.prepSeconds ?? 0);
  const [notes, setNotes] = useState("");
  const [finals, setFinals] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const answers = useRef<ExamAnswer[]>([]);
  const startedAt = useRef(0);
  const prepDeadline = useRef(0);

  const { error: speechError } = useSpeechCaptions({
    active: phase === "speaking",
    lang: "en-GB",
    onText: (text, final) => {
      if (final) {
        setFinals((f) => [...f, text]);
        setInterim("");
      } else {
        setInterim(text);
      }
    },
  });

  const beginSpeaking = useCallback(() => {
    setFinals([]);
    setInterim("");
    setElapsed(0);
    startedAt.current = Date.now();
    setPhase("speaking");
  }, []);

  const finishAnswer = useCallback(() => {
    const seconds = (Date.now() - startedAt.current) / 1000;
    answers.current.push({
      part: step.part,
      question: step.question,
      transcript: [...finals, interim].join(" ").trim(),
      seconds,
    });
    if (index + 1 >= steps.length) {
      onFinish(answers.current);
      return;
    }
    const next = steps[index + 1];
    setIndex(index + 1);
    setPhase("ready");
    setElapsed(0);
    setPrepLeft(next.prepSeconds ?? 0);
    setNotes("");
    setFinals([]);
    setInterim("");
  }, [finals, interim, index, onFinish, step.part, step.question, steps]);

  // Always the latest finishAnswer, so the timer below never calls a stale one
  const finishRef = useRef(finishAnswer);
  useEffect(() => {
    finishRef.current = finishAnswer;
  });

  // Read each question aloud when it appears
  useEffect(() => {
    speakAloud(step.question);
    return () => window.speechSynthesis?.cancel();
  }, [step.question]);

  // Preparation countdown (Part 2): measured against a deadline, so a slow tab can't make the minute run long
  useEffect(() => {
    if (phase !== "prep") return;
    const t = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((prepDeadline.current - Date.now()) / 1000));
      setPrepLeft(left);
      if (left <= 0) {
        window.clearInterval(t);
        beginSpeaking();
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, beginSpeaking]);

  // The answer timer, which also stops the answer at its limit
  useEffect(() => {
    if (phase !== "speaking") return;
    const t = window.setInterval(() => {
      const s = (Date.now() - startedAt.current) / 1000;
      setElapsed(s);
      if (s >= step.maxSeconds) finishRef.current();
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, step.maxSeconds]);

  const live = [...finals, interim].join(" ").trim();
  const pct = Math.min(100, (elapsed / step.targetSeconds) * 100);
  const isLast = index + 1 >= steps.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Badge tone="indigo">{tr(PART_TITLE[step.part])}</Badge>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400" aria-label={tr("Question {n} of {total}", { n: index + 1, total: steps.length })}>
          {index + 1} / {steps.length}
        </p>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]" aria-hidden>
        <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-300" style={{ width: `${(index / steps.length) * 100}%` }} />
      </div>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-semibold leading-snug text-slate-900 dark:text-white sm:text-2xl">{step.question}</h2>
          <button
            type="button"
            onClick={() => speakAloud(step.question)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-900/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.08]"
            aria-label={tr("Hear the question again")}
            title={tr("Hear the question again")}
          >
            <Volume2 className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {step.points && (
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.04]">
            <p className="t-eyebrow text-slate-600 dark:text-slate-400">{tr("You should say")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
              {step.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {phase === "ready" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {step.part === 2
                ? tr("You get {seconds} seconds to prepare, then talk for up to {max} minutes.", {
                    seconds: step.prepSeconds ?? 60,
                    max: Math.round(step.maxSeconds / 60),
                  })
                : tr("Answer in about {seconds} seconds. Tap start when you are ready.", { seconds: step.targetSeconds })}
            </p>
            <Button size="lg" icon={step.part === 2 ? Timer : Mic} onClick={() => {
                if (step.part === 2) {
                  prepDeadline.current = Date.now() + (step.prepSeconds ?? 60) * 1000;
                  setPrepLeft(step.prepSeconds ?? 60);
                  setPhase("prep");
                } else {
                  beginSpeaking();
                }
              }}>
              {step.part === 2 ? tr("Start preparing") : tr("Start answering")}
            </Button>
          </div>
        )}

        {phase === "prep" && (
          <div className="space-y-3">
            <p className="text-center font-display text-4xl font-semibold tabular-nums text-slate-900 dark:text-white" role="timer" aria-live="off">
              {clock(prepLeft)}
            </p>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {tr("Your notes (only you see these)")}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-sm text-slate-900 dark:text-white"
                placeholder={tr("Jot down a few key words…")}
              />
            </label>
            <div className="text-center">
              <Button onClick={beginSpeaking} icon={Mic}>
                {tr("I'm ready, start speaking")}
              </Button>
            </div>
          </div>
        )}

        {phase === "speaking" && (
          <div className="space-y-3 text-center">
            <p className="font-display text-4xl font-semibold tabular-nums text-slate-900 dark:text-white" role="timer" aria-live="off">
              {clock(elapsed)}
            </p>
            <div className="mx-auto h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]" aria-hidden>
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${elapsed >= step.targetSeconds ? "bg-emerald-500" : "bg-indigo-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="min-h-[3rem] rounded-2xl bg-slate-50 p-3 text-left text-sm text-slate-700 dark:bg-white/[0.04] dark:text-slate-300" aria-live="polite">
              {live || <span className="text-slate-500">{tr("Listening… start speaking.")}</span>}
            </p>
            {speechError && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {tr(speechError)}
              </p>
            )}
            <Button size="lg" variant="danger" icon={Square} onClick={finishAnswer}>
              {isLast ? tr("Finish the test") : tr("Done, next question")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================
// The report
// ============================================================

type TipParams = Record<string, number | string>;

const TIP_TEXT: Record<TipCode, (p: TipParams) => string> = {
  answers_missing: (p) =>
    tr("{count} answers had almost no speech. Check your microphone, and try to say a few full sentences each time.", { count: p.count ?? 0 }),
  part2_longer: (p) =>
    tr("Your Part 2 talk was only {seconds} seconds. Aim for 1½ to 2 minutes: use every point on the card.", { seconds: p.seconds ?? 0 }),
  speak_longer: () => tr("Some answers were very short. Give a reason and an example, not just yes or no."),
  less_fillers: (p) =>
    tr("You used about {per100} filler words (um, like, you know) per 100 words. A short silence sounds better than a filler.", { per100: p.per100 ?? 0 }),
  pace_slow: (p) => tr("You spoke at about {wpm} words a minute, which is slow. Practise linking your ideas so they flow.", { wpm: p.wpm ?? 0 }),
  pace_fast: (p) => tr("You spoke at about {wpm} words a minute, which is fast. Slow down a little so every word is clear.", { wpm: p.wpm ?? 0 }),
  richer_words: () => tr("Try more varied words: replace 'good' and 'very' with stronger choices, and use a few topic phrases."),
  grammar_slips: (p) =>
    tr("About {per100} grammar slips per 100 words. Review them below, then practise the same sentences correctly.", { per100: p.per100 ?? 0 }),
  good_all_round: () => tr("Well done: no big weaknesses showed up. Try a harder topic or aim for longer, richer answers."),
};

const tipText = (code: TipCode, params: TipParams = {}): string => TIP_TEXT[code](params);

const Criterion: React.FC<{ label: string; band: number | null }> = ({ label, band }) => (
  <div>
    <div className="flex items-baseline justify-between text-sm">
      <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
      <span className="font-display font-semibold tabular-nums text-slate-900 dark:text-white">{band === null ? "–" : band.toFixed(1)}</span>
    </div>
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]" aria-hidden>
      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${band === null ? 0 : (band / 9) * 100}%` }} />
    </div>
  </div>
);

const Report: React.FC<{ report: ExamReport; history: ExamHistoryItem[]; onAgain: () => void; onSame: () => void }> = ({
  report,
  history,
  onAgain,
  onSame,
}) => (
  <div className="space-y-5">
    <Card className="text-center">
      <p className="t-eyebrow text-slate-600 dark:text-slate-400">{tr("Estimated band")}</p>
      <p className="font-display mt-1 text-6xl font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">{report.overall.toFixed(1)}</p>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        {tr("About level {cefr}", { cefr: report.cefr })} · {report.totals.words} {tr("words")}
        {report.totals.wpm !== null && ` · ${report.totals.wpm} ${tr("words a minute")}`}
      </p>
      <p className="mx-auto mt-3 max-w-md text-xs text-slate-600 dark:text-slate-400">
        {tr("This is a practice estimate from your speech, not an examiner's mark.")}
      </p>
    </Card>

    <Card className="space-y-4">
      <Criterion label={tr("Fluency")} band={report.criteria.fluency} />
      <Criterion label={tr("Vocabulary")} band={report.criteria.vocabulary} />
      <Criterion label={tr("Grammar")} band={report.criteria.grammar} />
      {!report.grammar.checked && (
        <p className="text-xs text-slate-600 dark:text-slate-400">{tr("Grammar wasn't checked this time (too little speech, or the checker was busy), so it isn't in your band.")}</p>
      )}
    </Card>

    <Card className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{tr("What to work on")}</h3>
      <ul className="space-y-2">
        {report.tips.map((t) => (
          <li key={t.code} className="flex gap-2 text-sm text-slate-800 dark:text-slate-200">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
            <span>{tipText(t.code, t.params)}</span>
          </li>
        ))}
      </ul>
      {report.grammar.examples.length > 0 && (
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
          <p className="t-eyebrow text-slate-600 dark:text-slate-400">{tr("Grammar to review")}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {report.grammar.examples.map((g, i) => (
              <li key={i} className="text-slate-800 dark:text-slate-200">
                <span className="font-semibold">“{g.text}”</span> {g.message}
                {g.suggestion && (
                  <>
                    {" "}→ <span className="font-semibold text-emerald-700 dark:text-emerald-300">{g.suggestion}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.grammar.checked && report.grammarViaPublicServer && (
        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          {tr("Grammar is checked by LanguageTool's free public server, so the text of your answers is sent there.")}
        </p>
      )}
    </Card>

    <Card className="space-y-2">
      <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{tr("Your answers")}</h3>
      <ul className="divide-y divide-line">
        {report.parts.map((p, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800 dark:text-slate-200">{p.question}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {tr(PART_TITLE[p.part])} · {p.words} {tr("words")} · {clock(p.seconds)}
                {p.tooShort && ` · ${tr("almost no speech")}`}
              </p>
            </div>
            <span className="font-display font-semibold tabular-nums text-slate-900 dark:text-white">{p.band.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </Card>

    {history.length > 1 && (
      <Card className="space-y-2">
        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{tr("Your last tests")}</h3>
        <div className="flex h-20 items-end gap-1.5" role="img" aria-label={tr("Bands of your last tests: {bands}", { bands: history.map((h) => h.overall.toFixed(1)).join(", ") })}>
          {history.map((h) => (
            <div key={h.at} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{h.overall.toFixed(1)}</span>
              <div className="w-full rounded-t-md bg-indigo-500/80" style={{ height: `${Math.max(8, (h.overall / 9) * 100)}%` }} />
            </div>
          ))}
        </div>
      </Card>
    )}

    <div className="flex flex-wrap justify-center gap-3">
      <Button icon={RotateCcw} onClick={onAgain}>
        {tr("Try a new test")}
      </Button>
      <Button variant="secondary" onClick={onSame}>
        {tr("Same questions again")}
      </Button>
    </div>
  </div>
);

// ============================================================
// The page
// ============================================================

type Stage = "intro" | "running" | "scoring" | "report";

export const SpeakingExamPage: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  const [fixedId, setFixedId] = useState<string | undefined>(undefined);
  const [stage, setStage] = useState<Stage>("intro");
  const [report, setReport] = useState<ExamReport | null>(null);
  const [history, setHistory] = useState<ExamHistoryItem[]>(() => readExamHistory());
  const paper = useExamPaper(attempt, fixedId);
  const score = useScoreExam();
  const supported = useMemo(() => speechCaptionsSupported(), []);
  const steps = useMemo(() => (paper.data ? buildSteps(paper.data) : []), [paper.data]);

  const finish = useCallback(
    async (answers: ExamAnswer[]) => {
      setStage("scoring");
      try {
        const result = await score.mutateAsync(answers);
        setReport(result);
        setHistory(saveExamResult(result));
        setStage("report");
      } catch (e) {
        const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(message || tr("Couldn't score your test. Please try again."));
        setStage("intro");
      }
    },
    [score],
  );

  const restart = (sameQuestions: boolean) => {
    setReport(null);
    setStage("intro");
    if (sameQuestions) setFixedId(paper.data?.id);
    else {
      setFixedId(undefined);
      setAttempt((a) => a + 1);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        icon={ClipboardCheck}
        title={tr("Speaking mock test")}
        subtitle={tr("Three parts like a real spoken exam. Get an estimated band for fluency, vocabulary and grammar, plus tips.")}
      />

      {stage === "intro" && (
        <Card className="space-y-4">
          {!supported && (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {tr("This browser can't turn speech into text. Open SpeakBetter in Chrome or Edge, or use the phone app, to take the test.")}
            </p>
          )}
          <ol className="space-y-2 text-sm text-slate-800 dark:text-slate-200">
            <li>
              <b>{tr(PART_TITLE[1])}</b>: {tr("three short questions, about 20 seconds each.")}
            </li>
            <li>
              <b>{tr(PART_TITLE[2])}</b>: {tr("one minute to prepare, then up to two minutes on a topic.")}
            </li>
            <li>
              <b>{tr(PART_TITLE[3])}</b>: {tr("three deeper questions on the same theme.")}
            </li>
          </ol>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {tr("Find a quiet place and allow the microphone. About 8 minutes. Nothing is recorded: only the words are kept to score them.")}
          </p>
          <div className="text-center">
            <Button size="lg" icon={Mic} disabled={!supported || !paper.data} loading={paper.isLoading} onClick={() => setStage("running")}>
              {tr("Begin the test")}
            </Button>
            {paper.isError && <p className="mt-2 text-sm text-red-600">{tr("Couldn't load the questions. Refresh to try again.")}</p>}
          </div>
          {history.length > 0 && (
            <p className="text-center text-xs text-slate-600 dark:text-slate-400">
              {tr("Your last result: band {band}", { band: history[history.length - 1].overall.toFixed(1) })}
            </p>
          )}
        </Card>
      )}

      {stage === "running" && steps.length > 0 && <Runner key={paper.data?.id} steps={steps} onFinish={(a) => void finish(a)} />}

      {stage === "scoring" && (
        <Card className="flex flex-col items-center gap-3 py-12 text-center" role="status">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" aria-hidden />
          <p className="text-sm text-slate-700 dark:text-slate-300">{tr("Scoring your test…")}</p>
        </Card>
      )}

      {stage === "report" && report && (
        <Report report={report} history={history} onAgain={() => restart(false)} onSame={() => restart(true)} />
      )}
    </div>
  );
};

export default SpeakingExamPage;
