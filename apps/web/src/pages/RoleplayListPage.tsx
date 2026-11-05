// apps/web/src/pages/RoleplayListPage.tsx
/** Role-play: everyday conversations to practise out loud, by level */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Drama, Loader2 } from "lucide-react";
import { useScenarios, type ScenarioLevel } from "../hooks/useRoleplay";
import { scenarioIcon } from "../components/roleplay/scenarioIcons";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const RoleplayListPage: React.FC = () => {
  const { data, isLoading, isError } = useScenarios();
  const [picked, setPicked] = useState<ScenarioLevel | "all">("all");

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>Couldn't load the scenarios. Refresh to try again.</div>;
  }

  const shown = picked === "all" ? data.scenarios : data.scenarios.filter((s) => s.level === picked);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0">
          <Drama className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Role-play</h1>
          <p className="text-sm text-slate-500">Practise real conversations out loud before you have them for real.</p>
        </div>
        <span className="text-xs text-slate-500 tabular-nums shrink-0">{data.done} of {data.scenarios.length} done</span>
      </header>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Level">
        {(["all", ...data.levels.map((l) => l.level)] as Array<ScenarioLevel | "all">).map((lv) => (
          <button
            key={lv}
            type="button"
            role="tab"
            aria-selected={picked === lv}
            onClick={() => setPicked(lv)}
            className={`h-9 px-3.5 rounded-full text-xs font-semibold border transition-colors ${
              picked === lv
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
            }`}
          >
            {lv === "all" ? "All" : lv}
            {lv === data.level && <span className="opacity-70"> · you</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shown.map((s) => {
          const Icon = scenarioIcon(s.icon);
          return (
            <Link key={s.id} to={`/roleplay/${s.id}`} className={`${card} p-5 hover:-translate-y-0.5 hover:shadow-md transition-all block`}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-300">
                  <Icon className="w-3.5 h-3.5" /> {s.level}
                </span>
                {s.done ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {s.bestScore !== null ? `Best ${s.bestScore}` : "Done"}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">{s.turns} turns</span>
                )}
              </div>
              <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{s.title}</h2>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{s.setting}</p>
              <p className="mt-3 text-[11px] text-slate-400">With: {s.partner}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RoleplayListPage;
