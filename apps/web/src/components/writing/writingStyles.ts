import { BookOpenText, Feather, Mail, MessageSquareText, Scale, Star, type LucideIcon } from "lucide-react";
import type { IssueKind, WritingKind } from "../../hooks/useWriting";

export const KIND: Record<WritingKind, { label: string; icon: LucideIcon; tone: string }> = {
  message: { label: "Message", icon: MessageSquareText, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  email: { label: "Email", icon: Mail, tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  story: { label: "Story", icon: BookOpenText, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  opinion: { label: "Opinion", icon: Scale, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  description: { label: "Description", icon: Feather, tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  review: { label: "Review", icon: Star, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};

export const scoreTone = (score: number | null) =>
  score === null
    ? "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
    : score >= 90
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : score >= 70
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-400";

/** How each kind of issue is marked in the text and listed */
export const ISSUE_STYLE: Record<IssueKind, { label: string; underline: string; dot: string; chip: string }> = {
  grammar: { label: "Grammar", underline: "decoration-rose-500 bg-rose-500/[0.08]", dot: "bg-rose-500", chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  spelling: { label: "Spelling", underline: "decoration-amber-500 bg-amber-500/[0.08]", dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  punctuation: { label: "Punctuation", underline: "decoration-sky-500 bg-sky-500/[0.08]", dot: "bg-sky-500", chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  style: { label: "Style", underline: "decoration-violet-500 bg-violet-500/[0.08]", dot: "bg-violet-500", chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};
