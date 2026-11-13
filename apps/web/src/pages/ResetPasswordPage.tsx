// apps/web/src/pages/ResetPasswordPage.tsx
/**
 * Opened from the reset email (/reset-password?token=…). Checks the link first, then lets the person choose a new
 * password with the same rules the server uses. Afterwards they sign in again (every device was signed out).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, TimerReset, X } from "lucide-react";
import { AuthShell } from "../components/common/AuthShell";
import { Button, Card, Field, Input } from "../components/ui";
import { authApi } from "../lib/api/auth";
import { useT } from "../i18n";
import { tr, msg } from "../i18n/core";

const FEATURES = [
  { icon: KeyRound, title: msg("Pick something new"), text: msg("At least 8 characters, letters plus a number or symbol") },
  { icon: ShieldCheck, title: msg("Signed out everywhere"), text: msg("Every other device signs out once it's changed") },
  { icon: TimerReset, title: msg("One-time link"), text: msg("It stops working after you use it") },
];

/** The same rules as the server (password-reset.service.ts), shown as a checklist while typing */
const rules = (password: string) => [
  { ok: password.length >= 8, label: msg("At least 8 characters") },
  { ok: /[A-Za-z]/.test(password) && /[^A-Za-z]/.test(password), label: msg("Letters and at least one number or symbol") },
];

type LinkState = "checking" | "valid" | "invalid" | "unreachable";

export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { t } = useT();
  const [state, setState] = useState<LinkState>(token ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checks = useMemo(() => rules(password).map((c) => ({ ...c, label: t(c.label) })), [password, t]);
  const strong = checks.every((c) => c.ok);
  const matches = password.length > 0 && password === confirm;

  useEffect(() => {
    if (!token) return;
    let live = true;
    authApi
      .checkResetToken(token)
      .then((r) => live && setState(r.data.valid ? "valid" : "invalid"))
      .catch(() => live && setState("unreachable"));
    return () => {
      live = false;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong || !matches) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      toast.success(t("Password changed. Sign in with your new password."));
      navigate("/login", { replace: true });
    } catch (err) {
      const data = (err as { response?: { status?: number; data?: { message?: unknown } } })?.response;
      const message = typeof data?.data?.message === "string" ? data.data.message : null;
      if (data?.status === 400 && message && /expired|already used/.test(message)) setState("invalid");
      setError(message ? t(message) : t("We couldn't reach SpeakBetter. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow={tr("Account help")}
      title={
        <>
          {t("A fresh start")}
          <br />
          <span className="italic text-amber-300">{t("for your account.")}</span>
        </>
      }
      blurb="Choose a new password, then sign in and carry on where you left off."
      features={FEATURES}
    >
      <Card className="p-7 sm:p-8">
        {state === "checking" && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {t("Checking your link…")}
          </p>
        )}

        {(state === "invalid" || state === "unreachable") && (
          <div role="alert">
            <h1 className="text-[28px] leading-tight text-slate-900 dark:text-white">
              {state === "invalid" ? t("This link doesn't work any more") : t("We couldn't check your link")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {state === "invalid"
                ? t("Reset links work once, for 30 minutes, and only the newest one works. Ask for a new link and use it straight away.")
                : t("SpeakBetter isn't answering right now. Check your connection, then open the link again.")}
            </p>
            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <Link to="/forgot-password" className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700">
                {t("Get a new link")}
              </Link>
              <Link to="/login" className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                {t("Back to sign in")}
              </Link>
            </div>
          </div>
        )}

        {state === "valid" && (
          <>
            <h1 className="text-[28px] leading-tight text-slate-900 dark:text-white">{t("Choose a new password")}</h1>
            <p className="mt-1.5 mb-7 text-sm text-slate-600 dark:text-slate-400">{t("You'll be signed out on your other devices once it's saved.")}</p>
            <form onSubmit={submit} className="space-y-5">
              <Field label={t("New password")} htmlFor="new-password">
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? "text" : "password"}
                    required
                    autoFocus
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby="password-rules"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? t("Hide password") : t("Show password")}
                    aria-pressed={show}
                    className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:text-white"
                  >
                    {show ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
                  </button>
                </div>
              </Field>
              <ul id="password-rules" className="space-y-1 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className={`flex items-center gap-2 ${c.ok ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500"}`}>
                    {c.ok ? <Check aria-hidden className="h-4 w-4" /> : <X aria-hidden className="h-4 w-4" />}
                    {tr(c.label)}
                    <span className="sr-only">{c.ok ? t("(done)") : t("(not yet)")}</span>
                  </li>
                ))}
              </ul>
              <Field
                label={t("Type it again")}
                htmlFor="confirm-password"
                error={confirm.length > 0 && !matches ? t("The two passwords don't match") : error ?? undefined}
              >
                <Input
                  id="confirm-password"
                  type={show ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  invalid={confirm.length > 0 && !matches}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
              <Button type="submit" size="lg" loading={busy} disabled={!strong || !matches} className="w-full">
                {busy ? t("Saving…") : t("Save new password")}
              </Button>
            </form>
          </>
        )}
      </Card>
    </AuthShell>
  );
};

export default ResetPasswordPage;
