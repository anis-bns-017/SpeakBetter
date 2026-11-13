// apps/web/src/components/call/ConversationCardPanel.tsx
import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Dices,
  Gamepad2,
  Lightbulb,
  MessageCircleQuestion,
  MessagesSquare,
  Quote,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { COLORS } from "../voice/lobby/lobbyTheme";
import type { CardKind, ConversationCard } from "./callApi";
import { tr, msg } from "../../i18n/core";

const KIND_META: Record<CardKind, { label: string; icon: LucideIcon; color: string }> = {
  question: { label: msg("Question"), icon: MessageCircleQuestion, color: COLORS.live },
  story: { label: msg("Story"), icon: BookOpen, color: COLORS.pink },
  opinion: { label: msg("Opinion"), icon: MessagesSquare, color: COLORS.purple },
  game: { label: msg("Game"), icon: Gamepad2, color: COLORS.spotlight },
};

const DEPTH_LABEL = { 1: msg("Easy"), 2: msg("Medium"), 3: msg("Deep") } as const;

type HelpTab = "followUps" | "phrases";

interface ConversationCardPanelProps {
  card: ConversationCard | null;
  deck: ConversationCard[];
  index: number;
  /** True while a random card has been asked for and not yet shown */
  drawing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDraw: (kind?: CardKind) => void;
  onPick: (index: number) => void;
}

/**
 * The shared conversation card: a question both people see, with follow-up
 * questions and useful phrases to answer it, plus a random generator.
 */
export const ConversationCardPanel: React.FC<ConversationCardPanelProps> = ({
  card,
  deck,
  index,
  drawing,
  onPrev,
  onNext,
  onDraw,
  onPick,
}) => {
  const reduce = useReducedMotion();
  // Remember which card the open help belongs to: a new card starts with the
  // help closed, so the question gets the attention
  const [helpState, setHelpState] = useState<{ cardId: string; tab: HelpTab } | null>(null);

  if (!card) return null;
  const help = helpState?.cardId === card.id ? helpState.tab : null;
  const setHelp = (tab: HelpTab | null) => setHelpState(tab ? { cardId: card.id, tab } : null);
  const meta = KIND_META[card.kind];
  const KindIcon = meta.icon;

  return (
    <section
      aria-label={tr("Conversation card")}
      className="overflow-hidden rounded-3xl border"
      style={{
        borderColor: `color-mix(in srgb, ${meta.color} 26.7%, transparent)`,
        background: `radial-gradient(90% 120% at 0% 0%, color-mix(in srgb, ${meta.color} 11%, transparent) 0%, transparent 60%), ${COLORS.surface}`,
      }}
    >
      {/* Header: what kind of card, and how deep */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: `color-mix(in srgb, ${meta.color} 13.3%, transparent)`, color: meta.color }}
          >
            <KindIcon className="h-3.5 w-3.5" />
            {tr(meta.label)}
          </span>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {card.topic}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: COLORS.textMuted }}>
          <span className="inline-flex items-center gap-1" title={tr("{value} question", { value: DEPTH_LABEL[card.depth] })}>
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: dot <= card.depth ? meta.color : COLORS.border }}
              />
            ))}
            <span className="ml-1">{tr(DEPTH_LABEL[card.depth])}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>{tr("you both see this")}</span>
        </div>
      </div>

      {/* The question */}
      <div className="px-5 py-5" style={{ perspective: 900 }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={card.id}
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -70, y: 10 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, rotateX: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, rotateX: 70, y: -10 }}
            transition={{ duration: 0.22 }}
            className="min-h-[4.5rem] font-serif text-2xl leading-snug"
            style={{ color: COLORS.textPrimary, transformOrigin: "50% 50%" }}
          >
            {card.question}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Help: follow-ups and phrases */}
      <div className="px-5 pb-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "followUps", label: msg("Keep it going"), icon: Lightbulb },
              { id: "phrases", label: msg("Say it like this"), icon: Quote },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = help === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setHelp(active ? null : tab.id)}
                aria-expanded={active}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  borderColor: active ? meta.color : COLORS.border,
                  background: active ? `color-mix(in srgb, ${meta.color} 12.2%, transparent)` : "transparent",
                  color: active ? meta.color : COLORS.textMuted,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {tr(tab.label)}
              </button>
            );
          })}
        </div>

        <AnimatePresence initial={false}>
          {help && (
            <motion.div
              key={help}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {help === "followUps" ? (
                <ol className="mt-3 space-y-2">
                  {card.followUps.map((question, i) => (
                    <li
                      key={question}
                      className="flex gap-3 rounded-2xl border px-3 py-2.5 text-sm"
                      style={{ borderColor: COLORS.border, background: "var(--sx-bg-255-255-255-30)", color: COLORS.textPrimary }}
                    >
                      <span className="font-mono text-xs" style={{ color: meta.color }}>
                        {i + 1}
                      </span>
                      {question}
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {card.phrases.map((phrase) => (
                    <li
                      key={phrase}
                      className="rounded-2xl border px-3 py-1.5 text-sm italic"
                      style={{ borderColor: COLORS.border, background: "var(--sx-bg-255-255-255-30)", color: COLORS.textPrimary }}
                    >
                      “{phrase}”
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Position in the deck */}
      <div className="flex items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: COLORS.border }}>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="tablist" aria-label={tr("Cards in this call")}>
          {deck.map((item, i) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={i === index}
              aria-label={tr("Card {value}: {topic}", { value: i + 1, topic: item.topic })}
              onClick={() => onPick(i)}
              className="h-2 rounded-full transition-all"
              style={{
                width: i === index ? 22 : 8,
                background: i === index ? meta.color : COLORS.border,
              }}
            />
          ))}
          <span className="ml-2 text-[11px]" style={{ color: COLORS.textMuted }}>
            {index + 1} / {deck.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onPrev}
            aria-label={tr("Previous card")}
            className="rounded-full border p-2 hover:bg-white/5"
            style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onNext}
            className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: `color-mix(in srgb, ${meta.color} 14.9%, transparent)`, color: meta.color }}
          >
            {tr("Next")}{" "}<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Random question generator */}
      <div
        className="flex flex-wrap items-center gap-2 border-t px-5 py-3"
        style={{ borderColor: COLORS.border, background: "var(--sx-bg-0-0-0-180)" }}
      >
        <button
          onClick={() => onDraw()}
          disabled={drawing}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: COLORS.spotlight, color: COLORS.void }}
        >
          <motion.span
            animate={drawing && !reduce ? { rotate: [0, 180, 360] } : { rotate: 0 }}
            transition={{ duration: 0.6, repeat: drawing ? Infinity : 0 }}
            className="inline-flex"
          >
            <Dices className="h-4 w-4" />
          </motion.span>
          {tr("Surprise me")}</button>
        <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
          {tr("or draw a")}</span>
        {(Object.keys(KIND_META) as CardKind[]).map((kind) => {
          const item = KIND_META[kind];
          const Icon = item.icon;
          return (
            <button
              key={kind}
              onClick={() => onDraw(kind)}
              disabled={drawing}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-60"
              style={{ borderColor: `color-mix(in srgb, ${item.color} 33.3%, transparent)`, color: item.color }}
            >
              <Icon className="h-3.5 w-3.5" />
              {tr(item.label)}
            </button>
          );
        })}
        <Sparkles className="ml-auto hidden h-4 w-4 sm:block" style={{ color: COLORS.textSecondary }} aria-hidden="true" />
      </div>
    </section>
  );
};
