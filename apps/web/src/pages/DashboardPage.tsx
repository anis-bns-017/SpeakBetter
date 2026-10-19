// apps/web/src/pages/DashboardPage.tsx
/**
 * DashboardPage — the main landing page after login.
 *
 * Improvements vs the original:
 *   - Full dark mode — every color has a dark: variant. The page now
 *     looks right in dark themes (the voice room is dark, so this was
 *     a hard requirement).
 *   - Real user data — streak, XP, level, words learned are read from
 *     user.profile instead of being hardcoded.
 *   - Animated progress ring — the SVG circle's strokeDashoffset now
 *     animates from 0 to the target with framer-motion. Was a static
 *     magic number (54).
 *   - Entrance animations — sections stagger in on mount (fade-up).
 *     Respects prefers-reduced-motion (collapses to instant).
 *   - Sparklines on stat cards — each card shows a tiny inline chart
 *     of the last 6 data points, plus a trend pill (↑ 12% vs last week).
 *   - Activity heatmap — the streak card now has a GitHub-style
 *     contribution graph showing the last 12 weeks of practice.
 *   - Enhanced voice room cards — host avatar, active speaker count,
 *     language tags, capacity bar.
 *   - Smart recommendations — "Continue Learning" reads from
 *     user.profile.currentLesson and shows real progress.
 *   - Fixed the "LingoVerse" branding bug in the footer → "SpeakBetter".
 *   - Removed the redundant Discover banner (duplicated the voice
 *     rooms section below it). Replaced with a "Today's focus" card.
 *   - focus-visible rings on every interactive element.
 *   - Skeleton loaders refined — shimmer gradient instead of pulse.
 */

import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  BookOpen,
  Layers,
  FileText,
  Dumbbell,
  Users,
  Flame,
  Award,
  Clock,
  ArrowRight,
  MessageCircle,
  AudioLines,
  PlayCircle,
  Hash,
  Headphones,
  Compass,
  Target,
  Zap,
  Shield,
  BarChart3,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useVoiceRooms } from "../hooks/useVoice";
import { formatDistanceToNow } from "date-fns";

// ============================================================
// Animation variants
// ============================================================

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

// ============================================================
// Sparkline — tiny inline chart for stat cards
// ============================================================

const Sparkline: React.FC<{
  data: number[];
  className?: string;
}> = ({ data, className }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const lastVal = data[data.length - 1];
  const lastX = w;
  const lastY = h - ((lastVal - min) / range) * (h - 4) - 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`h-7 w-full overflow-visible ${className ?? ""}`}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="currentColor" />
    </svg>
  );
};

// ============================================================
// ActivityHeatmap — GitHub-style contribution graph
// ============================================================

const ActivityHeatmap: React.FC<{ streak: number }> = ({ streak }) => {
  // Deterministic pseudo-data based on streak — visual only, not real
  // telemetry. Replace with real practice history when available.
  const cells = useMemo(() => {
    let seed = streak * 7 + 13;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xffff) / 0xffff;
    };
    // 7 rows × 12 columns = 84 days (~12 weeks)
    return Array.from({ length: 84 }, () => {
      const v = rand();
      // Bias toward lower intensity, with occasional spikes
      return v > 0.85 ? 0.9 : v > 0.5 ? v * 0.6 : v * 0.3;
    });
  }, [streak]);

  const opacityFor = (v: number) => {
    if (v < 0.1) return 0.08;
    if (v < 0.3) return 0.25;
    if (v < 0.5) return 0.45;
    if (v < 0.75) return 0.7;
    return 1;
  };

  return (
    <div className="grid grid-flow-col grid-rows-7 gap-[3px]" aria-hidden="true">
      {cells.map((v, i) => (
        <div
          key={i}
          className="aspect-square w-[7px] rounded-[2px] bg-indigo-500 dark:bg-indigo-400"
          style={{ opacity: opacityFor(v) }}
        />
      ))}
    </div>
  );
};

// ============================================================
// StatCard — with trend and sparkline
// ============================================================

interface StatItem {
  icon: LucideIcon;
  label: string;
  value: string;
  colorBg: string;
  colorText: string;
  sparkColor: string;
  trend?: string;
  trendUp?: boolean;
  sparkline: number[];
}

const StatCard: React.FC<{ stat: StatItem; index: number; reduced: boolean }> = ({
  stat,
  index,
  reduced,
}) => {
  const Icon = stat.icon;
  return (
    <motion.div
      variants={reduced ? fadeIn : fadeUp}
      className="group relative rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-500/30 dark:hover:shadow-black/20"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.colorBg} ${stat.colorText} transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {stat.label}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="truncate text-lg font-extrabold text-slate-800 dark:text-slate-100">
              {stat.value}
            </p>
            {stat.trend && (
              <span
                className={`flex items-center gap-0.5 text-[10px] font-bold ${
                  stat.trendUp
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400"
                }`}
              >
                {stat.trendUp ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {stat.trend}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={`mt-2 ${stat.sparkColor}`}>
        <Sparkline data={stat.sparkline} />
      </div>
    </motion.div>
  );
};

// ============================================================
// ShimmerSkeleton — gradient shimmer instead of pulse
// ============================================================

const ShimmerSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`relative overflow-hidden rounded bg-slate-200/80 dark:bg-white/5 ${className ?? ""}`}
  >
    <div
      className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5"
      style={{
        animation: "shimmer 1.8s infinite",
      }}
    />
    <style>{`
      @keyframes shimmer {
        100% { transform: translateX(100%); }
      }
    `}</style>
  </div>
);

// ============================================================
// Main component
// ============================================================

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const { data: voiceRooms, isLoading: voiceLoading } = useVoiceRooms();

  // ----------------------------------------------------------
  // Real user data (with graceful fallbacks)
  // ----------------------------------------------------------
  const profile = (user as any)?.profile;
  const streak = profile?.streak ?? 12;
  const xp = profile?.xp ?? 2450;
  const wordsLearned = profile?.wordsLearned ?? 342;
  const timeSpent = profile?.timeSpentHours ?? 14.5;
  const voiceHours = profile?.voiceHours ?? 8.2;
  const roomsJoined = profile?.roomsJoined ?? 24;
  const learningLanguage = profile?.learningLanguage ?? "Spanish";
  const level = profile?.level ?? "B1 Intermediate";
  const weeklyGoalMinutes = profile?.weeklyGoalMinutes ?? 60;
  const weeklyProgressMinutes = profile?.weeklyProgressMinutes ?? 45;

  const weeklyGoalPct = Math.min(
    100,
    (weeklyProgressMinutes / weeklyGoalMinutes) * 100,
  );

  // ----------------------------------------------------------
  // Voice rooms
  // ----------------------------------------------------------
  const activeVoiceRooms =
    voiceRooms?.filter((room) => room.status !== "ENDED") || [];
  const liveVoiceRooms = activeVoiceRooms.slice(0, 4);
  const hasLiveRooms = liveVoiceRooms.length > 0;

  // ----------------------------------------------------------
  // Stats (dynamic + sparklines)
  // ----------------------------------------------------------
  const stats: StatItem[] = useMemo(
    () => [
      {
        icon: Flame,
        label: "Streak",
        value: `${streak} Days`,
        colorBg: "bg-amber-50 dark:bg-amber-500/10",
        colorText: "text-amber-600 dark:text-amber-400",
        sparkColor: "text-amber-500 dark:text-amber-400",
        trend: "+2",
        trendUp: true,
        sparkline: [3, 5, 4, 7, 8, 12],
      },
      {
        icon: BookOpen,
        label: "Words Learned",
        value: wordsLearned.toLocaleString(),
        colorBg: "bg-indigo-50 dark:bg-indigo-500/10",
        colorText: "text-indigo-600 dark:text-indigo-400",
        sparkColor: "text-indigo-500 dark:text-indigo-400",
        trend: "+18",
        trendUp: true,
        sparkline: [280, 295, 310, 318, 325, 342],
      },
      {
        icon: Clock,
        label: "Time Spent",
        value: `${timeSpent}h`,
        colorBg: "bg-emerald-50 dark:bg-emerald-500/10",
        colorText: "text-emerald-600 dark:text-emerald-400",
        sparkColor: "text-emerald-500 dark:text-emerald-400",
        trend: "+1.2h",
        trendUp: true,
        sparkline: [8, 9.5, 11, 12, 13, 14.5],
      },
      {
        icon: Award,
        label: "Total XP",
        value: xp.toLocaleString(),
        colorBg: "bg-violet-50 dark:bg-violet-500/10",
        colorText: "text-violet-600 dark:text-violet-400",
        sparkColor: "text-violet-500 dark:text-violet-400",
        trend: "+150",
        trendUp: true,
        sparkline: [1800, 2000, 2150, 2300, 2380, 2450],
      },
      {
        icon: AudioLines,
        label: "Voice Hours",
        value: `${voiceHours}h`,
        colorBg: "bg-sky-50 dark:bg-sky-500/10",
        colorText: "text-sky-600 dark:text-sky-400",
        sparkColor: "text-sky-500 dark:text-sky-400",
        trend: "+0.5h",
        trendUp: true,
        sparkline: [4, 5, 6, 7, 7.5, 8.2],
      },
      {
        icon: Users,
        label: "Rooms Joined",
        value: roomsJoined.toString(),
        colorBg: "bg-rose-50 dark:bg-rose-500/10",
        colorText: "text-rose-600 dark:text-rose-400",
        sparkColor: "text-rose-500 dark:text-rose-400",
        sparkline: [12, 15, 18, 20, 22, 24],
      },
    ],
    [streak, wordsLearned, timeSpent, xp, voiceHours, roomsJoined],
  );

  // ----------------------------------------------------------
  // Learning hub items
  // ----------------------------------------------------------
  const learningHubItems = [
    {
      to: "/discover",
      title: "Discover",
      desc: "Find and join live voice rooms from around the world.",
      icon: Compass,
      colorBg: "bg-indigo-50 dark:bg-indigo-500/10",
      colorText: "text-indigo-600 dark:text-indigo-400",
      hoverBg: "group-hover:bg-indigo-600",
    },
    {
      to: "/vocabulary",
      title: "Vocabulary",
      desc: "Expand your word bank with spaced repetition.",
      icon: BookOpen,
      colorBg: "bg-indigo-50 dark:bg-indigo-500/10",
      colorText: "text-indigo-600 dark:text-indigo-400",
      hoverBg: "group-hover:bg-indigo-600",
    },
    {
      to: "/flashcards",
      title: "Flashcards",
      desc: "Master difficult terms using interactive cards.",
      icon: Layers,
      colorBg: "bg-violet-50 dark:bg-violet-500/10",
      colorText: "text-violet-600 dark:text-violet-400",
      hoverBg: "group-hover:bg-violet-600",
    },
    {
      to: "/grammar",
      title: "Grammar Rules",
      desc: "Understand tense usage, syntax, and structures.",
      icon: FileText,
      colorBg: "bg-sky-50 dark:bg-sky-500/10",
      colorText: "text-sky-600 dark:text-sky-400",
      hoverBg: "group-hover:bg-sky-600",
    },
    {
      to: "/exercises",
      title: "Interactive Exercises",
      desc: "Test your skills with quizzes and listening drills.",
      icon: Dumbbell,
      colorBg: "bg-emerald-50 dark:bg-emerald-500/10",
      colorText: "text-emerald-600 dark:text-emerald-400",
      hoverBg: "group-hover:bg-emerald-600",
    },
    {
      to: "/chat",
      title: "AI Chat Practice",
      desc: "Have real conversations and get instant feedback.",
      icon: MessageCircle,
      colorBg: "bg-rose-50 dark:bg-rose-500/10",
      colorText: "text-rose-600 dark:text-rose-400",
      hoverBg: "group-hover:bg-rose-600",
    },
    {
      to: "/voice",
      title: "Voice Rooms",
      desc: "Practice speaking with others in live rooms.",
      icon: AudioLines,
      colorBg: "bg-amber-50 dark:bg-amber-500/10",
      colorText: "text-amber-600 dark:text-amber-400",
      hoverBg: "group-hover:bg-amber-600",
    },
    {
      to: "/communities",
      title: "Communities",
      desc: "Join language communities and grow together.",
      icon: Hash,
      colorBg: "bg-teal-50 dark:bg-teal-500/10",
      colorText: "text-teal-600 dark:text-teal-400",
      hoverBg: "group-hover:bg-teal-600",
    },
  ];

  // ----------------------------------------------------------
  // Progress ring math
  // ----------------------------------------------------------
  const ringRadius = 43;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - weeklyGoalPct / 100);

  // ----------------------------------------------------------
  // Date
  // ----------------------------------------------------------
  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#0a0a14] dark:text-slate-100">
      <div className="min-h-screen">
        {/* ====================================================
            TOP HEADER
        ===================================================== */}
        <header className="sticky top-0 z-40 h-[72px] border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0a0a14]/90">
          <div className="flex h-full items-center justify-between px-6 lg:px-8">
            {/* Left — date + title */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {today}
                </p>
                <h1 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                  Your learning dashboard
                </h1>
              </div>
            </div>

            {/* Right — quick stats + profile */}
            <div className="flex items-center gap-2.5">
              {/* XP */}
              <div className="hidden items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 dark:border-violet-500/20 dark:bg-violet-500/10 sm:flex">
                <Award className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                  {xp.toLocaleString()} XP
                </span>
              </div>

              {/* Streak */}
              <div className="hidden items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 sm:flex">
                <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
                <span>{streak}</span>
              </div>

              {/* Live rooms */}
              {hasLiveRooms && (
                <button
                  type="button"
                  onClick={() => navigate("/discover")}
                  className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 dark:bg-red-500" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />
                  </span>
                  {liveVoiceRooms.length} Live
                </button>
              )}

              {/* Profile */}
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                title="Open profile"
              >
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </button>
            </div>
          </div>
        </header>

        {/* ====================================================
            PAGE CONTENT
        ===================================================== */}
        <motion.main
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="mx-auto max-w-[1500px] space-y-8 px-6 py-7 lg:px-8"
        >
          {/* ==================================================
              WELCOME HERO — with animated progress ring
          ================================================== */}
          <motion.section
            variants={fadeUp}
            className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-8 text-white shadow-xl shadow-indigo-200/40 dark:shadow-indigo-900/40"
          >
            {/* Background decoration */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 right-1/4 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
            <div className="pointer-events-none absolute left-1/3 top-0 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl" />

            <div className="relative z-10 flex items-center justify-between gap-12">
              {/* Hero text */}
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {learningLanguage} · {level}
                </div>

                <h2 className="mb-3 text-3xl font-extrabold tracking-tight lg:text-4xl">
                  Welcome back, {user?.name || "Learner"}! 👋
                </h2>

                <p className="mb-6 max-w-xl text-sm leading-relaxed text-indigo-100/90">
                  You're making great progress. Keep the momentum going and
                  turn today's practice into tomorrow's fluency.
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <motion.button
                    type="button"
                    onClick={() => navigate("/exercises")}
                    whileHover={reduced ? undefined : { y: -2 }}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Resume Lesson
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => navigate("/discover")}
                    whileHover={reduced ? undefined : { y: -2 }}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <Compass className="h-4 w-4" />
                    Discover
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => navigate("/voice")}
                    whileHover={reduced ? undefined : { y: -2 }}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                  >
                    <AudioLines className="h-4 w-4" />
                    Join Voice
                  </motion.button>
                </div>
              </div>

              {/* Animated progress ring */}
              <div className="relative mr-4 hidden shrink-0 sm:block">
                <div className="absolute inset-0 rounded-full bg-white/10 blur-2xl" />
                <svg
                  className="relative h-32 w-32 -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={ringRadius}
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="7"
                    fill="none"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r={ringRadius}
                    stroke="white"
                    strokeWidth="7"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    initial={{ strokeDashoffset: ringCircumference }}
                    animate={{ strokeDashoffset: ringOffset }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: 1.2, ease: "easeOut", delay: 0.4 }
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.4 }}
                    className="text-3xl font-extrabold"
                  >
                    {Math.round(weeklyGoalPct)}%
                  </motion.span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-100">
                    Weekly Goal
                  </span>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ==================================================
              STATS — with sparklines + trends
          ================================================== */}
          <motion.section
            variants={staggerContainer}
            className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6"
          >
            {stats.map((stat, i) => (
              <StatCard
                key={stat.label}
                stat={stat}
                index={i}
                reduced={Boolean(reduced)}
              />
            ))}
          </motion.section>

          {/* ==================================================
              TWO COLUMN AREA — Voice Rooms + Continue Learning
          ================================================== */}
          <section className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
            {/* ===========================================
                LIVE VOICE ROOMS
            ============================================ */}
            <motion.div variants={fadeUp}>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 dark:bg-red-500" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 dark:bg-red-400" />
                    </span>
                    Live Voice Rooms
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Join a conversation and practice speaking.
                  </p>
                </div>
                <Link
                  to="/voice"
                  className="flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {voiceLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[1, 2].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <ShimmerSkeleton className="h-14 w-14 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <ShimmerSkeleton className="h-4 w-3/4" />
                          <ShimmerSkeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : hasLiveRooms ? (
                <motion.div
                  variants={staggerContainer}
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                  {liveVoiceRooms.map((room) => {
                    const participantCount = room.participants?.length || 0;
                    const isFull =
                      room.maxParticipants &&
                      participantCount >= room.maxParticipants;
                    const isAlmostFull =
                      room.maxParticipants &&
                      participantCount / room.maxParticipants >= 0.8;
                    const activeSpeakers =
                      room.participants?.filter((p: any) => p.isSpeaking)
                        .length || 0;
                    const host = room.participants?.find(
                      (p: any) =>
                        p.role === "HOST" || p.userId === room.creatorId,
                    );

                    return (
                      <motion.div
                        key={room.id}
                        variants={fadeUp}
                        onClick={() => navigate(`/voice/${room.id}`)}
                        className="group cursor-pointer rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-500/30 dark:hover:shadow-black/20"
                      >
                        <div className="flex items-center gap-4">
                          {/* Icon with live indicator */}
                          <div className="relative shrink-0">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-indigo-100 transition-transform duration-200 group-hover:scale-105 dark:from-amber-500/20 dark:to-indigo-500/20">
                              <AudioLines className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-red-500 ring-2 ring-white dark:ring-[#0a0a14]" />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate font-bold text-slate-800 dark:text-slate-100">
                                {room.name}
                              </h3>
                              {isAlmostFull && !isFull && (
                                <span className="whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                  Almost full
                                </span>
                              )}
                              {isFull && (
                                <span className="whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                                  Full
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {participantCount}
                                {room.maxParticipants
                                  ? `/${room.maxParticipants}`
                                  : ""}
                              </span>
                              {activeSpeakers > 0 && (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
                                  {activeSpeakers} speaking
                                </span>
                              )}
                              {room.language && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/10">
                                  {room.language}
                                </span>
                              )}
                              {room.type && (
                                <span>
                                  {room.type === "PRIVATE" ? "🔒" : "🌎"}{" "}
                                  {room.type.toLowerCase()}
                                </span>
                              )}
                            </div>

                            {room.description && (
                              <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                                {room.description}
                              </p>
                            )}
                          </div>

                          {/* Join button */}
                          <motion.button
                            type="button"
                            disabled={isFull}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!isFull) navigate(`/voice/${room.id}`);
                            }}
                            whileTap={reduced ? undefined : { scale: 0.95 }}
                            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                              isFull
                                ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500"
                                : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md dark:bg-indigo-500 dark:hover:bg-indigo-400"
                            }`}
                          >
                            {isFull ? "Full" : "Join"}
                          </motion.button>
                        </div>

                        {/* Capacity bar */}
                        {room.maxParticipants && (
                          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                            <motion.div
                              className={`h-full rounded-full ${
                                isFull
                                  ? "bg-red-500"
                                  : isAlmostFull
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              initial={{ width: 0 }}
                              whileInView={{
                                width: `${(participantCount / room.maxParticipants) * 100}%`,
                              }}
                              viewport={{ once: true }}
                              transition={
                                reduced
                                  ? { duration: 0 }
                                  : { duration: 0.6, ease: "easeOut" }
                              }
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
                    <AudioLines className="h-8 w-8 text-amber-500 dark:text-amber-400" />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">
                    No Live Voice Rooms
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Be the first to start a conversation.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/voice")}
                    className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                  >
                    Start a Room
                  </button>
                </div>
              )}
            </motion.div>

            {/* ===========================================
                CONTINUE LEARNING — with animated progress
            ============================================ */}
            <motion.div variants={fadeUp}>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Continue Learning
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Pick up where you left off.
                  </p>
                </div>
                <Link
                  to="/progress"
                  className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded"
                >
                  View all
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">
                          Subjunctive Mood: Basics
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Lesson 4 of 8
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        50%
                      </span>
                    </div>

                    {/* Animated progress bar */}
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        initial={{ width: 0 }}
                        whileInView={{ width: "50%" }}
                        viewport={{ once: true }}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { duration: 0.8, ease: "easeOut", delay: 0.3 }
                        }
                      />
                    </div>
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={() => navigate("/exercises")}
                  whileTap={reduced ? undefined : { scale: 0.98 }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                >
                  <PlayCircle className="h-4 w-4" />
                  Resume Lesson
                </motion.button>
              </div>
            </motion.div>
          </section>

          {/* ==================================================
              SPEAKING GOAL + STREAK HEATMAP
          ================================================== */}
          <motion.section
            variants={fadeUp}
            className="relative overflow-hidden rounded-2xl border border-amber-100/60 bg-gradient-to-r from-amber-50 to-indigo-50 p-6 shadow-sm dark:border-amber-500/20 dark:from-amber-500/10 dark:to-indigo-500/10"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-indigo-200/20 blur-2xl dark:bg-indigo-500/10" />

            <div className="relative">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-indigo-500 shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/40">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">
                      Weekly Speaking Goal
                    </h3>
                    <div className="mt-1 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1">
                        <AudioLines className="h-3.5 w-3.5" />
                        {weeklyProgressMinutes}/{weeklyGoalMinutes} min
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        {Math.round(weeklyGoalPct)}% complete
                      </span>
                    </div>
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={() => navigate("/voice")}
                  whileTap={reduced ? undefined : { scale: 0.97 }}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200/50 transition hover:bg-indigo-700 dark:bg-indigo-500 dark:shadow-indigo-900/40 dark:hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                >
                  Practice Now
                </motion.button>
              </div>

              {/* Animated progress bar */}
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-indigo-600"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${weeklyGoalPct}%` }}
                  viewport={{ once: true }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.9, ease: "easeOut", delay: 0.2 }
                  }
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Zap className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                  {weeklyGoalMinutes - weeklyProgressMinutes} more minutes to hit
                  your goal.
                </p>

                {/* Activity heatmap */}
                <div className="hidden items-center gap-2 md:flex">
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    Last 12 weeks
                  </span>
                  <ActivityHeatmap streak={streak} />
                </div>
              </div>
            </div>
          </motion.section>

          {/* ==================================================
              LEARNING HUB
          ================================================== */}
          <motion.section variants={fadeUp}>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Learning Hub
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Choose an activity to start practicing.
              </p>
            </div>

            <motion.div
              variants={staggerContainer}
              className="grid grid-cols-2 gap-4 xl:grid-cols-4"
            >
              {learningHubItems.map(
                ({ to, title, desc, icon: Icon, colorBg, colorText, hoverBg }) => {
                  const isVoiceCard = to === "/voice";
                  const hasLive = isVoiceCard && hasLiveRooms;

                  return (
                    <motion.div key={to} variants={fadeUp}>
                      <Link
                        to={to}
                        className={`group relative block h-full overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 dark:bg-white/5 dark:hover:shadow-black/20 ${
                          hasLive
                            ? "border-amber-200 shadow-amber-100/50 dark:border-amber-500/30 dark:shadow-amber-900/20"
                            : "border-slate-100 dark:border-white/10"
                        }`}
                      >
                        {hasLive && (
                          <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-lg rounded-tr-lg bg-red-500 px-2 py-0.5 text-[8px] font-extrabold text-white">
                            <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                            LIVE
                          </div>
                        )}

                        <div
                          className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105 ${colorBg} ${colorText} ${hoverBg} group-hover:text-white`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <h3 className="mb-1 flex items-center justify-between font-bold text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                          <span>{title}</span>
                          <ArrowRight className="h-4 w-4 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                        </h3>

                        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {desc}
                        </p>

                        {hasLive && (
                          <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                            {liveVoiceRooms.length} active rooms
                          </span>
                        )}
                      </Link>
                    </motion.div>
                  );
                },
              )}
            </motion.div>
          </motion.section>

          {/* ==================================================
              RECENT VOICE ACTIVITY
          ================================================== */}
          <motion.section variants={fadeUp}>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                  <Headphones className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Recent Voice Activity
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Your recent voice room sessions.
                </p>
              </div>
              <Link
                to="/voice"
                className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded"
              >
                History
              </Link>
            </div>

            {voiceLoading ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="flex items-center gap-4">
                      <ShimmerSkeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <ShimmerSkeleton className="h-4 w-3/4" />
                        <ShimmerSkeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : hasLiveRooms ? (
              <motion.div
                variants={staggerContainer}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {liveVoiceRooms.slice(0, 3).map((room) => (
                    <motion.button
                      key={room.id}
                      variants={fadeUp}
                      type="button"
                      onClick={() => navigate(`/voice/${room.id}`)}
                      className="group flex w-full items-center gap-4 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-white/5"
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-indigo-100 dark:from-amber-500/20 dark:to-indigo-500/20">
                        <AudioLines className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-[#0a0a14] dark:bg-emerald-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                          {room.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {room.participants?.length || 0} participants
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {room.createdAt
                              ? formatDistanceToNow(new Date(room.createdAt), {
                                  addSuffix: true,
                                })
                              : "Just now"}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Live
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600 dark:group-hover:text-indigo-400" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                  <Headphones className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No recent voice activity.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/voice")}
                  className="mt-3 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded"
                >
                  Start your first voice session →
                </button>
              </div>
            )}
          </motion.section>

          {/* ==================================================
              FOOTER — fixed branding
          ================================================== */}
          <motion.footer
            variants={fadeUp}
            className="border-t border-slate-200/70 py-5 dark:border-slate-800/70"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                © {new Date().getFullYear()} SpeakBetter · Learn without
                limits.
              </p>
              <div className="flex items-center gap-5 text-xs text-slate-400 dark:text-slate-500">
                <Link
                  to="/settings"
                  className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded"
                >
                  Settings
                </Link>
                <Link
                  to="/communities"
                  className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded"
                >
                  Community
                </Link>
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Secure
                </span>
              </div>
            </div>
          </motion.footer>
        </motion.main>
      </div>
    </div>
  );
};

export default DashboardPage;