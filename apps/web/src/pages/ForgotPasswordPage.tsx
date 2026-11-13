// apps/web/src/pages/ForgotPasswordPage.tsx
/** "Forgot password": ask for a one-time link by email. The answer never says whether the account exists. */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail, MailCheck, ShieldCheck, TimerReset } from "lucide-react";
import { AuthShell } from "../components/common/AuthShell";
import { Button, Card, Field, Input } from "../components/ui";
import { authApi } from "../lib/api/auth";
import { useT } from "../i18n";
import { tr, msg } from "../i18n/core";

const FEATURES = [
  { icon: Mail, title: msg("A link by email"), text: msg("Open it on any device to choose a new password") },
  { icon: TimerReset, title: msg("Works for 30 minutes"), text: msg("And only once, so an old email can't be used") },
  { icon: ShieldCheck, title: msg("Signed out everywhere"), text: msg("After the change, every other device signs out") },
];

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 429
          ? t("Too many requests for now. Wait a few minutes, then try again.")
          : status === 400
            ? t("Check the email address and try again.")
            : t("We couldn't reach SpeakBetter. Check your connection and try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow={tr("Account help")}
      title={
        <>
          {t("Locked out?")}
          <br />
          <span className="italic text-amber-300">{t("It happens.")}</span>
        </>
      }
      blurb="Get a link by email and choose a new password in a minute."
      features={FEATURES}
    >
      <Card className="p-7 sm:p-8">
        {sent ? (
          <div role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
              <MailCheck aria-hidden className="h-6 w-6" />
            </span>
            <h1 className="mt-5 text-[28px] leading-tight text-slate-900 dark:text-white">{t("Check your email")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t("If {email} has a SpeakBetter account, a link to choose a new password is on its way. It works once, for 30 minutes.", { email: email.trim() })}
            </p>
            <ul className="mt-5 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
              <li>• {t("Nothing after a few minutes? Look in your spam or promotions folder.")}</li>
              <li>• {t("Signed up with Google? The link lets you add a password too.")}</li>
            </ul>
            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setSent(false)}>
                {t("Use another email")}
              </Button>
              <Link
                to="/login"
                className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
              >
                {t("Back to sign in")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-[28px] leading-tight text-slate-900 dark:text-white">{t("Forgot your password?")}</h1>
            <p className="mt-1.5 mb-7 text-sm text-slate-600 dark:text-slate-400">{t("Type the email you sign in with, and we'll send you a link.")}</p>
            <form onSubmit={submit} className="space-y-5" noValidate={false}>
              <Field label={t("Email address")} htmlFor="forgot-email" error={error ?? undefined}>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  invalid={!!error}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" size="lg" icon={KeyRound} loading={busy} className="w-full">
                {busy ? t("Sending…") : t("Send me a link")}
              </Button>
            </form>
            <Link
              to="/login"
              className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" /> {t("Back to sign in")}
            </Link>
          </>
        )}
      </Card>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
