// apps/web/src/pages/SessionRecapPage.tsx
/**
 * What you see after leaving a voice room: how long you spoke, how fluent it sounded, the corrections people
 * gave you (already in your flashcards), the words you saved, who you talked with, and one tip for next time.
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Clock, Gauge, History, Layers, Lightbulb, Loader2, MessageSquareText, Mic, Sparkles, Users, Wand2 } from "lucide-react";
import { formatDuration, useSessionRecap } from "../hooks/useSessionRecap";
import { FollowButton } from "../components/social/FollowButton";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors";

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }> = ({ icon, label, value, sub }) => (
  <div className={`${card} p-4`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 flex items-center gap-1.5">
      {icon} {label}
    </p>
    <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const fluencyWord = (score: number) => (score >= 80 ? "Very smooth" : score >= 60 ? "Good flow" : score >= 40 ? "Getting there" : "Keep practising");

export const SessionRecapPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: recap, isLoading, isError } = useSessionRecap(roomId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-sm text-slate-500">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        Putting your recap together…
      </div>
    );
  }
  if (isError || !recap) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-8 text-center space-y-3`}>
        <p className="text-base font-semibold text-slate-900 dark:text-white">No recap for this session</p>
        <p className="text-sm text-slate-500">Recaps are made when you spend a little time in a room. Join one and say hello!</p>
        <div className="flex justify-center gap-2">
          <Link to="/voice" className={primaryBtn}>Voice rooms</Link>
          <Link to="/sessions" className={ghostBtn}>My sessions</Link>
        </div>
      </div>
    );
  }

  const listenedOnly = recap.words === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">Session recap</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">{recap.roomName}</h1>
          <p className="text-sm text-slate-500">{new Date(recap.at).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <Link to="/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <History className="w-4 h-4" /> All sessions
        </Link>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Clock className="w-3.5 h-3.5 text-slate-400" />} label="In the room" value={formatDuration(recap.durationSec)} />
        <Stat icon={<Mic className="w-3.5 h-3.5 text-indigo-500" />} label="You spoke" value={formatDuration(recap.speakingSec)} sub={recap.words ? `${recap.words} words` : "Just listening"} />
        <Stat
          icon={<Gauge className="w-3.5 h-3.5 text-emerald-500" />}
          label="Fluency"
          value={recap.fluencyScore ?? "-"}
          sub={recap.fluencyScore !== null ? fluencyWord(recap.fluencyScore) : "Speak a bit more to get a score"}
        />
        <Stat icon={<Wand2 className="w-3.5 h-3.5 text-violet-500" />} label="Corrections" value={recap.corrections.length} sub={`You gave ${recap.correctionsGiven}`} />
      </div>

      <section className="rounded-3xl p-5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70 inline-flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" /> For next time
        </p>
        <h2 className="mt-1 text-lg font-bold">{recap.tip.title}</h2>
        <p className="mt-1 text-sm text-white/85">{recap.tip.text}</p>
      </section>

      {recap.corrections.length > 0 && (
        <section className={`${card} p-5`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
              <MessageSquareText className="w-4 h-4 text-violet-500" /> What people corrected
            </h2>
            <Link to="/flashcards" className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline inline-flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> In your review
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
            {recap.corrections.map((c) => (
              <li key={c.id} className="py-3 text-sm">
                <p className="text-rose-600 dark:text-rose-400 line-through decoration-rose-400/60">{c.original}</p>
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">{c.corrected}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.note ? `${c.note} · ` : ""}from {c.author.name}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(recap.topFillers.length > 0 || recap.richWords.length > 0 || recap.savedWords.length > 0) && (
        <section className={`${card} p-5 space-y-4`}>
          {recap.richWords.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> Strong words you used
              </h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {recap.richWords.slice(0, 12).map((w) => (
                  <li key={w} className="rounded-full px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">{w}</li>
                ))}
              </ul>
            </div>
          )}
          {recap.savedWords.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Words you saved</h2>
              <ul className="mt-2 space-y-1">
                {recap.savedWords.map((w) => (
                  <li key={w.word} className="text-sm">
                    <span className="font-semibold text-slate-900 dark:text-white">{w.word}</span>
                    {w.meaning && <span className="text-slate-500"> · {w.meaning}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recap.topFillers.length > 0 && (
            <p className="text-xs text-slate-500">
              Filler words: {recap.topFillers.slice(0, 4).map((f) => `"${f.word}" ×${f.count}`).join(", ")}
            </p>
          )}
        </section>
      )}

      {recap.people.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
            <Users className="w-4 h-4 text-sky-500" /> You were with
          </h2>
          <ul className="mt-3 space-y-2">
            {recap.people.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[0.07] flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <Link to={`/u/${p.id}`} className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100 truncate hover:underline">
                  {p.name}
                </Link>
                <FollowButton userId={p.id} name={p.name} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/voice" className={ghostBtn}>Back to rooms</Link>
        <Link to={listenedOnly ? "/roleplay" : "/flashcards"} className={primaryBtn}>
          {listenedOnly ? "Warm up with a role-play" : "Review your mistakes"} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default SessionRecapPage;
