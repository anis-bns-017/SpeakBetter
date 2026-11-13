// apps/web/src/components/call/callApi.ts
import { apiClient } from "../../lib/api/client";
import { SOCKET_URL } from "../../lib/api/serverUrl";

export type CallLevel = "beginner" | "intermediate" | "advanced";
export type CallGoal = "casual" | "interview" | "work" | "travel" | "fun";
export type ReportReason =
  | "HARASSMENT"
  | "SEXUAL"
  | "HATE"
  | "SPAM"
  | "UNDERAGE"
  | "OTHER";

export type CardKind = "question" | "story" | "opinion" | "game";

/** A conversation card, as sent by the server */
export interface ConversationCard {
  id: string;
  goal: string;
  /** 1 = easy, 2 = medium, 3 = deep */
  depth: 1 | 2 | 3;
  kind: CardKind;
  topic: string;
  question: string;
  followUps: string[];
  phrases: string[];
}

export interface CallStatus {
  eligible: boolean;
  denial: { code: string; message: string } | null;
  needsConsent: boolean;
  restrictedUntil: string | null;
  callsCount: number;
  reputation: { average: number; count: number } | null;
  waiting: number;
  activeCallId: string | null;
  queued?: boolean;
}

export interface CallHistoryItem {
  id: string;
  startedAt: string;
  endReason: string | null;
  goal: string;
  seconds: number;
  yourTalkSeconds: number | null;
  partner: { id: string; name: string; avatarUrl: string | null };
  yourRating: number | null;
  keptInTouch: boolean;
}

export const callApi = {
  status: async () =>
    (await apiClient.get<CallStatus>("/random-call/status")).data,
  consent: async () =>
    (await apiClient.post("/random-call/consent", { confirm18: true })).data,
  history: async () =>
    (await apiClient.get<CallHistoryItem[]>("/random-call/history")).data,
  rate: async (
    callId: string,
    body: { rating: number; keepInTouch: boolean; talkSeconds?: number },
  ) =>
    (
      await apiClient.post<{ ok: boolean; mutualFriend: boolean }>(
        `/random-call/calls/${callId}/rate`,
        body,
      )
    ).data,
  report: async (
    callId: string,
    body: { reason: ReportReason; details?: string },
  ) => (await apiClient.post(`/random-call/calls/${callId}/report`, body)).data,
  block: async (callId: string) =>
    (await apiClient.post(`/random-call/calls/${callId}/block`)).data,
};

/** The call namespace sits next to the voice one on the same server */
export const callSocketUrl = () =>
  SOCKET_URL.replace(
    /\/voice\/?$/,
    "/call",
  );
