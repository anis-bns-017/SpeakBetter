import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { voiceApi } from "./voiceApi";

export interface RoomBan {
  id: string;
  userId: string;
  user: { id: string; name: string | null; avatarUrl: string | null } | null;
  bannedById: string | null;
  reason: string | null;
  createdAt: string;
}

const key = (roomId: string) => ["voice-room-bans", roomId] as const;

/**
 * The people removed from a room. Only loads while `enabled` (the host or a
 * moderator has the ban list open); the server refuses everyone else.
 */
export function useRoomBans(roomId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: key(roomId),
    queryFn: async () => (await voiceApi.getBans(roomId)).data as RoomBan[],
    enabled: enabled && !!roomId,
    staleTime: 0,
  });

  const unban = useMutation({
    mutationFn: (userId: string) => voiceApi.unban(roomId, userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<RoomBan[]>(key(roomId), (bans) =>
        (bans ?? []).filter((ban) => ban.userId !== userId),
      );
    },
  });

  return { ...query, bans: query.data ?? [], unban };
}
