import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy } from "lucide-react";
import { useAchievements, useCurrentLeague } from "../../hooks/useGamification";
import { BadgeIcon } from "./BadgeIcon";

/** Dashboard card: your league this week and your latest badges */
export const LeagueSummary: React.FC = () => {
  const { data: league } = useCurrentLeague();
  const { data: achievements } = useAchievements();
  if (!league) return null;

  const me = league.standings.find((s) => s.isMe);
  const zone = me?.zone;
  return (
    <section className="rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: league.tier.color }}>
            <Trophy className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{league.tier.name} league</p>
            <p className="text-xs text-slate-500 truncate">
              {league.joined && me
                ? `#${me.rank} of ${league.standings.length} · ${me.xp} XP${
                    zone === "promote" ? " · in the promotion zone" : zone === "demote" ? " · in the demotion zone" : ""
                  }`
                : "Earn XP this week to join a group"}
            </p>
          </div>
        </div>
        <Link to="/leagues" className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1 shrink-0">
          See league <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {achievements && (
        <Link to="/leagues?tab=badges" className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-white/[0.05]">
          <div className="flex -space-x-2">
            {achievements.recent.length ? (
              achievements.recent.map((b) => <BadgeIcon key={b.key} icon={b.icon} tier={b.tier} earned size={32} />)
            ) : (
              <BadgeIcon icon="Flame" tier="BRONZE" earned={false} size={32} />
            )}
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">{achievements.earned}</span> of {achievements.total} badges
          </span>
        </Link>
      )}
    </section>
  );
};

export default LeagueSummary;
