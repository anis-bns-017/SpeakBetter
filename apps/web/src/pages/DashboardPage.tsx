import React from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Menu,
  PlayCircle,
  Hash,
  Headphones,
  Compass,
  Target,
  Zap,
  Shield,
  GraduationCap,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useVoiceRooms } from "../hooks/useVoice";
import { formatDistanceToNow } from "date-fns";

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: voiceRooms, isLoading: voiceLoading } = useVoiceRooms();

  /*
   * ============================================================
   * VOICE ROOMS
   * ============================================================
   */

  const activeVoiceRooms =
    voiceRooms?.filter((room) => room.status !== "ENDED") || [];

  const liveVoiceRooms = activeVoiceRooms.slice(0, 4);

  const hasLiveRooms = liveVoiceRooms.length > 0;

  /*
   * ============================================================
   * DASHBOARD DATA
   * ============================================================
   */

  const stats = [
    {
      icon: Flame,
      label: "Streak",
      value: "12 Days",
      color: "bg-amber-50 text-amber-600",
    },
    {
      icon: BookOpen,
      label: "Words Learned",
      value: "342",
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      icon: Clock,
      label: "Time Spent",
      value: "14.5h",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: Award,
      label: "Total XP",
      value: "2,450",
      color: "bg-violet-50 text-violet-600",
    },
    {
      icon: AudioLines,
      label: "Voice Hours",
      value: "8.2h",
      color: "bg-sky-50 text-sky-600",
    },
    {
      icon: Users,
      label: "Rooms Joined",
      value: "24",
      color: "bg-rose-50 text-rose-600",
    },
  ];

  const learningHubItems = [
    {
      to: "/discover",
      title: "Discover",
      desc: "Find and join live voice rooms from around the world.",
      icon: Compass,
      color:
        "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white",
    },
    {
      to: "/vocabulary",
      title: "Vocabulary",
      desc: "Expand your word bank with spaced repetition.",
      icon: BookOpen,
      color:
        "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white",
    },
    {
      to: "/flashcards",
      title: "Flashcards",
      desc: "Master difficult terms using interactive cards.",
      icon: Layers,
      color:
        "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    },
    {
      to: "/grammar",
      title: "Grammar Rules",
      desc: "Understand tense usage, syntax, and structures.",
      icon: FileText,
      color:
        "bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white",
    },
    {
      to: "/exercises",
      title: "Interactive Exercises",
      desc: "Test your skills with quizzes and listening drills.",
      icon: Dumbbell,
      color:
        "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
    },
    {
      to: "/chat",
      title: "AI Chat Practice",
      desc: "Have real conversations and get instant feedback.",
      icon: MessageCircle,
      color:
        "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white",
    },
    {
      to: "/voice",
      title: "Voice Rooms",
      desc: "Practice speaking with others in live rooms.",
      icon: AudioLines,
      color:
        "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white",
    },
    {
      to: "/communities",
      title: "Communities",
      desc: "Join language communities and grow together.",
      icon: Hash,
      color:
        "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white",
    },
  ];

  /*
   * ============================================================
   * DATE
   * ============================================================
   */

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* ========================================================
          MAIN CONTENT
      ========================================================= */}

      <div className="min-h-screen">
        {/* ======================================================
            TOP HEADER
        ======================================================= */}

        <header className="sticky top-0 z-40 h-[72px] border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between px-6 lg:px-8">
            {/* Left */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <BarChart3 className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-400">
                  {today}
                </p>

                <h1 className="truncate text-sm font-bold text-slate-800">
                  Your learning dashboard
                </h1>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
              {/* XP */}
              <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
                <Award className="h-4 w-4 text-violet-600" />

                <span className="text-xs font-bold text-violet-700">
                  2,450 XP
                </span>
              </div>

              {/* Streak */}
              <div className="flex items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span>12</span>
              </div>

              {/* Live rooms */}
              {hasLiveRooms && (
                <button
                  type="button"
                  onClick={() => navigate("/discover")}
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-xl
                    border
                    border-red-100
                    bg-red-50
                    px-3
                    py-2
                    text-xs
                    font-bold
                    text-red-600
                    transition
                    hover:bg-red-100
                  "
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>

                  {liveVoiceRooms.length} Live
                </button>
              )}

              {/* Profile */}
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-indigo-100
                  bg-indigo-50
                  text-sm
                  font-bold
                  text-indigo-700
                  transition
                  hover:bg-indigo-100
                "
                title="Open profile"
              >
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </button>
            </div>
          </div>
        </header>

        {/* ======================================================
            PAGE CONTENT
        ======================================================= */}

        <main className="mx-auto max-w-[1500px] space-y-8 px-6 py-7 lg:px-8">
          {/* ====================================================
              WELCOME HERO
          ===================================================== */}

          <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-8 text-white shadow-xl shadow-indigo-200/40">
            {/* Background decoration */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

            <div className="pointer-events-none absolute -bottom-28 right-1/4 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />

            <div className="pointer-events-none absolute left-1/3 top-0 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl" />

            <div className="relative z-10 flex items-center justify-between gap-12">
              {/* Hero text */}
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Spanish · Intermediate B1
                </div>

                <h2 className="mb-3 text-3xl font-extrabold tracking-tight lg:text-4xl">
                  Welcome back, {user?.name || "Learner"}! 👋
                </h2>

                <p className="mb-6 max-w-xl text-sm leading-relaxed text-indigo-100/90">
                  You're making great progress. Keep the momentum going and
                  turn today's practice into tomorrow's fluency.
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => navigate("/exercises")}
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-xl
                      bg-white
                      px-4
                      py-2.5
                      text-sm
                      font-bold
                      text-indigo-700
                      shadow-sm
                      transition-all
                      hover:-translate-y-0.5
                      hover:bg-indigo-50
                      hover:shadow-lg
                    "
                  >
                    <PlayCircle className="h-4 w-4" />
                    Resume Lesson
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/discover")}
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-xl
                      border
                      border-white/10
                      bg-white/10
                      px-4
                      py-2.5
                      text-sm
                      font-bold
                      text-white
                      backdrop-blur-sm
                      transition
                      hover:bg-white/15
                    "
                  >
                    <Compass className="h-4 w-4" />
                    Discover
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/voice")}
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-xl
                      border
                      border-emerald-400/30
                      bg-emerald-500/20
                      px-4
                      py-2.5
                      text-sm
                      font-bold
                      text-white
                      backdrop-blur-sm
                      transition
                      hover:bg-emerald-500/30
                    "
                  >
                    <AudioLines className="h-4 w-4" />
                    Join Voice
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="relative mr-4 shrink-0">
                <div className="absolute inset-0 rounded-full bg-white/10 blur-2xl" />

                <svg
                  className="relative h-32 w-32 -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="43"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="7"
                    fill="none"
                  />

                  <circle
                    cx="50"
                    cy="50"
                    r="43"
                    stroke="white"
                    strokeWidth="7"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="270"
                    strokeDashoffset="54"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold">80%</span>

                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-100">
                    Weekly Goal
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ====================================================
              STATS
          ===================================================== */}

          <section className="grid grid-cols-3 gap-4 xl:grid-cols-6">
            {stats.map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="
                  group
                  flex
                  items-center
                  gap-3
                  rounded-2xl
                  border
                  border-slate-100
                  bg-white
                  p-4
                  shadow-sm
                  transition-all
                  duration-200
                  hover:-translate-y-0.5
                  hover:shadow-md
                "
              >
                <div
                  className={`
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    ${color}
                    transition-transform
                    duration-200
                    group-hover:scale-105
                  `}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>

                  <p className="truncate text-lg font-extrabold text-slate-800">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </section>

          {/* ====================================================
              DISCOVER BANNER
          ===================================================== */}

          <section className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 p-6 shadow-sm">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-200/30 blur-2xl" />

            <div className="relative flex items-center justify-between gap-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-200/50">
                  <Compass className="h-8 w-8 text-white" />
                </div>

                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    Discover Voice Rooms

                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-extrabold text-indigo-600">
                      NEW
                    </span>
                  </h3>

                  <p className="mt-0.5 text-sm text-slate-600">
                    Find and join live conversations from around the world.
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`
                        flex
                        items-center
                        gap-1.5
                        rounded-full
                        px-2
                        py-0.5
                        text-xs
                        ${
                          hasLiveRooms
                            ? "bg-emerald-100/70 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }
                      `}
                    >
                      <span
                        className={`
                          h-1.5
                          w-1.5
                          rounded-full
                          ${
                            hasLiveRooms
                              ? "animate-pulse bg-emerald-500"
                              : "bg-slate-300"
                          }
                        `}
                      />

                      {hasLiveRooms
                        ? `${liveVoiceRooms.length} rooms active`
                        : "No rooms active"}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                to="/discover"
                className="
                  inline-flex
                  shrink-0
                  items-center
                  gap-2
                  rounded-xl
                  bg-indigo-600
                  px-6
                  py-2.5
                  text-sm
                  font-bold
                  text-white
                  shadow-md
                  shadow-indigo-200/50
                  transition-all
                  hover:-translate-y-0.5
                  hover:bg-indigo-700
                "
              >
                Explore Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* ====================================================
              TWO COLUMN AREA
          ===================================================== */}

          <section className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
            {/* ==================================================
                LIVE VOICE ROOMS
            =================================================== */}

            <div>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>

                    Live Voice Rooms
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Join a conversation and practice speaking.
                  </p>
                </div>

                <Link
                  to="/voice"
                  className="flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
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
                      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                    >
                      <div className="animate-pulse">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-xl bg-slate-200" />

                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-3/4 rounded bg-slate-200" />
                            <div className="h-3 w-1/2 rounded bg-slate-100" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : hasLiveRooms ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {liveVoiceRooms.map((room) => {
                    const participantCount = room.participants?.length || 0;

                    const isFull =
                      participantCount >= room.maxParticipants;

                    const isAlmostFull =
                      participantCount / room.maxParticipants >= 0.8;

                    return (
                      <div
                        key={room.id}
                        onClick={() => navigate(`/voice/${room.id}`)}
                        className="
                          group
                          cursor-pointer
                          rounded-2xl
                          border
                          border-slate-100
                          bg-white
                          p-5
                          shadow-sm
                          transition-all
                          duration-200
                          hover:-translate-y-0.5
                          hover:border-indigo-200
                          hover:shadow-lg
                        "
                      >
                        <div className="flex items-center gap-4">
                          {/* Icon */}
                          <div className="relative shrink-0">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-indigo-100 transition-transform duration-200 group-hover:scale-105">
                              <AudioLines className="h-7 w-7 text-indigo-600" />
                            </div>

                            <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-red-500 ring-2 ring-white" />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate font-bold text-slate-800">
                                {room.name}
                              </h3>

                              {isAlmostFull && !isFull && (
                                <span className="whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                  Almost full
                                </span>
                              )}

                              {isFull && (
                                <span className="whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                  Full
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {participantCount}/{room.maxParticipants}
                              </span>

                              {room.type && (
                                <span>
                                  {room.type === "PRIVATE" ? "🔒" : "🌎"}{" "}
                                  {room.type.toLowerCase()}
                                </span>
                              )}
                            </div>

                            {room.description && (
                              <p className="mt-1 truncate text-xs text-slate-400">
                                {room.description}
                              </p>
                            )}
                          </div>

                          {/* Join */}
                          <button
                            type="button"
                            disabled={isFull}
                            onClick={(event) => {
                              event.stopPropagation();

                              if (!isFull) {
                                navigate(`/voice/${room.id}`);
                              }
                            }}
                            className={`
                              shrink-0
                              rounded-xl
                              px-4
                              py-2
                              text-xs
                              font-bold
                              transition
                              ${
                                isFull
                                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                  : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md"
                              }
                            `}
                          >
                            {isFull ? "Full" : "Join"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
                    <AudioLines className="h-8 w-8 text-amber-500" />
                  </div>

                  <h3 className="font-bold text-slate-800">
                    No Live Voice Rooms
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Be the first to start a conversation.
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate("/voice")}
                    className="
                      mt-4
                      rounded-xl
                      bg-indigo-600
                      px-5
                      py-2.5
                      text-sm
                      font-bold
                      text-white
                      transition
                      hover:bg-indigo-700
                    "
                  >
                    Start a Room
                  </button>
                </div>
              )}
            </div>

            {/* ==================================================
                CONTINUE LEARNING
            =================================================== */}

            <div>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Continue Learning
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Pick up where you left off.
                  </p>
                </div>

                <Link
                  to="/progress"
                  className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                >
                  View all
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-800">
                          Subjunctive Mood: Basics
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Lesson 4 of 8
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
                        50%
                      </span>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full w-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/exercises")}
                  className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-indigo-50
                    px-4
                    py-2.5
                    text-sm
                    font-bold
                    text-indigo-600
                    transition
                    hover:bg-indigo-100
                  "
                >
                  <PlayCircle className="h-4 w-4" />
                  Resume Lesson
                </button>
              </div>
            </div>
          </section>

          {/* ====================================================
              SPEAKING GOAL
          ===================================================== */}

          <section className="relative overflow-hidden rounded-2xl border border-amber-100/60 bg-gradient-to-r from-amber-50 to-indigo-50 p-6 shadow-sm">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-indigo-200/20 blur-2xl" />

            <div className="relative">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-indigo-500 shadow-lg shadow-indigo-200/50">
                    <Target className="h-6 w-6 text-white" />
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800">
                      Weekly Speaking Goal
                    </h3>

                    <div className="mt-1 flex items-center gap-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <AudioLines className="h-3.5 w-3.5" />
                        45/60 min
                      </span>

                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        75% complete
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/voice")}
                  className="
                    rounded-xl
                    bg-indigo-600
                    px-5
                    py-2.5
                    text-sm
                    font-bold
                    text-white
                    shadow-md
                    shadow-indigo-200/50
                    transition
                    hover:bg-indigo-700
                  "
                >
                  Practice Now
                </button>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/70">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-amber-400 to-indigo-600" />
              </div>

              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                <Zap className="h-3 w-3 text-amber-500" />
                Practice 15 more minutes to hit your goal.
              </p>
            </div>
          </section>

          {/* ====================================================
              LEARNING HUB
          ===================================================== */}

          <section>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                Learning Hub
              </h2>

              <p className="mt-0.5 text-sm text-slate-500">
                Choose an activity to start practicing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {learningHubItems.map(
                ({ to, title, desc, icon: Icon, color }) => {
                  const isVoiceCard = to === "/voice";
                  const hasLive = isVoiceCard && hasLiveRooms;

                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`
                        group
                        relative
                        overflow-hidden
                        rounded-2xl
                        border
                        bg-white
                        p-5
                        shadow-sm
                        transition-all
                        duration-200
                        hover:-translate-y-0.5
                        hover:shadow-lg
                        ${
                          hasLive
                            ? "border-amber-200 shadow-amber-100/50"
                            : "border-slate-100"
                        }
                      `}
                    >
                      {hasLive && (
                        <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-lg rounded-tr-lg bg-red-500 px-2 py-0.5 text-[8px] font-extrabold text-white">
                          <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                          LIVE
                        </div>
                      )}

                      <div
                        className={`
                          mb-4
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-xl
                          transition-all
                          duration-200
                          group-hover:scale-105
                          ${color}
                        `}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <h3 className="mb-1 flex items-center justify-between font-bold text-slate-800 transition-colors group-hover:text-indigo-600">
                        <span>{title}</span>

                        <ArrowRight className="h-4 w-4 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </h3>

                      <p className="text-xs leading-relaxed text-slate-500">
                        {desc}
                      </p>

                      {hasLive && (
                        <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          {liveVoiceRooms.length} active rooms
                        </span>
                      )}
                    </Link>
                  );
                }
              )}
            </div>
          </section>

          {/* ====================================================
              RECENT VOICE ACTIVITY
          ===================================================== */}

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Headphones className="h-5 w-5 text-indigo-600" />
                  Recent Voice Activity
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Your recent voice room sessions.
                </p>
              </div>

              <Link
                to="/voice"
                className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
              >
                History
              </Link>
            </div>

            {voiceLoading ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="flex animate-pulse items-center gap-4"
                    >
                      <div className="h-10 w-10 rounded-full bg-slate-200" />

                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-slate-200" />
                        <div className="h-3 w-1/2 rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : hasLiveRooms ? (
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="divide-y divide-slate-100">
                  {liveVoiceRooms.slice(0, 3).map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => navigate(`/voice/${room.id}`)}
                      className="
                        group
                        flex
                        w-full
                        items-center
                        gap-4
                        p-4
                        text-left
                        transition
                        hover:bg-slate-50
                      "
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-indigo-100">
                        <AudioLines className="h-5 w-5 text-indigo-600" />

                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {room.name}
                        </p>

                        <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {room.participants?.length || 0} participants
                          </span>

                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />

                            {room.createdAt
                              ? formatDistanceToNow(
                                  new Date(room.createdAt),
                                  {
                                    addSuffix: true,
                                  }
                                )
                              : "Just now"}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />

                        <span className="text-xs font-semibold text-green-600">
                          Live
                        </span>

                        <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Headphones className="h-6 w-6 text-slate-400" />
                </div>

                <p className="text-sm text-slate-500">
                  No recent voice activity.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/voice")}
                  className="mt-3 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                >
                  Start your first voice session →
                </button>
              </div>
            )}
          </section>

          {/* ====================================================
              FOOTER
          ===================================================== */}

          <footer className="border-t border-slate-200/70 py-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                © {new Date().getFullYear()} LingoVerse · Learn without
                limits.
              </p>

              <div className="flex items-center gap-5 text-xs text-slate-400">
                <Link
                  to="/settings"
                  className="transition-colors hover:text-indigo-600"
                >
                  Settings
                </Link>

                <Link
                  to="/communities"
                  className="transition-colors hover:text-indigo-600"
                >
                  Community
                </Link>

                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Secure
                </span>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;