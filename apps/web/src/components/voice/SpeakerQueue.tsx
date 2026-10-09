// apps/web/src/components/voice/SpeakerQueue.tsx
/**
 * Speaker Queue — prop-driven.
 * Derives its list from participants that have `raisedHand === true`.
 * No fetching, no global sockets — parent passes everything in.
 */

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Users,
  Mic,
  Crown,
  Star,
  Clock,
  ChevronUp,
  ChevronDown,
  UserMinus,
  ArrowUp,
  Hand,
  X,
  Check,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { THEME } from "./VoiceRoomView.theme";

export interface QueueParticipant {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  isVerified?: boolean;
  isPremium?: boolean;
  raisedHand: boolean;
  /** ms epoch — used to compute position */
  raisedHandAt?: number;
  isSpeaking?: boolean;
  isMuted?: boolean;
}

interface SpeakerQueueProps {
  /** All participants currently in the room */
  participants: QueueParticipant[];
  currentUserId?: string;
  isModerator: boolean;
  /** Called when host promotes someone from queue → speaker */
  onPromote?: (userId: string) => void;
  /** Called when host removes someone from the queue */
  onRemove?: (userId: string) => void;
  /** Called when host skips the current speaker */
  onSkip?: (userId: string) => void;
  /** Optional: raise hand toggle for the current user */
  onToggleRaiseHand?: (raised: boolean) => void;
  className?: string;
  maxVisible?: number;
  defaultExpanded?: boolean;
}

export const SpeakerQueue: React.FC<SpeakerQueueProps> = ({
  participants,
  currentUserId,
  isModerator,
  onPromote,
  onRemove,
  onSkip,
  onToggleRaiseHand,
  className,
  maxVisible = 8,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Derive the queue from participants
  const queue = useMemo(() => {
    return participants
      .filter((p) => p.raisedHand)
      .map((p) => ({ ...p, raisedHandAt: p.raisedHandAt ?? Date.now() }))
      .sort((a, b) => (a.raisedHandAt ?? 0) - (b.raisedHandAt ?? 0));
  }, [participants]);

  const speakingInQueue = useMemo(
    () => queue.filter((p) => p.isSpeaking),
    [queue],
  );

  const myPosition = useMemo(() => {
    if (!currentUserId) return -1;
    return queue.findIndex((p) => p.userId === currentUserId) + 1;
  }, [queue, currentUserId]);

  const iAmInQueue = myPosition > 0;
  const iAmSpeaking = speakingInQueue.some((p) => p.userId === currentUserId);

  const visible = queue.slice(0, maxVisible);
  const extraCount = Math.max(0, queue.length - maxVisible);

  // Average wait estimate (1.5 min per person ahead of you)
  const myWaitEstimate =
    myPosition > 0 ? Math.max(0, (myPosition - 1) * 90) : 0;

  const handlePromote = (userId: string) => {
    if (!isModerator) return;
    onPromote?.(userId);
    toast.success("🎤 Promoted to speaker");
  };

  const handleRemove = (userId: string) => {
    if (!isModerator) return;
    onRemove?.(userId);
    toast.success("Removed from queue");
  };

  const handleSkip = (userId: string) => {
    if (!isModerator) return;
    onSkip?.(userId);
    toast.info("⏭️ Skipped");
  };

  return (
    <div
      className={cn("rounded-2xl border overflow-hidden shadow-2xl", className)}
      style={{
        background: "rgba(10, 10, 20, 0.98)",
        borderColor: "rgba(129,140,248,0.25)",
        backdropFilter: "blur(20px)",
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(129,140,248,0.08)",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users
            className="w-4 h-4 shrink-0"
            style={{ color: THEME.colors.accent.primary }}
          />
          <span
            className="text-sm font-semibold truncate"
            style={{ color: THEME.colors.text.primary }}
          >
            Speaker Queue
          </span>

          {queue.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-medium"
              style={{
                background: "rgba(129,140,248,0.15)",
                color: THEME.colors.accent.primary,
              }}
            >
              {queue.length}
            </span>
          )}

          {iAmInQueue && !iAmSpeaking && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold animate-pulse"
              style={{
                background: "rgba(251,191,36,0.15)",
                color: THEME.colors.accent.warning,
              }}
            >
              You're #{myPosition}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleRaiseHand && !iAmSpeaking && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onToggleRaiseHand(!iAmInQueue);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleRaiseHand(!iAmInQueue);
                }
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer"
              style={{
                background: iAmInQueue
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(129,140,248,0.18)",
                color: iAmInQueue
                  ? THEME.colors.accent.error
                  : THEME.colors.accent.primary,
              }}
            >
              {iAmInQueue ? (
                <span className="flex items-center gap-1">
                  <X className="w-3 h-3" /> Leave
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Hand className="w-3 h-3" /> Raise hand
                </span>
              )}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp
              className="w-4 h-4"
              style={{ color: THEME.colors.text.muted }}
            />
          ) : (
            <ChevronDown
              className="w-4 h-4"
              style={{ color: THEME.colors.text.muted }}
            />
          )}
        </div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {/* My position banner */}
            {iAmInQueue && !iAmSpeaking && (
              <div
                className="px-3.5 py-2 flex items-center justify-between gap-2"
                style={{
                  background: "rgba(251,191,36,0.06)",
                  borderTop: `1px solid ${THEME.colors.border.primary}`,
                }}
              >
                <span
                  className="text-[11px] font-medium"
                  style={{ color: THEME.colors.accent.warning }}
                >
                  ✋ You're #{myPosition} of {queue.length} · ~
                  {Math.ceil(myWaitEstimate / 60)} min wait
                </span>
              </div>
            )}

            {/* Queue items */}
            <div
              className="max-h-72 overflow-y-auto px-2 py-2 space-y-1"
              style={{ borderTop: `1px solid ${THEME.colors.border.primary}` }}
            >
              {visible.length === 0 ? (
                <div className="text-center py-6">
                  <div
                    className="w-11 h-11 mx-auto rounded-full flex items-center justify-center mb-2"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <Clock
                      className="w-5 h-5"
                      style={{ color: THEME.colors.text.muted }}
                    />
                  </div>
                  <p
                    className="text-xs font-medium"
                    style={{ color: THEME.colors.text.secondary }}
                  >
                    No one in the queue
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Raise your hand to speak
                  </p>
                </div>
              ) : (
                visible.map((item, idx) => {
                  const isMe = item.userId === currentUserId;
                  const position = idx + 1;

                  return (
                    <motion.div
                      key={item.userId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors",
                        isMe && "ring-1",
                      )}
                      style={{
                        background: item.isSpeaking
                          ? "rgba(52,211,153,0.08)"
                          : isMe
                            ? "rgba(129,140,248,0.08)"
                            : "rgba(255,255,255,0.02)",
                        borderColor: isMe
                          ? "rgba(129,140,248,0.35)"
                          : "transparent",
                        borderWidth: isMe ? 1 : 0,
                        borderStyle: "solid",
                      }}
                    >
                      {/* Position badge */}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 tabular-nums"
                        style={{
                          background: item.isSpeaking
                            ? "rgba(52,211,153,0.15)"
                            : "rgba(255,255,255,0.06)",
                          color: item.isSpeaking
                            ? THEME.colors.accent.success
                            : THEME.colors.text.muted,
                        }}
                      >
                        {item.isSpeaking ? (
                          <Mic className="w-3 h-3" />
                        ) : (
                          position
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold overflow-hidden"
                          style={{
                            background: item.avatarUrl
                              ? `url(${item.avatarUrl}) center/cover`
                              : `hsl(${hashCode(item.name) % 360}, 45%, 28%)`,
                            color: item.avatarUrl
                              ? "transparent"
                              : THEME.colors.text.primary,
                          }}
                        >
                          {!item.avatarUrl && initials(item.name)}
                        </div>
                        {item.isSpeaking && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse ring-2"
                            style={{
                              background: THEME.colors.accent.success,
                              // ring uses bg color
                              boxShadow: `0 0 0 2px ${THEME.colors.background.primary}`,
                            }}
                          />
                        )}
                      </div>

                      {/* Name + tags */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-medium truncate"
                            style={{ color: THEME.colors.text.primary }}
                          >
                            {item.name}
                          </span>
                          {isMe && (
                            <span
                              className="text-[8px] px-1 py-0.5 rounded font-bold shrink-0"
                              style={{
                                background: "rgba(129,140,248,0.2)",
                                color: THEME.colors.accent.primary,
                              }}
                            >
                              YOU
                            </span>
                          )}
                          {item.isVerified && (
                            <Check
                              className="w-3 h-3 shrink-0"
                              style={{ color: THEME.colors.accent.primary }}
                            />
                          )}
                          {item.isPremium && (
                            <Star
                              className="w-3 h-3 shrink-0"
                              style={{ color: THEME.colors.accent.warning }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.isSpeaking ? (
                            <span
                              className="text-[9px] flex items-center gap-1"
                              style={{ color: THEME.colors.accent.success }}
                            >
                              <Mic className="w-2.5 h-2.5" /> Speaking
                            </span>
                          ) : (
                            <span
                              className="text-[9px]"
                              style={{ color: THEME.colors.text.muted }}
                            >
                              Waiting
                              {position > 1
                                ? ` · ~${Math.ceil((position - 1) * 1.5)} min`
                                : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Moderator actions */}
                      {isModerator && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {!item.isSpeaking && (
                            <button
                              type="button"
                              onClick={() => handlePromote(item.userId)}
                              className="p-1.5 rounded-lg hover:bg-green-500/15 transition-colors"
                              title="Promote to speaker"
                              style={{ color: THEME.colors.accent.success }}
                            >
                              <Mic className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.isSpeaking && onSkip && (
                            <button
                              type="button"
                              onClick={() => handleSkip(item.userId)}
                              className="p-1.5 rounded-lg hover:bg-orange-500/15 transition-colors"
                              title="Skip"
                              style={{ color: THEME.colors.accent.warning }}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemove(item.userId)}
                            className="p-1.5 rounded-lg hover:bg-red-500/15 transition-colors"
                            title="Remove from queue"
                            style={{ color: THEME.colors.accent.error }}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}

              {extraCount > 0 && (
                <div
                  className="text-center py-1.5 text-[10px]"
                  style={{ color: THEME.colors.text.muted }}
                >
                  +{extraCount} more waiting
                </div>
              )}
            </div>

            {/* Footer — promote next (mod only) */}
            {isModerator && queue.length > 0 && (
              <div
                className="px-3 py-2 flex items-center justify-between border-t"
                style={{ borderColor: THEME.colors.border.primary }}
              >
                <span
                  className="text-[10px] tabular-nums"
                  style={{ color: THEME.colors.text.muted }}
                >
                  {queue.length} waiting
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = queue.find((p) => !p.isSpeaking);
                    if (!next) {
                      toast.info("No one waiting");
                      return;
                    }
                    handlePromote(next.userId);
                  }}
                  className="text-[10px] px-2 py-1 rounded-lg font-medium transition-colors"
                  style={{
                    background: "rgba(129,140,248,0.18)",
                    color: THEME.colors.accent.primary,
                  }}
                >
                  Promote next
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------- helpers ----------

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default SpeakerQueue;
