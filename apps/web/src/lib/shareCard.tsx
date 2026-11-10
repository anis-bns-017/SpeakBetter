// apps/web/src/lib/shareCard.tsx
/**
 * Share cards: a picture of an achievement (a new badge, a league result, your progress) that a learner can
 * post to a story or send to a friend. Drawn on a canvas in the browser, so it needs no server, no paid
 * service and works offline. Nothing is uploaded: the picture goes straight to the share sheet or a download.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { Trophy, type LucideIcon } from "lucide-react";
import { badgeIconFor } from "../components/gamification/badgeIcons";
import { TIER_STYLE } from "../components/gamification/tiers";
import type { BadgeTier } from "../hooks/useGamification";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export type ShareCardData =
  | { kind: "badge"; person: string; name: string; description: string; tier: BadgeTier; icon: string }
  | { kind: "league"; person: string; league: string; color: string; rank: number | null; groupSize: number; xp: number; result: "promote" | "stay" | "demote" }
  | { kind: "progress"; person: string; level: number; streak: number; xp: number; badges: number; league: string | null; leagueColor: string | null };

const SERIF = '"Fraunces", Georgia, "Times New Roman", serif';
const SANS = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

// Lapis, the brand colour, as a deep night-sky card
const INK_TOP = "#121a3b";
const INK_BOTTOM = "#2a3a86";
const WHITE = "#ffffff";
const SOFT = "rgba(255,255,255,0.72)";
const FAINT = "rgba(255,255,255,0.5)";
const HAIRLINE = "rgba(255,255,255,0.14)";

/** A readable file name: "speakbetter-first-words.png" */
export function cardFileName(card: ShareCardData): string {
  const part = card.kind === "badge" ? card.name : card.kind === "league" ? `${card.league} league` : "my progress";
  return `speakbetter-${part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
}

/** The sentence that goes with the picture when it is shared */
export function cardShareText(card: ShareCardData): string {
  switch (card.kind) {
    case "badge":
      return `I just earned the "${card.name}" badge on SpeakBetter. ${card.description}`;
    case "league":
      return card.result === "promote"
        ? `I moved up to the ${card.league} league on SpeakBetter this week.`
        : `I finished #${card.rank ?? "-"} in the ${card.league} league on SpeakBetter this week.`;
    case "progress":
      return `${card.streak}-day streak, ${card.xp.toLocaleString()} XP and ${card.badges} badges on SpeakBetter. Come practise English with me.`;
  }
}

async function loadFonts() {
  if (!("fonts" in document)) return;
  try {
    await Promise.all([document.fonts.load(`600 80px ${SERIF}`), document.fonts.load(`700 40px ${SANS}`), document.fonts.load(`500 36px ${SANS}`)]);
  } catch {
    // The fallback fonts are fine
  }
}

function svgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw the icon"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** A lucide icon as an image the canvas can draw */
function iconImage(Icon: LucideIcon, color: string, size: number): Promise<HTMLImageElement> {
  return svgImage(renderToStaticMarkup(<Icon width={size} height={size} color={color} strokeWidth={1.75} />));
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** League and tier colours that are too dark to read on the night-blue card are lifted toward white */
function onDark(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luma >= 0.4) return hex;
  const t = (0.4 - luma) * 1.8;
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function wrap(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

type SpacedContext = CanvasRenderingContext2D & { letterSpacing: string };

function write(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, spacing = "0px") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  (ctx as SpacedContext).letterSpacing = spacing;
  ctx.fillText(value, x, y);
  (ctx as SpacedContext).letterSpacing = "0px";
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

function background(ctx: CanvasRenderingContext2D, accent: string) {
  const g = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.4, CARD_HEIGHT);
  g.addColorStop(0, INK_TOP);
  g.addColorStop(1, INK_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  glow(ctx, CARD_WIDTH / 2, 520, 620, accent, 0.34);
  // A hairline frame, like a printed card
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, CARD_WIDTH - 72, CARD_HEIGHT - 72);
}

/** Wordmark on top, the person's name and the tagline at the bottom: the same on every card */
function frame(ctx: CanvasRenderingContext2D, person: string) {
  write(ctx, "SPEAKBETTER", CARD_WIDTH / 2, 124, `700 30px ${SANS}`, SOFT, "9px");
  ctx.fillStyle = HAIRLINE;
  ctx.fillRect(CARD_WIDTH / 2 - 40, 150, 80, 2);
  ctx.fillRect(120, CARD_HEIGHT - 200, CARD_WIDTH - 240, 2);

  ctx.font = `600 44px ${SANS}`;
  const name = wrap(ctx, person, CARD_WIDTH - 240, 1)[0] ?? "";
  write(ctx, name, CARD_WIDTH / 2, CARD_HEIGHT - 132, `600 44px ${SANS}`, WHITE);
  write(ctx, "Practise speaking English with real people", CARD_WIDTH / 2, CARD_HEIGHT - 84, `500 28px ${SANS}`, FAINT);
}

function medal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, ring: string, fill: string, icon: HTMLImageElement, iconSize: number) {
  // Soft halo rings
  for (const [extra, alpha] of [
    [78, 0.1],
    [40, 0.18],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + extra, 0, Math.PI * 2);
    ctx.fillStyle = hexA(ring, alpha);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = INK_TOP;
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.drawImage(icon, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
}

function headline(ctx: CanvasRenderingContext2D, value: string, y: number, size = 88, maxLines = 2): number {
  ctx.font = `600 ${size}px ${SERIF}`;
  const lines = wrap(ctx, value, CARD_WIDTH - 200, maxLines);
  lines.forEach((l, i) => write(ctx, l, CARD_WIDTH / 2, y + i * size * 1.12, `600 ${size}px ${SERIF}`, WHITE));
  return y + lines.length * size * 1.12;
}

function paragraph(ctx: CanvasRenderingContext2D, value: string, y: number, size = 38, maxLines = 3): number {
  ctx.font = `500 ${size}px ${SANS}`;
  const lines = wrap(ctx, value, CARD_WIDTH - 260, maxLines);
  lines.forEach((l, i) => write(ctx, l, CARD_WIDTH / 2, y + i * size * 1.45, `500 ${size}px ${SANS}`, SOFT));
  return y + lines.length * size * 1.45;
}

async function drawBadge(ctx: CanvasRenderingContext2D, card: Extract<ShareCardData, { kind: "badge" }>) {
  const tier = TIER_STYLE[card.tier];
  background(ctx, tier.ring);
  frame(ctx, card.person);
  const icon = await iconImage(badgeIconFor(card.icon), tier.ring, 220);
  medal(ctx, CARD_WIDTH / 2, 480, 190, tier.ring, tier.fill, icon, 220);
  write(ctx, `NEW BADGE  ·  ${tier.label.toUpperCase()}`, CARD_WIDTH / 2, 790, `700 30px ${SANS}`, tier.ring, "6px");
  const after = headline(ctx, card.name, 878);
  paragraph(ctx, card.description, after + 24);
}

async function drawLeague(ctx: CanvasRenderingContext2D, source: Extract<ShareCardData, { kind: "league" }>) {
  const card = { ...source, color: onDark(source.color) };
  background(ctx, card.color);
  frame(ctx, card.person);
  const icon = await iconImage(Trophy, card.color, 200);
  medal(ctx, CARD_WIDTH / 2, 480, 190, card.color, hexA(card.color, 0.18), icon, 200);
  write(ctx, card.result === "promote" ? "PROMOTED" : "LAST WEEK", CARD_WIDTH / 2, 790, `700 30px ${SANS}`, card.color, "6px");
  const after = headline(ctx, card.result === "promote" ? `Moved up to ${card.league}` : `${card.league} league`, 878);
  const line = card.rank ? `Finished #${card.rank} of ${card.groupSize} with ${card.xp.toLocaleString()} XP.` : `${card.xp.toLocaleString()} XP this week.`;
  paragraph(ctx, line, after + 24, 38, 2);
}

function drawProgress(ctx: CanvasRenderingContext2D, card: Extract<ShareCardData, { kind: "progress" }>) {
  const accent = "#8ea3e8";
  background(ctx, accent);
  frame(ctx, card.person);
  write(ctx, "MY ENGLISH PROGRESS", CARD_WIDTH / 2, 330, `700 30px ${SANS}`, accent, "6px");
  headline(ctx, `${card.streak}-day streak`, 480, 120, 1);

  const cells: Array<[string, string]> = [
    ["LEVEL", String(card.level)],
    ["TOTAL XP", card.xp.toLocaleString()],
    ["BADGES", String(card.badges)],
  ];
  const cellW = (CARD_WIDTH - 240) / 3;
  cells.forEach(([label, value], i) => {
    const x = 120 + cellW * i + cellW / 2;
    write(ctx, value, x, 760, `600 78px ${SERIF}`, WHITE);
    write(ctx, label, x, 818, `700 24px ${SANS}`, FAINT, "5px");
    if (i > 0) {
      ctx.fillStyle = HAIRLINE;
      ctx.fillRect(120 + cellW * i, 700, 2, 140);
    }
  });
  if (card.league) {
    const w = 420;
    ctx.beginPath();
    ctx.roundRect(CARD_WIDTH / 2 - w / 2, 930, w, 84, 42);
    const leagueColor = card.leagueColor ? onDark(card.leagueColor) : accent;
    ctx.fillStyle = hexA(leagueColor, 0.2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = leagueColor;
    ctx.stroke();
    write(ctx, `${card.league} league`, CARD_WIDTH / 2, 985, `700 34px ${SANS}`, WHITE);
  }
}

/** Draws a card and returns it as a PNG */
export async function renderShareCard(card: ShareCardData): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't draw the card");

  if (card.kind === "badge") await drawBadge(ctx, card);
  else if (card.kind === "league") await drawLeague(ctx, card);
  else drawProgress(ctx, card);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not make the picture"))), "image/png");
  });
}
