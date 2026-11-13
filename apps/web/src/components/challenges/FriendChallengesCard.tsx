import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Swords } from "lucide-react";
import { formatScore, useFriendChallenges, type FriendChallenge } from "../../hooks/useFriendChallenges";
import { tr } from "../../i18n/core";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const hoursLeft = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));

/** Results of your own challenges, in a few words */
const resultLine = (c: FriendChallenge): string => {
  const theirs = formatScore(c.kind, c.responseScore, c.responseTotal);
  const yours = formatScore(c.kind, c.score, c.total);
  if (c.status === "BEATEN") return `${c.person.name} beat you: ${theirs} vs ${yours}`;
  if (c.status === "HELD") return `You kept the lead: ${yours} vs ${theirs}`;
  if (c.status === "TIED") return `Tied with ${c.person.name} at ${yours}`;
  if (c.status === "EXPIRED") return `${c.person.name} didn't answer in time`;
  return `Waiting for ${c.person.name}`;
};

/** Dashboard: challenges waiting for you, and how your own challenges went. Hidden when there are none. */
export const FriendChallengesCard: React.FC = () => {
  const { data } = useFriendChallenges();
  if (!data) return null;
  const waiting = data.incoming.filter((c) => c.status === "OPEN").slice(0, 3);
  const recent = data.outgoing.filter((c) => c.status !== "EXPIRED").slice(0, 3);
  if (!waiting.length && !recent.length) return null;

  return (
    <section className={`${card} p-6`} aria-labelledby="friend-challenges-title">
      <p id="friend-challenges-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-400 inline-flex items-center gap-1.5">
        <Swords className="w-3.5 h-3.5" /> {" "}{tr("Friend challenges")}</p>
      {waiting.length > 0 && (
        <ul className="mt-3 space-y-2">
          {waiting.map((c) => (
            <li key={c.id}>
              <Link to={c.url} className="flex items-center gap-3 rounded-2xl p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {tr("Beat {name}'s", { name: c.person.name })}{" "}{formatScore(c.kind, c.score, c.total)}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {tr(c.title)} {" "}{tr("· {value} h left", { value: hoursLeft(c.expiresAt) })}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <ul className={`${waiting.length ? "mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]" : "mt-3"} space-y-1.5`}>
          {recent.map((c) => (
            <li key={c.id} className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{tr(c.title)}</span> · {resultLine(c)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default FriendChallengesCard;
