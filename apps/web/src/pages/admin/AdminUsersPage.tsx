// apps/web/src/pages/admin/AdminUsersPage.tsx
/** Everyone, searchable by name, email or id, with filters for the people who need attention */

import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Flag, Search, Users } from "lucide-react";
import { Badge, Chip, EmptyState } from "../../components/ui";
import { useAdminUsers } from "../../hooks/useAdmin";
import { AdminTitle, Avatar, LoadingBlock, Pager, RoleBadge } from "../../components/admin/AdminKit";
import { formatNumber, panel, timeAgo, untilText } from "../../lib/adminFormat";

const STATUSES = [
  { value: "all", label: "Everyone" },
  { value: "new", label: "New this week" },
  { value: "active", label: "Active this week" },
  { value: "suspended", label: "Suspended" },
  { value: "staff", label: "Team" },
] as const;

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "active", label: "Last active" },
  { value: "xp", label: "Most XP" },
  { value: "name", label: "Name" },
  { value: "oldest", label: "Oldest" },
] as const;

export const AdminUsersPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "all";
  const sort = params.get("sort") ?? "newest";
  const page = Number(params.get("page")) || 1;
  const [text, setText] = useState(params.get("q") ?? "");
  const q = params.get("q") ?? "";

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || (k === "status" && v === "all") || (k === "sort" && v === "newest") || (k === "page" && v === "1")) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  // Search as you type, after a short pause
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (text.trim() !== q) update({ q: text.trim(), page: null });
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const { data, isLoading, isFetching } = useAdminUsers({ q, status, sort, page });

  return (
    <div className="space-y-5">
      <AdminTitle title="Users" subtitle={data ? `${formatNumber(data.total)} ${data.total === 1 ? "person" : "people"}` : "Everyone on SpeakBetter"} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search users</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Name, email or user id"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:text-sm dark:text-white"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          Sort
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value, page: null })}
            className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:text-white"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map((s) => (
          <Chip key={s.value} selected={status === s.value} onClick={() => update({ status: s.value, page: null })}>
            {s.label}
          </Chip>
        ))}
      </div>

      {isLoading || !data ? (
        <LoadingBlock />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Users} title="Nobody matches" text="Try another name or filter." />
      ) : (
        <div className={`${panel} overflow-hidden ${isFetching ? "opacity-70" : ""}`}>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Users</caption>
            <thead className="hidden border-b border-line bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-header-group dark:bg-white/[0.02]">
              <tr>
                <th scope="col" className="px-4 py-3">Person</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3">Last active</th>
                <th scope="col" className="px-4 py-3 text-right">XP</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((u) => (
                <tr key={u.id} className="block px-4 py-3 hover:bg-slate-50/70 md:table-row md:px-0 md:py-0 dark:hover:bg-white/[0.02]">
                  <td className="block md:table-cell md:px-4 md:py-3">
                    <Link to={`/admin/users/${u.id}`} className="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <Avatar person={u} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-slate-900 group-hover:underline dark:text-white">{u.name}</span>
                          <RoleBadge role={u.role} />
                        </span>
                        <span className="block truncate text-xs text-slate-500">{u.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="inline-block pr-3 pt-2 text-xs text-slate-500 md:table-cell md:px-4 md:py-3 md:text-sm">
                    <span className="md:hidden">Joined </span>
                    {timeAgo(u.createdAt)}
                  </td>
                  <td className="inline-block pr-3 pt-2 text-xs text-slate-500 md:table-cell md:px-4 md:py-3 md:text-sm">
                    <span className="md:hidden">· active </span>
                    {timeAgo(u.lastActive)}
                  </td>
                  <td className="inline-block pr-3 pt-2 text-xs tabular-nums text-slate-600 md:table-cell md:px-4 md:py-3 md:text-right md:text-sm dark:text-slate-300">
                    {formatNumber(u.xp)}
                    <span className="md:hidden"> XP</span>
                  </td>
                  <td className="block pt-2 md:table-cell md:px-4 md:py-3">
                    <span className="flex flex-wrap gap-1.5">
                      {u.suspended ? (
                        <Badge tone="danger">Suspended {untilText(u.suspendedUntil)}</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                      {u.plan === "PRO" && <Badge tone="indigo">Pro</Badge>}
                      {u.reportsAgainst > 0 && (
                        <Badge tone="warning" icon={Flag}>
                          {u.reportsAgainst}
                        </Badge>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => update({ page: String(p) })} />}
    </div>
  );
};

export default AdminUsersPage;
