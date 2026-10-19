// apps/web/src/components/layout/Sidebar.tsx
/**
 * Sidebar — left navigation for the SpeakBetter app.
 *
 * Improvements vs the original:
 *   - Extracted `SidebarItem` component — kills ~120 lines of duplication
 *     between main nav and bottom nav. Logout reuses the same component
 *     with `as="button"` and `tone="danger"`.
 *   - Extracted `CollapsedTooltip` — was copy-pasted 4×. Now shared, with
 *     optional keyboard shortcut hint inside the tooltip.
 *   - Full dark mode — every color has a `dark:` variant. The sidebar now
 *     looks right in the dark voice room.
 *   - SSR-safe localStorage — guarded with `typeof window` and try/catch
 *     so it doesn't throw on Next.js SSR or in privacy mode.
 *   - NavItem type supports `badge` (unread count), `isNew` (pulsing dot),
 *     `shortcut` (⌘1 hint), and `tone` (default/danger).
 *   - Active indicator uses `layoutId` so it slides smoothly between
 *     items when you navigate, instead of popping in/out.
 *   - Stats card now shows a level progress bar + "N XP to Level X+1".
 *   - User language/level is read from profile, not hardcoded.
 *   - `useReducedMotion` gates the progress bar animation.
 *   - `focus-visible` rings on every interactive element for keyboard nav.
 *   - Fixed the "LingoVerse" title bug → "SpeakBetter — Dashboard".
 *   - Fixed the double-mark bug — only one brand mark renders at a time.
 */

import React, { useState, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
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
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { SpeakBetterLogo } from "../components/common/SpeakBetterLogo";

// ============================================================
// Types
// ============================================================

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Numeric badge (e.g., unread count). Hidden when 0 or undefined. */
  badge?: number;
  /** Show a "NEW" dot — use for recently shipped features. */
  isNew?: boolean;
  /** Keyboard shortcut hint shown after the label / inside the tooltip. */
  shortcut?: string;
  /** Tone — "default" for nav, "danger" for logout. */
  tone?: "default" | "danger";
}

interface SidebarProps {
  items?: NavItem[];
  bottomItems?: NavItem[];
  showStats?: boolean;
  className?: string;
}

// ============================================================
// Config
// ============================================================

const STORAGE_KEY = "speakbetter-sidebar-collapsed";

const DEFAULT_NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, shortcut: "⌘1" },
  { label: "Discover", to: "/discover", icon: Compass },
  { label: "Vocabulary", to: "/vocabulary", icon: BookOpen },
  { label: "Flashcards", to: "/flashcards", icon: Layers },
  { label: "Grammar", to: "/grammar", icon: FileText },
  { label: "Exercises", to: "/exercises", icon: Dumbbell },
  { label: "Chat", to: "/chat", icon: MessageCircle, shortcut: "⌘7" },
  { label: "Voice Rooms", to: "/voice", icon: AudioLines, shortcut: "⌘8" },
  { label: "Communities", to: "/communities", icon: Hash },
  { label: "Progress", to: "/progress", icon: TrendingUp },
];

const DEFAULT_BOTTOM_NAV: NavItem[] = [
  { label: "Profile", to: "/profile", icon: User },
  { label: "Settings", to: "/settings", icon: Settings },
];

/**
 * SSR-safe localStorage read. Returns false on the server, in private
 * mode, or when storage is full — never throws.
 */
const readCollapsed = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const writeCollapsed = (value: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore quota / privacy mode errors */
  }
};

// ============================================================
// CollapsedTooltip — shared tooltip for collapsed sidebar items.
// Positioned at left-[64px] so it sits just past the 76px collapsed
// sidebar width. Shows an optional keyboard shortcut hint.
// ============================================================

const CollapsedTooltip: React.FC<{
  label: string;
  shortcut?: string;
}> = ({ label, shortcut }) => (
  <span
    role="tooltip"
    className="
      pointer-events-none absolute left-[64px] top-1/2 z-[100] -translate-y-1/2
      flex items-center gap-1.5 whitespace-nowrap rounded-lg
      bg-slate-900 dark:bg-slate-700
      px-2.5 py-1.5 text-xs font-medium text-white
      opacity-0 translate-x-1
      group-hover:opacity-100 group-hover:translate-x-0
      group-focus-visible:opacity-100 group-focus-visible:translate-x-0
      transition-all duration-150
      shadow-xl shadow-slate-900/30 dark:shadow-black/40
    "
  >
    {label}
    {shortcut && (
      <kbd className="rounded border border-white/20 bg-white/10 px-1 text-[10px] font-mono">
        {shortcut}
      </kbd>
    )}
  </span>
);

// ============================================================
// SidebarItem — reusable item for nav, bottom nav, and logout.
// Renders as a NavLink (default) or a button (for logout).
// ============================================================

interface SidebarItemProps {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onClick?: () => void;
  as?: "link" | "button";
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  item,
  collapsed,
  active,
  onClick,
  as = "link",
}) => {
  const Icon = item.icon;
  const isDanger = item.tone === "danger";
  const showBadge = typeof item.badge === "number" && item.badge > 0;

  const baseClass = `
    group relative flex items-center rounded-xl transition-all duration-200
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
    focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#0b0b14]
    ${collapsed ? "justify-center w-full h-11" : "gap-3 px-3 h-11"}
    ${
      isDanger
        ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        : active
          ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80 dark:bg-white/5 dark:text-indigo-300 dark:border-white/10 dark:shadow-none"
          : "text-slate-500 hover:bg-white/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
    }
  `;

  const inner = (
    <>
      {/* Active indicator — layoutId makes it slide between items */}
      {active && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="
            absolute left-0 top-1/2 -translate-y-1/2
            w-[3px] h-6 rounded-r-full
            bg-indigo-600 dark:bg-indigo-400
            shadow-[0_0_8px_rgba(79,70,229,0.45)]
          "
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <Icon
        className={`
          w-[19px] h-[19px] shrink-0 transition-all duration-200
          group-hover:scale-105
          ${isDanger ? "group-hover:translate-x-0.5" : ""}
          ${
            active
              ? "text-indigo-600 dark:text-indigo-300"
              : isDanger
                ? ""
                : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-200"
          }
        `}
        strokeWidth={active ? 2.15 : 1.9}
      />

      {!collapsed && (
        <>
          <span
            className={`
              text-[13.5px] font-medium truncate
              ${
                active
                  ? "text-indigo-700 dark:text-indigo-300 font-semibold"
                  : isDanger
                    ? "font-semibold"
                    : ""
              }
            `}
          >
            {item.label}
          </span>

          {/* Badge (unread count, etc.) */}
          {showBadge && (
            <span
              className="
                ml-auto inline-flex items-center justify-center
                min-w-[20px] h-5 px-1.5 rounded-full
                bg-rose-500 text-white text-[10px] font-bold tabular-nums
              "
            >
              {item.badge! > 99 ? "99+" : item.badge}
            </span>
          )}

          {/* New badge — pulsing dot for recently shipped features */}
          {item.isNew && !showBadge && (
            <span className="ml-auto flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              New
            </span>
          )}

          {/* Keyboard shortcut hint */}
          {item.shortcut && !showBadge && !item.isNew && (
            <kbd
              className="
                ml-auto hidden md:inline-flex items-center rounded
                border border-slate-200 dark:border-white/10
                bg-slate-50 dark:bg-white/5
                px-1.5 py-0.5 text-[10px] font-mono
                text-slate-400 dark:text-slate-500
              "
            >
              {item.shortcut}
            </kbd>
          )}
        </>
      )}

      {/* Collapsed tooltip — shows label + shortcut on hover/focus */}
      {collapsed && (
        <CollapsedTooltip label={item.label} shortcut={item.shortcut} />
      )}

      {/* Collapsed badge — small dot at the corner */}
      {collapsed && showBadge && (
        <span
          className="
            absolute -top-0.5 -right-0.5
            inline-flex items-center justify-center
            min-w-[16px] h-4 px-1 rounded-full
            bg-rose-500 text-white text-[9px] font-bold
            ring-2 ring-[#F8F9FC] dark:ring-[#0b0b14]
          "
        >
          {item.badge! > 9 ? "9+" : item.badge}
        </span>
      )}
    </>
  );

  if (as === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={collapsed ? item.label : undefined}
        className={baseClass}
      >
        {inner}
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={baseClass}
    >
      {inner}
    </NavLink>
  );
};

// ============================================================
// Sidebar
// ============================================================

export const Sidebar: React.FC<SidebarProps> = ({
  items = DEFAULT_NAV,
  bottomItems = DEFAULT_BOTTOM_NAV,
  showStats = true,
  className,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();

  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  }, [logout, navigate]);

  const isActive = useCallback(
    (path: string) => {
      if (path === "/dashboard") return location.pathname === "/dashboard";
      return (
        location.pathname === path || location.pathname.startsWith(`${path}/`)
      );
    },
    [location.pathname],
  );

  // Dynamic user data — falls back gracefully if profile isn't loaded yet
  const profile = (user as any)?.profile;
  const userLanguage =
    profile?.learningLanguage ?? (user as any)?.learningLanguage ?? "—";
  const userLevel = profile?.level ?? (user as any)?.level ?? "—";
  const streak = profile?.streak ?? 0;
  const xp = profile?.xp ?? 0;

  // Level progress (100 XP per level — simple curve, replace with your own)
  const XP_PER_LEVEL = 100;
  const currentLevelXp = xp % XP_PER_LEVEL;
  const progressPct = Math.min(100, (currentLevelXp / XP_PER_LEVEL) * 100);
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpToNext = XP_PER_LEVEL - currentLevelXp;

  return (
    <aside
      className={`
        hidden lg:flex fixed left-0 top-0 bottom-0 z-50 flex-col
        bg-[#F8F9FC] dark:bg-[#0b0b14]
        border-r border-slate-200/80 dark:border-slate-800/80
        shadow-[1px_0_0_0_rgba(0,0,0,0.03)] dark:shadow-[1px_0_0_0_rgba(0,0,0,0.3)]
        transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${collapsed ? "w-[76px]" : "w-[268px]"}
        ${className ?? ""}
      `}
    >
      {/* =========================================================
          LOGO
      ========================================================= */}
      <div
        className={`
          h-[68px] shrink-0 flex items-center
          border-b border-slate-200/70 dark:border-slate-800/70
          ${collapsed ? "justify-center px-3" : "px-5"}
        `}
      >
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3.5 min-w-0 group rounded-xl p-1
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          title="SpeakBetter — Dashboard"
        >
          {collapsed ? (
            // Compact mark — gradient square with "S", matching SpeakBetterLogo
            <div
              className="
                relative w-10 h-10 shrink-0 rounded-2xl
                bg-gradient-to-br from-indigo-500 via-violet-600 to-blue-600
                flex items-center justify-center
                shadow-md shadow-indigo-500/25
                ring-1 ring-white/20 dark:ring-white/10
                transition-transform duration-300
                group-hover:scale-[1.05] group-hover:shadow-indigo-500/40
              "
            >
              <span className="text-[19px] font-black italic tracking-tighter text-white">
                S
              </span>
            </div>
          ) : (
            // Expanded — SpeakBetterLogo renders its own mark + wordmark.
            // No manual mark here (the original had a double-mark bug).
            <SpeakBetterLogo
              size="sm"
              variant="compact"
              glow={false}
              pulse={false}
            />
          )}
        </button>
      </div>

      {/* =========================================================
          USER MINI PROFILE
      ========================================================= */}
      <div
        className={`
          shrink-0 border-b border-slate-200/70 dark:border-slate-800/70
          ${collapsed ? "p-3" : "px-4 py-4"}
        `}
      >
        <button
          type="button"
          onClick={() => navigate("/profile")}
          title={collapsed ? "Open profile" : undefined}
          className={`
            w-full flex items-center rounded-2xl transition-all duration-200
            hover:bg-white dark:hover:bg-white/5 hover:shadow-sm
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
            ${collapsed ? "justify-center py-1.5" : "gap-3 px-2.5 py-2.5"}
          `}
        >
          <div
            className="
              relative w-10 h-10 shrink-0 rounded-2xl
              bg-gradient-to-br from-indigo-100 to-violet-100
              dark:from-indigo-500/20 dark:to-violet-500/20
              border border-indigo-200/70 dark:border-indigo-500/30
              flex items-center justify-center
              text-indigo-700 dark:text-indigo-300
              font-bold text-sm shadow-sm
            "
          >
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
            <span
              className="
                absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full
                bg-emerald-500
                border-2 border-[#F8F9FC] dark:border-[#0b0b14]
              "
            />
          </div>

          {!collapsed && (
            <div className="min-w-0 text-left flex-1">
              <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
                {user?.name || "Learner"}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {userLanguage} · {userLevel}
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
          <p className="px-3 mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
            Learning
          </p>
        )}

        <div className="space-y-1">
          {items.map((item) => (
            <SidebarItem
              key={item.to}
              item={item}
              collapsed={collapsed}
              active={isActive(item.to)}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-5 mx-1 border-t border-slate-200/70 dark:border-slate-800/70" />

        {!collapsed && (
          <p className="px-3 mb-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
            Account
          </p>
        )}

        <div className="space-y-1">
          {bottomItems.map((item) => (
            <SidebarItem
              key={item.to}
              item={item}
              collapsed={collapsed}
              active={isActive(item.to)}
            />
          ))}
        </div>
      </nav>

      {/* =========================================================
          LEARNING STATS (with progress bar)
      ========================================================= */}
      {showStats && !collapsed && (
        <div className="px-4 pb-3">
          <div
            className="
              relative overflow-hidden rounded-2xl
              bg-white dark:bg-white/5
              border border-slate-200/80 dark:border-white/10
              p-3.5 shadow-sm
            "
          >
            {/* Decorative glow */}
            <div
              className="
                absolute -top-8 -right-8 w-24 h-24 rounded-full
                bg-indigo-50 dark:bg-indigo-500/10 blur-2xl pointer-events-none
              "
            />

            {/* Streak */}
            <div className="relative flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400" />
                </div>
                <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                  Daily Streak
                </span>
              </div>
              <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {streak} days
              </span>
            </div>

            {/* Level + XP */}
            <div className="relative flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                  <Award className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                </div>
                <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                  Level {level}
                </span>
              </div>
              <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {xp.toLocaleString()} XP
              </span>
            </div>

            {/* Progress to next level */}
            <div className="relative">
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.8, ease: "easeOut" }
                  }
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                {xpToNext} XP to Level {level + 1}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          LOGOUT — reuses SidebarItem with as="button" and tone="danger"
      ========================================================= */}
      <div className="px-3 pb-2">
        <SidebarItem
          item={{ label: "Logout", to: "#", icon: LogOut, tone: "danger" }}
          collapsed={collapsed}
          active={false}
          onClick={handleLogout}
          as="button"
        />
      </div>

      {/* =========================================================
          COLLAPSE BUTTON
      ========================================================= */}
      <div className="shrink-0 p-3 border-t border-slate-200/70 dark:border-slate-800/70">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={!collapsed}
          className={`
            group relative w-full h-10 rounded-xl flex items-center
            transition-all duration-200
            text-slate-500 dark:text-slate-400
            hover:bg-white dark:hover:bg-white/5
            hover:text-indigo-600 dark:hover:text-indigo-300
            hover:shadow-sm
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
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
          {collapsed && <CollapsedTooltip label="Expand sidebar" />}
        </button>
      </div>
    </aside>
  );
};

/*
 * Kept exported so older imports do not break.
 * Web version intentionally has no mobile sidebar — use a bottom nav or
 * hamburger sheet at the layout level instead.
 */
export const MobileSidebar = () => null;

export default Sidebar;