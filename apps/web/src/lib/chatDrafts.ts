// apps/web/src/lib/chatDrafts.ts
// Unsent text per chat, kept in this browser so it survives switching chats or reloading.

const KEY_PREFIX = "chat-draft:";
const CHANGE_EVENT = "chat-draft-change";

export function getDraft(chatId: string): string {
  try {
    return window.localStorage.getItem(KEY_PREFIX + chatId) ?? "";
  } catch {
    return "";
  }
}

export function setDraft(chatId: string, text: string) {
  try {
    if (text.trim()) window.localStorage.setItem(KEY_PREFIX + chatId, text);
    else window.localStorage.removeItem(KEY_PREFIX + chatId);
  } catch {
    /* storage unavailable (private mode) — drafts just aren't kept */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: chatId }));
}

/** Re-render the chat list's "Draft:" previews when a draft changes */
export function onDraftChange(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
