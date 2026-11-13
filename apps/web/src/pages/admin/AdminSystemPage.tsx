// apps/web/src/pages/admin/AdminSystemPage.tsx
/** Is everything SpeakBetter depends on running, which optional services are switched on, and how big it is */

import React from "react";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Badge } from "../../components/ui";
import { useAdminSystem } from "../../hooks/useAdmin";
import { AdminTitle, LoadingBlock } from "../../components/admin/AdminKit";
import { formatNumber, panel } from "../../lib/adminFormat";

const uptime = (s: number) => {
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

const TABLE_NAMES: Record<string, string> = {
  users: "Accounts",
  messages: "Chat messages",
  reviews: "Flashcard reviews",
  xp: "XP entries",
  notifications: "Notifications",
  audit: "Audit log lines",
};

export const AdminSystemPage: React.FC = () => {
  const { data, isLoading, dataUpdatedAt } = useAdminSystem();
  if (isLoading || !data) return <LoadingBlock rows={6} />;
  const down = data.checks.filter((c) => c.ok === false).length;

  return (
    <div className="space-y-5">
      <AdminTitle
        title="System"
        subtitle={`Checked ${new Date(dataUpdatedAt).toLocaleTimeString()} · refreshes every 30 seconds`}
        actions={down ? <Badge tone="danger">{down} not working</Badge> : <Badge tone="success">All running</Badge>}
      />

      <section className={`${panel} divide-y divide-line`}>
        {data.checks.map((c) => (
          <div key={c.name} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              {c.ok === true ? (
                <CheckCircle2 aria-hidden className="h-5 w-5 text-emerald-600" />
              ) : c.ok === false ? (
                <XCircle aria-hidden className="h-5 w-5 text-red-600" />
              ) : (
                <CircleDashed aria-hidden className="h-5 w-5 text-slate-400" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
                <p className="text-xs text-slate-500">{c.note}</p>
              </div>
            </div>
            <span className="text-xs tabular-nums text-slate-500">{c.ms !== null ? `${c.ms} ms` : ""}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${panel} p-5`}>
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Optional services</h2>
          <p className="mt-0.5 text-xs text-slate-500">Whether each setting is filled in (values are never shown)</p>
          <ul className="mt-3 divide-y divide-line">
            {data.settings.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm text-slate-800 dark:text-slate-200">{s.what}</span>
                  <span className="block font-mono text-[11px] text-slate-500">{s.key}</span>
                </span>
                {s.set ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>}
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-5">
          <section className={`${panel} p-5`}>
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Server</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-slate-500">Mode</dt>
              <dd className="text-slate-900 dark:text-white">{data.server.environment}</dd>
              <dt className="text-slate-500">Running for</dt>
              <dd className="text-slate-900 dark:text-white">{uptime(data.server.uptimeSeconds)}</dd>
              <dt className="text-slate-500">Memory</dt>
              <dd className="text-slate-900 dark:text-white">
                {data.server.memoryMb} MB ({data.server.heapMb} MB in use)
              </dd>
              <dt className="text-slate-500">Node.js</dt>
              <dd className="text-slate-900 dark:text-white">{data.server.node}</dd>
            </dl>
          </section>
          <section className={`${panel} p-5`}>
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Data</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {Object.entries(data.tables).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-slate-500">{TABLE_NAMES[k] ?? k}</dt>
                  <dd className="tabular-nums text-slate-900 dark:text-white">{formatNumber(v)}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemPage;
