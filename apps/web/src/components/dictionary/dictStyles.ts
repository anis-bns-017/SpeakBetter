// apps/web/src/components/dictionary/dictStyles.ts
import type { DictLevel, DictStatus } from "../../hooks/useDictionary";
import { msg } from "../../i18n/core";

export const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

/** One colour per level; the level is always written next to it, so colour is never the only signal */
export const LEVEL_STYLE: Record<DictLevel, { chip: string; dot: string; name: string }> = {
  A1: { chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500", name: "Beginner" },
  A2: { chip: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300", dot: "bg-teal-500", name: "Elementary" },
  B1: { chip: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500", name: "Intermediate" },
  B2: { chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300", dot: "bg-indigo-500", name: "Upper intermediate" },
  C1: { chip: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500", name: "Advanced" },
  C2: { chip: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-300", dot: "bg-fuchsia-500", name: "Proficient" },
};

export const STATUS_LABEL: Record<DictStatus, string> = { new: msg("New to you"), saved: msg("In My words"), known: msg("You know it") };

export const chip = (active: boolean) =>
  `h-8 max-sm:h-10 px-3.5 rounded-full text-[13px] font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-page ${
    active
      ? "bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500"
      : "border-line bg-surface text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.08]"
  }`;

export const select =
  "h-8 max-sm:h-10 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

export const input =
  "w-full min-h-11 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition";

/** "verb" -> "verb"; Wiktionary uses the same names. Short form for tight places. */
export const POS_SHORT: Record<string, string> = {
  noun: "n.",
  verb: "v.",
  adjective: "adj.",
  adverb: "adv.",
  pronoun: "pron.",
  preposition: "prep.",
  determiner: "det.",
  conjunction: "conj.",
  number: "num.",
  "modal verb": "modal",
  exclamation: "excl.",
  interjection: "excl.",
  particle: "part.",
};
