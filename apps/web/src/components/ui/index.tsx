// apps/web/src/components/ui/index.tsx
/**
 * Shared building blocks of the SpeakBetter design system (apps/web/DESIGN_SYSTEM.md).
 * Button, IconButton, Card, PageHeader, SectionHeader, EmptyState, Field/Input, Chip, Tabs, Badge, Stat, Skeleton.
 * Use these for every screen so the whole app shares one look. They only use tokens from src/index.css
 * (bg-surface, border-line, indigo-*, radius and shadow scales), so light, dark and navy all work.
 */

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Loader2, type LucideIcon } from "lucide-react";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** One focus ring for everything interactive: 2px lapis, 2px offset that matches the surface behind it */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-page dark:focus-visible:ring-indigo-400";

// ============================================================
// Button
// ============================================================

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16),var(--shadow-sm)] hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600",
  secondary:
    "border border-line bg-surface text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-300 dark:text-slate-100 dark:hover:bg-white/[0.08]",
  soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-400/15 dark:text-indigo-200 dark:hover:bg-indigo-400/25",
  ghost: "text-slate-700 hover:bg-slate-900/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.06]",
  danger:
    "bg-red-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),var(--shadow-sm)] hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-xl max-sm:h-10",
  md: "h-10 px-4 text-sm gap-2 rounded-xl max-sm:h-11",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-2xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: Icon, loading, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap select-none touch-manipulation transition-[background-color,box-shadow,border-color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        FOCUS,
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : Icon ? <Icon className="w-4 h-4" aria-hidden /> : null}
      {children}
    </button>
  );
});

/** Icon-only button. `label` is required: it becomes the accessible name and the tooltip. 44px hit area on every screen. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "children" | "icon" | "size"> & { icon: LucideIcon; label: string }
>(function IconButton({ icon: Icon, label, variant = "ghost", className, loading, disabled, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl touch-manipulation transition-[background-color,transform] duration-150 active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none",
        FOCUS,
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="w-[18px] h-[18px] animate-spin" aria-hidden /> : <Icon className="w-[18px] h-[18px]" aria-hidden />}
    </button>
  );
});

// ============================================================
// Card
// ============================================================

type CardTone = "default" | "tint" | "inset";

const CARD_TONE: Record<CardTone, string> = {
  default: "bg-surface border-line shadow-sm",
  // One quiet lapis wash for a hero moment (at most one per screen)
  tint: "border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-surface to-surface shadow-sm dark:border-indigo-400/20 dark:from-indigo-400/10 dark:via-surface dark:to-surface",
  inset: "bg-slate-50 border-line dark:bg-white/[0.03]",
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; padded?: boolean; tone?: CardTone }> = ({
  interactive,
  padded = true,
  tone = "default",
  className,
  ...rest
}) => (
  <div
    className={cx(
      "rounded-3xl border",
      CARD_TONE[tone],
      interactive && "transition-[box-shadow,border-color,transform] duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-white/15",
      padded && "p-5 max-sm:p-4",
      className,
    )}
    {...rest}
  />
);

// ============================================================
// Page header
// ============================================================

/** Section colours for the icon tile: Home lapis, Speak rose, Learn emerald, plus a few for tools. Flat tint + hairline, no gradient. */
const TILE: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200/80 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-400/25",
  rose: "bg-rose-50 text-rose-700 ring-rose-200/80 dark:bg-rose-400/15 dark:text-rose-200 dark:ring-rose-400/25",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25",
  sky: "bg-sky-50 text-sky-700 ring-sky-200/80 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25",
  amber: "bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/25",
};

export const PageHeader: React.FC<{
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  tone?: keyof typeof TILE;
  actions?: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, tone = "indigo", actions }) => (
  <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
    <div className={cx("w-12 h-12 rounded-2xl ring-1 ring-inset flex items-center justify-center shrink-0", TILE[tone] ?? TILE.indigo)}>
      <Icon className="w-6 h-6" aria-hidden />
    </div>
    <div className="min-w-0 flex-1">
      <h1 className="text-[26px] sm:text-[32px] leading-[1.1] text-slate-900 dark:text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

/** Title of a block inside a page, with an optional "see all" link */
export const SectionHeader: React.FC<{ title: string; hint?: React.ReactNode; action?: { label: string; to: string } }> = ({ title, hint, action }) => (
  <div className="mb-3 flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{hint}</p>}
    </div>
    {action && (
      <Link
        to={action.to}
        className={cx(
          "inline-flex min-h-8 items-center gap-1 rounded-md text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300",
          FOCUS,
        )}
      >
        {action.label} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
      </Link>
    )}
  </div>
);

// ============================================================
// Empty state
// ============================================================

export const EmptyState: React.FC<{ icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }> = ({ icon: Icon, title, text, action }) => (
  <Card className="p-8 text-center" tone="inset">
    <div className="mx-auto w-12 h-12 rounded-2xl bg-surface ring-1 ring-inset ring-slate-200 dark:ring-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center">
      <Icon className="w-6 h-6" aria-hidden />
    </div>
    <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{title}</h2>
    {text && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">{text}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </Card>
);

// ============================================================
// Form field: visible label, helper text, error tied to the input with aria-describedby
// ============================================================

const FIELD_BASE =
  "w-full rounded-xl border bg-surface px-3.5 text-[15px] text-slate-900 placeholder:text-slate-500 shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-100 dark:placeholder:text-slate-400";

export const Field: React.FC<{
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, htmlFor, hint, error, required, children, className }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-slate-800 dark:text-slate-200">
      {label}
      {required && <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden> *</span>}
    </label>
    {children}
    {error ? (
      <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-300">
        {error}
      </p>
    ) : hint ? (
      <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
        {hint}
      </p>
    ) : null}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, id, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? (invalid ? `${id}-error` : `${id}-hint`) : undefined}
      className={cx(FIELD_BASE, "h-11", invalid ? "border-red-500" : "border-line", className)}
      {...rest}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { className, invalid, id, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? (invalid ? `${id}-error` : `${id}-hint`) : undefined}
      className={cx(FIELD_BASE, "py-2.5 leading-relaxed", invalid ? "border-red-500" : "border-line", className)}
      {...rest}
    />
  );
});

/** Native select (keeps the OS picker on phones) dressed like Input */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, id, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={id ? (invalid ? `${id}-error` : `${id}-hint`) : undefined}
        className={cx(FIELD_BASE, "h-11 appearance-none pr-10", invalid ? "border-red-500" : "border-line", className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden />
    </div>
  );
});

// ============================================================
// Chip (filter) and Tabs (segmented control)
// ============================================================

/** A filter or choice pill. 32px high on desktop, 40px on phones. selected = lapis fill. */
export const Chip: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; icon?: LucideIcon; count?: number }> = ({
  selected,
  icon: Icon,
  count,
  className,
  children,
  type = "button",
  ...rest
}) => (
  <button
    type={type}
    aria-pressed={selected}
    className={cx(
      "inline-flex h-8 max-sm:h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap touch-manipulation transition-colors duration-150",
      FOCUS,
      selected
        ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
        : "border-line bg-surface text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.08]",
      className,
    )}
    {...rest}
  >
    {Icon && <Icon className="w-3.5 h-3.5" aria-hidden />}
    {children}
    {count !== undefined && (
      <span className={cx("tabular-nums text-[11px]", selected ? "text-white/80" : "text-slate-500 dark:text-slate-400")}>{count}</span>
    )}
  </button>
);

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

/** Segmented tabs with arrow-key navigation. The panel they control should have role="tabpanel". */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = items.findIndex((t) => t.value === value);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    onChange(items[next].value);
    (e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next])?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx("inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-slate-100/70 p-1 dark:bg-white/[0.04]", className)}
    >
      {items.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              "inline-flex h-9 max-sm:h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold whitespace-nowrap touch-manipulation transition-[background-color,color,box-shadow] duration-150",
              FOCUS,
              active
                ? "bg-surface text-slate-900 shadow-sm dark:bg-white/[0.1] dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
            )}
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden />}
            {t.label}
            {t.count !== undefined && <span className="tabular-nums text-[11px] text-slate-500 dark:text-slate-400">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Badge, Stat, Skeleton
// ============================================================

type BadgeTone = "neutral" | "indigo" | "success" | "warning" | "danger" | "info";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-200",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200",
  success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
  warning: "bg-amber-50 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  danger: "bg-red-50 text-red-800 dark:bg-red-400/15 dark:text-red-200",
  info: "bg-sky-50 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
};

/** Status label. Always carries words (and optionally an icon): never colour alone. */
export const Badge: React.FC<{ tone?: BadgeTone; icon?: LucideIcon; children: React.ReactNode; className?: string }> = ({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}) => (
  <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold leading-4", BADGE_TONE[tone], className)}>
    {Icon && <Icon className="w-3 h-3" aria-hidden />}
    {children}
  </span>
);

/** A number with its label: serif tabular figures, quiet eyebrow label */
export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; className?: string }> = ({
  label,
  value,
  hint,
  icon: Icon,
  className,
}) => (
  <div className={className}>
    <p className="t-eyebrow flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
      {Icon && <Icon className="w-3.5 h-3.5" aria-hidden />}
      {label}
    </p>
    <p className="font-display mt-1 text-[28px] font-semibold leading-none tabular-nums text-slate-900 dark:text-white">{value}</p>
    {hint && <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{hint}</p>}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden className={cx("animate-pulse rounded-xl bg-slate-200/70 dark:bg-white/[0.06]", className)} />
);
