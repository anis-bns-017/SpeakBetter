// apps/web/src/components/voice/VoiceRoomView.tsx
/**
 * VoiceRoomView — single-file edition.
 *
 * Sections (top to bottom):
 *   1. Hooks         keyboard shortcuts, remote audio output, tab title
 *   2. Chrome        ambient backdrop, drag-drop zone, tool rail, connection banner
 *   3. VoiceRoomList room browser (exported)
 *   4. VoiceRoomView the live room (exported, default)
 *
 * Stage-bottom overlays (reaction bar + clap dock) share one wrapper whose
 * bounds match the stage — left edge to the chat panel's left border — so
 * they slide with the stage when chat opens and never sit under the chat.
 *
 * Improvements in this revision:
 *   - FIX (two-places bubbling): handleSendStageReaction now takes a
 *     `local` flag. The StageReactionBar uses local:true (you see your
 *     own ❤️🔥🎉 rise on stage). The ClapButton uses local:false (its
 *     own local bubble particles are the clicker's feedback; other users
 *     see your 👏 via socket broadcast). Previously both fired and you'd
 *     see bubbles from the button AND a 👏 from a random spot on stage.
 *   - Per-emoji flood guard (was per-user-total, which blocked ❤️ after
 *     you'd clapped 👏 a few times).
 *   - Audio level is smoothed with a 0.7/0.3 moving average before being
 *     shown in the dock aura — no more flicker on every mic jitter.
 *   - pushStageReaction dedupes by ID so a socket echo racing with the
 *     optimistic push can't double-render the same reaction.
 *   - RoomHotkey handlers are read through refs so the global keydown
 *     listener never goes stale and never needs re-binding.
 *   - ToolRail: now a single centered pill at the top of the stage.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useDeferredValue,
  type RefObject,
} from "react";
import {
  AlertCircle,
  WifiOff,
  RotateCcw,
  Mic,
  Mic2,
  Wifi,
  Sparkles,
  SpellCheck,
  BookOpen,
  BarChart3,
  Upload,
  Loader2,
  Info,
  Users,
  Crown,
  Radio,
  Search,
  Plus,
  LogIn,
  Languages,
  Filter,
  X,
  Lock,
  Target,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import {
  useVoiceRoom,
  useVoiceSocket,
  useLiveKitRoom,
  voiceApi,
  useRoomMessages,
  useSendVoiceMessage,
  useDeleteVoiceMessage,
  useEditVoiceMessage,
  useReactToVoiceMessage,
  usePinVoiceMessage,
  useLeaveVoiceRoom,
  type VoiceMessage,
} from "../../hooks/useVoice";
import { useAuth } from "../../contexts/AuthContext";

import { AudioControls } from "./AudioControls";
import { ClapButton } from "./ClapButton";
import { VoiceRoomHeader } from "./shared/VoiceRoomHeader";
import { LeaveConfirmationModal } from "./shared/LeaveConfirmationModal";
import { RoomDetailsPanel } from "./shared/RoomDetailsPanel";
import { ShortcutPanel } from "./shared/ShortcutPanel";
import { CommandCenter } from "./shared/CommandCenter";
import { RoomInvite } from "./shared/RoomInvite";
import { SessionInsights } from "./shared/SessionInsights";
import { RoomQualityPanel } from "./shared/RoomQualityPanel";
import { AICoHost } from "./shared/AICoHost";
import { useAICoHost } from "../../hooks/useAICoHost";
import { VoiceEffectsPanel } from "./shared/VoiceEffectsPanel";
import { useVoiceEffects } from "../../hooks/useVoiceEffects";
import { CorrectionSheet } from "./shared/CorrectionSheet";
import { CorrectionsInbox } from "./shared/CorrectionsInbox";
import { useVoiceCorrections } from "../../hooks/useVoiceCorrections";
import { PracticeJournal } from "./shared/PracticeJournal";
import { usePracticeJournal } from "../../hooks/usePracticeJournal";
import { RoomCoachPanel } from "./shared/RoomCoachPanel";
import { SpotlightBanner } from "./shared/SpotlightBanner";
import { useRoomCoach } from "../../hooks/useRoomCoach";
import {
  AttachmentPreviewModal,
  type PendingAttachment,
} from "./chat/AttachmentPreviewModal";
import { useSpeakingTimes } from "../../hooks/useSpeakingTimes";
import { ParticipantGrid } from "./participants/ParticipantGrid";
import { useVoiceTranscription } from "../../hooks/useVoiceTranscription";
import { ChatPanel } from "./chat/ChatPanel";
import { ReactionOverlay, type StageReaction } from "./shared/ReactionOverlay";
import { SpeakerQueue } from "./SpeakerQueue";
import { ActiveSpeakerStrip } from "./shared/ActiveSpeakerStrip";
import { StageReactionBar } from "./shared/StageReactionBar";

import { THEME } from "./VoiceRoomView.theme";
import type { VoiceRoomViewProps } from "./VoiceRoomView.types";
import type { RoomParticipant } from "./participants/ParticipantCard";
import {
  playNotificationBeep,
  initials,
  hueFromString,
} from "./VoiceRoomView.helpers";

// ============================================================
// 1. HOOKS
// ============================================================

export const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

export const modKeyLabel = () => (isMac() ? "⌘" : "Ctrl");

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

export interface RoomHotkeyHandlers {
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleHand: () => void;
  onToggleChat: () => void;
  onShowShortcuts: () => void;
  onEscape: () => boolean;
  onSend: () => void;
  onQuickReaction?: (slot: number) => void;
  onClap?: () => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
}

export function useRoomHotkeys(handlers: RoomHotkeyHandlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === "Escape") {
        if (h.onEscape()) e.preventDefault();
        return;
      }

      if (mod && e.shiftKey) {
        if (key === "m") {
          e.preventDefault();
          h.onToggleMute();
        } else if (key === "h") {
          e.preventDefault();
          h.onToggleHand();
        } else if (key === "d") {
          e.preventDefault();
          h.onToggleDeafen();
        }
        return;
      }

      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.isComposing &&
        document.activeElement &&
        document.activeElement === h.composerRef.current
      ) {
        e.preventDefault();
        h.onSend();
        return;
      }

      if (mod || e.altKey || isTypingTarget(e.target)) return;

      if (h.onQuickReaction && /^[1-6]$/.test(e.key) && !e.repeat) {
        e.preventDefault();
        h.onQuickReaction(Number(e.key));
        return;
      }
      if (key === "a" && h.onClap && !e.repeat) {
        e.preventDefault();
        h.onClap();
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        h.onShowShortcuts();
      } else if (key === "m") {
        h.onToggleMute();
      } else if (key === "c") {
        e.preventDefault();
        h.onToggleChat();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function useRemoteAudioOutput({
  volume,
  deafened,
}: {
  volume: number;
  deafened: boolean;
}) {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLMediaElement>("audio").forEach((el) => {
        if (
          typeof MediaStream !== "undefined" &&
          el.srcObject instanceof MediaStream
        ) {
          el.muted = deafened;
          el.volume = Math.max(0, Math.min(1, volume / 100));
        }
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [volume, deafened]);
}

export function useRoomDocumentTitle(
  roomName: string | undefined,
  unread: number,
) {
  useEffect(() => {
    if (!roomName) return;
    const previous = document.title;
    document.title = `${unread > 0 ? `(${unread}) ` : ""}${roomName} · Voice`;
    return () => {
      document.title = previous;
    };
  }, [roomName, unread]);
}

function useMouseParallax(enabled: boolean) {
  const pos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        pos.current = { x: nx, y: ny };
        raf = 0;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);
  return pos;
}

// ============================================================
// 2. CHROME
// ============================================================

export const AmbientBackdrop: React.FC<{ subtle?: boolean }> = ({ subtle }) => {
  const reduced = useReducedMotion();
  const mouse = useMouseParallax(!reduced);

  const orbs = [
    {
      cls: "-top-40 -left-40 w-[520px] h-[520px] blur-[120px]",
      bg: "radial-gradient(circle at 30% 30%, rgba(129,140,248,0.55), transparent 65%)",
      o: subtle ? 0.35 : 0.55,
      d: 0,
      parallax: 32,
    },
    {
      cls: "-bottom-52 -right-32 w-[620px] h-[620px] blur-[140px]",
      bg: "radial-gradient(circle at 60% 40%, rgba(236,72,153,0.4), transparent 65%)",
      o: subtle ? 0.3 : 0.45,
      d: 0.15,
      parallax: -28,
    },
    {
      cls: "top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[520px] blur-[160px]",
      bg: "radial-gradient(circle at 50% 50%, rgba(56,189,248,0.35), transparent 70%)",
      o: subtle ? 0.25 : 0.4,
      d: 0.3,
      parallax: 20,
    },
  ];

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = () => {
      setOffset({ x: mouse.current.x, y: mouse.current.y });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mouse, reduced]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={
            reduced
              ? { opacity: orb.o }
              : { opacity: orb.o, scale: [1, 1.06, 1] }
          }
          transition={
            reduced
              ? { duration: 0.6 }
              : {
                  opacity: { duration: 1.2, delay: orb.d },
                  scale: {
                    duration: 14 + i * 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }
          }
          className={`absolute rounded-full ${orb.cls}`}
          style={{
            background: orb.bg,
            transform: reduced
              ? undefined
              : `translate(${offset.x * orb.parallax}px, ${offset.y * orb.parallax}px)`,
          }}
        />
      ))}
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
};

export const RoomDropZone: React.FC<{
  onFile: (file: File) => void;
  disabled?: boolean;
}> = ({ onFile, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileCount, setFileCount] = useState(1);
  const counter = useRef(0);

  useEffect(() => {
    if (disabled) {
      counter.current = 0;
      setIsDragging(false);
      return;
    }
    const hasFiles = (e: DragEvent) =>
      Boolean(e.dataTransfer?.types?.includes("Files"));

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      counter.current += 1;
      setFileCount(e.dataTransfer?.items?.length || 1);
      setIsDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      counter.current = Math.max(0, counter.current - 1);
      if (counter.current === 0) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      counter.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFile, disabled]);

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, rgba(129,140,248,0.22), rgba(10,10,20,0.55))",
            backdropFilter: "blur(10px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="px-10 py-8 rounded-3xl text-center"
            style={{
              background:
                "linear-gradient(180deg, rgba(24,24,42,0.85), rgba(14,14,26,0.85))",
              border: `1.5px dashed ${THEME.colors.accent.primary}`,
              boxShadow:
                "0 30px 80px -20px rgba(129,140,248,0.45), inset 0 0 60px rgba(129,140,248,0.08)",
            }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
                boxShadow: "0 10px 30px -8px rgba(129,140,248,0.6)",
              }}
            >
              <Upload className="w-8 h-8 text-white" />
            </motion.div>
            <p
              className="text-xl font-bold tracking-tight"
              style={{ color: THEME.colors.text.primary }}
            >
              Drop to attach
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: THEME.colors.text.muted }}
            >
              Images, video, audio or files up to 50MB
              {fileCount > 1 ? " · only the first file will be used" : ""}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ------------------------------------------------------------
// Tool rail — centered pill, single row (left group · divider · right group)
// ------------------------------------------------------------
export interface ToolRailItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  badge?: number;
  dot?: boolean;
  hidden?: boolean;
  tone?: "primary" | "success" | "warning";
}

const RailButton: React.FC<{ item: ToolRailItem }> = ({ item }) => {
  const Icon = item.icon;
  const tone = item.tone ?? "primary";
  const activeBg =
    tone === "success"
      ? THEME.colors.accent.success
      : tone === "warning"
        ? THEME.colors.accent.warning
        : THEME.colors.accent.primary;
  const badgeBg =
    tone === "success"
      ? THEME.colors.accent.success
      : THEME.colors.accent.warning;

  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-label={item.label}
      aria-pressed={item.active ?? false}
      title={item.label}
      className="relative grid h-10 w-10 place-items-center rounded-full border shadow-lg transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      style={{
        background: item.active ? activeBg : "rgba(18,18,32,0.85)",
        borderColor: THEME.colors.border.primary,
        color: item.active ? "#fff" : THEME.colors.text.muted,
        backdropFilter: "blur(12px)",
      }}
    >
      <Icon className="w-4 h-4" />
      {!!item.badge && item.badge > 0 && !item.active && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse"
          style={{ background: badgeBg, color: "#0a0a12" }}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
      {item.dot && !item.active && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ background: THEME.colors.accent.warning }}
        />
      )}
    </button>
  );
};

export const RoomToolRail: React.FC<{
  left: ToolRailItem[];
  right: ToolRailItem[];
}> = ({ left, right }) => {
  const visibleLeft = left.filter((i) => !i.hidden);
  const visibleRight = right.filter((i) => !i.hidden);
  const nothing = visibleLeft.length === 0 && visibleRight.length === 0;
  if (nothing) return null;

  return (
    <div
      className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 rounded-full border shadow-2xl"
      role="toolbar"
      aria-label="Room tools"
      style={{
        background: "rgba(14,14,26,0.82)",
        borderColor: THEME.colors.border.primary,
        backdropFilter: "blur(16px)",
        boxShadow:
          "0 20px 48px -18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {visibleLeft.map((item) => (
        <RailButton key={item.id} item={item} />
      ))}
      {visibleLeft.length > 0 && visibleRight.length > 0 && (
        <span
          aria-hidden
          className="w-px h-6 mx-0.5"
          style={{ background: THEME.colors.border.primary }}
        />
      )}
      {visibleRight.map((item) => (
        <RailButton key={item.id} item={item} />
      ))}
    </div>
  );
};

// ------------------------------------------------------------
// Connection banner — dismissible with animated icons
// ------------------------------------------------------------
export const ConnectionBanner: React.FC<{
  socketConnected: boolean;
  voiceConnected: boolean;
  voiceConnecting: boolean;
  mockMode?: boolean;
}> = ({ socketConnected, voiceConnected, voiceConnecting, mockMode }) => {
  const [dismissed, setDismissed] = useState<string | null>(null);

  let message: string | null = null;
  let kind: "info" | "warn" = "warn";
  let busy = false;

  if (mockMode) {
    message = "Demo mode — audio isn't connected to a live server.";
    kind = "info";
  } else if (voiceConnecting) {
    message = "Reconnecting voice…";
    busy = true;
  } else if (!voiceConnected) {
    message = "Voice is disconnected. Check your network — we'll keep trying.";
  } else if (!socketConnected) {
    message = "Live chat is reconnecting. Messages will still be delivered.";
    busy = true;
  }

  const isDismissed = dismissed === message;
  const color =
    kind === "info"
      ? THEME.colors.accent.tertiary
      : THEME.colors.accent.warning;
  const Icon = busy ? Loader2 : kind === "info" ? Info : WifiOff;

  return (
    <AnimatePresence initial={false}>
      {message && !isDismissed && (
        <motion.div
          key={message}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="relative z-30 overflow-hidden"
          role="status"
          aria-live="polite"
        >
          <div
            className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
            style={{
              color,
              background:
                kind === "info"
                  ? "rgba(129,140,248,0.1)"
                  : "rgba(251,191,36,0.1)",
              borderBottom: `1px solid ${THEME.colors.border.primary}`,
            }}
          >
            <motion.span
              animate={busy ? { rotate: 360 } : { rotate: 0 }}
              transition={
                busy
                  ? { duration: 1, repeat: Infinity, ease: "linear" }
                  : { duration: 0.2 }
              }
            >
              <Icon className="w-3.5 h-3.5" />
            </motion.span>
            {message}
            <button
              type="button"
              onClick={() => setDismissed(message)}
              aria-label="Dismiss"
              className="ml-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
              style={{ color }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================
// 3. VOICE ROOM LIST
// ============================================================
interface VoiceRoomListProps {
  onJoinRoom: (roomId: string) => void;
  onViewRoom?: (roomId: string) => void;
  onCreateRoom?: () => void;
}

interface LanguageFilter {
  nativeLanguage?: string;
  learningLanguage?: string;
}

type StatusFilter = "all" | "active" | "waiting";
type SortKey = "participants" | "recent" | "name";

const REFRESH_MS = 20_000;

const lc = (v: unknown) => String(v ?? "").toLowerCase();
const countOf = (room: any): number =>
  room?._count?.participants ?? room?.participants?.length ?? 0;

const ActivitySpark: React.FC<{ roomId: string; speaking: boolean }> = ({
  roomId,
  speaking,
}) => {
  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < roomId.length; i++)
      seed = (seed * 31 + roomId.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xffff) / 0xffff;
    };
    return Array.from({ length: 12 }, () => 0.2 + rand() * 0.8);
  }, [roomId]);

  return (
    <div className="flex items-end gap-[2px] h-4" aria-hidden>
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full"
          style={{
            background: speaking
              ? THEME.colors.status.online
              : THEME.colors.accent.primary,
            opacity: speaking ? 0.5 + h * 0.5 : 0.3 + h * 0.3,
          }}
          animate={
            speaking
              ? { height: [`${h * 100}%`, `${h * 130}%`, `${h * 100}%`] }
              : { height: `${h * 60}%` }
          }
          transition={
            speaking
              ? {
                  duration: 0.8 + i * 0.05,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
};

const RoomSkeleton: React.FC = () => (
  <div
    className="p-5 rounded-3xl border animate-pulse"
    style={{
      background:
        "linear-gradient(180deg, rgba(20,20,34,0.9), rgba(12,12,22,0.9))",
      borderColor: THEME.colors.border.primary,
    }}
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-white/5" />
      <div className="flex-1 space-y-2.5">
        <div className="h-3.5 w-40 rounded bg-white/10" />
        <div className="h-3 w-24 rounded bg-white/5" />
      </div>
      <div className="h-9 w-20 rounded-full bg-white/5" />
    </div>
  </div>
);

const RoomCard: React.FC<{
  room: any;
  onJoin: () => void;
  onView: () => void;
  currentUserId?: string;
  index?: number;
}> = ({ room, onJoin, onView, currentUserId, index = 0 }) => {
  const isActive = room.status === "ACTIVE";
  const participantCount = countOf(room);
  const maxParticipants: number | undefined = room.maxParticipants;
  const isFull = Boolean(
    maxParticipants && participantCount >= maxParticipants,
  );
  const isUserInside = room.participants?.some(
    (p: any) => p.userId === currentUserId,
  );
  const isHost = room.creatorId === currentUserId;
  const hasActiveSpeakers =
    room.participants?.some((p: any) => p.isSpeaking) || false;
  const hue = hueFromString(room.name);

  const languages = useMemo(() => {
    const langs = new Set<string>();
    room.participants?.forEach((p: any) => {
      if (p.nativeLanguage) langs.add(p.nativeLanguage);
      if (p.learningLanguage) langs.add(p.learningLanguage);
    });
    return Array.from(langs);
  }, [room.participants]);

  const avatars = useMemo(
    () =>
      (room.participants || []).slice(0, 4).map((p: any) => ({
        name: p.user?.name || p.name || "?",
        avatarUrl: p.user?.avatarUrl || p.avatarUrl,
      })),
    [room.participants],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25), duration: 0.35 }}
      whileHover={{ y: -3 }}
      role="button"
      tabIndex={0}
      aria-label={`Open room ${room.name}`}
      onClick={onView}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onView();
        }
      }}
      className="group relative p-[1.5px] rounded-3xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
        }}
      />
      <div
        className="relative p-5 rounded-3xl border transition-shadow overflow-hidden group-hover:border-transparent group-hover:shadow-[0_25px_60px_-25px_rgba(129,140,248,0.5)]"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,20,34,0.97), rgba(12,12,22,0.97))",
          borderColor: THEME.colors.border.primary,
        }}
      >
        {hasActiveSpeakers && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${THEME.colors.status.online}, transparent)`,
              opacity: 0.8,
            }}
          />
        )}
        <div className="flex items-center gap-4 relative">
          <div className="relative shrink-0">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${hue}, 65%, 32%), hsl(${hue + 40}, 60%, 24%))`,
                boxShadow: `0 8px 24px -8px hsl(${hue}, 60%, 40%)`,
              }}
            >
              {initials(room.name)}
            </div>
            {isActive && (
              <span
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                style={{
                  background: THEME.colors.status.online,
                  boxShadow: `0 0 0 2px rgba(10,10,20,1), 0 0 12px ${THEME.colors.status.online}`,
                }}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-semibold text-[15px] truncate"
                style={{ color: THEME.colors.text.primary }}
              >
                {room.name}
              </span>
              {room.isPrivate && (
                <Lock
                  className="w-3 h-3"
                  style={{ color: THEME.colors.text.muted }}
                />
              )}
              {isHost && (
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold uppercase tracking-wider"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,146,60,0.15))",
                    color: THEME.colors.accent.warning,
                    border: "1px solid rgba(251,191,36,0.3)",
                  }}
                >
                  <Crown className="w-2.5 h-2.5" /> Host
                </span>
              )}
              {hasActiveSpeakers && (
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold uppercase tracking-wider"
                  style={{
                    background: "rgba(129,140,248,0.12)",
                    color: THEME.colors.accent.tertiary,
                    border: "1px solid rgba(129,140,248,0.25)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: THEME.colors.accent.primary }}
                  />
                  Speaking
                </span>
              )}
            </div>

            <div
              className="flex items-center gap-3 mt-1.5 text-xs"
              style={{ color: THEME.colors.text.muted }}
            >
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {participantCount}
                {maxParticipants ? `/${maxParticipants}` : ""}
              </span>
              {room.language && (
                <span className="flex items-center gap-1">
                  <Languages className="w-3 h-3" />
                  {room.language}
                </span>
              )}
              {languages.length > 0 && (
                <span className="hidden sm:flex items-center gap-1">
                  {languages.slice(0, 2).map((lang) => (
                    <span
                      key={lang}
                      className="px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(167,139,250,0.1)",
                        color: THEME.colors.accent.tertiary,
                      }}
                    >
                      {lang}
                    </span>
                  ))}
                  {languages.length > 2 && (
                    <span
                      className="px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(167,139,250,0.1)",
                        color: THEME.colors.accent.tertiary,
                      }}
                    >
                      +{languages.length - 2}
                    </span>
                  )}
                </span>
              )}
              <span className="hidden sm:flex items-center gap-1.5 ml-auto">
                <ActivitySpark roomId={room.id} speaking={hasActiveSpeakers} />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {avatars.length > 0 && (
              <div className="hidden sm:flex -space-x-2">
                {avatars.map((a: any, i: number) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full ring-2 ring-[#0a0a14] flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden"
                    style={{
                      background: `hsl(${hueFromString(a.name)}, 55%, 30%)`,
                    }}
                    title={a.name}
                  >
                    {a.avatarUrl ? (
                      <img
                        src={a.avatarUrl}
                        alt={a.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials(a.name)
                    )}
                  </div>
                ))}
                {participantCount > 4 && (
                  <div
                    className="w-7 h-7 rounded-full ring-2 ring-[#0a0a14] flex items-center justify-center text-[9px] font-bold"
                    style={{
                      background: "rgba(129,140,248,0.2)",
                      color: THEME.colors.accent.tertiary,
                    }}
                  >
                    +{participantCount - 4}
                  </div>
                )}
              </div>
            )}

            <motion.button
              type="button"
              whileHover={{ scale: isFull && !isUserInside ? 1 : 1.05 }}
              whileTap={{ scale: isFull && !isUserInside ? 1 : 0.95 }}
              disabled={isFull && !isUserInside}
              onClick={(e) => {
                e.stopPropagation();
                if (isUserInside) onView();
                else onJoin();
              }}
              className="px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isUserInside
                  ? "rgba(52,211,153,0.12)"
                  : isFull
                    ? "rgba(255,255,255,0.06)"
                    : THEME.colors.gradient.primary,
                color: isUserInside
                  ? THEME.colors.status.online
                  : isFull
                    ? THEME.colors.text.muted
                    : "#fff",
                border: isUserInside
                  ? `1px solid ${THEME.colors.status.online}`
                  : "none",
                boxShadow:
                  isUserInside || isFull
                    ? "none"
                    : "0 10px 24px -10px rgba(129,140,248,0.8)",
              }}
            >
              {isUserInside ? (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: THEME.colors.status.online }}
                  />
                  Inside
                </>
              ) : isFull ? (
                "Full"
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  Join
                </>
              )}
            </motion.button>
          </div>
        </div>

        {room.description && (
          <p
            className="mt-3 text-sm truncate relative"
            style={{ color: THEME.colors.text.muted }}
          >
            {room.description}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export const VoiceRoomList: React.FC<VoiceRoomListProps> = ({
  onJoinRoom,
  onViewRoom,
  onCreateRoom,
}) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("participants");
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async (silent: boolean) => {
      try {
        if (!silent) {
          setIsLoading(true);
          setLoadError(null);
        }
        const response = await voiceApi.getRooms();
        if (!alive) return;
        setRooms(response.data || []);
        setLoadError(null);
      } catch {
        if (!alive || silent) return;
        setLoadError(
          "We couldn't load the voice rooms. Check your connection and try again.",
        );
        toast.error("Failed to load rooms");
      } finally {
        if (alive && !silent) setIsLoading(false);
      }
    };

    load(false);
    const id = window.setInterval(() => {
      if (!document.hidden) load(true);
    }, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [reloadKey]);

  const stats = useMemo(
    () => ({
      active: rooms.filter((r) => r.status === "ACTIVE").length,
      waiting: rooms.filter((r) => r.status === "WAITING").length,
      people: rooms.reduce((sum, r) => sum + countOf(r), 0),
    }),
    [rooms],
  );

  const activeFilterCount =
    (filter !== "all" ? 1 : 0) +
    (languageFilter.nativeLanguage ? 1 : 0) +
    (languageFilter.learningLanguage ? 1 : 0) +
    (sortBy !== "participants" ? 1 : 0);

  const clearAll = () => {
    setSearchQuery("");
    setFilter("all");
    setSortBy("participants");
    setLanguageFilter({});
  };

  const filteredRooms = useMemo(() => {
    const q = lc(deferredQuery).trim();
    const native = lc(languageFilter.nativeLanguage).trim();
    const learning = lc(languageFilter.learningLanguage).trim();

    const result = rooms.filter((room) => {
      if (
        q &&
        ![room.name, room.description, room.language].some((v) =>
          lc(v).includes(q),
        )
      )
        return false;
      if (filter === "active" && room.status !== "ACTIVE") return false;
      if (filter === "waiting" && room.status !== "WAITING") return false;
      if (native) {
        const roomMatch = lc(room.nativeLanguage).includes(native);
        const memberMatch = room.participants?.some((p: any) =>
          lc(p.nativeLanguage).includes(native),
        );
        if (!roomMatch && !memberMatch) return false;
      }
      if (learning) {
        const roomMatch = lc(room.learningLanguage).includes(learning);
        const memberMatch = room.participants?.some((p: any) =>
          lc(p.learningLanguage).includes(learning),
        );
        if (!roomMatch && !memberMatch) return false;
      }
      return true;
    });

    const time = (r: any) => new Date(r.updatedAt).getTime() || 0;
    result.sort((a, b) => {
      if (sortBy === "recent") return time(b) - time(a);
      if (sortBy === "name") return lc(a.name).localeCompare(lc(b.name));
      return countOf(b) - countOf(a);
    });
    return result;
  }, [rooms, deferredQuery, filter, sortBy, languageFilter]);

  if (loadError && rooms.length === 0) {
    return (
      <div className="min-h-[18rem] flex items-center justify-center px-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-3xl border p-7 text-center"
          style={{
            background:
              "linear-gradient(180deg, rgba(24,24,42,0.9), rgba(14,14,26,0.9))",
            borderColor: THEME.colors.border.primary,
            boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)",
          }}
        >
          <div
            className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.3)",
            }}
          >
            <WifiOff
              className="w-7 h-7"
              style={{ color: THEME.colors.accent.warning }}
            />
          </div>
          <h3
            className="font-semibold text-lg tracking-tight"
            style={{ color: THEME.colors.text.primary }}
          >
            Rooms are unavailable
          </h3>
          <p
            className="mt-1.5 text-sm"
            style={{ color: THEME.colors.text.muted }}
          >
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((v) => v + 1)}
            className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
            style={{
              background: THEME.colors.gradient.primary,
              boxShadow: "0 12px 30px -10px rgba(129,140,248,0.7)",
            }}
          >
            <RotateCcw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: rooms.length },
    { key: "active", label: "Live", count: stats.active },
    { key: "waiting", label: "Waiting", count: stats.waiting },
  ];

  const glassInput = {
    background: "rgba(18,18,32,0.7)",
    color: THEME.colors.text.primary,
    borderColor: THEME.colors.border.primary,
    backdropFilter: "blur(12px)",
  } as const;

  return (
    <div className="relative max-w-5xl mx-auto px-4 py-8 space-y-6">
      <AmbientBackdrop subtle />

      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-medium uppercase tracking-wider"
            style={{
              borderColor: "rgba(129,140,248,0.25)",
              background: "rgba(129,140,248,0.08)",
              color: THEME.colors.accent.tertiary,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: THEME.colors.status.online }}
            />
            Live rooms
          </div>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ color: THEME.colors.text.primary }}
          >
            Voice{" "}
            <span
              style={{
                background: THEME.colors.gradient.primary,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Rooms
            </span>
          </h2>
          <p className="text-sm" style={{ color: THEME.colors.text.muted }}>
            Join a live conversation and practice with native speakers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="px-3.5 py-2 rounded-full flex items-center gap-2 text-xs font-medium border"
            style={{
              background: "rgba(52,211,153,0.08)",
              borderColor: "rgba(52,211,153,0.25)",
              color: THEME.colors.status.online,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {stats.active} live
          </div>
          <div
            className="px-3.5 py-2 rounded-full flex items-center gap-2 text-xs font-medium border"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: THEME.colors.border.primary,
              color: THEME.colors.text.secondary,
            }}
          >
            <Users className="w-3.5 h-3.5" />
            {stats.people} in rooms
          </div>
          <div
            className="px-3.5 py-2 rounded-full flex items-center gap-2 text-xs font-medium border"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: THEME.colors.border.primary,
              color: THEME.colors.text.secondary,
            }}
          >
            <Radio className="w-3.5 h-3.5" />
            {rooms.length} total
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: THEME.colors.text.muted }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms, languages, or topics…"
            aria-label="Search rooms"
            className="w-full pl-11 pr-10 py-3 rounded-2xl outline-none transition-all border text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10"
            style={glassInput}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10"
              style={{ color: THEME.colors.text.muted }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="relative px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium transition-all border hover:scale-[1.02] active:scale-95"
          style={{
            ...glassInput,
            borderColor: showFilters
              ? THEME.colors.accent.primary
              : THEME.colors.border.primary,
            background: showFilters
              ? "rgba(129,140,248,0.1)"
              : glassInput.background,
            color: showFilters
              ? THEME.colors.accent.tertiary
              : THEME.colors.text.secondary,
          }}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span
              className="min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: THEME.colors.accent.primary, color: "#fff" }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() =>
            onCreateRoom
              ? onCreateRoom()
              : toast.info("Create room feature coming soon")
          }
          className="px-5 py-3 rounded-2xl flex items-center gap-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
          style={{
            background: THEME.colors.gradient.primary,
            boxShadow: "0 14px 34px -12px rgba(129,140,248,0.7)",
          }}
        >
          <Plus className="w-4 h-4" />
          New Room
        </button>
      </div>

      <div
        className="relative z-10 flex items-center gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Room status"
      >
        {statusTabs.map((tab) => {
          const selected = filter === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={selected}
              type="button"
              onClick={() => setFilter(tab.key)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
              style={{
                background: selected
                  ? THEME.colors.accent.primary
                  : "rgba(255,255,255,0.04)",
                color: selected ? "#fff" : THEME.colors.text.secondary,
                boxShadow: selected
                  ? "0 6px 16px -6px rgba(129,140,248,0.8)"
                  : "none",
              }}
            >
              {tab.label}
              <span className="opacity-70">{tab.count}</span>
            </button>
          );
        })}
        {activeFilterCount > 0 || searchQuery ? (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium shrink-0 hover:bg-white/5"
            style={{ color: THEME.colors.text.muted }}
          >
            Clear all
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden relative z-10"
          >
            <div
              className="p-5 rounded-2xl border grid grid-cols-1 sm:grid-cols-3 gap-4"
              style={glassInput}
            >
              <div>
                <label
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: THEME.colors.text.muted }}
                >
                  Sort by
                </label>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(["participants", "recent", "name"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSortBy(s)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all capitalize"
                      style={{
                        background:
                          sortBy === s
                            ? THEME.colors.accent.primary
                            : "rgba(255,255,255,0.04)",
                        color:
                          sortBy === s ? "#fff" : THEME.colors.text.secondary,
                      }}
                    >
                      {s === "participants" ? "Most people" : s}
                    </button>
                  ))}
                </div>
              </div>
              {(
                [
                  ["nativeLanguage", "Native language", "e.g. English"],
                  ["learningLanguage", "Learning language", "e.g. Spanish"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    {label}
                  </label>
                  <input
                    type="text"
                    value={languageFilter[key] || ""}
                    onChange={(e) =>
                      setLanguageFilter((f) => ({
                        ...f,
                        [key]: e.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    className="w-full mt-2 px-3 py-1.5 rounded-full text-xs outline-none border focus:border-indigo-400"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: THEME.colors.text.primary,
                      borderColor: THEME.colors.border.primary,
                    }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3 relative z-10" aria-busy={isLoading}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <RoomSkeleton key={i} />)
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(129,140,248,0.15), rgba(236,72,153,0.1))",
                border: "1px solid rgba(129,140,248,0.2)",
              }}
            >
              <Radio
                className="w-9 h-9"
                style={{ color: THEME.colors.accent.primary }}
              />
            </div>
            <p
              className="text-base font-semibold"
              style={{ color: THEME.colors.text.primary }}
            >
              {rooms.length > 0
                ? "No rooms match your filters"
                : "No voice rooms yet"}
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: THEME.colors.text.muted }}
            >
              {rooms.length > 0
                ? "Try a different keyword or clear the filters."
                : "Be the first to start a conversation."}
            </p>
            {rooms.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="mt-5 px-4 py-2 rounded-full text-sm font-medium border hover:bg-white/5"
                style={{
                  borderColor: THEME.colors.border.primary,
                  color: THEME.colors.text.secondary,
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredRooms.map((room, idx) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={() => onJoinRoom(room.id)}
              onView={() => (onViewRoom ?? onJoinRoom)(room.id)}
              currentUserId={user?.id}
              index={idx}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================
// 4. VOICE ROOM VIEW
// ============================================================

interface ChatAttachment {
  id: string;
  type: "image" | "video" | "audio" | "file" | "gif" | "sticker";
  url: string;
  name?: string;
}

type LocalVoiceMessage = VoiceMessage & {
  attachments?: ChatAttachment[];
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  isEdited?: boolean;
  isHighlighted?: boolean;
  reactions?: Record<string, string[]>;
  reactionTally?: Record<string, number>;
  senderName?: string;
  senderAvatar?: string;
  replyToId?: string;
};

type PanelKey =
  | "shortcuts"
  | "command"
  | "invite"
  | "details"
  | "journal"
  | "corrections"
  | "effects"
  | "quality"
  | "insights"
  | "cohost"
  | "coach"
  | "stats";

const PANEL_CLOSE_ORDER: PanelKey[] = [
  "shortcuts",
  "command",
  "invite",
  "details",
  "journal",
  "corrections",
  "effects",
  "quality",
  "insights",
  "cohost",
  "coach",
];

const INITIAL_PANELS: Record<PanelKey, boolean> = {
  shortcuts: false,
  command: false,
  invite: false,
  details: false,
  journal: false,
  corrections: false,
  effects: false,
  quality: false,
  insights: false,
  cohost: false,
  coach: false,
  stats: false,
};

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_STAGE_REACTIONS = 40;
const MAX_REACTIONS_PER_USER_PER_EMOJI_PER_WINDOW = 8;
const REACTION_FLOOD_WINDOW_MS = 4000;
const SEND_TIMEOUT_MS = 10_000;
const READY_FALLBACK_MS = 12_000;

const QUICK_REACTION_SLOTS = ["👏", "❤️", "🔥", "🎉", "😮", "🙌"] as const;

const AUDIO_LEVEL_SMOOTHING = 0.7;

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n) || 0));

function normalizeChatMessage(
  msg: any,
  currentUserId?: string,
): LocalVoiceMessage {
  const senderName =
    msg.senderName ||
    msg.sender?.name ||
    msg.user?.name ||
    (msg.senderId === currentUserId ? "You" : "Unknown User");

  const senderAvatar =
    msg.senderAvatar ||
    msg.sender?.avatarUrl ||
    msg.sender?.avatar ||
    msg.user?.avatarUrl;

  const reactions: Record<string, string[]> = {};

  if (Array.isArray(msg.reactions)) {
    for (const reaction of msg.reactions) {
      const emoji = reaction?.emoji;
      const userId =
        reaction?.userId || reaction?.user?.id || reaction?.user?.userId;
      if (emoji && userId)
        reactions[emoji] = [...(reactions[emoji] || []), String(userId)];
    }
    for (const emoji of Object.keys(reactions))
      reactions[emoji] = [...new Set(reactions[emoji])];
  } else if (msg.reactions && typeof msg.reactions === "object") {
    for (const [emoji, users] of Object.entries(msg.reactions)) {
      if (Array.isArray(users)) reactions[emoji] = users.map(String);
      else if (typeof users === "number")
        reactions[emoji] = Array.from({ length: users }, (_, i) => `anon-${i}`);
    }
  } else if (msg.reactionTally && typeof msg.reactionTally === "object") {
    for (const [emoji, count] of Object.entries(msg.reactionTally)) {
      reactions[emoji] = Array.from(
        { length: Number(count) || 0 },
        (_, i) => `anon-${i}`,
      );
    }
  }

  return {
    ...msg,
    senderName,
    senderAvatar,
    reactions,
    attachments: msg.attachments ?? attachmentsFor(msg),
    replyTo: msg.replyTo
      ? normalizeChatMessage(msg.replyTo, currentUserId)
      : undefined,
    status: msg.status || "sent",
  };
}

const ATTACHMENT_KIND_BY_TYPE: Record<string, ChatAttachment["type"]> = {
  IMAGE: "image",
  GIF: "gif",
  STICKER: "sticker",
  VIDEO: "video",
  AUDIO: "audio",
  VOICE_NOTE: "audio",
  FILE: "file",
};

/** The server stores one upload per message as mediaUrl / fileUrl plus a type */
function attachmentsFor(msg: any): ChatAttachment[] | undefined {
  if (msg.isDeleted) return undefined;
  const url = msg.mediaUrl || msg.fileUrl;
  if (!url) return undefined;
  const type = ATTACHMENT_KIND_BY_TYPE[String(msg.type || "").toUpperCase()] ?? "file";
  const lastSegment = String(url).split("?")[0].split("/").pop() || "";
  let fileName = lastSegment;
  try {
    fileName = decodeURIComponent(lastSegment);
  } catch {
    /* keep the raw segment */
  }
  return [{ id: `${msg.id}-attachment`, type, url, name: msg.content || fileName }];
}

const toggleReactionIn = (
  m: LocalVoiceMessage,
  emoji: string,
  userId: string,
): LocalVoiceMessage => {
  const reactions: Record<string, string[]> = {};
  if (m.reactions) {
    for (const [e, users] of Object.entries(m.reactions)) {
      reactions[e] = Array.isArray(users) ? [...users] : [];
    }
  } else if (m.reactionTally) {
    for (const [e, count] of Object.entries(m.reactionTally)) {
      reactions[e] = Array.from(
        { length: Number(count) || 0 },
        (_, i) => `anon-${i}`,
      );
    }
  }
  const users = new Set(reactions[emoji] || []);
  if (users.has(userId)) users.delete(userId);
  else users.add(userId);
  if (users.size > 0) reactions[emoji] = Array.from(users);
  else delete reactions[emoji];
  return { ...m, reactions, reactionTally: undefined };
};

const StatusScreen: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    className="relative h-screen flex items-center justify-center px-6 overflow-hidden"
    style={{ background: THEME.colors.background.primary }}
  >
    <AmbientBackdrop />
    {children}
  </div>
);

const ClapDock: React.FC<{
  size: "sm" | "md";
  onClap: () => void;
  showRemaining?: boolean;
  audioLevel?: number;
}> = ({ size, onClap, showRemaining = true, audioLevel = 0 }) => {
  const [streak, setStreak] = useState(0);

  return (
    <div
      className="pointer-events-auto relative rounded-full p-1.5"
      style={{
        background:
          "linear-gradient(180deg, rgba(24,24,42,0.9), rgba(14,14,26,0.9))",
        border: `1px solid rgba(129,140,248,0.28)`,
        backdropFilter: "blur(14px)",
        boxShadow:
          "0 20px 48px -18px rgba(129,140,248,0.55), 0 0 0 1px rgba(129,140,248,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(129,140,248,0.18), transparent 70%)",
        }}
      />
      {audioLevel > 0.05 && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 ${8 + audioLevel * 24}px ${audioLevel * 4}px rgba(129,140,248,${0.15 + audioLevel * 0.25})`,
          }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}
      <div className="relative flex items-center gap-1.5">
        <ClapButton
          onClap={onClap}
          onStreakChange={setStreak}
          size={size}
          maxClaps={100}
          cooldownMs={180}
          showRemaining={false}
        />
        <AnimatePresence>
          {streak >= 3 && (
            <motion.span
              key="streak"
              initial={{ opacity: 0, scale: 0.6, x: -4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.6, x: -4 }}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
              style={{
                background:
                  streak >= 5
                    ? `linear-gradient(135deg, ${THEME.colors.accent.warning}, #f97316)`
                    : "rgba(129,140,248,0.2)",
                color: "#fff",
              }}
            >
              {streak >= 5 ? `🔥 ${streak}` : `×${streak}`}
            </motion.span>
          )}
        </AnimatePresence>
        <span
          className="hidden sm:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-[9px] font-mono font-bold border"
          style={{
            borderColor: THEME.colors.border.primary,
            color: THEME.colors.text.muted,
            background: "rgba(255,255,255,0.03)",
          }}
          title="Press A to clap"
        >
          A
        </span>
      </div>
    </div>
  );
};

export const VoiceRoomView: React.FC<VoiceRoomViewProps> = ({
  roomId,
  onLeave,
  onMinimize,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userName = (user as any)?.name || "You";

  const [token, setToken] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinAttempt, setJoinAttempt] = useState(0);
  const [liveKitRoomId, setLiveKitRoomId] = useState("");
  const [ready, setReady] = useState(false);

  const [isDeafened, setIsDeafened] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showChat, setShowChat] = useState(true);
  const [messages, setMessages] = useState<LocalVoiceMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState<VoiceMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [handRaised, setHandRaised] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [roomDuration, setRoomDuration] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantFilter, setParticipantFilter] = useState<
    "all" | "online" | "speaking" | "raised"
  >("all");
  const [showParticipantSearch, setShowParticipantSearch] = useState(false);
  const [panels, setPanels] =
    useState<Record<PanelKey, boolean>>(INITIAL_PANELS);
  const [correctionTarget, setCorrectionTarget] = useState<{
    userId: string;
    userName: string;
    original: string;
  } | null>(null);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [favoriteParticipants, setFavoriteParticipants] = useState<Set<string>>(
    new Set(),
  );
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [stageReactions, setStageReactions] = useState<StageReaction[]>([]);

  const attachInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinInFlight = useRef(false);
  const uploadingRef = useRef(false);
  const pendingAttachmentRef = useRef<PendingAttachment | null>(null);
  const messagesRef = useRef<LocalVoiceMessage[]>([]);
  const reactionWindowRef = useRef<
    Map<string, { count: number; firstAt: number }>
  >(new Map());
  const smoothedAudioRef = useRef(0);
  const live = useRef({ showChat, isNearBottom, soundEnabled, panels });

  useEffect(() => {
    live.current = { showChat, isNearBottom, soundEnabled, panels };
  });
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    pendingAttachmentRef.current = pendingAttachment;
  }, [pendingAttachment]);

  const setPanel = useCallback((key: PanelKey, value: boolean) => {
    setPanels((p) => (p[key] === value ? p : { ...p, [key]: value }));
  }, []);
  const togglePanel = useCallback((key: PanelKey) => {
    setPanels((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const { data: room, isLoading, refetch } = useVoiceRoom(roomId);
  const { data: initialMessages } = useRoomMessages(roomId);
  const sendMessageMutation = useSendVoiceMessage();
  const deleteMessageMutation = useDeleteVoiceMessage();
  const editMessageMutation = useEditVoiceMessage();
  const reactMessageMutation = useReactToVoiceMessage();
  const pinMessageMutation = usePinVoiceMessage();
  const leaveRoomMutation = useLeaveVoiceRoom();

  const { data: cachedMessages } = useQuery<VoiceMessage[]>({
    queryKey: ["voice-messages", roomId],
    enabled: false,
  });

  const {
    socket,
    isConnected,
    participants: wsParticipants,
    hostId,
    sendChatMessage,
    sendTyping,
    raiseHand,
    kickUser,
    muteUser,
    unmuteUser,
    promoteHost,
    inviteToStage,
    moveToAudience,
    broadcastSpeaking,
    sendStageReaction,
  } = useVoiceSocket(roomId, user?.id || "");

  const liveKitRoomIdFromRoom = room?.liveKitRoomId || "";
  const shouldConnect = Boolean(
    token && (liveKitRoomId || liveKitRoomIdFromRoom),
  );

  const liveKitOptions = useMemo(
    () => ({
      onAudioLevel: (level: number) => {
        smoothedAudioRef.current =
          smoothedAudioRef.current * AUDIO_LEVEL_SMOOTHING +
          level * (1 - AUDIO_LEVEL_SMOOTHING);
        setAudioLevel(smoothedAudioRef.current);
      },
      onSpeakingStatusChange: (userId: string, isSpeaking: boolean) => {
        if (userId === user?.id) broadcastSpeaking(isSpeaking);
      },
    }),
    [user?.id, broadcastSpeaking],
  );

  const liveKitResult = useLiveKitRoom(
    shouldConnect ? liveKitRoomId || liveKitRoomIdFromRoom || "" : "",
    shouldConnect ? token : null,
    liveKitOptions,
  );

  const {
    isConnected: isLiveKitConnected,
    participants: livekitParticipants = [],
    participantVoiceStates = {},
    isMuted,
    canPublish,
    toggleMute,
    isMockMode,
    isConnecting,
    connectionState,
    reconnectNow,
    error: liveKitError,
  } = liveKitResult;

  /** Audio or the room socket dropped after we had been connected */
  const isReconnecting =
    connectionState === "reconnecting" ||
    (connectionState === "connected" && !isConnected);
  const connectionLost = connectionState === "disconnected" && Boolean(liveKitError);

  const isStageRoom = room?.type === "STAGE";
  /** Listening-only member of a stage room (LiveKit is the source of truth for mic rights) */
  const isAudience = isStageRoom && isLiveKitConnected && !canPublish;

  useRemoteAudioOutput({ volume, deafened: isDeafened });
  useRoomDocumentTitle(room?.name, unreadCount);

  const connectionQuality: "excellent" | "good" | "poor" = isMockMode
    ? "poor"
    : isLiveKitConnected && isConnected
      ? "excellent"
      : isLiveKitConnected
        ? "good"
        : "poor";

  const { transcriptions } = useVoiceTranscription({
    roomId,
    userId: user?.id || "",
    userName,
    isMuted,
    socket,
    isConnected,
    language: "en-US",
  });

  const allParticipants = useMemo<RoomParticipant[]>(() => {
    const map = new Map<string, RoomParticipant>();

    (wsParticipants || []).forEach((p: any) => {
      map.set(p.userId, {
        id: p.userId,
        userId: p.userId,
        name: p.name || p.user?.name || "Anonymous",
        avatarUrl: p.avatarUrl || p.user?.avatarUrl,
        country: p.country || p.user?.country,
        nativeLanguage: p.nativeLanguage || p.user?.nativeLanguage,
        learningLanguage: p.learningLanguage || p.user?.learningLanguage,
        level: p.level || p.user?.level,
        bio: p.bio || p.user?.bio,
        interests: p.interests || p.user?.interests,
        isOnline: !p.isReconnecting,
        isReconnecting: Boolean(p.isReconnecting),
        isSpeaking: Boolean(p.isSpeaking) && !p.isMuted,
        isMuted: Boolean(p.isMuted),
        raisedHand: p.raisedHand || false,
        joinedAt: p.joinedAt || new Date().toISOString(),
        role: p.role || "MEMBER",
        isListening: true,
        audioLevel: Number(p.audioLevel || 0),
        isVerified: p.isVerified || p.user?.isVerified,
        isPremium: p.isPremium || p.user?.isPremium,
      });
    });

    (room?.participants || []).forEach((p: any) => {
      if (map.has(p.userId)) return;
      map.set(p.userId, {
        id: p.userId,
        userId: p.userId,
        name: p.user?.name || "Anonymous",
        avatarUrl: p.user?.avatarUrl,
        country: p.user?.country,
        nativeLanguage: p.user?.nativeLanguage,
        learningLanguage: p.user?.learningLanguage,
        level: p.user?.level,
        isOnline: false,
        isSpeaking: Boolean(p.isSpeaking) && !p.isMuted,
        isMuted: Boolean(p.isMuted),
        raisedHand: p.raisedHand || false,
        joinedAt: p.joinedAt || new Date().toISOString(),
        role: p.role || "MEMBER",
        isListening: false,
        audioLevel: 0,
        isVerified: p.user?.isVerified,
        isPremium: p.user?.isPremium,
      });
    });

    livekitParticipants?.forEach((p: any) => {
      const identity = String(
        p.identity ?? p.userId ?? p.sid ?? p.participantIdentity ?? "",
      );
      let metadataUserId: string | undefined;
      try {
        const metadata =
          typeof p.metadata === "string" ? JSON.parse(p.metadata) : p.metadata;
        metadataUserId = metadata?.userId || metadata?.user?.id;
      } catch {
        metadataUserId = undefined;
      }

      const participant = [
        identity,
        metadataUserId ? String(metadataUserId) : "",
      ]
        .filter(Boolean)
        .map((id) => map.get(id))
        .find(Boolean);
      if (!participant) return;

      const voiceState =
        participantVoiceStates?.[identity] ||
        participantVoiceStates?.[participant.id] ||
        (metadataUserId
          ? participantVoiceStates?.[String(metadataUserId)]
          : undefined);

      const speaking = Boolean(voiceState?.isSpeaking ?? p.isSpeaking);
      const muted = Boolean(
        voiceState?.isMuted ?? p.isMuted ?? participant.isMuted,
      );
      const level = Number(
        voiceState?.audioLevel ?? p.audioLevel ?? participant.audioLevel ?? 0,
      );

      participant.isOnline = true;
      participant.isMuted = muted;
      participant.isSpeaking = speaking && !muted;
      participant.audioLevel = participant.isSpeaking ? clamp01(level) : 0;
    });

    const me = map.get(user?.id || "");
    if (me) {
      me.isOnline = isConnected || isLiveKitConnected;
      me.isListening = me.isOnline;
      me.isSpeaking = !isMuted && Number(audioLevel || 0) > 0.08;
      me.audioLevel = clamp01(audioLevel);
      me.isMuted = isMuted;
    }

    return Array.from(map.values());
  }, [
    wsParticipants,
    room?.participants,
    livekitParticipants,
    participantVoiceStates,
    user?.id,
    audioLevel,
    isMuted,
    isConnected,
    isLiveKitConnected,
  ]);

  const speakingTimes = useSpeakingTimes(allParticipants);
  const speakingCount = allParticipants.filter((p) => p.isSpeaking).length;
  const totalParticipants = allParticipants.length;
  const onlineCount = allParticipants.filter((p) => p.isOnline === true).length;
  const me = allParticipants.find((p) => p.userId === user?.id);
  const isHost = hostId === user?.id || room?.creatorId === user?.id;
  const isModerator = isHost || me?.role === "MODERATOR" || me?.role === "HOST";

  useEffect(() => {
    if (me) setHandRaised(Boolean(me.raisedHand));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.raisedHand]);

  // Effects run as a LiveKit processor on the published mic, so the whole room hears them
  const voiceEffects = useVoiceEffects({
    localTrack: liveKitResult.localTrack,
  });

  const journal = usePracticeJournal({ userId: user?.id || "" });

  const corrections = useVoiceCorrections({
    roomId,
    userId: user?.id || "",
    userName,
    socket,
    isConnected,
    onAccepted: (c) => {
      journal.addEntry({
        original: c.original,
        corrected: c.corrected,
        note: c.note,
        category: c.category,
        sourceRoomName: room?.name,
        sourceRoomId: roomId,
        helperName: c.authorName,
      });
      toast.success(`✨ Saved to journal: ${c.corrected}`);
    },
  });

  // Private fluency coach, secret-word missions, airtime balance and topic spotlights
  const coach = useRoomCoach({
    roomId,
    userId: user?.id || "",
    socket,
    isConnected,
  });

  const openCorrectionSheet = useCallback(
    (targetUserId: string, targetUserName: string) => {
      const original = transcriptions
        .filter((t) => t.userId === targetUserId && t.isFinal)
        .slice(-3)
        .map((t) => t.text)
        .join(" ");
      setCorrectionTarget({
        userId: targetUserId,
        userName: targetUserName,
        original,
      });
    },
    [transcriptions],
  );

  const aiCoHost = useAICoHost({
    enabled: isModerator,
    roomName: room?.name || "",
    transcriptions,
    participantCount: totalParticipants,
    roomDurationSec: roomDuration,
    messagesCount: messages.length,
  });

  const handleToggleMute = useCallback(async () => {
    try {
      const muted = await toggleMute();
      if (socket && isConnected)
        socket.emit("voice:mute-self", { roomId, muted });
    } catch {
      toast.error(
        "Couldn't change your microphone. Check browser permissions.",
      );
    }
  }, [toggleMute, socket, isConnected, roomId]);

  const handleToggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      toast.info(!prev ? "Deafened — room audio muted" : "Audio restored");
      return !prev;
    });
  }, []);

  const handleToggleRaiseHand = useCallback(
    (raised?: boolean) => {
      const next = typeof raised === "boolean" ? raised : !handRaised;
      setHandRaised(next);
      raiseHand(next);
      toast[next ? "success" : "info"](
        next ? "✋ Hand raised — waiting for the host" : "Hand lowered",
      );
    },
    [handRaised, raiseHand],
  );

  const handleLeave = useCallback(() => setShowLeaveConfirm(true), []);

  const handleConfirmLeave = useCallback(async () => {
    try {
      await leaveRoomMutation.mutateAsync(roomId);
      socket?.emit("voice:leave", { roomId, userId: user?.id });
      toast.success("Left room");
      onLeave();
    } catch {
      toast.error("Failed to leave room");
    }
  }, [leaveRoomMutation, roomId, socket, user?.id, onLeave]);

  const handleEndRoom = useCallback(async () => {
    if (!roomId) return;
    if (!window.confirm("End this room for everyone? This cannot be undone."))
      return;
    try {
      await voiceApi.endRoom(roomId);
      socket?.emit("voice:leave", { roomId, userId: user?.id });
      toast.success("Room ended");
      onLeave();
    } catch {
      toast.error("Failed to end room");
    }
  }, [roomId, socket, user?.id, onLeave]);

  const handleStartRecording = useCallback(async () => {
    try {
      await voiceApi.startRecording(roomId);
      setIsRecording(true);
      toast.success("Recording started");
      refetch();
    } catch {
      toast.error("Failed to start recording");
    }
  }, [roomId, refetch]);

  const handleStopRecording = useCallback(async () => {
    try {
      await voiceApi.stopRecording(roomId);
      setIsRecording(false);
      toast.success("Recording stopped");
      refetch();
    } catch {
      toast.error("Failed to stop recording");
    }
  }, [roomId, refetch]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Room link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  }, []);

  /** The server grants their mic through LiveKit; they unmute themselves when ready */
  const handleQueuePromote = useCallback(
    (userId: string) => inviteToStage(userId),
    [inviteToStage],
  );

  const handleLeaveStage = useCallback(() => {
    if (user?.id) moveToAudience(user.id);
  }, [moveToAudience, user?.id]);

  const handleQueueRemove = useCallback(
    (userId: string) => {
      socket?.emit?.("voice:lower-hand", { roomId, userId });
    },
    [socket, roomId],
  );

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setHasNewMessages(false);
      setNewMessageCount(0);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    window.setTimeout(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  /** Adds an optimistic message and sends it over the socket (or REST as a fallback) */
  const dispatchChatMessage = useCallback(
    (content: string, reply: typeof replyTo) => {
    if (!content || !user?.id) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const messageData: { content: string; type: string; replyToId?: string } = {
      content,
      type: "TEXT",
      // A reply to a message that is still sending has no server id yet
      ...(reply?.id && !reply.id.startsWith("temp-")
        ? { replyToId: reply.id }
        : {}),
    };

    setMessages((prev) => [
      ...prev,
      normalizeChatMessage(
        {
          id: tempId,
          content,
          senderId: user.id,
          sender: {
            id: user.id,
            name: userName,
            avatarUrl: (user as any).avatarUrl,
          },
          senderName: userName,
          senderAvatar: (user as any).avatarUrl,
          createdAt: new Date().toISOString(),
          isPinned: false,
          isDeleted: false,
          replyTo: reply || undefined,
          replyToId: reply?.id,
          status: "sending",
          reactions: {},
        },
        user.id,
      ),
    ]);

    if (socket && isConnected) {
      // The server echoes clientId so the saved message replaces this exact bubble
      sendChatMessage({ ...messageData, clientId: tempId });
      window.setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId && m.status === "sending"
              ? { ...m, status: "failed" as const }
              : m,
          ),
        );
      }, SEND_TIMEOUT_MS);
    } else {
      sendMessageMutation.mutate(
        { roomId, ...messageData },
        {
          onSuccess: (res: any) => {
            const real = res?.data || res;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId
                  ? normalizeChatMessage(
                      { ...(real || m), status: "sent" },
                      user.id,
                    )
                  : m,
              ),
            );
            queryClient.invalidateQueries({
              queryKey: ["voice-messages", roomId],
            });
          },
          onError: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId ? { ...m, status: "failed" as const } : m,
              ),
            );
            toast.error("Failed to send message");
          },
        },
      );
    }

    scrollToBottom();
  },
    [
      socket,
      isConnected,
      sendChatMessage,
      sendMessageMutation,
      roomId,
      user,
      userName,
      queryClient,
      scrollToBottom,
    ],
  );

  const handleSendMessage = useCallback(() => {
    const content = newMessage.trim();
    if (!content || !user?.id) return;

    dispatchChatMessage(content, replyTo);

    setNewMessage("");
    setReplyTo(null);
    sendTyping(false);
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
  }, [newMessage, replyTo, user?.id, dispatchChatMessage, sendTyping]);

  /** Drops the failed copy and sends the same text (and reply target) again */
  const handleRetryMessage = useCallback(
    (failed: { id: string; content: string; replyTo?: unknown }) => {
      setMessages((prev) => prev.filter((m) => m.id !== failed.id));
      dispatchChatMessage(
        failed.content.trim(),
        (failed.replyTo as typeof replyTo) ?? null,
      );
    },
    [dispatchChatMessage],
  );

  const handleComposerChange = useCallback(
    (text: string) => {
      setNewMessage(text);
      if (!user?.id) return;
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      if (text.trim()) {
        sendTyping(true);
        typingStopTimerRef.current = setTimeout(() => {
          sendTyping(false);
          typingStopTimerRef.current = null;
        }, 1400);
      } else {
        sendTyping(false);
      }
    },
    [sendTyping, user?.id],
  );

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!roomId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: newContent, isEdited: true }
            : m,
        ),
      );
      // REST saves it and the server broadcasts voice:message-edited to the room
      editMessageMutation.mutate(
        { roomId, messageId, content: newContent },
        {
          onError: () => {
            queryClient.invalidateQueries({
              queryKey: ["voice-messages", roomId],
            });
          },
        },
      );
    },
    [roomId, editMessageMutation, queryClient],
  );

  const handleMessageReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!user?.id || !roomId) return;
      const uid = user.id;
      const flip = (list: LocalVoiceMessage[]) =>
        list.map((m) =>
          m.id === messageId ? toggleReactionIn(m, emoji, uid) : m,
        );

      setMessages(flip);
      // One toggle per tap: REST saves it and the server broadcasts the full reaction map.
      // (Also emitting over the socket used to toggle it a second time, undoing the reaction.)
      reactMessageMutation.mutate(
        { roomId, messageId, emoji, userId: uid },
        { onError: () => setMessages(flip) },
      );
    },
    [user?.id, roomId, reactMessageMutation],
  );

  const handlePinMessage = useCallback(
    (messageId: string, pinned: boolean) => {
      if (!roomId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned: pinned } : m)),
      );
      pinMessageMutation.mutate(
        { roomId, messageId, pinned },
        {
          onSuccess: () => toast.success(pinned ? "Pinned for everyone" : "Unpinned"),
          onError: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId ? { ...m, isPinned: !pinned } : m,
              ),
            );
          },
        },
      );
    },
    [roomId, pinMessageMutation],
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!roomId) return;
      // A failed send never reached the server, so it is just dropped locally
      if (messageId.startsWith("temp-")) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        return;
      }
      const before = messagesRef.current.find((m) => m.id === messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, isPinned: false } : m,
        ),
      );
      deleteMessageMutation.mutate(
        { roomId, messageId },
        {
          onError: () => {
            if (!before) return;
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? before : m)),
            );
          },
        },
      );
    },
    [roomId, deleteMessageMutation],
  );

  const handleTranslateMessage = useCallback(
    async (messageId: string) => {
      const res = await voiceApi.translateRoomMessage(roomId, messageId);
      return res.data.data;
    },
    [roomId],
  );

  const handleReportMessage = useCallback(
    async (messageId: string, reason: string, details?: string) => {
      const res = await voiceApi.reportRoomMessage(
        roomId,
        messageId,
        reason,
        details,
      );
      return { alreadyReported: Boolean(res.data?.data?.alreadyReported) };
    },
    [roomId],
  );

  /** Opens the correction sheet prefilled with a chat message instead of speech */
  const handleSuggestChatCorrection = useCallback(
    (message: { senderId: string; senderName?: string; content: string }) => {
      setCorrectionTarget({
        userId: message.senderId,
        userName: message.senderName || "Someone",
        original: message.content,
      });
    },
    [],
  );

  // ---- Older history: loaded a page at a time when the reader scrolls to the top ----
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const loadingHistoryRef = useRef(false);
  const handleLoadOlderMessages = useCallback(async () => {
    if (!roomId || loadingHistoryRef.current) return false;
    const oldest = messagesRef.current.find((m) => !m.id.startsWith("temp-"));
    if (!oldest) {
      setHasMoreHistory(false);
      return false;
    }
    loadingHistoryRef.current = true;
    try {
      const res = await voiceApi.getRoomMessages(roomId, 50, oldest.id);
      const page = Array.isArray(res.data) ? res.data : [];
      if (page.length < 50) setHasMoreHistory(false);
      if (page.length) {
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          const older = page
            .filter((m) => !known.has(m.id))
            .map((m) => normalizeChatMessage({ ...m, status: "sent" }, user?.id));
          return older.length ? [...older, ...prev] : prev;
        });
      }
      return page.length > 0;
    } catch {
      toast.error("Couldn't load older messages");
      return false;
    } finally {
      loadingHistoryRef.current = false;
    }
  }, [roomId, user?.id]);

  const openAttachmentPreview = useCallback((file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("File exceeds 50MB limit");
      return;
    }
    let kind: PendingAttachment["kind"] = "file";
    if (file.type.startsWith("image/")) kind = "image";
    else if (file.type.startsWith("video/")) kind = "video";
    else if (file.type.startsWith("audio/")) kind = "audio";

    const previewUrl = kind === "file" ? null : URL.createObjectURL(file);
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, kind, previewUrl };
    });
    setShowAttachmentPreview(true);
  }, []);

  const handleAttachClick = useCallback(
    () => attachInputRef.current?.click(),
    [],
  );

  const handleAttachFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) openAttachmentPreview(file);
    },
    [openAttachmentPreview],
  );

  const handleCancelAttachment = useCallback(() => {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setShowAttachmentPreview(false);
  }, []);

  const handleConfirmAttachmentSend = useCallback(
    async (caption: string) => {
      const pending = pendingAttachment;
      if (!pending || !user?.id || !roomId || uploadingRef.current) return;

      uploadingRef.current = true;
      const toastId = toast.loading(`Uploading ${pending.file.name}…`);
      try {
        const { uploadToCloudinary, kindToMessageType } =
          await import("../../lib/uploadToCloudinary");
        const result = await uploadToCloudinary(pending.file);

        const payload = {
          content: caption || pending.file.name,
          type: kindToMessageType(result.kind),
          mediaUrl: result.url,
          fileUrl: result.url,
          replyToId: replyTo?.id,
        };

        if (socket && isConnected) sendChatMessage(payload);
        else sendMessageMutation.mutate({ roomId, ...payload });

        handleCancelAttachment();
        setReplyTo(null);
        toast.success("Sent", { id: toastId });
        scrollToBottom();
      } catch (err: any) {
        toast.error(err?.message || "Upload failed — please try again", {
          id: toastId,
        });
      } finally {
        uploadingRef.current = false;
      }
    },
    [
      pendingAttachment,
      user?.id,
      roomId,
      replyTo,
      socket,
      isConnected,
      sendChatMessage,
      sendMessageMutation,
      handleCancelAttachment,
      scrollToBottom,
    ],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (!file) return;
      e.preventDefault();
      openAttachmentPreview(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [openAttachmentPreview]);

  useEffect(
    () => () => {
      const url = pendingAttachmentRef.current?.previewUrl;
      if (url) URL.revokeObjectURL(url);
    },
    [],
  );

  const pushStageReaction = useCallback(
    (
      r: Omit<StageReaction, "xPercent" | "createdAt"> & { createdAt?: number },
    ) => {
      setStageReactions((prev) => {
        if (prev.some((p) => p.id === r.id)) return prev;
        return [
          ...prev,
          {
            ...r,
            xPercent: 12 + Math.random() * 76,
            createdAt: r.createdAt ?? Date.now(),
          } as StageReaction,
        ].slice(-MAX_STAGE_REACTIONS);
      });
    },
    [],
  );

  useEffect(() => {
    if (!socket) return;
    const onReaction = (data: {
      id?: string;
      userId: string;
      userName?: string;
      emoji: string;
      createdAt?: number;
    }) => {
      pushStageReaction({
        id:
          data.id ||
          `${data.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        emoji: data.emoji,
        userId: data.userId,
        userName: data.userName,
        createdAt: data.createdAt,
      });
    };
    socket.on("voice:stage-reaction", onReaction);
    return () => {
      socket.off("voice:stage-reaction", onReaction);
    };
  }, [socket, pushStageReaction]);

  const hasReactions = stageReactions.length > 0;
  useEffect(() => {
    if (!hasReactions) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setStageReactions((prev) => {
        const next = prev.filter((r) => now - r.createdAt < 3600);
        return next.length === prev.length ? prev : next;
      });
    }, 600);
    return () => window.clearInterval(id);
  }, [hasReactions]);

  const handleSendStageReaction = useCallback(
    (
      emoji: string,
      options: { local?: boolean; broadcast?: boolean } = {},
    ) => {
      const { local = true, broadcast = true } = options;
      const uid = user?.id || "me";
      const now = Date.now();
      const win = reactionWindowRef.current;
      const floodKey = `${uid}:${emoji}`;
      const entry = win.get(floodKey) || { count: 0, firstAt: now };

      if (now - entry.firstAt > REACTION_FLOOD_WINDOW_MS) {
        entry.count = 0;
        entry.firstAt = now;
      }
      if (entry.count >= MAX_REACTIONS_PER_USER_PER_EMOJI_PER_WINDOW) {
        toast.warning("Slow down — too many reactions in a row", {
          duration: 1500,
        });
        return;
      }
      entry.count += 1;
      win.set(floodKey, entry);

      if (local) {
        pushStageReaction({
          id: `local-${now}-${Math.random().toString(36).slice(2)}`,
          emoji,
          userId: uid,
          userName: (user as any)?.name,
        });
      }
      if (broadcast) {
        sendStageReaction(emoji);
      }
    },
    [sendStageReaction, user, pushStageReaction],
  );

  const handleQuickReaction = useCallback(
    (slot: number) => {
      const emoji = QUICK_REACTION_SLOTS[slot - 1];
      if (emoji) handleSendStageReaction(emoji, { local: true });
    },
    [handleSendStageReaction],
  );

  const handleClap = useCallback(() => {
    handleSendStageReaction("👏", { local: false, broadcast: true });
  }, [handleSendStageReaction]);

  useEffect(() => {
    if (!roomId || !user?.id || token || joinInFlight.current) return;
    joinInFlight.current = true;
    let cancelled = false;

    (async () => {
      try {
        setIsJoining(true);
        setJoinError(null);
        const response = await voiceApi.joinRoom(roomId);
        const raw = response.data as any;
        const extractedToken =
          raw?.data?.token || raw?.token || raw?.data?.data?.token;
        const extractedRoomId =
          raw?.data?.liveKitRoomId || raw?.liveKitRoomId || roomId;
        if (!extractedToken) throw new Error("No token returned from server");
        if (cancelled) return;
        setToken(extractedToken);
        setLiveKitRoomId(extractedRoomId);
        toast.success("Connected to voice");
      } catch (error: any) {
        if (cancelled) return;
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Failed to join room";
        setJoinError(message);
        toast.error(message);
      } finally {
        joinInFlight.current = false;
        if (!cancelled) setIsJoining(false);
      }
    })();

    return () => {
      cancelled = true;
      joinInFlight.current = false;
    };
  }, [roomId, user?.id, token, joinAttempt]);

  useEffect(() => {
    if (ready || !token || !room) return;
    if (isLiveKitConnected || isMockMode) {
      setReady(true);
      return;
    }
    const id = window.setTimeout(() => setReady(true), READY_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [ready, token, room, isLiveKitConnected, isMockMode]);

  useEffect(() => {
    const source = cachedMessages ?? initialMessages;
    if (!source) return;

    setMessages((prev) => {
      const prevById = new Map(prev.map((m) => [m.id, m]));
      const sourceIds = new Set(source.map((m) => m.id));

      const merged = [...source]
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .map((msg) => {
          const prior = prevById.get(msg.id);
          const normalized = normalizeChatMessage(
            { ...msg, status: "sent" as const },
            user?.id,
          );
          const incomingHas =
            normalized.reactions &&
            Object.keys(normalized.reactions).length > 0;
          const priorHas =
            prior?.reactions && Object.keys(prior.reactions).length > 0;
          return !incomingHas && priorHas
            ? { ...normalized, reactions: prior!.reactions }
            : normalized;
        });

      const pending = prev.filter(
        (m) => m.id.startsWith("temp-") && !sourceIds.has(m.id),
      );
      // Pages loaded with "older messages" sit before the cached window; keep them
      const oldestCached = merged.length
        ? new Date(merged[0].createdAt).getTime()
        : Infinity;
      const history = prev.filter(
        (m) =>
          !m.id.startsWith("temp-") &&
          !sourceIds.has(m.id) &&
          new Date(m.createdAt).getTime() < oldestCached,
      );
      const withHistory = history.length ? [...history, ...merged] : merged;
      return pending.length ? [...withHistory, ...pending] : withHistory;
    });
  }, [cachedMessages, initialMessages, user?.id]);

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (raw: any) => {
      const message = normalizeChatMessage(
        { ...raw, status: "sent" as const },
        user?.id,
      );
      if (messagesRef.current.some((m) => m.id === message.id)) return;

      const isOwn = message.senderId === user?.id;

      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        if (isOwn) {
          // Match the optimistic bubble by the echoed clientId; content is the fallback
          const byClientId = raw?.clientId
            ? prev.findIndex((m) => m.id === raw.clientId)
            : -1;
          const i =
            byClientId !== -1
              ? byClientId
              : prev.findIndex(
                  (m) =>
                    m.id.startsWith("temp-") &&
                    m.status !== "failed" &&
                    m.senderId === message.senderId &&
                    m.content === message.content,
                );
          if (i !== -1) {
            const next = [...prev];
            next[i] = message;
            return next;
          }
        }
        return [...prev, message];
      });

      const {
        showChat: chatOpen,
        isNearBottom: nearBottom,
        soundEnabled: sound,
      } = live.current;
      if (!isOwn) {
        if (!chatOpen) setUnreadCount((c) => c + 1);
        if (sound && (document.hidden || !chatOpen)) playNotificationBeep();
      }

      if (isOwn || (chatOpen && nearBottom)) {
        scrollToBottom();
      } else if (chatOpen) {
        setHasNewMessages(true);
        setNewMessageCount((c) => c + 1);
      }
    };

    const onTypingStart = (data: { userId: string }) => {
      if (data.userId !== user?.id)
        setTypingUsers((prev) => new Set(prev).add(data.userId));
    };
    const onTypingStop = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    // The server rejected one of our sends (not in room, too long…): fail that bubble now
    const onChatError = (data: { clientId?: string; message?: string }) => {
      if (data?.clientId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.clientId ? { ...m, status: "failed" as const } : m,
          ),
        );
      }
      toast.error(data?.message || "Message not sent");
    };

    socket.on("voice:chat", onNewMessage);
    socket.on("voice:chat-error", onChatError);
    socket.on("voice:typing-start", onTypingStart);
    socket.on("voice:typing-stop", onTypingStop);
    return () => {
      socket.off("voice:chat", onNewMessage);
      socket.off("voice:chat-error", onChatError);
      socket.off("voice:typing-start", onTypingStart);
      socket.off("voice:typing-stop", onTypingStop);
    };
  }, [socket, user?.id, scrollToBottom]);

  useEffect(() => {
    if (!showChat) return;
    setUnreadCount(0);
    setHasNewMessages(false);
    setNewMessageCount(0);
  }, [showChat]);

  useEffect(() => {
    if (!room?.startedAt) return;
    const start = new Date(room.startedAt).getTime();
    const tick = () =>
      setRoomDuration(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [room?.startedAt]);

  useEffect(
    () => () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    },
    [],
  );

  const handleEscape = useCallback((): boolean => {
    if (pendingAttachmentRef.current && showAttachmentPreview) {
      handleCancelAttachment();
      return true;
    }
    if (showLeaveConfirm) {
      setShowLeaveConfirm(false);
      return true;
    }
    if (correctionTarget) {
      setCorrectionTarget(null);
      return true;
    }
    const open = PANEL_CLOSE_ORDER.find((k) => live.current.panels[k]);
    if (open) {
      setPanel(open, false);
      return true;
    }
    if (live.current.showChat) {
      setShowChat(false);
      return true;
    }
    return false;
  }, [
    showAttachmentPreview,
    showLeaveConfirm,
    correctionTarget,
    handleCancelAttachment,
    setPanel,
  ]);

  useRoomHotkeys({
    onToggleMute: handleToggleMute,
    onToggleDeafen: handleToggleDeafen,
    onToggleHand: () => handleToggleRaiseHand(),
    onToggleChat: () => setShowChat((v) => !v),
    onShowShortcuts: () => togglePanel("shortcuts"),
    onEscape: handleEscape,
    onSend: handleSendMessage,
    onQuickReaction: handleQuickReaction,
    onClap: handleClap,
    composerRef: textareaRef,
  });

  const chatPanelMessages = messages;
  const languages = useMemo(
    () =>
      Array.from(
        new Set(
          allParticipants
            .flatMap((p) => [p.nativeLanguage, p.learningLanguage])
            .filter((lang): lang is string => Boolean(lang)),
        ),
      ),
    [allParticipants],
  );

  const participantNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of allParticipants) if (p.userId && p.name) map[p.userId] = p.name;
    return map;
  }, [allParticipants]);

  const queueParticipants = useMemo(
    () =>
      allParticipants.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isVerified: p.isVerified,
        isPremium: p.isPremium,
        raisedHand: !!p.raisedHand,
        raisedHandAt: (p as any).raisedHandAt,
        isSpeaking: p.isSpeaking,
        isMuted: p.isMuted,
      })),
    [allParticipants],
  );

  // ============================================================
  // RENDER — error / loading / not found
  // ============================================================
  if (joinError && !token && !isJoining) {
    return (
      <StatusScreen>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          role="alert"
          className="relative w-full max-w-sm rounded-3xl p-7 text-center"
          style={{
            background:
              "linear-gradient(180deg, rgba(24,24,42,0.92), rgba(14,14,26,0.92))",
            border: `1px solid ${THEME.colors.border.primary}`,
            boxShadow:
              "0 40px 100px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div
            className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.28)",
              boxShadow: "0 12px 32px -12px rgba(251,191,36,0.5)",
            }}
          >
            <WifiOff
              className="w-8 h-8"
              style={{ color: THEME.colors.accent.warning }}
            />
          </div>
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ color: THEME.colors.text.primary }}
          >
            Couldn't connect to voice
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: THEME.colors.text.muted }}
          >
            {joinError}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onLeave}
              className="flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-all hover:bg-white/5"
              style={{
                borderColor: THEME.colors.border.primary,
                color: THEME.colors.text.secondary,
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setJoinAttempt((n) => n + 1)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
              style={{
                background: THEME.colors.gradient.primary,
                boxShadow: "0 14px 32px -12px rgba(129,140,248,0.8)",
              }}
            >
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
          </div>
        </motion.div>
      </StatusScreen>
    );
  }

  if (!ready) {
    const label = isJoining
      ? "Joining the conversation"
      : isConnecting
        ? "Connecting to voice"
        : isLoading
          ? "Loading room"
          : !token
            ? "Waiting for voice connection"
            : "Setting up audio";

    if (!isLoading && !room && !isJoining && token) {
      // fall through to not-found below
    } else {
      return (
        <StatusScreen>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative text-center"
            role="status"
            aria-live="polite"
          >
            <div className="relative w-24 h-24 mx-auto mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0%, ${THEME.colors.accent.primary} 40%, ${THEME.colors.accent.secondary} 60%, transparent 100%)`,
                  maskImage:
                    "radial-gradient(circle, transparent 62%, black 63%)",
                  WebkitMaskImage:
                    "radial-gradient(circle, transparent 62%, black 63%)",
                }}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-2 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0%, ${THEME.colors.accent.tertiary} 60%, transparent 100%)`,
                  maskImage:
                    "radial-gradient(circle, transparent 65%, black 66%)",
                  WebkitMaskImage:
                    "radial-gradient(circle, transparent 65%, black 66%)",
                  opacity: 0.7,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{
                    background: THEME.colors.gradient.primary,
                    boxShadow: "0 12px 32px -8px rgba(129,140,248,0.9)",
                  }}
                >
                  <Mic className="w-5 h-5 text-white" />
                </motion.div>
              </div>
            </div>
            <p
              className="text-sm font-medium tracking-wide"
              style={{ color: THEME.colors.text.secondary }}
            >
              {label}…
            </p>
            <button
              type="button"
              onClick={onLeave}
              className="mt-5 text-xs underline-offset-4 hover:underline"
              style={{ color: THEME.colors.text.muted }}
            >
              Cancel
            </button>
          </motion.div>
        </StatusScreen>
      );
    }
  }

  if (!room) {
    return (
      <StatusScreen>
        <div className="relative text-center max-w-sm">
          <div
            className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${THEME.colors.border.primary}`,
            }}
          >
            <AlertCircle
              className="w-8 h-8"
              style={{ color: THEME.colors.text.muted }}
            />
          </div>
          <h2
            className="text-2xl font-bold mb-2 tracking-tight"
            style={{ color: THEME.colors.text.primary }}
          >
            Room Not Found
          </h2>
          <p
            className="text-sm mb-6 leading-relaxed"
            style={{ color: THEME.colors.text.muted }}
          >
            This room may have ended or the link is incorrect.
          </p>
          <button
            type="button"
            onClick={onLeave}
            className="px-6 py-3 rounded-full font-semibold text-sm text-white transition-transform hover:scale-[1.03] active:scale-95"
            style={{
              background: THEME.colors.gradient.primary,
              boxShadow: "0 14px 32px -12px rgba(129,140,248,0.8)",
            }}
          >
            Back to Rooms
          </button>
        </div>
      </StatusScreen>
    );
  }

  // ============================================================
  // RENDER — MAIN
  // ============================================================
  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: THEME.colors.background.primary }}
    >
      <AmbientBackdrop subtle />

      <VoiceRoomHeader
        room={room}
        isHost={isHost}
        isLiveKitConnected={isLiveKitConnected}
        isMockMode={isMockMode}
        totalParticipants={totalParticipants}
        speakingCount={speakingCount}
        onlineCount={onlineCount}
        showChat={showChat}
        unreadCount={unreadCount}
        isConnected={isConnected}
        onToggleChat={() => setShowChat((v) => !v)}
        onToggleCommandCenter={() => togglePanel("command")}
        onShowDetails={() => setPanel("details", true)}
        onShowShortcuts={() => setPanel("shortcuts", true)}
        onMinimize={onMinimize}
        onShare={() => setPanel("invite", true)}
        onLeave={handleLeave}
        onEndRoom={handleEndRoom}
      />

      <ConnectionBanner
        socketConnected={isConnected}
        voiceConnected={isLiveKitConnected}
        voiceConnecting={Boolean(isConnecting)}
        mockMode={isMockMode}
      />

      <RoomToolRail
        left={[
          {
            id: "insights",
            label: panels.insights
              ? "Hide session insights"
              : "Show session insights",
            icon: BarChart3,
            active: panels.insights,
            hidden: !isModerator,
            onClick: () => togglePanel("insights"),
          },
          {
            id: "cohost",
            label: panels.cohost ? "Hide AI co-host" : "Open AI co-host",
            icon: Sparkles,
            active: panels.cohost,
            dot: Boolean(aiCoHost.suggestion),
            hidden: !isModerator,
            onClick: () => togglePanel("cohost"),
          },
        ]}
        right={[
          {
            id: "coach",
            label: panels.coach ? "Hide room coach" : "Room coach & missions",
            icon: Target,
            active: panels.coach,
            tone: "warning",
            dot: Boolean(
              coach.mission && coach.myMission && !coach.myMission.completed,
            ),
            onClick: () => togglePanel("coach"),
          },
          {
            id: "corrections",
            label: panels.corrections
              ? "Hide corrections inbox"
              : "Corrections inbox",
            icon: SpellCheck,
            active: panels.corrections,
            tone: "success",
            badge: corrections.received.length,
            onClick: () => togglePanel("corrections"),
          },
          {
            id: "journal",
            label: "Practice journal",
            icon: BookOpen,
            active: panels.journal,
            badge: journal.stats.dueForReview.length,
            onClick: () => togglePanel("journal"),
          },
          {
            id: "effects",
            label: panels.effects ? "Hide voice effects" : "Voice effects",
            icon: Mic2,
            active: panels.effects,
            onClick: () => togglePanel("effects"),
          },
          {
            id: "quality",
            label: panels.quality
              ? "Hide connection info"
              : "Show connection info",
            icon: Wifi,
            active: panels.quality,
            onClick: () => togglePanel("quality"),
          },
        ]}
      />

      <AnimatePresence initial={false}>
        {panels.stats && (
          <motion.div
            key="live-stats"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-b overflow-hidden relative z-20"
            style={{
              borderColor: THEME.colors.border.primary,
              background: "rgba(14,14,26,0.7)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center gap-4 flex-wrap text-xs pl-0 sm:pl-0">
              {[
                { label: "Participants", value: totalParticipants },
                { label: "Speaking", value: speakingCount },
                {
                  label: "Duration",
                  value: `${Math.floor(roomDuration / 60)}m ${String(roomDuration % 60).padStart(2, "0")}s`,
                },
                { label: "Messages", value: messages.length },
                { label: "Reactions", value: stageReactions.length },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-1.5">
                  <span style={{ color: THEME.colors.text.muted }}>
                    {stat.label}:
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: THEME.colors.text.primary }}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex flex-1 min-h-0 relative z-10">
        <ReactionOverlay reactions={stageReactions} />

        <div className="flex-1 min-w-0 flex flex-col min-h-0 relative">
          <ActiveSpeakerStrip
            participants={allParticipants}
            currentUserId={user?.id}
            onSelect={(id) => {
              const p = allParticipants.find(
                (x) => x.id === id || x.userId === id,
              );
              if (p) toast.info(`🎤 ${p.name} is speaking`);
            }}
          />

          <ParticipantGrid
            participants={allParticipants}
            isHost={isHost}
            isModerator={isModerator}
            currentUserId={user?.id}
            hostId={hostId}
            searchQuery={participantSearch}
            onSearchChange={setParticipantSearch}
            filter={participantFilter}
            onFilterChange={setParticipantFilter}
            showSearch={showParticipantSearch}
            onToggleSearch={() => setShowParticipantSearch((v) => !v)}
            favoriteParticipants={favoriteParticipants}
            onToggleFavorite={(userId) =>
              setFavoriteParticipants((prev) => {
                const next = new Set(prev);
                if (next.has(userId)) next.delete(userId);
                else next.add(userId);
                return next;
              })
            }
            onMuteUser={muteUser}
            onUnmuteUser={unmuteUser}
            onKickUser={kickUser}
            onPromoteHost={promoteHost}
            isStageRoom={isStageRoom}
            onInviteToStage={inviteToStage}
            onMoveToAudience={moveToAudience}
            onSendMessage={(userId) => {
              const participant = allParticipants.find((p) => p.id === userId);
              if (!participant) return;
              setShowChat(true);
              setNewMessage(`@${participant.name} `);
              window.setTimeout(() => textareaRef.current?.focus(), 100);
            }}
            onViewProfile={() => toast.info("👤 Viewing profile")}
            showChat={showChat}
            className="w-full"
            onInvite={() => setPanel("invite", true)}
            onPickTopic={(topic) => {
              setShowChat(true);
              setNewMessage(topic);
              window.setTimeout(() => textareaRef.current?.focus(), 100);
            }}
            onCorrect={openCorrectionSheet}
          />

          <div className="pointer-events-none absolute right-3 top-24 z-30 w-[min(88vw,300px)] hidden md:block">
            <div className="pointer-events-auto">
              <SpeakerQueue
                participants={queueParticipants}
                currentUserId={user?.id}
                isModerator={isModerator}
                onPromote={handleQueuePromote}
                onRemove={handleQueueRemove}
                onSkip={handleQueueRemove}
                onToggleRaiseHand={handleToggleRaiseHand}
                defaultExpanded={false}
              />
            </div>
          </div>

          <div className="relative z-20 shrink-0 hidden sm:flex items-center justify-center gap-3 px-4 py-2">
            <div className="pointer-events-auto">
              <StageReactionBar
                onSend={(emoji) => handleSendStageReaction(emoji)}
              />
            </div>
            <div className="pointer-events-auto shrink-0">
              <ClapDock
                onClap={handleClap}
                size="sm"
                audioLevel={clamp01(audioLevel)}
              />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showChat && (
            <ChatPanel
              messages={chatPanelMessages}
              newMessage={newMessage}
              replyTo={
                replyTo
                  ? (normalizeChatMessage(replyTo, user?.id) as any)
                  : null
              }
              typingUsers={typingUsers}
              currentUserId={user?.id || ""}
              isHost={isHost}
              isModerator={isModerator}
              showEmojiPicker={showEmojiPicker}
              onEmojiPickerToggle={() => setShowEmojiPicker((v) => !v)}
              onMessageChange={handleComposerChange}
              onSendMessage={handleSendMessage}
              onReply={(msg) => setReplyTo(msg as any)}
              onPinMessage={handlePinMessage}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
              onReactToMessage={handleMessageReaction}
              onKickUser={kickUser}
              onMuteUser={muteUser}
              onRetryMessage={handleRetryMessage}
              chatSearch={chatSearch}
              onChatSearchChange={setChatSearch}
              showChatSearch={showChatSearch}
              onToggleChatSearch={() => setShowChatSearch((v) => !v)}
              totalParticipants={totalParticipants}
              scrollRef={chatScrollRef}
              endRef={chatEndRef}
              textareaRef={textareaRef}
              isNearBottom={isNearBottom}
              onScroll={handleChatScroll}
              hasNewMessages={hasNewMessages}
              newMessageCount={newMessageCount}
              onScrollToBottom={() => {
                setHasNewMessages(false);
                setNewMessageCount(0);
                scrollToBottom();
              }}
              onAttachFile={handleAttachClick}
              onDropFile={openAttachmentPreview}
              onTranslateMessage={handleTranslateMessage}
              onReportMessage={handleReportMessage}
              onSuggestCorrection={handleSuggestChatCorrection}
              onLoadOlder={handleLoadOlderMessages}
              hasMoreHistory={hasMoreHistory && messages.length >= 50}
              roomId={roomId}
              currentUserName={userName}
              participantNames={allParticipants
                .map((p) => p.name)
                .filter(Boolean)}
              participantNamesById={participantNamesById}
              className="w-full md:w-[400px] border-l"
            />
          )}
        </AnimatePresence>
      </main>

      {!showChat && (
        <div
          className="pointer-events-none absolute left-4 z-[68] sm:hidden"
          style={{ bottom: "7rem" }}
        >
          <ClapDock
            onClap={handleClap}
            size="sm"
            showRemaining={false}
            audioLevel={clamp01(audioLevel)}
          />
        </div>
      )}

      {/* Connection banner: reconnecting automatically, or lost with a retry button */}
      <AnimatePresence>
        {(isReconnecting || connectionLost) && (
          <motion.div
            key="connection-banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 pl-3 pr-2 py-2 rounded-full border shadow-2xl backdrop-blur-xl"
            style={{
              background: connectionLost ? "rgba(60, 16, 20, 0.92)" : "rgba(40, 32, 10, 0.92)",
              borderColor: connectionLost ? "rgba(248,113,113,0.45)" : "rgba(251,191,36,0.45)",
            }}
            role="status"
            aria-live="polite"
          >
            {connectionLost ? (
              <span className="text-sm" style={{ color: "#fecaca" }}>
                {liveKitError}
              </span>
            ) : (
              <span className="flex items-center gap-2 text-sm" style={{ color: "#fde68a" }}>
                <motion.span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#fbbf24" }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                />
                Reconnecting… you'll keep your place in the room
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                liveKitError?.includes("another tab")
                  ? window.location.reload()
                  : reconnectNow()
              }
              className="px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:brightness-110"
              style={{
                background: connectionLost ? "#ef4444" : "rgba(251,191,36,0.2)",
                color: connectionLost ? "#fff" : "#fde68a",
              }}
            >
              {liveKitError?.includes("another tab") ? "Use this tab" : connectionLost ? "Retry" : "Retry now"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AudioControls
        isMuted={isMuted}
        isDeafened={isDeafened}
        volume={volume}
        audioLevel={audioLevel}
        isHost={isHost}
        isReconnecting={isReconnecting}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        onVolumeChange={setVolume}
        onEndCall={handleLeave}
        onShareRoom={handleCopyLink}
        participantCount={totalParticipants}
        onShowParticipants={() => setShowParticipantSearch(true)}
        connectionQuality={connectionQuality}
        isCallActive={isLiveKitConnected}
        isAudience={isAudience}
        isHandRaised={handRaised}
        onToggleHand={() => handleToggleRaiseHand()}
        onLeaveStage={
          isStageRoom && !isAudience && !isHost ? handleLeaveStage : undefined
        }
      />

      <AnimatePresence>
        {panels.command && (
          <>
            <motion.div
              key="cc-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998] bg-black/40"
              style={{ backdropFilter: "blur(4px)" }}
              onClick={() => setPanel("command", false)}
            />
            <div className="fixed top-16 right-4 z-[999]">
              <CommandCenter
                isHost={isHost}
                isModerator={isModerator}
                isMuted={isMuted}
                isDeafened={isDeafened}
                soundEnabled={soundEnabled}
                showChat={showChat}
                showParticipants={true}
                showLiveStats={panels.stats}
                isRecording={isRecording}
                onMute={handleToggleMute}
                onDeafen={handleToggleDeafen}
                onToggleSound={() => setSoundEnabled((v) => !v)}
                onToggleChat={() => setShowChat((v) => !v)}
                onToggleStats={() => togglePanel("stats")}
                onRecord={
                  isRecording ? handleStopRecording : handleStartRecording
                }
                onClose={() => setPanel("command", false)}
              />
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panels.details && (
          <RoomDetailsPanel
            room={room}
            totalParticipants={totalParticipants}
            speakingCount={speakingCount}
            onlineCount={onlineCount}
            messages={messages.length}
            duration={roomDuration}
            premiumCount={allParticipants.filter((p) => p.isPremium).length}
            verifiedCount={allParticipants.filter((p) => p.isVerified).length}
            languages={languages}
            onClose={() => setPanel("details", false)}
            onCopyLink={handleCopyLink}
          />
        )}
      </AnimatePresence>

      <RoomCoachPanel
        isOpen={panels.coach}
        onClose={() => setPanel("coach", false)}
        userId={user?.id || ""}
        canManage={isModerator}
        roomId={roomId}
        live={coach.live}
        tip={coach.tip}
        mission={coach.mission}
        myMission={coach.myMission}
        lastResult={coach.lastResult}
        airtime={coach.airtime}
        onStartMission={coach.startMission}
        onStopMission={coach.stopMission}
        onSwapWord={coach.swapWord}
        onSpotlight={coach.sendSpotlight}
      />

      <SpotlightBanner
        spotlight={coach.spotlight}
        userId={user?.id || ""}
        onDismiss={coach.dismissSpotlight}
      />

      <LeaveConfirmationModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleConfirmLeave}
        summary={coach.live}
        missionsCompleted={coach.missionsDone}
      />

      <ShortcutPanel
        isOpen={panels.shortcuts}
        onClose={() => setPanel("shortcuts", false)}
      />

      <AttachmentPreviewModal
        isOpen={showAttachmentPreview}
        attachment={pendingAttachment}
        onSend={handleConfirmAttachmentSend}
        onCancel={handleCancelAttachment}
        onReplace={openAttachmentPreview}
      />

      <RoomInvite
        isOpen={panels.invite}
        onClose={() => setPanel("invite", false)}
        roomName={room.name}
        roomId={roomId}
        participantCount={totalParticipants}
      />

      <CorrectionSheet
        isOpen={!!correctionTarget}
        onClose={() => setCorrectionTarget(null)}
        targetName={correctionTarget?.userName || ""}
        initialOriginal={correctionTarget?.original || ""}
        isSubmitting={corrections.isSubmitting}
        onSubmit={async (payload) => {
          if (!correctionTarget) return;
          await corrections.submitCorrection({
            targetUserId: correctionTarget.userId,
            targetUserName: correctionTarget.userName,
            ...payload,
          });
        }}
      />

      <PracticeJournal
        isOpen={panels.journal}
        onClose={() => setPanel("journal", false)}
        entries={journal.entries}
        stats={journal.stats}
        onReview={journal.review}
        onRemove={journal.removeEntry}
        onClearAll={journal.clearAll}
        exportText={journal.exportAsText()}
      />

      <CorrectionsInbox
        isOpen={panels.corrections}
        onClose={() => setPanel("corrections", false)}
        corrections={corrections.corrections.filter(
          (c) => c.targetUserId === user?.id,
        )}
        onAccept={(id) => corrections.resolveCorrection(id, "accepted")}
        onDismiss={(id) => corrections.resolveCorrection(id, "dismissed")}
      />

      <VoiceEffectsPanel
        isOpen={panels.effects}
        onClose={() => setPanel("effects", false)}
        state={voiceEffects.state}
        update={voiceEffects.update}
        applyPreset={voiceEffects.applyPreset}
        reset={voiceEffects.reset}
        isLive={voiceEffects.isLive}
        canApply={voiceEffects.canApply}
        noiseSuppression={voiceEffects.noiseSuppression}
        onToggleNoiseSuppression={() =>
          voiceEffects.setNoiseSuppression(!voiceEffects.noiseSuppression)
        }
      />

      {isModerator && (
        <AICoHost
          isOpen={panels.cohost}
          onClose={() => setPanel("cohost", false)}
          isHost={isHost}
          isModerator={isModerator}
          suggestion={aiCoHost.suggestion}
          onDismissSuggestion={aiCoHost.dismissSuggestion}
          onSuggestNow={aiCoHost.suggestNow}
          summary={aiCoHost.summary}
          isSummarizing={aiCoHost.isSummarizing}
          onGenerateSummary={aiCoHost.generateSummary}
          onClearSummary={aiCoHost.clearSummary}
          exportText={aiCoHost.exportSummaryText}
          onUseSuggestion={(text) => {
            setShowChat(true);
            setNewMessage(text);
            window.setTimeout(() => textareaRef.current?.focus(), 100);
          }}
        />
      )}

      <RoomQualityPanel
        isOpen={panels.quality}
        onClose={() => setPanel("quality", false)}
        liveKitQuality={connectionQuality}
      />

      <AnimatePresence>
        {panels.insights && isModerator && (
          <SessionInsights
            speakingTimes={speakingTimes}
            totalParticipants={totalParticipants}
            roomDuration={roomDuration}
            messages={messages.length}
            reactions={stageReactions.length}
            isHost={isHost}
            isModerator={isModerator}
            onClose={() => setPanel("insights", false)}
          />
        )}
      </AnimatePresence>

      <RoomDropZone
        onFile={openAttachmentPreview}
        disabled={showAttachmentPreview}
      />

      <input
        ref={attachInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
        className="hidden"
        onChange={handleAttachFileChange}
      />

      <div className="fixed bottom-24 left-4 z-20 hidden md:block pointer-events-none">
        <div
          className="text-[9px] px-3 py-1.5 rounded-full border"
          style={{
            color: THEME.colors.text.muted,
            background: "rgba(10,10,15,0.75)",
            borderColor: THEME.colors.border.primary,
            backdropFilter: "blur(10px)",
          }}
        >
          {modKeyLabel()}+⇧+M mute · M mute · C chat · 1–6 reactions · A clap · ?
          shortcuts · Esc close
        </div>
      </div>
    </div>
  );
};

export default VoiceRoomView;