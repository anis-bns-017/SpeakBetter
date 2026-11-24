// apps/web/src/components/communities/SettingsPanel.tsx
/** Invite links for admins; the community's details and deleting it for the owner. */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Link2, Loader2, Trash2 } from "lucide-react";
import {
  useCreateInvite,
  useDeleteCommunity,
  useInvites,
  useRevokeInvite,
  useUpdateCommunity,
  type Community,
} from "../../hooks/useCommunities";
import { COMMUNITY_TYPES } from "./communityTypes";
import { isAdmin } from "../../lib/communityRoles";
import { tr } from "../../i18n/core";

const field =
  "w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors";

const INVITE_DAYS = 7;
const linkFor = (code: string) => `${window.location.origin}/communities/join/${code}`;

const copyLink = async (code: string) => {
  try {
    await navigator.clipboard.writeText(linkFor(code));
    toast.success(tr("Invite link copied"));
  } catch {
    toast.error(tr("Couldn't copy. Select the link and copy it yourself."));
  }
};

const Invites: React.FC<{ communityId: string }> = ({ communityId }) => {
  const { data: invites, isLoading } = useInvites(communityId);
  const create = useCreateInvite();
  const revoke = useRevokeInvite();

  const makeLink = async () => {
    try {
      const invite = await create.mutateAsync({
        communityId,
        data: { expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString() },
      });
      await copyLink(invite.code);
    } catch {
      // The mutation shows its own toast
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Invite links")}</h3>
          <p className="text-xs text-slate-500">{tr("Anyone with a link can join for {days} days.", { days: INVITE_DAYS })}</p>
        </div>
        <button type="button" className={primaryBtn} disabled={create.isPending} onClick={() => void makeLink()}>
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Link2 className="w-4 h-4" aria-hidden />} {tr("Create link")}
        </button>
      </div>
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" aria-label={tr("Loading")} />
      ) : (
        <ul className="space-y-1.5">
          {invites?.map((i) => (
            <li key={i.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">{linkFor(i.code)}</p>
                <p className="text-[11px] text-slate-500">
                  {tr("Used {uses} times", { uses: i.uses })}
                  {i.expiresAt && <> · {tr("ends {date}", { date: new Date(i.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) })}</>}
                </p>
              </div>
              <button type="button" aria-label={tr("Copy link")} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]" onClick={() => void copyLink(i.code)}>
                <Copy className="w-4 h-4" aria-hidden />
              </button>
              <button type="button" aria-label={tr("Cancel this link")} disabled={revoke.isPending} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={() => revoke.mutate({ communityId, inviteId: i.id })}>
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Details: React.FC<{ community: Community }> = ({ community }) => {
  const update = useUpdateCommunity();
  const remove = useDeleteCommunity();
  const navigate = useNavigate();
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  const [type, setType] = useState<Community["type"]>(community.type);
  const changed = name.trim() !== community.name || description.trim() !== (community.description ?? "") || type !== community.type;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changed || name.trim().length < 2) return;
    update.mutate({ communityId: community.id, data: { name: name.trim(), description: description.trim(), type } });
  };

  const deleteIt = async () => {
    const typed = window.prompt(tr("This deletes all channels and posts for good. Type the community's name to confirm."));
    if (typed === null) return;
    if (typed.trim() !== community.name) {
      toast.error(tr("The name didn't match, so nothing was deleted."));
      return;
    }
    try {
      await remove.mutateAsync(community.id);
      navigate("/communities", { replace: true });
    } catch {
      // The mutation shows its own toast
    }
  };

  return (
    <>
      <form onSubmit={save} className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Details")}</h3>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          {tr("Name")}
          <input className={`${field} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          {tr("Description")}
          <textarea className={`${field} mt-1 resize-none`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{tr("Who can join")}</legend>
          {COMMUNITY_TYPES.map((t) => (
            <label key={t.id} className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${type === t.id ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10" : "border-line"}`}>
              <input type="radio" name="community-type" className="mt-0.5" checked={type === t.id} onChange={() => setType(t.id)} />
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{tr(t.label)}</span>
                <span className="block text-xs text-slate-500">{tr(t.help)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end">
          <button type="submit" className={primaryBtn} disabled={!changed || name.trim().length < 2 || update.isPending}>
            {update.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} {tr("Save changes")}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-rose-200 dark:border-rose-500/30 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">{tr("Delete community")}</h3>
          <p className="text-xs text-slate-500">{tr("All channels, posts and members are removed. This can't be undone.")}</p>
        </div>
        <button type="button" disabled={remove.isPending} onClick={() => void deleteIt()} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50">
          <Trash2 className="w-4 h-4" aria-hidden /> {tr("Delete")}
        </button>
      </section>
    </>
  );
};

export const SettingsPanel: React.FC<{ community: Community }> = ({ community }) => {
  const role = community.viewer?.role;
  return (
    <div className="space-y-6">
      {isAdmin(role) && <Invites communityId={community.id} />}
      {role === "OWNER" && <Details key={community.updatedAt ?? community.id} community={community} />}
    </div>
  );
};
