import { msg } from "../i18n/core";
// apps/web/src/lib/adminFormat.ts
// Formatting and shared constants for the admin section (components/admin/AdminKit.tsx holds the components).

export const formatNumber = (n: number) => n.toLocaleString();

export const formatMoney = (n: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);

/** "3 min ago", "yesterday", "12 Mar" */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "never";
  const date = new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 2 * 86_400) return "yesterday";
  if (seconds < 30 * 86_400) return `${Math.floor(seconds / 86_400)} days ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const dateTime = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/** A suspension end date as people read it */
export const untilText = (value: string | null | undefined) =>
  !value ? "" : new Date(value).getUTCFullYear() >= 9999 ? "permanently" : `until ${dateTime(value)}`;

/** The look of every admin card */
export const panel = "rounded-3xl border border-line bg-surface shadow-sm";

/** Buttons to pick a suspension length; moderators get up to 30 days */
export const SUSPEND_CHOICES = [
  { label: msg("1 day"), days: 1 },
  { label: msg("3 days"), days: 3 },
  { label: msg("7 days"), days: 7 },
  { label: msg("30 days"), days: 30 },
  { label: msg("90 days"), days: 90, admin: true },
  { label: msg("Permanent"), days: 0, admin: true },
] as const;
