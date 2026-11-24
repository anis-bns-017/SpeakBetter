/** "Mute notifications" in the chat list: stops chat pop-ups on this device. Messages still arrive and count as unread. */
const KEY = "sb.chatMuted";

export function isChatMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setChatMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the switch just won't survive a refresh
  }
}
