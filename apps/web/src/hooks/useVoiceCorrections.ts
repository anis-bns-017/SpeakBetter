// apps/web/src/hooks/useVoiceCorrections.ts
/**
 * useVoiceCorrections — real-time grammar/pronunciation corrections.
 *
 * Data flow:
 *   1. Listener opens CorrectionSheet → fills in original + correction
 *   2. POST to /voice/rooms/:roomId/corrections
 *   3. Socket broadcasts `voice:correction` to everyone in the room
 *   4. Receiver's hook collects them into `inbox`
 *   5. Receiver clicks Accept → POST /corrections/:id/accept
 *   6. Everyone in the room sees the accepted correction as a chat highlight
 */

import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

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

  // ------------------------------------------------------------
  // Socket listeners
  // ------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const handleNew = (c: VoiceCorrection) => {
      setCorrections((prev) => {
        if (prev.some((x) => x.id === c.id)) return prev;
        return [...prev, c];
      });
    };

    const handleStatusUpdate = (data: {
      id: string;
      status: "accepted" | "dismissed";
      resolvedAt?: number;
    }) => {
      setCorrections((prev) =>
        prev.map((c) =>
          c.id === data.id
            ? {
                ...c,
                status: data.status,
                resolvedAt: data.resolvedAt ?? Date.now(),
              }
            : c,
        ),
      );

      if (data.status === "accepted") {
        const c = corrections.find((x) => x.id === data.id);
        if (c && c.targetUserId === userId) {
          onAccepted?.(c);
        }
      }
    };

    const handleBulk = (list: VoiceCorrection[]) => {
      if (Array.isArray(list)) setCorrections(list);
    };

    socket.on("voice:correction", handleNew);
    socket.on("voice:correction-status", handleStatusUpdate);
    socket.on("voice:corrections-history", handleBulk);

    return () => {
      socket.off("voice:correction", handleNew);
      socket.off("voice:correction-status", handleStatusUpdate);
      socket.off("voice:corrections-history", handleBulk);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, corrections, userId]);

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