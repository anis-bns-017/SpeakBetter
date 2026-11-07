// apps/web/src/components/ui/index.tsx
/**
 * Shared building blocks of the SpeakBetter design system (design-system/speakbetter/MASTER.md):
 * Button, Card, PageHeader, EmptyState. Use these for new screens so every page shares one look.
 */

import React from "react";
import { Loader2, type LucideIcon } from "lucide-react";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

// ============================================================
// Button
// ============================================================

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/25 dark:bg-indigo-500 dark:hover:bg-indigo-400",
  secondary:
    "border border-slate-200 bg-white text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.08]",
  ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5 rounded-xl",
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
        "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-[background-color,box-shadow,border-color,transform] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
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

// ============================================================
// Card
// ============================================================

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; padded?: boolean }> = ({
  interactive,
  padded = true,
  className,
  ...rest
}) => (
  <div
    className={cx(
      "rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-white/[0.07] dark:bg-white/[0.03]",
      interactive && "transition-shadow hover:shadow-md hover:border-slate-300/80 dark:hover:border-white/15",
      padded && "p-5",
      className,
    )}
    {...rest}
  />
);

// ============================================================
// Page header
// ============================================================

/** Section colours for the icon tile (Home indigo, Speak rose, Learn emerald, plus a few for tools) */
const TILE: Record<string, string> = {
  indigo: "from-indigo-500 to-violet-500 shadow-indigo-500/30",
  rose: "from-rose-500 to-orange-400 shadow-rose-500/30",
  emerald: "from-emerald-500 to-teal-400 shadow-emerald-500/30",
  sky: "from-sky-500 to-indigo-500 shadow-sky-500/30",
  amber: "from-amber-400 to-orange-500 shadow-orange-500/30",
};

export const PageHeader: React.FC<{
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  tone?: keyof typeof TILE;
  actions?: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, tone = "indigo", actions }) => (
  <header className="flex flex-wrap items-center gap-4">
    <div className={cx("w-12 h-12 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg shrink-0", TILE[tone] ?? TILE.indigo)}>
      <Icon className="w-6 h-6" aria-hidden />
    </div>
    <div className="min-w-0 flex-1">
      <h1 className="text-2xl sm:text-[28px] font-bold leading-tight text-slate-900 dark:text-white">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

// ============================================================
// Empty state
// ============================================================

export const EmptyState: React.FC<{ icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }> = ({ icon: Icon, title, text, action }) => (
  <Card className="p-8 text-center">
    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 flex items-center justify-center">
      <Icon className="w-6 h-6" aria-hidden />
    </div>
    <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
    {text && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">{text}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </Card>
);
