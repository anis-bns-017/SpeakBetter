// apps/web/src/pages/ProgressPage.tsx
/**
 * Progress: how your practice is going. This week against last week, a 12-week activity calendar, XP by
 * activity, and how your mistakes, cards and pronunciation are moving, with a few plain-words highlights.
 * Minutes are an estimate built from what you did (speaking time is measured; the rest is per action).
 */

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  Flame,
  Layers,
  Loader2,
  Minus,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useProgressInsights, type ActivityKind, type ProgressInsights, type WeekStats } from "../hooks/usePlan";
import { useProgress } from "../hooks/useLearning";
import { getXpLevel } from "../lib/xpLevels";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/**
 * Chart colours as CSS variables, light and dark steps of the same hues (validated as a set). Slots are
 * given out in this fixed order; text never uses them.
 */
const SERIES_VARS =
  "[--s1:#2a78d6] [--s2:#eb6834] [--s3:#1baf7a] [--s4:#eda100] [--s5:#e87ba4] " +
  "dark:[--s1:#3987e5] dark:[--s2:#d95926] dark:[--s3:#199e70] dark:[--s4:#c98500] dark:[--s5:#d55181]";
const SLOT = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];

/** Seven activities folded into five series, so the chart stays readable */
const ACTIVITY_SERIES: Array<{ key: string; label: string; kinds: ActivityKind[] }> = [
  { key: "speaking", label: "Speaking", kinds: ["speaking"] },
  { key: "review", label: "Review", kinds: ["review"] },
  { key: "pronunciation", label: "Pronunciation", kinds: ["pronunciation"] },
  { key: "social", label: "Corrections & chat", kinds: ["corrections", "chat"] },
  { key: "other", label: "Exercises & bonuses", kinds: ["exercises", "other"] },
];

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
/** "This week", "Last week", or the date the week started */
const weekLabel = (weeksAgo: number) => {
  if (weeksAgo === 0) return "This week";
  if (weeksAgo === 1) return "Last week";
  const start = new Date();
  start.setDate(start.getDate() - weeksAgo * 7 - 6);
  return start.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// ============================================================
// Hover tooltip shared by the charts
// ============================================================

interface Tip {
  x: number;
  y: number;
  lines: string[];
}

function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  // Positioned inside the chart container (marked data-tip-root) that holds the hovered mark
  const show = (e: React.MouseEvent | React.FocusEvent, lines: string[]) => {
    const target = e.currentTarget as HTMLElement;
    const box = target.closest("[data-tip-root]")?.getBoundingClientRect();
    if (!box) return;
    const mark = target.getBoundingClientRect();
    setTip({ x: mark.left - box.left + mark.width / 2, y: mark.top - box.top, lines });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-[11px] text-white shadow-lg whitespace-nowrap"
      style={{ left: tip.x, top: tip.y - 6 }}
      role="tooltip"
    >
      {tip.lines.map((l, i) => (
        <div key={i} className={i === 0 ? "font-semibold" : "text-white/80"}>
          {l}
        </div>
      ))}
    </div>
  ) : null;
  return { show, hide, node };
}

const Legend: React.FC<{ items: Array<{ label: string; color: string }> }> = ({ items }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
    {items.map((i) => (
      <span key={i.label} className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
        {i.label}
      </span>
    ))}
  </div>
);

// ============================================================
// This week vs last week
// ============================================================

const Delta: React.FC<{ now: number | null; before: number | null; lowerIsBetter?: boolean }> = ({ now, before, lowerIsBetter }) => {
  if (now === null || before === null) return <span className="text-[11px] text-slate-400">no week before</span>;
  const diff = now - before;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
        <Minus className="w-3 h-3" /> same as last week
      </span>
    );
  }
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
      {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(diff)} vs last week
    </span>
  );
};

const WEEK_TILES: Array<{ key: keyof WeekStats; label: string; unit?: string; lowerIsBetter?: boolean }> = [
  { key: "minutes", label: "Minutes practised", unit: "min" },
  { key: "xp", label: "XP earned" },
  { key: "speakingMinutes", label: "Speaking", unit: "min" },
  { key: "reviews", label: "Cards reviewed" },
  { key: "pronunciationAverage", label: "Pronunciation score" },
  { key: "activeDays", label: "Days you practised", unit: "of 7" },
];

const WeekCompare: React.FC<{ thisWeek: WeekStats; lastWeek: WeekStats }> = ({ thisWeek, lastWeek }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {WEEK_TILES.map((t) => {
      const now = thisWeek[t.key] as number | null;
      const before = lastWeek[t.key] as number | null;
      return (
        <div key={t.key} className={`${card} p-4`}>
          <p className="text-xs text-slate-500">{t.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {now ?? "–"}
            {now !== null && t.unit && <span className="ml-1 text-sm font-semibold text-slate-400">{t.unit}</span>}
          </p>
          <Delta now={now} before={t.key === "pronunciationAverage" ? before : (before ?? 0)} lowerIsBetter={t.lowerIsBetter} />
        </div>
      );
    })}
  </div>
);

// ============================================================
// 12-week activity calendar
// ============================================================

/** Minutes → one of five steps of a single hue (more practice, darker) */
const calendarStep = (minutes: number) => (minutes <= 0 ? 0 : minutes < 5 ? 1 : minutes < 15 ? 2 : minutes < 30 ? 3 : 4);
const STEP_STYLE: React.CSSProperties[] = [
  {},
  { background: "color-mix(in oklab, var(--s1) 25%, transparent)" },
  { background: "color-mix(in oklab, var(--s1) 50%, transparent)" },
  { background: "color-mix(in oklab, var(--s1) 75%, transparent)" },
  { background: "var(--s1)" },
];

const ActivityCalendar: React.FC<{ days: ProgressInsights["days"] }> = ({ days }) => {
  const tip = useTip();
  // Columns are weeks, rows are weekdays (Monday first); pad the start so the first day sits on its weekday
  const first = new Date(`${days[0].date}T12:00:00`);
  const pad = (first.getDay() + 6) % 7;
  const cells: Array<ProgressInsights["days"][number] | null> = [...Array(pad).fill(null), ...days];
  const weeks = Math.ceil(cells.length / 7);
  const active = days.filter((d) => d.minutes > 0 || d.xp > 0).length;

  return (
    <section className={`${card} p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Last 12 weeks</h2>
        <p className="text-xs text-slate-500">You practised on {active} of {days.length} days</p>
      </div>
      <div data-tip-root className="relative mt-4 overflow-x-auto">
        <div className="grid grid-flow-col gap-[3px] w-max" style={{ gridTemplateRows: "repeat(7, 14px)", gridTemplateColumns: `repeat(${weeks}, 14px)` }}>
          {cells.map((d, i) =>
            d ? (
              <button
                key={d.date}
                type="button"
                aria-label={`${longDate(d.date)}: ${Math.round(d.minutes)} minutes, ${d.xp} XP`}
                onMouseEnter={(e) => tip.show(e, [longDate(d.date), `${Math.round(d.minutes)} min · ${d.xp} XP`])}
                onFocus={(e) => tip.show(e, [longDate(d.date), `${Math.round(d.minutes)} min · ${d.xp} XP`])}
                onMouseLeave={tip.hide}
                onBlur={tip.hide}
                className="w-[14px] h-[14px] rounded-[3px] bg-slate-100 dark:bg-white/[0.06] outline-offset-1"
                style={STEP_STYLE[calendarStep(d.minutes)]}
              />
            ) : (
              <span key={`pad-${i}`} className="w-[14px] h-[14px]" aria-hidden />
            ),
          )}
        </div>
        {tip.node}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
        Less
        {STEP_STYLE.map((s, i) => (
          <span key={i} className="w-3 h-3 rounded-[3px] bg-slate-100 dark:bg-white/[0.06]" style={s} aria-hidden />
        ))}
        More
        <span className="ml-2">(minutes of practice a day)</span>
      </div>
    </section>
  );
};

// ============================================================
// XP per day by activity (last 30 days)
// ============================================================

const XpByDay: React.FC<{ days: ProgressInsights["days"] }> = ({ days }) => {
  const tip = useTip();
  const recent = days.slice(-30);
  const rows = recent.map((d) => ({
    date: d.date,
    total: d.xp,
    parts: ACTIVITY_SERIES.map((s) => s.kinds.reduce((sum, k) => sum + (d.byActivity[k] ?? 0), 0)),
  }));
  const max = Math.max(1, ...rows.map((r) => r.total));
  const height = 140;

  return (
    <section className={`${card} p-5`}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">XP per day, by activity</h2>
      <p className="text-xs text-slate-500 mt-0.5">Last 30 days · best day {max === 1 && rows.every((r) => r.total === 0) ? "–" : `${max} XP`}</p>
      <div className="mt-3">
        <Legend items={ACTIVITY_SERIES.map((s, i) => ({ label: s.label, color: SLOT[i] }))} />
      </div>
      <div data-tip-root className="relative mt-4">
        <div className="flex items-end gap-[3px] border-b border-slate-200 dark:border-white/10" style={{ height }}>
          {rows.map((r) => (
            <button
              key={r.date}
              type="button"
              aria-label={`${longDate(r.date)}: ${r.total} XP`}
              onMouseEnter={(e) =>
                tip.show(e, [
                  `${longDate(r.date)} · ${r.total} XP`,
                  ...ACTIVITY_SERIES.map((s, i) => (r.parts[i] ? `${s.label}: ${r.parts[i]}` : "")).filter(Boolean),
                ])
              }
              onFocus={(e) => tip.show(e, [`${longDate(r.date)} · ${r.total} XP`])}
              onMouseLeave={tip.hide}
              onBlur={tip.hide}
              className="flex-1 h-full flex flex-col-reverse items-stretch rounded-t-[4px] hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
            >
              {r.parts.map((value, i) =>
                value > 0 ? (
                  <span
                    key={i}
                    // A 2px surface-coloured gap between stacked pieces keeps them apart
                    className="block border-t-2 border-white dark:border-slate-900 first:border-t-0 last:rounded-t-[4px]"
                    style={{ height: (value / max) * height, background: SLOT[i] }}
                  />
                ) : null,
              )}
            </button>
          ))}
        </div>
        {tip.node}
        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
          <span>{shortDate(rows[0].date)}</span>
          <span>Today</span>
        </div>
      </div>
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300">See the numbers</summary>
        <div className="mt-2 max-h-60 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1 pr-2 font-medium">Day</th>
                {ACTIVITY_SERIES.map((s) => (
                  <th key={s.key} className="py-1 pr-2 font-medium">{s.label}</th>
                ))}
                <th className="py-1 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().filter((r) => r.total > 0).map((r) => (
                <tr key={r.date} className="border-t border-slate-100 dark:border-white/[0.06] text-slate-600 dark:text-slate-300">
                  <td className="py-1 pr-2">{longDate(r.date)}</td>
                  {r.parts.map((p, i) => (
                    <td key={i} className="py-1 pr-2">{p || "·"}</td>
                  ))}
                  <td className="py-1 font-semibold">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
};

// ============================================================
// Small single-series bar chart (minutes per week, pronunciation per week)
// ============================================================

const WeekBars: React.FC<{
  title: string;
  subtitle: string;
  values: Array<{ label: string; value: number | null; detail?: string }>;
  max?: number;
  unit: string;
  empty: string;
}> = ({ title, subtitle, values, max, unit, empty }) => {
  const tip = useTip();
  const top = max ?? Math.max(1, ...values.map((v) => v.value ?? 0));
  const height = 110;
  const hasData = values.some((v) => (v.value ?? 0) > 0);
  const last = values[values.length - 1];
  return (
    <section className={`${card} p-5`}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      {hasData ? (
        <div data-tip-root className="relative mt-4">
          <div className="flex items-end gap-1.5 border-b border-slate-200 dark:border-white/10" style={{ height }}>
            {values.map((v, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${v.label}: ${v.value ?? "no data"} ${unit}`}
                onMouseEnter={(e) => tip.show(e, [v.label, v.value === null ? "No practice" : `${v.value} ${unit}${v.detail ? ` · ${v.detail}` : ""}`])}
                onFocus={(e) => tip.show(e, [v.label, v.value === null ? "No practice" : `${v.value} ${unit}`])}
                onMouseLeave={tip.hide}
                onBlur={tip.hide}
                className="flex-1 h-full flex items-end rounded-t-[4px] hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
              >
                <span
                  className="block w-full rounded-t-[4px]"
                  style={{ height: v.value ? Math.max(3, (v.value / top) * height) : 0, background: "var(--s1)", opacity: i === values.length - 1 ? 1 : 0.55 }}
                />
              </button>
            ))}
          </div>
          {tip.node}
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{values[0].label}</span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {last.label}: {last.value ?? "–"} {last.value !== null ? unit : ""}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-6 mb-2 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
};

// ============================================================
// Mistakes per week by type (fewer is better)
// ============================================================

const MistakesByWeek: React.FC<{ mistakes: ProgressInsights["mistakes"] }> = ({ mistakes }) => {
  const tip = useTip();
  const height = 110;
  const max = Math.max(1, ...mistakes.byWeek.map((w) => w.total));
  const has = mistakes.byWeek.some((w) => w.total > 0);
  // Mistakes that are not in the top four still count in the total, shown in neutral grey
  return (
    <section className={`${card} p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Mistakes per week</h2>
        <Link to="/flashcards?tab=mistakes" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          My mistakes
        </Link>
      </div>
      <p className="text-xs text-slate-500 mt-0.5">Corrections you received · fewer is better</p>
      {has ? (
        <>
          <div className="mt-3">
            <Legend
              items={[
                ...mistakes.patterns.map((p, i) => ({ label: p.label.split(" (")[0], color: SLOT[i] })),
                { label: "Other", color: "rgb(148 163 184)" },
              ]}
            />
          </div>
          <div data-tip-root className="relative mt-4">
            <div className="flex items-end gap-1.5 border-b border-slate-200 dark:border-white/10" style={{ height }}>
              {mistakes.byWeek.map((w) => {
                const parts = mistakes.patterns.map((p) => w.byPattern[p.key] ?? 0);
                const rest = Math.max(0, w.total - parts.reduce((a, b) => a + b, 0));
                return (
                  <button
                    key={w.weeksAgo}
                    type="button"
                    aria-label={`${weekLabel(w.weeksAgo)}: ${w.total} mistakes`}
                    onMouseEnter={(e) =>
                      tip.show(e, [
                        `${weekLabel(w.weeksAgo)} · ${w.total} mistake${w.total === 1 ? "" : "s"}`,
                        ...mistakes.patterns.map((p, i) => (parts[i] ? `${p.label.split(" (")[0]}: ${parts[i]}` : "")).filter(Boolean),
                        ...(rest ? [`Other: ${rest}`] : []),
                      ])
                    }
                    onFocus={(e) => tip.show(e, [`${weekLabel(w.weeksAgo)} · ${w.total}`])}
                    onMouseLeave={tip.hide}
                    onBlur={tip.hide}
                    className="flex-1 h-full flex flex-col-reverse rounded-t-[4px] hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
                  >
                    {[...parts, rest].map((value, i) =>
                      value > 0 ? (
                        <span
                          key={i}
                          className="block border-t-2 border-white dark:border-slate-900 first:border-t-0 last:rounded-t-[4px]"
                          style={{ height: (value / max) * height, background: i < parts.length ? SLOT[i] : "rgb(148 163 184)" }}
                        />
                      ) : null,
                    )}
                  </button>
                );
              })}
            </div>
            {tip.node}
            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
              <span>{weekLabel(mistakes.byWeek[0].weeksAgo)}</span>
              <span>This week</span>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-6 mb-2 text-sm text-slate-500">No corrections in the last 8 weeks. When someone corrects you, the trend shows up here.</p>
      )}
    </section>
  );
};

// ============================================================
// Page
// ============================================================

export const ProgressPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useProgressInsights();
  const { data: legacy } = useProgress();

  const weeklyMinutes = useMemo(
    () => (data ? data.weeklyMinutes.map((value, i, all) => ({ label: weekLabel(all.length - 1 - i), value })) : []),
    [data],
  );
  const pronunciationWeeks = useMemo(
    () => (data ? data.pronunciation.byWeek.map((w) => ({ label: weekLabel(w.weeksAgo), value: w.average, detail: `${w.tries} tries` })) : []),
    [data],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">We couldn't load your progress</p>
        <button type="button" onClick={() => refetch()} className="mt-5 px-4 h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          Try again
        </button>
      </div>
    );
  }

  const level = getXpLevel(data.totalXp);
  const learnedPct = data.cards.total ? Math.round((data.cards.learned / data.cards.total) * 100) : 0;
  const skills = (legacy?.progress ?? []) as unknown as Array<Record<string, unknown>>;

  return (
    <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5 ${SERIES_VARS}`}>
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Your progress</h1>
          <p className="text-sm text-slate-500">How your practice is going, week by week</p>
        </div>
      </header>

      {data.summary.length > 0 && (
        <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-5 shadow-lg shadow-indigo-500/20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> This week
          </p>
          <ul className="mt-2 space-y-1.5">
            {data.summary.map((line) => (
              <li key={line} className="text-sm sm:text-base leading-snug">{line}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${card} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0"><Trophy className="w-5 h-5" /></span>
          <div>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">Level {level}</p>
            <p className="text-[11px] text-slate-500">{data.totalXp.toLocaleString()} XP in all</p>
          </div>
        </div>
        <div className={`${card} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0"><Flame className="w-5 h-5" /></span>
          <div>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{data.streak.current} days</p>
            <p className="text-[11px] text-slate-500">streak · best {data.streak.longest}</p>
          </div>
        </div>
        <div className={`${card} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><CalendarDays className="w-5 h-5" /></span>
          <div>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{data.streak.plan} days</p>
            <p className="text-[11px] text-slate-500">daily plan finished in a row</p>
          </div>
        </div>
        <div className={`${card} p-4 flex items-center gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0"><Layers className="w-5 h-5" /></span>
          <div>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{data.cards.learned}</p>
            <p className="text-[11px] text-slate-500">cards you remember for weeks</p>
          </div>
        </div>
      </div>

      <WeekCompare thisWeek={data.thisWeek} lastWeek={data.lastWeek} />

      <ActivityCalendar days={data.days} />

      <div className="grid lg:grid-cols-2 gap-5">
        <XpByDay days={data.days} />
        <WeekBars
          title="Minutes per week"
          subtitle="Estimated from what you did · last 12 weeks"
          values={weeklyMinutes}
          unit="min"
          empty="No practice yet. Your weekly minutes will show up here."
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <MistakesByWeek mistakes={data.mistakes} />
        <section className={`${card} p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pronunciation</h2>
            <Link to="/pronunciation" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              Practise
            </Link>
          </div>
          <WeekBarsInline values={pronunciationWeeks} />
          {data.pronunciation.weakSounds.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500">Sounds to work on</p>
              <ul className="mt-2 space-y-1.5">
                {data.pronunciation.weakSounds.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 truncate">
                      <AudioLines className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {s.label}
                    </span>
                    <span className="tabular-nums text-xs text-slate-500 shrink-0">avg {s.average} · {s.tries} tries</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Cards you have learned</h2>
          <p className="text-xs text-slate-500 mt-0.5">A card counts once you remember it for 3 weeks or more</p>
          <p className="mt-4 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {data.cards.learned}
            <span className="text-base font-semibold text-slate-400"> of {data.cards.total}</span>
          </p>
          <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${learnedPct}%`, background: "var(--s1)" }} />
          </div>
          <Link to="/flashcards" className="mt-3 inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            Review now
          </Link>
        </section>

        <section className={`${card} p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Your level</h2>
            <Link to="/placement" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {data.levels.length ? "Retake the test" : "Take the test"}
            </Link>
          </div>
          {data.levels.length ? (
            <ol className="mt-4 flex flex-wrap items-center gap-2">
              {data.levels.map((l, i) => (
                <li key={`${l.level}-${l.date}`} className="flex items-center gap-2">
                  {i > 0 && <span className="text-slate-300 dark:text-slate-600" aria-hidden>→</span>}
                  <span className="inline-flex flex-col items-center rounded-2xl border border-slate-200 dark:border-white/10 px-3 py-1.5">
                    <span className="text-base font-bold text-slate-900 dark:text-white">{l.level}</span>
                    <span className="text-[10px] text-slate-500">{new Date(l.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-500 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-slate-400" /> Take the level test to start tracking your level over time.
            </p>
          )}
        </section>
      </div>

      {skills.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" /> Course skills
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
            {skills.map((s, i) => (
              <li key={String(s.id ?? i)} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700 dark:text-slate-200">{String(s.skill ?? s.type ?? "Skill")}</span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {typeof s.completionRate === "number" ? `${Math.round(s.completionRate * 100)}%` : s.mastered ? "Mastered" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-slate-400 text-center">
        Speaking time is measured. Other minutes are estimated per action (a card review is about 25 seconds, a pronunciation try about 30).
      </p>
    </div>
  );
};

/** The pronunciation weekly averages, in the same style as the other week charts, inside its own card */
const WeekBarsInline: React.FC<{ values: Array<{ label: string; value: number | null; detail?: string }> }> = ({ values }) => {
  const tip = useTip();
  const height = 90;
  const has = values.some((v) => v.value !== null);
  if (!has) return <p className="mt-4 text-sm text-slate-500">No pronunciation practice yet. Your weekly average score will show here.</p>;
  const last = [...values].reverse().find((v) => v.value !== null);
  return (
    <div data-tip-root className="relative mt-4">
      <p className="text-xs text-slate-500">Average score per week, out of 100</p>
      <div className="mt-2 flex items-end gap-1.5 border-b border-slate-200 dark:border-white/10" style={{ height }}>
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${v.label}: ${v.value ?? "no practice"}`}
            onMouseEnter={(e) => tip.show(e, [v.label, v.value === null ? "No practice" : `Average ${v.value} · ${v.detail ?? ""}`])}
            onFocus={(e) => tip.show(e, [v.label, v.value === null ? "No practice" : `Average ${v.value}`])}
            onMouseLeave={tip.hide}
            onBlur={tip.hide}
            className="flex-1 h-full flex items-end rounded-t-[4px] hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
          >
            <span className="block w-full rounded-t-[4px]" style={{ height: v.value ? (v.value / 100) * height : 0, background: "var(--s3)" }} />
          </button>
        ))}
      </div>
      {tip.node}
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{values[0].label}</span>
        {last && <span className="font-semibold text-slate-600 dark:text-slate-300">{last.label}: {last.value}</span>}
      </div>
    </div>
  );
};

export default ProgressPage;
