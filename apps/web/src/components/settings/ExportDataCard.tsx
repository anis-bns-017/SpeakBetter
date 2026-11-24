// apps/web/src/components/settings/ExportDataCard.tsx
/** "Download my data": everything the account holds, as one JSON file the person can keep. */

import React, { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui";
import { apiClient } from "../../lib/api/client";
import { serverMessage } from "../../lib/serverMessage";
import { useT } from "../../i18n";
import { tr } from "../../i18n/core";

export const ExportDataCard: React.FC = () => {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const { data } = await apiClient.get<unknown>("/auth/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `speakbetter-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(tr("Your data was downloaded."), { id: "export-data" });
    } catch (e) {
      toast.error(serverMessage(e) || tr("Couldn't prepare your data. Please try again."), { id: "export-data" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="export-title" className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h2 id="export-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        <Download aria-hidden className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /> {t("Download your data")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {t("Get a copy of what SpeakBetter holds about you: your profile, settings, progress, saved words, writing and messages you sent. Passwords and sign-in details are never included.")}
      </p>
      <Button variant="secondary" icon={Download} loading={busy} onClick={() => void download()} className="mt-4">
        {t("Download my data")}
      </Button>
    </section>
  );
};

export default ExportDataCard;
