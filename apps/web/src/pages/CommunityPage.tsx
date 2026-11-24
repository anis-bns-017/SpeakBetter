// apps/web/src/pages/CommunityPage.tsx
/**
 * One community: its channels, the posts inside them, its members, and settings for the people who run it. The
 * open channel, post and panel live in the address, so a notification or a shared link lands in the right place.
 */
import React, { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Hash, Loader2, LogOut, Megaphone, Pencil, Plus, Settings, Shield, Trash2, Users, Volume2 } from "lucide-react";
import {
  useCommunity,
  useCreateChannel,
  useDeleteChannel,
  useJoinCommunity,
  useLeaveCommunity,
  useUpdateChannel,
  type Channel,
} from "../hooks/useCommunities";
import { useAuth } from "../contexts/useAuth";
import { ChannelFeed } from "../components/communities/ChannelFeed";
import { MembersPanel } from "../components/communities/MembersPanel";
import { SettingsPanel } from "../components/communities/SettingsPanel";
import { COMMUNITY_TYPES } from "../components/communities/communityTypes";
import { ROLE_LABEL, isAdmin, type MemberRole } from "../lib/communityRoles";
import { tr } from "../i18n/core";

const card = "rounded-3xl border border-line bg-surface shadow-sm";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold border border-line text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors";
const field =
  "w-full mt-1 px-3 py-2.5 rounded-xl border border-line bg-surface text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

const ChannelIcon: React.FC<{ type: Channel["type"]; className?: string }> = ({ type, className }) =>
  type === "VOICE" ? <Volume2 className={className} aria-hidden /> : type === "ANNOUNCEMENT" ? <Megaphone className={className} aria-hidden /> : <Hash className={className} aria-hidden />;

/** Creates a channel, or edits the one given */
const ChannelModal: React.FC<{ communityId: string; channel?: Channel; onClose: () => void; onCreated: (id: string) => void }> = ({ communityId, channel, onClose, onCreated }) => {
  const create = useCreateChannel();
  const update = useUpdateChannel();
  const [name, setName] = useState(channel?.name ?? "");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [type, setType] = useState<string>("TEXT");
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) {
      toast.error(tr("Channel name cannot be empty"));
      return;
    }
    try {
      if (channel) {
        await update.mutateAsync({ communityId, channelId: channel.id, data: { name: clean, description: description.trim() } });
      } else {
        const made = await create.mutateAsync({ communityId, data: { name: clean, description: description.trim(), type } });
        onCreated(made.id);
      }
      onClose();
    } catch {
      // The mutation shows its own toast
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={channel ? tr("Edit channel") : tr("Create Channel")} className={`${card} w-full max-w-md p-5`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{channel ? tr("Edit channel") : tr("Create Channel")}</h3>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {tr("Channel Name")}
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={tr("e.g. general-chat")} required autoFocus />
          </label>
          {!channel && (
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {tr("Type")}
              <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="TEXT">{tr("Text")}</option>
                <option value="ANNOUNCEMENT">{tr("Announcements")}</option>
                <option value="VOICE">{tr("Voice")}</option>
              </select>
            </label>
          )}
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {tr("Description")}
            <textarea className={`${field} resize-none`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={ghostBtn}>{tr("Cancel")}</button>
            <button type="submit" className={primaryBtn} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} {channel ? tr("Save changes") : tr("Create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Message: React.FC<{ title: string; body: string; icon?: boolean }> = ({ title, body, icon }) => (
  <div className={`${card} max-w-md mx-auto mt-16 p-8 text-center space-y-3`}>
    {icon && <Shield className="w-10 h-10 mx-auto text-indigo-500" aria-hidden />}
    <h2 className="text-xl font-bold text-slate-900 dark:text-white break-words">{title}</h2>
    {body && <p className="text-sm text-slate-600 dark:text-slate-300 break-words">{body}</p>}
    <Link to="/communities" className={primaryBtn}>{tr("Back to Communities")}</Link>
  </div>
);

export const CommunityPage = () => {
  const { communityId } = useParams<{ communityId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: community, isLoading, isError, error } = useCommunity(communityId || "");
  const joinCommunity = useJoinCommunity();
  const leaveCommunity = useLeaveCommunity();
  const deleteChannel = useDeleteChannel();
  const [modal, setModal] = useState<{ channel?: Channel } | null>(null);

  const go = (next: { channel?: string | null; thread?: string | null; panel?: string | null }) => {
    const out = new URLSearchParams();
    if (next.channel) out.set("channel", next.channel);
    if (next.thread) out.set("thread", next.thread);
    if (next.panel) out.set("panel", next.panel);
    setParams(out);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24" role="status">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" aria-label={tr("Loading community...")} />
      </div>
    );
  }
  if (isError || !community) {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    return status === 403 ? (
      <Message icon title={tr("This community is invite only")} body={tr("Ask a member for an invite link.")} />
    ) : (
      <Message title={tr("Community Not Found")} body={tr("The community you are looking for doesn't exist or may have been deleted.")} />
    );
  }

  const viewer = community.viewer;
  const isMember = !!viewer?.isMember;
  const role = viewer?.role ?? null;
  const admin = isAdmin(role);
  const isOwner = role === "OWNER";

  if (!isMember && community.type === "RESTRICTED") {
    return <Message icon title={community.name} body={`${community.description ? `${community.description} ` : ""}${tr("This community is invite only. Ask a member for an invite link.")}`} />;
  }

  const channels = community.channels.filter((c) => c.type !== "CATEGORY");
  const channel = channels.find((c) => c.id === params.get("channel")) ?? null;
  const threadId = params.get("thread");
  const requested = params.get("panel");
  const panel = requested === "members" ? "members" : requested === "settings" && admin ? "settings" : null;
  const showingDetail = !!channel || !!panel;
  const typeInfo = COMMUNITY_TYPES.find((t) => t.id === community.type);
  const memberCount = community._count?.members ?? community.members.length;

  const join = () => joinCommunity.mutate(community.id);

  const leave = async () => {
    if (!window.confirm(tr("Are you sure you want to leave this community?"))) return;
    try {
      await leaveCommunity.mutateAsync(community.id);
      navigate("/communities");
    } catch {
      // The mutation shows its own toast
    }
  };

  const removeChannel = async (target: Channel) => {
    if (!window.confirm(tr("Delete #{name} and everything in it?", { name: target.name }))) return;
    try {
      await deleteChannel.mutateAsync({ communityId: community.id, channelId: target.id });
      if (channel?.id === target.id) go({});
    } catch {
      // The mutation shows its own toast
    }
  };

  const channelRow = "group flex items-center rounded-xl transition-colors";
  const rowButton = (active: boolean) =>
    `flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 min-h-10 rounded-xl text-sm text-left ${
      active ? "bg-indigo-50 text-indigo-800 font-semibold dark:bg-indigo-500/15 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
    }`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-4">
      <Link to="/communities" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" aria-hidden /> {tr("Communities")}
      </Link>

      <header className={`${card} p-5 flex flex-wrap items-center gap-3`}>
        {community.avatarUrl ? (
          <img src={community.avatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
        ) : (
          <span className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shrink-0" aria-hidden>
            {community.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1 basis-48">
          <h1 className="text-[24px] sm:text-[28px] leading-tight font-semibold text-slate-900 dark:text-white break-words">{community.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {typeInfo ? tr(typeInfo.label) : community.type} · {tr("{count} members", { count: memberCount })}
            {role && <> · {tr(ROLE_LABEL[role as MemberRole] ?? ROLE_LABEL.MEMBER)}</>}
          </p>
          {community.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">{community.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isMember &&
            (viewer?.banned ? (
              <span className="text-sm text-rose-600 dark:text-rose-400">{tr("You are banned from this community")}</span>
            ) : (
              <button type="button" className={primaryBtn} onClick={join} disabled={joinCommunity.isPending}>
                {joinCommunity.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} {tr("Join")}
              </button>
            ))}
          {admin && (
            <button type="button" className={ghostBtn} aria-pressed={panel === "settings"} onClick={() => go({ panel: "settings" })}>
              <Settings className="w-4 h-4" aria-hidden /> {tr("Settings")}
            </button>
          )}
          {isMember && !isOwner && (
            <button type="button" className={`${ghostBtn} text-rose-600 dark:text-rose-400`} onClick={() => void leave()} disabled={leaveCommunity.isPending}>
              <LogOut className="w-4 h-4" aria-hidden /> {tr("Leave")}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[250px_minmax(0,1fr)] items-start">
        {/* On a phone the list and what is open take turns */}
        <aside className={`${card} p-3 ${showingDetail ? "hidden md:block" : ""}`}>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{tr("Channels")}</h2>
            {admin && (
              <button type="button" onClick={() => setModal({})} aria-label={tr("Create channel")} title={tr("Create channel")} className="h-8 w-8 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                <Plus className="w-4 h-4" aria-hidden />
              </button>
            )}
          </div>
          <ul className="space-y-0.5">
            {channels.map((c) => (
              <li key={c.id} className={channelRow}>
                <button type="button" className={rowButton(channel?.id === c.id)} aria-current={channel?.id === c.id ? "true" : undefined} onClick={() => go({ channel: c.id })}>
                  <ChannelIcon type={c.type} className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="truncate">{c.name}</span>
                </button>
                {admin && (
                  <button type="button" onClick={() => void removeChannel(c)} aria-label={tr("Delete #{name}", { name: c.name })} className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
            {channels.length === 0 && <li className="px-2.5 py-2 text-sm text-slate-500">{tr("No channels yet")}</li>}
          </ul>
          <div className="mt-2 pt-2 border-t border-line">
            <button type="button" className={rowButton(panel === "members")} style={{ width: "100%" }} onClick={() => go({ panel: "members" })}>
              <Users className="w-4 h-4 shrink-0 opacity-70" aria-hidden />
              <span className="flex-1">{tr("Members")}</span>
              <span className="text-xs tabular-nums opacity-70">{memberCount}</span>
            </button>
          </div>
        </aside>

        <section className={`${card} p-4 sm:p-5 min-h-[320px] ${showingDetail ? "" : "hidden md:block"}`}>
          {showingDetail && !threadId && (
            <button type="button" onClick={() => go({})} className="md:hidden mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <ArrowLeft className="w-4 h-4" aria-hidden /> {tr("Channels")}
            </button>
          )}

          {panel === "members" ? (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{tr("Members")}</h2>
              <MembersPanel community={community} myId={user?.id} />
            </>
          ) : panel === "settings" ? (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{tr("Settings")}</h2>
              <SettingsPanel community={community} />
            </>
          ) : channel ? (
            <>
              {!threadId && (
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5 max-w-full">
                      <ChannelIcon type={channel.type} className="w-4 h-4 shrink-0 text-slate-400" />
                      <span className="truncate">{channel.name}</span>
                    </h2>
                    {channel.description && <p className="text-sm text-slate-500">{channel.description}</p>}
                  </div>
                  {admin && (
                    <button type="button" className={`${ghostBtn} shrink-0`} onClick={() => setModal({ channel })} aria-label={tr("Edit channel")}>
                      <Pencil className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                </div>
              )}
              {isMember ? (
                <ChannelFeed key={channel.id} channel={channel} role={role} myId={user?.id} threadId={threadId} onOpenThread={(id) => go({ channel: channel.id, thread: id })} />
              ) : (
                <div className="py-10 text-center space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-300">{tr("Join this community to read and write posts.")}</p>
                  {!viewer?.banned && <button type="button" className={primaryBtn} onClick={join} disabled={joinCommunity.isPending}>{tr("Join")}</button>}
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center">
              <Hash className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" aria-hidden />
              <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{tr("Welcome to")} {community.name}</h3>
              <p className="text-sm text-slate-500">{tr("Choose a channel to read and join in.")}</p>
            </div>
          )}
        </section>
      </div>

      {modal && (
        <ChannelModal
          key={modal.channel?.id ?? "new"}
          communityId={community.id}
          channel={modal.channel}
          onClose={() => setModal(null)}
          onCreated={(id) => go({ channel: id })}
        />
      )}
    </div>
  );
};
