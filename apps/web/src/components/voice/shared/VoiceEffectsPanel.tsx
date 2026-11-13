// apps/web/src/components/voice/shared/VoiceEffectsPanel.tsx
/**
 * VoiceEffectsPanel — UI for the useVoiceEffects hook.
 * Preset pills + sliders + bypass toggle + reset.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Volume2,
  VolumeX,
  Sliders,
  RotateCcw,
  Sparkles,
  Radio,
  Waves,
  Music,
  Waves as Waveform,
  Mic2,
  Bot,
} from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";
import type { VoiceEffectsState } from "../../../hooks/useVoiceEffects";
import { PRESETS } from "../../../hooks/useVoiceEffects";
import { tr, msg } from "../../../i18n/core";

interface VoiceEffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  state: VoiceEffectsState;
  update: (patch: Partial<VoiceEffectsState>) => void;
  applyPreset: (preset: keyof typeof PRESETS) => void;
  reset: () => void;
  /** Effects are on and the room hears the processed voice */
  isLive?: boolean;
  /** False when you aren't publishing a mic (e.g. in the audience) */
  canApply?: boolean;
  noiseSuppression?: boolean;
  onToggleNoiseSuppression?: () => void;
}

const PRESET_META: Record<
  keyof typeof PRESETS,
  { label: string; icon: typeof Sparkles; color: string }
> = {
  clean: { label: msg("Clean"), icon: Volume2, color: "var(--sx-text-94a3b8)" },
  bass: { label: msg("Bass"), icon: Waves, color: "var(--sx-text-22d3ee)" },
  radio: { label: msg("Radio"), icon: Radio, color: "var(--sx-text-fbbf24)" },
  cave: { label: msg("Cave"), icon: Music, color: "var(--sx-text-a78bfa)" },
  cathedral: { label: msg("Hall"), icon: Waveform, color: "var(--sx-text-818cf8)" },
  robot: { label: msg("Robot"), icon: Bot, color: "var(--sx-text-f472b6)" },
};

export const VoiceEffectsPanel: React.FC<VoiceEffectsPanelProps> = ({
  isOpen,
  onClose,
  state,
  update,
  applyPreset,
  reset,
  isLive = false,
  canApply = true,
  noiseSuppression = true,
  onToggleNoiseSuppression,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className="fixed top-16 right-4 w-[min(92vw,340px)] rounded-2xl border shadow-2xl backdrop-blur-2xl z-[80]"
          style={{
            background: "var(--sx-bg-10-10-18-970)",
            borderColor: THEME.colors.border.primary,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between gap-3 border-b"
            style={{
              borderColor: THEME.colors.border.primary,
              background:
                "linear-gradient(135deg, rgba(34,211,238,0.08), rgba(142,163,232,0.06))",
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${THEME.colors.accent.cyan}, ${THEME.colors.accent.primary})`,
                }}
              >
                <Mic2 className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: THEME.colors.text.primary }}
                >
                  {tr("Voice effects")}</p>
                <p
                  className="text-[11px] truncate"
                  style={{ color: THEME.colors.text.muted }}
                >
                  {state.bypass ? tr("Off — clean mic") : tr("{preset} preset", { preset: state.preset })}
                </p>
                {!state.bypass && (
                  <p
                    className="text-[11px] font-medium flex items-center gap-1.5"
                    style={{ color: isLive ? THEME.colors.status.online : THEME.colors.accent.warning }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isLive ? THEME.colors.status.online : THEME.colors.accent.warning }}
                    />
                    {isLive
                      ? tr("Live — everyone hears this")
                      : canApply
                        ? tr("Starting…")
                        : tr("Applies when you're speaking")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={reset}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                style={{ color: THEME.colors.text.muted }}
                title={tr("Reset")}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                style={{ color: THEME.colors.text.muted }}
                aria-label={tr("Close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Bypass toggle */}
            <button
              type="button"
              onClick={() => update({ bypass: !state.bypass })}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all hover:-translate-y-0.5"
              style={{
                background: state.bypass
                  ? "var(--sx-bg-255-255-255-20)"
                  : "rgba(34,211,238,0.08)",
                borderColor: state.bypass
                  ? THEME.colors.border.primary
                  : "rgba(34,211,238,0.3)",
              }}
            >
              <div className="flex items-center gap-2">
                {state.bypass ? (
                  <VolumeX
                    className="w-4 h-4"
                    style={{ color: THEME.colors.text.muted }}
                  />
                ) : (
                  <Volume2
                    className="w-4 h-4"
                    style={{ color: THEME.colors.accent.cyan }}
                  />
                )}
                <span
                  className="text-xs font-medium"
                  style={{
                    color: state.bypass
                      ? THEME.colors.text.muted
                      : THEME.colors.text.primary,
                  }}
                >
                  {state.bypass ? tr("Effects off") : tr("Effects on")}
                </span>
              </div>
              <span
                className="w-9 h-5 rounded-full p-0.5 transition-colors"
                style={{
                  background: state.bypass
                    ? "var(--sx-bg-255-255-255-100)"
                    : THEME.colors.accent.cyan,
                }}
              >
                <span
                  className="block w-4 h-4 rounded-full bg-white transition-transform"
                  style={{
                    transform: state.bypass
                      ? "translateX(0)"
                      : "translateX(16px)",
                  }}
                />
              </span>
            </button>

            {/* Presets */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles
                  className="w-3.5 h-3.5"
                  style={{ color: THEME.colors.accent.warning }}
                />
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: THEME.colors.text.muted }}
                >
                  {tr("Presets")}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  Object.keys(PRESETS) as Array<keyof typeof PRESETS>
                ).map((key) => {
                  const meta = PRESET_META[key];
                  const Icon = meta.icon;
                  const isSelected =
                    state.preset === key && !state.bypass;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all hover:-translate-y-0.5"
                      style={{
                        background: isSelected
                          ? `color-mix(in srgb, ${meta.color} 13.3%, transparent)`
                          : "var(--sx-bg-255-255-255-20)",
                        borderColor: isSelected
                          ? `color-mix(in srgb, ${meta.color} 40%, transparent)`
                          : THEME.colors.border.primary,
                      }}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={{
                          color: isSelected
                            ? meta.color
                            : THEME.colors.text.muted,
                        }}
                      />
                      <span
                        className="text-[11px] font-medium"
                        style={{
                          color: isSelected
                            ? meta.color
                            : THEME.colors.text.secondary,
                        }}
                      >
                        {tr(meta.label)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sliders */}
            <div
              className="space-y-3 pt-3 border-t"
              style={{ borderColor: THEME.colors.border.primary }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Sliders
                  className="w-3.5 h-3.5"
                  style={{ color: THEME.colors.accent.primary }}
                />
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: THEME.colors.text.muted }}
                >
                  {tr("Manual tuning")}</span>
              </div>

              <Knob
                label={tr("Bass")}
                value={state.bass}
                min={-15}
                max={15}
                step={1}
                format={(v) => `${v > 0 ? "+" : ""}${v} dB`}
                onChange={(v) => update({ bass: v })}
                disabled={state.bypass}
              />

              <Knob
                label={tr("Treble")}
                value={state.treble}
                min={-15}
                max={15}
                step={1}
                format={(v) => `${v > 0 ? "+" : ""}${v} dB`}
                onChange={(v) => update({ treble: v })}
                disabled={state.bypass}
              />

              <Knob
                label={tr("Reverb")}
                value={state.reverb}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => update({ reverb: v })}
                disabled={state.bypass}
              />

              <Knob
                label={tr("Echo")}
                value={state.delay}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => update({ delay: v })}
                disabled={state.bypass}
              />

              <Knob
                label={tr("Radio")}
                value={state.radio}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => update({ radio: v })}
                disabled={state.bypass}
              />

              <Knob
                label={tr("Gain")}
                value={state.gain}
                min={0.5}
                max={1.5}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => update({ gain: v })}
                disabled={state.bypass}
              />
            </div>

            {onToggleNoiseSuppression && (
              <button
                type="button"
                onClick={onToggleNoiseSuppression}
                role="switch"
                aria-checked={noiseSuppression}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors hover:bg-white/[0.03]"
                style={{ borderColor: THEME.colors.border.primary }}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold" style={{ color: THEME.colors.text.primary }}>
                    {tr("Noise suppression")}</span>
                  <span className="block text-[11px] leading-snug" style={{ color: THEME.colors.text.muted }}>
                    {noiseSuppression
                      ? tr("Filters background noise — best for talking")
                      : tr("Studio mode — natural sound for singing or music")}
                  </span>
                </span>
                <span
                  className="w-9 h-5 rounded-full p-0.5 transition-colors shrink-0"
                  style={{ background: noiseSuppression ? THEME.colors.accent.primary : "var(--sx-bg-255-255-255-120)" }}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${noiseSuppression ? "translate-x-4" : "translate-x-0"}`} />
                </span>
              </button>
            )}

            <p className="text-[11px] leading-relaxed" style={{ color: THEME.colors.text.muted }}>
              {tr("Effects change what the room hears from your mic. Turn them off any time to go back to your clean voice.")}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ------------------------------------------------------------

const Knob: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}> = ({ label, value, min, max, step, format, onChange, disabled }) => {
  const ratio = (value - min) / (max - min);
  const pct = Math.max(0, Math.min(1, ratio));

  return (
    <div
      className="flex items-center gap-3"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <span
        className="text-[11px] font-medium w-14 shrink-0"
        style={{ color: THEME.colors.text.muted }}
      >
        {tr(label)}
      </span>

      <div className="relative flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(90deg, ${THEME.colors.accent.primary} ${pct * 100}%, var(--sx-bg-255-255-255-100) ${pct * 100}%)`,
            accentColor: THEME.colors.accent.primary,
          }}
        />
      </div>

      <span
        className="text-[11px] tabular-nums w-12 text-right shrink-0"
        style={{ color: THEME.colors.text.secondary }}
      >
        {format(value)}
      </span>
    </div>
  );
};

export default VoiceEffectsPanel;