// apps/web/src/components/voice/shared/BanListPanel.tsx
/**
 * BanListPanel: the people removed from this room, for the host and
 * moderators. Lifting a ban only lets someone back in; they join again themselves.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { useRoomBans } from "../../../hooks/useRoomBans";
import { THEME } from "../VoiceRoomView.theme";

interface BanListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const BanListPanel: React.FC<BanListPanelProps> = ({
  isOpen,
  onClose,
  roomId,
  roomName,
}) => {
  const { bans, isLoading, isError, refetch, unban } = useRoomBans(
    roomId,
    isOpen,
  );

  const handleUnban = (userId: string, name: string) => {
    unban.mutate(userId, {
      onSuccess: () => toast.success(`${name} can join this room again`),
      onError: () => toast.error(`Could not lift the ban on ${name}`),
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-[80] px-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Removed from this room"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="rounded-3xl w-full max-w-md border overflow-hidden"
            style={{
              background: THEME.colors.background.card,
              borderColor: THEME.colors.border.primary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  className="text-base font-bold"
                  style={{ color: THEME.colors.text.primary }}
                >
                  Removed from this room
                </h3>
                <p
                  className="text-xs truncate"
                  style={{ color: THEME.colors.text.muted }}
                >
                  {roomName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
                style={{ color: THEME.colors.text.muted }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto space-y-2">
              {isLoading && (
                <div
                  className="flex items-center justify-center gap-2 py-8 text-xs"
                  style={{ color: THEME.colors.text.muted }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              )}

              {isError && (
                <div className="py-8 text-center text-xs">
                  <p style={{ color: THEME.colors.text.muted }}>
                    Could not load the list.
                  </p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-2 px-3 py-1.5 rounded-lg border font-semibold"
                    style={{
                      borderColor: THEME.colors.border.primary,
                      color: THEME.colors.text.primary,
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}

              {!isLoading && !isError && bans.length === 0 && (
                <div
                  className="py-8 flex flex-col items-center gap-2 text-xs text-center"
                  style={{ color: THEME.colors.text.muted }}
                >
                  <UserX className="w-6 h-6" />
                  <p>Nobody has been removed from this room.</p>
                </div>
              )}

              {bans.map((ban) => {
                const name = ban.user?.name || "Unknown user";
                const pending =
                  unban.isPending && unban.variables === ban.userId;
                return (
                  <div
                    key={ban.id}
                    className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                    style={{
                      background: THEME.colors.background.primary,
                      borderColor: THEME.colors.border.primary,
                    }}
                  >
                    {ban.user?.avatarUrl ? (
                      <img
                        src={ban.user.avatarUrl}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{
                          background: "rgba(129,140,248,0.18)",
                          color: THEME.colors.accent.primary,
                        }}
                        aria-hidden="true"
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: THEME.colors.text.primary }}
                      >
                        {name}
                      </p>
                      <p
                        className="text-[11px] truncate"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        Removed {formatWhen(ban.createdAt)}
                        {ban.reason ? ` · ${ban.reason}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleUnban(ban.userId, name)}
                      className="px-3 py-1.5 rounded-lg font-semibold text-[11px] transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-60 shrink-0"
                      style={{
                        background: "rgba(129,140,248,0.18)",
                        color: THEME.colors.accent.primary,
                      }}
                    >
                      {pending ? "Lifting..." : "Allow back"}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
