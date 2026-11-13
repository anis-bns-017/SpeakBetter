// apps/web/src/pages/admin/AdminAuditPage.tsx
/** Every action the team has taken: who, what, when and why. Nothing here can be edited or deleted. */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";
import { Chip, EmptyState } from "../../components/ui";
import { useAdminAudit } from "../../hooks/useAdmin";
import { AdminTitle, LoadingBlock, Pager } from "../../components/admin/AdminKit";
import { dateTime, panel } from "../../lib/adminFormat";

const GROUPS = [
  { value: "", label: "Everything" },
  { value: "user.", label: "Accounts" },
  { value: "report.", label: "Reports" },
  { value: "room.", label: "Rooms" },
  { value: "community.", label: "Communities" },
  { value: "message.", label: "Messages" },
  { value: "broadcast.", label: "Announcements" },
];

export const AdminAuditPage: React.FC = () => {
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminAudit({ action, q, page });

  return (
    <div className="space-y-5">
      <AdminTitle title="Audit log" subtitle="Every action taken in the admin section. Lines are never edited or removed." />
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => (setQ(e.target.value), setPage(1))}
          placeholder="Search the log (a name, a reason…)"
          aria-label="Search the log"
          className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:text-sm dark:text-white"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {GROUPS.map((g) => (
            <Chip key={g.value} selected={action === g.value} onClick={() => (setAction(g.value), setPage(1))}>
              {g.label}
            </Chip>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <LoadingBlock />
      ) : data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing logged" text="Actions taken in the admin section appear here." />
      ) : (
        <ol className={`${panel} divide-y divide-line`}>
          {data.items.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-200">{e.summary}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <span className="font-mono">{e.action}</span>
                  {e.targetType === "user" && e.targetId && (
                    <>
                      {" · "}
                      <Link to={`/admin/users/${e.targetId}`} className="text-indigo-700 hover:underline dark:text-indigo-300">
                        open account
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-xs text-slate-500 sm:text-right">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{e.actorName}</span>
                <br className="hidden sm:block" /> <span className="sm:hidden">· </span>
                {dateTime(e.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
    </div>
  );
};

export default AdminAuditPage;
