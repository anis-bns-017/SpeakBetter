// apps/web/src/components/dictionary/SizeTest.tsx
/**
 * Vocabulary size test. Step 1: 60 words, one at a time: do you know it? (10 are made up, to catch guessing.)
 * Step 2: the meaning of up to 10 words you said you know. Result: about how many of the 10,000 most common
 * words you know, your level, and which words to learn next.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Check, Gauge, Loader2, Plus, RotateCcw, Sparkles, Undo2, X } from "lucide-react";
import { dictError, sizeTestApi, useRefreshDictionary, useSaveManyDictWords, useSizeTests, type TestResult } from "../../hooks/useDictionary";
import { LEVEL_STYLE, card } from "./dictStyles";
import { tr } from "../../i18n/core";

type Phase =
  | { step: "intro" }
  | { step: "loading" }
  | { step: "words"; id: string; items: Array<{ key: string; text: string }>; index: number; known: string[] }
  | { step: "checks"; id: string; checks: Array<{ key: string; word: string; options: string[] }>; index: number; answers: Record<string, number>; picked: number | null }
  | { step: "result"; result: TestResult };

const Bands: React.FC<{ bands: number[] }> = ({ bands }) => (
  <div>
    <div className="flex items-end gap-[2px] h-28" role="img" aria-label={tr("How much of each 1,000 words you know")}>
      {bands.map((b, i) => (
        <div key={i} className="relative flex-1 h-full flex items-end group">
          <div className="w-full rounded-t-[4px] bg-emerald-600 dark:bg-emerald-500" style={{ height: `${Math.max(b > 0 ? 3 : 0, b * 100)}%` }} />
          <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-slate-900 dark:bg-white px-1.5 py-0.5 text-[11px] text-white dark:text-slate-900 opacity-0 group-hover:opacity-100 whitespace-nowrap">
            {Math.round(b * 100)}%
          </span>
        </div>
      ))}
    </div>
    <div className="mt-1 flex gap-[2px] border-t border-slate-200 dark:border-white/10 pt-1">
      {bands.map((_, i) => (
        <span key={i} className={`flex-1 text-center text-[11px] tabular-nums text-slate-400 ${i % 2 ? "max-sm:invisible" : ""}`}>
          {i + 1}k
        </span>
      ))}
    </div>
    <table className="sr-only">
      <caption>{tr("Share of each 1,000 words you know")}</caption>
      <tbody>
        {bands.map((b, i) => (
          <tr key={i}>
            <th>
              {tr("Words {value} to", { value: i * 1000 + 1 })}{" "}{(i + 1) * 1000}
            </th>
            <td>{Math.round(b * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const SizeTest: React.FC<{ onMap: () => void }> = ({ onMap }) => {
  const [phase, setPhase] = useState<Phase>({ step: "intro" });
  const [busy, setBusy] = useState(false);
  const history = useSizeTests();
  const refresh = useRefreshDictionary();
  const saveMany = useSaveManyDictWords();

  const start = async () => {
    setPhase({ step: "loading" });
    try {
      const test = await sizeTestApi.start();
      setPhase({ step: "words", id: test.id, items: test.items, index: 0, known: [] });
    } catch (e) {
      toast.error(dictError(e, "Couldn't start the test"));
      setPhase({ step: "intro" });
    }
  };

  const finish = useCallback(
    async (id: string, answers: Record<string, number>) => {
      setBusy(true);
      try {
        const result = await sizeTestApi.finish(id, answers);
        setPhase({ step: "result", result });
        refresh();
        void history.refetch();
      } catch (e) {
        toast.error(dictError(e, "Couldn't mark the test"));
      } finally {
        setBusy(false);
      }
    },
    [refresh, history],
  );

  const answerWord = useCallback(
    async (knows: boolean) => {
      if (phase.step !== "words" || busy) return;
      const item = phase.items[phase.index];
      const known = knows ? [...phase.known, item.key] : phase.known;
      if (phase.index + 1 < phase.items.length) {
        setPhase({ ...phase, index: phase.index + 1, known });
        return;
      }
      setBusy(true);
      try {
        const { checks } = await sizeTestApi.answer(phase.id, known);
        setBusy(false);
        if (checks.length) setPhase({ step: "checks", id: phase.id, checks, index: 0, answers: {}, picked: null });
        else await finish(phase.id, {});
      } catch (e) {
        setBusy(false);
        toast.error(dictError(e, "Couldn't save your answers"));
      }
    },
    [phase, busy, finish],
  );

  const undo = () => {
    if (phase.step !== "words" || phase.index === 0) return;
    const previous = phase.items[phase.index - 1].key;
    setPhase({ ...phase, index: phase.index - 1, known: phase.known.filter((k) => k !== previous) });
  };

  const pick = (option: number) => {
    if (phase.step !== "checks" || phase.picked !== null) return;
    const check = phase.checks[phase.index];
    const answers = { ...phase.answers, [check.key]: option };
    const current = { ...phase, answers, picked: option };
    setPhase(current);
    // A short pause on the chosen answer, then the next question (or the result)
    window.setTimeout(() => {
      if (current.index + 1 < current.checks.length) setPhase({ ...current, index: current.index + 1, picked: null });
      else void finish(current.id, answers);
    }, 350);
  };

  // Keyboard: → / K = I know it, ← / J = I don't, Backspace = undo; 1-4 picks a meaning
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      if (phase.step === "words") {
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "k") void answerWord(true);
        else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") void answerWord(false);
        else if (e.key === "Backspace") undo();
      } else if (phase.step === "checks" && /^[1-4]$/.test(e.key)) {
        pick(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- intro ----------
  if (phase.step === "intro" || phase.step === "loading") {
    const past = history.data ?? [];
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className={`${card} p-6 sm:p-8`}>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/15">
            <Gauge className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{tr("How many English words do you know?")}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tr("About 5 minutes. You'll get an estimate out of the 10,000 most common words, your level, and the words to learn next.")}</p>
          <ol className="mt-5 space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span><span><b>{tr("60 words, one at a time.")}</b> {" "}{tr("Say “I know it” only if you could explain what it means. Some words are made up, to keep everyone honest.")}</span></li>
            <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span><span><b>{tr("A few meanings.")}</b> {" "}{tr("For up to 10 words you know, pick the right meaning.")}</span></li>
            <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">3</span><span><b>{tr("Your result.")}</b> {" "}{tr("The words you showed you know are marked on your word map.")}</span></li>
          </ol>
          <button type="button" onClick={start} disabled={phase.step === "loading"} className="mt-6 h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-60 flex items-center gap-2 shadow-md shadow-indigo-500/15">
            {phase.step === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {" "}{tr("Start the test")}</button>
          <p className="mt-3 text-[11px] text-slate-400">{tr("Tip: use the arrow keys. → I know it, ← I don't.")}</p>
        </section>
        <aside className={`${card} p-5`}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Your past results")}</h3>
          {past.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{tr("No tests yet. Take one now and again in a month to see your vocabulary grow.")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.05]">
              {past.map((t) => (
                <li key={t.id} className="py-2 flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">≈{(t.estimate ?? 0).toLocaleString()}</span>
                  {t.level && <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${LEVEL_STYLE[t.level].chip}`}>{t.level}</span>}
                  <span className="ml-auto text-[11px] text-slate-400">{t.finishedAt ? new Date(t.finishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    );
  }

  // ---------- words ----------
  if (phase.step === "words") {
    const item = phase.items[phase.index];
    return (
      <section className={`${card} p-6 sm:p-10 max-w-xl mx-auto text-center`}>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">{phase.index + 1} / {phase.items.length}</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
            <motion.div className="h-full rounded-full bg-indigo-600" animate={{ width: `${(phase.index / phase.items.length) * 100}%` }} />
          </div>
          <button type="button" onClick={undo} disabled={phase.index === 0} className="flex items-center gap-1 font-semibold hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40">
            <Undo2 className="w-3.5 h-3.5" /> {" "}{tr("Back")}</button>
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={item.key} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.16 }} className="my-12 text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            {tr(item.text)}
          </motion.p>
        </AnimatePresence>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{tr("Do you know what this word means?")}</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => void answerWord(false)} disabled={busy} className="h-14 rounded-2xl border-2 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center justify-center gap-2 disabled:opacity-50">
            <X className="w-5 h-5" /> {" "}{tr("I don't")}</button>
          <button type="button" onClick={() => void answerWord(true)} disabled={busy} className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/15 disabled:opacity-50">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} {" "}{tr("I know it")}</button>
        </div>
      </section>
    );
  }

  // ---------- meaning checks ----------
  if (phase.step === "checks") {
    const check = phase.checks[phase.index];
    return (
      <section className={`${card} p-6 sm:p-8 max-w-xl mx-auto`}>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{tr("Meaning {value} of", { value: phase.index + 1 })}{" "}{phase.checks.length}</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
            <motion.div className="h-full rounded-full bg-amber-500" animate={{ width: `${(phase.index / phase.checks.length) * 100}%` }} />
          </div>
        </div>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{tr("What does this word mean?")}</p>
        <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{check.word}</p>
        <div className="mt-5 space-y-2">
          {check.options.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={phase.picked !== null || busy}
              className={`w-full text-left rounded-2xl border px-4 py-3 text-sm transition-colors flex gap-3 ${
                phase.picked === i
                  ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100"
                  : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span className="w-5 h-5 shrink-0 rounded-md bg-slate-100 dark:bg-white/[0.08] text-[11px] font-bold flex items-center justify-center text-slate-500">{i + 1}</span>
              {o}
            </button>
          ))}
        </div>
        {busy && <p className="mt-4 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {" "}{tr("Working out your result…")}</p>}
      </section>
    );
  }

  // ---------- result ----------
  const { result } = phase;
  const style = LEVEL_STYLE[result.level];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className={`${card} p-6 sm:p-8`}>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{tr("You know about")}</p>
        <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="text-6xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
          {result.estimate.toLocaleString()}
        </motion.p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{tr("of the 10,000 most common English words")}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${style.chip}`}>{result.level}</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{style.name} {" "}{tr("vocabulary")}</span>
        </div>
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-6">{tr("How much of each 1,000 words you know")}</p>
          <Bands bands={result.bands} />
        </div>
        <ul className="mt-5 grid sm:grid-cols-3 gap-2 text-xs">
          <li className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] p-3"><b className="block text-base text-slate-900 dark:text-white tabular-nums">{result.checkedRight}/{result.checked}</b> {" "}{tr("meanings right")}</li>
          <li className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] p-3"><b className="block text-base text-slate-900 dark:text-white tabular-nums">{Math.round((1 - result.falseAlarms) * 100)}%</b> {" "}{tr("made-up words spotted")}</li>
          <li className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] p-3"><b className="block text-base text-slate-900 dark:text-white tabular-nums">{result.knownMarked}</b> {" "}{tr("words marked as known")}</li>
        </ul>
        {result.falseAlarms > 0.3 && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{tr("You said yes to several made-up words, so this result counts for less and no words were marked as known. Try again and only say yes when you're sure.")}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={onMap} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">{tr("See your word map")}</button>
          <button type="button" onClick={() => setPhase({ step: "intro" })} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> {" "}{tr("Take it again")}</button>
        </div>
      </section>
      <aside className={`${card} p-5`}>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Learn these next")}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{tr("Common words just past what you know.")}</p>
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.05]">
          {result.next.map((w) => (
            <li key={w.id}>
              <Link to={`/dictionary/${w.id}`} className="block py-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{w.word}</span>
                <span className="block text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{w.meaning}</span>
              </Link>
            </li>
          ))}
        </ul>
        {result.next.length > 0 && (
          <button
            type="button"
            disabled={saveMany.isPending}
            onClick={() =>
              saveMany.mutate(result.next.map((w) => w.id), {
                onSuccess: (r) => toast.success(tr("{added} words added to My words", { added: r.added })),
                onError: (e) => toast.error(dictError(e, "Couldn't save them")),
              })
            }
            className="mt-3 w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saveMany.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {" "}{tr("Save all to My words")}</button>
        )}
        <button type="button" onClick={() => setPhase({ step: "intro" })} className="mt-2 w-full text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center gap-1">
          <ArrowLeft className="w-3 h-3" /> {" "}{tr("Back to the start")}</button>
      </aside>
    </div>
  );
};

export default SizeTest;
