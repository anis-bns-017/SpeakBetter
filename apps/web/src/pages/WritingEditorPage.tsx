// apps/web/src/pages/WritingEditorPage.tsx
/**
 * Writing one piece: the task with tips and phrases, an editor that saves as you type, and a check that
 * underlines grammar, spelling, punctuation and style issues with one-tap fixes. Finishing gives a score, XP
 * and review cards made from your own mistakes.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Layers,
  Lightbulb,
  Loader2,
  PartyPopper,
  PenLine,
  RotateCcw,
  Trash2,
  SpellCheck,
  X,
  Zap,
} from "lucide-react";
import {
  applySuggestion,
  countWords,
  useCheckWriting,
  useDeleteWriting,
  useFinishWriting,
  useSaveWriting,
  useStartWriting,
  useWritingPiece,
  type FinishResult,
  type IssueCounts,
  type IssueKind,
  type SpellingVariant,
  type WritingIssue,
  type WritingPiece,
} from "../hooks/useWriting";
import { ISSUE_STYLE, KIND } from "../components/writing/writingStyles";
import { tr } from "../i18n/core";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const KINDS: IssueKind[] = ["grammar", "spelling", "punctuation", "style"];

const countIssues = (issues: WritingIssue[]): IssueCounts => {
  const counts: IssueCounts = { grammar: 0, spelling: 0, punctuation: 0, style: 0 };
  for (const i of issues) counts[i.kind]++;
  return counts;
};

// ============================================================
// Small pieces
// ============================================================

const ScoreRing: React.FC<{ score: number | null; size?: number }> = ({ score, size = 76 }) => {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const color = score === null ? "#94a3b8" : score >= 90 ? "#10b981" : score >= 70 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          style={{ stroke: color, strokeDasharray: c, strokeDashoffset: c * (1 - (score ?? 0) / 100), transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums text-slate-900 dark:text-white leading-none">{score ?? "–"}</span>
        <span className="text-[11px] text-slate-400 mt-0.5">{tr("score")}</span>
      </span>
    </div>
  );
};

/** Words against the task's range: amber below, green inside, rose above */
const WordMeter: React.FC<{ words: number; min?: number; max?: number }> = ({ words, min, max }) => {
  if (!min || !max) return <span className="text-xs text-slate-500 tabular-nums">{words} {" "}{tr("words")}</span>;
  const pct = Math.min(100, (words / max) * 100);
  const tone = words < min ? "bg-amber-500" : words > max ? "bg-rose-500" : "bg-emerald-500";
  const hint = words < min ? `${min - words} more to go` : words > max ? `${words - max} over` : "In range";
  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <div className="relative h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
        <div className={`absolute inset-y-0 left-0 rounded-full ${tone} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 w-px bg-slate-400/60" style={{ left: `${(min / max) * 100}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
        {words} · {tr(hint)}
      </span>
    </div>
  );
};

/** The text with each issue underlined in its colour; tap one to open it */
const MarkedText: React.FC<{ text: string; issues: WritingIssue[]; selected: string | null; onSelect: (id: string) => void }> = ({
  text,
  issues,
  selected,
  onSelect,
}) => {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const issue of issues) {
    if (issue.offset < at) continue;
    if (issue.offset > at) parts.push(text.slice(at, issue.offset));
    const style = ISSUE_STYLE[issue.kind];
    const shown = text.slice(issue.offset, issue.offset + issue.length) || " ";
    parts.push(
      <button
        key={issue.id}
        type="button"
        data-issue={issue.id}
        onClick={() => onSelect(issue.id)}
        className={`rounded-[3px] underline decoration-2 underline-offset-4 decoration-wavy px-px transition-colors ${style.underline} ${
          selected === issue.id ? "ring-2 ring-indigo-400/70" : ""
        }`}
      >
        {shown}
      </button>,
    );
    at = issue.offset + issue.length;
  }
  parts.push(text.slice(at));
  return <div className="whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-800 dark:text-slate-100">{parts}</div>;
};

const IssueCard: React.FC<{
  issue: WritingIssue;
  active: boolean;
  readOnly: boolean;
  onOpen: () => void;
  onApply: (value: string) => void;
  onIgnore: () => void;
}> = ({ issue, active, readOnly, onOpen, onApply, onIgnore }) => {
  const style = ISSUE_STYLE[issue.kind];
  return (
    <li
      className={`rounded-2xl border p-3 transition-colors ${
        active ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-500/40 dark:bg-indigo-500/10" : "border-slate-200/80 dark:border-white/[0.07]"
      }`}
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr(style.label)}</span>
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="line-through decoration-rose-400/70 text-slate-500 dark:text-slate-400">{tr(issue.text) || tr("(space)")}</span>
          {issue.replacements[0] !== undefined && (
            <>
              <span className="text-slate-300 dark:text-slate-600">→</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{issue.replacements[0] || tr("(remove)")}</span>
            </>
          )}
        </span>
        <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300 leading-snug">{issue.message}</span>
      </button>
      {active && !readOnly && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {issue.replacements.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onApply(r)}
              className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> {" "}{tr("Use “{value}”", { value: r || tr("remove") })}</button>
          ))}
          <button
            type="button"
            onClick={onIgnore}
            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> {" "}{tr("Ignore")}</button>
        </div>
      )}
    </li>
  );
};

// ============================================================
// Editor
// ============================================================

const Editor: React.FC<{ piece: WritingPiece }> = ({ piece }) => {
  const navigate = useNavigate();
  const save = useSaveWriting(piece.id);
  const check = useCheckWriting(piece.id);
  const finish = useFinishWriting(piece.id);
  const startAgain = useStartWriting();
  const remove = useDeleteWriting();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [text, setText] = useState(piece.text);
  const [variant, setVariant] = useState<SpellingVariant>(piece.variant);
  const [mode, setMode] = useState<"write" | "review">(piece.finished ? "review" : "write");
  const [issues, setIssues] = useState<WritingIssue[] | null>(piece.finished ? piece.issues : null);
  const [score, setScore] = useState<number | null>(piece.score);
  // True once a fix is applied after a check: the score no longer matches the text
  const [scoreStale, setScoreStale] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [result, setResult] = useState<FinishResult | null>(null);
  const [showTask, setShowTask] = useState(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const lastSaved = useRef(piece.text);

  const words = useMemo(() => countWords(text), [text]);
  const readOnly = piece.finished || !!result;
  const prompt = piece.prompt;

  // Save a moment after typing stops
  useEffect(() => {
    if (readOnly || text === lastSaved.current) return;
    const id = setTimeout(() => {
      lastSaved.current = text;
      setSaved("saving");
      save.mutate({ text, variant }, { onSuccess: () => setSaved("saved"), onError: () => setSaved("idle") });
    }, 1200);
    return () => clearTimeout(id);
  }, [text, variant, readOnly, save]);

  const runCheck = () => {
    if (!words) return toast.info(tr("Write something first."));
    check.mutate(
      { text, variant },
      {
        onSuccess: (r) => {
          lastSaved.current = text;
          setIssues(r.issues);
          setScore(r.score);
          setScoreStale(false);
          setSelected(r.issues[0]?.id ?? null);
          setMode("review");
          if (!r.issues.length) toast.success(tr("No problems found. Nice writing!"), { icon: "✨" });
        },
        onError: (e) => toast.error(errorText(e, "Couldn't check your writing. Try again.")),
      },
    );
  };

  const done = () =>
    finish.mutate(
      { text, variant },
      {
        onSuccess: (r) => {
          setResult(r);
          setIssues(r.issues);
          setScore(r.score);
          setMode("review");
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        onError: (e) => toast.error(errorText(e, "Couldn't finish. Try again.")),
      },
    );

  const apply = (issue: WritingIssue, value: string) => {
    if (!issues) return;
    const next = applySuggestion(text, issues, issue, value);
    setText(next.text);
    setIssues(next.issues);
    setScoreStale(true);
    setSelected(next.issues.find((i) => i.offset >= issue.offset)?.id ?? next.issues[0]?.id ?? null);
  };

  const ignore = (issue: WritingIssue) => {
    if (!issues) return;
    const rest = issues.filter((i) => i.id !== issue.id);
    setIssues(rest);
    setSelected(rest.find((i) => i.offset >= issue.offset)?.id ?? rest[0]?.id ?? null);
  };

  const insertPhrase = (phrase: string) => {
    const el = textarea.current;
    const clean = phrase.replace(/…/g, "").trim();
    if (!el || mode !== "write") {
      setMode("write");
      setText((t) => `${t}${t && !/\s$/.test(t) ? " " : ""}${clean} `);
      return;
    }
    const startAt = el.selectionStart;
    const before = text.slice(0, startAt);
    const insert = `${before && !/\s$/.test(before) ? " " : ""}${clean} `;
    const next = before + insert + text.slice(el.selectionEnd);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = startAt + insert.length;
    });
  };

  const openIssue = (id: string) => {
    setSelected(id);
    document.querySelector(`[data-issue="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const counts = issues ? countIssues(issues) : null;
  const kind = prompt ? KIND[prompt.kind] : null;
  const KindIcon = kind?.icon ?? PenLine;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/writing" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
          <ArrowLeft className="w-4 h-4" /> {" "}{tr("Writing studio")}</Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{tr(piece.title)}</h1>
        {kind && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${kind.tone}`}>
            <KindIcon className="w-3 h-3" /> {tr(kind.label)} · {piece.level}
          </span>
        )}
        {!readOnly && (
          <span className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400">{saved === "saving" ? tr("Saving…") : saved === "saved" ? tr("Saved") : ""}</span>
            <button
              type="button"
              onClick={() =>
                confirmDelete
                  ? remove.mutate(piece.id, { onSuccess: () => navigate("/writing"), onError: () => toast.error(tr("Couldn't delete the draft.")) })
                  : setConfirmDelete(true)
              }
              onBlur={() => setConfirmDelete(false)}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                confirmDelete ? "bg-rose-500 text-white" : "text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:bg-rose-500/10"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" /> {confirmDelete ? tr("Click again to delete") : tr("Delete draft")}
            </button>
          </span>
        )}
      </div>

      {result && (
        <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-md shadow-emerald-500/15 flex flex-wrap items-center gap-5">
          <PartyPopper className="w-10 h-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{tr("Finished!")}{" "}{result.score !== null ? tr("You scored {score}.", { score: result.score }) : ""}</h2>
            <p className="text-sm text-white/85 mt-1">
              {result.wordCount} {" "}{tr("words{value}{value2}", { value: result.xp ? ` · +${result.xp} XP` : tr(" · XP is for your first two pieces each day"), value2: result.cardsAdded ? ` · ${result.cardsAdded} of your mistakes added to your review cards` : "" })}{!result.checked ? tr(" · the checker was busy, so this piece has no score") : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {result.cardsAdded > 0 && (
              <Link to="/flashcards" className="h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold inline-flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> {" "}{tr("Review them")}</Link>
            )}
            <Link to="/writing" className="h-10 px-4 rounded-xl bg-white text-emerald-700 text-sm font-semibold inline-flex items-center gap-1.5">
              <PenLine className="w-4 h-4" /> {" "}{tr("Write another")}</Link>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-4">
          {prompt && (
            <section className={`${card} p-5`}>
              <button type="button" onClick={() => setShowTask((v) => !v)} className="w-full flex items-start justify-between gap-3 text-left">
                <span className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{prompt.task}</span>
                <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-slate-400 transition-transform ${showTask ? "rotate-180" : ""}`} />
              </button>
              {showTask && (
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> {" "}{tr("Tips")}</p>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                      {prompt.tips.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{tr("Useful phrases")}{readOnly ? "" : tr(" · tap to add")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {prompt.phrases.map((ph) => (
                        <button
                          key={ph}
                          type="button"
                          disabled={readOnly}
                          onClick={() => insertPhrase(ph)}
                          className="rounded-lg bg-slate-100 dark:bg-white/[0.06] px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-200 disabled:hover:bg-slate-100 disabled:cursor-default"
                        >
                          {ph}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className={`${card} p-5`}>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <WordMeter words={words} min={prompt?.minWords} max={prompt?.maxWords} />
              <div className="ml-auto flex items-center gap-2">
                <div role="radiogroup" aria-label={tr("Spelling")} className="flex rounded-lg bg-slate-100 dark:bg-white/[0.06] p-0.5 text-[11px] font-semibold">
                  {(["en-GB", "en-US"] as SpellingVariant[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={variant === v}
                      disabled={readOnly}
                      onClick={() => setVariant(v)}
                      title={v === "en-GB" ? tr("British spelling: colour, practise") : tr("American spelling: color, practice")}
                      className={`h-7 px-2.5 rounded-md transition-colors ${
                        variant === v ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {v === "en-GB" ? "UK" : "US"}
                    </button>
                  ))}
                </div>
                {mode === "review" && !readOnly && (
                  <button
                    type="button"
                    onClick={() => setMode("write")}
                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] inline-flex items-center gap-1"
                  >
                    <PenLine className="w-3.5 h-3.5" /> {" "}{tr("Edit text")}</button>
                )}
              </div>
            </div>

            {mode === "write" && !readOnly ? (
              <textarea
                ref={textarea}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (issues) setIssues(null);
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    runCheck();
                  }
                }}
                placeholder={prompt ? tr("Start writing here…") : tr("Write about anything: your day, a message you need to send, your homework…")}
                spellCheck={false}
                autoFocus
                maxLength={4000}
                className="w-full min-h-[320px] resize-y rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] p-4 text-[15px] leading-8 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 dark:focus:border-indigo-500/40"
              />
            ) : (
              <div className="min-h-[200px] rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                {text ? (
                  <MarkedText text={text} issues={issues ?? []} selected={selected} onSelect={openIssue} />
                ) : (
                  <p className="text-sm text-slate-400">{tr("Nothing written.")}</p>
                )}
              </div>
            )}

            {!readOnly && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={runCheck}
                  disabled={check.isPending || !words}
                  className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  {check.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SpellCheck className="w-4 h-4" />}
                  {issues ? tr("Check again") : tr("Check my writing")}
                </button>
                <button
                  type="button"
                  onClick={done}
                  disabled={finish.isPending || words < 10}
                  title={words < 10 ? tr("Write at least 10 words to finish") : undefined}
                  className="h-11 px-5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {finish.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {tr("Finish")}</button>
                <span className="text-[11px] text-slate-400 hidden sm:inline">{tr("Ctrl + Enter to check")}</span>
              </div>
            )}
            {readOnly && prompt && (
              <button
                type="button"
                onClick={() =>
                  startAgain.mutate(prompt.id, {
                    onSuccess: (p) => navigate(`/writing/${p.id}`),
                    onError: () => toast.error(tr("Couldn't start again. Try once more.")),
                  })
                }
                className="mt-4 h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> {" "}{tr("Write it again")}</button>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className={`${card} p-5`}>
            <div className="flex items-center gap-4">
              <div className={scoreStale ? "opacity-50" : ""}>
                <ScoreRing score={issues ? score : readOnly ? piece.score : null} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {issues === null
                    ? readOnly
                      ? tr("Finished")
                      : tr("Not checked yet")
                    : issues.length === 0
                      ? scoreStale
                        ? tr("All fixed")
                        : tr("Looks great")
                      : tr("{issues} thing{value} to look at", { issues: issues.length, value: issues.length === 1 ? "" : "s" })}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {issues === null && !readOnly
                    ? tr("Check when you are ready; nothing is marked until you do.")
                    : scoreStale
                      ? tr("You made fixes. Check again to update your score.")
                      : tr("Tap an underlined word to see why.")}
                </p>
              </div>
            </div>
            {counts && (
              <div className="mt-4 grid grid-cols-2 gap-1.5">
                {KINDS.map((k) => (
                  <span key={k} className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center justify-between ${ISSUE_STYLE[k].chip}`}>
                    {tr(ISSUE_STYLE[k].label)} <span className="tabular-nums">{counts[k]}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {issues && issues.length > 0 && (
            <section className={`${card} p-3`}>
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    active={selected === issue.id}
                    readOnly={readOnly}
                    onOpen={() => openIssue(issue.id)}
                    onApply={(value) => apply(issue, value)}
                    onIgnore={() => ignore(issue)}
                  />
                ))}
              </ul>
            </section>
          )}

          {!readOnly && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1 flex gap-1.5">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              {tr("Finishing gives XP and turns the mistakes from your first check into review cards, so you practise exactly what you got wrong.")}</p>
          )}
          {piece.checker.publicServer && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">{tr("Checks use LanguageTool's free online service, so your text is sent to their servers to be checked.")}</p>
          )}
        </aside>
      </div>
    </div>
  );
};

export const WritingEditorPage: React.FC = () => {
  const { pieceId } = useParams();
  const { data, isLoading, isError } = useWritingPiece(pieceId);
  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center`}>
        <p className="text-sm text-slate-500">{tr("This piece of writing could not be found.")}</p>
        <Link to="/writing" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
          <ArrowLeft className="w-4 h-4" /> {" "}{tr("Writing studio")}</Link>
      </div>
    );
  }
  return <Editor key={data.id} piece={data} />;
};

export default WritingEditorPage;
