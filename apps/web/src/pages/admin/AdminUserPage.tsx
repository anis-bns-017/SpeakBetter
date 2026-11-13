// apps/web/src/pages/admin/AdminUserPage.tsx
/**
 * One person, for the team: who they are, how they use SpeakBetter, reports about them, their sessions and
 * everything the team has done to the account, with the actions their role allows.
 */

import React, { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  Crown,
  ExternalLink,
  Flag,
  LogOut,
  MessageSquareWarning,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { Badge, Button } from "../../components/ui";
import { deviceName } from "../../lib/device";
import { adminApi, adminError, useAdminAction, useAdminUser, type AdminMe, type PlatformRole } from "../../hooks/useAdmin";
import { ActionDialog, Avatar, LoadingBlock, ReasonField, RoleBadge, SuspendChoice } from "../../components/admin/AdminKit";
import { dateTime, formatMoney, formatNumber, panel, timeAgo, untilText } from "../../lib/adminFormat";

type Dialog = null | "warn" | "suspend" | "unsuspend" | "signout" | "role" | "pro" | "delete";


export const AdminUserPage: React.FC = () => {
  const { userId = "" } = useParams();
  const me = useOutletContext<AdminMe>();
  const navigate = useNavigate();
  const { data: user, isLoading, isError } = useAdminUser(userId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [days, setDays] = useState(7);
  const [role, setRole] = useState<PlatformRole>("USER");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = me.role === "ADMIN";
  const self = user?.id === me.id;
  // Moderators act on normal accounts only (the server checks this too)
  const canAct = !!user && !self && (isAdmin || user.role === "USER");

  const open = (d: Dialog) => {
    setText("");
    setConfirm("");
    setError(null);
    setDays(7);
    if (d === "role" && user) setRole(user.role);
    if (d === "pro") setDays(30);
    setDialog(d);
  };
  const close = () => setDialog(null);

  const action = useAdminAction(async (d: Dialog) => {
    const id = userId;
    switch (d) {
      case "warn":
        return adminApi.warn(id, text);
      case "suspend":
        return adminApi.suspend(id, days === 0 ? { permanent: true, reason: text } : { days, reason: text });
      case "unsuspend":
        return adminApi.unsuspend(id, text);
      case "signout":
        return adminApi.signOut(id);
      case "role":
        return adminApi.setRole(id, role);
      case "pro":
        return adminApi.grantPro(id, days, text);
      case "delete":
        return adminApi.deleteUser(id, confirm, text);
      default:
        return null;
    }
  });

  const run = (d: Dialog, done: string) =>
    action.mutate(d, {
      onSuccess: () => {
        toast.success(done);
        close();
        if (d === "delete") navigate("/admin/users", { replace: true });
      },
      onError: (e) => setError(adminError(e)),
    });

  if (isLoading) return <LoadingBlock rows={6} />;
  if (isError || !user) {
    return (
      <div className="py-16 text-center">
        <p className="font-semibold text-slate-900 dark:text-white">This account wasn't found</p>
        <Link to="/admin/users" className="mt-3 inline-block text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
          Back to users
        </Link>
      </div>
    );
  }

  const stats = [
    { label: "XP in all", value: formatNumber(user.stats.xpTotal) },
    { label: "XP, 30 days", value: formatNumber(user.stats.xp30) },
    { label: "Messages", value: formatNumber(user.stats.messages) },
    { label: "Rooms joined", value: formatNumber(user.stats.rooms) },
    { label: "Flashcards", value: formatNumber(user.stats.flashcards) },
    { label: "Friends", value: formatNumber(user.stats.friends) },
    { label: "Reports made", value: formatNumber(user.stats.reportsMade) },
  ];

  return (
    <div className="space-y-5">
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft aria-hidden className="h-4 w-4" /> All users
      </Link>

      <section className={`${panel} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar person={user} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{user.name}</h1>
              <RoleBadge role={user.role} />
              {user.plan === "PRO" && <Badge tone="indigo" icon={Crown}>Pro</Badge>}
              {user.suspended ? <Badge tone="danger" icon={Ban}>Suspended {untilText(user.suspendedUntil)}</Badge> : <Badge tone="success">Active</Badge>}
            </div>
            <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
            <p className="mt-1 text-xs text-slate-500">
              Joined {dateTime(user.createdAt)} · signs in with {user.signIn === "google" ? "Google" : "a password"} · last active {timeAgo(user.profile?.lastActive)}
              {user.profile?.level ? ` · level ${user.profile.level}` : ""}
              {user.profile?.country ? ` · ${user.profile.country}` : ""}
            </p>
            {user.suspended && user.suspensionReason && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">Reason: {user.suspensionReason}</p>
            )}
          </div>
          <Link
            to={`/u/${user.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.05]"
          >
            Public profile <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </div>

        {self ? (
          <p className="mt-5 text-sm text-slate-500">This is your own account. Account actions are turned off here.</p>
        ) : !canAct ? (
          <p className="mt-5 text-sm text-slate-500">Moderators can't act on team accounts. Ask an admin.</p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
            <Button variant="secondary" size="sm" icon={MessageSquareWarning} onClick={() => open("warn")}>
              Warn
            </Button>
            {user.suspended ? (
              <Button variant="secondary" size="sm" icon={RotateCcw} onClick={() => open("unsuspend")} disabled={user.permanent && !isAdmin}>
                Lift suspension
              </Button>
            ) : (
              user.role !== "ADMIN" && (
                <Button variant="secondary" size="sm" icon={Ban} onClick={() => open("suspend")}>
                  Suspend
                </Button>
              )
            )}
            <Button variant="secondary" size="sm" icon={LogOut} onClick={() => open("signout")}>
              Sign out everywhere
            </Button>
            {isAdmin && (
              <>
                <Button variant="secondary" size="sm" icon={UserCog} onClick={() => open("role")}>
                  Change role
                </Button>
                <Button variant="secondary" size="sm" icon={Crown} onClick={() => open("pro")}>
                  Give Pro
                </Button>
                {user.role !== "ADMIN" && (
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => open("delete")} className="text-red-700 dark:text-red-300">
                    Delete account
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className={`${panel} p-4`}>
            <p className="font-display text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${panel} p-5`}>
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
            <Flag aria-hidden className="h-4 w-4 text-amber-600" /> Reports about them
          </h2>
          {user.reportsAgainst.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">None.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {user.reportsAgainst.map((r) => (
                <li key={`${r.source}:${r.id}`} className="py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{r.reason.toLowerCase()}</span>
                    <Badge tone="neutral">{r.source === "random-call" ? "Random call" : "Chat & rooms"}</Badge>
                    <span className="text-xs text-slate-500">
                      by {r.reporter.name} · {timeAgo(r.createdAt)} · {r.status.toLowerCase()}
                    </span>
                  </div>
                  {r.details && <p className="mt-1 text-slate-600 dark:text-slate-400">{r.details}</p>}
                </li>
              ))}
            </ul>
          )}
          {user.randomCall && (user.randomCall.permanentlyBanned || user.randomCall.restrictedUntil) && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
              Random calls {user.randomCall.permanentlyBanned ? "blocked permanently" : `paused until ${dateTime(user.randomCall.restrictedUntil)}`}
              {user.randomCall.restrictionReason ? `: ${user.randomCall.restrictionReason}` : ""}
            </p>
          )}
        </section>

        <section className={`${panel} p-5`}>
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
            <ShieldCheck aria-hidden className="h-4 w-4 text-indigo-600" /> Team actions on this account
          </h2>
          {user.history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">None yet.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {user.history.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="text-slate-800 dark:text-slate-200">{h.summary}</p>
                  <p className="text-xs text-slate-500">
                    {h.actorName} · {dateTime(h.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={`${panel} p-5`}>
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Signed in on</h2>
          {user.sessions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No active sessions.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {user.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-slate-800 dark:text-slate-200">{deviceName(s.userAgent)}</span>
                  <span className="text-right text-xs text-slate-500">
                    {s.ip ?? "IP unknown"} · used {timeAgo(s.lastUsedAt ?? s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${panel} p-5`}>
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Plan and payments</h2>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
            {user.plan === "PRO"
              ? `Pro ${user.subscription?.endDate ? `until ${dateTime(user.subscription.endDate)}` : ""}${user.subscription?.provider === "admin" ? " (given by the team)" : ""}`
              : "Free plan"}
          </p>
          {user.payments.length > 0 && (
            <ul className="mt-3 divide-y divide-line">
              {user.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{formatMoney(p.amount, p.currency)}</span>
                  <span className="text-xs text-slate-500">
                    {p.status.toLowerCase()} · {timeAgo(p.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------------- dialogs ---------------- */}
      <ActionDialog
        open={dialog === "warn"}
        title={`Warn ${user.name}`}
        description="They get this as a notification from the SpeakBetter team. Be clear and kind."
        confirmLabel="Send warning"
        busy={action.isPending}
        disabled={text.trim().length < 3}
        error={error}
        onClose={close}
        onConfirm={() => run("warn", "Warning sent")}
      >
        <ReasonField label="Message" value={text} onChange={setText} rows={4} />
      </ActionDialog>

      <ActionDialog
        open={dialog === "suspend"}
        title={`Suspend ${user.name}`}
        description="They are signed out everywhere at once and can't sign in until the suspension ends. They see the reason when they try."
        confirmLabel={days === 0 ? "Close account" : "Suspend"}
        danger
        busy={action.isPending}
        disabled={text.trim().length < 3}
        error={error}
        onClose={close}
        onConfirm={() => run("suspend", days === 0 ? "Account closed" : `Suspended for ${days} days`)}
      >
        <SuspendChoice value={days} onChange={setDays} isAdmin={isAdmin} />
        <ReasonField label="Reason (shown to them)" value={text} onChange={setText} />
      </ActionDialog>

      <ActionDialog
        open={dialog === "unsuspend"}
        title={`Lift ${user.name}'s suspension`}
        description="They can sign in again straight away."
        confirmLabel="Lift suspension"
        busy={action.isPending}
        error={error}
        onClose={close}
        onConfirm={() => run("unsuspend", "Suspension lifted")}
      >
        <ReasonField label="Note for the log (optional)" value={text} onChange={setText} rows={2} />
      </ActionDialog>

      <ActionDialog
        open={dialog === "signout"}
        title={`Sign ${user.name} out everywhere?`}
        description="Every device they're signed in on is signed out. Useful if their account may have been taken over."
        confirmLabel="Sign out everywhere"
        busy={action.isPending}
        error={error}
        onClose={close}
        onConfirm={() => run("signout", "Signed out everywhere")}
      />

      <ActionDialog
        open={dialog === "role"}
        title={`${user.name}'s role`}
        description="Moderators handle reports, users and content. Admins can also change roles, give Pro, delete accounts, send announcements and see billing."
        confirmLabel="Save role"
        busy={action.isPending}
        disabled={role === user.role}
        error={error}
        onClose={close}
        onConfirm={() => run("role", "Role changed")}
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">Role</legend>
          {(["USER", "MODERATOR", "ADMIN"] as const).map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm ${role === r ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-400/15" : "border-line"}`}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="h-4 w-4 accent-indigo-600" />
              <span className="font-semibold text-slate-900 dark:text-white">{r === "USER" ? "Learner" : r === "MODERATOR" ? "Moderator" : "Admin"}</span>
            </label>
          ))}
        </fieldset>
      </ActionDialog>

      <ActionDialog
        open={dialog === "pro"}
        title={`Give ${user.name} Pro`}
        description="Added on top of any Pro time they already have. No payment is taken."
        confirmLabel={`Give ${days} days`}
        busy={action.isPending}
        error={error}
        onClose={close}
        onConfirm={() => run("pro", `Gave ${days} days of Pro`)}
      >
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={`h-9 rounded-xl border px-3 text-[13px] font-semibold ${days === d ? "border-indigo-600 bg-indigo-600 text-white" : "border-line text-slate-700 dark:text-slate-200"}`}
            >
              {d === 365 ? "1 year" : `${d} days`}
            </button>
          ))}
        </div>
        <ReasonField label="Note for the log (optional)" value={text} onChange={setText} rows={2} />
      </ActionDialog>

      <ActionDialog
        open={dialog === "delete"}
        title={`Delete ${user.name}'s account?`}
        description={
          <>
            Everything they made is deleted with it: messages, rooms, cards, progress. <strong>This can't be undone.</strong> The audit log keeps a
            note of who it was.
          </>
        }
        confirmLabel="Delete forever"
        danger
        busy={action.isPending}
        disabled={confirm.trim().toLowerCase() !== user.email.toLowerCase() || text.trim().length < 3}
        error={error}
        onClose={close}
        onConfirm={() => run("delete", "Account deleted")}
      >
        <ReasonField label="Reason" value={text} onChange={setText} rows={2} />
        <div>
          <label htmlFor="confirm-email" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
            Type <span className="font-mono">{user.email}</span> to confirm
          </label>
          <input
            id="confirm-email"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 sm:text-sm dark:text-white"
          />
        </div>
      </ActionDialog>
    </div>
  );
};

export default AdminUserPage;
