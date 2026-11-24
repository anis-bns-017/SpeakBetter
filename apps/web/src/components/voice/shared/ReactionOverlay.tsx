// apps/web/src/components/voice/shared/ReactionOverlay.tsx
import React, { memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../../i18n/core";

export interface StageReaction {
  id: string;
  emoji: string;
  userId: string;
  userName?: string;
  /** Mine (shown at once when I tap) or somebody else's (arrives over the socket) */
  local: boolean;
  /** Screen position the reaction launches from: the dock's emitter, always the same point */
  originX: number;
  originY: number;
  createdAt: number;
  /** Seconds to wait before this one launches (a clap burst staggers its pieces) */
  delay?: number;
  /** -1 (far left) … 1 (far right): fixes the lean so a burst fans out evenly instead of clumping */
  fan?: number;
  /** The first piece of a burst draws the launch ring; the rest skip it */
  ring?: boolean;
}

/** A burst of confetti when you reach a streak of reactions */
export interface StageMilestone {
  id: string;
  originX: number;
  originY: number;
  count: number;
  createdAt: number;
}

interface ReactionOverlayProps {
  reactions: StageReaction[];
  milestones?: StageMilestone[];
  maxVisible?: number;
}

/** How long one emoji takes to rise and fade (keep in sync with `.vr-float-*` in voice-stage.css) */
export const FLOAT_MS = 3200;

/**
 * The floating emoji layer.
 *
 * Every reaction, yours or anyone's, rises from the same single point (the dock's emitter). The motion is pure CSS
 * (three nested layers: rise, sway, pop), so it runs on the compositor and stays smooth even when React is busy
 * re-rendering a big room. It is drawn into document.body so no parent's overflow, transform or backdrop-filter can
 * clip it. Other people's reactions carry a small name tag.
 */
export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions, milestones = [], maxVisible = 56 }) => {
  if (typeof document === "undefined") return null;
  const visible = reactions.slice(-maxVisible);

  return createPortal(
    <div className="pointer-events-none" style={{ position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden" }} aria-hidden="true">
      {visible.map((reaction) => (
        <FloatingReaction key={reaction.id} reaction={reaction} />
      ))}
      {milestones.map((m) => (
        <ConfettiBurst key={m.id} milestone={m} />
      ))}
    </div>,
    document.body,
  );
};

// ------------------------------------------------------------

/** A stable number in [-1, 1] from a string, so a reaction's path never changes between renders */
function unit(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2000) / 1000 - 1;
}

const FloatingReaction = memo(function FloatingReaction({ reaction }: { reaction: StageReaction }) {
  const vars = useMemo(() => {
    const id = reaction.id;
    const fan = reaction.fan ?? unit(id, 1);
    return {
      "--vr-ox": `${reaction.originX}px`,
      "--vr-oy": `${reaction.originY}px`,
      "--vr-rise": `${300 + (unit(id, 2) + 1) * 120}px`,
      "--vr-lean": `${fan * 96 + unit(id, 7) * 14}px`,
      "--vr-sway": `${10 + (unit(id, 3) + 1) * 9}px`,
      "--vr-rot": `${unit(id, 4) * 24}deg`,
      "--vr-s": (1 + (unit(id, 5) + 1) * 0.22).toFixed(2),
      "--vr-d": `${(reaction.delay ?? 0).toFixed(3)}s`,
      "--vr-dur": `${FLOAT_MS}ms`,
    } as React.CSSProperties;
  }, [reaction.id, reaction.originX, reaction.originY, reaction.fan, reaction.delay]);

  const first = (reaction.userName || "").trim().split(/\s+/)[0]?.slice(0, 12);

  return (
    <div className="vr-float" style={vars}>
      {reaction.ring !== false && <span className="vr-float-ring" />}
      <div className="vr-float-rise">
        <div className="vr-float-sway">
          <div className="vr-float-pop">
            <span role="img" aria-label={tr("reaction")} className="vr-float-emoji">
              {reaction.emoji}
            </span>
            {!reaction.local && first && <span className="vr-float-tag">{first}</span>}
          </div>
        </div>
      </div>
    </div>
  );
});

// ------------------------------------------------------------

const CONFETTI = ["#2dd4bf", "#fbbf24", "#fb7185", "#a7f3d0", "#f0abfc", "#ffffff"];

const ConfettiBurst = memo(function ConfettiBurst({ milestone }: { milestone: StageMilestone }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const angle = -Math.PI / 2 + unit(milestone.id, 10 + i) * 1.2; // a fan, mostly upward
        const speed = 150 + (unit(milestone.id, 40 + i) + 1) * 140;
        return {
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          spin: unit(milestone.id, 70 + i) * 540,
          color: CONFETTI[i % CONFETTI.length],
          w: 5 + (unit(milestone.id, 100 + i) + 1) * 3,
        };
      }),
    [milestone.id],
  );

  return (
    <div className="vr-confetti" style={{ left: milestone.originX, top: milestone.originY }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="vr-confetti-piece"
          style={
            {
              width: p.w,
              height: p.w * 1.7,
              background: p.color,
              "--vr-dx": `${p.dx}px`,
              "--vr-dy": `${p.dy}px`,
              "--vr-spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      <span className="vr-confetti-badge">
        {"🔥 "}
        {tr("{count} reactions!", { count: milestone.count })}
      </span>
    </div>
  );
});

export default ReactionOverlay;
