/**
 * FlashcardPage — the review loop.
 *
 * Every correction you receive (in a voice room, in chat, or from the AI partner) becomes a card
 * here, due straight away. You also review the words you saved. Each answer decides when the card
 * returns (spaced repetition), so mistakes you've fixed fade out and the ones you repeat keep coming.
 * "My mistakes" shows which kinds of error keep coming back, and lets you practise just those.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle,
  Layers,
  Loader2,
  RotateCcw,
  SkipForward,
  TrendingDown,
  TrendingUp,
  Volume2,
  X,
} from "lucide-react";
import {
  formatInterval,
  useAnswerReview,
  useMistakesReport,
  useReviewQueue,
  useSyncReview,
  type MistakeGroup,
  type ReviewItem,
  type ReviewQueue,
  type ReviewRating,
} from "../hooks/useReview";
import { diffWords } from "../lib/textDiff";
import { MemoryView } from "../components/review/MemoryView";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

const RATINGS: Array<{ rating: ReviewRating; label: string; tone: string }> = [
  { rating: "again", label: "Again", tone: "bg-rose-50 hover:bg-rose-100 border-rose-200/80 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300" },
  { rating: "hard", label: "Hard", tone: "bg-amber-50 hover:bg-amber-100 border-amber-200/80 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300" },
  { rating: "good", label: "Good", tone: "bg-sky-50 hover:bg-sky-100 border-sky-200/80 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-300" },
  { rating: "easy", label: "Easy", tone: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200/80 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300" },
];

const LANGUAGES = [
  { code: "", name: "All languages" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
];

// ============================================================
// One review session
// ============================================================

const CardFace: React.FC<{ item: ReviewItem; flipped: boolean }> = ({ item, flipped }) => {
  const isMistake = item.kind === "correction";
  // Pronunciation cards hold what you were heard as saying ("sink") and what you meant ("think")
  const isSound = item.pattern === "PRONUNCIATION";
  const parts = useMemo(() => (isMistake ? diffWords(item.front, item.back) : []), [isMistake, item.front, item.back]);

  return (
    <div className="w-full text-center">
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-white/[0.07] text-slate-500">
          {isMistake
            ? flipped
              ? isSound ? "What you meant" : "Correct version"
              : isSound ? "You were heard saying" : "Fix this sentence"
            : flipped ? "Meaning" : "Word"}
        </span>
        {item.patternLabel && (
          <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">
            {item.patternLabel}
          </span>
        )}
        {item.isNew && (
          <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">New</span>
        )}
        {item.recall !== null && (
          <span
            title="Your chance of remembering this card right now (FSRS)"
            className={`px-3 py-1 rounded-full text-[11px] font-semibold tabular-nums ${
              item.recall >= 85
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : item.recall >= 65
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
            }`}
          >
            {item.recall}% recall
          </span>
        )}
      </div>

      {isMistake ? (
        flipped ? (
          <>
            <p className="text-2xl sm:text-3xl font-bold leading-relaxed text-slate-900 dark:text-white">
              {parts
                .filter((p) => p.kind !== "removed")
                .map((p, i) =>
                  p.kind === "added" ? (
                    <mark key={i} className="rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 px-1">{p.text}</mark>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )}
            </p>
            <p className="mt-3 text-sm text-slate-400 line-through decoration-rose-400/70">{item.front}</p>
            {item.note && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.note}</p>}
          </>
        ) : (
          <>
            <p className="text-2xl sm:text-3xl font-bold leading-relaxed text-slate-900 dark:text-white">{item.front}</p>
            <p className="mt-4 text-sm text-slate-500">
              {isSound
                ? "What did you mean to say? Say it aloud, then flip the card."
                : "Say it correctly in your head, then flip the card."}
            </p>
          </>
        )
      ) : (
        <>
          <p className="text-3xl font-extrabold tracking-tight leading-relaxed text-slate-900 dark:text-white">{flipped ? item.back : item.front}</p>
          {flipped && item.note && <p className="mt-3 text-sm text-slate-500 italic">“{item.note}”</p>}
        </>
      )}
    </div>
  );
};

const Session: React.FC<{
  initial: ReviewItem[];
  dueAtStart: ReviewQueue["due"];
  showingAll: boolean;
  onMore: () => void;
}> = ({ initial, dueAtStart, showingAll, onMore }) => {
  const answer = useAnswerReview();
  const { mutateAsync: sendAnswer } = answer;
  const [queue, setQueue] = useState<ReviewItem[]>(initial);
  const [flipped, setFlipped] = useState(false);
  const [counts, setCounts] = useState<Record<ReviewRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const total = initial.length;
  const answered = counts.again + counts.hard + counts.good + counts.easy;
  const current = queue[0];
  const busyRef = useRef(false);

  useEffect(() => () => stopSpeaking(), []);

  const rate = useCallback(
    async (rating: ReviewRating) => {
      const item = queue[0];
      if (!item || busyRef.current) return;
      busyRef.current = true;
      try {
        await sendAnswer({ type: item.type, id: item.id, rating });
        setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
        // A card you forgot comes round again before this session ends
        setQueue((q) => (rating === "again" ? [...q.slice(1), item] : q.slice(1)));
        setFlipped(false);
        stopSpeaking();
      } catch {
        toast.error("Couldn't save that answer. Please try again.");
      } finally {
        busyRef.current = false;
      }
    },
    [queue, sendAnswer],
  );

  const skip = () => {
    setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
    setFlipped(false);
    stopSpeaking();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !current) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        void rate(RATINGS[Number(e.key) - 1].rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, flipped, rate]);

  // ---------- nothing to review ----------
  if (total === 0) {
    return (
      <div className={`${card} p-10 sm:p-14 text-center`}>
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-4">All caught up!</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          Nothing is due right now. New cards appear here whenever someone corrects you, in a room, in chat or with your AI partner.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!showingAll && (
            <button type="button" onClick={onMore} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]">
              Review all cards anyway
            </button>
          )}
          <Link to="/voice" className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2">
            Practise in a room <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ---------- finished ----------
  if (!current) {
    return (
      <div className={`${card} p-8 sm:p-10 text-center`}>
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-4">Session complete</h2>
        <p className="text-sm text-slate-500 mt-1">
          You reviewed {total} card{total === 1 ? "" : "s"}. Cards you knew will come back later; the rest return soon.
        </p>
        <div className="grid grid-cols-4 gap-2 mt-6 max-w-sm mx-auto">
          {RATINGS.map((r) => (
            <div key={r.rating} className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.04]">
              <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{counts[r.rating]}</p>
              <p className="text-[11px] text-slate-500">{r.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {dueAtStart.total > total && (
            <button type="button" onClick={onMore} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2">
              Review {Math.min(dueAtStart.total - total, 30)} more <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <Link to="/ai-partner" className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/[0.05]">
            <Bot className="w-4 h-4" /> Practise with the AI partner
          </Link>
        </div>
      </div>
    );
  }

  const pct = Math.round((answered / Math.max(1, total)) * 100);
  const speakText = current.kind === "correction" ? current.back : current.front;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
          <span>{Math.min(answered + 1, total)} of {total}</span>
          <span>{queue.length} left</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        aria-label={flipped ? "Hide the answer" : "Show the answer"}
        className={`${card} relative min-h-[280px] p-6 sm:p-10 flex items-center justify-center cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
          flipped ? "border-indigo-200 dark:border-indigo-500/30" : ""
        }`}
      >
        <CardFace item={current} flipped={flipped} />
        {canSpeak() && flipped && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void speak(speakText);
            }}
            aria-label="Hear it"
            title="Hear it"
            className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            <Volume2 className="w-[18px] h-[18px]" />
          </button>
        )}
        {!flipped && (
          <span className="absolute bottom-4 text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Tap or press Space to flip
          </span>
        )}
      </div>

      {flipped ? (
        <div>
          <p className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">How well did you know it?</p>
          <div className="grid grid-cols-4 gap-2.5">
            {RATINGS.map((r, i) => (
              <button
                key={r.rating}
                type="button"
                onClick={() => void rate(r.rating)}
                disabled={answer.isPending}
                className={`p-3 border rounded-2xl text-sm font-bold transition-colors flex flex-col items-center gap-0.5 disabled:opacity-50 ${r.tone}`}
              >
                <span>{r.label}</span>
                <span className="text-[11px] font-medium opacity-70">{formatInterval(current.preview[r.rating])}</span>
                <span className="hidden sm:block text-[10px] font-normal opacity-50">key {i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setFlipped(true)} className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors">
          Show answer
        </button>
      )}

      <div className="flex justify-center">
        <button type="button" onClick={skip} disabled={queue.length < 2} className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40 flex items-center gap-1.5">
          <SkipForward className="w-3.5 h-3.5" /> Skip for now
        </button>
      </div>
    </div>
  );
};

// ============================================================
// My mistakes
// ============================================================

const TrendBadge: React.FC<{ group: MistakeGroup }> = ({ group }) => {
  if (group.trend === "up")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
        <TrendingUp className="w-3.5 h-3.5" /> {group.last7} this week, {group.prev7} last week
      </span>
    );
  if (group.trend === "down")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <TrendingDown className="w-3.5 h-3.5" /> Improving: {group.last7} this week, {group.prev7} last week
      </span>
    );
  return <span className="text-xs text-slate-400">{group.last7} this week</span>;
};

const MistakesView: React.FC<{ onPractise: (pattern: string) => void }> = ({ onPractise }) => {
  const { data, isLoading, isError, refetch } = useMistakesReport(30);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-500">We couldn't load your mistakes.</p>
        <button type="button" onClick={() => refetch()} className="mt-3 px-4 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Try again</button>
      </div>
    );
  }
  if (data.total === 0) {
    return (
      <div className={`${card} p-10 text-center`}>
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
          <BarChart3 className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-4">No corrections yet</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          When someone corrects you in a voice room or chat, or your AI partner does, the mistake shows up here, grouped by type, so you can see what to work on.
        </p>
      </div>
    );
  }

  const habits = data.patterns.filter((p) => p.repeating).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {data.total} correction{data.total === 1 ? "" : "s"} in the last {data.days} days.{" "}
        {habits > 0 ? `${habits} kind${habits === 1 ? "" : "s"} of mistake keep${habits === 1 ? "s" : ""} coming back.` : "No habit stands out yet. Nice!"}
      </p>
      {data.patterns.map((g) => (
        <section key={g.pattern} className={`${card} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {g.label}
                {g.repeating && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">Keeps coming back</span>}
              </h2>
              <div className="mt-1"><TrendBadge group={g} /></div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{g.count}</p>
              <p className="text-[11px] text-slate-500">time{g.count === 1 ? "" : "s"}</p>
            </div>
          </div>

          {g.learned > 0 && (
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((g.learned / g.count) * 100)}%` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{g.learned} of {g.count} learned (remembered for 3+ weeks)</p>
            </div>
          )}

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{g.tip}</p>

          <ul className="mt-3 space-y-2">
            {g.examples.map((e, i) => (
              <li key={i} className="text-sm rounded-xl bg-slate-50 dark:bg-white/[0.04] px-3 py-2">
                <span className="text-rose-500 line-through">{e.original}</span>
                <ArrowRight className="inline w-3.5 h-3.5 mx-1.5 text-slate-400" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{e.corrected}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => onPractise(g.pattern)}
            className="mt-4 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2"
          >
            Practise these <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      ))}
    </div>
  );
};

// ============================================================
// Page
// ============================================================

type Tab = "review" | "mistakes" | "memory";
type KindFilter = "" | "correction" | "word";

export const FlashcardPage: React.FC = () => {
  const [search, setSearch] = useSearchParams();
  const tabParam = search.get("tab");
  const tab: Tab = tabParam === "mistakes" || tabParam === "memory" ? tabParam : "review";
  const pattern = search.get("pattern") ?? "";
  const [kind, setKind] = useState<KindFilter>("");
  const [language, setLanguage] = useState("");
  const [all, setAll] = useState(false);
  // Bumped to start a new session (the old one keeps its own list of cards)
  const [round, setRound] = useState(0);

  const { data, isLoading, isError, refetch, isFetching } = useReviewQueue({
    all,
    kind: kind || undefined,
    pattern: pattern || undefined,
    language: language || undefined,
  });
  const { mutate: syncHistory } = useSyncReview();

  // Corrections from before this feature existed join the deck (at most once every few minutes)
  useEffect(() => {
    syncHistory();
  }, [syncHistory]);

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(search);
    if (next === "review") params.delete("tab");
    else params.set("tab", next);
    setSearch(params, { replace: true });
  };

  const practise = (p: string) => {
    const params = new URLSearchParams();
    params.set("pattern", p);
    setSearch(params, { replace: true });
    setKind("");
    setAll(false);
    setRound((r) => r + 1);
  };

  const clearPattern = () => {
    const params = new URLSearchParams(search);
    params.delete("pattern");
    setSearch(params, { replace: true });
    setRound((r) => r + 1);
  };

  const more = useCallback(() => {
    setRound((r) => r + 1);
    void refetch();
  }, [refetch]);

  const chip = (active: boolean) =>
    `h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
      active
        ? "bg-indigo-600 border-indigo-600 text-white"
        : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
    }`;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
          <Layers className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Review</h1>
          <p className="text-sm text-slate-500">
            {data
              ? data.due.total > 0
                ? `${data.due.corrections} mistake${data.due.corrections === 1 ? "" : "s"} and ${data.due.words} word${data.due.words === 1 ? "" : "s"} due`
                : "Nothing due right now"
              : "Fix mistakes for good with spaced repetition"}
          </p>
        </div>
      </header>

      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] w-fit" role="tablist">
        {(["review", "mistakes", "memory"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 px-4 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {t === "review" ? "Review" : t === "mistakes" ? "My mistakes" : "Memory"}
          </button>
        ))}
      </div>

      {tab === "memory" ? (
        <MemoryView />
      ) : tab === "mistakes" ? (
        <MistakesView
          onPractise={(p) => {
            practise(p);
            setTab("review");
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {([["", "All"], ["correction", "My mistakes"], ["word", "Words"]] as const).map(([value, label]) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => {
                  setKind(value);
                  setRound((r) => r + 1);
                }}
                className={chip(kind === value)}
              >
                {label}
              </button>
            ))}
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setRound((r) => r + 1);
              }}
              aria-label="Language"
              className="h-8 px-3 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setAll((v) => !v);
                setRound((r) => r + 1);
              }}
              aria-pressed={all}
              className={chip(all)}
            >
              {all ? "All cards" : "Due only"}
            </button>
            {pattern && (
              <button type="button" onClick={clearPattern} className="h-8 pl-3 pr-2 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                Practising: {pattern.toLowerCase().replace(/_/g, " ")} <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isLoading || (isFetching && !data) ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-500">Preparing your cards…</p>
            </div>
          ) : isError || !data ? (
            <div className="text-center py-16">
              <p className="text-sm text-slate-500">We couldn't load your cards.</p>
              <button type="button" onClick={() => refetch()} className="mt-3 px-4 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Try again</button>
            </div>
          ) : (
            <Session key={`${round}:${data.items.map((i) => i.key).join(",")}`} initial={data.items} dueAtStart={data.due} showingAll={all} onMore={more} />
          )}
        </>
      )}
    </div>
  );
};
