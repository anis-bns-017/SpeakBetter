// apps/web/src/components/chat/ChatInfoPanel.tsx
// Side panel for a chat: quick controls (mute, archive, lock, pin), disappearing
// messages, shared media / files / links, saved messages and privacy actions.
import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  BellOff,
  Archive,
  ArchiveRestore,
  Lock,
  Unlock,
  Pin,
  PinOff,
  Timer,
  Image as ImageIcon,
  FileText,
  Link2,
  Bookmark,
  BookmarkX,
  Trash2,
  Flag,
  Shield,
  Play,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import {
  apiErrorMessage,
  chatApi,
  isMutedNow,
  patchMessage,
  useChatPrivacy,
  useUpdateChatState,
  type Chat,
  type Message,
} from "../../hooks/useChat";
import { relockChat } from "../../lib/chatUnlock";
import { ChatPinDialog, DISAPPEARING_CHOICES, MUTE_OPTIONS } from "./ChatDialogs";

type Tab = "media" | "files" | "links" | "saved";

const TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
  { key: "media", label: "Media", icon: ImageIcon },
  { key: "files", label: "Files", icon: FileText },
  { key: "links", label: "Links", icon: Link2 },
  { key: "saved", label: "Saved", icon: Bookmark },
];

const urlsIn = (text?: string | null) => text?.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
const fileNameOf = (m: Message) =>
  m.metadata?.fileName || decodeURIComponent((m.fileUrl || m.mediaUrl || "").split("?")[0].split("/").pop() || "File");

interface ChatInfoPanelProps {
  chat?: Chat;
  chatId?: string;
  chatName: string;
  chatAvatar?: string | null;
  subtitle: string;
  isGroup: boolean;
  otherUser?: { id: string; name: string } | null;
  onClose: () => void;
  onJumpTo: (messageId: string) => void;
  onReport: (target: { type: "USER" | "MESSAGE"; id: string; label: string }) => void;
  onOpenPrivacy: () => void;
  onCleared: () => void;
  /** Group member list (kept from the previous panel) */
  members?: React.ReactNode;
}

export const ChatInfoPanel: React.FC<ChatInfoPanelProps> = ({
  chat,
  chatId,
  chatName,
  chatAvatar,
  subtitle,
  isGroup,
  otherUser,
  onClose,
  onJumpTo,
  onReport,
  onOpenPrivacy,
  onCleared,
  members,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateState = useUpdateChatState();
  const { data: privacy } = useChatPrivacy();
  const [tab, setTab] = useState<Tab>("media");
  const [showMuteOptions, setShowMuteOptions] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const muted = isMutedNow(chat?.mutedUntil);
  const myRole = chat?.participants.find((p) => p.userId === user?.id)?.role;
  const canChangeTimer = !isGroup || myRole === "ADMIN" || myRole === "OWNER";

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["chat-gallery", chatId, tab],
    queryFn: async () =>
      tab === "saved" ? (await chatApi.getSaved(chatId!)).data : (await chatApi.getMedia(chatId!, tab)).data,
    enabled: !!chatId,
  });

  const links = useMemo(
    () =>
      tab === "links"
        ? items.flatMap((m) => urlsIn(m.content).map((url) => ({ url, message: m })))
        : [],
    [items, tab],
  );

  const setState = (data: Parameters<typeof updateState.mutate>[0]) => updateState.mutate(data);

  const toggleLock = () => {
    if (!chatId || !chat) return;
    if (!chat.isLocked && !privacy?.hasChatLockPin) {
      setShowPinSetup(true);
      return;
    }
    if (chat.isLocked) relockChat(chatId);
    setState({ chatId, isLocked: !chat.isLocked });
    toast.success(chat.isLocked ? "Chat unlocked" : "Chat locked — it now needs your PIN to open");
  };

  const setTimer = async (seconds: number) => {
    if (!chatId) return;
    try {
      await chatApi.setDisappearing(chatId, seconds);
      queryClient.setQueryData<Chat>(["chat", chatId], (old) =>
        old ? { ...old, disappearingSeconds: seconds || null } : old,
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't change disappearing messages"));
    }
  };

  const clearHistory = async () => {
    if (!chatId) return;
    try {
      await chatApi.clearHistory(chatId);
      queryClient.setQueryData<Message[]>(["messages", chatId], []);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["chat-gallery", chatId] });
      toast.success("Chat cleared for you");
      setConfirmClear(false);
      onCleared();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't clear the chat"));
    }
  };

  const unsave = async (m: Message) => {
    try {
      await chatApi.saveMessage(m.id, false);
      patchMessage(queryClient, m.id, { isSaved: false });
      queryClient.invalidateQueries({ queryKey: ["chat-gallery", chatId, "saved"] });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update saved messages"));
    }
  };

  const action = (icon: React.ReactNode, label: string, onClick: () => void, active = false) => (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={onClick}
      disabled={!chatId}
      className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 transition-colors disabled:opacity-40 ${
        active ? "bg-indigo-50 text-indigo-600" : "bg-slate-50/80 text-indigo-500 hover:bg-slate-100/80"
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
    </motion.button>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 z-30 bg-black/20 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        className="absolute right-0 top-0 z-40 flex h-full w-[min(100%,24rem)] flex-col bg-white/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100/60 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Chat info</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat info"
            className="rounded-full p-2 transition-colors hover:bg-slate-100/80"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Identity */}
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl font-bold text-white shadow-lg shadow-indigo-500/20">
              {chatAvatar ? <img src={chatAvatar} alt="" className="h-full w-full object-cover" /> : chatName.charAt(0).toUpperCase()}
            </div>
            <h4 className="text-xl font-semibold text-slate-900">{chatName}</h4>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>

          {/* Quick controls */}
          {chatId && chat && (
            <div className="grid grid-cols-4 gap-2">
              {action(
                muted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />,
                muted ? "Unmute" : "Mute",
                () => (muted ? setState({ chatId, mutedUntil: null }) : setShowMuteOptions((v) => !v)),
                muted,
              )}
              {action(
                chat.isArchived ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />,
                chat.isArchived ? "Unarchive" : "Archive",
                () => setState({ chatId, isArchived: !chat.isArchived }),
                !!chat.isArchived,
              )}
              {action(
                chat.isLocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />,
                chat.isLocked ? "Unlock" : "Lock",
                toggleLock,
                !!chat.isLocked,
              )}
              {action(
                chat.isPinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />,
                chat.isPinned ? "Unpin" : "Pin",
                () => setState({ chatId, isPinned: !chat.isPinned }),
                !!chat.isPinned,
              )}
            </div>
          )}

          <AnimatePresence>
            {showMuteOptions && chatId && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="-mt-3 flex gap-2 overflow-hidden"
              >
                {MUTE_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => {
                      setState({ chatId, mutedUntil: o.value() });
                      setShowMuteOptions(false);
                    }}
                    className="flex-1 rounded-xl bg-slate-100 py-2 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    {o.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {muted && chat?.mutedUntil && (
            <p className="-mt-3 text-center text-[11px] text-slate-400">
              {new Date(chat.mutedUntil).getFullYear() > 9000
                ? "Muted always"
                : `Muted for ${formatDistanceToNowStrict(new Date(chat.mutedUntil))}`}
            </p>
          )}

          {/* Disappearing messages */}
          {chatId && (
            <div className="rounded-2xl bg-slate-50/80 p-4">
              <div className="mb-2.5 flex items-center gap-2">
                <Timer className="h-4 w-4 text-indigo-500" />
                <span className="flex-1 text-sm font-medium text-slate-800">Disappearing messages</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {DISAPPEARING_CHOICES.map((c) => {
                  const active = (chat?.disappearingSeconds || 0) === c.seconds;
                  return (
                    <button
                      key={c.seconds}
                      type="button"
                      disabled={!canChangeTimer}
                      onClick={() => !active && setTimer(c.seconds)}
                      className={`rounded-xl py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed ${
                        active ? "bg-indigo-500 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-indigo-50"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {canChangeTimer
                  ? "New messages disappear for everyone after the chosen time."
                  : "Only group admins can change this."}
              </p>
            </div>
          )}

          {/* Shared content */}
          {chatId && (
            <div>
              <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100/80 p-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                      tab === key ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-indigo-400" />
              ) : tab === "media" ? (
                items.length ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {items.flatMap((m) =>
                      (m.attachments?.length ? m.attachments : [{ id: m.id, url: m.mediaUrl!, type: m.type }]).map(
                        (a) => (
                          <button
                            key={`${m.id}-${a.id}`}
                            type="button"
                            onClick={() => onJumpTo(m.id)}
                            className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100"
                          >
                            {a.type === "VIDEO" ? (
                              <>
                                <video src={a.url} muted preload="metadata" className="h-full w-full object-cover" />
                                <Play className="absolute inset-0 m-auto h-6 w-6 fill-white text-white drop-shadow" />
                              </>
                            ) : (
                              <img
                                src={a.url}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover transition group-hover:scale-105"
                              />
                            )}
                          </button>
                        ),
                      ),
                    )}
                  </div>
                ) : (
                  <EmptyState text="Photos and videos you share appear here" />
                )
              ) : tab === "files" ? (
                items.length ? (
                  <div className="space-y-1">
                    {items.map((m) => (
                      <a
                        key={m.id}
                        href={m.fileUrl || m.mediaUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
                      >
                        <span className="rounded-lg bg-orange-50 p-2 text-orange-500">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{fileNameOf(m)}</span>
                          <span className="text-[11px] text-slate-400">
                            {m.sender?.name} · {format(new Date(m.createdAt), "MMM d")}
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Documents you share appear here" />
                )
              ) : tab === "links" ? (
                links.length ? (
                  <div className="space-y-1">
                    {links.map(({ url, message }, i) => (
                      <a
                        key={`${message.id}-${i}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
                      >
                        <span className="rounded-lg bg-sky-50 p-2 text-sky-500">
                          <Link2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {message.metadata?.linkPreview?.url === url && message.metadata.linkPreview.title
                              ? message.metadata.linkPreview.title
                              : url.replace(/^https?:\/\//, "")}
                          </span>
                          <span className="block truncate text-[11px] text-slate-400">{url}</span>
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Links you share appear here" />
                )
              ) : items.length ? (
                <div className="space-y-1.5">
                  {items.map((m) => (
                    <div key={m.id} className="group flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-slate-50">
                      <button type="button" onClick={() => onJumpTo(m.id)} className="min-w-0 flex-1 text-left">
                        <span className="block text-[11px] font-semibold text-indigo-600">
                          {m.sender?.name} · {format(new Date(m.createdAt), "MMM d, HH:mm")}
                        </span>
                        <span className="line-clamp-2 text-sm text-slate-700">
                          {m.content || (m.type === "FILE" ? fileNameOf(m) : `📎 ${m.type.toLowerCase()}`)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => unsave(m)}
                        title="Remove from saved"
                        className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-white hover:text-red-500 group-hover:opacity-100"
                      >
                        <BookmarkX className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Save messages with the bookmark button to find them here" />
              )}
            </div>
          )}

          {members}

          {/* Privacy & safety */}
          <div className="space-y-1 border-t border-slate-100 pt-4">
            <PanelButton icon={<Shield className="h-4 w-4" />} label="Privacy settings" onClick={onOpenPrivacy} />
            {chatId && !confirmClear && (
              <PanelButton
                icon={<Trash2 className="h-4 w-4" />}
                label="Clear chat history"
                danger
                onClick={() => setConfirmClear(true)}
              />
            )}
            {confirmClear && (
              <div className="rounded-2xl bg-red-50 p-3">
                <p className="text-xs text-red-700">
                  Clear all messages in this chat for you? Other people still keep their copy.
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            {otherUser && (
              <PanelButton
                icon={<Flag className="h-4 w-4" />}
                label={`Report ${otherUser.name}`}
                danger
                onClick={() => onReport({ type: "USER", id: otherUser.id, label: otherUser.name })}
              />
            )}
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {showPinSetup && (
          <ChatPinDialog
            hasPin={false}
            onClose={() => setShowPinSetup(false)}
            onSaved={() => chatId && setState({ chatId, isLocked: true })}
          />
        )}
      </AnimatePresence>
    </>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <p className="rounded-2xl bg-slate-50/80 px-4 py-6 text-center text-xs text-slate-400">{text}</p>
);

const PanelButton = ({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
    }`}
  >
    {icon}
    {label}
  </button>
);
