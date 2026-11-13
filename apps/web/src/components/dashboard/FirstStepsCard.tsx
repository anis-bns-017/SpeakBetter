// apps/web/src/components/dashboard/FirstStepsCard.tsx
/**
 * A new learner's first week, as a short checklist on the dashboard. Each step ticks itself off from real
 * progress (nothing to mark by hand). Shown for an account's first 14 days, until everything is done or the
 * learner hides it.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AudioLines, BookmarkPlus, Check, Flame, Target, Trophy, X, type LucideIcon } from "lucide-react";
import type { DashboardData } from "../../hooks/useLearning";
import { useT } from "../../i18n";
import { tr } from "../../i18n/core";

const HIDE_KEY = "sb.firstSteps.hidden";
const SHOW_FOR_DAYS = 14;

interface Step {
  id: string;
  icon: LucideIcon;
  title: string;
  to: string;
  done: boolean;
}

export const FirstStepsCard: React.FC<{ data: DashboardData; createdAt?: string; hasLevel: boolean }> = ({ data, createdAt, hasLevel }) => {
  const { t } = useT();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Read the clock once per mount: the card's 14-day window doesn't need to move while the page is open
  const [now] = useState(() => Date.now());
  const age = createdAt ? (now - new Date(createdAt).getTime()) / 86_400_000 : Infinity;
  const steps: Step[] = [
    { id: "level", icon: Target, title: t("Know your level"), to: "/placement", done: hasLevel },
    { id: "room", icon: AudioLines, title: t("Join a voice room"), to: "/voice", done: data.voice.roomsJoined > 0 },
    { id: "word", icon: BookmarkPlus, title: t("Save your first word"), to: "/dictionary", done: data.words.total > 0 },
    { id: "goal", icon: Trophy, title: t("Reach your daily goal once"), to: "/dashboard", done: data.xp.today >= data.xp.dailyGoal || data.streak.longest >= 1 },
    { id: "streak", icon: Flame, title: t("Practise 3 days in a row"), to: "/progress", done: data.streak.longest >= 3 },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (hidden || age > SHOW_FOR_DAYS || doneCount === steps.length) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* hidden for this visit */
    }
  };

  return (
    <section aria-labelledby="first-steps" className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="first-steps" className="text-[15px] font-bold text-slate-900 dark:text-white">
            {t("Your first steps")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{t("{done} of {total} done", { done: doneCount, total: steps.length })}</p>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label={t("Hide first steps")}
          title={t("Hide first steps")}
          className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]" aria-hidden>
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              to={s.to}
              className={`flex h-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                s.done
                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"
                  : "border-line bg-page text-slate-800 hover:border-slate-300 dark:text-slate-200 dark:hover:border-white/20"
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"}`}>
                {s.done ? <Check aria-hidden className="h-4 w-4" /> : <s.icon aria-hidden className="h-4 w-4" />}
              </span>
              <span className={s.done ? "line-through decoration-emerald-400/70" : "font-medium"}>{tr(s.title)}</span>
              <span className="sr-only">{s.done ? t("(done)") : t("(to do)")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FirstStepsCard;
