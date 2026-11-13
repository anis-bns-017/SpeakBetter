// apps/web/src/pages/DictionaryPage.tsx
/**
 * Dictionary: 13,000 English words, the 10,000 most common and then 3,000 advanced C1/C2 words, each with its CEFR level, pronunciation, meanings,
 * examples, forms and family. Three tabs: Browse (search and filter), Word map (what you know of the 13,000) and
 * Size test (how many words you know).
 */

import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BookA,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Grid3x3,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Volume2,
} from "lucide-react";
import {
  DICT_LEVELS,
  dictError,
  useDictionaryList,
  useDictionaryOverview,
  useSaveDictWord,
  type DictCard,
  type DictLevel,
  type DictStatus,
} from "../hooks/useDictionary";
import { canSpeak, speak } from "../lib/speech";
import { LEVEL_STYLE, POS_SHORT, STATUS_LABEL, card, chip, input, select } from "../components/dictionary/dictStyles";
import { WordMapView } from "../components/dictionary/WordMapView";
import { SizeTest } from "../components/dictionary/SizeTest";
import { PageHeader, Stat } from "../components/ui";
import { tr, msg } from "../i18n/core";

type Tab = "browse" | "map" | "test";

// ============================================================
// Browse
// ============================================================

const WordTile: React.FC<{ word: DictCard }> = ({ word }) => {
  const save = useSaveDictWord();
  const level = LEVEL_STYLE[word.level];
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className={`${card} group relative p-4 flex flex-col gap-1.5 hover:shadow-md hover:border-slate-300/80 dark:hover:border-white/15 transition-shadow`}>
      <Link to={`/dictionary/${word.id}`} className="absolute inset-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60" aria-label={tr("Open “{word}”", { word: word.word })} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white truncate">{word.word}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
            {word.ipa && <span className="font-mono">{word.ipa}</span>}
            {word.ipa && word.pos.length > 0 && " · "}
            {word.pos.map((p) => POS_SHORT[p] ?? p).join(", ")}
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${level.chip}`}>{word.level}</span>
      </div>
      <p className="text-[13px] leading-snug text-slate-600 dark:text-slate-300 line-clamp-2">{word.meaning}</p>
      <div className="relative mt-auto pt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
        <span className="tabular-nums">#{word.rank.toLocaleString()}</span>
        <span className="flex-1" />
        {canSpeak() && (
          <button type="button" onClick={() => void speak(word.word, { rate: 0.85 })} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300" aria-label={tr("Hear “{word}”", { word: word.word })}>
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        )}
        {word.status === "new" ? (
          <button
            type="button"
            onClick={() =>
              save.mutate(word.id, {
                onSuccess: () => toast.success(tr("“{word}” is in My words", { word: word.word })),
                onError: (e) => toast.error(dictError(e, "Couldn't save it")),
              })
            }
            disabled={save.isPending}
            className="h-7 px-2 rounded-lg flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50"
            aria-label={tr("Save “{word}” to My words", { word: word.word })}
          >
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {" "}{tr("Save")}</button>
        ) : (
          <span className={`h-7 px-2 rounded-lg flex items-center gap-1 font-semibold ${word.status === "known" ? "text-emerald-600 dark:text-emerald-300" : "text-sky-600 dark:text-sky-300"}`}>
            <Check className="w-3.5 h-3.5" /> {word.status === "known" ? tr("Known") : tr("Saved")}
          </span>
        )}
      </div>
    </motion.li>
  );
};

const Browse: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const overview = useDictionaryOverview();
  const level = (DICT_LEVELS as string[]).includes(params.get("level") ?? "") ? (params.get("level") as DictLevel) : "";
  const topic = params.get("topic") ?? "";
  const status = (["new", "saved", "known"] as string[]).includes(params.get("status") ?? "") ? (params.get("status") as DictStatus) : "all";
  const sort = params.get("sort") === "az" ? "az" : "rank";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const rankFrom = Number(params.get("from")) || undefined;
  const rankTo = Number(params.get("to")) || undefined;
  const [q, setQ] = useState(params.get("q") ?? "");
  const query = useMemo(() => ({ q: q.trim(), level, topic, status, sort, page, rankFrom, rankTo }) as const, [q, level, topic, status, sort, page, rankFrom, rankTo]);
  const list = useDictionaryList(query);

  const set = (key: string, value: string | number | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "" || value === "all") next.delete(key);
    else next.set(key, String(value));
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      {/* Levels */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(overview.data?.levels ?? DICT_LEVELS.map((l) => ({ level: l, total: 0, known: 0 }))).map((l) => {
          const active = level === l.level;
          const style = LEVEL_STYLE[l.level];
          const share = l.total ? l.known / l.total : 0;
          return (
            <button
              key={l.level}
              type="button"
              onClick={() => set("level", active ? null : l.level)}
              aria-pressed={active}
              className={`${card} p-3 text-left transition-all ${active ? "ring-2 ring-indigo-500 border-transparent" : "hover:border-slate-300 dark:hover:border-white/15"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${style.chip}`}>{l.level}</span>
                <span className="text-[11px] tabular-nums text-slate-400">{l.total.toLocaleString()}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 truncate">{style.name}</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden" title={tr("{known} of {total} known", { known: l.known, total: l.total })}>
                <div className={`h-full rounded-full ${style.dot}`} style={{ width: `${Math.round(share * 100)}%` }} />
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-slate-400">{l.known.toLocaleString()} {" "}{tr("known")}</p>
            </button>
          );
        })}
      </div>

      {/* Search and filters */}
      <div className={`${card} p-3 space-y-3`}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (page !== 1) set("page", null);
            }}
            placeholder={tr("Search {value} words, or a meaning (“happy”, “to be afraid”)…", { value: overview.data ? overview.data.count.toLocaleString() : "13,000" })}
            className={`${input} pl-10`}
            aria-label={tr("Search the dictionary")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "new", "saved", "known"] as const).map((s) => (
            <button key={s} type="button" className={chip(status === s)} onClick={() => set("status", s)}>
              {s === "all" ? tr("All words") : tr(STATUS_LABEL[s])}
            </button>
          ))}
          <span className="flex-1" />
          <select value={topic} onChange={(e) => set("topic", e.target.value)} className={select} aria-label={tr("Topic")}>
            <option value="">{tr("All topics")}</option>
            {overview.data?.topics.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.count.toLocaleString()})
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => set("sort", e.target.value === "az" ? "az" : null)} className={select} aria-label={tr("Sort")}>
            <option value="rank">{tr("Most common first")}</option>
            <option value="az">{tr("A to Z")}</option>
          </select>
        </div>
        {(rankFrom || rankTo) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            {tr("Showing words #{value}–#{value2} from the word map.", { value: (rankFrom ?? 1).toLocaleString(), value2: (rankTo ?? 10000).toLocaleString() })}<button type="button" className="font-semibold text-indigo-600 dark:text-indigo-300 hover:underline" onClick={() => { const n = new URLSearchParams(params); n.delete("from"); n.delete("to"); n.delete("page"); setParams(n, { replace: true }); }}>
              {tr("Show all")}</button>
          </p>
        )}
      </div>

      {/* Results */}
      {list.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      ) : list.isError || !list.data ? (
        <div className={`${card} p-8 text-center text-sm text-slate-500`}>
          {tr("Couldn't load the dictionary.")}{" "}
          <button type="button" className="font-semibold text-indigo-600 hover:underline" onClick={() => list.refetch()}>
            {tr("Try again")}</button>
        </div>
      ) : list.data.total === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tr("No words match")}</p>
          <p className="mt-1 text-xs text-slate-500">{tr("Try fewer filters, or search for a meaning instead.")}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {list.data.total.toLocaleString()} {list.data.total === 1 ? tr("word") : tr("words")}
            {list.isFetching && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin" />}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.data.items.map((w) => (
              <WordTile key={w.id} word={w} />
            ))}
          </ul>
          {list.data.pages > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-2" aria-label={tr("Pages")}>
              <button type="button" disabled={list.data.page <= 1} onClick={() => set("page", list.data!.page - 1)} className="h-9 w-9 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40" aria-label={tr("Previous page")}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                {tr("Page {page} of", { page: list.data.page })}{" "}{list.data.pages.toLocaleString()}
              </span>
              <button type="button" disabled={list.data.page >= list.data.pages} onClick={() => set("page", list.data!.page + 1)} className="h-9 w-9 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40" aria-label={tr("Next page")}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* Credits: the data's licences ask for them */}
      {overview.data && (
        <details className="text-xs text-slate-400 dark:text-slate-500 pt-2">
          <summary className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300">{tr("Word data sources")}</summary>
          <ul className="mt-2 space-y-1">
            {overview.data.sources.map((s) => (
              <li key={s.name}>
                <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{s.name}</a> {" "}{tr("by {by}{value}:", { by: s.by, value: s.license ? ` (${s.license})` : "" })}{" "}{s.use}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

// ============================================================
// Page
// ============================================================

export const DictionaryPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "map" ? "map" : params.get("tab") === "test" ? "test" : "browse";
  const overview = useDictionaryOverview();
  const setTab = (next: Tab) => {
    const p = new URLSearchParams(next === "browse" ? params : undefined);
    if (next === "browse") p.delete("tab");
    else p.set("tab", next);
    setParams(p, { replace: true });
  };
  const latest = overview.data?.latestTest;

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: "browse", label: msg("Browse"), icon: BookA },
    { id: "map", label: msg("Word map"), icon: Grid3x3 },
    { id: "test", label: msg("Size test"), icon: Gauge },
  ];

  return (
    <div className="min-h-screen bg-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={BookA}
          tone="sky"
          eyebrow={tr("Learn")}
          title={tr("Dictionary")}
          subtitle={tr("The {value} useful English words, A1 to C2 (the 10,000 most common, then 3,000 advanced C1 and C2 words), with pronunciation, meanings, examples and word families.", { value: overview.data ? overview.data.count.toLocaleString() : "13,000" })}
          actions={
            overview.data && (
              <div className="flex gap-2 max-sm:w-full [&>*]:max-sm:flex-1">
                <Stat className={`${card} px-4 py-2.5`} label={tr("Words you know")} value={latest?.estimate != null ? `≈${latest.estimate.toLocaleString()}` : "?"} />
                <Stat className={`${card} px-4 py-2.5`} label={tr("Saved")} value={overview.data.progress.saved.toLocaleString()} />
              </div>
            )
          }
        />

        <div role="tablist" className="inline-flex max-sm:flex max-sm:w-full p-1 rounded-2xl bg-surface border border-line">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative h-9 max-sm:h-10 px-4 max-sm:px-2 max-sm:flex-1 max-sm:justify-center whitespace-nowrap rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${tab === id ? "text-white" : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"}`}
            >
              {tab === id && <motion.span layoutId="dictionary-tab" className="absolute inset-0 rounded-xl bg-indigo-600" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <Icon className="relative w-4 h-4" />
              <span className="relative">{tr(label)}</span>
            </button>
          ))}
        </div>

        {tab === "browse" && !latest && overview.data && (
          <button type="button" onClick={() => setTab("test")} className={`${card} w-full p-4 flex items-center gap-3 text-left hover:shadow-md transition-shadow`}>
            <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">{tr("How many English words do you know?")}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{tr("Take the 5-minute size test. It finds your level and marks the words you already know.")}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        {tab === "browse" && <Browse />}
        {tab === "map" && <WordMapView onTest={() => setTab("test")} />}
        {tab === "test" && <SizeTest onMap={() => setTab("map")} />}
      </div>
    </div>
  );
};

export default DictionaryPage;
