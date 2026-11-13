import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api/client";

export interface RoomCategory {
  name: string;
  icon: string;
  color: string;
  roomCount: number;
}

/** Someone in a listed room (the list sends a light copy) */
export interface DiscoveryParticipant {
  userId?: string;
  name?: string;
  avatarUrl?: string;
  isSpeaking?: boolean;
  user?: { id?: string; name?: string; avatarUrl?: string };
}

export interface DiscoveryRoom {
  id: string;
  name: string;
  description?: string;
  type: string;
  creator: {
    id: string;
    name: string;
    avatarUrl?: string;
    isHost?: boolean;
  };
  participants: DiscoveryParticipant[];
  participantCount: number;
  maxParticipants?: number;
  category?: string;
  trendScore: number;
  language?: string;
  tags: string[];
  categories: string[];
  isLive: boolean;
  createdAt: string;
}

export interface DiscoveryResponse {
  rooms: DiscoveryRoom[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const useDiscoverRooms = (params: {
  query?: string;
  sort?: string;
  filter?: string;
  language?: string;
  category?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ["discover-rooms", params],
    queryFn: async () => {
      const response = await apiClient.get<DiscoveryResponse>(
        "/voice/discover",
        {
          params,
        },
      );
      return response.data;
    },
  });
};

export const useTrendingRooms = (limit: number = 10) => {
  return useQuery({
    queryKey: ["trending-rooms"],
    queryFn: async () => {
      const response = await apiClient.get<DiscoveryRoom[]>("/voice/trending", {
        params: { limit },
      });
      return response.data;
    },
  });
};

export const useRoomCategories = () => {
  return useQuery({
    queryKey: ["room-categories"],
    queryFn: async () => {
      const response = await apiClient.get<RoomCategory[]>("/voice/categories");
      return response.data;
    },
  });
};

export const useLiveRoomsCount = () => {
  return useQuery({
    queryKey: ["live-rooms-count"],
    queryFn: async () => {
      const response = await apiClient.get<number>("/voice/live-count");
      return response.data;
    },
    refetchInterval: 30000,
  });
};

export const useRecommendedRooms = (limit: number = 10) => {
  return useQuery({
    queryKey: ["recommended-rooms"],
    queryFn: async () => {
      const response = await apiClient.get<DiscoveryRoom[]>(
        "/voice/recommended",
        {
          params: { limit },
        },
      );
      return response.data;
    },
  });
};
