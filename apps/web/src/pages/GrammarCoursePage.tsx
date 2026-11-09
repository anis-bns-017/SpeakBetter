// apps/web/src/pages/GrammarCoursePage.tsx
/**
 * The grammar course: short lessons for each level, with the rule explained and six exercises. Wrong
 * answers come back later as flashcards.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { useGrammarLessons, type GrammarLevel } from "../hooks/useGrammar";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

export const GrammarCoursePage: React.FC = () => {
  const { data, isLoading, isError } = useGrammarLessons();
  const [picked, setPicked] = useState<GrammarLevel | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>Couldn't load the grammar lessons. Refresh to try again.</div>;
  }

  const level = picked ?? data.level;
  const lessons = data.lessons.filter((l) => l.level === level);
  const recommended = data.recommended ? data.lessons.find((l) => l.id === data.recommended!.id) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">Grammar</h1>
          <p className="text-sm text-slate-500">Learn the rule, then practise it. Mistakes come back later as flashcards.</p>
        </div>
        <span className="text-xs text-slate-500 tabular-nums shrink-0">{data.done} of {data.lessons.length} passed</span>
      </header>

      {recommended && (
        <Link
          to={`/grammar/${recommended.id}`}
          className="block rounded-3xl p-5 bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-500/15 hover:-translate-y-0.5 transition-transform"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> {data.recommended!.reason}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{recommended.title}</h2>
              <p className="text-sm text-white/80 line-clamp-1">{recommended.summary}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 shrink-0 h-10 px-4 rounded-full bg-white text-indigo-700 text-sm font-semibold">
              {recommended.tried ? "Try again" : "Start"} <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </Link>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Level">
        {data.levels.map((l) => (
          <button
            key={l.level}
            type="button"
            role="tab"
            aria-selected={level === l.level}
            onClick={() => setPicked(l.level)}
            className={`h-9 px-3.5 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
              level === l.level
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
            }`}
          >
            {l.level}
            {l.level === data.level && <span className="opacity-70">· you</span>}
            <span className={`tabular-nums ${level === l.level ? "opacity-80" : "text-slate-400"}`}>
              {l.done}/{l.total}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {lessons.map((l) => (
          <Link key={l.id} to={`/grammar/${l.id}`} className={`${card} p-5 hover:-translate-y-0.5 hover:shadow-md transition-all block`}>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-300">{l.level}</span>
              {l.done ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {l.bestScore}/{l.exercises}
                </span>
              ) : l.tried ? (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Best {l.bestScore}/{l.exercises}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">{l.exercises} exercises</span>
              )}
            </div>
            <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{l.title}</h2>
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">{l.summary}</p>
            {l.patternLabel && <p className="mt-3 text-[11px] text-slate-400">Fixes: {l.patternLabel.toLowerCase()}</p>}
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400">
        Looking for a rule list? <Link to="/grammar/rules" className="underline hover:text-slate-600 dark:hover:text-slate-200">Rule reference</Link>
      </p>
    </div>
  );
};

export default GrammarCoursePage;
