// apps/web/src/pages/LibraryPage.tsx
/**
 * The reading and listening library: stories, dialogues and articles from A1 to C2. Each one is read aloud,
 * has key words to learn, tappable words and several kinds of question. This page helps you find the next one:
 * a "continue" card, a tab for every level, and search and filters for kind, topic and progress.
 */

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, Clock, Loader2, MessagesSquare, Newspaper, ScrollText, Search, X } from "lucide-react";
import { useLibrary, type LibraryItem, type LibraryLevel, type TextKind } from "../hooks/useLibrary";
import { Chip, EmptyState, PageHeader, Stat } from "../components/ui";

const KIND: Record<TextKind, { label: string; icon: typeof BookOpen; tone: string }> = {
  story: { label: "Story", icon: ScrollText, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  dialogue: { label: "Dialogue", icon: MessagesSquare, tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  article: { label: "Article", icon: Newspaper, tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
};

const LEVEL_NAME: Record<LibraryLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

type Status = "all" | "todo" | "done";

const TextCard: React.FC<{ t: LibraryItem }> = ({ t }) => {
  const kind = KIND[t.kind];
  const Icon = kind.icon;
  return (
    <Link
      to={`/library/${t.id}`}
      className="group block rounded-3xl border border-line bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:hover:border-white/15"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${kind.tone}`}>
          <Icon className="h-3 w-3" aria-hidden /> {kind.label}
        </span>
        {t.done ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {t.bestScore}/{t.questions}
          </span>
        ) : t.started ? (
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">In progress</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="h-3 w-3" aria-hidden /> {t.minutes} min
          </span>
        )}
      </div>
      <h2 className="mt-3 text-base font-bold leading-snug text-slate-900 dark:text-white">{t.title}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{t.summary}</p>
      <p className="mt-3 text-[11px] text-slate-500">
        {t.topic} · {t.words} words · {t.keyWords} key words
      </p>
    </Link>
  );
};

export const LibraryPage: React.FC = () => {
  const { data, isLoading, isError } = useLibrary();
  const [picked, setPicked] = useState<LibraryLevel | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<TextKind | "all">("all");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<Status>("all");

  const level = picked ?? data?.level ?? "A1";

  const atLevel = useMemo(() => (data ? data.texts.filter((t) => t.level === level) : []), [data, level]);
  const topicsHere = useMemo(() => [...new Set(atLevel.map((t) => t.topic))].sort((a, b) => a.localeCompare(b)), [atLevel]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return atLevel.filter(
      (t) =>
        (kind === "all" || t.kind === kind) &&
        (!topic || t.topic === topic) &&
        (status === "all" || (status === "done" ? t.done : !t.done)) &&
        (!q || `${t.title} ${t.summary} ${t.topic}`.toLowerCase().includes(q)),
    );
  }, [atLevel, kind, topic, status, search]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" aria-label="Loading" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-line bg-surface p-8 text-center text-sm text-slate-600 shadow-sm">Couldn't load the library. Refresh to try again.</div>;
  }

  const current = data.levels.find((l) => l.level === level);
  const filtered = kind !== "all" || !!topic || status !== "all" || !!search.trim();
  const clear = () => {
    setKind("all");
    setTopic("");
    setStatus("all");
    setSearch("");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        icon={BookOpen}
        tone="emerald"
        title="Library"
        subtitle={`${data.texts.length} stories, dialogues and articles from A1 to C2. Listen, learn the key words, tap any word, then check what you understood.`}
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-4">
        {[
          { label: "Texts read", value: `${data.done} / ${data.texts.length}` },
          { label: "Words read", value: data.stats.wordsRead.toLocaleString() },
          { label: "Reading time", value: `${data.stats.minutesRead} min` },
          { label: "Perfect scores", value: data.stats.perfect },
        ].map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} className="bg-surface p-5" />
        ))}
      </div>

      {data.recommended && (
        <Link
          to={`/library/${data.recommended.id}`}
          className="group flex flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl bg-indigo-900 p-6 text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-indigo-800 sm:p-7"
        >
          <div className="min-w-0 flex-1">
            <p className="t-eyebrow text-indigo-200">Up next · {data.recommended.level}</p>
            <h2 className="font-display mt-1.5 text-[26px] font-semibold leading-tight sm:text-[32px]">{data.recommended.title}</h2>
            <p className="mt-1 text-sm text-indigo-100">About {data.recommended.minutes} min · {LEVEL_NAME[data.recommended.level]}</p>
          </div>
          <span className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-indigo-900 transition-transform group-hover:translate-x-0.5">
            {data.done === 0 ? "Start reading" : "Continue"} <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
      )}

      <section aria-label="Levels" className="space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Level">
          {data.levels.map((l) => {
            const selected = level === l.level;
            return (
              <button
                key={l.level}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setPicked(l.level);
                  setTopic("");
                }}
                className={`min-w-[5.5rem] rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                  selected
                    ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                    : "border-line bg-surface text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/[0.06]"
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold">{l.level}</span>
                  <span className={`text-[11px] tabular-nums ${selected ? "text-indigo-100" : "text-slate-600 dark:text-slate-300"}`}>
                    {l.done}/{l.total}
                  </span>
                </span>
                <span className={`mt-1.5 block h-1 overflow-hidden rounded-full ${selected ? "bg-white/25" : "bg-slate-200 dark:bg-white/10"}`} aria-hidden>
                  <span className={`block h-full rounded-full ${selected ? "bg-white" : "bg-indigo-500"}`} style={{ width: `${l.total ? (l.done / l.total) * 100 : 0}%` }} />
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-white">{level} · {LEVEL_NAME[level]}</span>
          {level === data.level && " · your level"}
          {current && ` · ${current.done} of ${current.total} read`}
        </p>
      </section>

      <section aria-label="Find a text" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, topic or idea"
              aria-label="Search the library"
              className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-[16px] text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:text-white sm:text-sm"
            />
          </div>
          <label className="sr-only" htmlFor="library-topic">
            Topic
          </label>
          <select
            id="library-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-11 rounded-xl border border-line bg-surface px-3 text-[16px] text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:text-white sm:w-56 sm:text-sm"
          >
            <option value="">All topics</option>
            {topicsHere.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "story", "dialogue", "article"] as const).map((k) => (
            <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
              {k === "all" ? "All kinds" : KIND[k].label + "s"}
            </Chip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
          {(["all", "todo", "done"] as const).map((s) => (
            <Chip key={s} selected={status === s} onClick={() => setStatus(s)}>
              {s === "all" ? "Any progress" : s === "todo" ? "To read" : "Finished"}
            </Chip>
          ))}
          {filtered && (
            <button type="button" onClick={clear} className="ml-auto inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-white/5">
              <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500" aria-live="polite">
          Showing {shown.length} of {atLevel.length} at {level}
        </p>
      </section>

      {shown.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches"
          text={filtered ? "Try a different word, or clear the filters." : "There are no texts at this level yet."}
          action={filtered ? <button type="button" onClick={clear} className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">Clear filters</button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <TextCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
