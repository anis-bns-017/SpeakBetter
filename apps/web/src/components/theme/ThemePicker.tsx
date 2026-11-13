import React from "react";
import { Anchor, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import type { ThemePreference } from "../../lib/theme";
import { useChooseTheme } from "../../hooks/useChooseTheme";
import { tr, msg } from "../../i18n/core";

const THEME_CHOICES: Array<{ value: ThemePreference; label: string; description: string; icon: LucideIcon }> = [
  { value: "light", label: msg("Light"), description: msg("Bright and clear for daytime"), icon: Sun },
  { value: "dark", label: msg("Dark"), description: msg("Charcoal night mode, easy on the eyes"), icon: Moon },
  { value: "navy", label: msg("Navy"), description: msg("Deep navy blue, calm and focused"), icon: Anchor },
  { value: "system", label: msg("Auto"), description: msg("Light or dark, matching your device"), icon: Monitor },
];

/** Four small buttons: Light, Dark, Navy, Auto. Used in the sidebar menu and the phone sheet. */
export const ThemeSwitch: React.FC<{ className?: string; size?: "sm" | "md" }> = ({ className = "", size = "sm" }) => {
  const { theme } = useTheme();
  const choose = useChooseTheme();
  const height = size === "md" ? "h-10" : "h-8";
  return (
    <div role="radiogroup" aria-label={tr("Theme")} className={`grid grid-cols-4 gap-1 rounded-xl bg-slate-100 dark:bg-white/[0.06] p-1 ${className}`}>
      {THEME_CHOICES.map((c) => {
        const Icon = c.icon;
        const selected = theme === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={tr(c.description)}
            onClick={() => choose(c.value)}
            className={`${height} rounded-lg inline-flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
              selected
                ? "bg-white text-indigo-600 shadow-sm dark:bg-white/15 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {tr(c.label)}
          </button>
        );
      })}
    </div>
  );
};

/** What each theme looks like, as a tiny painted screen */
const PREVIEW: Record<ThemePreference, { page: string; side: string; card: string; line: string; accent: string }> = {
  light: { page: "#f7f5f1", side: "#f1efea", card: "#ffffff", line: "#cbc7bd", accent: "#3b4fb2" },
  dark: { page: "#0f172a", side: "#0b0b14", card: "#1b2133", line: "#334155", accent: "#8ea3e8" },
  navy: { page: "#12264c", side: "#0d1f42", card: "#1d3560", line: "#344c77", accent: "#8ea3e8" },
  system: { page: "#f7f5f1", side: "#0b0b14", card: "#ffffff", line: "#cbc7bd", accent: "#4f66c8" },
};

/** One little screen: sidebar, a header card with the accent dot, and two cards */
const MiniScreen: React.FC<{ value: Exclude<ThemePreference, "system">; className?: string }> = ({ value, className = "" }) => {
  const p = PREVIEW[value];
  return (
    <div className={`relative h-full overflow-hidden ${className}`} style={{ background: p.page }}>
      <div className="absolute inset-y-0 left-0 w-5" style={{ background: p.side }} />
      <div className="absolute left-7 top-2.5 right-2.5 h-5 rounded-md" style={{ background: p.card }}>
        <div className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: p.accent }} />
        <div className="absolute left-5 top-2 h-1 w-8 max-w-[50%] rounded-full" style={{ background: p.line }} />
      </div>
      <div className="absolute left-7 bottom-2.5 h-4 w-[30%] rounded-md" style={{ background: p.card }} />
      <div className="absolute right-2.5 bottom-2.5 h-4 w-[30%] rounded-md" style={{ background: p.card }} />
    </div>
  );
};

const Preview: React.FC<{ value: ThemePreference }> = ({ value }) => (
  <div className="relative h-16 rounded-xl overflow-hidden border border-black/5 dark:border-white/10" aria-hidden>
    {value === "system" ? (
      // Auto: the same screen, light on the left and dark on the right
      <>
        <MiniScreen value="light" className="absolute inset-0 [clip-path:inset(0_50%_0_0)]" />
        <MiniScreen value="dark" className="absolute inset-0 [clip-path:inset(0_0_0_50%)]" />
      </>
    ) : (
      <MiniScreen value={value} />
    )}
  </div>
);

/** Big cards with a preview of each theme, for the Settings page. Changes apply at once. */
export const ThemeCards: React.FC<{ value: ThemePreference; onChange: (value: ThemePreference) => void }> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label={tr("Theme")} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {THEME_CHOICES.map((c) => {
      const Icon = c.icon;
      const selected = value === c.value;
      return (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(c.value)}
          className={`rounded-2xl border p-2.5 text-left transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
            selected
              ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
              : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/20"
          }`}
        >
          <Preview value={c.value} />
          <span className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
            <Icon className={`w-4 h-4 ${selected ? "text-indigo-500" : "text-slate-400"}`} /> {tr(c.label)}
          </span>
          <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">{tr(c.description)}</span>
        </button>
      );
    })}
  </div>
);
