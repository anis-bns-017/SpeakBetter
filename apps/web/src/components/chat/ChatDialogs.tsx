// apps/web/src/components/chat/ChatDialogs.tsx
// Dialogs for the premium chat features: forward, message info, chat lock PIN,
// report, privacy settings and scheduling.
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  X,
  Search,
  Check,
  Send,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  CheckCheck,
  Clock,
  Flag,
  Shield,
  KeyRound,
  CalendarClock,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import {
  apiErrorMessage,
  chatApi,
  useChatPrivacy,
  useChats,
  type Chat,
  type ChatPrivacySettings,
} from "../../hooks/useChat";

// ─── Shared options ───────────────────────────────────────────────

export const MUTE_OPTIONS: Array<{ label: string; value: () => string }> = [
  { label: "8 hours", value: () => new Date(Date.now() + 8 * 3600_000).toISOString() },
  { label: "1 week", value: () => new Date(Date.now() + 7 * 24 * 3600_000).toISOString() },
  { label: "Always", value: () => "always" },
];

export const DISAPPEARING_CHOICES = [
  { seconds: 0, label: "Off" },
  { seconds: 24 * 3600, label: "24 hours" },
  { seconds: 7 * 24 * 3600, label: "7 days" },
  { seconds: 90 * 24 * 3600, label: "90 days" },
];

export const disappearingLabel = (seconds?: number | null) =>
  DISAPPEARING_CHOICES.find((c) => c.seconds === (seconds || 0))?.label ?? "Off";

/** Display name for a chat from my point of view */
export function chatDisplayName(chat: Chat, myId?: string) {
  if (chat.type === "PRIVATE") {
    return chat.participants.find((p) => p.userId !== myId)?.user?.name || "Unknown";
  }
  return chat.name || "Group Chat";
}

// ─── Modal shell ──────────────────────────────────────────────────

export const ChatModal: React.FC<{
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ title, icon, onClose, children, footer }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-w-md sm:rounded-3xl dark:bg-slate-900 dark:ring-white/10"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          {icon && <span className="text-indigo-500">{icon}</span>}
          <h3 className="flex-1 text-[15px] font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const primaryButton =
  "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";
const inputClass =
  "w-full rounded-xl border-0 bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-1 ring-slate-200/60 transition focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700";

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
      checked ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"
    }`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
    />
  </button>
);

// ─── Forward ──────────────────────────────────────────────────────

export const ForwardDialog: React.FC<{ messageIds: string[]; onClose: () => void; onForwarded?: () => void }> = ({
  messageIds,
  onClose,
  onForwarded,
}) => {
  const { user } = useAuth();
  const { data: chats = [] } = useChats();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((c) => !q || chatDisplayName(c, user?.id).toLowerCase().includes(q));
  }, [chats, query, user?.id]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.add(id);
      else toast.info("You can forward to up to 10 chats at once");
      return next;
    });

  const forward = async () => {
    setSending(true);
    try {
      const { data } = await chatApi.forwardMessages(messageIds, [...selected]);
      toast.success(
        `Forwarded to ${data.chatIds.length} chat${data.chatIds.length === 1 ? "" : "s"}` +
          (data.failed ? ` (${data.failed} couldn't be sent)` : ""),
      );
      onForwarded?.();
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't forward"));
    } finally {
      setSending(false);
    }
  };

  return (
    <ChatModal
      title={`Forward ${messageIds.length > 1 ? `${messageIds.length} messages` : "message"}`}
      icon={<Send className="h-4 w-4" />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!selected.size || sending} onClick={forward}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Forward{selected.size ? ` (${selected.size})` : ""}
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          className={`${inputClass} pl-9`}
        />
      </div>
      <div className="space-y-1">
        {filtered.map((chat) => {
          const name = chatDisplayName(chat, user?.id);
          const isOn = selected.has(chat.id);
          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => toggle(chat.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                isOn ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {name}
                {chat.isLocked && <Lock className="ml-1.5 inline h-3 w-3 text-slate-400" />}
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                  isOn ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {isOn && <Check className="h-3 w-3" />}
              </span>
            </button>
          );
        })}
        {!filtered.length && <p className="py-6 text-center text-sm text-slate-400">No chats found</p>}
      </div>
    </ChatModal>
  );
};

// ─── Message info ─────────────────────────────────────────────────

export const MessageInfoDialog: React.FC<{ messageId: string; onClose: () => void }> = ({ messageId, onClose }) => {
  const { data: info, isLoading, error } = useQuery({
    queryKey: ["message-info", messageId],
    queryFn: async () => (await chatApi.getMessageInfo(messageId)).data,
  });

  const row = (icon: React.ReactNode, label: string, value?: string | null) => (
    <div className="flex items-center gap-3 py-2">
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {value ? format(new Date(value), "MMM d, HH:mm") : "—"}
      </span>
    </div>
  );

  return (
    <ChatModal title="Message info" icon={<CheckCheck className="h-4 w-4" />} onClose={onClose}>
      {isLoading && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-indigo-500" />}
      {error && <p className="py-4 text-sm text-red-500">{apiErrorMessage(error, "Couldn't load message info")}</p>}
      {info && (
        <div className="space-y-4">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {row(<Check className="h-4 w-4" />, "Sent", info.sentAt)}
            {row(<CheckCheck className="h-4 w-4" />, "Delivered", info.deliveredAt)}
            {info.editedAt && row(<Clock className="h-4 w-4" />, "Last edited", info.editedAt)}
            {info.expiresAt && (
              <div className="flex items-center gap-3 py-2">
                <Timer className="h-4 w-4 text-slate-400" />
                <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">Disappears</span>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {formatDistanceToNow(new Date(info.expiresAt), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-500">
              <CheckCheck className="h-3.5 w-3.5" /> Read by
            </h4>
            {info.receiptsHidden ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                You turned off read receipts, so you can't see who read your messages.
              </p>
            ) : info.readBy.length ? (
              <div className="space-y-1.5">
                {info.readBy.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" /> : r.name.charAt(0)}
                    </span>
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-100">{r.name}</span>
                    <span className="text-xs text-slate-400">{format(new Date(r.readAt), "MMM d, HH:mm")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Not read yet. People who turned off read receipts never show here.
              </p>
            )}
          </div>

          {info.viewedBy && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Eye className="h-3.5 w-3.5" /> View once
              </h4>
              <p className="text-xs text-slate-500">
                {info.viewedBy.length
                  ? `Opened ${formatDistanceToNow(new Date(info.viewedBy[info.viewedBy.length - 1].at), { addSuffix: true })}`
                  : "Not opened yet"}
              </p>
            </div>
          )}
        </div>
      )}
    </ChatModal>
  );
};

// ─── Chat lock ────────────────────────────────────────────────────

const PinInput: React.FC<{ value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }> = ({
  value,
  onChange,
  label,
  autoFocus,
}) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className={`${inputClass} text-center text-lg tracking-[0.5em]`}
    />
  </label>
);

/** Shown instead of the messages of a locked chat until the PIN is entered */
export const ChatLockGate: React.FC<{ chatName: string; onUnlock: () => void }> = ({ chatName, onUnlock }) => {
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    setChecking(true);
    try {
      await chatApi.verifyPin(pin);
      onUnlock();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Wrong PIN"));
      setPin("");
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex h-full max-w-xs flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 shadow-inner dark:from-indigo-500/20 dark:to-violet-500/20">
        <Lock className="h-7 w-7" />
      </span>
      <div>
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{chatName} is locked</p>
        <p className="mt-1 text-xs text-slate-500">Enter your chat lock PIN to open it</p>
      </div>
      <div className="w-full">
        <PinInput value={pin} onChange={setPin} label="PIN" autoFocus />
      </div>
      <button type="submit" disabled={pin.length < 4 || checking} className={`${primaryButton} w-full justify-center`}>
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Unlock
      </button>
    </form>
  );
};

/** Set, change or remove the chat lock PIN */
export const ChatPinDialog: React.FC<{ hasPin: boolean; onClose: () => void; onSaved?: () => void }> = ({
  hasPin,
  onClose,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"set" | "remove">("set");
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } =
        mode === "remove" ? await chatApi.removePin(current) : await chatApi.setPin(pin, hasPin ? current : undefined);
      queryClient.setQueryData<ChatPrivacySettings>(["chat-privacy"], data);
      if (mode === "remove") queryClient.invalidateQueries({ queryKey: ["chats"] });
      toast.success(mode === "remove" ? "Chat lock PIN removed — locked chats are unlocked" : "Chat lock PIN saved");
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't save the PIN"));
    } finally {
      setSaving(false);
    }
  };

  const valid =
    mode === "remove"
      ? current.length >= 4
      : pin.length >= 4 && pin === confirm && (!hasPin || current.length >= 4);

  return (
    <ChatModal
      title={hasPin ? "Chat lock PIN" : "Set a chat lock PIN"}
      icon={<KeyRound className="h-4 w-4" />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid || saving} onClick={save}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "remove" ? "Remove PIN" : "Save PIN"}
          </button>
        </>
      }
    >
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Locked chats hide their previews and need this 4–6 digit PIN to open.
      </p>
      {hasPin && (
        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(["set", "remove"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                mode === m ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-900" : "text-slate-500"
              }`}
            >
              {m === "set" ? "Change PIN" : "Remove PIN"}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {hasPin && <PinInput value={current} onChange={setCurrent} label="Current PIN" autoFocus />}
        {mode === "set" && (
          <>
            <PinInput value={pin} onChange={setPin} label="New PIN" autoFocus={!hasPin} />
            <PinInput value={confirm} onChange={setConfirm} label="Confirm new PIN" />
            {confirm.length >= 4 && pin !== confirm && <p className="text-xs text-red-500">PINs don't match</p>}
          </>
        )}
      </div>
    </ChatModal>
  );
};

// ─── Report ───────────────────────────────────────────────────────

const REPORT_REASONS = ["Spam", "Harassment or bullying", "Inappropriate content", "Scam or fraud", "Other"];

export const ReportDialog: React.FC<{
  target: { type: "USER" | "MESSAGE"; id: string; label: string };
  onClose: () => void;
}> = ({ target, onClose }) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await chatApi.report({
        targetType: target.type,
        targetId: target.id,
        reason,
        description: details.trim() || undefined,
      });
      toast.success("Thanks — our team will review this report");
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't send the report"));
    } finally {
      setSending(false);
    }
  };

  return (
    <ChatModal
      title={`Report ${target.label}`}
      icon={<Flag className="h-4 w-4 text-red-500" />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Report
          </button>
        </>
      }
    >
      <div className="space-y-1.5">
        {REPORT_REASONS.map((r) => (
          <label
            key={r}
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <input
              type="radio"
              name="report-reason"
              checked={reason === r}
              onChange={() => setReason(r)}
              className="accent-red-500"
            />
            {r}
          </label>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Anything else we should know? (optional)"
        className={`${inputClass} mt-3 resize-none`}
      />
    </ChatModal>
  );
};

// ─── Privacy settings ─────────────────────────────────────────────

const PRIVACY_ROWS: Array<{
  key: keyof Omit<ChatPrivacySettings, "hasChatLockPin">;
  title: string;
  description: string;
}> = [
  {
    key: "showOnlineStatus",
    title: "Online status",
    description: "Show when you're online. If off, you won't see when others are online either.",
  },
  {
    key: "showLastSeen",
    title: "Last seen",
    description: "Show when you were last active. If off, you won't see other people's last seen.",
  },
  {
    key: "sendReadReceipts",
    title: "Read receipts",
    description: "Show blue ticks when you read messages. If off, you won't see them from others.",
  },
  {
    key: "showTypingIndicator",
    title: "Typing indicator",
    description: "Show \"typing…\" while you write. If off, you won't see others typing.",
  },
];

export const ChatPrivacyDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: privacy, isLoading, update } = useChatPrivacy();
  const [showPin, setShowPin] = useState(false);

  return (
    <>
      <ChatModal title="Chat privacy" icon={<Shield className="h-4 w-4" />} onClose={onClose}>
        {isLoading || !privacy ? (
          <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-indigo-500" />
        ) : (
          <div className="space-y-5">
            <div className="space-y-4">
              {PRIVACY_ROWS.map((row) => (
                <div key={row.key} className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{row.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{row.description}</p>
                  </div>
                  <Toggle
                    label={row.title}
                    checked={privacy[row.key]}
                    disabled={update.isPending}
                    onChange={(value) => update.mutate({ [row.key]: value })}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20">
                  <Lock className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Chat lock</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {privacy.hasChatLockPin
                      ? "PIN is set. Lock chats from their menu."
                      : "Set a PIN to lock private chats."}
                  </p>
                </div>
                <button type="button" onClick={() => setShowPin(true)} className={secondaryButton}>
                  {privacy.hasChatLockPin ? "Manage" : "Set PIN"}
                </button>
              </div>
            </div>

            <p className="flex items-start gap-2 text-[11px] text-slate-400">
              <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              These settings are mutual, like WhatsApp: what you hide from others, you also stop seeing from them.
            </p>
          </div>
        )}
      </ChatModal>
      {showPin && privacy && <ChatPinDialog hasPin={privacy.hasChatLockPin} onClose={() => setShowPin(false)} />}
    </>
  );
};

// ─── Schedule ─────────────────────────────────────────────────────

const toLocalInput = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

function quickTimes() {
  const now = new Date();
  const inHour = new Date(now.getTime() + 3600_000);
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  if (tonight.getTime() - now.getTime() < 15 * 60_000) tonight.setDate(tonight.getDate() + 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", date: inHour },
    { label: tonight.getDate() === now.getDate() ? "Tonight, 8:00 PM" : "Tomorrow, 8:00 PM", date: tonight },
    { label: "Tomorrow, 9:00 AM", date: tomorrow },
  ];
}

export const ScheduleDialog: React.FC<{
  text: string;
  onClose: () => void;
  onSchedule: (sendAt: Date) => Promise<void>;
}> = ({ text, onClose, onSchedule }) => {
  const options = useMemo(quickTimes, []);
  const [value, setValue] = useState(toLocalInput(options[0].date));
  const [saving, setSaving] = useState(false);
  const sendAt = new Date(value);
  const valid = !Number.isNaN(sendAt.getTime()) && sendAt.getTime() > Date.now() + 60_000;

  const submit = async () => {
    setSaving(true);
    try {
      await onSchedule(sendAt);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ChatModal
      title="Schedule message"
      icon={<CalendarClock className="h-4 w-4" />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid || saving} onClick={submit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            Schedule
          </button>
        </>
      }
    >
      <p className="mb-4 line-clamp-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {text}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setValue(toLocalInput(o.date))}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              value === toLocalInput(o.date)
                ? "bg-indigo-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <input
        type="datetime-local"
        value={value}
        min={toLocalInput(new Date(Date.now() + 2 * 60_000))}
        onChange={(e) => setValue(e.target.value)}
        className={inputClass}
      />
      {!valid && <p className="mt-2 text-xs text-red-500">Pick a time at least a minute from now</p>}
    </ChatModal>
  );
};
