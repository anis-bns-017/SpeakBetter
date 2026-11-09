// apps/web/src/components/dictionary/WordMapView.tsx
/**
 * The word map: all the words as squares of 100 words (most common first), shaded by how many you know;
 * the same per 1,000-word band as bars (known and saved, with the size test's estimate); and your next words.
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Gauge, Loader2, Plus } from "lucide-react";
import { dictError, useSaveManyDictWords, useWordMap } from "../../hooks/useDictionary";
import { LEVEL_STYLE, card } from "./dictStyles";

/** One hue, light to dark (dark mode: dark to light), so more known reads as stronger */
const shade = (share: number) =>
  share <= 0
    ? "bg-slate-100 dark:bg-white/[0.05]"
    : share < 0.2
      ? "bg-emerald-100 dark:bg-emerald-950"
      : share < 0.4
        ? "bg-emerald-200 dark:bg-emerald-900"
        : share < 0.6
          ? "bg-emerald-300 dark:bg-emerald-800"
          : share < 0.8
            ? "bg-emerald-500 dark:bg-emerald-600"
            : "bg-emerald-700 dark:bg-emerald-400";

const LEGEND = [0, 0.1, 0.3, 0.5, 0.7, 0.9];

export const WordMapView: React.FC<{ onTest: () => void }> = ({ onTest }) => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useWordMap();
  const saveMany = useSaveManyDictWords();
  const [hover, setHover] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className={`${card} p-8 text-center text-sm text-slate-500`}>
        Couldn't load your word map.{" "}
        <button type="button" className="font-semibold text-indigo-600 hover:underline" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const known = data.cells.reduce((n, c) => n + c.known, 0);
  const total = data.cells.reduce((n, c) => n + (c.to - c.from + 1), 0);
  const cell = hover !== null ? data.cells[hover] : null;
  const openCell = (from: number, to: number) => navigate(`/dictionary?from=${from}&to=${to}`);
  const saveNext = () =>
    saveMany.mutate(
      data.next.map((w) => w.id),
      {
        onSuccess: (r) => toast.success(`${r.added} ${r.added === 1 ? "word" : "words"} added to My words. They'll come up in review.`),
        onError: (e) => toast.error(dictError(e, "Couldn't save them")),
      },
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4 min-w-0">
        {/* All the words */}
        <section className={`${card} p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Your {total.toLocaleString()} words</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {known.toLocaleString()} of {total.toLocaleString()} known · each square is 100 words, most common first
            </p>
          </div>
          <div className="relative mt-4" onMouseLeave={() => setHover(null)}>
            <div className="grid grid-cols-10 gap-[3px]" role="img" aria-label={`Word map: ${known} of ${total} words known`}>
              {data.cells.map((c, i) => {
                const size = c.to - c.from + 1;
                return (
                  <button
                    key={c.from}
                    type="button"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onClick={() => openCell(c.from, c.to)}
                    className={`aspect-square rounded-[4px] ${shade(c.known / size)} ${c.saved ? "ring-1 ring-inset ring-sky-600/70" : ""} hover:ring-2 hover:ring-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-shadow`}
                    aria-label={`Words ${c.from} to ${c.to}: ${c.known} known, ${c.saved} saved`}
                  />
                );
              })}
            </div>
            {cell && (
              <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-10 rounded-lg bg-slate-900 dark:bg-white px-3 py-1.5 text-[11px] text-white dark:text-slate-900 shadow-lg whitespace-nowrap">
                <span className="font-semibold">Words #{cell.from.toLocaleString()}–#{cell.to.toLocaleString()}</span> · {cell.known} known · {cell.saved} saved · click to see them
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              Known:
              {LEGEND.map((s) => (
                <span key={s} className={`w-3.5 h-3.5 rounded-[3px] ${shade(s)}`} />
              ))}
              <span>0% → 100%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[3px] bg-slate-100 dark:bg-white/[0.05] ring-1 ring-inset ring-sky-600/70" /> has saved words
            </span>
          </div>
          <table className="sr-only">
            <caption>Words known in each group of 100</caption>
            <tbody>
              {data.cells.map((c) => (
                <tr key={c.from}>
                  <th>
                    Words {c.from} to {c.to}
                  </th>
                  <td>{c.known} known</td>
                  <td>{c.saved} saved</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* By band */}
        <section className={`${card} p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">By 1,000 words</h2>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" /> Known</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-600" /> Saved</span>
              {data.latestTest && <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-slate-800 dark:bg-slate-100" /> Size test estimate</span>}
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {data.bands.map((b) => {
              const size = b.to - b.from + 1;
              const knownPct = (b.known / size) * 100;
              const savedPct = (b.saved / size) * 100;
              return (
                <li key={b.band}>
                  <button type="button" onClick={() => openCell(b.from, b.to)} className="w-full flex items-center gap-3 group text-left" aria-label={`Words ${b.from} to ${b.to}: ${b.known} known, ${b.saved} saved${b.tested != null ? `, test estimate ${Math.round(b.tested * 100)}%` : ""}`}>
                    <span className="w-24 shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {b.from.toLocaleString()}–{b.to.toLocaleString()}
                    </span>
                    <span className="relative flex-1 h-3 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden flex gap-[2px] group-hover:ring-2 group-hover:ring-indigo-500/40">
                      {knownPct > 0 && <span className="h-full bg-emerald-600 rounded-l-full" style={{ width: `${knownPct}%` }} />}
                      {savedPct > 0 && <span className="h-full bg-sky-600" style={{ width: `${savedPct}%` }} />}
                      {b.tested != null && <span className="absolute top-0 bottom-0 w-0.5 bg-slate-800 dark:bg-slate-100" style={{ left: `${b.tested * 100}%` }} />}
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {b.known.toLocaleString()} known
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* By level */}
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">By level</h2>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.levels.map((l) => {
              const pct = l.total ? Math.round((l.known / l.total) * 100) : 0;
              return (
                <Link key={l.level} to={`/dictionary?level=${l.level}`} className="rounded-2xl border border-slate-200/80 dark:border-white/[0.07] p-3 hover:border-slate-300 dark:hover:border-white/15">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${LEVEL_STYLE[l.level].chip}`}>{l.level}</span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {l.known.toLocaleString()} of {l.total.toLocaleString()} words
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* Next words */}
      <aside className="space-y-4">
        {!data.latestTest && (
          <button type="button" onClick={onTest} className={`${card} w-full p-4 text-left hover:shadow-md transition-shadow`}>
            <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-500" /> Fill in your map in 5 minutes
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The size test marks the words you already know, so the map shows where you really are.</p>
          </button>
        )}
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Your next {data.next.length} words</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">The most common words you haven't saved or marked yet{data.latestTest ? ", skipping what your test says you know" : ""}.</p>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.05]">
            {data.next.map((w) => (
              <li key={w.id}>
                <Link to={`/dictionary/${w.id}`} className="flex items-center gap-2 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03] -mx-2 px-2 rounded-lg">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{w.word}</span>
                    <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{w.meaning}</span>
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${LEVEL_STYLE[w.level].chip}`}>{w.level}</span>
                </Link>
              </li>
            ))}
          </ul>
          {data.next.length > 0 && (
            <button type="button" onClick={saveNext} disabled={saveMany.isPending} className="mt-3 w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {saveMany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save all {data.next.length} to My words
            </button>
          )}
        </section>
      </aside>
    </div>
  );
};

export default WordMapView;
