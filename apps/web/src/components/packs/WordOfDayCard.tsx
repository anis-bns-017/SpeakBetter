// apps/web/src/components/packs/WordOfDayCard.tsx
/**
 * Word of the day on the dashboard: guess the meaning first (it sticks better than reading it), then see the
 * meaning and an example, hear it, and save it to your flashcard review.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Check, CheckCircle2, Loader2, Plus, Sparkles, Volume2, XCircle } from "lucide-react";
import { useSavePackWords, useWordOfDay } from "../../hooks/useVocabPacks";
import { canSpeak, speak } from "../../lib/speech";
import { useT } from "../../i18n";
import { tr } from "../../i18n/core";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

/** The guess is remembered for the day, so the card stays answered after a reload */
const keyFor = (day: string) => `sb.wordOfDay.${day}`;
const readGuess = (day: string): number | null => {
  try {
    const v = localStorage.getItem(keyFor(day));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
};
const writeGuess = (day: string, pick: number) => {
  try {
    localStorage.setItem(keyFor(day), String(pick));
  } catch {
    /* it just asks again next time */
  }
};

/** The example sentence with the word in bold */
const Example: React.FC<{ sentence: string; word: string }> = ({ sentence, word }) => {
  const at = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, at)}
      <strong className="font-semibold text-slate-900 dark:text-white">{sentence.slice(at, at + word.length)}</strong>
      {sentence.slice(at + word.length)}
    </>
  );
};

export const WordOfDayCard: React.FC = () => {
  const { data, isLoading, isError } = useWordOfDay();
  const { t } = useT();
  const save = useSavePackWords(data?.packId ?? "");
  // Keyed by day, so a card left open past midnight asks again for the new word
  const [guesses, setGuesses] = useState<Record<string, number>>({});

  if (isLoading) {
    return (
      <div className={`${card} p-6 flex justify-center`}>
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) return null;

  const guess = guesses[data.day] ?? readGuess(data.day);
  const answered = guess !== null && guess >= 0 && guess < data.options.length;
  const right = answered && guess === data.answer;

  const pick = (i: number) => {
    if (answered) return;
    writeGuess(data.day, i);
    setGuesses((g) => ({ ...g, [data.day]: i }));
  };

  const saveWord = () =>
    save.mutate([data.wordId], {
      onSuccess: () => toast.success(t("\"{word}\" is in your review", { word: data.word })),
      onError: () => toast.error(t("Couldn't save that. Try again.")),
    });

  return (
    <section className={`${card} p-6`} aria-labelledby="word-of-day-title">
      <div className="flex items-center justify-between gap-2">
        <p id="word-of-day-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> {t("Word of the day")}
        </p>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-slate-100 dark:bg-white/[0.07] text-slate-500">{data.level}</span>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{data.word}</h2>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-white/[0.07] text-slate-500">{data.pos}</span>
        {canSpeak() && (
          <button type="button" onClick={() => void speak(data.word, { rate: 0.85 })} aria-label={tr("Listen to {word}", { word: data.word })} className="text-slate-400 hover:text-indigo-600">
            <Volume2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {!answered ? (
        <>
          <p className="mt-3 text-sm text-slate-500">{t("Do you know what it means?")}</p>
          <div className="mt-2 space-y-2" role="radiogroup" aria-label={t("Meaning of {word}", { word: data.word })}>
            {data.options.map((option, i) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={false}
                onClick={() => pick(i)}
                className="w-full text-left rounded-2xl border border-slate-200 dark:border-white/10 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <p className={`text-sm font-semibold inline-flex items-center gap-1.5 ${right ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} role="status">
            {right ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {right ? t("You knew it!") : t("Now you know it:")}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{data.meaning}</p>
          <p className="text-sm text-slate-500 italic">
            “<Example sentence={data.example} word={data.word} />”
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {data.saved ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="w-4 h-4" /> {t("In your review")}
          </span>
        ) : (
          <button
            type="button"
            onClick={saveWord}
            disabled={save.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("Save to review")}
          </button>
        )}
        <Link to={`/packs/${data.packId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          {t("From {pack}", { pack: data.packTitle })} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
};

export default WordOfDayCard;
