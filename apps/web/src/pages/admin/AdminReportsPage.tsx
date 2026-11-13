// apps/web/src/pages/admin/AdminReportsPage.tsx
/**
 * The moderation queue: every report, oldest first, with the reported message or person right there. One dialog
 * closes a report and, if needed, warns or suspends the person and removes the message in the same step.
 */

import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Flag, MessageSquareX, Phone, ShieldCheck, UserX } from "lucide-react";
import { Badge, Button, Chip } from "../../components/ui";
import {
  adminApi,
  adminError,
  useAdminAction,
  useAdminReports,
  type AdminMe,
  type ReportItem,
} from "../../hooks/useAdmin";
import { ActionDialog, AdminTitle, LoadingBlock, Pager, PersonLink, ReasonField, SuspendChoice } from "../../components/admin/AdminKit";
import { panel, timeAgo } from "../../lib/adminFormat";

type State = "open" | "closed" | "all";
type Source = "all" | "app" | "random-call";

const REASONS: Record<string, string> = {
  HARASSMENT: "Harassment",
  SEXUAL: "Sexual content",
  HATE: "Hate",
  SPAM: "Spam",
  UNDERAGE: "Under age",
  OTHER: "Other",
};

const ResolveDialog: React.FC<{ item: ReportItem | null; isAdmin: boolean; onClose: () => void }> = ({ item, isAdmin, onClose }) => {
  const [decision, setDecision] = useState<"dismiss" | "action">("action");
  const [note, setNote] = useState("");
  const [warn, setWarn] = useState("");
  const [days, setDays] = useState(-1);
  const [deleteContent, setDeleteContent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolve = useAdminAction(() =>
    adminApi.resolveReport(item!.source, item!.id, {
      decision,
      note: note.trim() || undefined,
      ...(decision === "action"
        ? {
            warn: days === -1 && warn.trim() ? warn.trim() : undefined,
            suspendDays: days > 0 ? days : undefined,
            permanent: days === 0 ? true : undefined,
            deleteContent: hasMessage ? deleteContent : undefined,
          }
        : {}),
    }),
  );
  if (!item) return null;
  const hasMessage = (item.targetType === "message" || item.targetType === "room-message") && !item.contentDeleted && !!item.content;

  return (
    <ActionDialog
      open
      title="Close this report"
      description={
        <>
          {REASONS[item.reason] ?? item.reason} · reported by {item.reporter?.name ?? "someone"} {timeAgo(item.createdAt)}
        </>
      }
      confirmLabel={decision === "dismiss" ? "Dismiss report" : "Take action"}
      danger={decision === "action" && days === 0}
      busy={resolve.isPending}
      error={error}
      onClose={onClose}
      onConfirm={() =>
        resolve.mutate(undefined, {
          onSuccess: () => {
            toast.success(decision === "dismiss" ? "Report dismissed" : "Report resolved");
            onClose();
          },
          onError: (e) => setError(adminError(e)),
        })
      }
    >
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800 dark:text-slate-200">Decision</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["action", "dismiss"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={decision === d}
              onClick={() => setDecision(d)}
              className={`rounded-2xl border p-3 text-left text-sm ${decision === d ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-400/15" : "border-line bg-surface hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`}
            >
              <span className="block font-semibold text-slate-900 dark:text-white">{d === "action" ? "The report is right" : "Nothing wrong"}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{d === "action" ? "Act on it below" : "Close without action"}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {decision === "action" && (
        <>
          {hasMessage && (
            <label className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={deleteContent} onChange={(e) => setDeleteContent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
              Remove the reported message
            </label>
          )}
          {item.subject && (
            <>
              <SuspendChoice value={days} onChange={setDays} isAdmin={isAdmin} allowNone />
              {days === -1 && (
                <ReasonField
                  label={`Warn ${item.subject.name} (optional)`}
                  hint="They see this in their notifications."
                  value={warn}
                  onChange={setWarn}
                  rows={2}
                />
              )}
            </>
          )}
        </>
      )}
      <ReasonField
        label="Note for the log"
        hint={decision === "action" && days >= 0 && item.subject ? "Also shown to them as the reason for the suspension." : "Only the team sees this."}
        value={note}
        onChange={setNote}
        rows={2}
      />
    </ActionDialog>
  );
};

const ReportCard: React.FC<{ item: ReportItem; onResolve: () => void }> = ({ item, onResolve }) => (
  <li className={`${panel} p-4 sm:p-5`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.reason === "SEXUAL" || item.reason === "HATE" || item.reason === "UNDERAGE" ? "danger" : "warning"} icon={Flag}>
          {REASONS[item.reason] ?? item.reason}
        </Badge>
        <Badge tone="neutral" icon={item.source === "random-call" ? Phone : undefined}>
          {item.where ?? (item.targetType === "user" ? "Profile" : item.targetType)}
        </Badge>
        {!item.open && <Badge tone={item.status === "REJECTED" || item.status === "DISMISSED" ? "neutral" : "success"}>{item.status.toLowerCase()}</Badge>}
        <span className="text-xs text-slate-500">{timeAgo(item.createdAt)}</span>
      </div>
      {item.open && (
        <Button size="sm" icon={ShieldCheck} onClick={onResolve}>
          Review
        </Button>
      )}
    </div>

    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <p className="t-eyebrow text-slate-500">About</p>
        <div className="mt-1.5">
          <PersonLink person={item.subject} sub={item.subject ? "Open their account" : undefined} />
        </div>
      </div>
      <div>
        <p className="t-eyebrow text-slate-500">Reported by</p>
        <div className="mt-1.5">
          <PersonLink person={item.reporter} sub={item.reporter ? "Reporter" : undefined} />
        </div>
      </div>
    </div>

    {(item.content || item.contentDeleted) && (
      <blockquote
        className={`mt-4 rounded-2xl border-l-4 px-4 py-3 text-sm ${item.contentDeleted ? "border-slate-300 bg-slate-50 text-slate-500 italic dark:border-white/20 dark:bg-white/[0.03]" : "border-amber-400 bg-amber-50/70 text-slate-800 dark:bg-amber-400/10 dark:text-slate-100"}`}
      >
        {item.contentDeleted ? (
          <span className="inline-flex items-center gap-1.5">
            <MessageSquareX aria-hidden className="h-4 w-4" /> The message has been removed
          </span>
        ) : (
          item.content
        )}
      </blockquote>
    )}
    {item.details && (
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Reporter says:</span> {item.details}
      </p>
    )}
    {item.resolution && !item.open && <p className="mt-2 text-xs text-slate-500">Note: {item.resolution}</p>}
  </li>
);

export const AdminReportsPage: React.FC = () => {
  const me = useOutletContext<AdminMe>();
  const [state, setState] = useState<State>("open");
  const [source, setSource] = useState<Source>("all");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<ReportItem | null>(null);
  const { data, isLoading } = useAdminReports({ state, source: source === "all" ? undefined : source, page });

  return (
    <div className="space-y-5">
      <AdminTitle
        title="Reports"
        subtitle={data ? `${data.counts.open} open · oldest first, so nobody waits too long` : "What people have reported"}
      />
      <div className="flex flex-wrap gap-2">
        {(["open", "closed", "all"] as const).map((s) => (
          <Chip key={s} selected={state === s} onClick={() => (setState(s), setPage(1))} count={s === "open" ? data?.counts.open : undefined}>
            {s === "open" ? "Open" : s === "closed" ? "Handled" : "All"}
          </Chip>
        ))}
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden />
        {(["all", "app", "random-call"] as const).map((s) => (
          <Chip key={s} selected={source === s} onClick={() => (setSource(s), setPage(1))}>
            {s === "all" ? "Everywhere" : s === "app" ? "Chat & rooms" : "Random calls"}
          </Chip>
        ))}
      </div>

      {isLoading || !data ? (
        <LoadingBlock rows={4} />
      ) : data.items.length === 0 ? (
        <div className={`${panel} px-6 py-14 text-center`}>
          {state === "open" ? (
            <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-emerald-500" />
          ) : (
            <UserX aria-hidden className="mx-auto h-10 w-10 text-slate-400" />
          )}
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">{state === "open" ? "All clear" : "Nothing here"}</p>
          <p className="mt-1 text-sm text-slate-500">{state === "open" ? "No reports are waiting for review." : "No reports match these filters."}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.items.map((item) => (
            <ReportCard key={item.key} item={item} onResolve={() => setActive(item)} />
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}

      <ResolveDialog key={active?.key ?? "none"} item={active} isAdmin={me.role === "ADMIN"} onClose={() => setActive(null)} />
    </div>
  );
};

export default AdminReportsPage;
