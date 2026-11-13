// apps/web/src/pages/admin/AdminBillingPage.tsx
/** Pro members and payments: totals, who has Pro and until when, and every payment */

import React, { useState } from "react";
import { AlertTriangle, Banknote, Crown, Receipt } from "lucide-react";
import { Badge } from "../../components/ui";
import { useAdminBilling } from "../../hooks/useAdmin";
import { AdminTitle, LoadingBlock, Metric, Pager, PersonLink } from "../../components/admin/AdminKit";
import { dateTime, formatMoney, formatNumber, panel, timeAgo } from "../../lib/adminFormat";

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  SUCCEEDED: "success",
  FAILED: "danger",
  PENDING: "warning",
  PROCESSING: "warning",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
};

export const AdminBillingPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminBilling(page);
  if (isLoading || !data) return <LoadingBlock rows={6} />;
  const t = data.totals;

  return (
    <div className="space-y-5">
      <AdminTitle title="Billing" subtitle="Payments run in sandbox (test) mode until a real payment provider is connected." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Crown} tone="violet" label="Pro members" value={formatNumber(t.activePro)} hint={t.byProvider.map((p) => `${p.count} via ${p.provider}`).join(" · ") || "None yet"} />
        <Metric icon={Banknote} tone="emerald" label="Revenue, 30 days" value={formatMoney(t.revenue30)} hint={`${t.payments30} payments`} />
        <Metric icon={Receipt} tone="indigo" label="Revenue, all time" value={formatMoney(t.revenueAll)} hint={`${t.paymentsAll} payments`} />
        <Metric icon={AlertTriangle} tone="amber" label="Failed, 30 days" value={t.failed30} />
      </div>

      <section className={`${panel} p-5`}>
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Pro members (ending soonest first)</h2>
        {data.subscriptions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nobody has Pro yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <PersonLink person={s.user} />
                <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {s.provider === "admin" ? <Badge tone="info">Given by the team</Badge> : <Badge tone="neutral">{s.interval?.toLowerCase() ?? "plan"}</Badge>}
                  {s.cancelAtPeriodEnd && s.provider !== "admin" && <Badge tone="warning">Cancelled</Badge>}
                  until {dateTime(s.endDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${panel} overflow-hidden`}>
        <h2 className="px-5 pt-5 text-[15px] font-bold text-slate-900 dark:text-white">Payments</h2>
        {data.payments.items.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-sm text-slate-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.payments.items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <PersonLink person={p.user} />
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatMoney(p.amount, p.currency)}</span>
                  <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status.toLowerCase()}</Badge>
                  <span className="text-xs text-slate-500">
                    {p.method.toLowerCase()} · {p.interval?.toLowerCase() ?? ""} · {timeAgo(p.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Pager page={data.payments.page} pages={data.payments.pages} total={data.payments.total} onPage={setPage} />
    </div>
  );
};

export default AdminBillingPage;
