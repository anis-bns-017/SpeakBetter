import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  BookOpen,
  Layers,
  FileText,
  Dumbbell,
  MessageCircle,
  AudioLines,
  Hash,
  TrendingUp,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  Award,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { SpeakBetterLogo } from "../components/common/SpeakBetterLogo";

const navigation = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Discover",
    to: "/discover",
    icon: Compass,
  },
  {
    label: "Vocabulary",
    to: "/vocabulary",
    icon: BookOpen,
  },
  {
    label: "Flashcards",
    to: "/flashcards",
    icon: Layers,
  },
  {
    label: "Grammar",
    to: "/grammar",
    icon: FileText,
  },
  {
    label: "Exercises",
    to: "/exercises",
    icon: Dumbbell,
  },
  {
    label: "AI Chat",
    to: "/chat",
    icon: MessageCircle,
  },
  {
    label: "Voice Rooms",
    to: "/voice",
    icon: AudioLines,
  },
  {
    label: "Communities",
    to: "/communities",
    icon: Hash,
  },
  {
    label: "Progress",
    to: "/progress",
    icon: TrendingUp,
  },
];

const bottomNavigation = [
  {
    label: "Profile",
    to: "/profile",
    icon: User,
  },
  {
    label: "Settings",
    to: "/settings",
    icon: Settings,
  },
];

export const Sidebar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("speakbetter-sidebar-collapsed") === "true";
  });

  const toggleSidebar = () => {
    setCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem("speakbetter-sidebar-collapsed", String(next));
      return next;
    });
  };

  const handleLogout = () => {
    // If your AuthContext has a logout function, use it here.
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  return (
    <aside
      className={`
        hidden lg:flex
        fixed
        left-0
        top-0
        bottom-0
        z-50
        flex-col
        bg-[#F8F9FC]
        border-r border-slate-200/80
        shadow-[1px_0_0_0_rgba(0,0,0,0.03)]
        transition-[width]
        duration-300
        ease-[cubic-bezier(0.4,0,0.2,1)]
        ${collapsed ? "w-[76px]" : "w-[268px]"}
      `}
    >
      {/* =========================================================
          LOGO
      ========================================================= */}
      <div
        className={`
          h-[68px]
          shrink-0
          flex
          items-center
          border-b
          border-slate-200/70
          ${collapsed ? "justify-center px-3" : "px-5"}
        `}
      >
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3.5 min-w-0 group"
          title="LingoVerse"
        >
          {/* Logo mark */}
          <div
            className="
              relative
              w-10
              h-10
              shrink-0
              rounded-2xl
              bg-gradient-to-br
              from-indigo-500
              to-violet-600
              flex
              items-center
              justify-center
              shadow-md
              shadow-indigo-500/25
              ring-1
              ring-white/20
              transition-transform
              duration-300
              group-hover:scale-[1.05]
              group-hover:shadow-indigo-500/40
            "
          >
            <BookOpen className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>

          {/* Brand text */}
          {!collapsed && (
            <SpeakBetterLogo /> 
          )}
        </button>
      </div>

      {/* =========================================================
          USER MINI PROFILE
      ========================================================= */}
      <div
        className={`
          shrink-0
          border-b
          border-slate-200/70
          ${collapsed ? "p-3" : "px-4 py-4"}
        `}
      >
        <button
          type="button"
          onClick={() => navigate("/profile")}
          title={collapsed ? "Open profile" : undefined}
          className={`
            w-full
            flex
            items-center
            rounded-2xl
            transition-all
            duration-200
            hover:bg-white
            hover:shadow-sm
            ${collapsed ? "justify-center py-1.5" : "gap-3 px-2.5 py-2.5"}
          `}
        >
          {/* Avatar */}
          <div
            className="
              relative
              w-10
              h-10
              shrink-0
              rounded-2xl
              bg-gradient-to-br
              from-indigo-100
              to-violet-100
              border
              border-indigo-200/70
              flex
              items-center
              justify-center
              text-indigo-700
              font-bold
              text-sm
              shadow-sm
            "
          >
            {user?.name?.charAt(0)?.toUpperCase() || "U"}

            {/* Online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#F8F9FC]" />
          </div>

          {!collapsed && (
            <div className="min-w-0 text-left flex-1">
              <p className="text-[13.5px] font-semibold text-slate-800 truncate leading-tight">
                {user?.name || "Learner"}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Spanish · B1 Intermediate
              </p>
            </div>
          )}
        </button>
      </div>

      {/* =========================================================
          MAIN NAVIGATION
      ========================================================= */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-5">
        {!collapsed && (
          <p className="px-3 mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Learning
          </p>
        )}

        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`
                  group
                  relative
                  flex
                  items-center
                  rounded-xl
                  transition-all
                  duration-200
                  ${collapsed ? "justify-center w-full h-11" : "gap-3 px-3 h-11"}
                  ${
                    active
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80"
                      : "text-slate-500 hover:bg-white/80 hover:text-slate-800"
                  }
                `}
              >
                {/* Active indicator */}
                {active && (
                  <span
                    className="
                      absolute
                      left-0
                      top-1/2
                      -translate-y-1/2
                      w-[3px]
                      h-6
                      rounded-r-full
                      bg-indigo-600
                      shadow-[0_0_8px_rgba(79,70,229,0.45)]
                    "
                  />
                )}

                <Icon
                  className={`
                    w-[19px]
                    h-[19px]
                    shrink-0
                    transition-all
                    duration-200
                    group-hover:scale-105
                    ${
                      active
                        ? "text-indigo-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    }
                  `}
                  strokeWidth={active ? 2.15 : 1.9}
                />

                {!collapsed && (
                  <span
                    className={`
                      text-[13.5px]
                      font-medium
                      truncate
                      ${active ? "text-indigo-700 font-semibold" : ""}
                    `}
                  >
                    {item.label}
                  </span>
                )}

                {/* Tooltip (collapsed only) */}
                {collapsed && (
                  <span
                    className="
                      pointer-events-none
                      absolute
                      left-[64px]
                      z-[100]
                      whitespace-nowrap
                      rounded-lg
                      bg-slate-900
                      px-2.5
                      py-1.5
                      text-xs
                      font-medium
                      text-white
                      opacity-0
                      translate-x-1
                      group-hover:opacity-100
                      group-hover:translate-x-0
                      transition-all
                      duration-150
                      shadow-xl
                      shadow-slate-900/20
                    "
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-5 mx-1 border-t border-slate-200/70" />

        {!collapsed && (
          <p className="px-3 mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Account
          </p>
        )}

        <div className="space-y-1">
          {bottomNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`
                  group
                  relative
                  flex
                  items-center
                  rounded-xl
                  transition-all
                  duration-200
                  ${collapsed ? "justify-center w-full h-11" : "gap-3 px-3 h-11"}
                  ${
                    active
                      ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80"
                      : "text-slate-500 hover:bg-white/80 hover:text-slate-800"
                  }
                `}
              >
                {active && (
                  <span
                    className="
                      absolute
                      left-0
                      top-1/2
                      -translate-y-1/2
                      w-[3px]
                      h-6
                      rounded-r-full
                      bg-indigo-600
                      shadow-[0_0_8px_rgba(79,70,229,0.45)]
                    "
                  />
                )}

                <Icon
                  className={`
                    w-[19px]
                    h-[19px]
                    shrink-0
                    transition-all
                    duration-200
                    group-hover:scale-105
                    ${
                      active
                        ? "text-indigo-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    }
                  `}
                  strokeWidth={active ? 2.15 : 1.9}
                />

                {!collapsed && (
                  <span
                    className={`
                      text-[13.5px]
                      font-medium
                      ${active ? "text-indigo-700 font-semibold" : ""}
                    `}
                  >
                    {item.label}
                  </span>
                )}

                {collapsed && (
                  <span
                    className="
                      pointer-events-none
                      absolute
                      left-[64px]
                      z-[100]
                      whitespace-nowrap
                      rounded-lg
                      bg-slate-900
                      px-2.5
                      py-1.5
                      text-xs
                      font-medium
                      text-white
                      opacity-0
                      translate-x-1
                      group-hover:opacity-100
                      group-hover:translate-x-0
                      transition-all
                      duration-150
                      shadow-xl
                      shadow-slate-900/20
                    "
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* =========================================================
          LEARNING STATS
      ========================================================= */}
      {!collapsed && (
        <div className="px-4 pb-3">
          <div
            className="
            relative
            overflow-hidden
            rounded-2xl
            bg-white
            border
            border-slate-200/80
            p-3.5
            shadow-sm
          "
          >
            {/* Subtle decorative element */}
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-indigo-50 blur-2xl pointer-events-none" />

            <div className="relative flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                </div>
                <span className="text-[12px] font-semibold text-slate-600">
                  Daily Streak
                </span>
              </div>
              <span className="text-[13px] font-bold text-slate-800 tabular-nums">
                12 days
              </span>
            </div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Award className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <span className="text-[12px] font-semibold text-slate-600">
                  Total XP
                </span>
              </div>
              <span className="text-[13px] font-bold text-slate-800 tabular-nums">
                2,450
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          COLLAPSE BUTTON
      ========================================================= */}
      <div className="shrink-0 p-3 border-t border-slate-200/70">
        <button
          type="button"
          onClick={toggleSidebar}
          className={`
            group
            relative
            w-full
            h-10
            rounded-xl
            flex
            items-center
            transition-all
            duration-200
            text-slate-500
            hover:bg-white
            hover:text-indigo-600
            hover:shadow-sm
            ${collapsed ? "justify-center" : "gap-3 px-3"}
          `}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span className="text-[12.5px] font-semibold">
                Collapse sidebar
              </span>
            </>
          )}

          {collapsed && (
            <span
              className="
                pointer-events-none
                absolute
                left-[64px]
                whitespace-nowrap
                rounded-lg
                bg-slate-900
                px-2.5
                py-1.5
                text-xs
                font-medium
                text-white
                opacity-0
                translate-x-1
                group-hover:opacity-100
                group-hover:translate-x-0
                transition-all
                duration-150
                shadow-xl
              "
            >
              Expand sidebar
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

/*
 * Kept exported so older imports do not break.
 * Web version intentionally has no mobile sidebar.
 */

export const MobileSidebar = () => null;

export default Sidebar;
