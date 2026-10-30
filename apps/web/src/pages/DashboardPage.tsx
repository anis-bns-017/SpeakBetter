// apps/web/src/pages/DashboardPage.tsx
/**
 * DashboardPage — the learner's home. Every number comes from real activity
 * (GET /learning/dashboard): XP is earned by speaking in voice rooms, giving and
 * accepting corrections, reviewing flashcards and finishing exercises; any of
 * those also keeps the daily streak alive.
 */

import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Flame,
  BookOpen,
  Layers,
  FileText,
  Dumbbell,
  MessageCircle,
  AudioLines,
  Hash,
  Compass,
  Mic,
  Radio,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Search,
  UserPlus,
  Check,
  Users,
  Clock,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useDashboard, type DashboardData } from "../hooks/useLearning";
import { useTrendingRooms } from "../hooks/useDiscovery";
import { useSuggestions, useSendFriendRequest } from "../hooks/useFriends";
import { getXpLevel, getLevelProgress, getNextLevelXp } from "../lib/xpLevels";

// ============================================================
// Helpers
// ============================================================

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay: i * 0.05, ease: "easeOut" } }),
};

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

// ============================================================
// Pieces
// ============================================================

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-white/[0.06] ${className ?? ""}`} />
);

const SectionTitle: React.FC<{ title: string; action?: { label: string; to: string } }> = ({ title, action }) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    {action && (
      <Link to={action.to} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-1">
        {action.label} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    )}
  </div>
);

/** Daily XP goal ring */
const GoalRing: React.FC<{ value: number; goal: number; reduced: boolean }> = ({ value, goal, reduced }) => {
  const size = 132;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal > 0 ? value / goal : 0);
  const done = value >= goal;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/15" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="url(#goal-gradient)"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={reduced ? { duration: 0 } : { duration: 1, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="goal-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={done ? "#34d399" : "#fbbf24"} />
            <stop offset="100%" stopColor={done ? "#10b981" : "#f97316"} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        {done ? <CheckCircle2 className="w-6 h-6 text-emerald-300 mb-0.5" /> : <Target className="w-5 h-5 text-white/70 mb-0.5" />}
        <span className="text-2xl font-bold tabular-nums leading-none">{value}</span>
        <span className="text-[11px] text-white/70 mt-0.5">/ {goal} XP</span>
      </div>
    </div>
  );
};

/** Last 7 days of XP as bars */
const WeekBars: React.FC<{ days: Array<{ date: string; xp: number }>; reduced: boolean }> = ({ days, reduced }) => {
  const max = Math.max(10, ...days.map((d) => d.xp));
  return (
    <div className="flex items-end gap-2 h-24">
      {days.map((d, i) => {
        const date = new Date(`${d.date}T00:00:00`);
        const isToday = i === days.length - 1;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full">
            <div className="flex-1 w-full flex items-end">
              <motion.div
                className={`w-full rounded-lg ${d.xp > 0 ? (isToday ? "bg-gradient-to-t from-indigo-600 to-violet-500" : "bg-indigo-500/70 dark:bg-indigo-400/60") : "bg-slate-100 dark:bg-white/[0.05]"}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(6, (d.xp / max) * 100)}%` }}
                transition={reduced ? { duration: 0 } : { duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
                title={`${d.xp} XP`}
              />
            </div>
            <span className={`text-[10.5px] ${isToday ? "font-bold text-slate-900 dark:text-slate-100" : "text-slate-400"}`}>
              {date.toLocaleDateString(undefined, { weekday: "narrow" })}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** 12-week activity heatmap from real XP per day */
const ActivityHeatmap: React.FC<{ activity: DashboardData["activity"] }> = ({ activity }) => {
  // Pad the start so columns are whole weeks starting on Sunday
  const first = activity.length ? new Date(`${activity[0].date}T00:00:00`) : new Date();
  const padded: Array<{ date: string; xp: number } | null> = [...Array(first.getDay()).fill(null), ...activity];
  const max = Math.max(1, ...activity.map((d) => d.xp));
  const level = (xp: number) => (xp <= 0 ? 0 : xp < max * 0.25 ? 1 : xp < max * 0.5 ? 2 : xp < max * 0.75 ? 3 : 4);
  const shades = [
    "bg-slate-100 dark:bg-white/[0.05]",
    "bg-indigo-200 dark:bg-indigo-500/30",
    "bg-indigo-300 dark:bg-indigo-500/50",
    "bg-indigo-500 dark:bg-indigo-400/80",
    "bg-indigo-700 dark:bg-indigo-300",
  ];

  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-[4px] w-max">
        {padded.map((d, i) =>
          d ? (
            <div
              key={d.date}
              className={`w-[13px] h-[13px] rounded-[3px] ${shades[level(d.xp)]}`}
              title={`${new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${d.xp} XP`}
            />
          ) : (
            <div key={`pad-${i}`} className="w-[13px] h-[13px]" />
          ),
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[10.5px] text-slate-400">
        Less
        {shades.map((s) => <span key={s} className={`w-[11px] h-[11px] rounded-[3px] ${s}`} />)}
        More
      </div>
    </div>
  );
};

interface Stat {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone: string;
  to: string;
}

const StatTile: React.FC<{ stat: Stat; index: number }> = ({ stat, index }) => {
  const Icon = stat.icon;
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={index}>
      <Link
        to={stat.to}
        className={`${card} group block p-4 h-full transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.tone}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">{stat.value}</p>
        <p className="text-[12.5px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">{stat.label}</p>
        {stat.sub && <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-1">{stat.sub}</p>}
      </Link>
    </motion.div>
  );
};

interface NextStep {
  id: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
  to: string;
  cta: string;
}

/** Suggestions picked from what the learner has (and hasn't) done */
function buildNextSteps(d: DashboardData, liveRoom?: { id: string; name: string }): NextStep[] {
  const steps: NextStep[] = [];
  if (!d.streak.practicedToday && d.streak.current > 0) {
    steps.push({ id: "streak", title: `Save your ${d.streak.current}-day streak`, detail: "Any practice today keeps it alive", icon: Flame, tone: "bg-orange-500/10 text-orange-500", to: liveRoom ? `/voice/${liveRoom.id}` : "/voice", cta: "Practice now" });
  }
  if (d.corrections.pending > 0) {
    steps.push({ id: "corrections", title: `${d.corrections.pending} correction${d.corrections.pending === 1 ? "" : "s"} waiting for you`, detail: "Accept the ones that help — each earns 5 XP", icon: Wand2, tone: "bg-violet-500/10 text-violet-500", to: "/voice", cta: "Review" });
  }
  if (d.flashcards.due > 0) {
    steps.push({ id: "cards", title: `${d.flashcards.due} flashcard${d.flashcards.due === 1 ? "" : "s"} due`, detail: "A quick review locks words into memory", icon: Layers, tone: "bg-sky-500/10 text-sky-500", to: "/flashcards", cta: "Review" });
  }
  if (d.voice.speakingMinutesThisWeek < 10) {
    steps.push({
      id: "speak",
      title: liveRoom ? `Join “${liveRoom.name}”` : "Speak for 10 minutes this week",
      detail: liveRoom ? "It's live right now — jump in and listen first" : `${d.voice.speakingMinutesThisWeek} of 10 minutes so far · speaking earns the most XP`,
      icon: Mic,
      tone: "bg-indigo-500/10 text-indigo-500",
      to: liveRoom ? `/voice/${liveRoom.id}` : "/voice",
      cta: liveRoom ? "Join" : "Find a room",
    });
  }
  if (d.words.thisWeek === 0) {
    steps.push({ id: "words", title: "Save new words you hear", detail: "Build your own vocabulary list from conversations", icon: BookOpen, tone: "bg-emerald-500/10 text-emerald-500", to: "/vocabulary", cta: "Add words" });
  }
  if (d.corrections.given === 0) {
    steps.push({ id: "help", title: "Help someone with a correction", detail: "Teaching is learning — and it earns 3 XP", icon: Sparkles, tone: "bg-amber-500/10 text-amber-500", to: "/voice", cta: "Find a room" });
  }
  steps.push({ id: "exercise", title: "Do a short exercise", detail: "10 XP for each one you finish", icon: Dumbbell, tone: "bg-rose-500/10 text-rose-500", to: "/exercises", cta: "Start" });
  return steps.slice(0, 4);
}

const EXPLORE: Array<{ to: string; title: string; desc: string; icon: LucideIcon; tone: string }> = [
  { to: "/voice", title: "Voice Rooms", desc: "Live speaking practice", icon: AudioLines, tone: "text-indigo-500 bg-indigo-500/10" },
  { to: "/chat", title: "Chat", desc: "Message partners", icon: MessageCircle, tone: "text-rose-500 bg-rose-500/10" },
  { to: "/communities", title: "Communities", desc: "Groups by interest", icon: Hash, tone: "text-teal-500 bg-teal-500/10" },
  { to: "/discover", title: "Discover", desc: "Trending rooms", icon: Compass, tone: "text-amber-500 bg-amber-500/10" },
  { to: "/vocabulary", title: "Vocabulary", desc: "Your word bank", icon: BookOpen, tone: "text-emerald-500 bg-emerald-500/10" },
  { to: "/flashcards", title: "Flashcards", desc: "Spaced repetition", icon: Layers, tone: "text-sky-500 bg-sky-500/10" },
  { to: "/grammar", title: "Grammar", desc: "Rules & tenses", icon: FileText, tone: "text-violet-500 bg-violet-500/10" },
  { to: "/exercises", title: "Exercises", desc: "Quizzes & drills", icon: Dumbbell, tone: "text-orange-500 bg-orange-500/10" },
];

// ============================================================
// Page
// ============================================================

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = Boolean(useReducedMotion());
  const { openPalette } = useSidebar();

  const { data, isLoading, isError, refetch } = useDashboard();
  const { data: trending } = useTrendingRooms(6);
  const { data: suggestionsData } = useSuggestions();
  const sendRequest = useSendFriendRequest();
  // People you just sent a request to (suggestions don't refetch until you come back)
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set());

  const liveRooms = useMemo(
    () => (Array.isArray(trending) ? trending : []).filter((r) => r && r.isLive !== false && (r.participantCount ?? 0) > 0).slice(0, 4),
    [trending],
  );

  const suggestions = useMemo(() => {
    return (Array.isArray(suggestionsData) ? suggestionsData : []).slice(0, 4);
  }, [suggestionsData]);

  const firstName = (user?.name || "there").split(" ")[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  // ---------------- Loading / error ----------------
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-9 w-72" />
        <div className="grid lg:grid-cols-3 gap-5">
          <Skeleton className="h-56 lg:col-span-2 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">We couldn't load your dashboard</p>
        <p className="text-sm text-slate-500 mt-1">Check your connection and try again.</p>
        <button type="button" onClick={() => refetch()} className="mt-5 px-4 h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          Try again
        </button>
      </div>
    );
  }

  // ---------------- Derived ----------------
  const level = getXpLevel(data.xp.total);
  const levelPct = getLevelProgress(data.xp.total);
  const xpToNext = Math.max(0, getNextLevelXp(data.xp.total) - data.xp.total);
  const weekChange = percentChange(data.xp.thisWeek, data.xp.lastWeek);
  const lastSeven = data.activity.slice(-7);
  const activeDays = data.activity.filter((d) => d.xp > 0).length;
  const goalDone = data.xp.today >= data.xp.dailyGoal;
  const nextSteps = buildNextSteps(data, liveRooms[0]);
  const isNewLearner = data.xp.total === 0 && data.voice.roomsJoined === 0;
  const learning = data.profile.learningLanguages[0] ?? "English";

  const statusLine = goalDone
    ? "Daily goal complete — brilliant work today! 🎉"
    : data.streak.practicedToday
      ? `${data.xp.dailyGoal - data.xp.today} XP to go for today's goal`
      : data.streak.current > 0
        ? `Practice today to keep your ${data.streak.current}-day streak 🔥`
        : "Let's make today your first practice day";

  const stats: Stat[] = [
    { label: `Level ${level}`, value: data.xp.total.toLocaleString(), sub: xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to level ${level + 1}` : "Max level", icon: Trophy, tone: "bg-violet-500/10 text-violet-500", to: "/progress" },
    { label: "Day streak", value: String(data.streak.current), sub: `Best: ${data.streak.longest} day${data.streak.longest === 1 ? "" : "s"}`, icon: Flame, tone: "bg-orange-500/10 text-orange-500", to: "/progress" },
    { label: "Minutes spoken", value: String(data.voice.speakingMinutes), sub: `${data.voice.speakingMinutesThisWeek} this week`, icon: Mic, tone: "bg-indigo-500/10 text-indigo-500", to: "/voice" },
    { label: "Rooms joined", value: String(data.voice.roomsJoined), sub: `${data.voice.roomsThisWeek} this week`, icon: Users, tone: "bg-sky-500/10 text-sky-500", to: "/voice" },
    { label: "Corrections learned", value: String(data.corrections.accepted), sub: `${data.corrections.given} given to others`, icon: Wand2, tone: "bg-fuchsia-500/10 text-fuchsia-500", to: "/progress" },
    { label: "Words saved", value: data.words.total.toLocaleString(), sub: `${data.words.thisWeek} this week`, icon: BookOpen, tone: "bg-emerald-500/10 text-emerald-500", to: "/vocabulary" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      {/* ================= Header ================= */}
      <motion.header variants={fadeUp} initial="hidden" animate="show" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{today}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{statusLine}</p>
        </div>
        <button
          type="button"
          onClick={openPalette}
          className="hidden sm:flex items-center gap-2 h-10 pl-3 pr-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm text-slate-500 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
        >
          <Search className="w-4 h-4" /> Jump to anything
          <kbd className="ml-3 rounded-md border border-slate-200 dark:border-white/10 px-1.5 py-0.5 text-[11px] font-sans">{IS_MAC ? "⌘" : "Ctrl"} K</kbd>
        </button>
      </motion.header>

      {/* ================= Hero: today + this week ================= */}
      <div className="grid lg:grid-cols-3 gap-5">
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="lg:col-span-2 relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 shadow-xl shadow-indigo-500/20"
        >
          <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 left-1/3 w-72 h-72 rounded-full bg-fuchsia-400/20 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            <GoalRing value={data.xp.today} goal={data.xp.dailyGoal} reduced={reduced} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Today's goal</p>
              <h2 className="text-2xl font-bold mt-1 leading-snug">
                {isNewLearner ? `Your ${learning} journey starts here` : goalDone ? "Goal smashed!" : "Earn today's XP by speaking"}
              </h2>
              <p className="text-sm text-white/80 mt-1.5 max-w-md">
                {isNewLearner
                  ? "Join a live room and just listen at first. When you're ready, raise your hand and say hello."
                  : "Speaking earns 4 XP a minute, corrections 3–5 XP, flashcards 2 XP each."}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => navigate(liveRooms[0] ? `/voice/${liveRooms[0].id}` : "/voice")}
                  className="h-11 px-5 rounded-xl bg-white text-indigo-700 font-semibold text-sm flex items-center gap-2 shadow-lg shadow-black/10 hover:-translate-y-0.5 transition-transform"
                >
                  <Mic className="w-4 h-4" /> {liveRooms[0] ? "Join a live room" : "Start speaking"}
                </button>
                {data.flashcards.due > 0 && (
                  <button type="button" onClick={() => navigate("/flashcards")} className="h-11 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-sm flex items-center gap-2 transition-colors">
                    <Layers className="w-4 h-4" /> Review {data.flashcards.due} card{data.flashcards.due === 1 ? "" : "s"}
                  </button>
                )}
              </div>
            </div>

            <div className="hidden xl:flex flex-col items-center justify-center w-28 shrink-0 rounded-2xl bg-white/10 py-4">
              <Flame className={`w-8 h-8 ${data.streak.current > 0 ? "text-amber-300 fill-amber-300/40" : "text-white/40"}`} />
              <p className="text-3xl font-bold tabular-nums mt-1">{data.streak.current}</p>
              <p className="text-[11px] text-white/70">day streak</p>
              <div className="flex gap-1 mt-2.5">
                {lastSeven.map((d) => (
                  <span key={d.date} className={`w-2 h-2 rounded-full ${d.xp > 0 ? "bg-amber-300" : "bg-white/20"}`} title={d.date} />
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={fadeUp} initial="hidden" animate="show" custom={2} className={`${card} p-6`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">This week</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {data.xp.thisWeek.toLocaleString()} <span className="text-base font-semibold text-slate-400">XP</span>
              </p>
            </div>
            {weekChange !== null && weekChange !== 0 && (
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${weekChange > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                {weekChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {weekChange > 0 ? "+" : ""}{weekChange}%
              </span>
            )}
            {weekChange === null && data.xp.thisWeek > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                <Zap className="w-3.5 h-3.5" /> New
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">vs {data.xp.lastWeek.toLocaleString()} XP last week</p>
          <div className="mt-5"><WeekBars days={lastSeven} reduced={reduced} /></div>
        </motion.section>
      </div>

      {/* ================= Stats ================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => <StatTile key={stat.label} stat={stat} index={i + 3} />)}
      </div>

      {/* ================= Next steps + Live now ================= */}
      <div className="grid lg:grid-cols-5 gap-5">
        <motion.section variants={fadeUp} initial="hidden" animate="show" custom={4} className={`${card} p-6 lg:col-span-3`}>
          <SectionTitle title="Your next steps" />
          <div className="space-y-2.5">
            {nextSteps.map((step) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.id}
                  to={step.to}
                  className="group flex items-center gap-3.5 p-3 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${step.tone}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{step.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{step.detail}</span>
                  </span>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1 shrink-0">
                    {step.cta} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.section>

        <motion.section variants={fadeUp} initial="hidden" animate="show" custom={5} className={`${card} p-6 lg:col-span-2`}>
          <SectionTitle title="Live now" action={{ label: "All rooms", to: "/voice" }} />
          {liveRooms.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                <Radio className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No rooms live right now</p>
              <p className="text-xs text-slate-500 mt-1">Start one — others will join you.</p>
              <button type="button" onClick={() => navigate("/voice")} className="mt-4 h-9 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                Start a room
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {liveRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => navigate(`/voice/${room.id}`)}
                  className="group w-full flex items-center gap-3 p-3 rounded-2xl text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <span className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white flex items-center justify-center shrink-0">
                    <AudioLines className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0f172a]">
                      <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-70" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{room.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {room.participantCount} in room{room.language ? ` · ${room.language}` : ""}{room.creator?.name ? ` · ${room.creator.name}` : ""}
                    </span>
                  </span>
                  <span className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center opacity-90 group-hover:opacity-100">Join</span>
                </button>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* ================= Activity + corrections ================= */}
      <div className="grid lg:grid-cols-5 gap-5">
        <motion.section variants={fadeUp} initial="hidden" animate="show" custom={6} className={`${card} p-6 lg:col-span-3 overflow-hidden`}>
          <SectionTitle title="Your practice, last 12 weeks" action={{ label: "Progress", to: "/progress" }} />
          <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
            <div className="overflow-x-auto max-w-full pb-1"><ActivityHeatmap activity={data.activity} /></div>
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{activeDays}</p>
                <p className="text-xs text-slate-500">active days</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{data.streak.longest}</p>
                <p className="text-xs text-slate-500">longest streak</p>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Level {level}</span>
              <span className="text-slate-500">{xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to level ${level + 1}` : "Max level"}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                initial={{ width: 0 }}
                animate={{ width: `${levelPct}%` }}
                transition={reduced ? { duration: 0 } : { duration: 0.9, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.section>

        <motion.section variants={fadeUp} initial="hidden" animate="show" custom={7} className={`${card} p-6 lg:col-span-2`}>
          <SectionTitle title="Learned from the community" />
          {data.corrections.recent.length === 0 ? (
            <div className="py-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                When someone in a voice room corrects your English and you accept it, it shows up here so you can review it.
              </p>
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-sm">
                <p className="text-slate-400 line-through">I am agree with you</p>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-1">I agree with you</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.corrections.recent.map((c) => (
                <div key={c.id} className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3.5">
                  <p className="text-sm text-slate-400 line-through decoration-rose-400/70">{c.original}</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{c.corrected}</p>
                  {c.note && <p className="text-xs text-slate-500 mt-1.5">{c.note}</p>}
                  <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                    <span className="capitalize">{c.category.replace("-", " ")}</span> · from {c.authorName}
                    {c.resolvedAt && <><Clock className="w-3 h-3 ml-1" /> {new Date(c.resolvedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* ================= Partners ================= */}
      {suggestions.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="show" custom={8} className={`${card} p-6`}>
          <SectionTitle title="Practice partners for you" action={{ label: "See more", to: "/suggestions" }} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {suggestions.map((person) => (
              <div key={person.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.07]">
                <span className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold flex items-center justify-center shrink-0">
                  {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="w-full h-full object-cover" /> : (person.name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{person.name || "Learner"}</span>
                  <span className="block text-xs text-slate-500 truncate" title={person.reason}>
                    {person.reason || (person.profile?.nativeLanguage ? `Speaks ${person.profile.nativeLanguage}` : "Language learner")}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={person.isRequested || requestedIds.has(person.id) || sendRequest.isPending}
                  onClick={() =>
                    sendRequest.mutate(person.id, {
                      onSuccess: () => setRequestedIds((prev) => new Set(prev).add(person.id)),
                    })
                  }
                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-40 transition-colors"
                  aria-label={`Add ${person.name || "this person"} as a friend`}
                  title={requestedIds.has(person.id) ? "Request sent" : "Add friend"}
                >
                  {requestedIds.has(person.id) ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ================= Explore ================= */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" custom={9}>
        <SectionTitle title="Explore" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {EXPLORE.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`${card} group flex items-center gap-3 p-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.tone}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{item.title}</span>
                  <span className="block text-xs text-slate-500 truncate">{item.desc}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
};

export default DashboardPage;
