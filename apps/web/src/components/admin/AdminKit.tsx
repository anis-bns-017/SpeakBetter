// apps/web/src/components/admin/AdminKit.tsx
// Small building blocks shared by the admin pages: metrics, a bar chart, a pager, people, badges and the action
// dialog every moderation decision goes through.

import React, { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, type LucideIcon } from "lucide-react";
import { Badge, Button } from "../ui";
import type { PlatformRole } from "../../hooks/useAdmin";
import { SUSPEND_CHOICES, formatNumber, panel } from "../../lib/adminFormat";

// ---------------- layout pieces ----------------


export const AdminTitle: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <header className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-[28px] leading-tight text-slate-900 sm:text-[34px] dark:text-white">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export const Metric: React.FC<{
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";
  to?: string;
}> = ({ icon: Icon, label, value, hint, tone = "indigo", to }) => {
  const tones = {
    indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  };
  const body = (
    <>
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 font-display text-[28px] font-semibold leading-none tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="t-eyebrow mt-2 text-slate-600 dark:text-slate-300">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </>
  );
  return to ? (
    <Link to={to} className={`${panel} block p-5 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:border-white/20`}>
      {body}
    </Link>
  ) : (
    <div className={`${panel} p-5`}>{body}</div>
  );
};

/** 30 bars, one per day, with the total and a text summary for screen readers */
export const DailyBars: React.FC<{ title: string; data: Array<{ day: string; value: number }>; tone?: "indigo" | "emerald" }> = ({
  title,
  data,
  tone = "indigo",
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const last7 = data.slice(-7).reduce((s, d) => s + d.value, 0);
  const bar = tone === "emerald" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-indigo-500 dark:bg-indigo-400";
  const label = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <section className={`${panel} p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500">
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatNumber(last7)}</span> last 7 days ·{" "}
          <span className="tabular-nums">{formatNumber(total)}</span> in 30
        </p>
      </div>
      <div className="mt-5 flex h-32 items-end gap-[3px]" role="img" aria-label={`${title}: ${total} over the last 30 days, ${last7} in the last 7`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div className={`w-full rounded-t-[3px] ${d.value ? bar : "bg-slate-100 dark:bg-white/[0.05]"}`} style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-white dark:text-slate-900">
              {label(d.day)}: {d.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-400">
        <span>{data[0] ? label(data[0].day) : ""}</span>
        <span>Today</span>
      </div>
    </section>
  );
};

export const Pager: React.FC<{ page: number; pages: number; total?: number; onPage: (page: number) => void }> = ({ page, pages, total, onPage }) =>
  pages <= 1 ? null : (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 pt-2 text-sm text-slate-600 dark:text-slate-400">
      <span className="tabular-nums">
        Page {page} of {pages}
        {total !== undefined ? ` · ${formatNumber(total)} in all` : ""}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Back
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );

export const Avatar: React.FC<{ person: { name: string; avatarUrl?: string | null } | null; size?: number }> = ({ person, size = 36 }) => {
  const initials = (person?.name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return person?.avatarUrl ? (
    <img src={person.avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[12px] font-bold text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-200"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
};

/** A person with a link to their admin page */
export const PersonLink: React.FC<{ person: { id: string; name: string; avatarUrl?: string | null; email?: string } | null; sub?: React.ReactNode }> = ({ person, sub }) =>
  person ? (
    <Link to={`/admin/users/${person.id}`} className="group flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <Avatar person={person} size={32} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900 group-hover:underline dark:text-white">{person.name}</span>
        {(sub ?? person.email) && <span className="block truncate text-xs text-slate-500">{sub ?? person.email}</span>}
      </span>
    </Link>
  ) : (
    <span className="text-sm text-slate-400">Deleted account</span>
  );

export const RoleBadge: React.FC<{ role: PlatformRole }> = ({ role }) =>
  role === "ADMIN" ? <Badge tone="indigo">Admin</Badge> : role === "MODERATOR" ? <Badge tone="info">Moderator</Badge> : null;

// ---------------- the action dialog ----------------

/**
 * A modal for one decision: a title, what will happen, the form, and confirm / cancel. Escape and the backdrop
 * close it; focus goes to the first field and back to where it was afterwards.
 */
export const ActionDialog: React.FC<{
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}> = ({ open, title, description, confirmLabel, danger, busy, disabled, error, onConfirm, onClose, children }) => {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const back = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    back.current = document.activeElement;
    const first = box.current?.querySelector<HTMLElement>("textarea, input, select, button:not([data-close])");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (back.current as HTMLElement | null)?.focus?.();
    };
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close" data-close tabIndex={-1} className="absolute inset-0 cursor-default bg-slate-950/50" onClick={() => !busy && onClose()} />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 shadow-xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/[0.06]"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        {description && <div className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</div>}
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled && !busy) onConfirm();
          }}
        >
          {children}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/15 dark:text-red-200">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy} disabled={disabled}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** A labelled text area for reasons and messages */
export const ReasonField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
  max?: number;
}> = ({ label, value, onChange, hint, rows = 3, max = 300 }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:text-sm dark:text-white"
      />
      <p className="mt-1 text-right text-[11px] tabular-nums text-slate-400">
        {value.length}/{max}
      </p>
    </div>
  );
};


export const SuspendChoice: React.FC<{ value: number; onChange: (days: number) => void; isAdmin: boolean; allowNone?: boolean }> = ({
  value,
  onChange,
  isAdmin,
  allowNone,
}) => (
  <fieldset>
    <legend className="text-sm font-semibold text-slate-800 dark:text-slate-200">How long</legend>
    <div className="mt-2 flex flex-wrap gap-2">
      {allowNone && (
        <button
          type="button"
          aria-pressed={value === -1}
          onClick={() => onChange(-1)}
          className={`h-9 rounded-xl px-3 text-[13px] font-semibold border ${value === -1 ? "border-indigo-600 bg-indigo-600 text-white" : "border-line bg-surface text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.05]"}`}
        >
          Don't suspend
        </button>
      )}
      {SUSPEND_CHOICES.filter((c) => isAdmin || !("admin" in c)).map((c) => (
        <button
          key={c.label}
          type="button"
          aria-pressed={value === c.days}
          onClick={() => onChange(c.days)}
          className={`h-9 rounded-xl px-3 text-[13px] font-semibold border ${
            value === c.days
              ? c.days === 0
                ? "border-red-600 bg-red-600 text-white"
                : "border-indigo-600 bg-indigo-600 text-white"
              : "border-line bg-surface text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.05]"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  </fieldset>
);

export const LoadingBlock: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="space-y-2" aria-hidden>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-white/[0.05]" />
    ))}
  </div>
);
