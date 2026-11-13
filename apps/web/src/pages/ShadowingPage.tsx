// apps/web/src/pages/ShadowingPage.tsx
/**
 * The shadowing course: tracks of short lessons (intonation, linking, stress, travel, interviews...), each a
 * set of lines to hear and say back the same way, plus a quick daily mix from the library.
 */

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Headphones,
  Layers,
  Loader2,
  Mic,
  Repeat2,
  Search,
  Shuffle,
  Sparkles,
  Target,
} from "lucide-react";
import { useShadowingOverview, type ShadowLevel } from "../hooks/useShadowing";
import { card, scoreTone, trackIcon } from "../components/shadowing/shadowingUi";
import { tr, msg } from "../i18n/core";

const levelChip = "text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300";

const MODES = [
  { icon: Repeat2, title: msg("Repeat"), desc: msg("Hear a line, then say it back.") },
  { icon: Layers, title: msg("Build up"), desc: msg("Learn long lines end-first, a chunk at a time.") },
  { icon: Headphones, title: msg("Speak along"), desc: msg("Talk at the same time as the voice.") },
  { icon: Target, title: msg("Blind"), desc: msg("No text: shadow by ear alone.") },
];

export const ShadowingPage: React.FC = () => {
  const { data, isLoading, isError } = useShadowingOverview();
  const [level, setLevel] = useState<ShadowLevel | "all">("all");
  const [query, setQuery] = useState("");

  const tracks = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.tracks
      .map((t) => ({
        ...t,
        shown: t.lessons.filter(
          (l) =>
            (level === "all" || l.level === level) &&
            (!q || `${l.title} ${l.focus} ${t.label}`.toLowerCase().includes(q)),
        ),
      }))
      .filter((t) => t.shown.length > 0);
  }, [data, level, query]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>
        {tr("Couldn't load shadowing. Check your connection and refresh to try again.")}</div>
    );
  }

  const { stats } = data;
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 flex items-center justify-center shrink-0">
          <Repeat2 className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">{tr("Shadowing")}</h1>
          <p className="text-sm text-slate-500">{tr("Listen to a native-like voice and say it back the same way: rhythm, stress, linking and tune.")}</p>
        </div>
      </header>

      {/* Your numbers */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: msg("Lessons done"), value: `${stats.done}/${stats.total}` },
          { label: msg("Average best"), value: stats.average === null ? "-" : String(stats.average), tone: stats.average !== null ? scoreTone(stats.average) : "" },
          { label: msg("Lines spoken"), value: String(stats.linesSpoken) },
          { label: msg("Sessions"), value: String(stats.sessions) },
        ].map((s) => (
          <div key={s.label} className={`${card} p-4`}>
            <p className="text-xs text-slate-500">{tr(s.label)}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white ${s.tone ?? ""}`}>{s.value}</p>
          </div>
        ))}
      </section>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" aria-hidden>
        <div className="h-full rounded-full bg-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Start here and the daily mix */}
      <section className="grid gap-3 sm:grid-cols-2">
        {data.next ? (
          <Link
            to={`/shadowing/${data.next.id}`}
            className="group rounded-3xl p-5 bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-500/15 hover:shadow-fuchsia-500/30 transition-shadow"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> {" "}{tr("Up next ·")}{" "}{data.next.level}
            </p>
            <h2 className="mt-1 text-lg font-bold">{tr(data.next.title)}</h2>
            <p className="text-sm opacity-90">{data.next.focus}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
              {tr("Start lesson")}{" "}<ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ) : (
          <div className="rounded-3xl p-5 bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{tr("Course complete")}</p>
            <h2 className="mt-1 text-lg font-bold">{tr("You finished every lesson!")}</h2>
            <p className="text-sm opacity-90">{tr("Go back to any lesson to beat your best, or try the daily mix.")}</p>
          </div>
        )}
        <Link to="/shadowing/daily" className={`${card} group p-5 hover:border-fuchsia-300 dark:hover:border-fuchsia-500/40 transition-colors`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400 flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5" /> {" "}{tr("Daily mix ·")}{" "}{data.level}
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{tr("Six fresh sentences")}</h2>
          <p className="text-sm text-slate-500">{tr("Mixed lines from the library at your level, new every day.")}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-400">
            {tr("Practise now")}{" "}<ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      </section>

      {/* How it works */}
      <section className={`${card} p-5`}>
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-fuchsia-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Four ways to practise in every lesson")}</h2>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MODES.map((m) => (
            <div key={m.title} className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3">
              <m.icon className="w-4 h-4 text-fuchsia-500" />
              <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{tr(m.title)}</p>
              <p className="text-xs text-slate-500">{tr(m.desc)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {tr("Each line shows")}{" "}<b className="text-slate-700 dark:text-slate-200">{tr("stressed words")}</b>, <span className="text-sky-600 dark:text-sky-400">{tr("weak forms")}</span>{tr(", linking (‿) and whether your voice should go up or down. Record yourself and compare with the model.")}</p>
      </section>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("Search lessons: linking, interview, questions...")}
            className="w-full h-10 pl-10 pr-4 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm outline-none focus:border-fuchsia-400"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr("Level")}>
          {(["all", ...data.levels] as Array<ShadowLevel | "all">).map((lv) => (
            <button
              key={lv}
              type="button"
              role="tab"
              aria-selected={level === lv}
              onClick={() => setLevel(lv)}
              className={`h-9 px-3.5 rounded-full text-xs font-semibold border transition-colors ${
                level === lv
                  ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:text-white dark:border-indigo-500"
                  : "border-line bg-surface text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.08]"
              }`}
            >
              {lv === "all" ? tr("All") : lv}
              {lv === data.level && <span className="opacity-70"> {" "}{tr("· you")}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tracks */}
      {tracks.length === 0 ? (
        <p className={`${card} p-8 text-center text-sm text-slate-500`}>{tr("No lessons match. Try another level or search.")}</p>
      ) : (
        <div className="space-y-6">
          {tracks.map((t) => {
            const Icon = trackIcon(t.icon);
            return (
              <section key={t.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center shrink-0">
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">{tr(t.label)}</h2>
                    <p className="text-xs text-slate-500">{tr(t.description)}</p>
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">{t.done}/{t.lessons.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {t.shown.map((l) => (
                    <Link
                      key={l.id}
                      to={`/shadowing/${l.id}`}
                      className={`${card} p-4 flex flex-col gap-1.5 hover:border-fuchsia-300 dark:hover:border-fuchsia-500/40 transition-colors`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={levelChip}>{l.level}</span>
                        {l.done ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {l.bestScore !== null ? <span className={`tabular-nums ${scoreTone(l.bestScore)}`}>{l.bestScore}</span> : <span className="text-slate-400">{tr("done")}</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">{l.lines} {" "}{tr("lines")}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{tr(l.title)}</p>
                      <p className="text-xs text-slate-500">{l.focus}</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShadowingPage;
