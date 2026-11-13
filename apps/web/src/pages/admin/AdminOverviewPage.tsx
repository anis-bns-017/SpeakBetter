// apps/web/src/pages/admin/AdminOverviewPage.tsx
/** How SpeakBetter is doing at a glance: people, activity, rooms, reports, Pro, and what people actually use */

import React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Activity, AudioLines, Crown, Flag, Hash, ShieldBan, UserPlus, Users } from "lucide-react";
import { useAdminOverview, type AdminMe } from "../../hooks/useAdmin";
import { AdminTitle, DailyBars, LoadingBlock, Metric, PersonLink } from "../../components/admin/AdminKit";
import { formatMoney, formatNumber, panel, timeAgo } from "../../lib/adminFormat";

export const AdminOverviewPage: React.FC = () => {
  const me = useOutletContext<AdminMe>();
  const { data, isLoading, isError, refetch } = useAdminOverview();

  if (isLoading) return <LoadingBlock rows={8} />;
  if (isError || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-700 dark:text-slate-300">Couldn't load the overview.</p>
        <button type="button" onClick={() => refetch()} className="mt-3 h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    );
  }

  const maxFeature = Math.max(1, ...data.features.map((f) => f.actions));
  const canBilling = me.permissions.includes("billing");

  return (
    <div className="space-y-6">
      <AdminTitle
        title={`Hello, ${me.name.split(" ")[0]}`}
        subtitle="SpeakBetter right now. Numbers refresh every minute."
      />

      {data.reports.open > 0 && (
        <Link
          to="/admin/reports"
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200"
        >
          <Flag aria-hidden className="h-4 w-4 shrink-0" />
          <span>
            <strong className="tabular-nums">{data.reports.open}</strong> report{data.reports.open === 1 ? "" : "s"} waiting for review
          </span>
          <span className="ml-auto font-semibold">Review now →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Users} label="People" value={formatNumber(data.users.total)} hint={`${data.users.new7} joined this week`} to="/admin/users" />
        <Metric
          icon={Activity}
          tone="emerald"
          label="Active today"
          value={formatNumber(data.active.today)}
          hint={`${formatNumber(data.active.week)} this week · ${formatNumber(data.active.month)} this month`}
        />
        <Metric icon={AudioLines} tone="rose" label="Live rooms" value={data.rooms.live} hint={`${data.rooms.people} people in them now`} to="/admin/content" />
        <Metric
          icon={Flag}
          tone="amber"
          label="Open reports"
          value={data.reports.open}
          hint={`${data.reports.app} in the app · ${data.reports.randomCall} from calls`}
          to="/admin/reports"
        />
        <Metric icon={UserPlus} tone="sky" label="New today" value={data.users.newToday} hint={`${data.users.new30} in 30 days`} />
        <Metric
          icon={Crown}
          tone="violet"
          label="Pro members"
          value={formatNumber(data.pro.active)}
          hint={canBilling ? `${formatMoney(data.pro.revenue30)} in 30 days` : undefined}
          to={canBilling ? "/admin/billing" : undefined}
        />
        <Metric icon={Hash} tone="indigo" label="Communities" value={data.communities.total} hint={`${data.communities.hidden} hidden`} to="/admin/content?tab=communities" />
        <Metric icon={ShieldBan} tone="rose" label="Suspended" value={data.users.suspended} hint={`${data.users.staff} on the team`} to="/admin/users?status=suspended" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyBars title="New sign-ups" data={data.signups} />
        <DailyBars title="People who practised" data={data.learners} tone="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className={`${panel} p-5 lg:col-span-3`}>
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">What people practise</h2>
          <p className="mt-0.5 text-xs text-slate-500">Actions that earned XP in the last 7 days</p>
          {data.features.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">Nobody has practised this week yet.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {data.features.slice(0, 10).map((f) => (
                <li key={f.reason} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
                  <span className="truncate text-slate-700 dark:text-slate-300">{f.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${(f.actions / maxFeature) * 100}%` }} />
                  </span>
                  <span className="tabular-nums text-xs text-slate-500">{formatNumber(f.actions)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${panel} p-5 lg:col-span-2`}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Newest people</h2>
            <Link to="/admin/users?sort=newest" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
              All users
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {data.latestUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <PersonLink person={u} />
                <span className="shrink-0 text-xs text-slate-500">{timeAgo(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AdminOverviewPage;
