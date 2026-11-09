// apps/web/src/pages/LibraryPage.tsx
/**
 * The reading and listening library: short stories, dialogues and articles for each level. Each one is
 * read aloud, has tappable words and ends with a few questions.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Clock, Loader2, MessagesSquare, Newspaper, ScrollText } from "lucide-react";
import { useLibrary, type LibraryLevel, type TextKind } from "../hooks/useLibrary";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const KIND: Record<TextKind, { label: string; icon: typeof BookOpen; tone: string }> = {
  story: { label: "Story", icon: ScrollText, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  dialogue: { label: "Dialogue", icon: MessagesSquare, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  article: { label: "Article", icon: Newspaper, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};

export const LibraryPage: React.FC = () => {
  const { data, isLoading, isError } = useLibrary();
  const [picked, setPicked] = useState<LibraryLevel | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>Couldn't load the library. Refresh to try again.</div>;
  }

  const level = picked ?? data.level;
  const texts = data.texts.filter((t) => t.level === level);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">Library</h1>
          <p className="text-sm text-slate-500">Read and listen at your level. Tap any word, then check what you understood.</p>
        </div>
        <span className="text-xs text-slate-500 tabular-nums shrink-0">{data.done} of {data.texts.length} read</span>
      </header>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Level">
        {data.levels.map((l) => (
          <button
            key={l.level}
            type="button"
            role="tab"
            aria-selected={level === l.level}
            onClick={() => setPicked(l.level)}
            className={`h-9 px-3.5 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
              level === l.level
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
            }`}
          >
            {l.level}
            {l.level === data.level && <span className="opacity-70">· you</span>}
            <span className={`tabular-nums ${level === l.level ? "opacity-80" : "text-slate-400"}`}>
              {l.done}/{l.total}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {texts.map((t) => {
          const kind = KIND[t.kind];
          const Icon = kind.icon;
          return (
            <Link key={t.id} to={`/library/${t.id}`} className={`${card} p-5 hover:-translate-y-0.5 hover:shadow-md transition-all block`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${kind.tone}`}>
                  <Icon className="w-3 h-3" /> {kind.label}
                </span>
                {t.done ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t.bestScore}/{t.questions}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" /> {t.minutes} min
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{t.title}</h2>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{t.summary}</p>
              <p className="mt-3 text-[11px] text-slate-400">
                {t.topic} · {t.questions} questions
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default LibraryPage;
