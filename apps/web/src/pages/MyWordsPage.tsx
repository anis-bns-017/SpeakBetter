// apps/web/src/pages/MyWordsPage.tsx
/**
 * My words: every word you saved, in one place. Words come from word packs, the word of the day, voice rooms,
 * or you add your own. Each one shows its meaning, an example, where it came from and how well you know it
 * (its FSRS recall chance). Practising happens on the Review page; this page is your collection.
 */

import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AudioLines,
  BookA,
  BookOpen,
  Brain,
  CalendarClock,
  Check,
  Loader2,
  Package,
  Pencil,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useAddWord,
  useRemoveWord,
  useUpdateWord,
  useWords,
  wordsError,
  type BankWord,
  type WordSource,
  type WordStage,
} from "../hooks/useWords";
import { apiClient } from "../lib/api/client";
import { meaningFrom, type LookupResult } from "../hooks/useLookup";
import { canSpeak, speak } from "../lib/speech";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const input =
  "w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition";

const SOURCE: Record<WordSource, { label: string; icon: LucideIcon; tone: string }> = {
  pack: { label: "Word packs", icon: Package, tone: "text-emerald-600 dark:text-emerald-300" },
  dict: { label: "Dictionary", icon: BookA, tone: "text-sky-600 dark:text-sky-300" },
  room: { label: "Voice rooms", icon: AudioLines, tone: "text-rose-600 dark:text-rose-300" },
  mine: { label: "Added by you", icon: PenLine, tone: "text-indigo-600 dark:text-indigo-300" },
};

const STAGE: Record<WordStage, { label: string; dot: string }> = {
  new: { label: "New", dot: "bg-sky-600" },
  learning: { label: "Learning", dot: "bg-amber-600" },
  learned: { label: "Learned", dot: "bg-emerald-600" },
};

type SortKey = "newest" | "az" | "weakest";
const PAGE = 60;
const DAY = 24 * 60 * 60 * 1000;

/** "Due now", "Next: tomorrow", "Next: in 5 days", "Next: in 3 wk" */
function nextReview(word: BankWord, now: number): string {
  if (word.due) return "Due now";
  const days = Math.round((new Date(word.dueAt).getTime() - now) / DAY);
  if (days <= 0) return "Next: later today";
  if (days === 1) return "Next: tomorrow";
  if (days < 14) return `Next: in ${days} days`;
  if (days < 60) return `Next: in ${Math.round(days / 7)} wk`;
  return `Next: in ${Math.round(days / 30)} mo`;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The example sentence with the word picked out */
const Example: React.FC<{ text: string; word: string }> = ({ text, word }) => {
  const parts = word.trim() ? text.split(new RegExp(`(${escapeRegExp(word.trim())}\\w*)`, "i")) : [text];
  return (
    <p className="text-[13px] italic leading-relaxed text-slate-500 dark:text-slate-400">
      “
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="not-italic font-semibold bg-transparent text-slate-800 dark:text-slate-100">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
      ”
    </p>
  );
};

const RecallChip: React.FC<{ word: BankWord }> = ({ word }) =>
  word.recall === null ? (
    <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
      New
    </span>
  ) : (
    <span
      title="Your chance of remembering this word right now"
      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
        word.recall >= 85
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : word.recall >= 65
            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
      }`}
    >
      {word.recall}% recall
    </span>
  );

/** Asks the free dictionary for a meaning and example */
async function lookUp(word: string): Promise<{ meaning: string; example: string | null } | null> {
  try {
    const { data } = await apiClient.get<LookupResult>("/translate/lookup", { params: { text: word }, timeout: 8000 });
    const meaning = meaningFrom(data);
    if (!meaning) return null;
    return { meaning: meaning.slice(0, 300), example: data.meanings.find((m) => m.example)?.example ?? null };
  } catch {
    return null;
  }
}

// ============================================================
// Add a word
// ============================================================

const AddWordPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  const [looking, setLooking] = useState(false);
  const add = useAddWord();

  const findMeaning = async () => {
    if (!word.trim()) return;
    setLooking(true);
    const found = await lookUp(word.trim());
    setLooking(false);
    if (!found) {
      toast.error("Couldn't find a meaning. Type your own.");
      return;
    }
    setMeaning(found.meaning);
    if (!example.trim() && found.example) setExample(found.example);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    add.mutate(
      { word, meaning, example },
      {
        onSuccess: (saved) => {
          toast.success(`“${saved.word}” is in your words. It will come up in review.`);
          setWord("");
          setMeaning("");
          setExample("");
        },
        onError: (err) => toast.error(wordsError(err, "Couldn't save the word. Try again.")),
      },
    );
  };

  return (
    <motion.form
      onSubmit={save}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className={`${card} p-5 space-y-3`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Add a word of your own</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="sr-only">Word or phrase</span>
            <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={60} placeholder="Word or short phrase, e.g. “give up”" className={input} autoFocus />
          </label>
          <button
            type="button"
            onClick={findMeaning}
            disabled={!word.trim() || looking}
            className="h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-500" />} Look it up
          </button>
        </div>
        <label className="block">
          <span className="sr-only">Meaning</span>
          <textarea value={meaning} onChange={(e) => setMeaning(e.target.value)} maxLength={300} rows={2} placeholder="What it means, in any language" className={`${input} resize-none`} />
        </label>
        <label className="block">
          <span className="sr-only">Example sentence</span>
          <input value={example} onChange={(e) => setExample(e.target.value)} maxLength={300} placeholder="An example sentence (optional)" className={input} />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!word.trim() || !meaning.trim() || add.isPending}
            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save word
          </button>
        </div>
      </div>
    </motion.form>
  );
};

// ============================================================
// One word
// ============================================================

const WordCard: React.FC<{ word: BankWord; now: number }> = ({ word, now }) => {
  const [editing, setEditing] = useState(false);
  const [meaning, setMeaning] = useState(word.meaning ?? "");
  const [example, setExample] = useState(word.example ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [looking, setLooking] = useState(false);
  const update = useUpdateWord();
  const remove = useRemoveWord();
  const src = SOURCE[word.source];
  const SourceIcon = src.icon;

  const startEdit = () => {
    setMeaning(word.meaning ?? "");
    setExample(word.example ?? "");
    setEditing(true);
  };

  const findMeaning = async () => {
    setLooking(true);
    const found = await lookUp(word.word);
    setLooking(false);
    if (!found) {
      toast.error("Couldn't find a meaning. Type your own.");
      return;
    }
    setMeaning(found.meaning);
    if (!example.trim() && found.example) setExample(found.example);
  };

  const save = () =>
    update.mutate(
      { type: word.type, id: word.id, meaning, example },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("Saved");
        },
        onError: (err) => toast.error(wordsError(err, "Couldn't save. Try again.")),
      },
    );

  const doRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    remove.mutate(
      { type: word.type, id: word.id },
      {
        onSuccess: () => toast.success(`Removed “${word.word}”`),
        onError: (err) => {
          setConfirmRemove(false);
          toast.error(wordsError(err, "Couldn't remove it. Try again."));
        },
      },
    );
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className={`${card} p-4 flex flex-col gap-2.5`}
      onMouseLeave={() => setConfirmRemove(false)}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-lg font-bold tracking-tight text-slate-900 dark:text-white break-words">{word.word}</h3>
        {canSpeak() && (
          <button
            type="button"
            onClick={() => void speak(word.word, { rate: 0.85 })}
            className="shrink-0 w-8 h-8 -mt-0.5 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-300 dark:hover:bg-indigo-500/10 transition-colors"
            aria-label={`Hear “${word.word}”`}
            title="Hear it"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}
        <RecallChip word={word} />
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea value={meaning} onChange={(e) => setMeaning(e.target.value)} maxLength={300} rows={2} placeholder="What it means, in any language" className={`${input} resize-none`} autoFocus />
          <input value={example} onChange={(e) => setExample(e.target.value)} maxLength={300} placeholder="An example sentence (optional)" className={input} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={findMeaning}
              disabled={looking}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-50 flex items-center gap-1.5"
            >
              {looking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-500" />} Look it up
            </button>
            <span className="flex-1" />
            <button type="button" onClick={() => setEditing(false)} className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!meaning.trim() || update.isPending}
              className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {word.meaning ? (
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{word.meaning}</p>
          ) : (
            <button type="button" onClick={startEdit} className="self-start text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">
              No meaning yet. Add one
            </button>
          )}
          {word.example && <Example text={word.example} word={word.word} />}
        </>
      )}

      <div className="mt-auto pt-2 flex items-center gap-x-3 gap-y-1 flex-wrap border-t border-slate-100 dark:border-white/[0.05] text-[11.5px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1 min-w-0">
          <SourceIcon className={`w-3.5 h-3.5 shrink-0 ${src.tone}`} />
          <span className="truncate max-w-[11rem]">{word.sourceLabel}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STAGE[word.stage].dot}`} />
          {STAGE[word.stage].label}
        </span>
        <span className={`flex items-center gap-1 ${word.due ? "font-semibold text-amber-700 dark:text-amber-300" : ""}`}>
          <CalendarClock className="w-3.5 h-3.5" /> {nextReview(word, now)}
        </span>
        {!editing && (
          <span className="ml-auto flex items-center gap-0.5">
            <button type="button" onClick={startEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/5" aria-label={`Edit “${word.word}”`} title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={doRemove}
              disabled={remove.isPending}
              className={`h-7 rounded-lg flex items-center justify-center gap-1 transition-colors ${
                confirmRemove ? "px-2 bg-rose-500 text-white text-[11px] font-semibold" : "w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              }`}
              aria-label={confirmRemove ? `Click again to remove “${word.word}”` : `Remove “${word.word}”`}
              title={confirmRemove ? undefined : "Remove"}
            >
              {remove.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {confirmRemove && !remove.isPending && "Remove?"}
            </button>
          </span>
        )}
      </div>
    </motion.li>
  );
};

// ============================================================
// Page
// ============================================================

const Tile: React.FC<{ icon: LucideIcon; label: string; value: string; hint: string; tone: string }> = ({ icon: Icon, label, value, hint, tone }) => (
  <div className={`${card} p-4`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
      <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      {label}
    </p>
    <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">{hint}</p>
  </div>
);

const EmptyBank: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  const ways: Array<{ to: string; icon: LucideIcon; title: string; text: string; tone: string }> = [
    { to: "/packs", icon: Package, title: "Word packs", text: "Pick a topic and save its words", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
    { to: "/dashboard", icon: Sparkles, title: "Word of the day", text: "Save it from your dashboard", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
    { to: "/voice", icon: AudioLines, title: "Voice rooms", text: "Tap a word you hear to keep it", tone: "bg-rose-500/10 text-rose-600 dark:text-rose-300" },
  ];
  return (
    <div className={`${card} p-8 text-center`}>
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
        <BookOpen className="w-7 h-7" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Your word bank is empty</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every word you save lands here, and comes back in review just before you'd forget it.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3 text-left">
        {ways.map(({ to, icon: Icon, title, text, tone }) => (
          <Link key={title} to={to} className="group rounded-2xl border border-slate-200/80 dark:border-white/[0.07] p-4 hover:border-slate-300 dark:hover:border-white/15 hover:shadow-md transition-all">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}>
              <Icon className="w-4.5 h-4.5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{text}</p>
          </Link>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
        <Plus className="w-4 h-4" /> Add your own word
      </button>
    </div>
  );
};

export const MyWordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useWords();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<WordSource | "">("");
  const [stage, setStage] = useState<WordStage | "">("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [shown, setShown] = useState(PAGE);
  // One clock for the whole list, so "Next: in 3 days" is consistent between cards
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.items ?? []).filter(
      (w) =>
        (!source || w.source === source) &&
        (!stage || w.stage === stage) &&
        (!q || w.word.toLowerCase().includes(q) || (w.meaning ?? "").toLowerCase().includes(q) || (w.example ?? "").toLowerCase().includes(q)),
    );
    if (sort === "az") return [...list].sort((a, b) => a.word.localeCompare(b.word));
    // Weakest first: due words, then the lowest recall; new words (no recall yet) after them
    if (sort === "weakest")
      return [...list].sort((a, b) => Number(b.due) - Number(a.due) || (a.recall ?? 101) - (b.recall ?? 101) || a.word.localeCompare(b.word));
    return list;
  }, [data, query, source, stage, sort]);

  const resetFilters = () => {
    setQuery("");
    setSource("");
    setStage("");
    setShown(PAGE);
  };

  const chip = (active: boolean) =>
    `h-8 px-3 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
      active
        ? "bg-indigo-600 border-indigo-600 text-white"
        : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
    }`;
  const select =
    "h-8 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My words</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Every word you've saved, from word packs, rooms and the word of the day, in one place.</p>
          </div>
          <div className="flex gap-2">
            {!!summary?.due && (
              <button
                type="button"
                onClick={() => navigate("/flashcards?kind=word")}
                className="h-10 px-4 rounded-xl border border-amber-300/70 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/15 flex items-center gap-2"
              >
                <Brain className="w-4 h-4" /> Review {summary.due} due
              </button>
            )}
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              aria-expanded={adding}
              className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2 shadow-md shadow-indigo-500/25"
            >
              <Plus className="w-4 h-4" /> Add a word
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>{adding && <AddWordPanel onClose={() => setAdding(false)} />}</AnimatePresence>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : isError || !data || !summary ? (
          <div className={`${card} p-8 text-center`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">Couldn't load your words.</p>
            <button type="button" onClick={() => refetch()} className="mt-3 px-4 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
              Try again
            </button>
          </div>
        ) : summary.total === 0 ? (
          !adding && <EmptyBank onAdd={() => setAdding(true)} />
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile icon={BookOpen} label="Words" value={summary.total.toLocaleString()} hint={summary.thisWeek ? `+${summary.thisWeek} this week` : "None added this week"} tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" />
              <Tile icon={Check} label="Learned" value={summary.byStage.learned.toLocaleString()} hint={`${summary.byStage.learning} learning · ${summary.byStage.new} new`} tone="bg-sky-500/10 text-sky-600 dark:text-sky-300" />
              <Tile icon={Brain} label="Memory now" value={summary.averageRecall === null ? "–" : `${summary.averageRecall}%`} hint="Average chance you'd remember a reviewed word" tone="bg-violet-500/10 text-violet-600 dark:text-violet-300" />
              <Tile icon={CalendarClock} label="Due now" value={summary.due.toLocaleString()} hint={summary.due ? "Ready to review" : "Nothing to review yet"} tone="bg-amber-500/10 text-amber-600 dark:text-amber-300" />
            </div>

            {/* Search and filters */}
            <div className={`${card} p-3 space-y-3`}>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShown(PAGE);
                  }}
                  placeholder="Search words, meanings and examples…"
                  className={`${input} pl-10`}
                  aria-label="Search your words"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={chip(!source)} onClick={() => { setSource(""); setShown(PAGE); }}>
                  All <span className="tabular-nums opacity-70">{summary.total}</span>
                </button>
                {(Object.keys(SOURCE) as WordSource[]).map((key) =>
                  summary.bySource[key] ? (
                    <button key={key} type="button" className={chip(source === key)} onClick={() => { setSource(key); setShown(PAGE); }}>
                      {SOURCE[key].label} <span className="tabular-nums opacity-70">{summary.bySource[key]}</span>
                    </button>
                  ) : null,
                )}
                <span className="flex-1" />
                <select value={stage} onChange={(e) => { setStage(e.target.value as WordStage | ""); setShown(PAGE); }} className={select} aria-label="Stage">
                  <option value="">All stages</option>
                  <option value="new">New</option>
                  <option value="learning">Learning</option>
                  <option value="learned">Learned</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={select} aria-label="Sort">
                  <option value="newest">Newest first</option>
                  <option value="az">A to Z</option>
                  <option value="weakest">Needs practice</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className={`${card} p-8 text-center`}>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No words match</p>
                <button type="button" onClick={resetFilters} className="mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">
                  Clear the search and filters
                </button>
              </div>
            ) : (
              <>
                <ul className="grid gap-3 sm:grid-cols-2">
                  <AnimatePresence initial={false}>
                    {filtered.slice(0, shown).map((word) => (
                      <WordCard key={word.key} word={word} now={now} />
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="flex flex-col items-center gap-2 pb-4">
                  <p className="text-xs text-slate-400 tabular-nums">
                    Showing {Math.min(shown, filtered.length)} of {filtered.length}
                  </p>
                  {shown < filtered.length && (
                    <button type="button" onClick={() => setShown((n) => n + PAGE)} className="h-9 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]">
                      Show more
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyWordsPage;
