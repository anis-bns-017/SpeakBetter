// apps/web/src/pages/admin/AdminBroadcastPage.tsx
/** Announcements: one message to many people, in their notifications and as a push where they allow it */

import React, { useState } from "react";
import { toast } from "sonner";
import { Bell, Megaphone, Send } from "lucide-react";
import { Button, Field, Input } from "../../components/ui";
import { adminApi, adminError, useAdminAction, useAdminBroadcastInfo, type Audience } from "../../hooks/useAdmin";
import { ActionDialog, AdminTitle, ReasonField } from "../../components/admin/AdminKit";
import { dateTime, formatNumber, panel } from "../../lib/adminFormat";

const AUDIENCES: Array<{ value: Audience; label: string; hint: string }> = [
  { value: "all", label: "Everyone", hint: "Every account that isn't suspended" },
  { value: "active7", label: "Active this week", hint: "Signed in during the last 7 days" },
  { value: "active30", label: "Active this month", hint: "Signed in during the last 30 days" },
  { value: "pro", label: "Pro members", hint: "Paying or given Pro" },
  { value: "free", label: "Free plan", hint: "Everyone without Pro" },
  { value: "staff", label: "The team", hint: "Moderators and admins (good for a test)" },
];

export const AdminBroadcastPage: React.FC = () => {
  const { data } = useAdminBroadcastInfo();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<Audience>("staff");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = useAdminAction(() => adminApi.broadcast({ title: title.trim(), message: message.trim(), link: link.trim() || undefined, audience }));
  const size = data?.audiences[audience];
  const linkBad = !!link.trim() && !/^\/[\w\-/?=&#.%]*$/.test(link.trim());
  const ready = title.trim().length >= 3 && message.trim().length >= 3 && !linkBad;

  return (
    <div className="space-y-5">
      <AdminTitle title="Announcements" subtitle="New features, events or maintenance. Use sparingly: every one lands in people's notifications." />

      <div className="grid gap-5 lg:grid-cols-5">
        <section className={`${panel} space-y-4 p-5 lg:col-span-3`}>
          <Field label="Title" htmlFor="b-title" hint={`${title.length}/80`}>
            <Input id="b-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Weekend speaking marathon" />
          </Field>
          <ReasonField label="Message" value={message} onChange={setMessage} rows={4} max={400} />
          <Field label="Link (optional)" htmlFor="b-link" hint="A page in the app, like /voice or /library" error={linkBad ? "Start with / and stay inside the app" : undefined}>
            <Input id="b-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/voice" invalid={linkBad} />
          </Field>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-200">Who gets it</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {AUDIENCES.map((a) => (
                <label
                  key={a.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm ${audience === a.value ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-400/15" : "border-line hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`}
                >
                  <input type="radio" name="audience" checked={audience === a.value} onChange={() => setAudience(a.value)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
                  <span>
                    <span className="block font-semibold text-slate-900 dark:text-white">
                      {a.label} <span className="font-normal tabular-nums text-slate-500">· {data ? formatNumber(data.audiences[a.value]) : "…"}</span>
                    </span>
                    <span className="block text-xs text-slate-500">{a.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end">
            <Button icon={Send} disabled={!ready} onClick={() => (setError(null), setConfirming(true))}>
              Review and send
            </Button>
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-2">
          <section className={`${panel} p-5`}>
            <p className="t-eyebrow text-slate-500">Preview</p>
            <div className="mt-3 flex gap-3 rounded-2xl border border-line bg-page p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Bell aria-hidden className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{title || "Your title"}</p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{message || "Your message shows here."}</p>
              </div>
            </div>
          </section>
          <section className={`${panel} p-5`}>
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Sent before</h2>
            {!data?.history.length ? (
              <p className="mt-2 text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <p className="text-slate-800 dark:text-slate-200">{h.summary}</p>
                    <p className="text-xs text-slate-500">
                      {h.actorName} · {dateTime(h.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <ActionDialog
        open={confirming}
        title={`Send to ${size === undefined ? "…" : formatNumber(size)} ${size === 1 ? "person" : "people"}?`}
        description={
          <>
            “{title}” goes to <strong>{AUDIENCES.find((a) => a.value === audience)?.label.toLowerCase()}</strong> now. It can't be taken back.
          </>
        }
        confirmLabel="Send announcement"
        busy={send.isPending}
        error={error}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          send.mutate(undefined, {
            onSuccess: (res) => {
              const sent = (res as { data?: { sent?: number } })?.data?.sent ?? 0;
              toast.success(`Sent to ${formatNumber(sent)} ${sent === 1 ? "person" : "people"}`, { icon: <Megaphone className="h-4 w-4" /> });
              setConfirming(false);
              setTitle("");
              setMessage("");
              setLink("");
            },
            onError: (e) => setError(adminError(e)),
          })
        }
      />
    </div>
  );
};

export default AdminBroadcastPage;
