// apps/web/src/components/settings/DeleteAccountCard.tsx
/**
 * "Delete my account", at the end of Settings. The dialog says exactly what goes (including communities and live
 * rooms the person owns, which take other people's messages with them), then asks for the password again, or the
 * email for Google-only accounts. Afterwards this device is signed out and cleaned up.
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button, Field, Input } from "../ui";
import { ActionDialog } from "../admin/AdminKit";
import { apiClient, markLeaving } from "../../lib/api/client";
import { useAuth } from "../../contexts/useAuth";
import { useT } from "../../i18n";
import { forgetPushLocally } from "../../lib/push";
import { clearOfflineData } from "../../lib/offline";

interface Preview {
  check: "password" | "email";
  communitiesOwned: number;
  membersInThem: number;
  liveRoomsOwned: number;
  lastAdmin: boolean;
}

export const DeleteAccountCard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: preview, isLoading } = useQuery({
    queryKey: ["account-deletion"],
    queryFn: async () => (await apiClient.get<Preview>("/auth/me/deletion")).data,
    enabled: open,
    staleTime: 0,
  });

  const close = () => {
    if (busy) return;
    setOpen(false);
    setSecret("");
    setError(null);
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/auth/me/delete", preview.check === "password" ? { password: secret } : { confirmEmail: secret });
      // The account is gone (and the server cleared the sign-in cookies). Requests still in flight will now get
      // 401s; they must not send us to /login. Clean this device up without the server, then start fresh.
      markLeaving();
      await Promise.all([forgetPushLocally(), clearOfflineData()]);
      window.location.replace("/?goodbye=1");
    } catch (err) {
      const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data;
      setError(typeof data?.message === "string" ? t(data.message) : t("That didn't work. Check your connection and try again."));
      setBusy(false);
    }
  };

  const ready = preview && !preview.lastAdmin && secret.trim().length > 0;

  return (
    <section aria-labelledby="delete-account-title" className="rounded-3xl border border-red-200 bg-surface p-6 shadow-sm sm:p-8 dark:border-red-400/25">
      <h2 id="delete-account-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        <AlertTriangle aria-hidden className="h-5 w-5 text-red-600 dark:text-red-400" /> {t("Delete your account")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {t("This removes your account and everything in it for good: your progress, streaks, cards, saved words, messages and friends. It can't be undone.")}
      </p>
      <Button variant="secondary" icon={Trash2} onClick={() => setOpen(true)} className="mt-4 text-red-700 dark:text-red-300">
        {t("Delete my account")}
      </Button>

      <ActionDialog
        open={open}
        title={t("Delete your account?")}
        description={t("Everything below is deleted straight away and can't be brought back.")}
        confirmLabel={t("Delete my account")}
        danger
        busy={busy}
        disabled={!ready}
        error={error}
        onClose={close}
        onConfirm={() => void confirm()}
      >
        {isLoading || !preview ? (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {t("Checking what goes with it…")}
          </p>
        ) : preview.lastAdmin ? (
          <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
            {t("You're the only admin. Make someone else an admin first, so SpeakBetter always has one.")}
          </p>
        ) : (
          <>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              <li>{t("Your profile, progress, XP, streaks, badges and league history")}</li>
              <li>{t("Your flashcards, saved words, writing and practice results")}</li>
              <li>{t("Your messages, friends and follows")}</li>
              {preview.communitiesOwned > 0 && (
                <li className="font-semibold text-red-700 dark:text-red-300">
                  {t("{n} community(ies) you own, with all their messages", { n: preview.communitiesOwned })}
                  {preview.membersInThem > 0 ? ` ${t("({n} other member(s) lose them too)", { n: preview.membersInThem })}` : ""}
                </li>
              )}
              {preview.liveRoomsOwned > 0 && (
                <li className="font-semibold text-red-700 dark:text-red-300">{t("{n} live room(s) you're hosting, which closes for everyone", { n: preview.liveRoomsOwned })}</li>
              )}
            </ul>
            {preview.check === "password" ? (
              <Field label={t("Your password")} htmlFor="delete-password" hint={t("To make sure it's really you.")}>
                <Input id="delete-password" type="password" autoComplete="current-password" value={secret} onChange={(e) => setSecret(e.target.value)} />
              </Field>
            ) : (
              <Field label={t("Type {email} to confirm", { email: user?.email ?? "" })} htmlFor="delete-email">
                <Input id="delete-email" type="email" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} />
              </Field>
            )}
          </>
        )}
      </ActionDialog>
    </section>
  );
};

export default DeleteAccountCard;
