// apps/web/src/components/plan/TodayPlanCard.tsx
/**
 * Today's plan: a few tasks that fit the minutes you chose, ticking themselves off as you practise anywhere
 * in the app. Finishing all of them earns a small bonus and keeps the plan streak going.
 */

import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  CheckCircle2,
  Circle,
  Dumbbell,
  Flame,
  Layers,
  Library,
  PenLine,
  Loader2,
  Megaphone,
  Mic,
  PartyPopper,
  Target,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useSetDailyGoal, useTodayPlan, type PlanTask } from "../../hooks/usePlan";

const KIND: Record<PlanTask["kind"], { icon: LucideIcon; tone: string }> = {
  LEVEL: { icon: Target, tone: "bg-fuchsia-500/10 text-fuchsia-500" },
  REVIEW: { icon: Layers, tone: "bg-sky-500/10 text-sky-500" },
  PRONUNCIATION: { icon: AudioLines, tone: "bg-cyan-500/10 text-cyan-500" },
  SPEAK: { icon: Mic, tone: "bg-indigo-500/10 text-indigo-500" },
  CHALLENGE: { icon: Megaphone, tone: "bg-rose-500/10 text-rose-500" },
  READ: { icon: Library, tone: "bg-teal-500/10 text-teal-500" },
  WRITE: { icon: PenLine, tone: "bg-indigo-500/10 text-indigo-500" },
  CORRECTION: { icon: Wand2, tone: "bg-violet-500/10 text-violet-500" },
  WORDS: { icon: BookOpen, tone: "bg-emerald-500/10 text-emerald-500" },
  EXERCISE: { icon: Dumbbell, tone: "bg-rose-500/10 text-rose-500" },
};

const UNIT: Record<PlanTask["unit"], [string, string]> = {
  test: ["test", "tests"],
  cards: ["card", "cards"],
  tries: ["try", "tries"],
  minutes: ["min", "min"],
  answers: ["answer", "answers"],
  texts: ["text", "texts"],
  pieces: ["piece", "pieces"],
  corrections: ["correction", "corrections"],
  words: ["word", "words"],
  exercises: ["exercise", "exercises"],
};

const progressText = (t: PlanTask) => {
  if (t.done) return "Done";
  if (t.unit === "test") return `${t.minutes} min`;
  return `${t.progress} / ${t.target} ${UNIT[t.unit][t.target === 1 ? 0 : 1]}`;
};

export const TodayPlanCard: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { data: plan, isLoading, isError, refetch } = useTodayPlan();
  const setGoal = useSetDailyGoal();
  const celebrated = useRef<string | null>(null);

  // One cheer per day, the moment the last task is ticked off
  useEffect(() => {
    if (plan?.bonusJustEarned && celebrated.current !== plan.day) {
      celebrated.current = plan.day;
      toast.success(`Today's plan is done! +${plan.bonusXp} XP`, { icon: "🎉" });
    }
  }, [plan?.bonusJustEarned, plan?.day, plan?.bonusXp]);

  const card =
    "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

  if (isLoading) {
    return (
      <section className={`${card} p-6 ${className}`}>
        <div className="h-5 w-40 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !plan) {
    return (
      <section className={`${card} p-6 text-center ${className}`}>
        <p className="text-sm text-slate-500">Today's plan didn't load.</p>
        <button type="button" onClick={() => refetch()} className="mt-3 h-9 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
          Try again
        </button>
      </section>
    );
  }

  const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
  const complete = !!plan.completedAt;

  return (
    <section className={`${card} p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Today's plan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {complete
              ? `All done for today. +${plan.bonusXp} XP`
              : `${plan.done} of ${plan.total} done · about ${plan.minutesPlanned} minutes`}
            {plan.streak > 0 && (
              <span className="ml-2 inline-flex items-center gap-0.5 text-orange-500 font-semibold">
                <Flame className="w-3.5 h-3.5" /> {plan.streak} day{plan.streak === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] p-1" role="radiogroup" aria-label="Minutes a day">
          {plan.goalOptions.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={plan.goalMinutes === m}
              disabled={setGoal.isPending}
              onClick={() => plan.goalMinutes !== m && setGoal.mutate(m, { onError: () => toast.error("Couldn't change your daily goal") })}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors ${
                plan.goalMinutes === m
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {m} min
            </button>
          ))}
          {setGoal.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 mx-1" />}
        </div>
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden" aria-hidden>
        <div className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
      </div>

      {complete && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
          <PartyPopper className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            Brilliant! Come back tomorrow for a new plan{plan.streak > 1 ? ` and make it ${plan.streak + 1} days in a row` : ""}.
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {plan.tasks.map((t) => {
          const { icon: Icon, tone } = KIND[t.kind];
          return (
            <li key={t.id}>
              <Link
                to={t.to}
                className={`group flex items-center gap-3.5 p-3 rounded-2xl border border-transparent transition-colors ${
                  t.done ? "opacity-70" : "hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                }`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold truncate ${t.done ? "line-through text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
                    {t.title}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{t.detail}</span>
                </span>
                <span className="text-xs font-semibold tabular-nums shrink-0 text-slate-500 dark:text-slate-400 hidden sm:block">{progressText(t)}</span>
                {t.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" aria-label="Done" />
                ) : (
                  <span className="flex items-center gap-1 shrink-0">
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:hidden" aria-hidden />
                    <ArrowRight className="w-5 h-5 text-indigo-500 hidden group-hover:block" aria-hidden />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default TodayPlanCard;
