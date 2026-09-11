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
  LogOut,
  Flame,
  Award,
  PanelLeft,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

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
    // This navigation keeps the sidebar/routing structure intact.
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
        bg-white
        border-r border-slate-200
        shadow-sm
        transition-[width]
        duration-300
        ease-in-out
        ${collapsed ? "w-[76px]" : "w-[260px]"}
      `}
    >
      {/* =========================================================
          LOGO
      ========================================================= */}

      <div
        className={`
          h-16
          shrink-0
          flex
          items-center
          border-b
          border-slate-100
          ${collapsed ? "justify-center px-3" : "px-5"}
        `}
      >
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3 min-w-0"
          title="LingoVerse"
        >
          {/* Logo */}
          <div
            className="
              w-9
              h-9
              shrink-0
              rounded-xl
              bg-gradient-to-br
              from-indigo-500
              to-violet-600
              flex
              items-center
              justify-center
              shadow-md
              shadow-indigo-200
            "
          >
            <BookOpen className="w-5 h-5 text-white" />
          </div>

          {/* Brand */}
          {!collapsed && (
            <div className="min-w-0 text-left">
              <p className="text-base font-extrabold tracking-tight text-slate-800 leading-none">
                Lingo<span className="text-indigo-600">Verse</span>
              </p>

              <p className="text-[9px] uppercase tracking-[0.18em] text-slate-400 font-semibold mt-1">
                Language Learning
              </p>
            </div>
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
          border-slate-100
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
            rounded-xl
            transition-colors
            hover:bg-slate-50
            ${collapsed ? "justify-center" : "gap-3 px-2 py-2"}
          `}
        >
          <div
            className="
              w-9
              h-9
              shrink-0
              rounded-xl
              bg-gradient-to-br
              from-indigo-100
              to-violet-100
              border
              border-indigo-200
              flex
              items-center
              justify-center
              text-indigo-700
              font-bold
              text-sm
            "
          >
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          {!collapsed && (
            <div className="min-w-0 text-left flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user?.name || "Learner"}
              </p>

              <p className="text-[11px] text-slate-400 truncate">
                Spanish · B1
              </p>
            </div>
          )}
        </button>
      </div>

      {/* =========================================================
          MAIN NAVIGATION
      ========================================================= */}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                  ${
                    collapsed ? "justify-center w-full h-11" : "gap-3 px-3 h-11"
                  }
                  ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
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
                      w-1
                      h-6
                      rounded-r-full
                      bg-indigo-600
                    "
                  />
                )}

                <Icon
                  className={`
                    w-[19px]
                    h-[19px]
                    shrink-0
                    transition-transform
                    duration-200
                    group-hover:scale-105
                    ${
                      active
                        ? "text-indigo-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    }
                  `}
                />

                {!collapsed && (
                  <span
                    className={`
                      text-sm
                      font-medium
                      truncate
                      ${active ? "text-indigo-700 font-semibold" : ""}
                    `}
                  >
                    {item.label}
                  </span>
                )}

                {/* Tooltip */}
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
                      shadow-lg
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
        <div className="my-4 border-t border-slate-100" />

        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                  ${
                    collapsed ? "justify-center w-full h-11" : "gap-3 px-3 h-11"
                  }
                  ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
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
                      w-1
                      h-6
                      rounded-r-full
                      bg-indigo-600
                    "
                  />
                )}

                <Icon
                  className={`
                    w-[19px]
                    h-[19px]
                    shrink-0
                    ${
                      active
                        ? "text-indigo-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    }
                  `}
                />

                {!collapsed && (
                  <span
                    className={`
                      text-sm
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
                      shadow-lg
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
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-xs font-semibold text-slate-700">
                  Daily Streak
                </span>
              </div>

              <span className="text-xs font-bold text-amber-600">12 days</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-semibold text-slate-700">XP</span>
              </div>

              <span className="text-xs font-bold text-violet-600">2,450</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          COLLAPSE BUTTON
      ========================================================= */}

      <div className="shrink-0 p-3 border-t border-slate-100">
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
            hover:bg-slate-50
            hover:text-indigo-600
            ${collapsed ? "justify-center" : "gap-3 px-3"}
          `}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />

              <span className="text-xs font-semibold">Collapse sidebar</span>
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
                shadow-lg
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
