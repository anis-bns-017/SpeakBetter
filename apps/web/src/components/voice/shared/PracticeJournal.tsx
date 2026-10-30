// apps/web/src/components/voice/shared/PracticeJournal.tsx
/**
 * PracticeJournal — personal learning log.
 * Two modes: browse (all entries) + review (spaced repetition queue).
 */

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  X,
  Search,
  Check,
  RotateCcw,
  Trash2,
  Download,
  Sparkles,
  Brain,
  Zap,
  Trophy,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { THEME } from "../VoiceRoomView.theme";
import type {
  JournalEntry,
  MasteryLevel,
} from "../../../hooks/usePracticeJournal";

type Tab = "browse" | "review" | "stats";

interface PracticeJournalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  stats: {
    total: number;
    byMastery: { new: number; learning: number; mastered: number };
    byCategory: Record<string, number>;
    dueForReview: JournalEntry[];
    thisWeek: number;
    masteryRate: number;
  };
  onReview: (id: string, result: "good" | "again") => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  exportText: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  grammar: "#22d3ee",
  vocabulary: "#a78bfa",
  pronunciation: "#fbbf24",
  "word-choice": "#34d399",
  spelling: "#f472b6",
  other: "#94a3b8",
};

const MASTERY_META: Record<
  MasteryLevel,
  { label: string; color: string; icon: typeof Zap }
> = {
  new: { label: "New", color: "#22d3ee", icon: Sparkles },
  learning: { label: "Learning", color: "#fbbf24", icon: Brain },
  mastered: { label: "Mastered", color: "#34d399", icon: Trophy },
};

export const PracticeJournal: React.FC<PracticeJournalProps> = ({
  isOpen,
  onClose,
  entries,
  stats,
  onReview,
  onRemove,
  onClearAll,
  exportText,
}) => {
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterMastery, setFilterMastery] = useState<MasteryLevel | null>(null);

  // Review queue state
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const filtered = useMemo(() => {
    let out = [...entries];
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(
        (e) =>
          e.original.toLowerCase().includes(q) ||
          e.corrected.toLowerCase().includes(q) ||
          e.note?.toLowerCase().includes(q) ||
          e.helperName?.toLowerCase().includes(q),
      );
    }
    if (filterCategory) out = out.filter((e) => e.category === filterCategory);
    if (filterMastery) out = out.filter((e) => e.mastery === filterMastery);
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }, [entries, search, filterCategory, filterMastery]);

  const reviewQueue = stats.dueForReview;
  const currentReview = reviewQueue[reviewIndex];

  const handleDownload = () => {
    try {
      const blob = new Blob([exportText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `practice-journal-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Journal downloaded");
    } catch {
      toast.error("Download failed");
    }
  };

  const handleReviewResult = (result: "good" | "again") => {
    if (!currentReview) return;
    onReview(currentReview.id, result);
    setRevealed(false);
    // Move to next (or wrap)
    if (reviewIndex >= reviewQueue.length - 1) {
      setReviewIndex(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-[85] px-4 py-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col border overflow-hidden"
            style={{
              background: THEME.colors.background.card,
              borderColor: THEME.colors.border.primary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 pt-5 pb-4 shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(129,140,248,0.12), rgba(34,211,238,0.05))",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.cyan})`,
                    }}
                  >
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      className="text-base font-bold truncate"
                      style={{ color: THEME.colors.text.primary }}
                    >
                      Practice Journal
                    </h3>
                    <p
                      className="text-xs truncate"
                      style={{ color: THEME.colors.text.muted }}
                    >
                      {stats.total} entries · {stats.byMastery.mastered} mastered ·{" "}
                      {stats.dueForReview.length} due
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

              {/* Tabs */}
              <div className="flex items-center gap-1 mt-4">
                {(
                  [
                    { key: "browse", label: "Browse", icon: BookOpen },
                    {
                      key: "review",
                      label: `Review${reviewQueue.length ? ` (${reviewQueue.length})` : ""}`,
                      icon: Brain,
                    },
                    { key: "stats", label: "Stats", icon: Trophy },
                  ] as const
                ).map(({ key, label, icon: Icon }) => {
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: active
                          ? "rgba(129,140,248,0.16)"
                          : "transparent",
                        color: active
                          ? THEME.colors.accent.primary
                          : THEME.colors.text.muted,
                        border: `1px solid ${
                          active
                            ? "rgba(129,140,248,0.3)"
                            : "transparent"
                        }`,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {/* BROWSE TAB */}
              {tab === "browse" && (
                <div className="p-4 space-y-3">
                  {/* Search + filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                        style={{ color: THEME.colors.text.muted }}
                      />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search entries…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
                        style={{
                          background: THEME.colors.background.primary,
                          borderColor: THEME.colors.border.primary,
                          color: THEME.colors.text.primary,
                        }}
                      />
                    </div>

                    {/* Category chips */}
                    <div className="flex items-center gap-1">
                      {Object.keys(CATEGORY_COLORS).map((c) => {
                        const active = filterCategory === c;
                        const count = stats.byCategory[c] || 0;
                        if (count === 0) return null;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setFilterCategory(active ? null : c)
                            }
                            className="text-[9px] px-2 py-1 rounded-full border transition-colors"
                            style={{
                              background: active
                                ? `${CATEGORY_COLORS[c]}22`
                                : "transparent",
                              borderColor: active
                                ? CATEGORY_COLORS[c]
                                : THEME.colors.border.primary,
                              color: active
                                ? CATEGORY_COLORS[c]
                                : THEME.colors.text.muted,
                            }}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mastery filter */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] uppercase tracking-wider font-semibold"
                      style={{ color: THEME.colors.text.muted }}
                    >
                      Mastery
                    </span>
                    {(["new", "learning", "mastered"] as MasteryLevel[]).map(
                      (m) => {
                        const meta = MASTERY_META[m];
                        const Icon = meta.icon;
                        const active = filterMastery === m;
                        const count = stats.byMastery[m];
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFilterMastery(active ? null : m)}
                            className="text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 transition-colors"
                            style={{
                              background: active
                                ? `${meta.color}22`
                                : "transparent",
                              borderColor: active
                                ? meta.color
                                : THEME.colors.border.primary,
                              color: active
                                ? meta.color
                                : THEME.colors.text.muted,
                            }}
                          >
                            <Icon className="w-2.5 h-2.5" />
                            {meta.label}
                            <span className="opacity-70">({count})</span>
                          </button>
                        );
                      },
                    )}
                    <div className="flex-1" />
                    {entries.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Clear all journal entries? This can't be undone.",
                            )
                          ) {
                            onClearAll();
                          }
                        }}
                        className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        style={{ color: THEME.colors.accent.error }}
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                  </div>

                  {/* List */}
                  {filtered.length === 0 ? (
                    <EmptyJournal hasAny={entries.length > 0} />
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((entry) => (
                        <EntryCard
                          key={entry.id}
                          entry={entry}
                          onRemove={onRemove}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* REVIEW TAB */}
              {tab === "review" && (
                <div className="p-5">
                  {reviewQueue.length === 0 ? (
                    <div className="text-center py-12">
                      <div
                        className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                        style={{ background: "rgba(52,211,153,0.08)" }}
                      >
                        <Trophy
                          className="w-7 h-7"
                          style={{ color: THEME.colors.accent.success }}
                        />
                      </div>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: THEME.colors.text.primary }}
                      >
                        All caught up!
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        Come back later when entries are due for review.
                      </p>
                    </div>
                  ) : currentReview ? (
                    <div className="max-w-md mx-auto space-y-5">
                      {/* Progress */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span style={{ color: THEME.colors.text.muted }}>
                          Card {reviewIndex + 1} of {reviewQueue.length}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: `${MASTERY_META[currentReview.mastery].color}22`,
                            color: MASTERY_META[currentReview.mastery].color,
                          }}
                        >
                          {MASTERY_META[currentReview.mastery].label}
                        </span>
                      </div>

                      {/* Card */}
                      <div
                        className="rounded-2xl border p-6 min-h-[220px] flex flex-col items-center justify-center text-center"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          borderColor: THEME.colors.border.primary,
                        }}
                      >
                        <p
                          className="text-[10px] uppercase tracking-wider font-semibold mb-3"
                          style={{ color: THEME.colors.text.muted }}
                        >
                          What you said
                        </p>
                        <p
                          className="text-lg leading-snug mb-4"
                          style={{ color: THEME.colors.text.primary }}
                        >
                          {currentReview.original}
                        </p>

                        <AnimatePresence mode="wait">
                          {revealed ? (
                            <motion.div
                              key="answer"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="w-full pt-4 border-t"
                              style={{
                                borderColor: THEME.colors.border.primary,
                              }}
                            >
                              <p
                                className="text-[10px] uppercase tracking-wider font-semibold mb-2"
                                style={{ color: THEME.colors.accent.success }}
                              >
                                Better way
                              </p>
                              <p
                                className="text-lg leading-snug"
                                style={{ color: THEME.colors.accent.success }}
                              >
                                {currentReview.corrected}
                              </p>
                              {currentReview.note && (
                                <p
                                  className="text-xs italic mt-3"
                                  style={{ color: THEME.colors.text.muted }}
                                >
                                  {currentReview.note}
                                </p>
                              )}
                            </motion.div>
                          ) : (
                            <motion.button
                              key="reveal"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              onClick={() => setRevealed(true)}
                              className="px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-[1.03]"
                              style={{
                                background: "rgba(129,140,248,0.15)",
                                color: THEME.colors.accent.primary,
                              }}
                            >
                              Reveal answer
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Review buttons */}
                      {revealed && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => handleReviewResult("again")}
                            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5"
                            style={{
                              background: "rgba(251,191,36,0.12)",
                              color: THEME.colors.accent.warning,
                              border: "1px solid rgba(251,191,36,0.25)",
                            }}
                          >
                            <RotateCcw className="w-4 h-4" />
                            Still learning
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewResult("good")}
                            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5"
                            style={{
                              background: `linear-gradient(135deg, ${THEME.colors.accent.success}, ${THEME.colors.accent.cyan})`,
                              color: "#fff",
                            }}
                          >
                            <Check className="w-4 h-4" />
                            Got it
                          </button>
                        </motion.div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* STATS TAB */}
              {tab === "stats" && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <StatTile
                      icon={Sparkles}
                      color={MASTERY_META.new.color}
                      label="New"
                      value={stats.byMastery.new}
                    />
                    <StatTile
                      icon={Brain}
                      color={MASTERY_META.learning.color}
                      label="Learning"
                      value={stats.byMastery.learning}
                    />
                    <StatTile
                      icon={Trophy}
                      color={MASTERY_META.mastered.color}
                      label="Mastered"
                      value={stats.byMastery.mastered}
                    />
                  </div>

                  {/* Mastery ring */}
                  <div
                    className="rounded-2xl border p-4 flex items-center gap-4"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      borderColor: THEME.colors.border.primary,
                    }}
                  >
                    <MasteryRing percentage={stats.masteryRate} />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: THEME.colors.text.primary }}
                      >
                        Mastery progress
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        {stats.byMastery.mastered} of {stats.total} entries
                        mastered
                      </p>
                      <p
                        className="text-[10px] mt-2 flex items-center gap-1"
                        style={{ color: THEME.colors.accent.primary }}
                      >
                        <Calendar className="w-3 h-3" />
                        {stats.thisWeek} added this week
                      </p>
                    </div>
                  </div>

                  {/* Category breakdown */}
                  {Object.keys(stats.byCategory).length > 0 && (
                    <div
                      className="rounded-2xl border p-4"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        borderColor: THEME.colors.border.primary,
                      }}
                    >
                      <p
                        className="text-sm font-semibold mb-3"
                        style={{ color: THEME.colors.text.primary }}
                      >
                        By category
                      </p>
                      <div className="space-y-2.5">
                        {Object.entries(stats.byCategory)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cat, count]) => {
                            const pct = Math.round(
                              (count / stats.total) * 100,
                            );
                            const color =
                              CATEGORY_COLORS[cat] ?? THEME.colors.accent.primary;
                            return (
                              <div key={cat}>
                                <div className="flex items-center justify-between mb-1">
                                  <span
                                    className="text-[11px] font-medium capitalize"
                                    style={{ color: THEME.colors.text.secondary }}
                                  >
                                    {cat}
                                  </span>
                                  <span
                                    className="text-[10px] tabular-nums"
                                    style={{ color: THEME.colors.text.muted }}
                                  >
                                    {count} · {pct}%
                                  </span>
                                </div>
                                <div
                                  className="h-1.5 rounded-full overflow-hidden"
                                  style={{ background: "rgba(255,255,255,0.06)" }}
                                >
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6 }}
                                    className="h-full rounded-full"
                                    style={{ background: color }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Export */}
                  {entries.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border transition-all hover:-translate-y-0.5"
                      style={{
                        borderColor: THEME.colors.border.primary,
                        color: THEME.colors.text.secondary,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Export journal
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ------------------------------------------------------------

const EntryCard: React.FC<{
  entry: JournalEntry;
  onRemove: (id: string) => void;
}> = ({ entry, onRemove }) => {
  const meta = MASTERY_META[entry.mastery];
  const MetaIcon = meta.icon;
  const catColor = CATEGORY_COLORS[entry.category] ?? "#94a3b8";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border p-3 transition-colors hover:bg-white/[0.02]"
      style={{
        background: "rgba(255,255,255,0.015)",
        borderColor: THEME.colors.border.primary,
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${catColor}22`, color: catColor }}
        >
          <MetaIcon className="w-3.5 h-3.5" />
        </span>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider"
              style={{ background: `${catColor}22`, color: catColor }}
            >
              {entry.category}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider"
              style={{ background: `${meta.color}22`, color: meta.color }}
            >
              {meta.label}
            </span>
            {entry.helperName && (
              <span
                className="text-[9px]"
                style={{ color: THEME.colors.text.muted }}
              >
                from {entry.helperName}
              </span>
            )}
          </div>

          <p
            className="text-xs leading-snug"
            style={{ color: THEME.colors.text.secondary }}
          >
            <span className="line-through opacity-55">{entry.original}</span>
            <ArrowRight
              className="w-3 h-3 inline mx-1.5 opacity-50"
              style={{ color: THEME.colors.accent.success }}
            />
            <span style={{ color: THEME.colors.text.primary }}>
              {entry.corrected}
            </span>
          </p>

          {entry.note && (
            <p
              className="text-[10px] italic leading-snug"
              style={{ color: THEME.colors.text.muted }}
            >
              {entry.note}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
          style={{ color: THEME.colors.accent.error }}
          aria-label="Remove entry"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
};

const EmptyJournal: React.FC<{ hasAny: boolean }> = ({ hasAny }) => (
  <div className="text-center py-12">
    <div
      className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
      style={{ background: "rgba(129,140,248,0.08)" }}
    >
      <BookOpen
        className="w-7 h-7"
        style={{ color: THEME.colors.accent.primary }}
      />
    </div>
    <p
      className="text-sm font-semibold"
      style={{ color: THEME.colors.text.primary }}
    >
      {hasAny ? "No matches" : "Your journal is empty"}
    </p>
    <p
      className="text-xs mt-1 max-w-[280px] mx-auto leading-relaxed"
      style={{ color: THEME.colors.text.muted }}
    >
      {hasAny
        ? "Try a different search or clear filters."
        : "Accepted corrections will land here automatically, giving you a personal study list."}
    </p>
  </div>
);

const StatTile: React.FC<{
  icon: typeof Sparkles;
  color: string;
  label: string;
  value: number;
}> = ({ icon: Icon, color, label, value }) => (
  <div
    className="rounded-xl border p-3 text-center"
    style={{
      background: "rgba(255,255,255,0.02)",
      borderColor: THEME.colors.border.primary,
    }}
  >
    <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color }} />
    <p
      className="text-xl font-bold tabular-nums"
      style={{ color: THEME.colors.text.primary }}
    >
      {value}
    </p>
    <p
      className="text-[10px] uppercase tracking-wider mt-0.5"
      style={{ color: THEME.colors.text.muted }}
    >
      {label}
    </p>
  </div>
);

const MasteryRing: React.FC<{ percentage: number }> = ({ percentage }) => {
  const size = 84;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={6}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={THEME.colors.accent.success}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: THEME.colors.text.primary }}
        >
          {percentage}%
        </span>
      </div>
    </div>
  );
};

export default PracticeJournal;