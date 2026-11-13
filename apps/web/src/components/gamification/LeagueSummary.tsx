import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy } from "lucide-react";
import { useAchievements, useCurrentLeague } from "../../hooks/useGamification";
import { BadgeIcon } from "./BadgeIcon";
import { useT } from "../../i18n";

/** Dashboard card: your league this week and your latest badges */
export const LeagueSummary: React.FC = () => {
  const { data: league } = useCurrentLeague();
  const { data: achievements } = useAchievements();
  const { t } = useT();
  if (!league) return null;

  const me = league.standings.find((s) => s.isMe);
  const zone = me?.zone;
  return (
    <section className="rounded-3xl border border-line bg-surface shadow-sm p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: league.tier.color }}>
            <Trophy className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{t("{tier} league", { tier: t(league.tier.name) })}</p>
            <p className="text-xs text-slate-500 truncate">
              {league.joined && me
                ? `${t("#{rank} of {count}", { rank: me.rank, count: league.standings.length })} · ${me.xp} XP${
                    zone === "promote" ? ` · ${t("in the promotion zone")}` : zone === "demote" ? ` · ${t("in the demotion zone")}` : ""
                  }`
                : t("Earn XP this week to join a group")}
            </p>
          </div>
        </div>
        <Link to="/leagues" className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1 shrink-0">
          {t("See league")} <ArrowRight className="w-3.5 h-3.5" />
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
            {t("{earned} of {total} badges", { earned: achievements.earned, total: achievements.total })}
          </span>
        </Link>
      )}
    </section>
  );
};

export default LeagueSummary;
