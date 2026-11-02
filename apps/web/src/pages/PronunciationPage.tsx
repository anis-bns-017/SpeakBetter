// apps/web/src/pages/PronunciationPage.tsx
/**
 * Pronunciation practice: hear a word or sentence, say it, and see which words came across. Words that were
 * heard as something else get a tip for the sound behind it (th, v/w, r/l...). Scoring uses the browser's own
 * speech recognition, so it shows how understandable you are rather than grading your accent.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookmarkPlus,
  CalendarCheck,
  Gauge,
  Headphones,
  Lightbulb,
  Loader2,
  Mic,
  Minus,
  Play,
  RotateCcw,
  Scissors,
  Square,
  TrendingDown,
  TrendingUp,
  Turtle,
  User,
  Volume2,
  X,
} from "lucide-react";
import {
  canListen,
  useListenOnce,
  usePronunciationDrill,
  usePronunciationPractice,
  usePronunciationProgress,
  useRecorder,
  useSubmitAttempt,
  type AttemptResult,
  type PracticeData,
  type SoundKey,
  type SoundSet,
} from "../hooks/usePronunciation";
import { NO_TRANSLATION, useLookupQuery } from "../hooks/useLookup";
import { canSpeak, speak } from "../lib/speech";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

interface Item {
  target: string;
  source: "sound" | "sentence" | "word";
  sound?: SoundKey;
  /** The word it is often heard as ("sink" for "think") */
  avoid?: string;
  /** A piece of a longer sentence, practised before the whole */
  piece?: boolean;
  /** A sentence already broken into pieces (so it is not offered again) */
  split?: boolean;
}

/** Sentences this long are offered in parts */
const PARTS_FROM_WORDS = 7;
const WORDS_PER_PART = 4;

/**
 * Splits a long sentence into short pieces to say one at a time: at commas and the like first, then into
 * groups of about four words, so each piece is easy to repeat.
 */
function splitIntoParts(sentence: string): string[] {
  const clauses = sentence
    .split(/(?<=[,;:])\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const parts: string[] = [];
  for (const clause of clauses) {
    const w = clause.split(/\s+/);
    // Even groups: 10 words become 4 + 3 + 3, not 4 + 4 + a short tail
    const groups = Math.max(1, Math.round(w.length / WORDS_PER_PART));
    for (let g = 0; g < groups; g++) {
      parts.push(w.slice(Math.round((g * w.length) / groups), Math.round(((g + 1) * w.length) / groups)).join(" "));
    }
  }
  return parts.length > 1 ? parts : [];
}

/** The plain word under a tap ("Thursday," → "thursday") */
const plainWord = (token: string) => token.toLowerCase().replace(/[‘’]/g, "'").replace(/^[^\p{L}']+|[^\p{L}']+$/gu, "");

interface Session {
  title: string;
  items: Item[];
  sound?: SoundSet;
  /** For a mixed session, the sounds its items practise, so each item shows its own tip */
  sounds?: SoundSet[];
}

const scoreTone = (score: number) =>
  score >= 90
    ? "text-emerald-600 dark:text-emerald-400"
    : score >= 70
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";

const errorMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** Both words of the first pairs (each said once, the other shown as the one to avoid), then the sentences */
function soundSession(sound: SoundSet): Session {
  const words = sound.pairs.slice(0, 4).flatMap(([a, b]) => [
    { target: a, avoid: b, sound: sound.key, source: "sound" as const },
    { target: b, avoid: a, sound: sound.key, source: "sound" as const },
  ]);
  const sentences = sound.sentences.map((target) => ({ target, sound: sound.key, source: "sound" as const }));
  return { title: sound.label, items: [...words, ...sentences], sound };
}

// ============================================================
// Practise: choose what to say
// ============================================================

/** A short practice made for today from your weakest sounds and the words you keep missing */
const DrillCard: React.FC<{ sounds: SoundSet[]; onStart: (s: Session) => void }> = ({ sounds, onStart }) => {
  const { data, isLoading } = usePronunciationDrill();
  if (isLoading || !data || data.items.length === 0) return null;
  const weak = data.sounds.filter((s) => s.weak);
  const focus = data.sounds.map((s) => s.label.split(" (")[0]).join(" and ");
  const reason = weak.length
    ? `Focus on ${focus}, the sounds you find hardest right now`
    : `Try ${focus}, two sounds you have not practised yet`;
  return (
    <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-5 shadow-lg shadow-indigo-500/20">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">Today's drill</h2>
          <p className="text-sm text-white/85 mt-0.5">{reason}.</p>
          <p className="text-xs text-white/70 mt-1">
            {data.items.length} to say
            {data.troubleWords.length > 0 && ` · includes ${data.troubleWords.length} word${data.troubleWords.length === 1 ? "" : "s"} you keep missing`}
            {" · "}about {Math.max(2, Math.round(data.items.length * 0.4))} minutes
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          onStart({
            title: "Today's drill",
            items: data.items,
            sounds,
          })
        }
        className="mt-4 w-full h-10 rounded-xl bg-white text-indigo-700 text-sm font-semibold hover:bg-white/90"
      >
        Start today's drill
      </button>
    </section>
  );
};

const PractiseHome: React.FC<{ data: PracticeData; onStart: (s: Session) => void }> = ({ data, onStart }) => (
  <div className="space-y-6">
    <DrillCard sounds={data.sounds} onStart={onStart} />
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sounds people often mix up</h2>
      <p className="text-xs text-slate-500 mt-0.5">Pairs of words that differ by one sound, then a sentence full of it.</p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {data.sounds.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onStart(soundSession(s))}
            className={`${card} p-3.5 text-left hover:-translate-y-0.5 hover:shadow-md transition-all`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-mono">{s.ipa}</span> · {s.pairs[0][0]} / {s.pairs[0][1]}
                </p>
              </div>
              {s.best !== null ? (
                <span className={`text-sm font-bold tabular-nums ${scoreTone(s.best)}`} title="Your best score in the last 30 days">
                  {s.best}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">New</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>

    <section>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sentences for your level ({data.level})</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Not your level? <Link to="/placement" className="text-indigo-600 dark:text-indigo-400 hover:underline">Take the level test</Link>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onStart({ title: `Sentences (${data.level})`, items: data.sentences.map((target) => ({ target, source: "sentence" })) })}
          className="h-8 px-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
        >
          Practise all
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {data.sentences.map((target, i) => (
          <button
            key={target}
            type="button"
            onClick={() =>
              onStart({
                title: `Sentences (${data.level})`,
                items: [...data.sentences.slice(i), ...data.sentences.slice(0, i)].map((t) => ({ target: t, source: "sentence" })),
              })
            }
            className={`${card} w-full px-4 py-3 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors`}
          >
            {target}
          </button>
        ))}
      </div>
    </section>

    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Your words</h2>
      {data.myWords.length > 0 ? (
        <>
          <p className="text-xs text-slate-500 mt-0.5">Words you saved from chats, captions and calls.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.myWords.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() =>
                  onStart({
                    title: "Your words",
                    items: [...data.myWords.slice(i), ...data.myWords.slice(0, i)].map((t) => ({ target: t, source: "word" })),
                  })
                }
                className="px-3 py-1.5 rounded-full text-sm border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
              >
                {w}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500 mt-0.5">
          Save words from a chat (select a word) or from live captions, and they will show up here to practise.
        </p>
      )}
    </section>
  </div>
);

// ============================================================
// A practice session
// ============================================================

/**
 * How a word is said: its sound spelling with the stressed syllable marked (from the dictionary), and
 * the word read aloud normally and slowly.
 */
const WordGuide: React.FC<{ word: string; onClose?: () => void }> = ({ word, onClose }) => {
  const { data, isFetching } = useLookupQuery(word, NO_TRANSLATION);
  const phonetic = data?.phonetic ?? null;
  const partOfSpeech = data?.meanings[0]?.partOfSpeech;
  const meaning = data?.meanings[0]?.definition;
  return (
    <div className="mt-3 mx-auto max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-4 py-3 text-left">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {word}
            {partOfSpeech && <span className="ml-1.5 text-xs font-normal italic text-slate-500">{partOfSpeech}</span>}
          </p>
          {isFetching && !data ? (
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Looking up how it is said…
            </p>
          ) : phonetic ? (
            <>
              <p className="font-mono text-base text-indigo-700 dark:text-indigo-300 mt-0.5">{phonetic}</p>
              {phonetic.includes("ˈ") && (
                <p className="text-[11px] text-slate-500">The mark ˈ comes just before the syllable to stress.</p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">No sound spelling for this word. Listen to it instead.</p>
          )}
          {meaning && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{meaning}</p>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 -mr-1 rounded-lg text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {canSpeak() && (
        <div className="mt-2 flex gap-1.5">
          <button type="button" onClick={() => void speak(word)} className="h-7 px-2.5 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5" /> Hear it
          </button>
          <button type="button" onClick={() => void speak(word, { rate: 0.5 })} className="h-7 px-2.5 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1">
            <Turtle className="w-3.5 h-3.5" /> Very slowly
          </button>
        </div>
      )}
    </div>
  );
};

const playUrl = (url: string) =>
  new Promise<void>((resolve) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  });

/** Model voice and your own recording side by side, so you can hear the difference */
const CompareBar: React.FC<{ target: string; recording: string | null }> = ({ target, recording }) => {
  const [playing, setPlaying] = useState<"model" | "you" | "both" | null>(null);
  const run = async (which: "model" | "you" | "both") => {
    setPlaying(which);
    try {
      if (which !== "you") await speak(target);
      if (which !== "model" && recording) await playUrl(recording);
    } finally {
      setPlaying(null);
    }
  };
  const button =
    "h-9 px-3 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs text-slate-500 inline-flex items-center gap-1">
        <Headphones className="w-3.5 h-3.5" /> Compare
      </span>
      {canSpeak() && (
        <button type="button" onClick={() => void run("model")} disabled={!!playing} className={button}>
          {playing === "model" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />} Model
        </button>
      )}
      {recording && (
        <button type="button" onClick={() => void run("you")} disabled={!!playing} className={button}>
          {playing === "you" ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />} You
        </button>
      )}
      {recording && canSpeak() && (
        <button type="button" onClick={() => void run("both")} disabled={!!playing} className={button}>
          {playing === "both" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} One after the other
        </button>
      )}
    </div>
  );
};

const PACE_TONE: Record<"slow" | "natural" | "fast", string> = {
  slow: "text-amber-600 dark:text-amber-400",
  natural: "text-emerald-600 dark:text-emerald-400",
  fast: "text-amber-600 dark:text-amber-400",
};

const ResultView: React.FC<{ result: AttemptResult }> = ({ result }) => {
  // One tip per sound (or per kind of problem), so three th-words do not repeat the same advice
  const tips = [...new Map(result.issues.map((i) => [i.sound ?? i.tip, i])).values()];
  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-center gap-3">
        <span className={`text-5xl font-bold tabular-nums ${scoreTone(result.score)}`}>{result.score}</span>
        <div className="text-left">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {result.verdict === "great" ? "Clear as a bell" : result.verdict === "good" ? "Nearly there" : "Let's try that again"}
          </p>
          <p className="text-xs text-slate-500">out of 100</p>
        </div>
      </div>

      <p className="flex flex-wrap justify-center gap-x-2 gap-y-3 text-lg leading-tight" aria-label="How each word came across">
        {result.words.map((w, i) => (
          <span key={i} className="inline-flex flex-col items-center">
            <span
              className={`rounded-lg px-1.5 py-0.5 font-medium ${
                w.status === "good"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : w.status === "close"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              }`}
            >
              {w.text}
            </span>
            {w.status !== "good" && (
              <span className="mt-0.5 text-[11px] text-slate-500">{w.heard ? `heard “${w.heard}”` : "not heard"}</span>
            )}
          </span>
        ))}
      </p>

      {result.pace && (
        <p className="flex items-center justify-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <Gauge className="w-4 h-4 text-slate-400" />
          <span className={`font-semibold tabular-nums ${PACE_TONE[result.pace.verdict]}`}>{result.pace.wordsPerMinute} words a minute</span>
          <span className="text-slate-500">· {result.pace.tip}</span>
        </p>
      )}

      {tips.length > 0 && (
        <ul className="space-y-2">
          {tips.map((t) => (
            <li key={t.sound ?? t.tip} className="flex gap-2 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200">
              <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>{t.tip}</span>
            </li>
          ))}
        </ul>
      )}

      {result.addedToReview.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
          <BookmarkPlus className="w-3.5 h-3.5" />
          “{result.addedToReview.join("”, “")}” keeps tripping you up, so it is now in your{" "}
          <Link to="/flashcards?pattern=PRONUNCIATION" className="font-semibold hover:underline">Review deck</Link>
        </p>
      )}
    </div>
  );
};

const PracticeSession: React.FC<{ session: Session; onExit: () => void }> = ({ session, onExit }) => {
  // The session's own list, since long sentences can be broken into parts as you go
  const [items, setItems] = useState<Item[]>(session.items);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [best, setBest] = useState<Record<string, number>>({});
  const [showTip, setShowTip] = useState(true);
  const [guideWord, setGuideWord] = useState<string | null>(null);
  const [quiet, setQuiet] = useState(false);
  const { listening, interim, error, listen, stop } = useListenOnce();
  const recorder = useRecorder();
  const submit = useSubmitAttempt();
  const supported = canListen();

  const done = index >= items.length;
  const item = items[Math.min(index, items.length - 1)];
  const isWord = !item.target.includes(" ");
  // The tip for the sound this item practises (a drill mixes sounds)
  const tipSound = (item.sound && session.sounds?.find((s) => s.key === item.sound)) || session.sound;
  const parts =!isWord && !item.piece && !item.split && item.target.split(/\s+/).length >= PARTS_FROM_WORDS ? splitIntoParts(item.target) : [];

  const record = async () => {
    if (listening) {
      stop();
      return;
    }
    setResult(null);
    setQuiet(false);
    recorder.clear();
    // Recording runs next to recognition: start both, then wait for what was said
    const recording = recorder.start();
    const heardPromise = listen();
    await recording;
    const heard = await heardPromise;
    const recorded = await recorder.stop();
    if (!heard) {
      if (recorded && recorded.peak < 0.08) setQuiet(true);
      return;
    }
    try {
      const r = await submit.mutateAsync({
        target: item.target,
        heard: heard.alternatives,
        confidence: heard.confidence ?? undefined,
        sound: item.sound,
        source: item.source,
        durationMs: heard.durationMs ?? undefined,
      });
      setResult(r);
      setBest((b) => ({ ...b, [item.target]: Math.max(b[item.target] ?? 0, r.score) }));
    } catch (e) {
      toast.error(errorMessage(e, "Could not score that. Try again."));
    }
  };

  const goTo = (i: number) => {
    setResult(null);
    setGuideWord(null);
    setQuiet(false);
    recorder.clear();
    setIndex(i);
  };

  /** Puts the pieces of this sentence just before it: say each piece, then the whole sentence */
  const practiseInParts = () => {
    const pieces: Item[] = parts.map((target) => ({ target, source: item.source, sound: item.sound, piece: true }));
    setItems((list) => [...list.slice(0, index), ...pieces, { ...item, split: true }, ...list.slice(index + 1)]);
    goTo(index);
  };

  if (done) {
    // Pieces are stepping stones: the score that counts is for the whole sentences and words
    const scored = items.filter((i) => !i.piece);
    const scores = scored.map((i) => best[i.target]).filter((s): s is number => typeof s === "number");
    const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return (
      <div className={`${card} p-8 text-center`}>
        <p className="text-sm text-slate-500">{session.title}</p>
        {average !== null ? (
          <>
            <p className={`mt-2 text-5xl font-bold tabular-nums ${scoreTone(average)}`}>{average}</p>
            <p className="text-sm text-slate-500 mt-1">
              Average of your best tries on {scores.length} of {scored.length}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">You skipped them all. Have another go when you're ready.</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setItems(session.items);
              setBest({});
              goTo(0);
            }}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Practise again
          </button>
          <button type="button" onClick={onExit} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
            Choose something else
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <ArrowLeft className="w-4 h-4" /> All practice
        </button>
        <span className="text-xs text-slate-500 tabular-nums">
          {index + 1} / {items.length}
        </span>
      </div>

      {tipSound && (
        <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-500/10 px-4 py-3">
          <button type="button" onClick={() => setShowTip((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
            <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              {tipSound.label} <span className="font-mono font-normal">{tipSound.ipa}</span>
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-300">{showTip ? "Hide tip" : "Show tip"}</span>
          </button>
          {showTip && <p className="mt-1.5 text-sm text-indigo-900/80 dark:text-indigo-100/80">{tipSound.tip}</p>}
        </div>
      )}

      <div className={`${card} p-6 sm:p-8 text-center`}>
        {item.piece && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Part of the sentence</p>
        )}
        {isWord ? (
          <p className="text-4xl font-bold text-slate-900 dark:text-white leading-snug">{item.target}</p>
        ) : (
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
            {item.target.split(/\s+/).map((token, i) => {
              const word = plainWord(token);
              return (
                <React.Fragment key={i}>
                  <button
                    type="button"
                    onClick={() => word && setGuideWord((w) => (w === word ? null : word))}
                    title="How do I say this word?"
                    className={`rounded-md px-0.5 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 ${guideWord === word ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" : ""}`}
                  >
                    {token}
                  </button>{" "}
                </React.Fragment>
              );
            })}
          </p>
        )}
        {item.avoid && <p className="mt-2 text-sm text-slate-500">not “{item.avoid}”</p>}

        {isWord ? (
          <WordGuide word={plainWord(item.target) || item.target} />
        ) : guideWord ? (
          <WordGuide word={guideWord} onClose={() => setGuideWord(null)} />
        ) : (
          <p className="mt-2 text-[11px] text-slate-400">Tap any word to see how it is said</p>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {canSpeak() && (
            <>
              <button
                type="button"
                onClick={() => void speak(item.target)}
                className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 inline-flex items-center gap-1.5"
              >
                <Volume2 className="w-4 h-4" /> Listen
              </button>
              <button
                type="button"
                onClick={() => void speak(item.target, { rate: 0.6 })}
                className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 inline-flex items-center gap-1.5"
              >
                <Turtle className="w-4 h-4" /> Slowly
              </button>
            </>
          )}
          {parts.length > 0 && (
            <button
              type="button"
              onClick={practiseInParts}
              title="Say it a few words at a time, then the whole sentence"
              className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 inline-flex items-center gap-1.5"
            >
              <Scissors className="w-4 h-4" /> Practise in {parts.length} parts
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center">
          <button
            type="button"
            onClick={() => void record()}
            disabled={!supported || submit.isPending}
            aria-label={listening ? "Stop listening" : "Say it"}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-all disabled:opacity-50 ${
              listening ? "bg-rose-500" : "bg-indigo-600 hover:bg-indigo-700 hover:scale-105"
            }`}
            // The ring grows with your voice while listening
            style={listening ? { boxShadow: `0 0 0 ${4 + Math.round(recorder.level * 14)}px rgba(244,63,94,0.18)` } : undefined}
          >
            {submit.isPending ? <Loader2 className="w-8 h-8 animate-spin" /> : listening ? <Square className="w-7 h-7" /> : <Mic className="w-8 h-8" />}
          </button>
          {listening && (
            <div className="mt-3 w-40 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden" aria-hidden>
              <div className="h-full rounded-full bg-rose-500 transition-[width] duration-75" style={{ width: `${Math.round(recorder.level * 100)}%` }} />
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500 min-h-[1rem]">
            {submit.isPending ? "Scoring…" : listening ? interim || "Listening… say it now" : result ? "Tap to try again" : "Tap and say it"}
          </p>
          {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          {quiet && !error && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">We could barely hear you. Move closer to the microphone or speak up.</p>
          )}
        </div>

        {result && (
          <>
            <ResultView result={result} />
            <div className="mt-4">
              <CompareBar target={item.target} recording={recorder.url} />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between gap-2">
        <button type="button" onClick={() => goTo(index + 1)} className="h-10 px-4 rounded-xl text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          Skip
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={!result}
          className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
        >
          {index + 1 < items.length ? "Next" : "Finish"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================
// Progress
// ============================================================

const ProgressView: React.FC<{ sounds: SoundSet[]; onPractise: (s: Session) => void }> = ({ sounds, onPractise }) => {
  const { data, isLoading } = usePronunciationProgress();
  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (data.attempts === 0) {
    return (
      <div className={`${card} p-8 text-center`}>
        <p className="text-sm text-slate-500">No practice in the last {data.days} days yet. Your scores and weak sounds will show up here.</p>
      </div>
    );
  }

  const trend = data.last7 !== null && data.prev7 !== null ? data.last7 - data.prev7 : null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2.5">
        <div className={`${card} p-4`}>
          <p className="text-xs text-slate-500">Attempts</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{data.attempts}</p>
          <p className="text-[11px] text-slate-400">last {data.days} days</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-xs text-slate-500">Average</p>
          <p className={`text-2xl font-bold tabular-nums ${scoreTone(data.average ?? 0)}`}>{data.average ?? "–"}</p>
          <p className="text-[11px] text-slate-400">out of 100</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-xs text-slate-500">This week</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{data.last7 ?? "–"}</p>
          <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
            {trend === null ? (
              "no week before"
            ) : trend > 0 ? (
              <><TrendingUp className="w-3 h-3 text-emerald-500" /> {trend} up on last week</>
            ) : trend < 0 ? (
              <><TrendingDown className="w-3 h-3 text-rose-500" /> {-trend} down on last week</>
            ) : (
              <><Minus className="w-3 h-3" /> same as last week</>
            )}
          </p>
        </div>
      </div>

      {data.sounds.length > 0 && (
        <section className={`${card} p-4`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Your sounds, weakest first</h2>
          <ul className="mt-3 space-y-3">
            {data.sounds.map((s) => {
              const set = sounds.find((x) => x.key === s.key);
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-slate-700 dark:text-slate-200">{s.label}</span>
                      <span className={`font-semibold tabular-nums ${scoreTone(s.average)}`}>{s.average}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.average >= 90 ? "bg-emerald-500" : s.average >= 70 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.max(4, s.average)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {s.attempts} attempt{s.attempts === 1 ? "" : "s"} · best {s.best}
                    </p>
                  </div>
                  {set && (
                    <button
                      type="button"
                      onClick={() => onPractise(soundSession(set))}
                      className="h-8 px-3 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] shrink-0"
                    >
                      Practise
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {data.troubleWords.length > 0 && (
        <section className={`${card} p-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Words you keep missing</h2>
            <button
              type="button"
              onClick={() => onPractise({ title: "Words you keep missing", items: data.troubleWords.map((w) => ({ target: w.word, avoid: w.heardAs ?? undefined, source: "word" })) })}
              className="h-8 px-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Practise these
            </button>
          </div>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
            {data.troubleWords.map((w) => (
              <li key={w.word} className="py-2 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-100">{w.word}</span>
                <span className="text-xs text-slate-500">
                  {w.heardAs ? `heard as “${w.heardAs}” · ` : ""}
                  {w.count}×
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${card} p-4`}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent attempts</h2>
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.06]">
          {data.recent.map((r, i) => (
            <li key={`${r.createdAt}-${i}`} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-700 dark:text-slate-200">{r.target}</span>
              <span className={`font-semibold tabular-nums shrink-0 ${scoreTone(r.score)}`}>{r.score}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

// ============================================================
// Page
// ============================================================

export const PronunciationPage: React.FC = () => {
  const [tab, setTab] = useState<"practise" | "progress">("practise");
  const [session, setSession] = useState<Session | null>(null);
  const { data, isLoading, isError } = usePronunciationPractice();
  const supported = canListen();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
          <AudioLines className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pronunciation</h1>
          <p className="text-sm text-slate-500">Say it, see which words came across, and fix the sounds that trip you up</p>
        </div>
      </header>

      {!supported && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Your browser cannot turn speech into text, so it cannot score you. Open SpeakBetter in Chrome or Edge to practise.
          You can still listen to every word here.
        </div>
      )}

      {session ? (
        <PracticeSession key={session.title + session.items[0]?.target} session={session} onExit={() => setSession(null)} />
      ) : (
        <>
          <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] w-fit" role="tablist">
            {(["practise", "progress"] as const).map((t) => (
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
                {t === "practise" ? "Practise" : "My progress"}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : isError || !data ? (
            <div className={`${card} p-8 text-center text-sm text-slate-500`}>Could not load the practice. Refresh the page to try again.</div>
          ) : tab === "practise" ? (
            <PractiseHome data={data} onStart={setSession} />
          ) : (
            <ProgressView sounds={data.sounds} onPractise={setSession} />
          )}

          <p className="text-[11px] text-slate-400 text-center">
            Scores come from your browser's speech recognition: they show how clearly you came across, not every detail of your accent.
          </p>
        </>
      )}
    </div>
  );
};

export default PronunciationPage;
