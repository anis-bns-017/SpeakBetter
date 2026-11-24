// apps/web/src/components/settings/ComfortCard.tsx
/** Reading comfort: text size and calmer motion. Saved on this device. */

import React, { useState } from "react";
import { Type } from "lucide-react";
import { useT } from "../../i18n";
import { msg, tr } from "../../i18n/core";
import { readReduceMotion, readTextSize, setReduceMotion, setTextSize, type TextSize } from "../../lib/comfort";

const SIZES: Array<{ value: TextSize; label: string; sample: string }> = [
  { value: "normal", label: msg("Normal"), sample: "text-sm" },
  { value: "large", label: msg("Large"), sample: "text-base" },
  { value: "xlarge", label: msg("Extra large"), sample: "text-lg" },
];

export const ComfortCard: React.FC = () => {
  const { t } = useT();
  const [size, setSize] = useState<TextSize>(() => readTextSize());
  const [calm, setCalm] = useState<boolean>(() => readReduceMotion());

  return (
    <section aria-labelledby="comfort-title" className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h2 id="comfort-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        <Type aria-hidden className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /> {t("Reading comfort")}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("Make text bigger or calm the animations. Saved on this device.")}</p>

      <div role="radiogroup" aria-label={tr("Text size")} className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
        {SIZES.map((s) => {
          const on = size === s.value;
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setSize(s.value);
                setTextSize(s.value);
              }}
              className={`h-12 rounded-xl border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${s.sample} ${
                on
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-line bg-surface text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/[0.05]"
              }`}
            >
              {tr(s.label)}
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-slate-800 dark:text-slate-200">
        <input
          type="checkbox"
          checked={calm}
          onChange={(e) => {
            setCalm(e.target.checked);
            setReduceMotion(e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 rounded border-line"
        />
        <span>
          <b>{t("Calmer animations")}</b>
          <span className="block text-slate-600 dark:text-slate-400">{t("Turns off most movement and fades, for easier reading.")}</span>
        </span>
      </label>
    </section>
  );
};

export default ComfortCard;
