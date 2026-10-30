// apps/web/src/lib/chatUnlock.ts
// Locked chats opened with the PIN stay open for a few minutes in this tab only
// (memory, not storage — a reload locks them again).

const UNLOCK_MS = 5 * 60_000;
const unlockedUntil = new Map<string, number>();

export function isChatUnlocked(chatId: string) {
  return (unlockedUntil.get(chatId) ?? 0) > Date.now();
}

export function unlockChat(chatId: string) {
  unlockedUntil.set(chatId, Date.now() + UNLOCK_MS);
}

export function relockChat(chatId: string) {
  unlockedUntil.delete(chatId);
}
