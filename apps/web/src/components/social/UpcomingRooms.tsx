import React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Bell, BellRing, CalendarClock } from "lucide-react";
import { useToggleRoomInterest, useUpcomingRooms } from "../../hooks/useNotifications";

const when = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
};

/** Scheduled rooms coming up, with "Remind me" (hosts from people you follow first) */
export const UpcomingRooms: React.FC<{ limit?: number }> = ({ limit = 3 }) => {
  const { data } = useUpcomingRooms();
  const toggle = useToggleRoomInterest();
  if (!data?.length) return null;

  const rooms = [...data].sort((a, b) => Number(b.followingHost) - Number(a.followingHost)).slice(0, limit);
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 flex items-center gap-1.5">
        <CalendarClock className="w-3.5 h-3.5" /> Coming up
      </p>
      <ul className="mt-2 space-y-1">
        {rooms.map((room) => (
          <li key={room.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03]">
            <Link to="/voice" className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{room.name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                {when(room.scheduledFor)} · {room.isHost ? "You're hosting" : room.creator.name}
                {room.interestedCount > 0 ? ` · ${room.interestedCount} going` : ""}
              </span>
            </Link>
            {!room.isHost && (
              <button
                type="button"
                onClick={() =>
                  toggle.mutate(
                    { roomId: room.id, interested: !room.interested },
                    {
                      onSuccess: (r) => toast.success(r.interested ? "We'll remind you 10 minutes before" : "Reminder removed"),
                      onError: () => toast.error("Couldn't update the reminder"),
                    },
                  )
                }
                aria-pressed={room.interested}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors ${
                  room.interested
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border border-line bg-surface text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.08]"
                }`}
              >
                {room.interested ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                {room.interested ? "Set" : "Remind me"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UpcomingRooms;
