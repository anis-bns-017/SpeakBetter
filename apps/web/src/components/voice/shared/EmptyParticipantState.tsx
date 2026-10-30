// apps/web/src/components/voice/shared/EmptyParticipantState.tsx
/**
 * EmptyParticipantState — polished empty/quiet-state component.
 * Variants:
 *   - "no-participants"  → room is truly empty
 *   - "no-speakers"      → people are here but nobody is talking
 *   - "search"           → search returned no matches
 *   - "filter"           → filter returned no matches
 *
 * Actions:
 *   - "Invite friends"    → opens RoomInvite
 *   - "Clear filters"     → resets search + filter
 *   - "Raise hand"        → prompts current user
 *   - "Start a topic"     → shows icebreaker suggestions
 */

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Mic,
  Sparkles,
  UserPlus,
  RefreshCcw,
  Hand,
  MessageCircle,
  Coffee,
  Globe,
  Lightbulb,
  Copy,
  Check,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { THEME } from "../VoiceRoomView.theme";

type EmptyVariant = "no-participants" | "no-speakers" | "search" | "filter";

interface EmptyParticipantStateProps {
  variant: EmptyVariant;
  isHost: boolean;
  isModerator: boolean;
  roomName?: string;
  searchQuery?: string;
  onInvite?: () => void;
  onClearFilters?: () => void;
  onRaiseHand?: () => void;
  onPickTopic?: (topic: string) => void;
  className?: string;
}

const ICEBREAKERS: { text: string; icon: typeof Coffee; color: string }[] = [
  {
    text: "What language are you learning this week?",
    icon: Globe,
    color: "cyan",
  },
  {
    text: "Share a phrase that trips you up in your target language",
    icon: MessageCircle,
    color: "violet",
  },
  {
    text: "What's your favourite word in any language?",
    icon: Sparkles,
    color: "pink",
  },
  { text: "Coffee or tea while you study?", icon: Coffee, color: "amber" },
  {
    text: "One tip that changed how you learn languages",
    icon: Lightbulb,
    color: "emerald",
  },
  { text: "Introduce yourself in 3 words", icon: Zap, color: "yellow" },
];

const COLOR_MAP: Record<string, { fg: string; bg: string }> = {
  cyan: { fg: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
  violet: { fg: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  pink: { fg: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  amber: { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  emerald: { fg: "#34d399", bg: "rgba(52,211,153,0.12)" },
  yellow: { fg: "#eab308", bg: "rgba(234,179,8,0.12)" },
};

export const EmptyParticipantState: React.FC<EmptyParticipantStateProps> = ({
  variant,
  isHost,
  isModerator,
  searchQuery,
  onInvite,
  onClearFilters,
  onRaiseHand,
  onPickTopic,
  className,
}) => {
  const [showTopics, setShowTopics] = useState(false);
  const [copiedTopic, setCopiedTopic] = useState<string | null>(null);

  const config = useMemo(() => {
    switch (variant) {
      case "no-participants":
        return {
          icon: Users,
          color: THEME.colors.accent.primary,
          title: "It's just you in here",
          subtitle:
            "Invite friends or wait for others to join. New rooms fill up fast!",
          primaryAction: isHost ? "Invite friends" : "Raise your hand",
        };
      case "no-speakers":
        return {
          icon: Mic,
          color: THEME.colors.accent.warning,
          title: "It's quiet right now",
          subtitle: isHost
            ? "Break the ice with a topic below, or invite someone to speak."
            : "Nobody is speaking yet. Raise your hand if you'd like to start!",
          primaryAction: isHost ? "Start a topic" : "Raise your hand",
        };
      case "search":
        return {
          icon: Search,
          color: THEME.colors.accent.cyan,
          title: "No one matches your search",
          subtitle: searchQuery
            ? `We couldn't find anyone matching "${searchQuery}".`
            : "Try a different keyword or clear the search.",
          primaryAction: "Clear search",
        };
      case "filter":
        return {
          icon: Sparkles,
          color: THEME.colors.accent.secondary,
          title: "No one matches this filter",
          subtitle:
            "Switch to a different filter, or clear all filters to see everyone.",
          primaryAction: "Clear filters",
        };
    }
  }, [variant, isHost, searchQuery]);

  const ConfigIcon = config.icon;

  const handlePrimary = () => {
    if (variant === "no-participants") {
      if (isHost || isModerator) onInvite?.();
      else onRaiseHand?.();
      return;
    }
    if (variant === "no-speakers") {
      if (isHost || isModerator) setShowTopics((v) => !v);
      else onRaiseHand?.();
      return;
    }
    onClearFilters?.();
  };

  const handleCopyTopic = async (topic: string) => {
    try {
      await navigator.clipboard.writeText(topic);
      setCopiedTopic(topic);
      toast.success("Topic copied — paste it in chat");
      window.setTimeout(() => setCopiedTopic(null), 1800);
    } catch {
      toast.error("Couldn't copy topic");
    }
  };

  const handleUseTopic = (topic: string) => {
    onPickTopic?.(topic);
    handleCopyTopic(topic);
  };

  return (
    <div
      className={
        "flex flex-col items-center justify-center text-center px-6 py-12 " +
        (className ?? "")
      }
    >
      {/* Icon halo */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 220 }}
        className="relative mb-5"
      >
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.25, 0.05, 0.25],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: config.color }}
        />
        <div
          className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: `${config.color}22` }}
        >
          <ConfigIcon className="w-9 h-9" style={{ color: config.color }} />
        </div>
      </motion.div>

      {/* Text */}
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-base font-semibold mb-1"
        style={{ color: THEME.colors.text.primary }}
      >
        {config.title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-xs max-w-[320px] leading-relaxed mb-5"
        style={{ color: THEME.colors.text.muted }}
      >
        {config.subtitle}
      </motion.p>

      {/* Primary action */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        type="button"
        onClick={handlePrimary}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-[1.03] active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${config.color}, ${THEME.colors.accent.secondary})`,
          color: "#fff",
          boxShadow: `0 6px 20px ${config.color}44`,
        }}
      >
        {variant === "no-participants" && (isHost || isModerator) && (
          <UserPlus className="w-4 h-4" />
        )}
        {variant === "no-participants" && !isHost && !isModerator && (
          <Hand className="w-4 h-4" />
        )}
        {variant === "no-speakers" && (isHost || isModerator) && (
          <Sparkles className="w-4 h-4" />
        )}
        {variant === "no-speakers" && !isHost && !isModerator && (
          <Hand className="w-4 h-4" />
        )}
        {(variant === "search" || variant === "filter") && (
          <RefreshCcw className="w-4 h-4" />
        )}
        {config.primaryAction}
      </motion.button>

      {/* Secondary: suggestion chips (only in no-participants for host) */}
      {variant === "no-participants" && (isHost || isModerator) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-1.5 max-w-[360px]"
        >
          <span
            className="text-[10px] w-full mb-1"
            style={{ color: THEME.colors.text.muted }}
          >
            Quick ideas
          </span>
          {["Speak Spanish?", "English practice", "Language games"].map(
            (idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(idea).catch(() => {});
                  toast.success("Copied — share it in chat");
                }}
                className="text-[10px] px-2.5 py-1 rounded-full border transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: THEME.colors.border.primary,
                  color: THEME.colors.text.secondary,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                {idea}
              </button>
            ),
          )}
        </motion.div>
      )}

      {/* Topic suggestions (only in no-speakers for host) */}
      <AnimatePresence initial={false}>
        {variant === "no-speakers" && (isHost || isModerator) && showTopics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-6 w-full max-w-[420px]"
          >
            <div className="text-left mb-2 flex items-center justify-between px-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: THEME.colors.text.muted }}
              >
                Icebreakers
              </span>
              <button
                type="button"
                onClick={() => setShowTopics(false)}
                className="text-[10px]"
                style={{ color: THEME.colors.text.muted }}
              >
                Hide
              </button>
            </div>
            <div className="space-y-1.5">
              {ICEBREAKERS.map((t) => {
                const Icon = t.icon;
                const colors = COLOR_MAP[t.color] ?? COLOR_MAP.cyan;
                const isCopied = copiedTopic === t.text;

                return (
                  <motion.button
                    key={t.text}
                    type="button"
                    onClick={() => handleUseTopic(t.text)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-full text-left flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all hover:-translate-y-0.5"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      borderColor: isCopied
                        ? THEME.colors.accent.success
                        : THEME.colors.border.primary,
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: colors.bg,
                        color: colors.fg,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span
                      className="text-xs leading-snug flex-1"
                      style={{ color: THEME.colors.text.primary }}
                    >
                      {t.text}
                    </span>
                    {isCopied ? (
                      <Check
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: THEME.colors.accent.success }}
                      />
                    ) : (
                      <Copy
                        className="w-3.5 h-3.5 shrink-0 opacity-50"
                        style={{ color: THEME.colors.text.muted }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
            <p
              className="text-[9px] text-center mt-2.5"
              style={{ color: THEME.colors.text.muted }}
            >
              Tap a topic to copy it, then paste it in the chat
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmptyParticipantState;
