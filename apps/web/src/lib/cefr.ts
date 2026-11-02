// apps/web/src/lib/cefr.ts
// One place for what a CEFR level (A1–C2) means and how it looks across the app.

export const CEFR_CODES = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrCode = (typeof CEFR_CODES)[number];

export const isCefr = (value: unknown): value is CefrCode =>
  typeof value === "string" && (CEFR_CODES as readonly string[]).includes(value.toUpperCase());

export const CEFR_INFO: Record<CefrCode, { name: string; summary: string; gradient: string; chip: string }> = {
  A1: {
    name: "Beginner",
    summary: "You understand and use familiar everyday words and very simple sentences.",
    gradient: "from-emerald-500 to-teal-500",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  A2: {
    name: "Elementary",
    summary: "You handle simple, routine exchanges and talk about your background and immediate needs.",
    gradient: "from-sky-500 to-cyan-500",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  B1: {
    name: "Intermediate",
    summary: "You can deal with most travel situations and describe experiences, plans and opinions.",
    gradient: "from-indigo-500 to-blue-500",
    chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  B2: {
    name: "Upper-intermediate",
    summary: "You follow complex ideas and talk with native speakers fluently, without much strain.",
    gradient: "from-violet-500 to-purple-500",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  C1: {
    name: "Advanced",
    summary: "You express yourself fluently and precisely, and understand demanding, longer texts.",
    gradient: "from-fuchsia-500 to-pink-500",
    chip: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  },
  C2: {
    name: "Proficient",
    summary: "You understand virtually everything and express subtle shades of meaning with ease.",
    gradient: "from-amber-500 to-orange-500",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
};

/** Colours for a profile badge; also copes with the older free-text levels ("intermediate") */
export function levelChipClass(level?: string | null): string {
  if (!level) return "bg-gray-100 text-gray-700";
  if (isCefr(level)) return CEFR_INFO[level.toUpperCase() as CefrCode].chip;
  const legacy: Record<string, string> = {
    beginner: "bg-green-100 text-green-700",
    elementary: "bg-blue-100 text-blue-700",
    intermediate: "bg-yellow-100 text-yellow-700",
    "upper-intermediate": "bg-orange-100 text-orange-700",
    advanced: "bg-red-100 text-red-700",
    native: "bg-purple-100 text-purple-700",
  };
  return legacy[level.toLowerCase()] ?? "bg-gray-100 text-gray-700";
}

/** Random calls match on three broad levels */
export function cefrToCallLevel(level?: string | null): "beginner" | "intermediate" | "advanced" | null {
  if (!isCefr(level)) return null;
  const index = CEFR_CODES.indexOf(level.toUpperCase() as CefrCode);
  return index <= 1 ? "beginner" : index <= 3 ? "intermediate" : "advanced";
}
