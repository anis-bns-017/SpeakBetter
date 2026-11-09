// apps/web/src/components/common/AuthShell.tsx
/**
 * The frame shared by Login and Register (apps/web/DESIGN_SYSTEM.md): a deep Lapis brand panel on the left
 * (serif headline, a few reasons to join, a speech waveform), and the form on the right in the learner's
 * own theme. On phones the brand panel shrinks to a header bar so the form is the first thing you see.
 */

import React from "react";
import type { LucideIcon } from "lucide-react";
import { LogoMark } from "./SpeakBetterLogo";

export interface AuthFeature {
  icon: LucideIcon;
  title: string;
  text?: string;
}

/** A frozen speech waveform: bar heights in percent. Decorative, so it is hidden from screen readers. */
const WAVE = [18, 32, 24, 46, 38, 62, 48, 78, 56, 90, 64, 100, 72, 88, 58, 74, 44, 60, 36, 52, 28, 40, 22, 34, 16, 26, 14, 20];

export const AuthShell: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  blurb: string;
  features: AuthFeature[];
  stats?: Array<{ value: string; label: string }>;
  children: React.ReactNode;
}> = ({ eyebrow, title, blurb, features, stats, children }) => (
  <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[1.05fr_1fr]">
    {/* Brand panel */}
    <aside className="relative hidden overflow-hidden bg-indigo-950 text-white lg:flex lg:flex-col lg:justify-between lg:gap-10 lg:p-12 xl:p-16">
      <div className="flex items-center gap-3">
        <LogoMark size={44} />
        <span className="font-display text-[22px] font-semibold">SpeakBetter</span>
      </div>

      <div className="max-w-xl">
        <p className="t-eyebrow text-indigo-200">{eyebrow}</p>
        <p className="font-display mt-4 text-5xl font-semibold leading-[1.08] xl:text-6xl">{title}</p>
        <p className="mt-5 max-w-md text-base leading-relaxed text-indigo-100/90">{blurb}</p>

        <ul className="mt-9 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {features.map(({ icon: Icon, title: t, text }) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
                <Icon className="h-[18px] w-[18px] text-indigo-100" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t}</span>
                {text && <span className="mt-0.5 block text-[13px] leading-snug text-indigo-200">{text}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div aria-hidden className="flex h-16 items-end gap-[5px]">
          {WAVE.map((h, i) => (
            <span
              key={i}
              className={`w-[5px] flex-1 max-w-[7px] origin-bottom rounded-full ${i % 7 === 3 ? "bg-amber-300" : "bg-white/25"} ${i % 5 === 0 ? "sb-eq" : ""}`}
              style={{ height: `${h}%`, animationDelay: `-${(i % 9) * 0.11}s` }}
            />
          ))}
        </div>
        {stats && (
          <dl className="mt-6 flex gap-10 border-t border-white/15 pt-5">
            {stats.map((s) => (
              <div key={s.label}>
                <dd className="font-display text-2xl font-semibold tabular-nums">{s.value}</dd>
                <dt className="text-xs text-indigo-200">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </aside>

    {/* Form panel */}
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:px-8">
      <div className="mb-7 flex items-center gap-3 lg:hidden">
        <LogoMark size={40} />
        <span className="font-display text-xl font-semibold text-slate-900 dark:text-white">SpeakBetter</span>
      </div>
      <div className="w-full max-w-[440px]">{children}</div>
    </main>
  </div>
);
