// apps/web/src/components/communities/ChannelFeed.tsx
/**
 * What is inside a channel. Text and announcement channels hold posts with replies; a voice channel points people
 * to the voice rooms, because rooms are not tied to a community.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Flag, Loader2, Lock, MessageSquare, Pin, PinOff, Plus, Send, Trash2, Unlock, Volume2 } from "lucide-react";
import {
  useCreateThread,
  useDeleteReply,
  useDeleteThread,
  useReplyToThread,
  useReportPost,
  useThread,
  useThreads,
  useUpdateThread,
  type Channel,
} from "../../hooks/useCommunities";
import { isModerator } from "../../lib/communityRoles";
import { PersonAvatar } from "./PersonAvatar";
import { msg, tr } from "../../i18n/core";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-line text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors disabled:opacity-50";
const field =
  "w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const Spinner = () => (
  <div className="flex justify-center py-12" role="status">
    <Loader2 className="w-6 h-6 animate-spin text-slate-400" aria-label={tr("Loading")} />
  </div>
);

const REPORT_REASONS = [
  { id: "HARASSMENT", label: msg("Harassment or bullying") },
  { id: "HATE", label: msg("Hate speech") },
  { id: "SEXUAL", label: msg("Sexual content") },
  { id: "SPAM", label: msg("Spam or selling") },
  { id: "OTHER", label: msg("Something else") },
];

/** Tells the SpeakBetter team about a post or reply */
const ReportDialog: React.FC<{ target: { kind: "thread" | "reply"; id: string }; onClose: () => void }> = ({ target, onClose }) => {
  const report = useReportPost();
  const [reason, setReason] = useState(REPORT_REASONS[0].id);
  const [details, setDetails] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await report.mutateAsync({ ...target, reason, details: details.trim() || undefined });
      onClose();
    } catch {
      // The mutation shows its own toast
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={tr("Report this to the SpeakBetter team")}
        onSubmit={send}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-sm space-y-3"
      >
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{tr("Report this to the SpeakBetter team")}</h3>
        <select className={field} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={tr("What is wrong?")}>
          {REPORT_REASONS.map((r) => (
            <option key={r.id} value={r.id}>{tr(r.label)}</option>
          ))}
        </select>
        <textarea className={`${field} resize-none`} rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={tr("Anything else we should know? (optional)")} aria-label={tr("Anything else we should know? (optional)")} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>{tr("Cancel")}</button>
          <button type="submit" className={primaryBtn} disabled={report.isPending}>
            {report.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} {tr("Send report")}
          </button>
        </div>
      </form>
    </div>
  );
};

const NewPost: React.FC<{ channelId: string; onDone: () => void }> = ({ channelId, onDone }) => {
  const create = useCreateThread();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || create.isPending) return;
    try {
      await create.mutateAsync({ channelId, data: { title: title.trim(), content: content.trim() || undefined } });
      onDone();
    } catch {
      // The mutation shows its own toast
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line p-4 space-y-3">
      <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={tr("Title")} aria-label={tr("Title")} required autoFocus />
      <textarea className={`${field} resize-none`} value={content} onChange={(e) => setContent(e.target.value)} maxLength={4000} rows={4} placeholder={tr("What do you want to say?")} aria-label={tr("What do you want to say?")} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={ghostBtn}>{tr("Cancel")}</button>
        <button type="submit" className={primaryBtn} disabled={!title.trim() || create.isPending}>
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />} {tr("Post")}
        </button>
      </div>
    </form>
  );
};

const PostView: React.FC<{ threadId: string; channelId: string; myId?: string; onBack: () => void }> = ({ threadId, channelId, myId, onBack }) => {
  const { data: thread, isLoading, isError } = useThread(threadId);
  const reply = useReplyToThread();
  const update = useUpdateThread();
  const removePost = useDeleteThread();
  const removeReply = useDeleteReply();
  const [text, setText] = useState("");
  const [reporting, setReporting] = useState<{ kind: "thread" | "reply"; id: string } | null>(null);

  if (isLoading) return <Spinner />;
  if (isError || !thread) {
    return (
      <div className="py-10 text-center text-sm text-slate-500 space-y-3">
        <p>{tr("This post is no longer here.")}</p>
        <button type="button" onClick={onBack} className={ghostBtn}><ArrowLeft className="w-3.5 h-3.5" aria-hidden /> {tr("Back to posts")}</button>
      </div>
    );
  }

  const canModerate = !!thread.viewer?.canModerate;
  const canDeletePost = canModerate || thread.authorId === myId;
  const canReply = !thread.isLocked || canModerate;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || reply.isPending) return;
    try {
      await reply.mutateAsync({ threadId, channelId, content });
      setText("");
    } catch {
      // The mutation shows its own toast
    }
  };

  const deletePost = async () => {
    if (!window.confirm(tr("Delete this post and its replies?"))) return;
    try {
      await removePost.mutateAsync({ threadId, channelId });
      onBack();
    } catch {
      // The mutation shows its own toast
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" aria-hidden /> {tr("Back to posts")}
      </button>

      <article className="rounded-2xl border border-line p-4">
        <div className="flex items-center gap-2.5">
          <PersonAvatar name={thread.author.name} url={thread.author.avatarUrl} />
          <div className="min-w-0">
            <Link to={`/u/${thread.author.id}`} className="block text-sm font-semibold text-slate-900 dark:text-white truncate hover:underline">{thread.author.name}</Link>
            <p className="text-xs text-slate-500">{when(thread.createdAt)}</p>
          </div>
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white break-words">{thread.title}</h3>
        {thread.content && <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{thread.content}</p>}

        {(canModerate || canDeletePost || thread.authorId !== myId) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {canModerate && (
              <>
                <button type="button" className={ghostBtn} aria-pressed={thread.isPinned} disabled={update.isPending} onClick={() => update.mutate({ threadId, channelId, data: { isPinned: !thread.isPinned } })}>
                  {thread.isPinned ? <PinOff className="w-3.5 h-3.5" aria-hidden /> : <Pin className="w-3.5 h-3.5" aria-hidden />}
                  {thread.isPinned ? tr("Unpin") : tr("Pin")}
                </button>
                <button type="button" className={ghostBtn} aria-pressed={thread.isLocked} disabled={update.isPending} onClick={() => update.mutate({ threadId, channelId, data: { isLocked: !thread.isLocked } })}>
                  {thread.isLocked ? <Unlock className="w-3.5 h-3.5" aria-hidden /> : <Lock className="w-3.5 h-3.5" aria-hidden />}
                  {thread.isLocked ? tr("Unlock") : tr("Lock")}
                </button>
              </>
            )}
            {canDeletePost && (
              <button type="button" className={`${ghostBtn} text-rose-600 dark:text-rose-400`} disabled={removePost.isPending} onClick={() => void deletePost()}>
                <Trash2 className="w-3.5 h-3.5" aria-hidden /> {tr("Delete")}
              </button>
            )}
            {thread.authorId !== myId && (
              <button type="button" className={ghostBtn} onClick={() => setReporting({ kind: "thread", id: thread.id })}>
                <Flag className="w-3.5 h-3.5" aria-hidden /> {tr("Report")}
              </button>
            )}
          </div>
        )}
      </article>

      <section aria-label={tr("Replies")} className="space-y-2">
        {thread.messages.length === 0 && <p className="text-sm text-slate-500 text-center py-3">{tr("No replies yet.")}</p>}
        {thread.messages.map((m) => (
          <div key={m.id} className="flex gap-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] p-3">
            <PersonAvatar name={m.author.name} url={m.author.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <Link to={`/u/${m.author.id}`} className="font-semibold text-slate-900 dark:text-white hover:underline">{m.author.name}</Link>
                <span className="text-slate-500"> · {when(m.createdAt)}</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{m.content}</p>
            </div>
            {m.authorId !== myId && (
              <button
                type="button"
                aria-label={tr("Report this reply")}
                className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                onClick={() => setReporting({ kind: "reply", id: m.id })}
              >
                <Flag className="w-3.5 h-3.5" aria-hidden />
              </button>
            )}
            {(canModerate || m.authorId === myId) && (
              <button
                type="button"
                aria-label={tr("Delete reply")}
                className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                onClick={() => {
                  if (window.confirm(tr("Delete this reply?"))) removeReply.mutate({ messageId: m.id, threadId, channelId });
                }}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </button>
            )}
          </div>
        ))}
      </section>

      {canReply ? (
        <form onSubmit={send} className="flex items-end gap-2">
          <textarea
            className={`${field} resize-none`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send(e);
            }}
            maxLength={2000}
            rows={2}
            placeholder={tr("Write a reply")}
            aria-label={tr("Write a reply")}
          />
          <button type="submit" className={`${primaryBtn} shrink-0`} disabled={!text.trim() || reply.isPending} aria-label={tr("Send reply")}>
            {reply.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500 text-center inline-flex w-full items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" aria-hidden /> {tr("This post is locked.")}
        </p>
      )}

      {reporting && <ReportDialog target={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
};

export const ChannelFeed: React.FC<{
  channel: Channel;
  role: string | null;
  myId?: string;
  threadId: string | null;
  onOpenThread: (id: string | null) => void;
}> = ({ channel, role, myId, threadId, onOpenThread }) => {
  const isVoice = channel.type === "VOICE";
  const { data: threads, isLoading, isError, refetch } = useThreads(isVoice ? "" : channel.id);
  const [composing, setComposing] = useState(false);

  if (isVoice) {
    return (
      <div className="py-10 text-center space-y-3">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300 flex items-center justify-center">
          <Volume2 className="w-6 h-6" aria-hidden />
        </span>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
          {tr("Voice rooms are separate from communities. Start a room, copy its link, and post it in a text channel so people can join you.")}
        </p>
        <Link to="/voice" className={primaryBtn}>{tr("Open voice rooms")} <ArrowRight className="w-4 h-4" aria-hidden /></Link>
      </div>
    );
  }

  if (threadId) return <PostView key={threadId} threadId={threadId} channelId={channel.id} myId={myId} onBack={() => onOpenThread(null)} />;

  const canPost = channel.type === "TEXT" || isModerator(role);

  return (
    <div className="space-y-3">
      {composing ? (
        <NewPost channelId={channel.id} onDone={() => setComposing(false)} />
      ) : canPost ? (
        <div className="flex justify-end">
          <button type="button" className={primaryBtn} onClick={() => setComposing(true)}>
            <Plus className="w-4 h-4" aria-hidden /> {tr("New post")}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">{tr("Only the people who run this community post here. Everyone can reply.")}</p>
      )}

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <div className="py-8 text-center text-sm text-slate-500 space-y-3">
          <p>{tr("Couldn't load the posts.")}</p>
          <button type="button" className={ghostBtn} onClick={() => void refetch()}>{tr("Try again")}</button>
        </div>
      ) : !threads?.length ? (
        <div className="py-10 text-center">
          <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{tr("No posts yet")}</p>
          {canPost && <p className="text-sm text-slate-500">{tr("Be the first to say something.")}</p>}
        </div>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onOpenThread(t.id)} className="w-full text-left rounded-2xl border border-line p-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                <span className="flex items-start gap-2.5">
                  <PersonAvatar name={t.author.name} url={t.author.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {t.isPinned && <Pin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300 shrink-0" aria-label={tr("Pinned")} />}
                      {t.isLocked && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-label={tr("Locked")} />}
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t.title}</span>
                    </span>
                    {t.content && <span className="block text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">{t.content}</span>}
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      {t.author.name} · {when(t.createdAt)} · <MessageSquare className="w-3 h-3" aria-hidden /> {t._count?.messages ?? 0}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
