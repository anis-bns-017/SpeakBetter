import {
  Award,
  BookMarked,
  Brain,
  Briefcase,
  Castle,
  ClipboardCheck,
  Coins,
  Compass,
  Cpu,
  Crown,
  Dna,
  Feather,
  FlaskConical,
  Gavel,
  GitBranch,
  GraduationCap,
  Handshake,
  Heart,
  HeartPulse,
  Landmark,
  Leaf,
  Link,
  Link2,
  Mail,
  Megaphone,
  MessagesSquare,
  Microscope,
  Mountain,
  Newspaper,
  Package,
  Palette,
  PenLine,
  Plane,
  Puzzle,
  Quote,
  Rocket,
  Scale,
  School,
  ShoppingBag,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sun,
  Sunrise,
  Telescope,
  TrendingUp,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** The icon each pack and category names; anything the server adds later falls back to a box */
const ICONS: Record<string, LucideIcon> = {
  Award,
  BookMarked,
  Brain,
  Briefcase,
  Castle,
  ClipboardCheck,
  Coins,
  Compass,
  Cpu,
  Crown,
  Dna,
  Feather,
  FlaskConical,
  Gavel,
  GitBranch,
  GraduationCap,
  Handshake,
  Heart,
  HeartPulse,
  Landmark,
  Leaf,
  Link,
  Link2,
  Mail,
  Megaphone,
  MessagesSquare,
  Microscope,
  Mountain,
  Newspaper,
  Palette,
  PenLine,
  Plane,
  Puzzle,
  Quote,
  Rocket,
  Scale,
  School,
  ShoppingBag,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sun,
  Sunrise,
  Telescope,
  TrendingUp,
  UserPlus,
  Users,
  Utensils,
  Wallet,
};

export const packIcon = (name: string): LucideIcon => ICONS[name] ?? Package;

export type PackCategory =
  | "everyday"
  | "ielts"
  | "toefl"
  | "gre"
  | "sat"
  | "cambridge"
  | "academic"
  | "business"
  | "expressions";

/** One colour per category, so packs are easy to tell apart at a glance */
export const categoryTone = (category: PackCategory | string): string => {
  switch (category) {
    case "everyday":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "ielts":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    case "toefl":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "gre":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    case "sat":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    case "cambridge":
      return "bg-teal-500/10 text-teal-600 dark:text-teal-400";
    case "academic":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
    case "business":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    default:
      return "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400";
  }
};

/** Kept for older callers: everyday packs are coloured by topic */
export const topicTone = (topic: string): string => {
  switch (topic) {
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
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
};
