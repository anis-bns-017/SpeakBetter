import {
  Activity,
  BookOpen,
  Briefcase,
  Link as LinkIcon,
  MessageCircle,
  MessageCircleQuestion,
  Plane,
  Presentation,
  Repeat2,
  Zap,
  type LucideIcon,
} from "lucide-react";

const TRACK_ICONS: Record<string, LucideIcon> = {
  MessageCircle,
  MessageCircleQuestion,
  Link: LinkIcon,
  Activity,
  Plane,
  BookOpen,
  Briefcase,
  Presentation,
  Zap,
};

/** The icon a shadowing track names; anything new falls back to the shadowing icon */
export const trackIcon = (name: string | undefined): LucideIcon => (name && TRACK_ICONS[name]) || Repeat2;

export const scoreTone = (score: number) =>
  score >= 90 ? "text-emerald-600 dark:text-emerald-400" : score >= 70 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

export const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
