// Word games: a daily Word Guess (five letters, six tries) and Unscramble (five words at your level).
// Both are free and work offline-friendly on the page; the server keeps the answers and the XP.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, Check, Delete, Gamepad2, Loader2, RotateCcw, Shuffle, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, PageHeader, Stat, Tabs } from "../components/ui";
import { apiClient } from "../lib/api/client";
import { serverMessage } from "../lib/serverMessage";
import { canSpeak, speak } from "../lib/speech";
import { playSfx } from "../lib/sfx";
import { tr, msg } from "../i18n/core";
import {
  readWordleGuesses,
  saveWordleGuesses,
  useCheckScramble,
  useCheckWordle,
  useGamesToday,
  useScrambleRound,
  type LetterMark,
  type ScrambleResult,
  type WordleResult,
} from "../hooks/useGames";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

const MARK_STYLE: Record<LetterMark, string> = {
  hit: "border-emerald-600 bg-emerald-600 text-white",
  near: "border-amber-500 bg-amber-500 text-white",
  miss: "border-slate-500 bg-slate-500 text-white dark:border-slate-600 dark:bg-slate-600",
};
const MARK_LABEL: Record<LetterMark, string> = { hit: "right place", near: "in the word, wrong place", miss: "not in the word" };

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

// ============================================================
// Word Guess
// ============================================================

function WordGuess({ day, length, maxGuesses, doneBefore }: { day: string; length: number; maxGuesses: number; doneBefore: boolean }) {
  const check = useCheckWordle();
  const [result, setResult] = useState<WordleResult | null>(null);
  const [current, setCurrent] = useState("");
  const [shake, setShake] = useState(false);
  const [saved, setSaved] = useState(false);
  const rows = useMemo(() => result?.rows ?? [], [result]);
  const over = result?.over ?? false;
  const busy = check.isPending;

  // Put today's earlier guesses back after a refresh (the server marks them again; nothing is paid twice)
  const [hadLocal] = useState(() => readWordleGuesses(day).length > 0);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const earlier = readWordleGuesses(day);
    if (!earlier.length) return;
    check.mutate(earlier, { onSuccess: setResult, onError: () => saveWordleGuesses(day, []) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const submit = useCallback(() => {
    if (over || busy) return;
    if (current.length !== length) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      toast.info(tr("Type a five-letter word first."), { id: "wordle-short" });
      return;
    }
    const next = [...rows.map((r) => r.guess), current];
    check.mutate(next, {
      onSuccess: (r) => {
        setResult(r);
        setCurrent("");
        saveWordleGuesses(day, next);
        if (r.over) playSfx(r.solved ? "win" : "bad");
        if (r.over && r.xp > 0) toast.success(tr("+{xp} XP", { xp: r.xp }), { id: "wordle-xp" });
      },
      onError: (e) => {
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        toast.error(serverMessage(e) || tr("Couldn't check that word. Please try again."), { id: "wordle-error" });
      },
    });
  }, [busy, check, current, day, length, over, rows]);

  const press = useCallback(
    (key: string) => {
      if (over || busy) return;
      if (key === "Enter") submit();
      else if (key === "Backspace") setCurrent((c) => c.slice(0, -1));
      else if (/^[a-z]$/.test(key)) setCurrent((c) => (c.length < length ? c + key : c));
    },
    [busy, length, over, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      // Enter on a focused on-screen key would press it twice (once as the button, once here)
      if (e.key === "Enter" && target?.tagName === "BUTTON") return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "Enter" || key === "Backspace" || /^[a-z]$/.test(key)) {
        if (key === "Backspace" || key === "Enter") e.preventDefault();
        press(key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  // Best known mark of each letter, for colouring the keyboard
  const keyMarks = useMemo(() => {
    const rank: Record<LetterMark, number> = { miss: 0, near: 1, hit: 2 };
    const out = new Map<string, LetterMark>();
    for (const row of rows)
      row.guess.split("").forEach((ch, i) => {
        const m = row.marks[i];
        if (!out.has(ch) || rank[m] > rank[out.get(ch)!]) out.set(ch, m);
      });
    return out;
  }, [rows]);

  const saveWord = async () => {
    const r = result?.reveal;
    if (!r) return;
    try {
      await apiClient.post("/words", { word: r.word, meaning: r.meaning, example: r.example || undefined });
      setSaved(true);
      toast.success(tr("Saved to My words."), { id: "wordle-save" });
    } catch (e) {
      toast.error(serverMessage(e) || tr("Couldn't save the word."), { id: "wordle-save" });
    }
  };

  const showCurrent = !over && rows.length < maxGuesses;
  const alreadyPlayedElsewhere = doneBefore && !hadLocal && !result;

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {tr("Guess today's word in six tries. Green: right place. Yellow: in the word, wrong place. Grey: not in the word.")}
        </p>

        <div role="grid" aria-label={tr("Your guesses")} className={cx("mx-auto grid w-full max-w-[19rem] gap-1.5", shake && "animate-[sb-shake_0.4s]")}>
          {Array.from({ length: maxGuesses }, (_, r) => {
            const row = rows[r];
            const typing = showCurrent && r === rows.length;
            return (
              <div key={r} role="row" className="grid grid-cols-5 gap-1.5">
                {Array.from({ length }, (_, c) => {
                  const letter = row ? row.guess[c] : typing ? current[c] : "";
                  const mark = row?.marks[c];
                  return (
                    <div
                      key={c}
                      role="gridcell"
                      aria-label={letter ? `${letter}${mark ? `, ${tr(MARK_LABEL[mark])}` : ""}` : tr("empty")}
                      className={cx(
                        "flex aspect-square items-center justify-center rounded-lg border-2 text-xl font-bold uppercase transition-colors sm:text-2xl",
                        mark ? MARK_STYLE[mark] : letter ? "border-slate-500 text-slate-900 dark:border-slate-400 dark:text-white" : "border-line text-slate-900 dark:text-white",
                      )}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {alreadyPlayedElsewhere && (
          <p role="status" className="rounded-2xl bg-indigo-50 p-3 text-center text-sm text-indigo-900 dark:bg-indigo-400/10 dark:text-indigo-200">
            {tr("You have already played today's word. Come back tomorrow for a new one.")}
          </p>
        )}

        {!over && !alreadyPlayedElsewhere && (
          <div className="mx-auto w-full max-w-md space-y-1.5" aria-label={tr("Keyboard")}>
            {KEY_ROWS.map((letters, i) => (
              <div key={letters} className="flex justify-center gap-1">
                {i === 2 && (
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => press("Enter")} disabled={busy} className="h-11 rounded-lg bg-slate-200 px-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-300 disabled:opacity-60 dark:bg-white/15 dark:text-white">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : tr("Enter")}
                  </button>
                )}
                {letters.split("").map((ch) => {
                  const m = keyMarks.get(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()} onClick={() => press(ch)}
                      className={cx(
                        "h-11 min-w-0 flex-1 rounded-lg text-sm font-semibold uppercase",
                        m ? MARK_STYLE[m] : "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-white/15 dark:text-white",
                      )}
                    >
                      {ch}
                    </button>
                  );
                })}
                {i === 2 && (
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => press("Backspace")} aria-label={tr("Delete")} className="flex h-11 items-center rounded-lg bg-slate-200 px-2.5 text-slate-900 hover:bg-slate-300 dark:bg-white/15 dark:text-white">
                    <Delete className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {over && result?.reveal && (
        <Card className="space-y-3" role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              {result.solved ? tr("You got it in {n}!", { n: result.rows.length }) : tr("The word was")}
            </h2>
            {result.xp > 0 && <Badge tone="success">{tr("+{xp} XP", { xp: result.xp })}</Badge>}
          </div>
          <p className="text-2xl font-bold capitalize text-indigo-700 dark:text-indigo-300">
            {result.reveal.word} <span className="text-sm font-normal text-slate-600 dark:text-slate-400">{result.reveal.ipa}</span>
          </p>
          <p className="text-sm text-slate-800 dark:text-slate-200">
            <i>{result.reveal.pos}</i> · {result.reveal.meaning}
          </p>
          {result.reveal.example && <p className="text-sm italic text-slate-700 dark:text-slate-300">“{result.reveal.example}”</p>}
          <div className="flex flex-wrap gap-2">
            {canSpeak() && (
              <Button variant="secondary" size="sm" icon={Volume2} onClick={() => void speak(result.reveal!.word)}>
                {tr("Hear it")}
              </Button>
            )}
            <Button variant="soft" size="sm" icon={saved ? Check : BookmarkPlus} disabled={saved} onClick={() => void saveWord()}>
              {saved ? tr("Saved") : tr("Save to My words")}
            </Button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{tr("A new word arrives tomorrow.")}</p>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Unscramble
// ============================================================

/** The letters of `letters` that are not yet used up by what has been typed */
function remainingLetters(letters: string, typed: string): string[] {
  const pool = letters.split("");
  for (const ch of typed.toLowerCase()) {
    const i = pool.indexOf(ch);
    if (i >= 0) pool.splice(i, 1);
  }
  return pool;
}

function Unscramble({ passMark }: { passMark: number }) {
  const [round, setRound] = useState(0);
  const query = useScrambleRound(round, true);
  const check = useCheckScramble();
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ScrambleResult | null>(null);

  const items = query.data?.items ?? [];
  const answered = items.filter((i) => (typed[i.id] ?? "").length === i.length).length;

  const setOne = (id: string, value: string, length: number) =>
    setTyped((t) => ({ ...t, [id]: value.toLowerCase().replace(/[^a-z]/g, "").slice(0, length) }));

  const submit = () =>
    check.mutate(
      { round, answers: typed },
      {
        onSuccess: (r) => {
          setResult(r);
          playSfx(r.won ? "win" : "bad");
          if (r.xp > 0) toast.success(tr("+{xp} XP", { xp: r.xp }), { id: "scramble-xp" });
        },
        onError: (e) => toast.error(serverMessage(e) || tr("Couldn't check your answers. Please try again."), { id: "scramble-error" }),
      },
    );

  const another = () => {
    setRound((r) => r + 1);
    setTyped({});
    setResult(null);
  };

  if (query.isLoading) {
    return (
      <Card className="flex justify-center py-10" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label={tr("Loading")} />
      </Card>
    );
  }
  if (query.isError || !items.length) {
    return <Card className="text-center text-sm text-red-600">{tr("Couldn't load the words. Refresh to try again.")}</Card>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700 dark:text-slate-300">
        {tr("Put the letters in order to make a word. Use the clue. Get {n} right to pass.", { n: passMark })}
      </p>

      {items.map((item, idx) => {
        const value = typed[item.id] ?? "";
        const verdict = result?.results.find((r) => r.id === item.id);
        return (
          <Card key={item.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-800 dark:text-slate-200">
                <b>{idx + 1}.</b> {item.pos && <i className="text-slate-600 dark:text-slate-400">{item.pos}</i>} {item.hint}
              </p>
              {verdict && (verdict.right ? <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-label={tr("Right")} /> : <X className="h-5 w-5 shrink-0 text-red-600" aria-label={tr("Wrong")} />)}
            </div>

            <div className="flex flex-wrap items-center gap-1.5" aria-label={tr("Letters to use")}>
              {remainingLetters(item.letters, value).map((ch, i) => (
                <button
                  key={`${ch}${i}`}
                  type="button"
                  disabled={!!result || value.length >= item.length}
                  onClick={() => setOne(item.id, value + ch, item.length)}
                  className="h-10 w-10 rounded-lg bg-indigo-50 text-lg font-bold uppercase text-indigo-800 hover:bg-indigo-100 disabled:opacity-40 dark:bg-indigo-400/15 dark:text-indigo-100"
                >
                  {ch}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                value={value}
                disabled={!!result}
                onChange={(e) => setOne(item.id, e.target.value, item.length)}
                maxLength={item.length}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label={tr("Your answer for word {n}", { n: idx + 1 })}
                placeholder={"_ ".repeat(item.length).trim()}
                className="h-11 w-full rounded-xl border border-line bg-surface px-3 font-mono text-lg tracking-[0.3em] text-slate-900 dark:text-white"
              />
              <Button variant="ghost" size="sm" icon={Delete} disabled={!!result || !value} onClick={() => setOne(item.id, value.slice(0, -1), item.length)} aria-label={tr("Delete")} />
            </div>

            {verdict && !verdict.right && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {tr("The word was")} <b className="capitalize">{verdict.word}</b>
              </p>
            )}
          </Card>
        );
      })}

      {!result ? (
        <div className="text-center">
          <Button size="lg" icon={Check} loading={check.isPending} disabled={answered === 0} onClick={submit}>
            {tr("Check my answers")}
          </Button>
        </div>
      ) : (
        <Card className="space-y-3 text-center" role="status">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            {result.won ? tr("Well done! {score} out of {total}", { score: result.score, total: result.total }) : tr("{score} out of {total}. Have another go!", { score: result.score, total: result.total })}
          </h2>
          {result.xp > 0 && <Badge tone="success">{tr("+{xp} XP", { xp: result.xp })}</Badge>}
          <div>
            <Button variant="soft" icon={RotateCcw} onClick={another}>
              {tr("Another round")}
            </Button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{tr("XP is for the first round of the day.")}</p>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// The page
// ============================================================

type GameTab = "guess" | "scramble";

export const GamesPage: React.FC = () => {
  const today = useGamesToday();
  const [tab, setTab] = useState<GameTab>("guess");
  const t = today.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        icon={Gamepad2}
        title={tr("Word games")}
        subtitle={tr("Short games that stretch your vocabulary. A daily word, and a round of letter puzzles at your level.")}
      />

      {t && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label={tr("Word Guess played")} value={t.wordle.played} />
          <Stat label={tr("Word Guess won")} value={t.wordle.wins} />
          <Stat label={tr("Today")} value={`${Number(t.wordle.done) + Number(t.scramble.done)}/2`} />
        </div>
      )}

      <Tabs
        label={msg("Choose a game")}
        value={tab}
        onChange={setTab}
        items={[
          { value: "guess", label: msg("Word Guess"), icon: Gamepad2 },
          { value: "scramble", label: msg("Unscramble"), icon: Shuffle },
        ]}
      />

      {today.isLoading && (
        <Card className="flex justify-center py-10" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label={tr("Loading")} />
        </Card>
      )}
      {today.isError && <Card className="text-center text-sm text-red-600">{tr("Couldn't load the games. Refresh to try again.")}</Card>}

      {t && tab === "guess" && <WordGuess day={t.day} length={t.wordle.length} maxGuesses={t.wordle.maxGuesses} doneBefore={t.wordle.done} />}
      {t && tab === "scramble" && <Unscramble passMark={t.scramble.pass} />}
    </div>
  );
};

export default GamesPage;
