// apps/web/src/components/chat/chatOptions.ts
// Choices and labels shared by the chat screens (kept out of ChatDialogs.tsx, which only exports components).
import type { Chat } from "../../hooks/useChat";
import { msg } from "../../i18n/core";

export const MUTE_OPTIONS: Array<{ label: string; value: () => string }> = [
  { label: msg("8 hours"), value: () => new Date(Date.now() + 8 * 3600_000).toISOString() },
  { label: msg("1 week"), value: () => new Date(Date.now() + 7 * 24 * 3600_000).toISOString() },
  { label: msg("Always"), value: () => "always" },
];

export const DISAPPEARING_CHOICES = [
  { seconds: 0, label: msg("Off") },
  { seconds: 24 * 3600, label: msg("24 hours") },
  { seconds: 7 * 24 * 3600, label: msg("7 days") },
  { seconds: 90 * 24 * 3600, label: msg("90 days") },
];

export const disappearingLabel = (seconds?: number | null) =>
  DISAPPEARING_CHOICES.find((c) => c.seconds === (seconds || 0))?.label ?? "Off";

/** Display name for a chat from my point of view */
export function chatDisplayName(chat: Chat, myId?: string) {
  if (chat.type === "PRIVATE") {
    return chat.participants.find((p) => p.userId !== myId)?.user?.name || "Unknown";
  }
  return chat.name || "Group Chat";
}
