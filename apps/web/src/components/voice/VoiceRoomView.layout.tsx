// apps/web/src/components/voice/VoiceRoomView.layout.tsx
/**
 * Room layout — the "studio" shell around a live voice room.
 *
 *   ┌──────────────────── header ────────────────────┐
 *   │ banner (connection)                            │
 *   │ ┌──────────── stage card ──────────┐ ┌ chat ┐  │
 *   │ │ live · chips          tool groups│ │      │  │
 *   │ │ stageTop (coach dock)            │ │      │  │
 *   │ │ stage (participants)   + overlay │ │      │  │
 *   │ │ footer (reactions · clap)        │ │      │  │
 *   │ └──────────────────────────────────┘ └──────┘  │
 *   └──────── control dock: info · audio · keys ─────┘
 *
 * Everything here is presentational: VoiceRoomView owns the state and passes
 * finished nodes into the slots, so the shell can be previewed with mock data.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, type LucideIcon } from "lucide-react";

import { THEME } from "./VoiceRoomView.theme";

// ------------------------------------------------------------
// Tokens
// ------------------------------------------------------------

const ROOM_SURFACE = {
  background: "linear-gradient(180deg, rgba(22,22,38,0.78) 0%, rgba(12,12,22,0.82) 100%)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "0 30px 80px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)",
  backdropFilter: "blur(18px)",
} as const;

const TONES = {
  primary: { fg: THEME.colors.accent.primaryLight, bg: "rgba(99,102,241,0.16)", ring: "rgba(129,140,248,0.45)" },
  success: { fg: THEME.colors.accent.success, bg: "rgba(52,211,153,0.14)", ring: "rgba(52,211,153,0.45)" },
  warning: { fg: THEME.colors.accent.warning, bg: "rgba(251,191,36,0.14)", ring: "rgba(251,191,36,0.45)" },
} as const;

export type Tone = keyof typeof TONES;

// ------------------------------------------------------------
// Backdrop — static, so the room never re-renders just to animate the wallpaper
// ------------------------------------------------------------

export const RoomBackdrop: React.FC<{ intensity?: "calm" | "bright" }> = ({ intensity = "calm" }) => {
  const k = intensity === "bright" ? 1.4 : 1;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(ellipse 70% 45% at 50% -8%, rgba(99,102,241,${0.22 * k}), transparent 70%)`,
            `radial-gradient(ellipse 45% 40% at 100% 100%, rgba(236,72,153,${0.08 * k}), transparent 70%)`,
            `radial-gradient(ellipse 40% 35% at 0% 85%, rgba(34,211,238,${0.06 * k}), transparent 70%)`,
          ].join(", "),
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
};

// ------------------------------------------------------------
// Tools
// ------------------------------------------------------------

export interface RoomTool {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  badge?: number;
  dot?: boolean;
  hidden?: boolean;
  tone?: Tone;
}

export interface RoomToolGroup {
  id: string;
  label: string;
  tools: RoomTool[];
}

const ToolButton: React.FC<{ tool: RoomTool }> = ({ tool }) => {
  const Icon = tool.icon;
  const tone = TONES[tool.tone ?? "primary"];
  const showBadge = !!tool.badge && tool.badge > 0 && !tool.active;
  return (
    <button
      type="button"
      onClick={tool.onClick}
      aria-label={tool.label}
      aria-pressed={tool.active ?? false}
      className="group/tool relative grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
      style={{
        background: tool.active ? tone.bg : "transparent",
        color: tool.active ? tone.fg : THEME.colors.text.secondary,
        boxShadow: tool.active ? `inset 0 0 0 1px ${tone.ring}` : undefined,
      }}
    >
      <span className="absolute inset-0 rounded-xl bg-white/0 transition-colors group-hover/tool:bg-white/[0.06]" />
      <Icon className="relative h-[18px] w-[18px]" />
      {showBadge && (
        <span
          className="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[9px] font-bold tabular-nums"
          style={{ background: tone.fg, color: "#0a0a12" }}
        >
          {tool.badge! > 99 ? "99+" : tool.badge}
        </span>
      )}
      {tool.dot && !tool.active && !showBadge && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-[#12121f]" style={{ background: THEME.colors.accent.warning }} />
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium opacity-0 shadow-xl transition-opacity delay-150 group-hover/tool:opacity-100 group-focus-visible/tool:opacity-100"
        style={{ background: "#1c1c2e", color: THEME.colors.text.primary, border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {tool.label}
      </span>
    </button>
  );
};

/** Tool groups separated by hairlines; scrolls sideways on narrow screens */
export const RoomToolbar: React.FC<{ groups: RoomToolGroup[] }> = ({ groups }) => {
  const visible = groups
    .map((g) => ({ ...g, tools: g.tools.filter((t) => !t.hidden) }))
    .filter((g) => g.tools.length > 0);
  if (!visible.length) return null;
  return (
    <div role="toolbar" aria-label="Room tools" className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl p-1 md:overflow-visible" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.06)" }}>
      {visible.map((group, i) => (
        <React.Fragment key={group.id}>
          {i > 0 && <span aria-hidden className="mx-0.5 h-5 w-px shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />}
          <div role="group" aria-label={group.label} className="flex items-center gap-0.5">
            {group.tools.map((tool) => (
              <ToolButton key={tool.id} tool={tool} />
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

// ------------------------------------------------------------
// Stage header chips
// ------------------------------------------------------------

export interface StageStat {
  id: string;
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Glows when something is happening (someone speaking, recording…) */
  live?: boolean;
  color?: string;
}

const StatChip: React.FC<{ stat: StageStat }> = ({ stat }) => {
  const Icon = stat.icon;
  const color = stat.color ?? THEME.colors.accent.success;
  return (
    <span
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs"
      style={{
        background: stat.live ? `${color}1f` : "rgba(255,255,255,0.04)",
        border: `1px solid ${stat.live ? `${color}55` : "rgba(255,255,255,0.06)"}`,
        color: stat.live ? color : THEME.colors.text.secondary,
      }}
      title={stat.label}
      aria-label={`${stat.label}: ${typeof stat.value === "string" || typeof stat.value === "number" ? stat.value : ""}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold tabular-nums" style={{ color: stat.live ? color : THEME.colors.text.primary }}>
        {stat.value}
      </span>
      <span className="hidden xl:inline">{stat.label.toLowerCase()}</span>
    </span>
  );
};

export const LiveBadge: React.FC<{ label?: string; tone?: "live" | "idle" }> = ({ label = "Live", tone = "live" }) => {
  const color = tone === "live" ? "#f43f5e" : THEME.colors.text.muted;
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full pl-2 pr-2.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ background: `${color}1a`, color, border: `1px solid ${color}40` }}>
      <span className="relative flex h-2 w-2">
        {tone === "live" && <span className="absolute inset-0 animate-ping rounded-full opacity-70" style={{ background: color }} />}
        <span className="relative h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      {label}
    </span>
  );
};

// ------------------------------------------------------------
// Surfaces
// ------------------------------------------------------------

export const RoomCard: React.FC<React.HTMLAttributes<HTMLDivElement> & { as?: "section" | "div" | "aside" }> = ({ as = "div", className = "", style, children, ...rest }) => {
  const Tag = as;
  return (
    <Tag className={`relative overflow-hidden rounded-[26px] ${className}`} style={{ ...ROOM_SURFACE, ...style }} {...rest}>
      {children}
    </Tag>
  );
};

export const DockKey: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1 font-mono text-[10px] font-semibold" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: THEME.colors.text.secondary }}>
    {children}
  </kbd>
);

// ------------------------------------------------------------
// The shell
// ------------------------------------------------------------

export interface RoomLayoutProps {
  header: React.ReactNode;
  banner?: React.ReactNode;
  /** Title row of the stage card */
  stageTitle: React.ReactNode;
  stats: StageStat[];
  toolGroups: RoomToolGroup[];
  /** Pinned under the stage header (coach dock, missions…) */
  stageTop?: React.ReactNode;
  /** The participants; scrolls inside the card */
  stage: React.ReactNode;
  /** Absolutely positioned layers over the stage (captions, reactions, queue) */
  stageOverlay?: React.ReactNode;
  stageFooter?: React.ReactNode;
  chat?: React.ReactNode;
  chatOpen: boolean;
  /** Left side of the control dock */
  dockInfo?: React.ReactNode;
  /** The audio controls (tablet and up) */
  dock: React.ReactNode;
  /** Controls for phones, where the full audio bar doesn't fit */
  phoneDock?: React.ReactNode;
  onShowShortcuts?: () => void;
  shortcutHint?: React.ReactNode;
  /** Modals, sheets and other fixed layers */
  children?: React.ReactNode;
}

export const RoomLayout: React.FC<RoomLayoutProps> = ({
  header,
  banner,
  stageTitle,
  stats,
  toolGroups,
  stageTop,
  stage,
  stageOverlay,
  stageFooter,
  chat,
  chatOpen,
  dockInfo,
  dock,
  phoneDock,
  onShowShortcuts,
  shortcutHint,
  children,
}) => (
  <div className="relative flex h-dvh flex-col overflow-hidden" style={{ background: "#07070d", color: THEME.colors.text.primary }}>
    <RoomBackdrop />

    <div className="relative z-30">{header}</div>
    {banner}

    <main className="relative z-10 flex min-h-0 flex-1 gap-3 px-2 pt-2 sm:px-3 sm:pt-3">
      {/* Stage */}
      <RoomCard as="section" aria-label="Stage" className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {stageTitle}
          </div>
          <RoomToolbar groups={toolGroups} />
        </div>

        {stats.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-3 pt-2.5 sm:px-4" style={{ scrollbarWidth: "none" }}>
            {stats.map((stat) => (
              <StatChip key={stat.id} stat={stat} />
            ))}
          </div>
        )}

        {stageTop && (
          <div className="relative z-10 max-h-[38%] shrink-0 overflow-y-auto px-3 pt-3 sm:px-4 md:max-h-none md:overflow-visible" style={{ scrollbarWidth: "thin" }}>
            {stageTop}
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          {stage}
          {stageOverlay}
        </div>

        {stageFooter && (
          <div className="relative z-20 flex shrink-0 items-center justify-start gap-3 overflow-x-auto border-t px-3 py-2.5 md:justify-center" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(8,8,16,0.35)", scrollbarWidth: "none" }}>
            {stageFooter}
          </div>
        )}
      </RoomCard>

      {/* Chat: a card beside the stage on desktop, a full sheet over it on phones */}
      <AnimatePresence initial={false}>
        {chatOpen && chat && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="absolute inset-x-2 bottom-0 top-2 z-40 flex overflow-hidden rounded-[26px] md:static md:inset-auto md:z-auto"
            style={{ border: ROOM_SURFACE.border, boxShadow: ROOM_SURFACE.boxShadow }}
          >
            {chat}
          </motion.div>
        )}
      </AnimatePresence>
    </main>

    {/* Control dock */}
    <footer className="relative z-30 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2.5 sm:px-4">
      <div className="hidden min-w-0 items-center gap-2 md:flex">{dockInfo}</div>
      <div className={`col-span-3 justify-center md:col-span-1 ${phoneDock ? "hidden md:flex" : "flex"}`}>{dock}</div>
      {phoneDock && <div className="col-span-3 flex justify-center md:hidden">{phoneDock}</div>}
      <div className="hidden items-center justify-end gap-2 md:flex">
        {shortcutHint && <div className="hidden min-w-0 items-center gap-1.5 truncate text-[11px] lg:flex" style={{ color: THEME.colors.text.muted }}>{shortcutHint}</div>}
        {onShowShortcuts && (
          <button
            type="button"
            onClick={onShowShortcuts}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
            style={{ color: THEME.colors.text.secondary, border: "1px solid rgba(255,255,255,0.07)" }}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
          </button>
        )}
      </div>
    </footer>

    {children}
  </div>
);

// ------------------------------------------------------------
// Phone dock — the essentials as big thumb targets
// ------------------------------------------------------------

export interface PhoneDockAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** "on" glows in the tone colour; "danger" is the leave button */
  state?: "on" | "off" | "danger";
  tone?: Tone;
  badge?: number;
}

export const RoomPhoneDock: React.FC<{ actions: PhoneDockAction[] }> = ({ actions }) => (
  <div className="flex w-full max-w-sm items-center justify-between gap-2 rounded-[22px] p-1.5" style={ROOM_SURFACE} role="toolbar" aria-label="Call controls">
    {actions.map((a) => {
      const Icon = a.icon;
      const tone = TONES[a.tone ?? "primary"];
      const danger = a.state === "danger";
      const on = a.state === "on";
      return (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          aria-label={a.label}
          aria-pressed={a.state === "on" || a.state === "off" ? on : undefined}
          className="relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium transition-transform active:scale-95"
          style={{
            background: danger ? "rgba(239,68,68,0.9)" : on ? tone.bg : "rgba(255,255,255,0.04)",
            color: danger ? "#fff" : on ? tone.fg : THEME.colors.text.secondary,
            boxShadow: on ? `inset 0 0 0 1px ${tone.ring}` : undefined,
          }}
        >
          <Icon className="h-5 w-5" />
          {a.label}
          {!!a.badge && a.badge > 0 && (
            <span className="absolute right-2 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold" style={{ background: THEME.colors.accent.warning, color: "#0a0a12" }}>
              {a.badge > 99 ? "99+" : a.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ------------------------------------------------------------
// Status screens (joining, errors, not found)
// ------------------------------------------------------------

export const RoomStatusScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative flex h-dvh items-center justify-center overflow-hidden px-6" style={{ background: "#07070d" }}>
    <RoomBackdrop intensity="bright" />
    <div className="relative">{children}</div>
  </div>
);

export const RoomStatusCard: React.FC<{
  icon: LucideIcon;
  tone?: "neutral" | "warning";
  title: string;
  body: React.ReactNode;
  actions?: React.ReactNode;
  role?: "alert" | "status";
}> = ({ icon: Icon, tone = "neutral", title, body, actions, role }) => {
  const accent = tone === "warning" ? THEME.colors.accent.warning : THEME.colors.text.secondary;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      role={role}
      className="w-full max-w-sm rounded-[28px] p-7 text-center"
      style={ROOM_SURFACE}
    >
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: `${accent}1a`, border: `1px solid ${accent}40` }}>
        <Icon className="h-7 w-7" style={{ color: accent }} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed" style={{ color: THEME.colors.text.secondary }}>{body}</div>
      {actions && <div className="mt-6 flex gap-2.5">{actions}</div>}
    </motion.div>
  );
};

export const RoomButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }> = ({ variant = "primary", className = "", style, children, ...rest }) => (
  <button
    type="button"
    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${variant === "primary" ? "text-white hover:brightness-110 active:scale-[0.98]" : "hover:bg-white/[0.06]"} ${className}`}
    style={{
      ...(variant === "primary"
        ? { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 12px 30px -12px rgba(99,102,241,0.9)" }
        : { border: "1px solid rgba(255,255,255,0.1)", color: THEME.colors.text.secondary }),
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);

/** Concentric "joining" loader */
export const RoomJoiningIndicator: React.FC<{ label: string; icon: LucideIcon; onCancel?: () => void }> = ({ label, icon: Icon, onCancel }) => (
  <div className="text-center" role="status" aria-live="polite">
    <div className="relative mx-auto mb-7 h-28 w-28">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full"
          style={{ border: "1px solid rgba(129,140,248,0.45)" }}
          initial={{ scale: 0.55, opacity: 0.8 }}
          animate={{ scale: 1.25, opacity: 0 }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
        />
      ))}
      <div className="absolute inset-[30%] grid place-items-center rounded-2xl" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 16px 40px -10px rgba(99,102,241,0.9)" }}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
    <p className="text-sm font-medium" style={{ color: THEME.colors.text.secondary }}>{label}…</p>
    {onCancel && (
      <button type="button" onClick={onCancel} className="mt-5 text-xs underline-offset-4 hover:underline" style={{ color: THEME.colors.text.muted }}>
        Cancel
      </button>
    )}
  </div>
);
