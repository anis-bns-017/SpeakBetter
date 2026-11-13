// apps/web/src/pages/PacksPage.tsx
/**
 * Word packs by category: everyday English, exam preparation (IELTS, TOEFL, GRE, SAT, Cambridge), academic
 * writing, business English and advanced expressions. Each pack has its words in context with pronunciation,
 * examples, synonyms and word family, a quiz, and saves to flashcard review.
 */

import React, { createElement, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Layers, Loader2, Package, Search, Sparkles, X } from "lucide-react";
import { usePacks, type PackCategory, type PackItem, type PackLevel } from "../hooks/useVocabPacks";
import { categoryTone, packIcon, topicTone } from "../components/packs/packIcons";
import { PageHeader } from "../components/ui";
import { tr } from "../i18n/core";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";
const chip = (active: boolean) =>
  `h-9 px-3.5 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 shrink-0 ${
    active
      ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:text-white dark:border-indigo-500"
      : "border-line bg-surface text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.08]"
  }`;

const PAGE = 24;

const PackCard: React.FC<{ p: PackItem }> = ({ p }) => {
  const Icon = packIcon(p.icon);
  const tone = p.category === "everyday" ? topicTone(p.topic) : categoryTone(p.category);
  return (
    <Link to={`/packs/${p.id}`} className={`${card} p-5 hover:-translate-y-0.5 hover:shadow-md transition-all block`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
          {createElement(Icon, { className: "w-3.5 h-3.5", "aria-hidden": true })} {p.level}
        </span>
        {p.done ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> {p.bestScore}/{p.total}
          </span>
        ) : p.bestScore !== null ? (
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{tr("Best {bestScore}/", { bestScore: p.bestScore })}{p.total}</span>
        ) : (
          <span className="text-[11px] text-slate-400">{p.words} {" "}{tr("words")}</span>
        )}
      </div>
      <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{tr(p.title)}</h3>
      <p className="mt-1 text-sm text-slate-500 line-clamp-2">{tr(p.summary)}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
        <Layers className="w-3.5 h-3.5" />
        <span>{p.saved} {" "}{tr("of {words} saved to review", { words: p.words })}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" aria-hidden>
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${(p.saved / p.words) * 100}%` }} />
      </div>
    </Link>
  );
};

export const PacksPage: React.FC = () => {
  const { data, isLoading, isError } = usePacks();
  const [category, setCategory] = useState<PackCategory | null>(null);
  const [level, setLevel] = useState<PackLevel | null>(null);
  const [query, setQuery] = useState("");
  // A category can hold over a hundred packs, so they are shown a page at a time
  const [visible, setVisible] = useState(PAGE);

  const searching = query.trim().length > 0;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || !q) return [];
    return data.packs.filter((p) => `${p.title} ${p.summary} ${p.topic}`.toLowerCase().includes(q));
  }, [data, query]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>{tr("Couldn't load the word packs. Refresh to try again.")}</div>;
  }

  const current = category ? data.categories.find((c) => c.id === category) ?? null : null;
  const inCategory = category ? data.packs.filter((p) => p.category === category) : [];
  const levelsHere = [...new Set(inCategory.map((p) => p.level))];
  const shown = level ? inCategory.filter((p) => p.level === level) : inCategory;
  const next = data.recommended ? data.packs.find((p) => p.id === data.recommended) : null;
  const NextIcon = next ? packIcon(next.icon) : null;
  const totalWords = data.categories.reduce((n, c) => n + c.words, 0);

  const pickCategory = (id: PackCategory | null) => {
    setCategory(id);
    setLevel(null);
    setQuery("");
    setVisible(PAGE);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <PageHeader
        icon={Package}
        tone="amber"
        eyebrow={tr("Learn")}
        title={tr("Word packs")}
        subtitle={tr("From everyday words to GRE, IELTS, TOEFL, SAT, academic and business English: thousands of words in sections, each with pronunciation, meaning, examples and related words.")}
        actions={
          <div className="hidden text-right text-sm tabular-nums text-slate-600 sm:block dark:text-slate-400">
            <p>
              <span className="font-display text-lg font-semibold text-slate-900 dark:text-white">{data.done}</span> {" "}{tr("of {length} packs passed", { length: data.packs.length })}</p>
            <p>
              <span className="font-display text-lg font-semibold text-slate-900 dark:text-white">{data.wordsSaved.toLocaleString()}</span> {" "}{tr("of {totalWords} words saved", { totalWords: totalWords.toLocaleString() })}</p>
          </div>
        }
      />

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Search packs: environment, finance, idioms, psychology…")}
          aria-label={tr("Search packs")}
          className="w-full h-11 pl-10 pr-10 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
        />
        {searching && (
          <button type="button" onClick={() => setQuery("")} aria-label={tr("Clear search")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label={tr("Category")}>
        <button type="button" role="tab" aria-selected={category === null && !searching} onClick={() => pickCategory(null)} className={chip(category === null && !searching)}>
          {tr("All categories")}</button>
        {data.categories.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} onClick={() => pickCategory(c.id)} className={chip(category === c.id)}>
            {tr(c.label)}
            <span className={`tabular-nums ${category === c.id ? "opacity-80" : "text-slate-400"}`}>
              {c.done}/{c.total}
            </span>
          </button>
        ))}
      </div>

      {searching ? (
        <section className="space-y-3">
          <p className="text-sm text-slate-500">
            {matches.length ? tr("{matches} {value} match \"{query}\"", { matches: matches.length, value: matches.length === 1 ? "pack" : "packs", query: query.trim() }) : tr("No packs match \"{query}\"", { query: query.trim() })}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map((p) => (
              <PackCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      ) : current ? (
        <section className="space-y-4">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => pickCategory(null)} aria-label={tr("All categories")} className="mt-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tr(current.label)}</h2>
              <p className="text-sm text-slate-500">{tr(current.description)}</p>
              <p className="mt-1 text-xs text-slate-400">
                {current.total} {" "}{tr("packs · {words} words · {done} passed", { words: current.words, done: current.done })}</p>
            </div>
          </div>
          {levelsHere.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr("Level")}>
              <button type="button" role="tab" aria-selected={level === null} onClick={() => { setLevel(null); setVisible(PAGE); }} className={chip(level === null)}>
                {tr("All levels")}</button>
              {levelsHere.map((lv) => (
                <button key={lv} type="button" role="tab" aria-selected={level === lv} onClick={() => { setLevel(lv); setVisible(PAGE); }} className={chip(level === lv)}>
                  {lv}
                  {lv === data.level && <span className="opacity-70">{tr("· you")}</span>}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shown.slice(0, visible).map((p) => (
              <PackCard key={p.id} p={p} />
            ))}
          </div>
          {(current.id === "phrasal" || current.id === "idioms") && (
            <p className="text-[11px] text-slate-400 text-center">
              {tr("Meanings and examples from")}{" "}
              <a href="https://en.wiktionary.org/" target="_blank" rel="noreferrer" className="underline">
                {tr("Wiktionary")}</a>{" "}
              (CC BY-SA).
            </p>
          )}
          {shown.length > visible && (
            <div className="flex flex-col items-center gap-1 pt-1">
              <p className="text-xs text-slate-400">
                {tr("Showing {visible} of {length} packs", { visible, length: shown.length })}</p>
              <button type="button" onClick={() => setVisible((n) => n + PAGE)} className={chip(false)}>
                {tr("Show {value} more", { value: Math.min(PAGE, shown.length - visible) })}</button>
            </div>
          )}
        </section>
      ) : (
        <>
          {next && NextIcon && (
            <Link
              to={`/packs/${next.id}`}
              className="block rounded-3xl p-5 bg-indigo-900 ring-1 ring-inset ring-white/10 text-white shadow-md hover:bg-indigo-800 transition-colors"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> {" "}{tr("Start here ·")}{" "}{next.level}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    {createElement(NextIcon, { className: "w-5 h-5", "aria-hidden": true })}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold">{tr(next.title)}</h2>
                    <p className="text-sm text-white/85 line-clamp-1">{tr(next.summary)}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 shrink-0 h-10 px-4 rounded-full bg-white text-orange-600 text-sm font-semibold">
                  {tr("Open")}{" "}<ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.categories.map((c) => {
              const Icon = packIcon(c.icon);
              return (
                <button key={c.id} type="button" onClick={() => pickCategory(c.id)} className={`${card} p-5 text-left hover:-translate-y-0.5 hover:shadow-md transition-all`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${categoryTone(c.id)}`}>
                      {createElement(Icon, { className: "w-5 h-5", "aria-hidden": true })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">{tr(c.label)}</h2>
                      <p className="text-xs text-slate-400">
                        {c.total} {" "}{tr("packs · {words} words", { words: c.words })}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                  <p className="mt-3 text-sm text-slate-500 line-clamp-2">{tr(c.description)}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" aria-label={tr("{done} of {total} packs passed", { done: c.done, total: c.total })}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default PacksPage;
