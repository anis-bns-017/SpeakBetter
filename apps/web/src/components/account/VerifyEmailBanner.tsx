// apps/web/src/components/account/VerifyEmailBanner.tsx
/**
 * A quiet reminder to confirm your email. Learning works without it; it comes back straight away when you try
 * something that needs it. On a server with no email service it stays hidden, since no link could arrive.
 */
import React, { useEffect, useState } from "react";
import { Loader2, MailCheck, X } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useSendVerification, useVerificationStatus } from "../../hooks/useEmailVerification";
import { EMAIL_NEEDED_EVENT } from "../../lib/api/client";
import { clearSnooze, isSnoozed, snooze } from "../../lib/verifyEmailSnooze";
import { tr } from "../../i18n/core";

export const VerifyEmailBanner: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const userId = user?.id;
  const needed = !!user && user.emailVerifiedAt === null;
  const { data } = useVerificationStatus(needed);
  const send = useSendVerification();
  const [hidden, setHidden] = useState(() => isSnoozed(userId));

  useEffect(() => {
    if (!userId) return;
    const show = () => {
      clearSnooze(userId);
      setHidden(false);
    };
    window.addEventListener(EMAIL_NEEDED_EVENT, show);
    return () => window.removeEventListener(EMAIL_NEEDED_EVENT, show);
  }, [userId]);

  // Confirmed in another tab or on another device
  const confirmedElsewhere = needed && !!data?.verified;
  useEffect(() => {
    if (confirmedElsewhere) void refreshUser();
  }, [confirmedElsewhere, refreshUser]);

  if (!needed || !data?.canSend || data.verified || hidden) return null;

  return (
    <div className="px-4 pt-3 pr-16 sm:px-6 sm:pr-16 lg:pr-6">
      <div role="region" aria-label={tr("Confirm your email")} className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-3.5 sm:flex-row sm:items-center dark:border-amber-400/20 dark:bg-amber-500/10">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <MailCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{tr("Confirm your email")}</p>
            <p className="break-words text-sm text-slate-700 dark:text-slate-300">
              {tr("We send the link to {email}. You need it to call, message and invite people you don't know yet.", { email: data.email ?? "" })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => send.mutate()}
            disabled={send.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {send.isPending && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />} {tr("Send the link")}
          </button>
          <button
            type="button"
            aria-label={tr("Not now")}
            onClick={() => {
              if (userId) snooze(userId);
              setHidden(true);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
