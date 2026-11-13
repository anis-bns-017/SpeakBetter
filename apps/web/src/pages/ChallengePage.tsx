// apps/web/src/pages/ChallengePage.tsx
/**
 * The daily speaking challenge: one prompt a day for your level. Record an answer, see how it went (pace,
 * length, filler words, staying on topic), and listen to how others answered the same prompt.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Calendar,
  ChevronDown,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  Mic,
  MessageSquareQuote,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import {
  useChallengeToday,
  useDeleteChallenge,
  useReactToChallenge,
  useSubmitChallenge,
  type ChallengeEntry,
  type ChallengeLevel,
  type ChallengePrompt,
} from "../hooks/useChallenge";
import { useRecorder } from "../hooks/usePronunciation";
import { useSpeechCaptions, speechCaptionsSupported } from "../components/call/useSpeechCaptions";
import { uploadToCloudinary } from "../lib/uploadToCloudinary";
import { tr, msg } from "../i18n/core";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const errorMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || fallback;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const scoreTone = (score: number) =>
  score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

interface Recording {
  blob: Blob;
  url: string;
  transcript: string;
  seconds: number;
}

// ============================================================
// Recording an answer
// ============================================================

const Recorder: React.FC<{ prompt: ChallengePrompt; onDone: (r: Recording) => void }> = ({ prompt, onDone }) => {
  const recorder = useRecorder();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finals, setFinals] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const startedAt = useRef(0);
  const stopRef = useRef<() => void>(() => undefined);
  const limit = Math.min(180, Math.max(90, prompt.seconds * 2));

  const { error: speechError } = useSpeechCaptions({
    active: recording,
    lang: "en-US",
    onText: (text, final) => {
      if (final) {
        setFinals((f) => [...f, text]);
        setInterim("");
      } else {
        setInterim(text);
      }
    },
  });

  const stop = async () => {
    if (!recording) return;
    setRecording(false);
    const seconds = (Date.now() - startedAt.current) / 1000;
    const result = await recorder.stop();
    if (!result) {
      toast.error(tr("Nothing was recorded. Check your microphone and try again."));
      return;
    }
    const blob = await fetch(result.url).then((r) => r.blob());
    onDone({ blob, url: result.url, transcript: [...finals, interim].join(" ").trim(), seconds });
  };
  useEffect(() => {
    stopRef.current = () => void stop();
  });

  // The timer, which also stops the recording at the limit
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => {
      const s = (Date.now() - startedAt.current) / 1000;
      setElapsed(s);
      if (s >= limit) stopRef.current();
    }, 250);
    return () => window.clearInterval(t);
  }, [recording, limit]);

  const start = async () => {
    setFinals([]);
    setInterim("");
    setElapsed(0);
    const ok = await recorder.start();
    if (!ok) {
      toast.error(tr("Your browser couldn't use the microphone. Allow it in the address bar and try again."));
      return;
    }
    startedAt.current = Date.now();
    setRecording(true);
  };

  const target = prompt.seconds;
  const pct = Math.min(100, (elapsed / target) * 100);

  return (
    <div className={`${card} p-6 text-center`}>
      {recording ? (
        <>
          <p className="text-4xl font-bold tabular-nums text-slate-900 dark:text-white">{clock(elapsed)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {elapsed < target ? tr("Aim for about {target} seconds", { target }) : tr("Great length. Finish your thought and stop.")}
          </p>
          <div className="mt-3 mx-auto max-w-xs h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden" aria-hidden>
            <div className={`h-full rounded-full transition-[width] duration-200 ${elapsed >= target ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
          </div>
          <button
            type="button"
            onClick={() => void stop()}
            aria-label={tr("Stop recording")}
            className="mt-5 w-20 h-20 rounded-full bg-rose-500 text-white flex items-center justify-center mx-auto shadow-lg"
            style={{ boxShadow: `0 0 0 ${4 + Math.round(recorder.level * 16)}px rgba(244,63,94,0.18)` }}
          >
            <Square className="w-7 h-7" />
          </button>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 min-h-[2.5rem] max-w-md mx-auto">
            {[...finals, interim].join(" ") || <span className="text-slate-400">{tr("Start talking…")}</span>}
          </p>
          {speechError && <p className="mt-1 text-xs text-amber-600">{speechError} {" "}{tr("Your recording still works.")}</p>}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void start()}
            aria-label={tr("Start recording your answer")}
            className="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 hover:scale-105 transition-all text-white flex items-center justify-center mx-auto shadow-lg"
          >
            <Mic className="w-8 h-8" />
          </button>
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{tr("Tap to record your answer")}</p>
          <p className="text-xs text-slate-500 mt-0.5">{tr("You can listen back before you share it")}</p>
          {!speechCaptionsSupported() && (
            <p className="mt-3 text-xs text-amber-600">{tr("Your browser can't turn speech into text, so your answer won't get a score. Chrome or Edge can.")}</p>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================
// Results and answers
// ============================================================

const Stats: React.FC<{ entry: ChallengeEntry }> = ({ entry }) => {
  const s = entry.stats;
  if (s.tooShort || s.score === null) {
    return <p className="text-sm text-slate-500">{tr("Too short to score. Try speaking for at least 20 seconds.")}</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className={`text-5xl font-bold tabular-nums ${scoreTone(s.score)}`}>{s.score}</span>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white">
            {s.score >= 80 ? tr("Excellent answer") : s.score >= 60 ? tr("Good answer") : tr("Keep practising")}
          </p>
          <p className="text-xs text-slate-500">{s.onTopic ? tr("Right on topic") : tr("Try to use more words about the topic")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: msg("Length"), value: clock(s.seconds) },
          { label: msg("Words a minute"), value: s.wpm ?? "–" },
          { label: msg("Fluency"), value: s.fluency ?? "–" },
          { label: msg("Fillers per 100 words"), value: s.fillersPer100 },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] px-3 py-2">
            <p className="text-[11px] text-slate-500">{tr(t.label)}</p>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{t.value}</p>
          </div>
        ))}
      </div>
      {s.richWords.length > 0 && (
        <p className="text-xs text-slate-500">
          {tr("Nice words you used:")}{" "}<span className="font-semibold text-slate-700 dark:text-slate-200">{s.richWords.join(", ")}</span>
        </p>
      )}
    </div>
  );
};

const Transcript: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
        <MessageSquareQuote className="w-3.5 h-3.5" /> {open ? tr("Hide") : tr("Read")} {" "}{tr("what was said")}<ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{tr(text)}</p>}
    </div>
  );
};

const AnswerCard: React.FC<{ entry: ChallengeEntry; reactions: string[] }> = ({ entry, reactions }) => {
  const react = useReactToChallenge();
  return (
    <article className={`${card} p-4`}>
      <div className="flex items-center gap-3">
        {entry.user.avatarUrl ? (
          <img src={entry.user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[0.07] flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
            {entry.user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate"><Link to={`/u/${entry.user.id}`} className="hover:underline">{entry.user.name}</Link></p>
          <p className="text-[11px] text-slate-500 truncate">
            {entry.level} · {entry.promptTitle} · {clock(entry.durationSec)}
          </p>
        </div>
        {entry.stats.score !== null && <span className={`text-lg font-bold tabular-nums ${scoreTone(entry.stats.score)}`}>{entry.stats.score}</span>}
      </div>
      <audio controls preload="none" src={entry.audioUrl} className="mt-3 w-full h-10" />
      <Transcript text={entry.transcript} />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {reactions.map((emoji) => {
          const mine = entry.myReaction === emoji;
          const count = entry.reactions[emoji] ?? 0;
          return (
            <button
              key={emoji}
              type="button"
              disabled={react.isPending}
              onClick={() =>
                react.mutate(
                  { entryId: entry.id, emoji: mine ? null : emoji },
                  { onError: (e) => toast.error(errorMessage(e, "Couldn't react")) },
                )
              }
              aria-pressed={mine}
              className={`h-8 px-2.5 rounded-full text-sm inline-flex items-center gap-1 border transition-colors ${
                mine
                  ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/15"
                  : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
              }`}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{count}</span>}
            </button>
          );
        })}
      </div>
    </article>
  );
};

// ============================================================
// Page
// ============================================================

export const ChallengePage: React.FC = () => {
  const [level, setLevel] = useState<ChallengeLevel | undefined>(undefined);
  const { data, isLoading, isError } = useChallengeToday(level);
  const submit = useSubmitChallenge();
  const remove = useDeleteChallenge();
  const [take, setTake] = useState<Recording | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [recordAgain, setRecordAgain] = useState(false);
  const [sending, setSending] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center text-sm text-slate-500`}>{tr("Couldn't load today's challenge. Refresh to try again.")}</div>;
  }

  const prompt = data.prompt;
  const mine = data.mine;
  const showRecorder = !take && (!mine || recordAgain);

  const share = async () => {
    if (!take || sending) return;
    setSending(true);
    try {
      const file = new File([take.blob], `challenge-${data.day}.webm`, { type: take.blob.type || "audio/webm" });
      const uploaded = await uploadToCloudinary(file);
      const result = await submit.mutateAsync({
        promptId: prompt.id,
        audioUrl: uploaded.url,
        transcript: take.transcript,
        durationSec: Math.max(5, Math.round(take.seconds)),
        visibility,
      });
      toast.success(result.firstToday ? tr("Answer shared! +{xp} XP", { xp: result.xp }) : tr("Your new answer replaced the old one"));
      setTake(null);
      setRecordAgain(false);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't share your answer"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
          <Mic className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">{tr("Daily challenge")}</h1>
          <p className="text-sm text-slate-500">{tr("One question a day. Answer it out loud, then hear how others did.")}</p>
        </div>
        {data.streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-600 dark:text-orange-300" title={tr("Days in a row you answered")}>
            <Flame className="w-3.5 h-3.5" /> {data.streak}
          </span>
        )}
      </header>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr("Level")}>
        {data.levels.map((l) => (
          <button
            key={l.level}
            type="button"
            role="tab"
            aria-selected={data.level === l.level}
            onClick={() => {
              setLevel(l.level);
              setTake(null);
            }}
            title={tr(l.title)}
            className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
              data.level === l.level
                ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:text-white dark:border-indigo-500"
                : "border-line bg-surface text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.08]"
            }`}
          >
            {l.level}
            {l.level === data.ownLevel && tr(" · you")}
          </button>
        ))}
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-rose-500 to-orange-500 text-white p-6 shadow-md shadow-rose-500/15">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {" "}{tr("Today · {level} · about {seconds} seconds", { level: prompt.level, seconds: prompt.seconds })}</p>
        <h2 className="mt-2 text-2xl font-bold">{tr(prompt.title)}</h2>
        <p className="mt-1 text-base text-white/90">{prompt.prompt}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {prompt.phrases.map((ph) => (
            <span key={ph} className="rounded-full bg-white/15 px-2.5 py-1 text-xs">
              {ph}
            </span>
          ))}
        </div>
      </section>

      {showRecorder && <Recorder key={prompt.id} prompt={prompt} onDone={setTake} />}

      {take && (
        <section className={`${card} p-5 space-y-4`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{tr("Listen back ·")}{" "}{clock(take.seconds)}</h2>
          <audio controls src={take.url} className="w-full h-10" />
          {take.transcript && <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{take.transcript}</p>}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setVisibility((v) => (v === "public" ? "private" : "public"))}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              aria-pressed={visibility === "private"}
            >
              {visibility === "public" ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {visibility === "public" ? tr("Everyone can hear it") : tr("Only you")}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTake(null)}
              disabled={sending}
              className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> {" "}{tr("Try again")}</button>
            <button
              type="button"
              onClick={() => void share()}
              disabled={sending}
              className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {" "}{tr("Share answer")}</button>
          </div>
        </section>
      )}

      {mine && !take && !recordAgain && (
        <section className={`${card} p-5 space-y-4`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{tr("Your answer")}</h2>
              <p className="text-xs text-slate-500">
                {mine.promptTitle} · {mine.visibility === "public" ? tr("everyone can hear it") : tr("only you")}
                {mine.totalReactions > 0 && tr(" · {totalReactions} reaction{value}", { totalReactions: mine.totalReactions, value: mine.totalReactions === 1 ? "" : "s" })}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRecordAgain(true)}
                className="h-8 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> {" "}{tr("Record again")}</button>
              <button
                type="button"
                onClick={() => remove.mutate(undefined, { onSuccess: () => toast.success(tr("Answer deleted")) })}
                aria-label={tr("Delete my answer")}
                className="w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 hover:text-rose-500 flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <Stats entry={mine} />
          <audio controls preload="none" src={mine.audioUrl} className="w-full h-10" />
          <Transcript text={mine.transcript} />
          {Object.keys(mine.reactions).length > 0 && (
            <p className="text-sm">
              {Object.entries(mine.reactions).map(([emoji, n]) => (
                <span key={emoji} className="mr-2">
                  {emoji} <span className="text-xs font-semibold text-slate-500">{n}</span>
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" /> {" "}{tr("Today's answers")}</h2>
          <span className="text-xs text-slate-500">{data.feed.length}</span>
        </div>
        {data.feed.length === 0 ? (
          <div className={`${card} p-6 text-center text-sm text-slate-500`}>
            {mine ? tr("You're the first today! Others' answers will show up here.") : tr("Nobody has answered yet. Be the first!")}
          </div>
        ) : (
          data.feed.map((e) => <AnswerCard key={e.id} entry={e} reactions={data.reactions} />)
        )}
      </section>

      <p className="text-[11px] text-slate-400 text-center">
        {tr("Scores come from your browser's speech recognition. Your first answer each day earns 10 XP.")}{" "}<Link to="/leagues?tab=badges" className="underline">{tr("See speaking badges")}</Link>
      </p>
    </div>
  );
};

export default ChallengePage;
