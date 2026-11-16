// apps/web/src/components/voice/effects/SpeakingEffect.tsx
// Avatar frames people pick in Settings (speakingEffects.ts). Each is drawn as vector art in one 200×200 box whose
// centre circle (r = 50) is exactly the avatar, so it lines up at any size. Put layer="back" before the avatar and
// layer="front" after it, inside a relative box the avatar's size: rings, wings and glows go behind the face; ears,
// crowns and flying things in front.
//
// The frame is always shown. While its owner talks (talking), the extra parts marked .se-talk fade in (sparks,
// ripples, notes) and the whole frame swells a little with the voice level. Styles: styles/speaking-effects.css.
import React, { useEffect, useId, useRef } from "react";
import type { SpeakingEffectId } from "./speakingEffects";

export interface SpeakingEffectProps {
  effect: SpeakingEffectId;
  layer: "back" | "front";
  /** The avatar's width in px */
  size: number;
  /** Voice level 0–1 */
  level: number;
  /** The owner is talking right now: play the speaking extras */
  talking?: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry helpers. Angles are degrees clockwise from the top, like a clock.
// ---------------------------------------------------------------------------------------------------------------

const C = 100;
const r2 = (n: number) => Math.round(n * 100) / 100;
const at = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r2(C + r * Math.sin(a)), r2(C - r * Math.cos(a))];
};
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const ease = { calcMode: "spline", keySplines: ".45 0 .55 1;.45 0 .55 1" } as const;

/** Turns its children round the avatar's centre */
const Spin: React.FC<{ dur: number; reverse?: boolean; children: React.ReactNode }> = ({ dur, reverse, children }) => (
  <g>
    {children}
    <animateTransform
      attributeName="transform"
      type="rotate"
      from={`${reverse ? 360 : 0} ${C} ${C}`}
      to={`${reverse ? 0 : 360} ${C} ${C}`}
      dur={`${dur}s`}
      repeatCount="indefinite"
    />
  </g>
);

/** Rocks its children by ±deg around (cx, cy) */
const Sway: React.FC<{ deg: number; dur: number; cx?: number; cy?: number; begin?: string; children: React.ReactNode }> = ({
  deg,
  dur,
  cx = C,
  cy = C,
  begin = "0s",
  children,
}) => (
  <g>
    {children}
    <animateTransform
      attributeName="transform"
      type="rotate"
      values={`${-deg} ${cx} ${cy};${deg} ${cx} ${cy};${-deg} ${cx} ${cy}`}
      keyTimes="0;0.5;1"
      {...ease}
      dur={`${dur}s`}
      begin={begin}
      repeatCount="indefinite"
    />
  </g>
);

const Twinkle: React.FC<{ dur?: number; begin?: string; from?: number }> = ({ dur = 1.6, begin = "0s", from = 0.15 }) => (
  <animate attributeName="opacity" values={`${from};1;${from}`} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
);

/** A four-point sparkle centred on (x, y) */
const Sparkle: React.FC<{ x: number; y: number; s?: number; color?: string; dur?: number; begin?: string }> = ({
  x,
  y,
  s = 5,
  color = "#fff8dc",
  dur = 1.6,
  begin = "0s",
}) => (
  <path
    d={`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`}
    fill={color}
  >
    <Twinkle dur={dur} begin={begin} from={0} />
  </path>
);

/** Something rising and fading from (x, y): embers, notes, bubbles */
const Rise: React.FC<{ x: number; y: number; dy?: number; dx?: number; dur?: number; begin?: string; children: React.ReactNode }> = ({
  x,
  y,
  dy = -34,
  dx = 0,
  dur = 2,
  begin = "0s",
  children,
}) => (
  <g opacity="0">
    <g transform={`translate(${x} ${y})`}>{children}</g>
    <animateTransform attributeName="transform" type="translate" values={`0 0;${dx} ${dy}`} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.6;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
  </g>
);

// ---------------------------------------------------------------------------------------------------------------
// Shared paints. Every SVG gets its own ids (useId), so many avatars on one page never mix their gradients.
// ---------------------------------------------------------------------------------------------------------------

interface Ctx {
  /** An id for this SVG */
  id: (name: string) => string;
  /** url(#id) for fill/stroke/filter */
  u: (name: string) => string;
}

/** A radial gradient across a ring's width, so the ring looks round like a tube */
const Tube: React.FC<{ id: string; r: number; w: number; stops: string[] }> = ({ id, r, w, stops }) => {
  const outer = r + w / 2;
  const inner = (r - w / 2) / outer;
  const step = (1 - inner) / (stops.length - 1);
  return (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={C} cy={C} r={outer}>
      <stop offset={inner} stopColor={stops[0]} />
      {stops.map((color, i) => (
        <stop key={i} offset={Math.min(1, inner + step * i)} stopColor={color} />
      ))}
    </radialGradient>
  );
};

const SharedDefs: React.FC<{ ctx: Ctx }> = ({ ctx }) => (
  <>
    <linearGradient id={ctx.id("gold")} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff7d1" />
      <stop offset="0.28" stopColor="#f6d365" />
      <stop offset="0.55" stopColor="#c8921a" />
      <stop offset="0.78" stopColor="#ffe08a" />
      <stop offset="1" stopColor="#8a5a07" />
    </linearGradient>
    <linearGradient id={ctx.id("goldH")} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#8a5a07" />
      <stop offset="0.35" stopColor="#ffe08a" />
      <stop offset="0.5" stopColor="#fffbe6" />
      <stop offset="0.65" stopColor="#f6c945" />
      <stop offset="1" stopColor="#9c6b0a" />
    </linearGradient>
    <radialGradient id={ctx.id("ruby")} cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#ffd1dc" />
      <stop offset="0.35" stopColor="#ff2e63" />
      <stop offset="1" stopColor="#7a0019" />
    </radialGradient>
    <radialGradient id={ctx.id("sapphire")} cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#dbeafe" />
      <stop offset="0.35" stopColor="#2563eb" />
      <stop offset="1" stopColor="#0b1f66" />
    </radialGradient>
    <radialGradient id={ctx.id("emerald")} cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#d1fae5" />
      <stop offset="0.35" stopColor="#10b981" />
      <stop offset="1" stopColor="#064e3b" />
    </radialGradient>
    <radialGradient id={ctx.id("pearl")} cx="0.35" cy="0.3" r="0.75">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.6" stopColor="#f1ede4" />
      <stop offset="1" stopColor="#b9b2a3" />
    </radialGradient>
    <filter id={ctx.id("glow")} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.6" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id={ctx.id("haze")} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" />
    </filter>
  </>
);

const Gem: React.FC<{ ctx: Ctx; x: number; y: number; r?: number; kind: "ruby" | "sapphire" | "emerald" | "pearl"; begin?: string }> = ({
  ctx,
  x,
  y,
  r = 3,
  kind,
  begin,
}) => (
  <g>
    <circle cx={x} cy={y} r={r + 0.9} fill={ctx.u("gold")} />
    <circle cx={x} cy={y} r={r} fill={ctx.u(kind)} />
    <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.28} fill="#fff" opacity="0.85">
      {begin && <Twinkle dur={2.2} begin={begin} from={0.3} />}
    </circle>
  </g>
);

const GoldRing: React.FC<{ ctx: Ctx; name: string; r: number; w: number }> = ({ ctx, name, r, w }) => (
  <>
    <defs>
      <Tube id={ctx.id(name)} r={r} w={w} stops={["#6b4504", "#c8921a", "#fff3c4", "#e8b93a", "#7a4f05"]} />
    </defs>
    <circle cx={C} cy={C} r={r} fill="none" stroke={ctx.u(name)} strokeWidth={w} />
  </>
);

/** A soft pulse behind the avatar while talking */
const TalkGlow: React.FC<{ color: string; r?: number }> = ({ color, r = 62 }) => (
  <g className="se-talk">
    <circle cx={C} cy={C} r={r} fill="none" stroke={color} strokeWidth="10" opacity="0.5" filter="blur(4px)">
      <animate attributeName="r" values={`${r - 4};${r + 4};${r - 4}`} dur="1.4s" repeatCount="indefinite" />
    </circle>
  </g>
);

/** Rings that spread out from the avatar while talking */
const Ripples: React.FC<{ color: string; from?: number; to?: number }> = ({ color, from = 52, to = 92 }) => (
  <g className="se-talk">
    {[0, 0.9].map((begin) => (
      <circle key={begin} cx={C} cy={C} r={from} fill="none" stroke={color} strokeWidth="2">
        <animate attributeName="r" values={`${from};${to}`} dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
      </circle>
    ))}
  </g>
);

// ---------------------------------------------------------------------------------------------------------------
// The effects. Each returns its back and front parts.
// ---------------------------------------------------------------------------------------------------------------

type Parts = { back?: React.ReactNode; front?: React.ReactNode };
type Draw = (ctx: Ctx) => Parts;

// ----- Animals -------------------------------------------------------------------------------------------------

const catEars: Draw = (ctx) => {
  const ear = (side: 1 | -1) => {
    const [x, y] = at(50, side * 36);
    return (
      <g transform={`translate(${x} ${y}) rotate(${side * 36})`}>
        <Sway deg={7} dur={2.6} cx={0} cy={2} begin={side > 0 ? "1.3s" : "0s"}>
          <path d="M-17 6 Q-14 -22 0 -32 Q14 -22 17 6 Z" fill={ctx.u("fur")} stroke="#b4467d" strokeWidth="1.2" />
          <path d="M-9.5 3 Q-7 -15 0 -23 Q7 -15 9.5 3 Z" fill={ctx.u("earIn")} />
          <path d="M-3 -2 Q0 -14 2 -18 M2 -1 Q3 -10 5 -13" stroke="#fff" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.8" />
        </Sway>
      </g>
    );
  };
  return {
    back: (
      <>
        <defs>
          <Tube id={ctx.id("pinkTube")} r={55} w={7} stops={["#9d2463", "#ff7ab6", "#ffe1f0", "#ff8cc6", "#8f1f58"]} />
          <linearGradient id={ctx.id("tail")} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ff7ab6" />
            <stop offset="1" stopColor="#ffd1e8" />
          </linearGradient>
        </defs>
        <TalkGlow color="#ff7ab6" />
        <Sway deg={9} dur={2.2} cx={150} cy={150}>
          <path d="M150 150 C182 150 192 112 172 92 C166 86 160 90 164 96 C176 112 170 136 146 140" fill={ctx.u("tail")} stroke="#c2477f" strokeWidth="1.2" />
        </Sway>
        <circle cx={C} cy={C} r={55} fill="none" stroke={ctx.u("pinkTube")} strokeWidth="7" />
        {range(24).map((i) => {
          const [x, y] = at(55, i * 15);
          return <circle key={i} cx={x} cy={y} r="0.9" fill="#fff" opacity="0.7" />;
        })}
      </>
    ),
    front: (
      <>
        <defs>
          <linearGradient id={ctx.id("fur")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd6ea" />
            <stop offset="1" stopColor="#ff7ab6" />
          </linearGradient>
          <linearGradient id={ctx.id("earIn")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9fcb" />
            <stop offset="1" stopColor="#ffe6f2" />
          </linearGradient>
        </defs>
        {ear(-1)}
        {ear(1)}
        {/* Bell on a ribbon */}
        <g transform="translate(100 156)">
          <path d="M-12 -4 Q-6 2 0 -2 Q6 2 12 -4 L12 0 Q6 6 0 2 Q-6 6 -12 0 Z" fill="#e11d74" />
          <Sway deg={14} dur={0.9} cx={0} cy={0}>
            <circle cx="0" cy="5" r="6" fill={ctx.u("gold")} stroke="#8a5a07" strokeWidth="0.8" />
            <path d="M-3.5 6.5 H3.5" stroke="#6b4504" strokeWidth="1.2" />
            <circle cx="-2" cy="2.8" r="1.4" fill="#fff" opacity="0.8" />
          </Sway>
        </g>
        <g className="se-talk">
          {[
            [30, 120, "0s"],
            [168, 118, "0.8s"],
            [38, 64, "1.5s"],
          ].map(([x, y, begin]) => (
            <Rise key={String(begin)} x={x as number} y={y as number} begin={begin as string} dur={2.2}>
              <g fill="#ff7ab6">
                <ellipse cx="0" cy="2" rx="3.6" ry="3" />
                <circle cx="-3.6" cy="-2.4" r="1.4" />
                <circle cx="-1.2" cy="-4" r="1.4" />
                <circle cx="1.4" cy="-4" r="1.4" />
                <circle cx="3.8" cy="-2.4" r="1.4" />
              </g>
            </Rise>
          ))}
        </g>
      </>
    ),
  };
};

const Butterfly: React.FC<{ ctx: Ctx; grad: string; dur?: number }> = ({ ctx, grad, dur = 0.34 }) => (
  <g>
    <g>
      {[1, -1].map((side) => (
        <g key={side} transform={`scale(${side} 1)`}>
          <path d="M0 0 C-6 -15 -19 -14 -16 -3 C-14 3 -6 3 0 0 Z" fill={ctx.u(grad)} stroke="#1e1b4b" strokeWidth="0.6" />
          <path d="M0 0 C-10 3 -14 12 -8 13 C-3 13 0 7 0 0 Z" fill={ctx.u(grad)} stroke="#1e1b4b" strokeWidth="0.6" opacity="0.9" />
          <circle cx="-10" cy="-6" r="1.6" fill="#fff" opacity="0.85" />
        </g>
      ))}
      <animateTransform attributeName="transform" type="scale" values="1 1;0.2 1;1 1" dur={`${dur}s`} repeatCount="indefinite" />
    </g>
    <ellipse cx="0" cy="2" rx="1.3" ry="7" fill="#1e1b4b" />
    <path d="M-0.5 -5 Q-3 -10 -4.5 -11 M0.5 -5 Q3 -10 4.5 -11" stroke="#1e1b4b" strokeWidth="0.7" fill="none" />
  </g>
);

const butterflies: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <linearGradient id={ctx.id("iri")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="0.35" stopColor="#a78bfa" />
          <stop offset="0.7" stopColor="#f0abfc" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
      </defs>
      <TalkGlow color="#a78bfa" />
      <Spin dur={9}>
        <circle cx={C} cy={C} r={55} fill="none" stroke={ctx.u("iri")} strokeWidth="5" filter={ctx.u("glow")} />
      </Spin>
      <circle cx={C} cy={C} r={60.5} fill="none" stroke="#e0e7ff" strokeWidth="0.8" strokeDasharray="1 4" opacity="0.8" />
    </>
  ),
  front: (
    <>
      <defs>
        <linearGradient id={ctx.id("wingA")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id={ctx.id("wingB")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f9a8d4" />
          <stop offset="1" stopColor="#c026d3" />
        </linearGradient>
        <linearGradient id={ctx.id("wingC")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      {[
        { start: 0, r: 64, grad: "wingA", dur: 7, s: 1 },
        { start: 140, r: 70, grad: "wingB", dur: 9.5, s: 0.8 },
        { start: 250, r: 61, grad: "wingC", dur: 8, s: 0.7 },
      ].map((b) => (
        <Spin key={b.start} dur={b.dur}>
          <g transform={`rotate(${b.start} ${C} ${C})`}>
            <g className="se-talk">
              {[8, 16, 24].map((back, i) => {
                const [x, y] = at(b.r, -back);
                return <circle key={back} cx={x} cy={y} r={1.6 - i * 0.4} fill="#fff" opacity={0.8 - i * 0.2} />;
              })}
            </g>
            <g transform={`translate(${C} ${C - b.r}) rotate(90) scale(${b.s})`}>
              <Butterfly ctx={ctx} grad={b.grad} />
            </g>
          </g>
        </Spin>
      ))}
    </>
  ),
});

const bee: Draw = (ctx) => {
  const hex = "M3 0 L9 0 L12 5.2 L9 10.4 L3 10.4 L0 5.2 Z";
  return {
    back: (
      <>
        <defs>
          <pattern id={ctx.id("comb")} width="18" height="10.4" patternUnits="userSpaceOnUse">
            <rect width="18" height="10.4" fill="#f59e0b" />
            <path d={hex} fill="#fbbf24" stroke="#92400e" strokeWidth="0.9" />
            <path d={hex} transform="translate(9 -5.2)" fill="#fcd34d" stroke="#92400e" strokeWidth="0.9" />
            <path d={hex} transform="translate(9 5.2)" fill="#fcd34d" stroke="#92400e" strokeWidth="0.9" />
          </pattern>
        </defs>
        <TalkGlow color="#fbbf24" />
        <circle cx={C} cy={C} r={56} fill="none" stroke={ctx.u("comb")} strokeWidth="11" />
        <circle cx={C} cy={C} r={50.8} fill="none" stroke="#78350f" strokeWidth="1.4" />
        <circle cx={C} cy={C} r={61.6} fill="none" stroke="#78350f" strokeWidth="1.4" />
        {/* Honey dripping from the bottom of the comb */}
        <path d="M86 160 Q86 168 90 168 Q94 168 94 160 M104 161 Q104 174 108.5 174 Q113 174 113 160" fill="#f59e0b" stroke="#b45309" strokeWidth="0.6" />
        <g className="se-talk">
          <circle cx="108.5" cy="176" r="2.6" fill="#f59e0b">
            <animate attributeName="cy" values="174;190" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="1.4s" repeatCount="indefinite" />
          </circle>
        </g>
      </>
    ),
    front: (
      <>
        <defs>
          <clipPath id={ctx.id("beeBody")}>
            <ellipse cx="0" cy="0" rx="9" ry="6" />
          </clipPath>
          <path id={ctx.id("flight")} d="M100 30 C142 6 182 40 154 66 C134 84 66 16 46 66 C18 40 58 6 100 30 Z" />
        </defs>
        <g>
          <g>
            {/* Wings */}
            <g opacity="0.85">
              <ellipse cx="-1" cy="-7" rx="5" ry="7" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="0.6">
                <animateTransform attributeName="transform" type="scale" values="1 1;1 0.35;1 1" dur="0.12s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="3" cy="-6" rx="4" ry="6" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="0.6">
                <animateTransform attributeName="transform" type="scale" values="1 0.35;1 1;1 0.35" dur="0.12s" repeatCount="indefinite" />
              </ellipse>
            </g>
            <g clipPath={ctx.u("beeBody")}>
              <rect x="-10" y="-7" width="20" height="14" fill="#facc15" />
              <rect x="-4" y="-7" width="3" height="14" fill="#1c1917" />
              <rect x="2" y="-7" width="3" height="14" fill="#1c1917" />
            </g>
            <ellipse cx="0" cy="0" rx="9" ry="6" fill="none" stroke="#1c1917" strokeWidth="0.8" />
            <circle cx="9.5" cy="-1" r="4" fill="#1c1917" />
            <circle cx="11" cy="-2.2" r="1.2" fill="#fff" />
            <path d="M-9 0 L-13 0.8 L-9 2" fill="#1c1917" />
            <path d="M11 -4 Q13 -9 15 -10 M9 -4.5 Q10 -9.5 11.5 -11" stroke="#1c1917" strokeWidth="0.7" fill="none" />
          </g>
          <animateMotion dur="5s" repeatCount="indefinite" rotate="auto">
            <mpath href={`#${ctx.id("flight")}`} />
          </animateMotion>
        </g>
      </>
    ),
  };
};

const Bird: React.FC<{ body: string; wing: string; flip?: boolean }> = ({ body, wing, flip }) => (
  <g transform={flip ? "scale(-1 1)" : undefined}>
    <path d="M-12 2 L-20 -2 L-19 4 Z" fill={wing} />
    <ellipse cx="0" cy="0" rx="12" ry="9.5" fill={body} />
    <ellipse cx="2" cy="3" rx="7" ry="5" fill="#fff" opacity="0.55" />
    <g>
      <path d="M-6 -2 Q-2 -9 6 -3 Q0 3 -6 -2 Z" fill={wing} />
      <animateTransform attributeName="transform" type="rotate" values="0 -6 -2;-14 -6 -2;0 -6 -2" dur="0.5s" repeatCount="indefinite" />
    </g>
    <circle cx="7" cy="-3" r="1.8" fill="#111827" />
    <circle cx="7.6" cy="-3.6" r="0.6" fill="#fff" />
    <path d="M11 -2 L16 -0.5 L11 1 Z" fill="#f59e0b" />
    <path d="M-2 9 L-3 13 M3 9 L2 13" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" />
  </g>
);

const Note: React.FC<{ fill: string }> = ({ fill }) => (
  <g fill={fill}>
    <ellipse cx="-2" cy="4" rx="3" ry="2.2" transform="rotate(-20 -2 4)" />
    <path d="M0.6 3.5 V-7 L6 -9 V-6.5 L1.8 -5 V3.5 Z" />
  </g>
);

const songbirds: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <Tube id={ctx.id("vine")} r={56} w={4} stops={["#14532d", "#22c55e", "#bbf7d0", "#16a34a", "#14532d"]} />
      </defs>
      <TalkGlow color="#86efac" />
      <circle cx={C} cy={C} r={56} fill="none" stroke={ctx.u("vine")} strokeWidth="4" />
      {range(18).map((i) => {
        const deg = i * 20 + 6;
        const [x, y] = at(56, deg);
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${deg + (i % 2 ? 60 : -60)})`}>
            <path d="M0 0 C4 -3 4 -9 0 -12 C-4 -9 -4 -3 0 0 Z" fill={i % 2 ? "#4ade80" : "#16a34a"} />
          </g>
        );
      })}
      {range(6).map((i) => {
        const [x, y] = at(57, i * 60 + 30);
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            {range(5).map((p) => (
              <ellipse key={p} cx="0" cy="-3" rx="2.2" ry="3.2" fill={i % 2 ? "#fbcfe8" : "#fde68a"} transform={`rotate(${p * 72})`} />
            ))}
            <circle r="1.6" fill="#f59e0b" />
          </g>
        );
      })}
    </>
  ),
  front: (
    <>
      {([
        [-40, "#38bdf8", "#0369a1", false],
        [40, "#fbbf24", "#c2410c", true],
      ] as const).map(([deg, body, wing, flip], i) => {
        const [x, y] = at(60, deg);
        return (
          <g key={deg} transform={`translate(${x} ${y - 6})`}>
            <g>
              <Bird body={body} wing={wing} flip={flip} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;0 0;0 -5;0 0;0 -2;0 0"
                keyTimes="0;0.55;0.65;0.75;0.85;1"
                dur="1.8s"
                begin={`${i * 0.9}s`}
                repeatCount="indefinite"
              />
            </g>
          </g>
        );
      })}
      <g className="se-talk">
        {[
          [52, 40, "0s", "#fde68a", -8],
          [148, 40, "0.7s", "#bae6fd", 8],
          [60, 30, "1.4s", "#f9a8d4", -10],
          [140, 30, "2.1s", "#fde68a", 10],
        ].map(([x, y, begin, fill, dx]) => (
          <Rise key={String(begin)} x={x as number} y={y as number} dx={dx as number} dy={-28} begin={begin as string} dur={2.6}>
            <Note fill={fill as string} />
          </Rise>
        ))}
      </g>
    </>
  ),
});

const Koi: React.FC<{ patch: string }> = ({ patch }) => (
  <g>
    <g>
      <path d="M-14 0 L-22 -7 Q-19 0 -22 7 Z" fill={patch} opacity="0.9" />
      <animateTransform attributeName="transform" type="rotate" values="-14 -14 0;14 -14 0;-14 -14 0" dur="0.8s" repeatCount="indefinite" />
    </g>
    <path d="M-15 0 C-10 -7 6 -8 14 -2 Q17 0 14 2 C6 8 -10 7 -15 0 Z" fill="#fff7ed" />
    <path d="M-6 -5.5 C-1 -7 4 -6 7 -4 C4 -1 -2 -1 -6 -5.5 Z M-12 1 C-8 3 -4 4 -1 5 C-6 6 -10 4 -12 1 Z" fill={patch} />
    <path d="M2 4 L-2 9 L5 5 Z M2 -4 L-2 -9 L5 -5 Z" fill={patch} opacity="0.85" />
    <circle cx="10" cy="-1.6" r="1.1" fill="#111827" />
  </g>
);

const koi: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <Tube id={ctx.id("water")} r={58} w={16} stops={["#0c4a6e", "#0ea5e9", "#a5f3fc", "#22d3ee", "#075985"]} />
      </defs>
      <circle cx={C} cy={C} r={58} fill="none" stroke={ctx.u("water")} strokeWidth="16" opacity="0.85" />
      <Spin dur={14} reverse>
        <circle cx={C} cy={C} r={58} fill="none" stroke="#e0f2fe" strokeWidth="1" strokeDasharray="10 14" opacity="0.6" />
      </Spin>
      <Ripples color="#a5f3fc" from={60} to={90} />
    </>
  ),
  front: (
    <>
      <Spin dur={8}>
        <g transform={`translate(${C} ${C - 58})`}>
          <Koi patch="#f97316" />
        </g>
        <g transform={`rotate(180 ${C} ${C}) translate(${C} ${C - 58}) scale(0.85)`}>
          <Koi patch="#dc2626" />
        </g>
      </Spin>
      {/* Lily pad with a lotus */}
      <g transform="translate(46 146)">
        <path d="M0 0 m-13 0 a13 8 0 1 0 26 0 a13 8 0 1 0 -26 0 Z M0 0 L12 -3 L11 2 Z" fill="#16a34a" fillRule="evenodd" />
        <ellipse cx="0" cy="-1" rx="10" ry="5" fill="#22c55e" opacity="0.6" />
        {[-50, -25, 0, 25, 50].map((rot) => (
          <path key={rot} d="M0 -1 C3 -6 2 -12 0 -15 C-2 -12 -3 -6 0 -1 Z" fill="#fbcfe8" stroke="#ec4899" strokeWidth="0.5" transform={`rotate(${rot})`} />
        ))}
        <circle cx="0" cy="-3" r="1.8" fill="#facc15" />
      </g>
    </>
  ),
});

const lionMane: Draw = (ctx) => {
  const lock = "M0 0 C-7 -8 -6 -22 0 -30 C6 -22 7 -8 0 0 Z";
  return {
    back: (
      <>
        <defs>
          <linearGradient id={ctx.id("mane")} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#7c2d12" />
            <stop offset="0.5" stopColor="#d97706" />
            <stop offset="1" stopColor="#fde68a" />
          </linearGradient>
          <linearGradient id={ctx.id("maneIn")} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#b45309" />
            <stop offset="1" stopColor="#fcd34d" />
          </linearGradient>
        </defs>
        <TalkGlow color="#f59e0b" r={70} />
        <Sway deg={4} dur={4}>
          {range(22).map((i) => {
            const deg = i * (360 / 22);
            const [x, y] = at(56, deg);
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${deg})`}>
                <path d={lock} fill={ctx.u("mane")} transform="scale(1.15 1.25)">
                  <animate attributeName="opacity" values="0.85;1;0.85" dur="1.6s" begin={`${(i % 5) * 0.3}s`} repeatCount="indefinite" />
                </path>
              </g>
            );
          })}
        </Sway>
        <Sway deg={5} dur={3.2} begin="0.8s">
          {range(22).map((i) => {
            const deg = i * (360 / 22) + 8;
            const [x, y] = at(51, deg);
            return <path key={i} d={lock} fill={ctx.u("maneIn")} transform={`translate(${x} ${y}) rotate(${deg}) scale(0.95)`} />;
          })}
        </Sway>
        <GoldRing ctx={ctx} name="lionRing" r={52} w={3.5} />
      </>
    ),
    front: (
      <>
        {[-1, 1].map((side) => {
          const [x, y] = at(50, side * 42);
          return (
            <g key={side} transform={`translate(${x} ${y}) rotate(${side * 42})`}>
              <path d="M-9 4 A9.5 10 0 0 1 9 4 Z" fill="#d97706" stroke="#7c2d12" strokeWidth="1" />
              <path d="M-5 3 A5 5.5 0 0 1 5 3 Z" fill="#fda4af" />
            </g>
          );
        })}
        <g className="se-talk">
          {range(6).map((i) => {
            const [x, y] = at(70, i * 60 + 20);
            return (
              <Rise key={i} x={x} y={y} dy={-20} dx={i % 2 ? 6 : -6} begin={`${i * 0.35}s`} dur={1.8}>
                <circle r="1.8" fill="#fde68a" />
              </Rise>
            );
          })}
        </g>
      </>
    ),
  };
};

const dragon: Draw = (ctx) => {
  const wing = (
    <g>
      <path
        d="M0 0 C-14 -30 -46 -44 -76 -34 C-66 -26 -62 -16 -64 -6 C-54 -12 -46 -10 -42 -2 C-34 -8 -26 -6 -22 2 C-14 -2 -6 0 0 6 Z"
        fill={ctx.u("wing")}
        stroke="#450a0a"
        strokeWidth="1.2"
      />
      <path d="M0 0 L-76 -34 M0 2 L-64 -6 M0 3 L-42 -2 M0 4 L-22 2" stroke="#fca5a5" strokeWidth="0.8" opacity="0.6" />
      <circle cx="-76" cy="-34" r="1.6" fill="#fde68a" />
    </g>
  );
  return {
    back: (
      <>
        <defs>
          <linearGradient id={ctx.id("wing")} x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#7f1d1d" />
            <stop offset="0.6" stopColor="#dc2626" />
            <stop offset="1" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id={ctx.id("flame")} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#dc2626" />
            <stop offset="0.5" stopColor="#f97316" />
            <stop offset="1" stopColor="#fde047" />
          </linearGradient>
        </defs>
        {[1, -1].map((side) => (
          <g key={side} transform={`translate(${C + side * -18} 96) scale(${side} 1)`}>
            <g>
              {wing}
              <animateTransform attributeName="transform" type="rotate" values="8;-12;8" keyTimes="0;0.5;1" {...ease} dur="1.6s" repeatCount="indefinite" />
            </g>
          </g>
        ))}
        <TalkGlow color="#f97316" />
        {range(16).map((i) => {
          const deg = i * 22.5;
          const [x, y] = at(53, deg);
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${deg})`}>
              <path d="M-5 2 C-5 -6 0 -9 0 -16 C3 -10 6 -6 5 2 Z" fill={ctx.u("flame")}>
                <animateTransform attributeName="transform" type="scale" values="1 0.8;1 1.2;1 0.8" dur={`${0.5 + (i % 4) * 0.12}s`} repeatCount="indefinite" />
              </path>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={51.5} fill="none" stroke="#7f1d1d" strokeWidth="3" />
      </>
    ),
    front: (
      <>
        <defs>
          <linearGradient id={ctx.id("horn")} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#a8a29e" />
            <stop offset="1" stopColor="#fafaf9" />
          </linearGradient>
        </defs>
        {[-1, 1].map((side) => {
          const [x, y] = at(48, side * 28);
          return (
            <path
              key={side}
              d="M-5 4 C-6 -8 -2 -18 6 -24 C2 -16 3 -6 5 4 Z"
              fill={ctx.u("horn")}
              stroke="#57534e"
              strokeWidth="0.8"
              transform={`translate(${x} ${y}) scale(${side} 1) rotate(${-12})`}
            />
          );
        })}
        <g className="se-talk">
          {range(7).map((i) => {
            const [x, y] = at(64, i * 51 + 10);
            return (
              <Rise key={i} x={x} y={y} dy={-26} dx={i % 2 ? 5 : -5} begin={`${i * 0.28}s`} dur={1.6}>
                <circle r="1.6" fill="#fde047" />
              </Rise>
            );
          })}
        </g>
      </>
    ),
  };
};

const foxfire: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <linearGradient id={ctx.id("tailFur")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#c2410c" />
          <stop offset="0.65" stopColor="#fb923c" />
          <stop offset="0.85" stopColor="#fff7ed" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* Nine tails fanning out behind */}
      {range(9).map((i) => {
        const rot = -96 + i * 24;
        return (
          <g key={i} transform={`rotate(${rot} 100 128)`}>
            <Sway deg={5} dur={2.4} cx={100} cy={128} begin={`${i * 0.2}s`}>
              <path
                d="M100 128 C86 108 80 76 90 48 C93 38 102 30 110 34 C106 40 112 46 106 54 C114 60 110 72 114 80 C110 92 110 108 100 128 Z"
                fill={ctx.u("tailFur")}
                stroke="#9a3412"
                strokeWidth="0.6"
                opacity="0.96"
              />
              <path d="M96 112 C90 92 90 70 96 52" fill="none" stroke="#fff7ed" strokeWidth="1" opacity="0.5" />
            </Sway>
          </g>
        );
      })}
      <TalkGlow color="#38bdf8" r={58} />
      <circle cx={C} cy={C} r={53} fill="none" stroke="#fff7ed" strokeWidth="2.5" />
    </>
  ),
  front: (
    <>
      <defs>
        <radialGradient id={ctx.id("wisp")} cx="0.5" cy="0.65" r="0.6">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[-1, 1].map((side) => {
        const [x, y] = at(49, side * 34);
        return (
          <g key={side} transform={`translate(${x} ${y}) rotate(${side * 34})`}>
            <path d="M-13 5 Q-10 -18 0 -28 Q10 -18 13 5 Z" fill="#f97316" stroke="#9a3412" strokeWidth="1" />
            <path d="M-7 3 Q-5 -11 0 -18 Q5 -11 7 3 Z" fill="#fff7ed" />
          </g>
        );
      })}
      <Spin dur={6}>
        {range(4).map((i) => {
          const [x, y] = at(64, i * 90 + 45);
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M0 -12 C5 -6 7 0 4 5 C2 8 -2 8 -4 5 C-7 0 -5 -6 0 -12 Z" fill={ctx.u("wisp")}>
                <animateTransform attributeName="transform" type="scale" values="0.85 0.9;1.1 1.15;0.85 0.9" dur={`${0.7 + i * 0.1}s`} repeatCount="indefinite" />
              </path>
            </g>
          );
        })}
      </Spin>
    </>
  ),
});

const Penguin: React.FC<{ wave?: boolean }> = ({ wave }) => (
  <g>
    <ellipse cx="0" cy="0" rx="10" ry="13" fill="#1f2937" />
    <ellipse cx="0" cy="2.5" rx="7" ry="10" fill="#f9fafb" />
    <circle cx="-3" cy="-6" r="1.4" fill="#111827" />
    <circle cx="3" cy="-6" r="1.4" fill="#111827" />
    <circle cx="-2.6" cy="-6.4" r="0.5" fill="#fff" />
    <circle cx="3.4" cy="-6.4" r="0.5" fill="#fff" />
    <path d="M-2.4 -3.6 L2.4 -3.6 L0 -0.8 Z" fill="#f59e0b" />
    <ellipse cx="-4" cy="13" rx="3.2" ry="1.4" fill="#f59e0b" />
    <ellipse cx="4" cy="13" rx="3.2" ry="1.4" fill="#f59e0b" />
    <ellipse cx="-3" cy="-1" rx="1.6" ry="1" fill="#fda4af" opacity="0.7" />
    <path d="M-9 -2 Q-15 4 -11 10 Q-9 4 -8 0 Z" fill="#1f2937" />
    <g>
      <path d="M9 -2 Q15 4 11 10 Q9 4 8 0 Z" fill="#1f2937" />
      {wave && <animateTransform attributeName="transform" type="rotate" values="0 9 -2;-50 9 -2;0 9 -2" dur="0.9s" repeatCount="indefinite" />}
    </g>
  </g>
);

const Snowflake: React.FC = () => (
  <g stroke="#e0f2fe" strokeWidth="0.9" strokeLinecap="round">
    {[0, 60, 120].map((rot) => (
      <path key={rot} d="M0 -4 V4 M-1.4 -2.8 L0 -1.6 L1.4 -2.8 M-1.4 2.8 L0 1.6 L1.4 2.8" transform={`rotate(${rot})`} fill="none" />
    ))}
  </g>
);

const penguins: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <Tube id={ctx.id("ice")} r={56} w={8} stops={["#0c4a6e", "#7dd3fc", "#ffffff", "#bae6fd", "#0e7490"]} />
        <linearGradient id={ctx.id("shard")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <TalkGlow color="#7dd3fc" />
      {range(9).map((i) => {
        const deg = -64 + i * 16;
        const [x, y] = at(58, deg);
        const len = i % 2 ? 9 : 15;
        return <path key={i} d={`M-3.5 0 L0 ${-len} L3.5 0 Z`} fill={ctx.u("shard")} stroke="#38bdf8" strokeWidth="0.5" transform={`translate(${x} ${y}) rotate(${deg})`} />;
      })}
      <circle cx={C} cy={C} r={56} fill="none" stroke={ctx.u("ice")} strokeWidth="8" />
    </>
  ),
  front: (
    <>
      {range(6).map((i) => (
        <g key={i} opacity="0.9">
          <g transform={`translate(${30 + i * 28} 0)`}>
            <Snowflake />
          </g>
          <animateTransform attributeName="transform" type="translate" values={`0 ${10 + (i % 3) * 8};${i % 2 ? 6 : -6} 190`} dur={`${5 + (i % 3)}s`} begin={`${-i * 1.1}s`} repeatCount="indefinite" />
        </g>
      ))}
      <g transform="translate(44 148) rotate(-8) scale(1.35)">
        <Penguin />
      </g>
      <g transform="translate(157 146) rotate(8) scale(1.35)">
        <Penguin wave />
      </g>
    </>
  ),
});

// ----- Imperial ------------------------------------------------------------------------------------------------

const CROWN = "M-24 0 L-27 -20 L-19.5 -8 L-13 -27 L-6.5 -12 L0 -35 L6.5 -12 L13 -27 L19.5 -8 L27 -20 L24 0 Z";

const crown: Draw = (ctx) => ({
  back: (
    <>
      <TalkGlow color="#facc15" />
      <GoldRing ctx={ctx} name="crownRing" r={55} w={7} />
      <circle cx={C} cy={C} r={60} fill="none" stroke={ctx.u("gold")} strokeWidth="0.9" strokeDasharray="2 2.5" />
      <circle cx={C} cy={C} r={50.8} fill="none" stroke="#fff3c4" strokeWidth="0.8" />
      {range(12).map((i) => {
        const [x, y] = at(55, i * 30 + 15);
        const kinds = ["ruby", "sapphire", "emerald"] as const;
        return <Gem key={i} ctx={ctx} x={x} y={y} r={2.4} kind={kinds[i % 3]} begin={`${i * 0.25}s`} />;
      })}
    </>
  ),
  front: (
    <>
      <defs>
        <clipPath id={ctx.id("crownClip")}>
          <path d={CROWN} />
          <rect x="-26" y="-2" width="52" height="9" rx="2" />
        </clipPath>
        <linearGradient id={ctx.id("shine")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(100 50)">
        <g>
          <g className="se-talk">
            {range(9).map((i) => (
              <path key={i} d="M-1.2 -36 L0 -52 L1.2 -36 Z" fill="#fde68a" opacity="0.8" transform={`rotate(${-60 + i * 15} 0 -14)`} />
            ))}
          </g>
          <path d={CROWN} fill={ctx.u("goldH")} stroke="#7a4f05" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M-20 -3 L-22 -15 M-11 -5 L-12 -20 M0 -6 L0 -26 M11 -5 L12 -20 M20 -3 L22 -15" stroke="#fff7d1" strokeWidth="0.8" opacity="0.7" />
          <rect x="-26" y="-2" width="52" height="9" rx="2" fill={ctx.u("gold")} stroke="#7a4f05" strokeWidth="1.2" />
          <Gem ctx={ctx} x={0} y={2.5} r={3} kind="ruby" begin="0s" />
          <Gem ctx={ctx} x={-14} y={2.5} r={2.3} kind="sapphire" />
          <Gem ctx={ctx} x={14} y={2.5} r={2.3} kind="sapphire" />
          <Gem ctx={ctx} x={0} y={-17} r={2.6} kind="emerald" begin="0.8s" />
          {[
            [-27, -20],
            [-13, -27],
            [0, -35],
            [13, -27],
            [27, -20],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="2.6" fill={ctx.u("pearl")} stroke="#a8a29e" strokeWidth="0.4" />
          ))}
          <g clipPath={ctx.u("crownClip")}>
            <rect x="-60" y="-40" width="18" height="50" fill={ctx.u("shine")} transform="skewX(-20)">
              <animate attributeName="x" values="-60;60" dur="2.6s" repeatCount="indefinite" />
            </rect>
          </g>
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" keyTimes="0;0.5;1" {...ease} dur="2.4s" repeatCount="indefinite" />
        </g>
      </g>
      <Sparkle x={140} y={22} s={5} />
      <Sparkle x={62} y={30} s={4} begin="0.7s" />
      <Sparkle x={150} y={150} s={4} begin="1.2s" />
    </>
  ),
});

const laurel: Draw = (ctx) => {
  const leaf = "M0 0 C5 -4 5.5 -11 0 -16 C-5.5 -11 -5 -4 0 0 Z";
  const side = (dir: 1 | -1) =>
    range(9).map((i) => {
      const deg = dir === -1 ? 194 + i * 16 : 166 - i * 16;
      const [x, y] = at(60, deg);
      const along = deg + dir * 90 * -1;
      return (
        <g key={`${dir}-${i}`} transform={`translate(${x} ${y})`}>
          <path d={leaf} fill={ctx.u("leaf")} stroke="#7a4f05" strokeWidth="0.5" transform={`rotate(${along - dir * 38}) scale(${1 - i * 0.03})`} />
          <path d={leaf} fill={ctx.u("leaf")} stroke="#7a4f05" strokeWidth="0.5" transform={`rotate(${along + dir * 38}) scale(${0.92 - i * 0.03})`} />
        </g>
      );
    });
  return {
    back: (
      <>
        <TalkGlow color="#facc15" />
        <circle cx={C} cy={C} r={52} fill="none" stroke={ctx.u("gold")} strokeWidth="2" />
      </>
    ),
    front: (
      <>
        <defs>
          <linearGradient id={ctx.id("leaf")} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#9c6b0a" />
            <stop offset="0.45" stopColor="#f6d365" />
            <stop offset="0.6" stopColor="#fffbe6" />
            <stop offset="1" stopColor="#c8921a" />
          </linearGradient>
        </defs>
        <Sway deg={2.5} dur={3.4}>
          <path d={`M${at(60, 194).join(" ")} A60 60 0 0 1 ${at(60, 334).join(" ")}`} fill="none" stroke="#9c6b0a" strokeWidth="1.6" />
          <path d={`M${at(60, 166).join(" ")} A60 60 0 0 0 ${at(60, 26).join(" ")}`} fill="none" stroke="#9c6b0a" strokeWidth="1.6" />
          {side(-1)}
          {side(1)}
        </Sway>
        {/* Ribbon */}
        <g transform="translate(100 160)">
          <path d="M-3 0 L-14 14 L-9 13 L-7 18 L1 3 Z M3 0 L14 14 L9 13 L7 18 L-1 3 Z" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="0.6" />
          <path d="M0 0 C-9 -8 -16 -2 -11 3 C-7 6 -2 2 0 0 C2 2 7 6 11 3 C16 -2 9 -8 0 0 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.6" />
          <circle r="3" fill={ctx.u("gold")} />
        </g>
        <Sparkle x={58} y={40} s={4} />
        <Sparkle x={144} y={44} s={4.5} begin="0.9s" />
      </>
    ),
  };
};

const sunKing: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <radialGradient id={ctx.id("sunGlow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.5" stopColor="#fde047" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ctx.id("ray")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="0.5" stopColor="#facc15" />
          <stop offset="1" stopColor="#fffbe6" />
        </linearGradient>
      </defs>
      <circle cx={C} cy={C} r={96} fill={ctx.u("sunGlow")} />
      <Spin dur={40}>
        {range(32).map((i) => {
          const deg = i * 11.25;
          const long = i % 2 === 0;
          return (
            <path key={i} d={`M-4.2 0 L0 ${long ? -40 : -24} L4.2 0 Z`} fill={ctx.u("ray")} transform={`rotate(${deg} ${C} ${C}) translate(${C} ${C - 53})`} />
          );
        })}
      </Spin>
      <g className="se-talk">
        <Spin dur={20} reverse>
          {range(16).map((i) => (
            <path key={i} d="M-1.4 0 L0 -36 L1.4 0 Z" fill="#fffbe6" opacity="0.7" transform={`rotate(${i * 22.5 + 5.6} ${C} ${C}) translate(${C} ${C - 54})`} />
          ))}
        </Spin>
      </g>
      <GoldRing ctx={ctx} name="sunRing" r={53.5} w={6} />
      {range(8).map((i) => {
        const [x, y] = at(53.5, i * 45);
        return <circle key={i} cx={x} cy={y} r="1.6" fill="#fffbe6" />;
      })}
    </>
  ),
  front: (
    <>
      <Sparkle x={36} y={52} s={4} />
      <Sparkle x={166} y={60} s={5} begin="0.6s" />
      <Sparkle x={150} y={162} s={4} begin="1.1s" />
    </>
  ),
});

const royalVelvet: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <Tube id={ctx.id("velvet")} r={57} w={13} stops={["#2e0854", "#6b21a8", "#c084fc", "#7e22ce", "#2e0854"]} />
      </defs>
      <TalkGlow color="#c084fc" r={66} />
      <circle cx={C} cy={C} r={57} fill="none" stroke={ctx.u("velvet")} strokeWidth="13" />
      <circle cx={C} cy={C} r={50.6} fill="none" stroke={ctx.u("gold")} strokeWidth="1.6" />
      <circle cx={C} cy={C} r={63.4} fill="none" stroke={ctx.u("gold")} strokeWidth="1.6" />
      <circle cx={C} cy={C} r={57} fill="none" stroke="#f6d365" strokeWidth="0.7" strokeDasharray="0.1 3.4" strokeLinecap="round" opacity="0.9" />
      {range(28).map((i) => {
        const [x, y] = at(66.6, i * (360 / 28));
        return <circle key={i} cx={x} cy={y} r="2" fill={ctx.u("pearl")} />;
      })}
    </>
  ),
  front: (
    <>
      {[90, 180, 270].map((deg, i) => {
        const [x, y] = at(57, deg);
        return <Gem key={deg} ctx={ctx} x={x} y={y} r={3.2} kind={i === 1 ? "ruby" : "sapphire"} begin={`${i * 0.5}s`} />;
      })}
      {/* Fleur-de-lis */}
      <g transform="translate(100 42) scale(1.15)">
        <path d="M0 -16 C5 -10 5 -3 0 3 C-5 -3 -5 -10 0 -16 Z" fill={ctx.u("goldH")} stroke="#7a4f05" strokeWidth="0.7" />
        <path d="M-1 1 C-6 0 -12 -5 -10 -11 C-8 -6 -5 -4 -1 -3 Z" fill={ctx.u("goldH")} stroke="#7a4f05" strokeWidth="0.7" />
        <path d="M1 1 C6 0 12 -5 10 -11 C8 -6 5 -4 1 -3 Z" fill={ctx.u("goldH")} stroke="#7a4f05" strokeWidth="0.7" />
        <rect x="-7" y="1" width="14" height="3" rx="1" fill={ctx.u("gold")} stroke="#7a4f05" strokeWidth="0.6" />
        <path d="M-2 4 L-4 9 M2 4 L4 9 M0 4 V9" stroke="#c8921a" strokeWidth="1.4" />
      </g>
      <Sparkle x={128} y={36} s={4} begin="0.4s" />
    </>
  ),
});

const mughal: Draw = (ctx) => {
  // A cusped arch: an ogee outline and a scalloped inner edge, with a lattice between
  const outer = "M30 156 V92 C30 58 68 46 100 14 C132 46 170 58 170 92 V156";
  const inner = "M42 156 V96 C42 66 76 58 100 30 C124 58 158 66 158 96 V156";
  return {
    back: (
      <>
        <defs>
          <pattern id={ctx.id("jali")} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="#7a3e0b" />
            <rect x="1" y="1" width="5" height="5" fill="none" stroke="#f6d365" strokeWidth="0.9" />
          </pattern>
        </defs>
        <TalkGlow color="#fbbf24" r={58} />
        <path d={`${outer} H158 V96 C158 66 124 58 100 30 C76 58 42 66 42 96 V156 Z`} fill={ctx.u("jali")} opacity="0.95" />
        <circle cx={C} cy={C} r={52} fill="none" stroke={ctx.u("gold")} strokeWidth="2.4" />
      </>
    ),
    front: (
      <>
        <path d={outer} fill="none" stroke={ctx.u("gold")} strokeWidth="4" strokeLinejoin="round" filter={ctx.u("glow")} />
        <path d={inner} fill="none" stroke={ctx.u("gold")} strokeWidth="2" />
        {/* Scallops along the inner arch */}
        {range(9).map((i) => {
          const t = i / 8;
          const deg = -62 + t * 124;
          const [x, y] = at(64, deg);
          return <circle key={i} cx={x} cy={y + 8} r="2.2" fill="none" stroke="#fde68a" strokeWidth="1" />;
        })}
        {/* Pillar capitals and bases */}
        {[36, 164].map((x) => (
          <g key={x}>
            <rect x={x - 8} y="86" width="16" height="5" rx="1.5" fill={ctx.u("gold")} />
            <rect x={x - 8} y="152" width="16" height="6" rx="1.5" fill={ctx.u("gold")} />
            {/* Marigold string down the pillar */}
            {range(7).map((i) => (
              <circle key={i} cx={x} cy={97 + i * 8} r="3" fill={i % 2 ? "#f97316" : "#facc15"} stroke="#c2410c" strokeWidth="0.4" />
            ))}
          </g>
        ))}
        {/* Kalash finial on the apex */}
        <g transform="translate(100 12)">
          <path d="M-5 2 C-6 -4 6 -4 5 2 Z" fill={ctx.u("gold")} />
          <circle cy="-5" r="3" fill={ctx.u("gold")} />
          <path d="M0 -8 V-14" stroke={ctx.u("gold")} strokeWidth="1.4" />
          <circle cy="-15" r="1.6" fill="#fde68a">
            <Twinkle dur={1.4} from={0.4} />
          </circle>
        </g>
        <Sparkle x={58} y={50} s={3.5} begin="0.5s" />
        <Sparkle x={146} y={58} s={4} begin="1.1s" />
      </>
    ),
  };
};

const pharaoh: Draw = (ctx) => {
  const COLORS = ["#d4a017", "#1e3a8a", "#14b8a6", "#d4a017", "#b91c1c"];
  return {
    back: (
      <>
        <TalkGlow color="#facc15" />
        {/* Usekh collar around the lower half */}
        {range(22).map((i) => {
          const a0 = 96 + i * 7.6;
          const a1 = a0 + 7.6;
          const p = [at(52, a0), at(72, a0), at(72, a1), at(52, a1)];
          return (
            <path
              key={i}
              d={`M${p[0].join(" ")} L${p[1].join(" ")} A72 72 0 0 1 ${p[2].join(" ")} L${p[3].join(" ")} A52 52 0 0 0 ${p[0].join(" ")} Z`}
              fill={COLORS[i % COLORS.length]}
              stroke="#78350f"
              strokeWidth="0.5"
            />
          );
        })}
        {[57, 62, 67].map((r) => (
          <path key={r} d={`M${at(r, 96).join(" ")} A${r} ${r} 0 0 1 ${at(r, 264).join(" ")}`} fill="none" stroke="#fde68a" strokeWidth="0.8" opacity="0.9" />
        ))}
        {range(11).map((i) => {
          const [x, y] = at(76, 104 + i * 15.2);
          return <path key={i} d="M0 -3 C3 0 2.5 4 0 5.5 C-2.5 4 -3 0 0 -3 Z" fill={i % 2 ? "#1e3a8a" : "#d4a017"} transform={`translate(${x} ${y}) rotate(${104 + i * 15.2 + 180})`} />;
        })}
        <GoldRing ctx={ctx} name="nemes" r={52} w={4} />
      </>
    ),
    front: (
      <>
        {/* Winged sun disk */}
        <g transform="translate(100 34)">
          {[1, -1].map((side) => (
            <g key={side} transform={`scale(${side} 1)`}>
              <g>
                <path d="M6 -2 C22 -14 46 -16 68 -8 C50 -6 30 -2 8 6 Z" fill={ctx.u("goldH")} stroke="#7a4f05" strokeWidth="0.6" />
                <path d="M8 3 C26 -4 44 -5 62 -1 C44 2 28 6 10 10 Z" fill="#1e3a8a" stroke="#7a4f05" strokeWidth="0.5" />
                <path d="M10 8 C24 4 38 4 52 7 C38 9 24 12 12 14 Z" fill="#14b8a6" stroke="#7a4f05" strokeWidth="0.5" />
                {range(6).map((i) => (
                  <path key={i} d={`M${16 + i * 8} -7 L${18 + i * 8} 5`} stroke="#7a4f05" strokeWidth="0.5" opacity="0.6" />
                ))}
                <animateTransform attributeName="transform" type="rotate" values="0 6 0;-5 6 0;0 6 0" keyTimes="0;0.5;1" {...ease} dur="2.2s" repeatCount="indefinite" />
              </g>
            </g>
          ))}
          <circle r="9" fill="#dc2626" stroke={ctx.u("gold")} strokeWidth="2.4" />
          <circle cx="-2.5" cy="-3" r="2.4" fill="#fff" opacity="0.5" />
          {[-1, 1].map((side) => (
            <path key={side} d="M0 8 C-1 12 2 14 1 18" stroke="#d4a017" strokeWidth="2" fill="none" transform={`translate(${side * 6} -2)`} />
          ))}
        </g>
        <Sparkle x={100} y={14} s={5} />
        <Sparkle x={36} y={40} s={3.5} begin="0.8s" />
        <Sparkle x={164} y={40} s={3.5} begin="1.4s" />
      </>
    ),
  };
};

const jadeEmperor: Draw = (ctx) => {
  const cloud = "M-11 2 C-11 -6 -2 -6 -2 0 C-2 3 -6 3 -6 0 M-2 0 C-2 -9 9 -9 9 0 C9 4 3 4 3 1 M9 0 C13 0 14 5 10 7";
  return {
    back: (
      <>
        <defs>
          <Tube id={ctx.id("lacquer")} r={56} w={9} stops={["#450a0a", "#b91c1c", "#fca5a5", "#dc2626", "#450a0a"]} />
        </defs>
        <circle cx={C} cy={C} r={51} fill="none" stroke="#34d399" strokeWidth="5" opacity="0.6" filter={ctx.u("haze")} />
        <TalkGlow color="#34d399" />
        <circle cx={C} cy={C} r={56} fill="none" stroke={ctx.u("lacquer")} strokeWidth="9" />
        <circle cx={C} cy={C} r={51.2} fill="none" stroke={ctx.u("gold")} strokeWidth="1.4" />
        <circle cx={C} cy={C} r={60.8} fill="none" stroke={ctx.u("gold")} strokeWidth="1.4" />
        {range(24).map((i) => {
          const [x, y] = at(56, i * 15 + 7.5);
          return <path key={i} d="M-1.6 0 L0 -1.6 L1.6 0 L0 1.6 Z" fill="#f6d365" transform={`translate(${x} ${y})`} />;
        })}
        {/* Lanterns */}
        {[128, 232].map((deg, i) => {
          const [x, y] = at(64, deg);
          return (
            <Sway key={deg} deg={7} dur={2.6} cx={x} cy={y - 8} begin={`${i * 1.3}s`}>
              <g transform={`translate(${x} ${y})`}>
                <path d="M0 -8 V-3" stroke="#f6d365" strokeWidth="0.8" />
                <rect x="-4.5" y="-3.5" width="9" height="2" rx="0.8" fill={ctx.u("gold")} />
                <ellipse cx="0" cy="4" rx="6.5" ry="7" fill="#dc2626" />
                <path d="M-3 -2 Q-4.5 4 -3 10 M3 -2 Q4.5 4 3 10" stroke="#f59e0b" strokeWidth="0.6" fill="none" />
                <rect x="-4.5" y="10" width="9" height="2" rx="0.8" fill={ctx.u("gold")} />
                <path d="M0 12 V17 M-1.5 12 V16 M1.5 12 V16" stroke="#f59e0b" strokeWidth="0.6" />
              </g>
            </Sway>
          );
        })}
      </>
    ),
    front: (
      <>
        <defs>
          <linearGradient id={ctx.id("phoenix")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#dc2626" />
            <stop offset="0.5" stopColor="#f97316" />
            <stop offset="1" stopColor="#fde047" />
          </linearGradient>
        </defs>
        {[45, 135, 225, 315].map((deg) => {
          const [x, y] = at(60, deg);
          return <path key={deg} d={cloud} transform={`translate(${x} ${y}) rotate(${deg > 180 ? -10 : 10})`} fill="none" stroke={ctx.u("gold")} strokeWidth="2" strokeLinecap="round" />;
        })}
        <Spin dur={7}>
          <g transform={`translate(${C} ${C - 66}) scale(1.45)`}>
            {/* Tail feathers trailing behind (−x), body and wings heading +x */}
            {[-10, 0, 10].map((tilt, i) => (
              <path key={tilt} d={`M-6 0 C-18 ${tilt * 0.4} -26 ${tilt} -38 ${tilt * 1.4}`} stroke={ctx.u("phoenix")} strokeWidth={2.4 - i * 0.4} fill="none" strokeLinecap="round" />
            ))}
            {[-10, 0, 10].map((tilt) => (
              <circle key={tilt} cx="-38" cy={tilt * 1.4} r="2" fill="#fde047" />
            ))}
            <ellipse cx="0" cy="0" rx="8" ry="4.5" fill={ctx.u("phoenix")} />
            <circle cx="8" cy="-2" r="3.4" fill="#f97316" />
            <path d="M11 -2.5 L15 -1.5 L11 -0.5 Z" fill="#fde047" />
            <g>
              <path d="M-2 -2 C-6 -14 4 -18 6 -6 Z" fill="#fde047" stroke="#f97316" strokeWidth="0.6" />
              <animateTransform attributeName="transform" type="rotate" values="0 0 -2;40 0 -2;0 0 -2" dur="0.6s" repeatCount="indefinite" />
            </g>
          </g>
        </Spin>
        <Sparkle x={150} y={36} s={4} color="#fde68a" />
      </>
    ),
  };
};

// ----- Nature and magic ----------------------------------------------------------------------------------------

const Blossom: React.FC<{ ctx: Ctx; s?: number }> = ({ ctx, s = 1 }) => (
  <g transform={`scale(${s})`}>
    {range(5).map((i) => (
      <path key={i} d="M0 0 C-4 -3 -4.5 -8 -1.5 -9.5 L0 -8 L1.5 -9.5 C4.5 -8 4 -3 0 0 Z" fill={ctx.u("petal")} stroke="#f472b6" strokeWidth="0.4" transform={`rotate(${i * 72})`} />
    ))}
    <circle r="2.2" fill="#be185d" />
    {range(5).map((i) => (
      <circle key={i} cx={Math.sin((i * 72 * Math.PI) / 180) * 3.4} cy={-Math.cos((i * 72 * Math.PI) / 180) * 3.4} r="0.7" fill="#fde047" />
    ))}
  </g>
);

const Petal: React.FC<{ ctx: Ctx }> = ({ ctx }) => <path d="M0 0 C-3 -2 -3.5 -6 -1 -7 L0 -6 L1 -7 C3.5 -6 3 -2 0 0 Z" fill={ctx.u("petal")} />;

const sakura: Draw = (ctx) => {
  const falling = (n: number, offset: number) =>
    range(n).map((i) => {
      const x = 24 + ((i * 37 + offset) % 150);
      return (
        <g key={`${offset}-${i}`}>
          <g transform={`translate(${x} 0)`}>
            <g>
              <Petal ctx={ctx} />
              <animateTransform attributeName="transform" type="rotate" values="0;360" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
            </g>
          </g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`0 10;${i % 2 ? 14 : -14} 100;${i % 2 ? -6 : 6} 196`}
            dur={`${4.5 + (i % 4) * 0.6}s`}
            begin={`${-i * 0.9 - offset * 0.05}s`}
            repeatCount="indefinite"
          />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur={`${4.5 + (i % 4) * 0.6}s`} begin={`${-i * 0.9 - offset * 0.05}s`} repeatCount="indefinite" />
        </g>
      );
    });
  return {
    back: (
      <>
        <defs>
          <Tube id={ctx.id("blush")} r={54} w={4} stops={["#9d174d", "#f9a8d4", "#fff1f7", "#f472b6", "#9d174d"]} />
        </defs>
        <TalkGlow color="#f9a8d4" />
        <circle cx={C} cy={C} r={54} fill="none" stroke={ctx.u("blush")} strokeWidth="4" />
      </>
    ),
    front: (
      <>
        <defs>
          <radialGradient id={ctx.id("petal")} cx="0.5" cy="0.9" r="0.9">
            <stop offset="0" stopColor="#ec4899" />
            <stop offset="0.45" stopColor="#f9a8d4" />
            <stop offset="1" stopColor="#fff1f7" />
          </radialGradient>
        </defs>
        {/* A blossoming branch round the upper left */}
        <path d="M40 156 C22 120 24 74 52 46 C66 32 82 26 96 24" fill="none" stroke="#5b3a29" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M34 92 C26 84 22 76 24 66 M58 42 C56 32 60 24 66 20" fill="none" stroke="#5b3a29" strokeWidth="1.8" strokeLinecap="round" />
        {[
          [38, 132, 1.1],
          [30, 100, 1],
          [24, 66, 0.85],
          [42, 62, 1.05],
          [66, 20, 0.8],
          [62, 38, 1],
          [92, 24, 0.9],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <Sway deg={6} dur={3} cx={0} cy={0} begin={`${i * 0.4}s`}>
              <Blossom ctx={ctx} s={s} />
            </Sway>
          </g>
        ))}
        {[
          [50, 150],
          [80, 30],
        ].map(([x, y]) => (
          <ellipse key={x} cx={x} cy={y} rx="2.4" ry="3.2" fill="#f472b6" />
        ))}
        {falling(6, 0)}
        <g className="se-talk">{falling(5, 19)}</g>
      </>
    ),
  };
};

const borsha: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <Tube id={ctx.id("pond")} r={57} w={10} stops={["#0f3b5f", "#2563eb", "#93c5fd", "#3b82f6", "#0f3b5f"]} />
        <linearGradient id={ctx.id("drop")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bae6fd" stopOpacity="0" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <circle cx={C} cy={C} r={57} fill="none" stroke={ctx.u("pond")} strokeWidth="10" />
      {range(12).map((i) => {
        const x = 34 + ((i * 29) % 136);
        return (
          <rect key={i} x={x} y="0" width="1.6" height="12" rx="0.8" fill={ctx.u("drop")}>
            <animate attributeName="y" values="30;180" dur={`${0.9 + (i % 4) * 0.12}s`} begin={`${-i * 0.17}s`} repeatCount="indefinite" />
          </rect>
        );
      })}
      <Ripples color="#93c5fd" from={58} to={86} />
    </>
  ),
  front: (
    <>
      <defs>
        <linearGradient id={ctx.id("cloud")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id={ctx.id("lily")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f9a8d4" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* Rain cloud */}
      <g transform="translate(138 34)">
        <g>
          <path d="M-26 8 C-34 8 -34 -4 -25 -4 C-24 -14 -10 -16 -6 -8 C-2 -18 16 -18 16 -6 C26 -8 30 6 20 8 Z" fill={ctx.u("cloud")} stroke="#64748b" strokeWidth="0.8" />
          <g className="se-talk">
            <path d="M-2 8 L-7 18 L-2 17 L-6 27 L4 14 L-1 15 L3 8 Z" fill="#fde047">
              <animate attributeName="opacity" values="0;0;1;0;1;0;0" keyTimes="0;0.6;0.64;0.68;0.72;0.76;1" dur="2.4s" repeatCount="indefinite" />
            </path>
          </g>
          <animateTransform attributeName="transform" type="translate" values="0 0;-4 0;0 0" keyTimes="0;0.5;1" {...ease} dur="4s" repeatCount="indefinite" />
        </g>
      </g>
      {/* Shapla (water lilies) on their pads */}
      {[
        [44, 150, 1],
        [158, 152, 0.85],
      ].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M0 0 m-14 4 a14 6 0 1 0 28 0 a14 6 0 1 0 -28 0 Z M0 4 L13 1 L13 6 Z" fill="#16a34a" fillRule="evenodd" />
          {[-60, -30, 0, 30, 60].map((rot) => (
            <path key={rot} d="M0 2 C3 -4 3 -11 0 -15 C-3 -11 -3 -4 0 2 Z" fill={ctx.u("lily")} stroke="#ec4899" strokeWidth="0.4" transform={`rotate(${rot})`} />
          ))}
          {[-15, 15].map((rot) => (
            <path key={rot} d="M0 1 C2.5 -4 2.5 -9 0 -12 C-2.5 -9 -2.5 -4 0 1 Z" fill="#fff" transform={`rotate(${rot})`} />
          ))}
          <circle cx="0" cy="-2" r="2" fill="#facc15" />
        </g>
      ))}
    </>
  ),
});

const aurora: Draw = (ctx) => ({
  back: (
    <>
      <defs>
        <linearGradient id={ctx.id("auroraA")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="0.4" stopColor="#2dd4bf" />
          <stop offset="0.7" stopColor="#818cf8" />
          <stop offset="1" stopColor="#e879f9" />
        </linearGradient>
        <linearGradient id={ctx.id("auroraB")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a3e635" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      {[
        { r: 62, w: 12, g: "auroraA", dur: 9, sx: "1 0.9;0.92 1.04;1 0.9" },
        { r: 70, w: 9, g: "auroraB", dur: 13, sx: "0.94 1.04;1.04 0.92;0.94 1.04", reverse: true },
        { r: 56, w: 7, g: "auroraA", dur: 7, sx: "1.02 0.98;0.98 1.02;1.02 0.98" },
      ].map((band) => (
        <Spin key={band.r} dur={band.dur} reverse={band.reverse}>
          <g opacity="0.85">
            <ellipse cx={C} cy={C} rx={band.r} ry={band.r * 0.92} fill="none" stroke={ctx.u(band.g)} strokeWidth={band.w} filter={ctx.u("haze")} />
            <ellipse cx={C} cy={C} rx={band.r} ry={band.r * 0.92} fill="none" stroke={ctx.u(band.g)} strokeWidth={band.w * 0.25} opacity="0.9" />
          </g>
        </Spin>
      ))}
      <g className="se-talk">
        <circle cx={C} cy={C} r={60} fill="none" stroke={ctx.u("auroraB")} strokeWidth="18" opacity="0.35" filter={ctx.u("haze")}>
          <animate attributeName="r" values="56;66;56" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </g>
      <circle cx={C} cy={C} r={51.5} fill="none" stroke="#f0fdfa" strokeWidth="1.6" opacity="0.9" />
    </>
  ),
  front: (
    <>
      {[
        [30, 48, 3.5, "0s"],
        [168, 70, 4, "0.6s"],
        [44, 160, 3, "1.2s"],
        [160, 150, 3.5, "1.8s"],
        [100, 18, 4, "0.9s"],
      ].map(([x, y, s, begin]) => (
        <Sparkle key={String(begin)} x={x as number} y={y as number} s={s as number} color="#ecfeff" begin={begin as string} />
      ))}
    </>
  ),
});

const galaxy: Draw = (ctx) => {
  const orbits = [
    { rx: 76, ry: 22, tilt: -24, dur: 6, planet: ["#fde68a", "#d97706"], pr: 5 },
    { rx: 70, ry: 30, tilt: 32, dur: 9, planet: ["#93c5fd", "#1d4ed8"], pr: 6 },
    { rx: 84, ry: 16, tilt: 72, dur: 12, planet: ["#f9a8d4", "#9d174d"], pr: 4 },
  ];
  const ellipse = (rx: number, ry: number) => `M${C - rx} ${C} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  return {
    back: (
      <>
        <defs>
          <radialGradient id={ctx.id("nebula")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.5" stopColor="#4c1d95" stopOpacity="0" />
            <stop offset="0.62" stopColor="#7c3aed" stopOpacity="0.7" />
            <stop offset="0.78" stopColor="#2563eb" stopOpacity="0.35" />
            <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
          <Tube id={ctx.id("cosmos")} r={53} w={4} stops={["#1e1b4b", "#6366f1", "#e0e7ff", "#8b5cf6", "#1e1b4b"]} />
        </defs>
        <Spin dur={30}>
          <circle cx={C} cy={C} r={92} fill={ctx.u("nebula")} />
        </Spin>
        {orbits.map((o) => (
          <ellipse key={o.tilt} cx={C} cy={C} rx={o.rx} ry={o.ry} fill="none" stroke="#c7d2fe" strokeWidth="0.7" opacity="0.45" transform={`rotate(${o.tilt} ${C} ${C})`} />
        ))}
        <defs>
          {orbits.map((o, i) => (
            <radialGradient key={i} id={ctx.id(`planet${i}`)} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.3" stopColor={o.planet[0]} />
              <stop offset="1" stopColor={o.planet[1]} />
            </radialGradient>
          ))}
        </defs>
        <TalkGlow color="#8b5cf6" />
        <circle cx={C} cy={C} r={53} fill="none" stroke={ctx.u("cosmos")} strokeWidth="4" />
        {/* Planets travel behind the avatar, so they vanish behind the face and reappear */}
        {orbits.map((o, i) => (
          <g key={o.tilt} transform={`rotate(${o.tilt} ${C} ${C})`}>
            <g>
              <circle r={o.pr} fill={ctx.u(`planet${i}`)} />
              {i === 1 && <ellipse rx={o.pr * 2} ry={o.pr * 0.6} fill="none" stroke="#fde68a" strokeWidth="1.2" transform="rotate(-20)" />}
              <animateMotion dur={`${o.dur}s`} repeatCount="indefinite" path={ellipse(o.rx, o.ry)} begin={`${-i * 2}s`} />
            </g>
          </g>
        ))}
      </>
    ),
    front: (
      <>
        {[
          [26, 40, "0s"],
          [176, 52, "0.5s"],
          [20, 140, "1s"],
          [178, 150, "1.5s"],
          [96, 10, "0.8s"],
          [120, 190, "1.2s"],
        ].map(([x, y, begin]) => (
          <Sparkle key={String(begin)} x={x as number} y={y as number} s={3} color="#e0e7ff" begin={begin as string} />
        ))}
        <g className="se-talk">
          <path d="M20 30 L52 46" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0">
            <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;0.08;0.2;1" dur="2.4s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0 0;40 20;40 20" keyTimes="0;0.2;1" dur="2.4s" repeatCount="indefinite" />
          </path>
        </g>
      </>
    ),
  };
};

const DRAW: Partial<Record<SpeakingEffectId, Draw>> = {
  "cat-ears": catEars,
  butterflies,
  bee,
  songbirds,
  koi,
  "lion-mane": lionMane,
  dragon,
  foxfire,
  penguins,
  crown,
  laurel,
  "sun-king": sunKing,
  "royal-velvet": royalVelvet,
  mughal,
  pharaoh,
  "jade-emperor": jadeEmperor,
  sakura,
  borsha,
  aurora,
  galaxy,
};

/** The original speaking halo: shown only while talking (it has no frame) */
const classic = (layer: "back" | "front") =>
  layer === "back" ? (
    <div className="se-classic se-talk">
      <span className="vr-halo-glow" />
      <span className="vr-halo-ripple" />
      <span className="vr-halo-ripple" />
      <span className="vr-halo-ring" />
    </div>
  ) : null;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const SpeakingEffect: React.FC<SpeakingEffectProps> = ({ effect, layer, size, level, talking = false }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const draw = DRAW[effect];

  // Animations run in the SVG itself; people who asked their system for less motion get the frame standing still
  useEffect(() => {
    if (prefersReducedMotion()) svg.current?.pauseAnimations?.();
  }, [effect]);

  const swell = 1 + Math.max(0, Math.min(1, talking ? level : 0)) * 0.07;
  const style: React.CSSProperties = { width: size * 2, height: size * 2, ["--se-swell" as string]: swell };

  if (!draw) {
    const content = classic(layer);
    return content ? (
      <div aria-hidden className="se-frame" data-talking={talking} style={{ width: size, height: size, ["--se-swell" as string]: swell } as React.CSSProperties}>
        {content}
      </div>
    ) : null;
  }

  const ctx: Ctx = { id: (name) => `${uid}-${name}`, u: (name) => `url(#${uid}-${name})` };
  const parts = draw(ctx);
  const content = layer === "back" ? parts.back : parts.front;
  if (!content) return null;
  return (
    <div aria-hidden className="se-frame se-frame-art" data-talking={talking} style={style}>
      <svg ref={svg} viewBox="0 0 200 200" width="100%" height="100%" overflow="visible">
        <defs>
          <SharedDefs ctx={ctx} />
        </defs>
        <g className="se-swell">{content}</g>
      </svg>
    </div>
  );
};
