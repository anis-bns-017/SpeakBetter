// apps/web/src/components/settings/LanguageCard.tsx
/** The interface language: English or Bangla. Practice content stays in English either way. */

import React from "react";
import { Languages } from "lucide-react";
import { useT } from "../../i18n";
import { LANGUAGES } from "../../i18n/core";

export const LanguageCard: React.FC = () => {
  const { t, lang, setLang } = useT();
  return (
    <section aria-labelledby="language-title" className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h2 id="language-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        <Languages aria-hidden className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /> {t("App language")}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {t("Buttons, menus and help in your language. Lessons, rooms and practice stay in English.")}
      </p>
      <div role="radiogroup" aria-labelledby="language-title" className="mt-4 grid grid-cols-2 gap-2 sm:max-w-sm">
        {LANGUAGES.map((l) => {
          const on = lang === l.code;
          return (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setLang(l.code)}
              className={`h-12 rounded-xl border text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                on
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-line bg-surface text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/[0.05]"
              }`}
            >
              {l.native}
            </button>
          );
        })}
      </div>
      {lang === "bn" && <p className="mt-3 text-xs text-slate-500">{t("Some pages are still being translated and will show in English for now.")}</p>}
    </section>
  );
};

export default LanguageCard;
