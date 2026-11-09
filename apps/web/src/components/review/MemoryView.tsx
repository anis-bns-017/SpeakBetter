// apps/web/src/components/review/MemoryView.tsx
/**
 * How your memory is doing: cards by stage, the chance of remembering what you have learned, how much you
 * really remembered lately, the reviews coming up over two weeks, and the retention target you study for.
 * Scheduling is FSRS (the memory model behind modern Anki).
 */

import React, { useState } from "react";
import { toast } from "sonner";
import { Brain, CalendarDays, Gauge, Layers, Loader2, Target } from "lucide-react";
import { useReviewStats, useSetRetention, type ReviewStats } from "../../hooks/useReview";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const RETENTION_COPY: Record<string, { label: string; hint: string }> = {
  "0.8": { label: "80%", hint: "Fewest reviews. You will forget about 1 card in 5." },
  "0.85": { label: "85%", hint: "Lighter workload, still solid memory." },
  "0.9": { label: "90%", hint: "Recommended: the best balance of time and memory." },
  "0.95": { label: "95%", hint: "Remember almost everything, with many more reviews." },
};

const dayLabel = (iso: string, index: number) => {
  if (index === 0) return "Today";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
};

const reviews = (n: number) => `${n} review${n === 1 ? "" : "s"}`;

const longDay = (iso: string, index: number) => {
  if (index === 0) return "Today (and anything overdue)";
  if (index === 1) return "Tomorrow";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
};

/** Reviews due per day: one series, so one hue and no legend; every bar has a hover readout */
const Forecast: React.FC<{ forecast: ReviewStats["forecast"] }> = ({ forecast }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...forecast.map((f) => f.due));
  const total = forecast.reduce((sum, f) => sum + f.due, 0);
  const peak = forecast.reduce((best, f, i) => (f.due > forecast[best].due ? i : best), 0);
  const H = 120;

  return (
    <div>
      <div className="relative" style={{ height: H + 24 }} onMouseLeave={() => setHover(null)}>
        {/* Recessive guide at the peak */}
        <div className="absolute left-0 right-0 border-t border-dashed border-slate-200 dark:border-white/[0.08]" style={{ top: 0 }} />
        <span className="absolute right-0 -top-4 text-[11px] tabular-nums text-slate-400">{max}</span>
        <div className="absolute inset-x-0 top-0 flex items-end gap-[2px]" style={{ height: H }} role="img" aria-label={`Reviews due over the next 14 days: ${total} in total`}>
          {forecast.map((f, i) => {
            const h = f.due ? Math.max(4, (f.due / max) * H) : 0;
            return (
              <div
                key={f.day}
                className="relative flex-1 h-full flex items-end cursor-default"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${longDay(f.day, i)}: ${reviews(f.due)}`}
              >
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-indigo-600 dark:bg-indigo-300" : "bg-indigo-500 dark:bg-indigo-400"}`}
                  style={{ height: h }}
                />
                {/* Direct labels only where they help: today and the busiest day */}
                {(i === 0 || i === peak) && f.due > 0 && hover === null && (
                  <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300" style={{ bottom: h + 2 }}>
                    {f.due}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 border-t border-slate-200 dark:border-white/[0.1]" style={{ top: H }} />
        <div className="absolute inset-x-0 flex gap-[2px]" style={{ top: H + 6 }}>
          {forecast.map((f, i) => (
            <span key={f.day} className={`flex-1 text-center text-[11px] text-slate-400 ${i % 2 && i !== 0 ? "max-sm:invisible" : ""}`}>
              {dayLabel(f.day, i)}
            </span>
          ))}
        </div>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 dark:bg-white px-2.5 py-1.5 text-[11px] text-white dark:text-slate-900 shadow-lg whitespace-nowrap"
            style={{ left: `${((hover + 0.5) / forecast.length) * 100}%` }}
          >
            <span className="font-semibold">{reviews(forecast[hover].due)}</span> · {longDay(forecast[hover].day, hover)}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Reviews due each day</caption>
        <tbody>
          {forecast.map((f, i) => (
            <tr key={f.day}>
              <th>{longDay(f.day, i)}</th>
              <td>{f.due}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Tile: React.FC<{ icon: React.ElementType; label: string; value: string; hint: string }> = ({ icon: Icon, label, value, hint }) => (
  <div className={`${card} p-4`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" /> {label}
    </p>
    <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">{hint}</p>
  </div>
);

export const MemoryView: React.FC = () => {
  const { data, isLoading, isError, refetch } = useReviewStats();
  const setRetention = useSetRetention();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500">Couldn't load your memory stats.</p>
        <button type="button" onClick={() => refetch()} className="mt-3 px-4 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
          Try again
        </button>
      </div>
    );
  }

  const { counts } = data;
  const week = data.forecast.slice(0, 7).reduce((s, f) => s + f.due, 0);
  const seg = (n: number) => (counts.total ? `${(n / counts.total) * 100}%` : "0%");
  const choose = (value: number) =>
    setRetention.mutate(value, {
      onSuccess: () => toast.success(`Target set to ${Math.round(value * 100)}%. New answers are scheduled for it.`),
      onError: () => toast.error("Couldn't save the target. Try again."),
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          icon={Brain}
          label="Memory now"
          value={data.averageRecall === null ? "–" : `${data.averageRecall}%`}
          hint="Average chance you'd remember a learned card if it came up right now."
        />
        <Tile
          icon={Gauge}
          label="Real retention"
          value={data.last30.retention === null ? "–" : `${data.last30.retention}%`}
          hint={
            data.last30.reviews
              ? `You remembered ${data.last30.remembered} of ${data.last30.reviews} cards that came back after a day or more (last 30 days).`
              : "Shows once cards start coming back after a day or more."
          }
        />
        <Tile icon={CalendarDays} label="Next 7 days" value={String(week)} hint={`${data.dueNow} due right now.`} />
      </div>

      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reviews coming up</h3>
          <span className="text-xs text-slate-400">next 14 days</span>
        </div>
        <Forecast forecast={data.forecast} />
      </section>

      <section className={`${card} p-5`}>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-slate-400" /> Your cards <span className="font-normal text-slate-400">· {counts.total}</span>
        </h3>
        <div className="mt-3 flex h-2.5 rounded-full overflow-hidden gap-[2px] bg-slate-100 dark:bg-white/[0.06]" aria-hidden>
          <span className="bg-sky-600" style={{ width: seg(counts.new) }} />
          <span className="bg-amber-600" style={{ width: seg(counts.learning) }} />
          <span className="bg-emerald-600" style={{ width: seg(counts.review) }} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-600" /> New <span className="tabular-nums font-semibold">{counts.new}</span></li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-600" /> Learning <span className="tabular-nums font-semibold">{counts.learning}</span></li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" /> Learned <span className="tabular-nums font-semibold">{counts.review}</span></li>
        </ul>
      </section>

      <section className={`${card} p-5`}>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Target className="w-4 h-4 text-slate-400" /> How much do you want to remember?
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Cards come back just before you would forget them. A higher target means you forget less, but review more often.
        </p>
        <div role="radiogroup" aria-label="Retention target" className="mt-3 grid grid-cols-4 gap-1.5">
          {data.retentionOptions.map((value) => {
            const selected = Math.abs(value - data.retention) < 0.001;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={setRetention.isPending}
                onClick={() => choose(value)}
                className={`h-11 rounded-xl text-sm font-bold tabular-nums border transition-colors ${
                  selected
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                }`}
              >
                {RETENTION_COPY[String(value)]?.label ?? `${Math.round(value * 100)}%`}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{RETENTION_COPY[String(data.retention)]?.hint}</p>
        <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
          Scheduling uses FSRS, the memory model behind modern Anki: every card learns how hard it is for you.
        </p>
      </section>
    </div>
  );
};

export default MemoryView;
