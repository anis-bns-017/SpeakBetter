// apps/web/src/components/voice/VoiceRoomView.helpers.tsx

import React from "react";
import { format, isToday, isYesterday } from "date-fns";

// ---- Helper Functions ----

export function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function hueFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function formatTime(date: string): string {
  try {
    return format(new Date(date), "h:mm a");
  } catch {
    return "";
  }
}

export function formatDateSeparator(date: string): string {
  try {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMMM d, yyyy");
  } catch {
    return "";
  }
}

export function dayKey(date: string): string {
  try {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  } catch {
    return date;
  }
}

export function getCountryFlag(countryCode?: string): string {
  if (!countryCode) return "🌍";
  const flags: Record<string, string> = {
    US: "🇺🇸", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸",
    IT: "🇮🇹", JP: "🇯🇵", KR: "🇰🇷", CN: "🇨🇳", IN: "🇮🇳",
    BR: "🇧🇷", RU: "🇷🇺", AU: "🇦🇺", CA: "🇨🇦", MX: "🇲🇽",
    ZA: "🇿🇦", NG: "🇳🇬", EG: "🇪🇬", SA: "🇸🇦", AE: "🇦🇪",
    SG: "🇸🇬", MY: "🇲🇾", PH: "🇵🇭", VN: "🇻🇳", TH: "🇹🇭",
    ID: "🇮🇩", PK: "🇵🇰", BD: "🇧🇩", TR: "🇹🇷", NL: "🇳🇱",
    BE: "🇧🇪", CH: "🇨🇭", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰",
    FI: "🇫🇮", PL: "🇵🇱", GR: "🇬🇷", PT: "🇵🇹", IE: "🇮🇪",
    NZ: "🇳🇿", AR: "🇦🇷", CL: "🇨🇱", CO: "🇨🇴", PE: "🇵🇪",
    VE: "🇻🇪",
  };
  return flags[countryCode] || "🌍";
}


export function renderMessageContent(content: string) {
  if (!content) return null;
  const urlParts = content.split(URL_PATTERN);
  return urlParts.map((chunk, ci) => {
    if (URL_PATTERN.test(chunk)) {
      URL_PATTERN.lastIndex = 0;
      return (
        <a
          key={`u-${ci}`}
          href={chunk}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline underline-offset-2 hover:opacity-80 break-all"
          style={{ color: "#22D3EE" }}
        >
          {chunk}
        </a>
      );
    }
    URL_PATTERN.lastIndex = 0;
    const mentionParts = chunk.split(/(@[a-zA-Z0-9_]+)/g);
    return mentionParts.map((part, i) =>
      /^@[a-zA-Z0-9_]+$/.test(part) ? (
        <span
          key={`${ci}-${i}`}
          className="font-semibold"
          style={{ color: "#A78BFA" }}
        >
          {part}
        </span>
      ) : (
        <React.Fragment key={`${ci}-${i}`}>{part}</React.Fragment>
      )
    );
  });
}

export function playNotificationBeep() {
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
    osc.onended = () => ctx.close();
  } catch {
    // Ignore
  }
}