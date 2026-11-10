// apps/web/src/components/voice/lobby/LobbyBackdrop.tsx
import React from "react";

/**
 * The same slow aurora as inside a room (styles/voice-stage.css), softened and faded out toward the bottom,
 * so walking from the lobby into a room feels like one place. Decorative: sits behind everything, no events.
 */
export const LobbyBackdrop: React.FC = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-x-0 top-0 h-[680px] overflow-hidden"
    style={{
      maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
    }}
  >
    <div className="vr-orb vr-orb-a -left-[10%] -top-[34%] h-[88%] w-[50%]" style={{ background: "rgb(var(--vr-lapis) / calc(var(--vr-orb-alpha) * 0.9))" }} />
    <div className="vr-orb vr-orb-b -right-[10%] -top-[6%] h-[72%] w-[44%]" style={{ background: "rgb(var(--vr-orchid) / calc(var(--vr-orb-alpha) * 0.7))" }} />
    <div className="vr-orb vr-orb-c left-[34%] -top-[24%] h-[58%] w-[32%]" style={{ background: "rgb(var(--vr-saffron) / calc(var(--vr-orb-alpha) * 0.32))" }} />
    <div className="vr-grain" />
  </div>
);
