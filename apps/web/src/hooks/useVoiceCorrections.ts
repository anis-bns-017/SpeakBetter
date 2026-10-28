// apps/web/src/hooks/useVoiceCorrections.ts
/**
 * useVoiceCorrections — real-time grammar/pronunciation corrections.
 *
 * Data flow (all over the voice socket; the server saves every step):
 *   1. Listener opens CorrectionSheet → fills in original + correction
 *   2. emit `voice:correction` → server saves it and broadcasts `voice:correction`
 *      (or replies `voice:correction-failed` to the author)
 *   3. Receiver's hook collects them into `received`
 *   4. Receiver accepts/dismisses → `voice:correction-resolve` → `voice:correction-status`
 *   5. On join the server sends `voice:corrections-history`, so nothing is lost on refresh
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

export type CorrectionCategory =
  | "grammar"
  | "vocabulary"
  | "pronunciation"
  | "word-choice"
  | "spelling"
  | "other";

export interface VoiceCorrection {
  id: string;
  roomId: string;
  /** The user who was corrected */
  targetUserId: string;
  targetUserName: string;
  /** The user who submitted the correction */
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  /** What the target said (may be auto-filled from transcriptions) */
  original: string;
  /** The suggested correction */
  corrected: string;
  /** Optional note — "in Spanish we say X instead of Y" */
  note?: string;
  category: CorrectionCategory;
  /** pending | accepted | dismissed */
  status: "pending" | "accepted" | "dismissed";
  createdAt: number;
  resolvedAt?: number;
}

interface UseVoiceCorrectionsOptions {
  roomId: string;
  userId: string;
  userName: string;
  socket: Socket | null;
  isConnected: boolean;
  /** Called when a correction targeting you is accepted */
  onAccepted?: (c: VoiceCorrection) => void;
}

export const useVoiceCorrections = ({
  roomId,
  userId,
  userName,
  socket,
  isConnected,
  onAccepted,
}: UseVoiceCorrectionsOptions) => {
  const [corrections, setCorrections] = useState<VoiceCorrection[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Latest values for socket handlers, so listeners are registered once per socket
  const correctionsRef = useRef(corrections);
  const onAcceptedRef = useRef(onAccepted);
  useEffect(() => {
    correctionsRef.current = corrections;
    onAcceptedRef.current = onAccepted;
  });

  // ------------------------------------------------------------
  // Socket listeners
  // ------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    // The saved copy replaces our optimistic one (same id)
    const handleNew = (c: VoiceCorrection) => {
      setCorrections((prev) =>
        prev.some((x) => x.id === c.id)
          ? prev.map((x) => (x.id === c.id ? { ...x, ...c } : x))
          : [...prev, c],
      );
    };

    const handleStatusUpdate = (data: {
      id: string;
      status: "accepted" | "dismissed";
      resolvedAt?: number;
    }) => {
      const existing = correctionsRef.current.find((x) => x.id === data.id);
      setCorrections((prev) =>
        prev.map((c) =>
          c.id === data.id
            ? { ...c, status: data.status, resolvedAt: data.resolvedAt ?? Date.now() }
            : c,
        ),
      );
      if (data.status === "accepted" && existing && existing.targetUserId === userId) {
        onAcceptedRef.current?.({ ...existing, status: "accepted" });
      }
    };

    // History from the server, keeping any local corrections still waiting to be saved
    const handleBulk = (list: VoiceCorrection[]) => {
      if (!Array.isArray(list)) return;
      setCorrections((prev) => {
        const savedIds = new Set(list.map((c) => c.id));
        return [...list, ...prev.filter((c) => !savedIds.has(c.id) && c.authorId === userId)];
      });
    };

    const handleFailed = (data: { id?: string; message?: string }) => {
      if (data?.id) setCorrections((prev) => prev.filter((c) => c.id !== data.id));
      toast.error(data?.message || "Could not send correction");
    };

    socket.on("voice:correction", handleNew);
    socket.on("voice:correction-status", handleStatusUpdate);
    socket.on("voice:corrections-history", handleBulk);
    socket.on("voice:correction-failed", handleFailed);

    return () => {
      socket.off("voice:correction", handleNew);
      socket.off("voice:correction-status", handleStatusUpdate);
      socket.off("voice:corrections-history", handleBulk);
      socket.off("voice:correction-failed", handleFailed);
    };
  }, [socket, userId]);

  // ------------------------------------------------------------
  // Submit a correction
  // ------------------------------------------------------------
  const submitCorrection = useCallback(
    async (payload: {
      targetUserId: string;
      targetUserName: string;
      original: string;
      corrected: string;
      note?: string;
      category: CorrectionCategory;
    }) => {
      if (!socket || !isConnected) {
        throw new Error("Not connected to voice server");
      }
      if (!payload.original.trim() || !payload.corrected.trim()) {
        throw new Error("Both original and correction are required");
      }

      setIsSubmitting(true);

      const id = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: VoiceCorrection = {
        id,
        roomId,
        targetUserId: payload.targetUserId,
        targetUserName: payload.targetUserName,
        authorId: userId,
        authorName: userName,
        original: payload.original.trim(),
        corrected: payload.corrected.trim(),
        note: payload.note?.trim(),
        category: payload.category,
        status: "pending",
        createdAt: Date.now(),
      };

      // Optimistic local echo
      setCorrections((prev) => [...prev, optimistic]);

      try {
        socket.emit("voice:correction", {
          roomId,
          id,
          targetUserId: payload.targetUserId,
          targetUserName: payload.targetUserName,
          original: optimistic.original,
          corrected: optimistic.corrected,
          note: optimistic.note,
          category: payload.category,
        });
      } finally {
        setIsSubmitting(false);
      }

      return optimistic;
    },
    [socket, isConnected, roomId, userId, userName],
  );

  // ------------------------------------------------------------
  // Accept / dismiss
  // ------------------------------------------------------------
  const resolveCorrection = useCallback(
    (id: string, status: "accepted" | "dismissed") => {
      // Optimistic
      setCorrections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status, resolvedAt: Date.now() } : c,
        ),
      );

      if (socket && isConnected) {
        socket.emit("voice:correction-resolve", {
          roomId,
          id,
          status,
        });
      }
    },
    [socket, isConnected, roomId],
  );

  const clear = useCallback(() => setCorrections([]), []);

  // ------------------------------------------------------------
  // Derived
  // ------------------------------------------------------------
  const received = corrections.filter(
    (c) => c.targetUserId === userId && c.status === "pending",
  );
  const sent = corrections.filter((c) => c.authorId === userId);
  const accepted = corrections.filter((c) => c.status === "accepted");

  /** Map: userId → list of pending corrections about them */
  const pendingByUser = corrections.reduce<
    Record<string, VoiceCorrection[]>
  >((acc, c) => {
    if (c.status !== "pending") return acc;
    if (!acc[c.targetUserId]) acc[c.targetUserId] = [];
    acc[c.targetUserId].push(c);
    return acc;
  }, {});

  return {
    corrections,
    received,
    sent,
    accepted,
    pendingByUser,
    isSubmitting,
    submitCorrection,
    resolveCorrection,
    clear,
  };
};

export default useVoiceCorrections;