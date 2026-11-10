import React from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useFollowStatus, useToggleFollow } from "../../hooks/useNotifications";

const errorMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** Follow someone to hear when they go live or schedule a room */
export const FollowButton: React.FC<{ userId: string; name?: string; size?: "sm" | "md" }> = ({ userId, name, size = "sm" }) => {
  const { data, isLoading } = useFollowStatus(userId);
  const toggle = useToggleFollow(userId);
  const following = !!data?.following;
  const busy = isLoading || toggle.isPending;

  const onClick = () =>
    toggle.mutate(!following, {
      onSuccess: (status) => {
        if (status.following) toast.success(name ? `You'll hear when ${name} goes live` : "Following");
      },
      onError: (e) => toast.error(errorMessage(e, "Couldn't update that")),
    });

  const sizing = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={following}
      title={following ? "Stop following" : "Get told when they go live or schedule a room"}
      className={`${sizing} shrink-0 rounded-xl font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
        following
          ? "border border-line bg-surface text-slate-700 dark:text-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.08]"
          : "bg-indigo-600 hover:bg-indigo-700 text-white"
      }`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : following ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
      {following ? "Following" : "Follow"}
    </button>
  );
};

export default FollowButton;
