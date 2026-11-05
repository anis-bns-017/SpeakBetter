// apps/web/src/pages/PacksPage.tsx
/**
 * Vocabulary packs: themed sets of 12 words for each level. Learn the words, save them to your flashcard
 * review, then take a short quiz.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Layers, Loader2, Package, Sparkles } from "lucide-react";
import { usePacks, type PackLevel } from "../hooks/useVocabPacks";
import { packIcon, topicTone } from "../components/packs/packIcons";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const PacksPage: React.FC = () => {
  const { data, isLoading, isError } = usePacks();
  const [picked, setPicked] = useState<PackLevel | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>Couldn't load the word packs. Refresh to try again.</div>;
  }

  const level = picked ?? data.level;
  const packs = data.packs.filter((p) => p.level === level);
  const next = data.recommended ? data.packs.find((p) => p.id === data.recommended) : null;
  const NextIcon = next ? packIcon(next.icon) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
          <Package className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Word packs</h1>
          <p className="text-sm text-slate-500">Themed sets of words. Learn them, save them, then test yourself.</p>
        </div>
        <div className="text-right text-xs text-slate-500 tabular-nums shrink-0">
          <p>{data.done} of {data.packs.length} passed</p>
          <p>{data.wordsSaved} words saved</p>
        </div>
      </header>

      {next && NextIcon && (
        <Link
          to={`/packs/${next.id}`}
          className="block rounded-3xl p-5 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-transform"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Start here · {next.level}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <NextIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">{next.title}</h2>
                <p className="text-sm text-white/85 line-clamp-1">{next.summary}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 shrink-0 h-10 px-4 rounded-full bg-white text-orange-600 text-sm font-semibold">
              Open <ArrowRight className="w-4 h-4" />
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
        {packs.map((p) => {
          const Icon = packIcon(p.icon);
          return (
            <Link key={p.id} to={`/packs/${p.id}`} className={`${card} p-5 hover:-translate-y-0.5 hover:shadow-md transition-all block`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${topicTone(p.topic)}`}>
                  <Icon className="w-3.5 h-3.5" /> {p.topic}
                </span>
                {p.done ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {p.bestScore}/{p.total}
                  </span>
                ) : p.bestScore !== null ? (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Best {p.bestScore}/{p.total}</span>
                ) : (
                  <span className="text-[11px] text-slate-400">{p.words} words</span>
                )}
              </div>
              <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{p.title}</h2>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{p.summary}</p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                <Layers className="w-3.5 h-3.5" />
                <span>{p.saved} of {p.words} saved to review</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${(p.saved / p.words) * 100}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default PacksPage;
