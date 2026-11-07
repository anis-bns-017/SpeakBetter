// apps/web/src/components/dictionary/dictStyles.ts
import type { DictLevel, DictStatus } from "../../hooks/useDictionary";

export const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** One colour per level; the level is always written next to it, so colour is never the only signal */
export const LEVEL_STYLE: Record<DictLevel, { chip: string; dot: string; name: string }> = {
  A1: { chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500", name: "Beginner" },
  A2: { chip: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300", dot: "bg-teal-500", name: "Elementary" },
  B1: { chip: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500", name: "Intermediate" },
  B2: { chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300", dot: "bg-indigo-500", name: "Upper intermediate" },
  C1: { chip: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500", name: "Advanced" },
  C2: { chip: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-300", dot: "bg-fuchsia-500", name: "Proficient" },
};

export const STATUS_LABEL: Record<DictStatus, string> = { new: "New to you", saved: "In My words", known: "You know it" };

export const chip = (active: boolean) =>
  `h-8 px-3 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
    active
      ? "bg-indigo-600 border-indigo-600 text-white"
      : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
  }`;

export const select =
  "h-8 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

export const input =
  "w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition";

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
