// apps/web/src/components/Sidebar.tsx
/**
 * App navigation for SpeakBetter.
 *
 *  - Desktop (lg+): collapsible sidebar with grouped nav, live badges (unread chats,
 *    live voice rooms), a "Live now" list, streak/XP card and a user menu.
 *  - Mobile/tablet: bottom tab bar + "More" sheet with the full menu.
 *  - Everywhere: ⌘K / Ctrl+K command palette to jump to any page, action or live room.
 *    ⌘B / Ctrl+B collapses the desktop sidebar.
 *
 * Collapse state, palette and mobile sheet live in SidebarContext, so the layout
 * pads content by exactly the sidebar width.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  LogOut,
  Search,
  Users,
  Mic,
  Plus,
  Menu,
  X,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Radio,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { SIDEBAR_WIDTH, MOBILE_TAB_BAR_HEIGHT } from "../lib/navLayout";
import { SpeakBetterLogo } from "./common/SpeakBetterLogo";
import { useProgress } from "../hooks/useLearning";
import { useLiveRoomsCount, useTrendingRooms } from "../hooks/useDiscovery";
import { useChats } from "../hooks/useChat";
import { getXpLevel, getLevelProgress, getNextLevelXp } from "../lib/xpLevels";

// ============================================================
// Types & config
// ============================================================

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Extra words the command palette matches on */
  keywords?: string;
  /** Other paths that should highlight this item */
  matches?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Home",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
      { label: "Discover", to: "/discover", icon: Compass, keywords: "explore find rooms trending" },
    ],
  },
  {
    title: "Speak",
    items: [
      { label: "Voice Rooms", to: "/voice", icon: AudioLines, keywords: "talk speak live audio stage" },
      { label: "Chat", to: "/chat", icon: MessageCircle, keywords: "messages dm conversation" },
      { label: "Communities", to: "/communities", icon: Hash, keywords: "groups clubs channels" },
      { label: "Friends", to: "/friends", icon: Users, keywords: "partners people suggestions", matches: ["/suggestions", "/blocked"] },
    ],
  },
  {
    title: "Learn",
    items: [
      { label: "Vocabulary", to: "/vocabulary", icon: BookOpen, keywords: "words" },
      { label: "Flashcards", to: "/flashcards", icon: Layers, keywords: "review cards spaced repetition" },
      { label: "Grammar", to: "/grammar", icon: FileText, keywords: "rules tenses" },
      { label: "Exercises", to: "/exercises", icon: Dumbbell, keywords: "practice quiz" },
      { label: "Progress", to: "/progress", icon: TrendingUp, keywords: "stats streak xp level" },
    ],
  },
];

const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Profile", to: "/profile", icon: User, keywords: "me account" },
  { label: "Settings", to: "/settings", icon: Settings, keywords: "preferences notifications privacy" },
];

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";

// ============================================================
// Live data
// ============================================================

interface ChatLike {
  unreadCount?: number;
  messages?: Array<{ senderId?: string; createdAt?: string }>;
  participants?: Array<{ userId?: string; user?: { id?: string }; lastReadAt?: string | null }>;
}

/** Same rule as the chat list: newer message from someone else than my last read */
function isChatUnread(chat: ChatLike, userId?: string): boolean {
  if ((chat.unreadCount ?? 0) > 0) return true;
  const last = chat.messages?.[0];
  if (!last || !userId || last.senderId === userId) return false;
  const me = chat.participants?.find((p) => (p.userId ?? p.user?.id) === userId);
  if (!me?.lastReadAt || !last.createdAt) return Boolean(me && !me.lastReadAt);
  return new Date(last.createdAt) > new Date(me.lastReadAt);
}

function useSidebarData(userId?: string) {
  const { data: progress } = useProgress();
  const { data: liveCountData } = useLiveRoomsCount();
  const { data: trending } = useTrendingRooms(6);
  const { data: chats } = useChats();

  const xp = Number(progress?.totalXP ?? 0) || 0;
  const streak = Number(progress?.streak ?? 0) || 0;
  const liveCount = typeof liveCountData === "number" ? liveCountData : Number((liveCountData as { count?: number } | undefined)?.count ?? 0) || 0;

  const liveRooms = useMemo(
    () =>
      (Array.isArray(trending) ? trending : [])
        .filter((r) => r && r.isLive !== false && (r.participantCount ?? 0) > 0)
        .slice(0, 3),
    [trending],
  );

  const unreadChats = useMemo(
    () => (Array.isArray(chats) ? (chats as ChatLike[]).filter((c) => isChatUnread(c, userId)).length : 0),
    [chats, userId],
  );

  return {
    xp,
    streak,
    level: getXpLevel(xp),
    levelProgress: getLevelProgress(xp),
    xpToNext: Math.max(0, getNextLevelXp(xp) - xp),
    liveCount: Math.max(liveCount, liveRooms.length),
    liveRooms,
    unreadChats,
  };
}

type SidebarData = ReturnType<typeof useSidebarData>;

/** Live badge for a nav item, if any */
function badgeFor(item: NavItem, data: SidebarData): { count?: number; live?: boolean } {
  if (item.to === "/chat" && data.unreadChats > 0) return { count: data.unreadChats };
  if (item.to === "/voice" && data.liveCount > 0) return { count: data.liveCount, live: true };
  return {};
}

// ============================================================
// Small building blocks
// ============================================================

const Avatar: React.FC<{ name?: string; src?: string; size?: number; className?: string }> = ({ name, src, size = 36, className }) => {
  const [failed, setFailed] = useState(false);
  const initial = (name || "U").trim().charAt(0).toUpperCase() || "U";
  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-white bg-gradient-to-br from-indigo-500 to-violet-600 ${className ?? ""}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size / 2.6) }}
      aria-hidden
    >
      {src && !failed ? (
        <img src={src} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </div>
  );
};

/** Avatar wrapped in a ring that fills with progress to the next level */
const LevelRing: React.FC<{ progress: number; level: number; children: React.ReactNode; size?: number }> = ({ progress, level, children, size = 44 }) => {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress / 100)}
          className="stroke-indigo-500 transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-[5px] flex">{children}</div>
      <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#F8F9FC] dark:ring-[#0b0b14]">
        {level}
      </span>
    </div>
  );
};

const Badge: React.FC<{ count?: number; live?: boolean; compact?: boolean }> = ({ count, live, compact }) => {
  if (!count) return null;
  const text = count > (compact ? 9 : 99) ? (compact ? "9+" : "99+") : String(count);
  if (live) {
    return compact ? (
      <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#F8F9FC] dark:ring-[#0b0b14]">
        <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-60" />
      </span>
    ) : (
      <span className="ml-auto flex items-center gap-1 h-5 px-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold tabular-nums">
        <span className="relative w-1.5 h-1.5 rounded-full bg-rose-500">
          <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-70" />
        </span>
        {text} live
      </span>
    );
  }
  return compact ? (
    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#F8F9FC] dark:ring-[#0b0b14]">
      {text}
    </span>
  ) : (
    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
      {text}
    </span>
  );
};

const Tooltip: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => (
  <span
    role="tooltip"
    className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-[100] flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 transition-all duration-150 shadow-xl"
  >
    {label}
    {hint && <span className="text-white/60">{hint}</span>}
  </span>
);

const Kbd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <kbd className={`inline-flex items-center rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-medium font-sans text-slate-500 dark:text-slate-400 ${className ?? ""}`}>
    {children}
  </kbd>
);

// ============================================================
// Desktop nav item
// ============================================================

const SidebarLink: React.FC<{ item: NavItem; collapsed: boolean; active: boolean; badge: { count?: number; live?: boolean } }> = ({ item, collapsed, active, badge }) => {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      aria-label={collapsed ? item.label : undefined}
      className={`group relative flex items-center rounded-xl h-10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
        collapsed ? "justify-center w-full" : "gap-3 px-3"
      } ${
        active
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
      }`}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-indigo-600 dark:bg-indigo-400"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-200"}`} strokeWidth={active ? 2.2 : 1.9} />
      {!collapsed && <span className={`text-[13.5px] truncate ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>}
      {!collapsed && <Badge {...badge} />}
      {collapsed && <Badge {...badge} compact />}
      {collapsed && <Tooltip label={item.label} hint={badge.count ? (badge.live ? `${badge.count} live` : `${badge.count} unread`) : undefined} />}
    </NavLink>
  );
};

// ============================================================
// Command palette (⌘K)
// ============================================================

interface PaletteEntry {
  id: string;
  label: string;
  group: "Live now" | "Actions" | "Pages";
  icon: LucideIcon;
  hint?: string;
  keywords?: string;
  run: () => void;
}

const CommandPalette: React.FC<{
  open: boolean;
  onClose: () => void;
  entries: PaletteEntry[];
}> = ({ open, onClose, entries }) => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries
      .map((e) => {
        const label = e.label.toLowerCase();
        const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : (e.keywords ?? "").toLowerCase().includes(q) ? 2 : -1;
        return { e, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.e);
  }, [entries, query]);

  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const run = (entry?: PaletteEntry) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % Math.max(1, results.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + results.length) % Math.max(1, results.length)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[activeIndex]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12121c] shadow-2xl overflow-hidden"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100 dark:border-white/5">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="Search pages, actions and live rooms…"
                className="flex-1 bg-transparent outline-none text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                aria-label="Search"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
              />
              <Kbd>Esc</Kbd>
            </div>

            <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">No matches for “{query.trim()}”</p>
              ) : (
                results.map((entry, index) => {
                  const Icon = entry.icon;
                  const header = entry.group !== lastGroup ? entry.group : null;
                  lastGroup = entry.group;
                  const isActive = index === activeIndex;
                  return (
                    <React.Fragment key={entry.id}>
                      {header && (
                        <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{header}</p>
                      )}
                      <button
                        type="button"
                        id={`cmd-${entry.id}`}
                        role="option"
                        aria-selected={isActive}
                        data-index={index}
                        onMouseMove={() => setActive(index)}
                        onClick={() => run(entry)}
                        className={`w-full flex items-center gap-3 px-3 h-11 rounded-xl text-left transition-colors ${
                          isActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${entry.group === "Live now" ? "bg-rose-500/10 text-rose-500" : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="flex-1 min-w-0 truncate text-sm font-medium">{entry.label}</span>
                        {entry.hint && <span className="text-xs text-slate-400 shrink-0">{entry.hint}</span>}
                        {isActive && <CornerDownLeft className="w-4 h-4 text-slate-400 shrink-0" />}
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-4 px-4 h-10 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> navigate</span>
              <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> open</span>
              <span className="ml-auto flex items-center gap-1"><Kbd>{MOD_KEY}</Kbd><Kbd>B</Kbd> collapse sidebar</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================
// Shared pieces for desktop + mobile sheet
// ============================================================

const StreakCard: React.FC<{ data: SidebarData; onOpen: () => void }> = ({ data, onOpen }) => {
  const reduced = useReducedMotion();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3.5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
    >
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-amber-200/40 dark:bg-amber-500/10 blur-2xl pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${data.streak > 0 ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-orange-500/30" : "bg-slate-100 dark:bg-white/5"}`}>
          <Flame className={`w-5 h-5 ${data.streak > 0 ? "text-white fill-white/30" : "text-slate-400"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-tight tabular-nums">
            {data.streak > 0 ? `${data.streak}-day streak` : "Start a streak"}
          </p>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
            {data.streak > 0 ? "Practice today to keep it going" : "Speak or study today to begin"}
          </p>
        </div>
      </div>
      <div className="relative mt-3">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Level {data.level}</span>
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">{data.xp.toLocaleString()} XP</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${data.levelProgress}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-slate-500 tabular-nums">
          {data.xpToNext > 0 ? `${data.xpToNext.toLocaleString()} XP to Level ${data.level + 1}` : "Max level reached 🎉"}
        </p>
      </div>
    </button>
  );
};

const LiveNowList: React.FC<{ data: SidebarData; onJoin: (roomId: string) => void }> = ({ data, onJoin }) => {
  if (!data.liveRooms.length) return null;
  return (
    <div>
      <p className="px-3 mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-rose-500">
        <span className="relative w-1.5 h-1.5 rounded-full bg-rose-500">
          <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-70" />
        </span>
        Live now
      </p>
      <div className="space-y-1">
        {data.liveRooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => onJoin(room.id)}
            className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            title={`Join ${room.name}`}
          >
            <span className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-slate-800 dark:text-slate-200 truncate">{room.name}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {room.participantCount} listening{room.language ? ` · ${room.language}` : ""}
              </span>
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">Join</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// Sidebar (desktop) + mobile tab bar + palette
// ============================================================

export const Sidebar: React.FC<{ className?: string }> = ({ className }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isMinimized: collapsed,
    toggleSidebar,
    isPaletteOpen,
    closePalette,
    togglePalette,
    openPalette,
    isMobileMenuOpen,
    setMobileMenuOpen,
  } = useSidebar();
  const data = useSidebarData(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = useCallback(
    (item: NavItem) =>
      [item.to, ...(item.matches ?? [])].some(
        (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
      ),
    [location.pathname],
  );

  const handleLogout = useCallback(async () => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  }, [logout, navigate, setMobileMenuOpen]);

  const go = useCallback(
    (to: string) => {
      setMobileMenuOpen(false);
      navigate(to);
    },
    [navigate, setMobileMenuOpen],
  );

  // Close the mobile sheet / user menu on navigation
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
    setConfirmLogout(false);
  }

  // Global shortcuts: ⌘K palette, ⌘B collapse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        togglePalette();
      } else if (key === "b") {
        const t = e.target as HTMLElement | null;
        if (t?.isContentEditable || t?.tagName === "TEXTAREA" || t?.tagName === "INPUT") return;
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePalette, toggleSidebar]);

  // User menu: close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmLogout(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const paletteEntries = useMemo<PaletteEntry[]>(() => {
    const live: PaletteEntry[] = data.liveRooms.map((room) => ({
      id: `live-${room.id}`,
      label: `Join “${room.name}”`,
      group: "Live now",
      icon: Radio,
      hint: `${room.participantCount} listening`,
      keywords: `${room.language ?? ""} voice room live`,
      run: () => navigate(`/voice/${room.id}`),
    }));
    const actions: PaletteEntry[] = [
      { id: "start-room", label: "Start a voice room", group: "Actions", icon: Mic, keywords: "create host speak talk new room", run: () => navigate("/voice") },
      { id: "new-chat", label: "New conversation", group: "Actions", icon: Plus, keywords: "message dm chat", run: () => navigate("/chat/new") },
      { id: "find-partners", label: "Find speaking partners", group: "Actions", icon: Sparkles, keywords: "friends suggestions people", run: () => navigate("/suggestions") },
      { id: "toggle-sidebar", label: collapsed ? "Expand sidebar" : "Collapse sidebar", group: "Actions", icon: collapsed ? ChevronRight : ChevronLeft, hint: `${MOD_KEY} B`, run: toggleSidebar },
      { id: "logout", label: "Log out", group: "Actions", icon: LogOut, keywords: "sign out", run: () => void handleLogout() },
    ];
    const pages: PaletteEntry[] = [...NAV_SECTIONS.flatMap((s) => s.items), ...ACCOUNT_ITEMS].map((item) => ({
      id: `page-${item.to}`,
      label: item.label,
      group: "Pages",
      icon: item.icon,
      keywords: item.keywords,
      hint: badgeFor(item, data).count ? (item.to === "/voice" ? `${data.liveCount} live` : `${data.unreadChats} unread`) : undefined,
      run: () => navigate(item.to),
    }));
    return [...live, ...actions, ...pages];
  }, [data, navigate, collapsed, toggleSidebar, handleLogout]);

  const inVoiceRoom = /^\/voice\/[^/]+/.test(location.pathname);
  const userName = user?.name || "Learner";
  const userEmail = user?.email;

  // ---------------- Desktop ----------------
  const desktop = (
    <aside
      aria-label="Main navigation"
      className={`hidden lg:flex fixed left-0 top-0 bottom-0 z-50 flex-col bg-[#F8F9FC] dark:bg-[#0b0b14] border-r border-slate-200/80 dark:border-white/[0.06] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${className ?? ""}`}
      style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
    >
      {/* Logo + collapse */}
      <div className={`h-16 shrink-0 flex items-center ${collapsed ? "justify-center px-3" : "justify-between pl-4 pr-3"}`}>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center min-w-0 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          aria-label="SpeakBetter home"
        >
          {collapsed ? (
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/25 text-[19px] font-black italic tracking-tighter text-white">
              S
            </span>
          ) : (
            <SpeakBetterLogo />
          )}
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="group relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            aria-label="Collapse sidebar"
            title={`Collapse (${MOD_KEY}+B)`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search + primary action */}
      <div className={`shrink-0 space-y-2 ${collapsed ? "px-3" : "px-3"}`}>
        <button
          type="button"
          onClick={openPalette}
          className={`group relative w-full h-9 flex items-center rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${collapsed ? "justify-center" : "gap-2 px-3"}`}
          aria-label="Search and jump to"
        >
          <Search className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-[13px] flex-1 text-left">Search…</span>}
          {!collapsed && <span className="flex gap-0.5"><Kbd>{MOD_KEY}</Kbd><Kbd>K</Kbd></span>}
          {collapsed && <Tooltip label="Search" hint={`${MOD_KEY} K`} />}
        </button>

        <button
          type="button"
          onClick={() => navigate("/voice")}
          className={`group relative w-full h-10 flex items-center justify-center gap-2 rounded-xl text-white font-semibold text-[13.5px] bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300`}
          aria-label="Start speaking"
        >
          <Mic className="w-4 h-4" />
          {!collapsed && <span>Start speaking</span>}
          {collapsed && <Tooltip label="Start speaking" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-3 space-y-5" style={{ scrollbarWidth: "thin" }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {collapsed ? (
              <div className="mx-2 mb-2 border-t border-slate-200/70 dark:border-white/[0.06] first:hidden" />
            ) : (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">{section.title}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarLink key={item.to} item={item} collapsed={collapsed} active={isActive(item)} badge={badgeFor(item, data)} />
              ))}
            </div>
          </div>
        ))}

        {!collapsed && <LiveNowList data={data} onJoin={(id) => navigate(`/voice/${id}`)} />}
      </nav>

      {/* Streak / XP */}
      {!collapsed && (
        <div className="shrink-0 px-3 pb-3">
          <StreakCard data={data} onOpen={() => navigate("/progress")} />
        </div>
      )}

      {/* User */}
      <div ref={menuRef} className="relative shrink-0 border-t border-slate-200/70 dark:border-white/[0.06] p-3">
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.12 }}
              className={`absolute bottom-full mb-2 z-50 w-60 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151521] shadow-2xl p-1.5 ${collapsed ? "left-3" : "left-3 right-3 w-auto"}`}
              role="menu"
            >
              <div className="px-2.5 py-2 border-b border-slate-100 dark:border-white/5 mb-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{userName}</p>
                {userEmail && <p className="text-xs text-slate-500 truncate">{userEmail}</p>}
              </div>
              {ACCOUNT_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.to} type="button" role="menuitem" onClick={() => { setMenuOpen(false); navigate(item.to); }} className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                    <Icon className="w-4 h-4 text-slate-400" /> {item.label}
                  </button>
                );
              })}
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); openPalette(); }} className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                <Search className="w-4 h-4 text-slate-400" /> Command palette <span className="ml-auto flex gap-0.5"><Kbd>{MOD_KEY}</Kbd><Kbd>K</Kbd></span>
              </button>
              <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />
              <button
                type="button"
                role="menuitem"
                onClick={() => (confirmLogout ? void handleLogout() : setConfirmLogout(true))}
                className={`w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-colors ${confirmLogout ? "bg-rose-500 text-white" : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"}`}
              >
                <LogOut className="w-4 h-4" /> {confirmLogout ? "Click again to log out" : "Log out"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => { setMenuOpen((v) => !v); setConfirmLogout(false); }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`group relative w-full flex items-center rounded-xl p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${collapsed ? "justify-center" : "gap-3"}`}
        >
          <LevelRing progress={data.levelProgress} level={data.level} size={collapsed ? 40 : 42}>
            <Avatar name={userName} src={user?.avatarUrl} size={collapsed ? 30 : 32} className="w-full h-full" />
          </LevelRing>
          {!collapsed && (
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 truncate">{userName}</span>
              <span className="flex items-center gap-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                <Flame className={`w-3 h-3 ${data.streak > 0 ? "text-orange-500" : ""}`} /> {data.streak} · Level {data.level}
              </span>
            </span>
          )}
          {collapsed && <Tooltip label={userName} hint={`Level ${data.level}`} />}
        </button>

        {collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="group relative mt-2 w-full h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
            <Tooltip label="Expand" hint={`${MOD_KEY} B`} />
          </button>
        )}
      </div>
    </aside>
  );

  // ---------------- Mobile tab bar ----------------
  const learnPaths = NAV_SECTIONS.find((s) => s.title === "Learn")!.items;
  const tabs: Array<{ label: string; icon: LucideIcon; to?: string; active: boolean; badge?: { count?: number; live?: boolean }; onClick?: () => void }> = [
    { label: "Home", icon: LayoutDashboard, to: "/dashboard", active: isActive(NAV_SECTIONS[0].items[0]) },
    { label: "Speak", icon: AudioLines, to: "/voice", active: location.pathname.startsWith("/voice"), badge: badgeFor(NAV_SECTIONS[1].items[0], data) },
    { label: "Chat", icon: MessageCircle, to: "/chat", active: location.pathname.startsWith("/chat"), badge: badgeFor(NAV_SECTIONS[1].items[1], data) },
    { label: "Learn", icon: BookOpen, to: "/vocabulary", active: learnPaths.some(isActive) },
    { label: "More", icon: Menu, active: isMobileMenuOpen, onClick: () => setMobileMenuOpen(true) },
  ];

  const mobile = !inVoiceRoom && (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed left-0 right-0 bottom-0 z-50 border-t border-slate-200/80 dark:border-white/[0.06] bg-white/90 dark:bg-[#0b0b14]/90 backdrop-blur-xl"
      style={{ height: MOBILE_TAB_BAR_HEIGHT, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="h-full grid grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const content = (
            <>
              <span className="relative">
                <Icon className="w-[22px] h-[22px]" strokeWidth={tab.active ? 2.3 : 1.9} />
                {tab.badge && <Badge {...tab.badge} compact />}
              </span>
              <span className={`text-[10.5px] ${tab.active ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
              {tab.active && (
                <motion.span layoutId="mobile-tab-indicator" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-indigo-600 dark:bg-indigo-400" />
              )}
            </>
          );
          const cls = `relative flex flex-col items-center justify-center gap-1 transition-colors ${tab.active ? "text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`;
          return tab.to ? (
            <NavLink key={tab.label} to={tab.to} className={cls} aria-label={tab.label}>{content}</NavLink>
          ) : (
            <button key={tab.label} type="button" onClick={tab.onClick} className={cls} aria-label={tab.label} aria-expanded={isMobileMenuOpen}>{content}</button>
          );
        })}
      </div>
    </nav>
  );

  // ---------------- Mobile "More" sheet ----------------
  const sheet = (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <motion.div
          className="lg:hidden fixed inset-0 z-[150] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute left-0 right-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[#F8F9FC] dark:bg-[#0f0f19] border-t border-slate-200 dark:border-white/10 px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 w-10 h-1.5 rounded-full bg-slate-300 dark:bg-white/15" />

            <div className="flex items-center gap-3 mb-4">
              <LevelRing progress={data.levelProgress} level={data.level} size={48}>
                <Avatar name={userName} src={user?.avatarUrl} size={36} className="w-full h-full" />
              </LevelRing>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{userName}</p>
                <p className="text-xs text-slate-500 truncate">{userEmail}</p>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200/60 dark:hover:bg-white/5" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            <button type="button" onClick={() => { setMobileMenuOpen(false); openPalette(); }} className="w-full h-11 mb-4 flex items-center gap-2 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-500">
              <Search className="w-4 h-4" /> <span className="text-sm">Search pages and rooms…</span>
            </button>

            <div className="mb-4"><StreakCard data={data} onOpen={() => go("/progress")} /></div>

            {data.liveRooms.length > 0 && (
              <div className="mb-4 -mx-1">
                <LiveNowList data={data} onJoin={(id) => go(`/voice/${id}`)} />
              </div>
            )}

            {[...NAV_SECTIONS, { title: "Account", items: ACCOUNT_ITEMS }].map((section) => (
              <div key={section.title} className="mb-4">
                <p className="px-1 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{section.title}</p>
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    const badge = badgeFor(item, data);
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => go(item.to)}
                        className={`relative flex flex-col items-center justify-center gap-1.5 h-20 rounded-2xl border transition-colors ${
                          active
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-300"
                            : "bg-white border-slate-200/80 text-slate-700 dark:bg-white/[0.03] dark:border-white/10 dark:text-slate-300"
                        }`}
                      >
                        <span className="relative">
                          <Icon className="w-5 h-5" />
                          <Badge {...badge} compact />
                        </span>
                        <span className="text-xs font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => (confirmLogout ? void handleLogout() : setConfirmLogout(true))}
              className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm transition-colors ${confirmLogout ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"}`}
            >
              <LogOut className="w-4 h-4" /> {confirmLogout ? "Tap again to log out" : "Log out"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {desktop}
      {mobile}
      {sheet}
      {/* Re-keyed on open so every opening starts with an empty search */}
      <CommandPalette key={String(isPaletteOpen)} open={isPaletteOpen} onClose={closePalette} entries={paletteEntries} />
    </>
  );
};

/** Kept so older imports don't break — the mobile nav now lives inside <Sidebar /> */
export const MobileSidebar = () => null;

export default Sidebar;
