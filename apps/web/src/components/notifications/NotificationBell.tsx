// apps/web/src/components/notifications/NotificationBell.tsx
/**
 * Notifications: a live connection kept open on every signed-in page (NotificationsLive), and the bell that
 * lists them (NotificationBell). New ones also pop up as a toast, and as a desktop notification when the tab
 * is in the background and you allowed it.
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AudioLines,
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  Radio,
  Settings,
  Trophy,
  Zap,
  Megaphone,
  Swords,
  UserPlus,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { ensureFreshSession } from "../../lib/api/client";
import { getStoredToken } from "../../hooks/useChat";
import {
  NOTIFICATIONS_KEY,
  useMarkNotificationsRead,
  useNotifications,
  type AppNotification,
  type NotificationPage,
} from "../../hooks/useNotifications";
import { tr, msg } from "../../i18n/core";
import { API_URL } from "../../lib/api/serverUrl";

const SOCKET_URL = API_URL;

const TYPE: Record<string, { icon: LucideIcon; tone: string }> = {
  ROOM_REMINDER: { icon: CalendarClock, tone: "bg-amber-500/10 text-amber-500" },
  ROOM_LIVE: { icon: Radio, tone: "bg-rose-500/10 text-rose-500" },
  ROOM_SCHEDULED: { icon: AudioLines, tone: "bg-indigo-500/10 text-indigo-500" },
  NEW_FOLLOWER: { icon: UserPlus, tone: "bg-emerald-500/10 text-emerald-500" },
  CORRECTION: { icon: Wand2, tone: "bg-violet-500/10 text-violet-500" },
  FRIEND_REQUEST: { icon: Users, tone: "bg-sky-500/10 text-sky-500" },
  ACHIEVEMENT: { icon: Trophy, tone: "bg-amber-500/10 text-amber-500" },
  REMINDER: { icon: Zap, tone: "bg-indigo-500/10 text-indigo-500" },
  CHALLENGE_REACTION: { icon: Megaphone, tone: "bg-rose-500/10 text-rose-500" },
  FRIEND_CHALLENGE: { icon: Swords, tone: "bg-rose-500/10 text-rose-500" },
};
const typeOf = (type: string) => TYPE[type] ?? { icon: Bell, tone: "bg-slate-500/10 text-slate-500" };

const canNotifyDesktop = () => typeof window !== "undefined" && "Notification" in window;

/** Keeps the notifications socket open while signed in, and feeds new notifications into the bell */
export const NotificationsLive: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!user?.id) return;
    const socket = io(`${SOCKET_URL}/notifications`, {
      withCredentials: true,
      transports: ["polling", "websocket"],
      // An expired access cookie is refreshed before each (re)connect, like the chat socket.
      // The token is read at connect time, so a reconnect never sends an old one.
      auth: (cb) => {
        void ensureFreshSession().finally(() => {
          const token = getStoredToken();
          cb(token ? { token } : {});
        });
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on("notification:new", (n: AppNotification) => {
      const page = queryClient.getQueryData<NotificationPage>(NOTIFICATIONS_KEY);
      if (page) {
        queryClient.setQueryData<NotificationPage>(NOTIFICATIONS_KEY, {
          ...page,
          items: [n, ...page.items.filter((x) => x.id !== n.id)].slice(0, 50),
          unread: page.unread + 1,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      }
      if (n.type.startsWith("ROOM_")) queryClient.invalidateQueries({ queryKey: ["voice-upcoming"] });
      if (n.type === "FRIEND_REQUEST") queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      if (n.type === "ACHIEVEMENT") {
        queryClient.invalidateQueries({ queryKey: ["achievements"] });
        queryClient.invalidateQueries({ queryKey: ["league-current"] });
        // A badge or a week's result gets its full-screen moment straight away
        queryClient.invalidateQueries({ queryKey: ["celebrations"] });
      }
      if (n.type === "CHALLENGE_REACTION") queryClient.invalidateQueries({ queryKey: ["challenge-today"] });
      if (n.type === "FRIEND_CHALLENGE") queryClient.invalidateQueries({ queryKey: ["friend-challenges"] });
      if (n.type === "REMINDER") {
        queryClient.invalidateQueries({ queryKey: ["league-current"] });
        queryClient.invalidateQueries({ queryKey: ["league-friends"] });
      }

      toast(n.title, {
        description: n.message,
        action: n.actionUrl ? { label: msg("Open"), onClick: () => navigateRef.current(n.actionUrl as string) } : undefined,
      });
      if (document.hidden && canNotifyDesktop() && Notification.permission === "granted") {
        try {
          const desktop = new Notification(n.title, { body: n.message, tag: n.id });
          desktop.onclick = () => {
            window.focus();
            if (n.actionUrl) navigateRef.current(n.actionUrl);
          };
        } catch {
          /* some browsers only allow this from a service worker */
        }
      }
    });
    socket.on("notification:read", ({ unread }: { unread: number }) => {
      // Read in another tab: the list is refreshed next time it opens
      queryClient.setQueryData<NotificationPage>(NOTIFICATIONS_KEY, (page) => (page ? { ...page, unread } : page));
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });
    socket.on("notification:unread", ({ unread }: { unread: number }) => {
      const page = queryClient.getQueryData<NotificationPage>(NOTIFICATIONS_KEY);
      // The server counts more unread than the list shows: something arrived while the socket was down
      if (!page || page.unread !== unread) queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });
    socket.on("connect_error", (error) => console.warn("Notifications socket could not connect:", error.message));

    return () => {
      socket.disconnect();
    };
  }, [user?.id, queryClient]);

  return null;
};

/**
 * The bell with its unread count. `variant="sidebar"` sits in the desktop sidebar and opens to its right;
 * `variant="floating"` is the phone version in the top corner.
 */
export const NotificationBell: React.FC<{ variant: "sidebar" | "floating" }> = ({ variant }) => {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    canNotifyDesktop() ? Notification.permission : "unsupported",
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const unread = data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate({ ids: [n.id] });
    setOpen(false);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  const askDesktop = async () => {
    if (!canNotifyDesktop()) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success(tr("Desktop alerts are on"));
  };

  const button =
    variant === "sidebar"
      ? "relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors"
      : "relative w-11 h-11 rounded-full flex items-center justify-center bg-white/90 dark:bg-panel/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-lg text-slate-600 dark:text-slate-200";

  const panelPosition: React.CSSProperties =
    variant === "sidebar" ? { left: "calc(var(--sidebar-w, 260px) + 12px)", top: 12 } : { right: 12, top: 64 };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? tr("Notifications, {unread} unread", { unread }) : tr("Notifications")}
        aria-expanded={open}
        className={button}
      >
        {unread ? <BellRing className="w-[18px] h-[18px]" /> : <Bell className="w-[18px] h-[18px]" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-shell">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={tr("Notifications")}
            className="fixed z-[120] w-[min(92vw,380px)] max-h-[min(70vh,560px)] flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-panel shadow-2xl overflow-hidden"
            style={panelPosition}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Notifications")}</h2>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate({ all: true })}
                    className="h-7 px-2 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 inline-flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> {" "}{tr("Mark all read")}</button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate("/settings#notifications");
                  }}
                  aria-label={tr("Notification settings")}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {permission === "default" && (
              <button
                type="button"
                onClick={() => void askDesktop()}
                className="mx-3 mt-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-left text-xs text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/15"
              >
                <span className="font-semibold">{tr("Turn on desktop alerts")}</span> {" "}{tr("to hear about rooms going live while this tab is in the background.")}</button>
            )}

            <div className="flex-1 overflow-y-auto py-1">
              {!data ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">{tr("Loading…")}</p>
              ) : data.items.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{tr("Nothing yet")}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tr("Follow people and tap “Remind me” on scheduled rooms. You'll hear when they go live.")}</p>
                </div>
              ) : (
                <ul>
                  {data.items.map((n) => {
                    const { icon: Icon, tone } = typeOf(n.type);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openItem(n)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] ${n.isRead ? "" : "bg-indigo-50/40 dark:bg-indigo-500/[0.05]"}`}
                        >
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">{tr(n.title)}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.message}</span>
                            <span className="block text-[11px] text-slate-400 mt-1">
                              {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                            </span>
                          </span>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" aria-label={tr("Unread")} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default NotificationBell;
