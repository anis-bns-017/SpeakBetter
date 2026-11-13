// apps/web/src/components/settings/SessionsCard.tsx
/**
 * "Where you're signed in": every device (login) on this account, newest first, with this one marked. Sign out
 * a single device, or every device but this one (for a lost phone or a shared computer).
 */

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Laptop, LogOut, MonitorSmartphone, Smartphone } from "lucide-react";
import { Badge, Button } from "../ui";
import { apiClient } from "../../lib/api/client";
import { deviceName, isMobileAgent } from "../../lib/device";
import { useT } from "../../i18n";

/** "9 minutes ago" / "৯ মিনিট আগে", in the app's language */
function ago(value: string, lang: string): string {
  const date = new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const locale = lang === "bn" ? "bn-BD" : "en";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 60) return rtf.format(0, "second");
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 30 * 86_400) return rtf.format(-Math.floor(seconds / 86_400), "day");
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

interface SessionRow {
  id: string;
  current: boolean;
  firstSeen: string;
  lastActive: string;
  ip: string | null;
  userAgent: string | null;
}

export const SessionsCard: React.FC = () => {
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const { data: sessions, isLoading, isError } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: async () => (await apiClient.get<SessionRow[]>("/auth/sessions")).data,
    staleTime: 30_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-sessions"] });

  const others = useMutation({
    mutationFn: async () => (await apiClient.post<{ signedOut: number }>("/auth/sessions/sign-out-others")).data,
    onSuccess: (r) => {
      toast.success(r.signedOut ? t("Signed out of {n} other device(s)", { n: r.signedOut }) : t("No other devices were signed in"));
      void refresh();
    },
    onError: () => toast.error(t("That didn't work. Try again.")),
  });
  const one = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/auth/sessions/${encodeURIComponent(id)}/sign-out`),
    onSuccess: () => {
      toast.success(t("That device is signed out"));
      void refresh();
    },
    onError: () => toast.error(t("That didn't work. Try again.")),
  });

  const otherCount = (sessions ?? []).filter((s) => !s.current).length;

  return (
    <section aria-labelledby="sessions-title" className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="sessions-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <MonitorSmartphone aria-hidden className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /> {t("Where you're signed in")}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("See a device you don't recognise? Sign it out, then change your password.")}</p>
        </div>
        {otherCount > 0 && (
          <Button variant="secondary" size="sm" icon={LogOut} loading={others.isPending} onClick={() => others.mutate()}>
            {t("Sign out of all other devices")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.05]" />
          ))}
        </div>
      ) : isError || !sessions ? (
        <p className="mt-4 text-sm text-slate-500">{t("Couldn't load your devices. Try again later.")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {sessions.map((s) => {
            const Icon = isMobileAgent(s.userAgent) ? Smartphone : Laptop;
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {deviceName(s.userAgent)}
                      {s.current && <Badge tone="success">{t("This device")}</Badge>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {s.current ? t("Active now") : t("Last active {when}", { when: ago(s.lastActive, lang) })}
                      {s.ip ? ` · ${s.ip}` : ""} · {t("signed in {when}", { when: ago(s.firstSeen, lang) })}
                    </span>
                  </span>
                </div>
                {!s.current && (
                  <Button variant="ghost" size="sm" loading={one.isPending && one.variables === s.id} onClick={() => one.mutate(s.id)}>
                    {t("Sign out")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default SessionsCard;
