// apps/web/src/pages/SessionsPage.tsx
/** Every voice room session you were in, newest first, each opening its recap */

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, History, Loader2, Mic } from "lucide-react";
import { formatDuration, useMySessions } from "../hooks/useSessionRecap";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

export const SessionsPage: React.FC = () => {
  const { data, isLoading, isError } = useMySessions();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
          <History className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">My sessions</h1>
          <p className="text-sm text-slate-500">Your time in voice rooms, with a recap of each one.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      ) : isError ? (
        <div className={`${card} p-8 text-center text-sm text-slate-500`}>Couldn't load your sessions. Refresh to try again.</div>
      ) : !data?.length ? (
        <div className={`${card} p-8 text-center space-y-3`}>
          <p className="text-base font-semibold text-slate-900 dark:text-white">No sessions yet</p>
          <p className="text-sm text-slate-500">Join a voice room. When you leave, you'll get a recap here.</p>
          <Link to="/voice" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700">
            <Mic className="w-4 h-4" /> Find a room
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((s) => (
            <li key={s.id}>
              <Link to={`/recap/${s.roomId}`} className={`${card} p-4 flex items-center gap-3 hover:shadow-md transition-shadow`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{s.roomName}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {formatDuration(s.durationSec)} in the room ·{" "}
                    {s.words ? `spoke ${formatDuration(s.speakingSec)}` : "listened"}
                    {s.fluencyScore !== null && ` · fluency ${s.fluencyScore}`}
                    {s.correctionsReceived > 0 && ` · ${s.correctionsReceived} corrections`}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SessionsPage;
