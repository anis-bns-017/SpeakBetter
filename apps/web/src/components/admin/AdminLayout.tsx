// apps/web/src/components/admin/AdminLayout.tsx
/**
 * The admin section's frame: its own navigation (left on wide screens, a scrolling row on phones), the current
 * role, and a way back to the app. Only moderators and admins get in; everyone else sees why not.
 * Admin-only screens are hidden from moderators (the server refuses them too).
 */

import React, { Suspense } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Banknote,
  Flag,
  LayoutDashboard,
  Loader2,
  Megaphone,
  ScrollText,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Shapes,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAdminMe, useAdminReports } from "../../hooks/useAdmin";
import { ErrorBoundary, PageLoading } from "../common/ErrorBoundary";

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  end?: boolean;
}

const NAV: NavEntry[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, permission: "overview", end: true },
  { to: "/admin/reports", label: "Reports", icon: Flag, permission: "reports" },
  { to: "/admin/users", label: "Users", icon: Users, permission: "users.view" },
  { to: "/admin/content", label: "Rooms & communities", icon: Shapes, permission: "content" },
  { to: "/admin/broadcast", label: "Announcements", icon: Megaphone, permission: "broadcast" },
  { to: "/admin/billing", label: "Billing", icon: Banknote, permission: "billing" },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "audit" },
  { to: "/admin/system", label: "System", icon: ServerCog, permission: "system" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-xl px-3 h-10 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
    isActive
      ? "bg-indigo-600 text-white shadow-sm"
      : "text-slate-700 hover:bg-slate-900/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.06]"
  }`;

const OpenReports: React.FC = () => {
  const { data } = useAdminReports({ state: "open", page: 1 });
  const open = data?.counts.open ?? 0;
  return open > 0 ? (
    <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white" aria-label={`${open} open`}>
      {open}
    </span>
  ) : null;
};

export const AdminLayout: React.FC = () => {
  const { data: me, isLoading, isError } = useAdminMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page" role="status" aria-label="Loading">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isError || !me || me.role === "USER") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page px-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
            <ShieldAlert aria-hidden className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">This area is for the SpeakBetter team</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your account doesn't have a moderator or admin role.</p>
          <Link to="/dashboard" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700">
            <ArrowLeft aria-hidden className="h-4 w-4" /> Back to the app
          </Link>
        </div>
      </div>
    );
  }

  const nav = NAV.filter((n) => me.permissions.includes(n.permission));
  // A page this role can't use (an admin-only page opened by a link): say so instead of failing to load
  const current = NAV.find((n) => !n.end && location.pathname.startsWith(n.to));
  const blocked = !!current && !me.permissions.includes(current.permission);

  return (
    <div className="min-h-dvh bg-page lg:flex">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 lg:px-5 lg:pt-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <ShieldCheck aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900 dark:text-white">SpeakBetter Admin</p>
              <p className="text-xs text-slate-500">
                {me.name} · {me.role === "ADMIN" ? "Admin" : "Moderator"}
              </p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-900/[0.05] lg:hidden dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" /> App
          </Link>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 py-3 lg:mt-4 lg:flex-col lg:overflow-visible lg:px-3">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              <n.icon aria-hidden className="h-4 w-4 shrink-0" />
              {n.label}
              {n.to === "/admin/reports" && <OpenReports />}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-3 lg:absolute lg:bottom-5 lg:block lg:w-64">
          <Link
            to="/dashboard"
            className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-900/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" /> Back to the app
          </Link>
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <ErrorBoundary variant="page" resetKey={location.pathname}>
            {blocked ? (
              <div className="py-16 text-center">
                <ShieldAlert aria-hidden className="mx-auto h-10 w-10 text-amber-600" />
                <p className="mt-3 font-semibold text-slate-900 dark:text-white">Only admins can open {current?.label}</p>
                <p className="mt-1 text-sm text-slate-500">Ask an admin if you need something from here.</p>
              </div>
            ) : (
              <Suspense fallback={<PageLoading />}>
                <Outlet context={me} />
              </Suspense>
            )}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
