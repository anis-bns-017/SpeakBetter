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

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Compass,
  BookOpen,
  Layers,
  Dumbbell,
  MessageCircle,
  AudioLines,
  Phone,
  Hash,
  TrendingUp,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  Snowflake,
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
  Bot,
  Trophy,
  Megaphone,
  Library,
  PenLine,
  GraduationCap,
  Package,
  Headphones,
  Repeat2,
  Drama,
  History,
  Crown,
  BookA,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { SIDEBAR_WIDTH, MOBILE_TAB_BAR_HEIGHT } from "../lib/navLayout";
import { LogoMark, SpeakBetterLogo } from "./common/SpeakBetterLogo";
import { NotificationBell } from "./notifications/NotificationBell";
import { useProgress } from "../hooks/useLearning";
import { useLiveRoomsCount, useTrendingRooms } from "../hooks/useDiscovery";
import { useChats } from "../hooks/useChat";
import { getXpLevel, getLevelProgress, getNextLevelXp } from "../lib/xpLevels";
import { ThemeSwitch } from "./theme/ThemePicker";

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
      { label: "Random Call", to: "/call", icon: Phone, keywords: "random call one to one partner match talk 1:1" },
      { label: "Chat", to: "/chat", icon: MessageCircle, keywords: "messages dm conversation" },
      { label: "Communities", to: "/communities", icon: Hash, keywords: "groups clubs channels" },
      { label: "Friends", to: "/friends", icon: Users, keywords: "partners people suggestions", matches: ["/suggestions", "/blocked"] },
      { label: "Daily challenge", to: "/challenge", icon: Megaphone, keywords: "daily speaking challenge question answer record prompt" },
      { label: "My sessions", to: "/sessions", icon: History, keywords: "sessions recap history voice rooms past calls report fluency" },
      { label: "Role-play", to: "/roleplay", icon: Drama, keywords: "role play roleplay scenarios conversation practice cafe hotel interview doctor directions" },
      { label: "AI Partner", to: "/ai-partner", icon: Bot, keywords: "ai tutor practice talk speaking conversation roleplay interview" },
    ],
  },
  {
    title: "Learn",
    items: [
      { label: "Library", to: "/library", icon: Library, keywords: "reading listening stories dialogues articles read listen comprehension" },
      { label: "Writing", to: "/writing", icon: PenLine, keywords: "writing write essay email grammar spelling check compose" },
      { label: "Dictionary", to: "/dictionary", icon: BookA, keywords: "dictionary 10000 words meanings definitions pronunciation vocabulary size test word map level a1 b2 c1 synonyms" },
      { label: "My words", to: "/words", icon: BookOpen, keywords: "vocabulary words saved word bank meanings my words", matches: ["/vocabulary"] },
      { label: "Dictation", to: "/dictation", icon: Headphones, keywords: "listening dictation listen type hear spelling ears" },
      { label: "Word packs", to: "/packs", icon: Package, keywords: "vocabulary packs themed words travel work food idioms phrasal verbs ielts quiz" },
      { label: "Flashcards", to: "/flashcards", icon: Layers, keywords: "review cards spaced repetition" },
      { label: "Shadowing", to: "/shadowing", icon: Repeat2, keywords: "shadowing repeat after listen speak echo fluency rhythm" },
      { label: "Pronunciation", to: "/pronunciation", icon: Mic, keywords: "pronounce speaking sounds accent th say aloud score" },
      { label: "Grammar", to: "/grammar", icon: GraduationCap, keywords: "rules tenses lessons articles prepositions conditionals passive exercises drills" },
      { label: "Exercises", to: "/exercises", icon: Dumbbell, keywords: "practice quiz" },
      { label: "Progress", to: "/progress", icon: TrendingUp, keywords: "stats streak xp level" },
      { label: "Leagues", to: "/leagues", icon: Trophy, keywords: "league leaderboard rank badges achievements weekly competition" },
      { label: "Level test", to: "/placement", icon: Sparkles, keywords: "placement cefr a1 b2 c1 assessment find my english level" },
    ],
  },
];

/** Each section has its own colour: the active item's icon tile, the hover tint and the dot by the title */
interface Accent {
  tile: string;
  glow: string;
  hover: string;
  dot: string;
}

const ACCENTS: Record<string, Accent> = {
  Home: {
    tile: "from-indigo-500 to-violet-500",
    glow: "shadow-indigo-500/40",
    hover: "group-hover:text-indigo-500 dark:group-hover:text-indigo-300",
    dot: "bg-indigo-500",
  },
  Speak: {
    tile: "from-rose-500 to-orange-400",
    glow: "shadow-rose-500/40",
    hover: "group-hover:text-rose-500 dark:group-hover:text-rose-300",
    dot: "bg-rose-500",
  },
  Learn: {
    tile: "from-emerald-500 to-teal-400",
    glow: "shadow-emerald-500/40",
    hover: "group-hover:text-emerald-600 dark:group-hover:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

/** The menu slides in item by item once per page load, not on every navigation */
let introPlayed = false;

const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Profile", to: "/profile", icon: User, keywords: "me account" },
  { label: "Settings", to: "/settings", icon: Settings, keywords: "preferences notifications privacy" },
  { label: "Premium", to: "/premium", icon: Crown, keywords: "pro upgrade subscription billing plan pay price", matches: ["/billing"] },
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
  const freezes = Number(progress?.freezes ?? 0) || 0;
  const practicedToday = !!progress?.practicedToday;
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
    freezes,
    practicedToday,
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
  const gradientId = `level-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
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
          stroke={`url(#${gradientId})`}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-[5px] flex">{children}</div>
      <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#F8F9FC] dark:ring-shell">
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
      <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#F8F9FC] dark:ring-shell">
        <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-60" />
      </span>
    ) : (
      <span className="relative ml-auto flex items-center gap-1 h-5 px-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold tabular-nums">
        <span className="relative w-1.5 h-1.5 rounded-full bg-rose-500">
          <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-70" />
        </span>
        {text} live
      </span>
    );
  }
  return compact ? (
    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#F8F9FC] dark:ring-shell">
      {text}
    </span>
  ) : (
    <motion.span
      key={text}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 16 }}
      className="relative ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 text-white text-[10px] font-bold tabular-nums flex items-center justify-center shadow-sm shadow-rose-500/40"
    >
      {text}
    </motion.span>
  );
};

/** Three bars that bounce like a voice meter */
const Equalizer: React.FC = () => (
  <span aria-hidden className="flex items-end gap-[2px] h-3">
    {[0, 0.3, 0.6].map((delay) => (
      <span key={delay} className="sb-eq w-[2px] h-full rounded-full bg-white/85 dark:bg-white/85 origin-bottom" style={{ animationDelay: `-${delay}s` }} />
    ))}
  </span>
);

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

/**
 * One nav item. Two shared highlights glide between items: a raised pill under the current page and a
 * soft one under the pointer. The current page's icon sits in a tile of its section's colour.
 */
const SidebarLink: React.FC<{
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  badge: { count?: number; live?: boolean };
  accent: Accent;
  hovered: boolean;
  onHover: (to: string) => void;
  intro: boolean;
  index: number;
}> = ({ item, collapsed, active, badge, accent, hovered, onHover, intro, index }) => {
  const Icon = item.icon;
  return (
    <motion.div
      initial={intro ? { opacity: 0, x: -14 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.12 + index * 0.028, type: "spring", stiffness: 420, damping: 32 }}
    >
      <NavLink
        to={item.to}
        aria-label={collapsed ? item.label : undefined}
        onMouseEnter={() => onHover(item.to)}
        onFocus={() => onHover(item.to)}
        className={`group relative flex items-center rounded-xl h-10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
          collapsed ? "justify-center w-full" : "gap-2.5 pl-1.5 pr-2.5"
        } ${active ? "text-slate-900 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"}`}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active-pill"
            className="absolute inset-0 rounded-xl bg-white dark:bg-white/[0.07] ring-1 ring-slate-200/70 dark:ring-white/[0.08] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_16px_-6px_rgba(79,70,229,0.25)] dark:shadow-[0_6px_20px_-8px_rgba(129,140,248,0.45)]"
            transition={{ type: "spring", stiffness: 480, damping: 36 }}
          />
        )}
        <AnimatePresence>
          {hovered && !active && (
            <motion.span
              layoutId="sidebar-hover-pill"
              className="absolute inset-0 rounded-xl bg-slate-200/60 dark:bg-white/[0.05]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 40, opacity: { duration: 0.12 } }}
            />
          )}
        </AnimatePresence>

        <span className={`relative shrink-0 flex items-center justify-center rounded-lg ${collapsed ? "w-9 h-9" : "w-7 h-7"}`}>
          {active && (
            <motion.span
              className={`absolute inset-0 rounded-lg bg-gradient-to-br ${accent.tile} shadow-md ${accent.glow}`}
              initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 20 }}
            />
          )}
          <Icon
            className={`relative w-[17px] h-[17px] motion-safe:transition-transform motion-safe:duration-300 ${
              active
                ? "text-white"
                : `text-slate-400 dark:text-slate-500 ${accent.hover} motion-safe:group-hover:scale-115 motion-safe:group-hover:-rotate-[8deg]`
            }`}
            strokeWidth={active ? 2.3 : 1.9}
          />
        </span>
        {!collapsed && (
          <span className={`relative text-[13.5px] truncate motion-safe:transition-transform motion-safe:duration-200 ${active ? "font-semibold" : "font-medium motion-safe:group-hover:translate-x-0.5"}`}>
            {item.label}
          </span>
        )}
        {!collapsed && <Badge {...badge} />}
        {collapsed && <Badge {...badge} compact />}
        {collapsed && <Tooltip label={item.label} hint={badge.count ? (badge.live ? `${badge.count} live` : `${badge.count} unread`) : undefined} />}
      </NavLink>
    </motion.div>
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
            className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-panel shadow-2xl overflow-hidden"
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
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group w-full text-left relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-sm p-3.5 transition-shadow hover:shadow-lg hover:shadow-orange-500/10 dark:hover:shadow-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
    >
      <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-amber-200/50 dark:bg-amber-500/15 blur-2xl pointer-events-none ${data.streak > 0 ? "sb-glow" : ""}`} />
      <div className="relative flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${data.streak > 0 ? "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-md shadow-orange-500/40" : "bg-slate-100 dark:bg-white/5"}`}>
          <span className={`inline-flex ${data.streak > 0 ? "sb-flicker" : ""}`}>
            <Flame className={`w-5 h-5 ${data.streak > 0 ? "text-white fill-white/40" : "text-slate-400"}`} />
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-tight tabular-nums">
            {data.streak > 0 ? `${data.streak}-day streak` : "Start a streak"}
          </p>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
            {data.streak > 0
              ? data.practicedToday
                ? "Done for today. See you tomorrow"
                : "Practise today to keep it going"
              : "Speak or study today to begin"}
          </p>
        </div>
        {data.freezes > 0 && (
          <span
            className="ml-auto shrink-0 inline-flex items-center gap-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300 px-1.5 py-1 text-[11px] font-bold tabular-nums"
            title={`${data.freezes} streak ${data.freezes === 1 ? "freeze" : "freezes"}: a missed day won't break your streak`}
          >
            <Snowflake className="w-3 h-3" /> {data.freezes}
          </span>
        )}
      </div>
      <div className="relative mt-3">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Level {data.level}</span>
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">{data.xp.toLocaleString()} XP</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
          <motion.div
            className="relative h-full rounded-full overflow-hidden bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
            initial={{ width: 0 }}
            animate={{ width: `${data.levelProgress}%` }}
            transition={reduced ? { duration: 0 } : { duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          >
            <span aria-hidden className="sb-gloss absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 dark:via-white/70 to-transparent" />
          </motion.div>
        </div>
        <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-slate-500 tabular-nums">
          {data.xpToNext > 0 ? `${data.xpToNext.toLocaleString()} XP to Level ${data.level + 1}` : "Max level reached 🎉"}
        </p>
      </div>
    </motion.button>
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
  const reduced = useReducedMotion();
  const [intro] = useState(() => !introPlayed && !reduced);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    introPlayed = true;
  }, []);

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
      className={`hidden lg:flex fixed left-0 top-0 bottom-0 z-50 flex-col bg-[#F8F9FC] dark:bg-shell border-r border-slate-200/80 dark:border-white/[0.06] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${className ?? ""}`}
      style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
    >
      {/* Slowly drifting colour behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="sb-drift absolute -top-28 -left-20 w-72 h-72 rounded-full bg-indigo-300/30 dark:bg-indigo-500/[0.14] blur-3xl" />
        <div className="sb-drift-slow absolute top-[38%] -right-28 w-60 h-60 rounded-full bg-fuchsia-300/20 dark:bg-fuchsia-500/[0.08] blur-3xl" />
        <div className="sb-drift absolute -bottom-24 -left-12 w-64 h-64 rounded-full bg-sky-300/25 dark:bg-sky-500/[0.08] blur-3xl" style={{ animationDelay: "-11s" }} />
      </div>
      {/* A light that runs down the edge now and then */}
      <span aria-hidden className="pointer-events-none absolute top-0 bottom-0 -right-px w-px overflow-hidden">
        <span className="sb-beam absolute left-0 w-px h-40 bg-gradient-to-b from-transparent via-indigo-500/80 to-transparent dark:via-indigo-300/80" />
      </span>

      {/* Logo + collapse */}
      <div className={`h-16 shrink-0 flex items-center ${collapsed ? "justify-center px-3" : "justify-between pl-4 pr-3"}`}>
        <motion.button
          type="button"
          onClick={() => navigate("/dashboard")}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="group flex items-center min-w-0 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          aria-label="SpeakBetter home"
        >
          {collapsed ? (
            <LogoMark size={40} />
          ) : (
            <SpeakBetterLogo />
          )}
        </motion.button>
        {!collapsed && (
          <div className="flex items-center gap-1">
            <NotificationBell variant="sidebar" />
            <button
              type="button"
              onClick={toggleSidebar}
              className="group relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              aria-label="Collapse sidebar"
              title={`Collapse (${MOD_KEY}+B)`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {/* Collapsed: the bell sits under the logo */}
      {collapsed && (
        <div className="shrink-0 flex justify-center pb-2">
          <NotificationBell variant="sidebar" />
        </div>
      )}

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

        <motion.button
          type="button"
          onClick={() => navigate("/voice")}
          whileHover={{ y: -1.5 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
          className="sb-pan group relative overflow-visible w-full h-10 flex items-center justify-center gap-2 rounded-xl text-white font-semibold text-[13.5px] bg-[linear-gradient(110deg,#4f46e5,#7c3aed,#c026d3,#7c3aed,#4f46e5)] shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          aria-label="Start speaking"
        >
          {/* Shine that sweeps across every few seconds */}
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
            <span className="sb-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 dark:via-white/40 to-transparent" />
          </span>
          <Mic className="relative w-4 h-4 motion-safe:transition-transform motion-safe:group-hover:scale-110" />
          {!collapsed && <span className="relative">Start speaking</span>}
          {!collapsed && <span className="relative"><Equalizer /></span>}
          {collapsed && <Tooltip label="Start speaking" />}
        </motion.button>
      </div>

      {/* Navigation */}
      <motion.nav
        layoutScroll
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-3 space-y-5"
        style={{ scrollbarWidth: "thin" }}
        onMouseLeave={() => setHovered(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(null);
        }}
      >
        {NAV_SECTIONS.map((section, sectionIndex) => {
          const accent = ACCENTS[section.title] ?? ACCENTS.Home;
          const offset = NAV_SECTIONS.slice(0, sectionIndex).reduce((n, s) => n + s.items.length, 0);
          return (
            <div key={section.title}>
              {collapsed ? (
                <div className="mx-2 mb-2 border-t border-slate-200/70 dark:border-white/[0.06] first:hidden" />
              ) : (
                <motion.p
                  initial={intro ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.08 + offset * 0.028 }}
                  className="px-3 mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                  {section.title}
                  <span className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-white/[0.08] to-transparent" />
                </motion.p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item, i) => (
                  <SidebarLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    active={isActive(item)}
                    badge={badgeFor(item, data)}
                    accent={accent}
                    hovered={hovered === item.to}
                    onHover={setHovered}
                    intro={intro}
                    index={offset + i}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {!collapsed && <LiveNowList data={data} onJoin={(id) => navigate(`/voice/${id}`)} />}
      </motion.nav>

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
              className={`absolute bottom-full mb-2 z-50 w-60 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-panel shadow-2xl p-1.5 ${collapsed ? "left-3" : "left-3 right-3 w-auto"}`}
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
              <div className="px-1.5 pt-1.5 pb-1">
                <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Theme</p>
                <ThemeSwitch />
              </div>
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
    { label: "Learn", icon: BookOpen, to: "/words", active: learnPaths.some(isActive) },
    { label: "More", icon: Menu, active: isMobileMenuOpen, onClick: () => setMobileMenuOpen(true) },
  ];

  const mobile = !inVoiceRoom && (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed left-0 right-0 bottom-0 z-50 border-t border-slate-200/80 dark:border-white/[0.06] bg-white/90 dark:bg-shell/90 backdrop-blur-xl"
      style={{ height: MOBILE_TAB_BAR_HEIGHT, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="h-full grid grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const content = (
            <>
              <span className="relative flex items-center justify-center w-14 h-8">
                {tab.active && (
                  <motion.span
                    layoutId="mobile-tab-pill"
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/15 to-violet-500/15 dark:from-indigo-400/20 dark:to-violet-400/20"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <motion.span
                  key={String(tab.active)}
                  initial={tab.active ? { scale: 0.6, y: 4 } : false}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 16 }}
                  className="relative"
                >
                  <Icon className="w-[22px] h-[22px]" strokeWidth={tab.active ? 2.3 : 1.9} />
                  {tab.badge && <Badge {...tab.badge} compact />}
                </motion.span>
              </span>
              <span className={`text-[10.5px] ${tab.active ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
            </>
          );
          const cls = `relative flex flex-col items-center justify-center gap-0.5 transition-colors ${tab.active ? "text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`;
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
            className="absolute left-0 right-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[#F8F9FC] dark:bg-panel border-t border-slate-200 dark:border-white/10 px-4 pt-3"
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

            {[...NAV_SECTIONS, { title: "Account", items: ACCOUNT_ITEMS }].map((section, sectionIndex, all) => {
              const accent = ACCENTS[section.title] ?? ACCENTS.Home;
              const offset = all.slice(0, sectionIndex).reduce((n, s) => n + s.items.length, 0);
              return (
                <div key={section.title} className="mb-4">
                  <p className="px-1 mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                    {section.title}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map((item, i) => {
                      const Icon = item.icon;
                      const active = isActive(item);
                      const badge = badgeFor(item, data);
                      return (
                        <motion.button
                          key={item.to}
                          type="button"
                          onClick={() => go(item.to)}
                          initial={{ opacity: 0, y: 12, scale: 0.94 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ delay: 0.06 + (offset + i) * 0.015, type: "spring", stiffness: 450, damping: 30 }}
                          className={`relative flex flex-col items-center justify-center gap-1.5 h-20 rounded-2xl border transition-colors ${
                            active
                              ? "bg-white border-indigo-200 text-slate-900 shadow-md shadow-indigo-500/10 dark:bg-white/[0.07] dark:border-indigo-400/30 dark:text-white"
                              : "bg-white border-slate-200/80 text-slate-700 dark:bg-white/[0.03] dark:border-white/10 dark:text-slate-300"
                          }`}
                        >
                          <span className={`relative flex items-center justify-center w-8 h-8 rounded-xl ${active ? `bg-gradient-to-br ${accent.tile} text-white shadow-md ${accent.glow}` : ""}`}>
                            <Icon className="w-5 h-5" />
                            <Badge {...badge} compact />
                          </span>
                          <span className="text-xs font-medium">{item.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="mb-4">
              <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Theme</p>
              <ThemeSwitch size="md" />
            </div>

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

  // reducedMotion="user": springs and slides become instant fades for people who ask for less motion
  return (
    <MotionConfig reducedMotion="user">
      {desktop}
      {mobile}
      {sheet}
      {/* Re-keyed on open so every opening starts with an empty search */}
      <CommandPalette key={String(isPaletteOpen)} open={isPaletteOpen} onClose={closePalette} entries={paletteEntries} />
    </MotionConfig>
  );
};

/** Kept so older imports don't break — the mobile nav now lives inside <Sidebar /> */
export const MobileSidebar = () => null;

export default Sidebar;
