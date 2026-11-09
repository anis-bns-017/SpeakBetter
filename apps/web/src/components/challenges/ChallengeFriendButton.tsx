import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Loader2, Swords, X } from "lucide-react";
import { useFriends } from "../../hooks/useFriends";
import { useChallengeFriend, type ChallengeKind } from "../../hooks/useFriendChallenges";

const errorMessage = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** "Challenge a friend" on a result screen: pick a friend, and they get asked to beat your best */
export const ChallengeFriendButton: React.FC<{ kind: ChallengeKind; refId: string }> = ({ kind, refId }) => {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const { data: friends, isLoading } = useFriends();
  const challenge = useChallengeFriend();

  const send = (friendId: string, name: string) =>
    challenge.mutate(
      { friendId, kind, refId },
      {
        onSuccess: (r) => {
          setSent((s) => ({ ...s, [friendId]: true }));
          toast.success(r.created ? `Challenge sent to ${name}` : `${name} already has this challenge`);
        },
        onError: (e) => toast.error(errorMessage(e, "Couldn't send the challenge")),
      },
    );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
      >
        <Swords className="w-4 h-4" /> Challenge a friend
      </button>
    );
  }

  return (
    <div className="w-full rounded-3xl border border-line bg-surface p-4 space-y-3" role="dialog" aria-label="Challenge a friend">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
          <Swords className="w-4 h-4 text-rose-500" /> Who can beat your best?
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      ) : !friends?.length ? (
        <p className="text-sm text-slate-500">
          You have no friends here yet. <Link to="/friends" className="text-indigo-600 dark:text-indigo-300 underline">Find people</Link> to challenge.
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
          {friends.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2">
              {f.avatarUrl ? (
                <img src={f.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.07] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  {f.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{f.name}</span>
              {sent[f.id] ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" /> Sent
                </span>
              ) : (
                <button
                  type="button"
                  disabled={challenge.isPending}
                  onClick={() => send(f.id, f.name)}
                  className="h-8 px-3 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
                >
                  Challenge
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ChallengeFriendButton;
