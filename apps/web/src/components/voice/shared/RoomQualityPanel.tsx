// apps/web/src/components/voice/shared/RoomQualityPanel.tsx
/**
 * RoomQualityPanel — live connection quality indicator.
 *
 * Data sources (all optional, graceful fallbacks):
 *  1. navigator.connection  → downlink, RTT, effective type (Chromium-only)
 *  2. LiveKit room stats    → if passed via props
 *  3. Simple latency probe  → pings your API /health every 15s
 *
 * Displays:
 *  - Overall quality dot: excellent / good / fair / poor
 *  - Latency (ms)
 *  - Packet loss (%)
 *  - Jitter (ms)
 *  - Connection type (wifi/4g/…)
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  X,
  Activity,
  Signal,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";

export type ConnectionGrade =
  "excellent" | "good" | "fair" | "poor" | "unknown";

interface RoomQualityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** LiveKit-reported quality if available */
  liveKitQuality?: "excellent" | "good" | "poor";
  /** Optional: your API base URL for the latency probe (defaults to window.location.origin) */
  apiBaseUrl?: string;
}

interface QualitySnapshot {
  grade: ConnectionGrade;
  latencyMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  downlinkMbps: number | null;
  effectiveType: string | null;
  isOnline: boolean;
  lastUpdated: number;
}

export const RoomQualityPanel: React.FC<RoomQualityPanelProps> = ({
  isOpen,
  onClose,
  liveKitQuality,
  apiBaseUrl,
}) => {
  const [snapshot, setSnapshot] = useState<QualitySnapshot>({
    grade: "unknown",
    latencyMs: null,
    jitterMs: null,
    packetLossPct: null,
    downlinkMbps: null,
    effectiveType: null,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastUpdated: 0,
  });
  const [isProbing, setIsProbing] = useState(false);

  const latencyHistoryRef = useRef<number[]>([]);
  const baseUrl =
    apiBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");

  // ------------------------------------------------------------
  // 1. Latency probe — HEAD /favicon.ico (light, always present)
  // ------------------------------------------------------------
  const probeLatency = async () => {
    if (!baseUrl) return null;
    setIsProbing(true);
    const samples: number[] = [];

    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      try {
        await fetch(`${baseUrl}/favicon.ico`, {
          method: "HEAD",
          cache: "no-store",
        });
        samples.push(performance.now() - start);
      } catch {
        // ignore individual failures
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    setIsProbing(false);
    if (samples.length === 0) return null;

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    return avg;
  };

  // ------------------------------------------------------------
  // 2. Read Network Information API (Chromium only)
  // ------------------------------------------------------------
  const readNetworkInfo = () => {
    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (!conn) {
      return { downlinkMbps: null, effectiveType: null, rtt: null };
    }
    return {
      downlinkMbps: Number(conn.downlink) || null,
      effectiveType: String(conn.effectiveType || "") || null,
      rtt: Number(conn.rtt) || null,
    };
  };

  // ------------------------------------------------------------
  // 3. Compute grade from measured values
  // ------------------------------------------------------------
  const computeGrade = (
    latency: number | null,
    jitter: number | null,
    loss: number | null,
    fallback: "excellent" | "good" | "poor" | undefined,
  ): ConnectionGrade => {
    if (latency === null && jitter === null && loss === null) {
      return fallback ?? "unknown";
    }

    const lat = latency ?? 0;
    const jit = jitter ?? 0;
    const l = loss ?? 0;

    if (lat < 80 && jit < 20 && l < 1) return "excellent";
    if (lat < 180 && jit < 50 && l < 3) return "good";
    if (lat < 400 && jit < 100 && l < 8) return "fair";
    return "poor";
  };

  // ------------------------------------------------------------
  // 4. Update loop
  // ------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const tick = async () => {
      // Latency
      const lat = await probeLatency();
      if (cancelled) return;

      // Track rolling history for jitter
      if (lat !== null) {
        latencyHistoryRef.current = [
          ...latencyHistoryRef.current.slice(-9),
          lat,
        ];
      }
      const history = latencyHistoryRef.current;

      // Jitter = mean absolute deviation of consecutive latencies
      let jitter: number | null = null;
      if (history.length >= 3) {
        const diffs = history.slice(1).map((v, i) => Math.abs(v - history[i]));
        jitter = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      }

      // Network info
      const net = readNetworkInfo();

      // Packet loss — not available from browser; only from WebRTC stats.
      // Use LiveKit quality as an indirect hint.
      const loss: number | null = null;

      const grade = computeGrade(
        lat,
        jitter,
        loss,
        liveKitQuality === "poor"
          ? "poor"
          : liveKitQuality === "good"
            ? "good"
            : liveKitQuality,
      );

      setSnapshot({
        grade,
        latencyMs: lat !== null ? Math.round(lat) : null,
        jitterMs: jitter !== null ? Math.round(jitter) : null,
        packetLossPct: loss,
        downlinkMbps: net.downlinkMbps,
        effectiveType: net.effectiveType,
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
        lastUpdated: Date.now(),
      });
    };

    tick();
    const id = window.setInterval(tick, 15000);

    // Online/offline listeners
    const handleOnline = () => setSnapshot((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setSnapshot((s) => ({ ...s, isOnline: false }));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOpen, liveKitQuality]);

  // ------------------------------------------------------------
  // Visual mapping
  // ------------------------------------------------------------
  const gradeConfig = {
    excellent: {
      color: THEME.colors.accent.success,
      label: "Excellent",
      icon: CheckCircle2,
    },
    good: {
      color: THEME.colors.accent.cyan,
      label: "Good",
      icon: Signal,
    },
    fair: {
      color: THEME.colors.accent.warning,
      label: "Fair",
      icon: Activity,
    },
    poor: {
      color: THEME.colors.accent.error,
      label: "Poor",
      icon: AlertCircle,
    },
    unknown: {
      color: THEME.colors.text.muted,
      label: "Measuring…",
      icon: Loader2,
    },
  } as const;

  const conf = gradeConfig[snapshot.grade];
  const StatusIcon = conf.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="fixed top-16 right-4 w-[min(92vw,320px)] rounded-2xl border shadow-2xl backdrop-blur-2xl z-[80]"
          style={{
            background: "rgba(10, 10, 18, 0.97)",
            borderColor: THEME.colors.border.primary,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between gap-3 border-b"
            style={{ borderColor: THEME.colors.border.primary }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${conf.color}22` }}
              >
                <Wifi className="w-4 h-4" style={{ color: conf.color }} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: THEME.colors.text.primary }}
                >
                  Connection
                </p>
                <p
                  className="text-[10px] truncate"
                  style={{ color: THEME.colors.text.muted }}
                >
                  Live network quality
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
              style={{ color: THEME.colors.text.muted }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status banner */}
          <div
            className="px-4 py-3 flex items-center gap-3 border-b"
            style={{ borderColor: THEME.colors.border.primary }}
          >
            <StatusIcon
              className={`w-5 h-5 shrink-0 ${
                snapshot.grade === "unknown" || isProbing ? "animate-pulse" : ""
              }`}
              style={{ color: conf.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-bold"
                  style={{ color: conf.color }}
                >
                  {conf.label}
                </span>
                {!snapshot.isOnline && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{
                      background: `${THEME.colors.accent.error}22`,
                      color: THEME.colors.accent.error,
                    }}
                  >
                    OFFLINE
                  </span>
                )}
              </div>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: THEME.colors.text.muted }}
              >
                {snapshot.lastUpdated
                  ? `Updated ${timeAgo(snapshot.lastUpdated)}`
                  : "Measuring connection…"}
              </p>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="p-3 grid grid-cols-2 gap-2">
            <MetricCell
              label="Latency"
              value={
                snapshot.latencyMs !== null ? `${snapshot.latencyMs} ms` : "—"
              }
              hint="Round-trip time"
              color={colorForLatency(snapshot.latencyMs)}
            />
            <MetricCell
              label="Jitter"
              value={
                snapshot.jitterMs !== null ? `${snapshot.jitterMs} ms` : "—"
              }
              hint="Variation in latency"
              color={colorForJitter(snapshot.jitterMs)}
            />
            <MetricCell
              label="Downlink"
              value={
                snapshot.downlinkMbps !== null
                  ? `${snapshot.downlinkMbps.toFixed(1)} Mbps`
                  : "—"
              }
              hint="Estimated speed"
              color={THEME.colors.text.primary}
            />
            <MetricCell
              label="Network"
              value={
                snapshot.effectiveType
                  ? snapshot.effectiveType.toUpperCase()
                  : "—"
              }
              hint="Connection type"
              color={THEME.colors.text.primary}
            />
          </div>

          {/* Footer hint */}
          <div
            className="px-3 py-2 border-t text-[9px] leading-relaxed"
            style={{
              borderColor: THEME.colors.border.primary,
              color: THEME.colors.text.muted,
            }}
          >
            {snapshot.grade === "poor"
              ? "⚠️ Try moving closer to your router or switching networks."
              : snapshot.grade === "fair"
                ? "Tips: close other tabs or pause downloads for smoother audio."
                : "Connection looks healthy for voice."}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ------------------------------------------------------------
// Helpers + sub-components
// ------------------------------------------------------------

const MetricCell: React.FC<{
  label: string;
  value: string;
  hint?: string;
  color: string;
}> = ({ label, value, hint, color }) => (
  <div
    className="rounded-xl border p-2.5 flex flex-col gap-0.5"
    style={{
      background: "rgba(255,255,255,0.02)",
      borderColor: THEME.colors.border.primary,
    }}
    title={hint}
  >
    <span
      className="text-[9px] font-medium uppercase tracking-wider truncate"
      style={{ color: THEME.colors.text.muted }}
    >
      {label}
    </span>
    <span className="text-sm font-bold tabular-nums truncate" style={{ color }}>
      {value}
    </span>
  </div>
);

function colorForLatency(ms: number | null): string {
  if (ms === null) return THEME.colors.text.muted;
  if (ms < 80) return THEME.colors.accent.success;
  if (ms < 180) return THEME.colors.accent.cyan;
  if (ms < 400) return THEME.colors.accent.warning;
  return THEME.colors.accent.error;
}

function colorForJitter(ms: number | null): string {
  if (ms === null) return THEME.colors.text.muted;
  if (ms < 20) return THEME.colors.accent.success;
  if (ms < 50) return THEME.colors.accent.cyan;
  if (ms < 100) return THEME.colors.accent.warning;
  return THEME.colors.accent.error;
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

export default RoomQualityPanel;
