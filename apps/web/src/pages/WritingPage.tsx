// apps/web/src/pages/WritingPage.tsx
/**
 * The Writing studio: today's task for your level, every task by level, free writing, and what you wrote.
 * Each piece is checked for grammar, spelling, punctuation and style, and your mistakes become review cards.
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, PenLine, Sparkles } from "lucide-react";
import { useStartWriting, useWritingOverview, type WritingLevel } from "../hooks/useWriting";
import { KIND, scoreTone } from "../components/writing/writingStyles";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

const LEVELS: WritingLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export const WritingPage: React.FC = () => {
  const { data, isLoading, isError } = useWritingOverview();
  const start = useStartWriting();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<WritingLevel | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>Couldn't load the Writing studio. Refresh to try again.</div>;
  }

  const level = picked ?? data.level;
  const prompts = data.prompts.filter((p) => p.level === level);
  const today = data.prompts.find((p) => p.id === data.today[level]) ?? prompts[0];
  const drafts = new Map(data.recent.filter((r) => !r.finished).map((r) => [r.promptId, r.id]));

  const open = (promptId: string) => {
    const draft = drafts.get(promptId);
    if (draft) return navigate(`/writing/${draft}`);
    start.mutate(promptId, {
      onSuccess: (piece) => navigate(`/writing/${piece.id}`),
      onError: () => toast.error("Couldn't start that task. Try again."),
    });
  };

  const TodayIcon = today ? KIND[today.kind].icon : PenLine;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
          <PenLine className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Writing studio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Real tasks at your level, checked for grammar, spelling, punctuation and style.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1.5 text-slate-600 dark:text-slate-300 tabular-nums">
            <span className="font-semibold">{data.stats.pieces}</span> pieces
          </span>
          <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1.5 text-slate-600 dark:text-slate-300 tabular-nums">
            <span className="font-semibold">{data.stats.words.toLocaleString()}</span> words
          </span>
          {data.stats.averageScore !== null && (
            <span className={`rounded-full px-3 py-1.5 tabular-nums font-semibold ${scoreTone(data.stats.averageScore)}`}>avg {data.stats.averageScore}</span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Level">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={level === l}
            onClick={() => setPicked(l)}
            className={`h-9 px-3.5 rounded-full text-xs font-semibold border transition-colors ${
              level === l
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
            }`}
          >
            {l}
            {l === data.level && <span className="opacity-70"> · you</span>}
          </button>
        ))}
      </div>

      {today && (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 sm:p-7 text-white shadow-lg shadow-indigo-500/20">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Today's task · {level}</p>
          <div className="mt-3 flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <TodayIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{today.title}</h2>
              <p className="mt-1 text-sm text-white/85 max-w-2xl">{today.task}</p>
              <p className="mt-2 text-xs text-white/70">
                {KIND[today.kind].label} · {today.minWords}–{today.maxWords} words
                {today.done && today.bestScore !== null ? ` · your best ${today.bestScore}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => open(today.id)}
            disabled={start.isPending}
            className="mt-5 h-11 px-5 rounded-xl bg-white text-indigo-700 text-sm font-semibold inline-flex items-center gap-2 hover:bg-indigo-50 disabled:opacity-70"
          >
            {start.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
            {drafts.has(today.id) ? "Continue your draft" : today.done ? "Write it again" : "Start writing"}
          </button>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">All {level} tasks</h2>
          <span className="text-xs text-slate-400">
            {prompts.filter((p) => p.done).length} of {prompts.length} done
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prompts.map((p) => {
            const kind = KIND[p.kind];
            const Icon = kind.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p.id)}
                className={`${card} p-5 text-left hover:-translate-y-0.5 hover:shadow-md transition-all`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${kind.tone}`}>
                    <Icon className="w-3 h-3" /> {kind.label}
                  </span>
                  {p.done ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {p.bestScore ?? "Done"}
                    </span>
                  ) : drafts.has(p.id) ? (
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Draft</span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      {p.minWords}–{p.maxWords} words
                    </span>
                  )}
                </span>
                <span className="mt-3 block text-base font-bold text-slate-900 dark:text-white">{p.title}</span>
                <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{p.task}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => open("free")}
            className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 p-5 text-left hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors"
          >
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Sparkles className="w-3 h-3" /> Free writing
            </span>
            <span className="mt-3 block text-base font-bold text-slate-900 dark:text-white">Write about anything</span>
            <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">A diary entry, a message you need to send, homework. Any length.</span>
          </button>
        </div>
      </section>

      {data.recent.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Your writing</h2>
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {data.recent.map((r) => (
              <li key={r.id}>
                <Link to={`/writing/${r.id}`} className="flex items-center gap-3 py-3 group">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{r.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {r.level} · {r.wordCount} words · {new Date(r.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  {r.finished ? (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${scoreTone(r.score)}`}>{r.score ?? "Done"}</span>
                  ) : (
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">Draft</span>
                  )}
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.checker.publicServer && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
          Checks use LanguageTool's free online service, so your text is sent to their servers to be checked.
        </p>
      )}
    </div>
  );
};

export default WritingPage;
