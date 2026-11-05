import React from "react";
import { Swords } from "lucide-react";
import type { ChallengeOutcome } from "../../hooks/useFriendChallenges";

/** On a result screen: how this try settled the challenges friends had sent you */
export const ChallengeOutcomes: React.FC<{ outcomes?: ChallengeOutcome[] }> = ({ outcomes }) => {
  if (!outcomes?.length) return null;
  return (
    <div className="space-y-2" role="status">
      {outcomes.map((o) => (
        <div
          key={o.id}
          className={`rounded-2xl px-4 py-3 text-sm flex items-center gap-2 ${
            o.status === "BEATEN"
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : o.status === "TIED"
                ? "bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-300"
                : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300"
          }`}
        >
          <Swords className="w-4 h-4 shrink-0" />
          <span>
            {o.status === "BEATEN" && <>You beat {o.from}'s challenge: {o.yours} against {o.theirs}. +5 XP</>}
            {o.status === "TIED" && <>You tied with {o.from}: both {o.yours}.</>}
            {o.status === "HELD" && <>{o.from} keeps the lead this time: {o.theirs} against your {o.yours}.</>}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ChallengeOutcomes;
