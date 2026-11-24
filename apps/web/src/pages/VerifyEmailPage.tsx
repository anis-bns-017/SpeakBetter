// apps/web/src/pages/VerifyEmailPage.tsx
/**
 * Opened from the confirmation email (/verify-email?token=…). It works signed in or not, on any device. Confirming
 * takes one click, because email scanners open links by themselves and must not confirm an address on their own.
 */
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MailCheck, ShieldCheck, Users } from "lucide-react";
import { AuthShell } from "../components/common/AuthShell";
import { Card } from "../components/ui";
import { useAuth } from "../contexts/useAuth";
import { useSendVerification } from "../hooks/useEmailVerification";
import { authApi } from "../lib/api/auth";
import { useT } from "../i18n";
import { tr, msg } from "../i18n/core";

const FEATURES = [
  { icon: ShieldCheck, title: msg("Your account stays yours"), text: msg("Only the owner of this address can confirm it") },
  { icon: Users, title: msg("Meet people safely"), text: msg("Calls and messages come from real addresses") },
  { icon: MailCheck, title: msg("One click"), text: msg("No code to type, and it works on any device") },
];

type State = "checking" | "ready" | "done" | "already" | "invalid" | "unreachable";

const primary = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";

export const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { t } = useT();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const resend = useSendVerification();
  const [state, setState] = useState<State>(token ? "checking" : "invalid");
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    authApi
      .checkVerification(token)
      .then(({ data }) => {
        if (!live) return;
        setEmail(data.email);
        setState(data.alreadyConfirmed ? "already" : data.valid ? "ready" : "invalid");
      })
      .catch(() => live && setState("unreachable"));
    return () => {
      live = false;
    };
  }, [token]);

  const finish = async (next: State) => {
    setState(next);
    queryClient.invalidateQueries({ queryKey: ["email-verification"] });
    if (user) await refreshUser().catch(() => null);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const { data } = await authApi.confirmEmail(token);
      await finish(data.alreadyConfirmed ? "already" : "done");
    } catch (error) {
      setState((error as { response?: { status?: number } })?.response?.status === 400 ? "invalid" : "unreachable");
    } finally {
      setBusy(false);
    }
  };

  const onward = (
    <Link to={user ? "/dashboard" : "/login"} className={primary}>
      {user ? t("Go to your dashboard") : t("Sign in")}
    </Link>
  );

  return (
    <AuthShell
      eyebrow={tr("Account help")}
      title={
        <>
          {t("One last step")}
          <br />
          <span className="italic text-amber-300">{t("to keep it yours.")}</span>
        </>
      }
      blurb={t("Confirm your email so we know this account really belongs to you.")}
      features={FEATURES}
    >
      <Card className="p-7 sm:p-8">
        {state === "checking" && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {t("Checking your link…")}
          </p>
        )}

        {state === "ready" && (
          <div>
            <h1 className="text-[28px] leading-tight text-slate-900 dark:text-white">{t("Confirm your email")}</h1>
            <p className="mt-2 break-words text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t("Is {email} yours, and did you create this SpeakBetter account?", { email: email ?? "" })}
            </p>
            <button type="button" onClick={() => void confirm()} disabled={busy} className={`${primary} mt-6 w-full`}>
              {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />} {t("Yes, confirm my email")}
            </button>
            <p className="mt-3 text-xs text-slate-500">{t("If you didn't create this account, just close this page.")}</p>
          </div>
        )}

        {(state === "done" || state === "already") && (
          <div role="status">
            <CheckCircle2 aria-hidden className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <h1 className="mt-3 text-[28px] leading-tight text-slate-900 dark:text-white">
              {state === "done" ? t("Your email is confirmed") : t("Your email is already confirmed.")}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("Everything in SpeakBetter is open to you.")}</p>
            <div className="mt-6">{onward}</div>
          </div>
        )}

        {(state === "invalid" || state === "unreachable") && (
          <div role="alert">
            <h1 className="text-[28px] leading-tight text-slate-900 dark:text-white">
              {state === "invalid" ? t("This link doesn't work any more") : t("We couldn't check your link")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {state === "unreachable"
                ? t("SpeakBetter isn't answering right now. Check your connection, then open the link again.")
                : user
                  ? t("Confirmation links work for 24 hours, and only the newest one works. Ask for a new one.")
                  : t("Confirmation links work for 24 hours, and only the newest one works. Sign in to ask for a new one.")}
            </p>
            {state === "invalid" && (
              <div className="mt-6">
                {user ? (
                  <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending} className={primary}>
                    {resend.isPending && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />} {t("Send the link")}
                  </button>
                ) : (
                  onward
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </AuthShell>
  );
};
