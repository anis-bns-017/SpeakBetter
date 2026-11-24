// apps/web/src/components/voice/shared/ReactionDock.tsx
/**
 * The reaction dock at the foot of the stage: quick emojis that swell as the pointer passes over them (like a
 * desktop dock), a "more" picker, the clap button and a heat bar that fills while the room is busy.
 *
 * The glowing emitter on top of the dock is where EVERY reaction launches from (anchorRef): tapping ❤️ on the far
 * left, clapping on the right, or someone else reacting all rise from that one point.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { SmilePlus, X } from "lucide-react";
import { ClapButton } from "../ClapButton";
import { DockKey } from "../VoiceRoomView.layout";
import { tr } from "../../../i18n/core";

const QUICK_EMOJIS = ["❤️", "🔥", "🎉", "😮", "🙌", "😂", "💯"];
const MORE_EMOJIS = [
  "❤️", "🔥", "👏", "😂", "🎉", "💯", "🙌", "😮", "🥳", "😍", "🤯", "💪",
  "✨", "🚀", "🤝", "☕", "🙏", "😭", "😎", "💖", "🌟", "⚡", "🎯", "🧠",
];

/** Same-key taps closer together than this are ignored */
const RATE_LIMIT_MS = 120;

interface ReactionDockProps {
  onReact: (emoji: string) => void;
  onClap: () => void;
  /** Attach the emitter here: reactions rise from this element */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** 0–1, how busy the reactions are */
  heat?: number;
  /** 0–1, my microphone level: the dock breathes with it */
  audioLevel?: number;
  disabled?: boolean;
}

const DockEmoji: React.FC<{
  emoji: string;
  mouseX: MotionValue<number>;
  onPick: (emoji: string) => void;
  disabled?: boolean;
  /** Phones have no room for all seven */
  hideOnPhone?: boolean;
}> = ({ emoji, mouseX, onPick, disabled, hideOnPhone }) => {
  const ref = useRef<HTMLButtonElement>(null);
  // How far the pointer is from this button's centre decides how much it swells
  const distance = useTransform(mouseX, (x) => {
    const b = ref.current?.getBoundingClientRect();
    return b ? x - (b.left + b.width / 2) : 999;
  });
  const swell = useTransform(distance, [-120, -50, 0, 50, 120], [1, 1.22, 1.62, 1.22, 1]);
  const scale = useSpring(swell, { mass: 0.1, stiffness: 220, damping: 15 });

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={() => onPick(emoji)}
      aria-label={tr("Send {emoji} reaction", { emoji })}
      style={{ scale, transformOrigin: "50% 100%" }}
      whileTap={{ scale: 0.86 }}
      className={`${hideOnPhone ? "hidden sm:grid" : "grid"} h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-full text-[21px] sm:text-[22px] leading-none disabled:opacity-40`}
    >
      {emoji}
    </motion.button>
  );
};

/** All 24 emojis in a small sheet above the dock. Drawn into body: the stage footer scrolls and would clip it. */
const MorePicker: React.FC<{
  anchorRef: React.RefObject<HTMLElement | null>;
  onPick: (emoji: string) => void;
  onClose: () => void;
}> = ({ anchorRef, onPick, onClose }) => {
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const place = () => {
      const r = anchor?.getBoundingClientRect();
      if (!r) return;
      setPos({ left: r.left + r.width / 2, bottom: window.innerHeight - r.top + 12 });
    };
    place();
    window.addEventListener("resize", place);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchor?.contains(t)) return;
      if (!(t as HTMLElement).closest?.("[data-reaction-picker]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [anchorRef, onClose]);

  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      data-reaction-picker
      initial={{ opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      role="dialog"
      aria-label={tr("More reactions")}
      className="fixed z-[9000] grid grid-cols-6 gap-1 rounded-3xl p-2"
      style={{
        left: pos.left,
        bottom: pos.bottom,
        transform: "translateX(-50%)",
        background: "rgb(6 26 26 / 0.9)",
        border: "1px solid rgb(255 255 255 / 0.12)",
        boxShadow: "0 24px 60px -16px rgb(0 0 0 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.08)",
        backdropFilter: "blur(24px) saturate(150%)",
      }}
    >
      {MORE_EMOJIS.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          aria-label={tr("Send {emoji} reaction", { emoji })}
          whileHover={{ scale: 1.3, y: -4 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 520, damping: 18 }}
          className="grid h-10 w-10 place-items-center rounded-2xl text-[22px] leading-none hover:bg-white/[0.08]"
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>,
    document.body,
  );
};

export const ReactionDock: React.FC<ReactionDockProps> = ({
  onReact,
  onClap,
  anchorRef,
  heat = 0,
  audioLevel = 0,
  disabled = false,
}) => {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const lastSentAt = useRef(0);
  const moreRef = useRef<HTMLButtonElement>(null);

  const send = useCallback(
    (emoji: string) => {
      if (disabled) return;
      const now = Date.now();
      if (now - lastSentAt.current < RATE_LIMIT_MS) return;
      lastSentAt.current = now;
      onReact(emoji);
    },
    [onReact, disabled],
  );

  const pickFromSheet = useCallback(
    (emoji: string) => {
      send(emoji);
      setPickerOpen(false);
    },
    [send],
  );

  const hot = heat > 0.55;
  const glow = Math.max(heat, Math.min(1, audioLevel));

  return (
    <div className="pointer-events-auto relative mx-auto flex shrink-0 flex-col items-center">
      {/* The emitter: the one spot every reaction rises from */}
      <span
        ref={anchorRef as React.RefObject<HTMLSpanElement>}
        aria-hidden
        className="vr-emitter absolute -top-[7px] left-1/2 z-10 -ml-[7px] h-3.5 w-3.5 rounded-full"
        data-hot={hot}
      />

      <div
        className="vr-dock relative flex items-center gap-1 rounded-full py-1.5 pl-2.5 pr-2"
        style={{
          background: "linear-gradient(180deg, rgb(255 255 255 / 0.09), rgb(255 255 255 / 0.03))",
          border: "1px solid rgb(255 255 255 / 0.13)",
          boxShadow: `0 18px 44px -14px rgb(0 0 0 / 0.7), 0 0 ${10 + glow * 34}px -4px rgb(var(--vr-iris, 94 234 212) / ${0.12 + glow * 0.45}), inset 0 1px 0 rgb(255 255 255 / 0.12)`,
          backdropFilter: "blur(18px) saturate(150%)",
          transition: "box-shadow 250ms ease",
        }}
      >
        <div
          role="group"
          aria-label={tr("Quick reactions")}
          className="flex items-end gap-0.5"
          onPointerMove={(e) => mouseX.set(e.clientX)}
          onPointerLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
        >
          {QUICK_EMOJIS.map((emoji, i) => (
            <DockEmoji key={emoji} emoji={emoji} mouseX={mouseX} onPick={send} disabled={disabled} hideOnPhone={i >= 4} />
          ))}
        </div>

        <button
          ref={moreRef}
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: "rgb(255 255 255 / 0.7)" }}
          title={pickerOpen ? tr("Show fewer reactions") : tr("More reactions")}
          aria-label={pickerOpen ? tr("Show fewer reactions") : tr("More reactions")}
          aria-expanded={pickerOpen}
        >
          {pickerOpen ? <X className="h-4 w-4" /> : <SmilePlus className="h-4 w-4" />}
        </button>

        <span aria-hidden className="mx-1 h-6 w-px shrink-0" style={{ background: "rgb(255 255 255 / 0.14)" }} />

        <ClapButton onClap={onClap} onStreakChange={setStreak} size="sm" maxClaps={100} cooldownMs={140} showRemaining={false} />

        <AnimatePresence>
          {streak >= 3 && (
            <motion.span
              key="streak"
              initial={{ opacity: 0, scale: 0.6, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: "auto" }}
              exit={{ opacity: 0, scale: 0.6, width: 0 }}
              className="overflow-hidden whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
              style={{
                background:
                  streak >= 5 ? "linear-gradient(135deg, #fcd34d, #fb7185)" : "rgb(94 234 212 / 0.22)",
                color: "#fff",
              }}
            >
              {streak >= 5 ? `🔥 ${streak}` : `×${streak}`}
            </motion.span>
          )}
        </AnimatePresence>

        <span className="hidden pl-0.5 pr-1 sm:inline-flex" title={tr("Press A to clap")}>
          <DockKey>A</DockKey>
        </span>

        {/* Heat: fills while the room is busy reacting */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-5 -bottom-px h-[2px] overflow-hidden rounded-full"
        >
          <span
            className="block h-full origin-left rounded-full"
            style={{
              transform: `scaleX(${heat})`,
              background: "linear-gradient(90deg, #2dd4bf, #5eead4, #fcd34d, #fb7185)",
              transition: "transform 400ms ease",
            }}
          />
        </span>
      </div>

      <AnimatePresence>
        {pickerOpen && (
          <MorePicker anchorRef={moreRef} onPick={pickFromSheet} onClose={() => setPickerOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReactionDock;
