import { Briefcase, GraduationCap, HeartPulse, Package, Plane, Puzzle, ShoppingBag, Smile, Sparkles, Sunrise, Utensils, type LucideIcon } from "lucide-react";

/** The icon each vocabulary pack names; anything the server adds later falls back to a box */
const ICONS: Record<string, LucideIcon> = { Briefcase, GraduationCap, HeartPulse, Plane, Puzzle, ShoppingBag, Smile, Sparkles, Sunrise, Utensils };

export const packIcon = (name: string): LucideIcon => ICONS[name] ?? Package;

/** A soft colour for each topic, so packs are easy to tell apart at a glance */
export const topicTone = (topic: string): string => {
  switch (topic) {
    case "Daily life":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "Travel":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "Health":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    case "Work":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
    case "People":
      return "bg-pink-500/10 text-pink-600 dark:text-pink-400";
    case "Study":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    default:
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
};
