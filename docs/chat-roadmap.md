# Personal Chat (1:1) Roadmap

Goal: the best language-exchange DM experience — better than HelloTalk.

Status: ✅ done · 🔧 built, needs a browser test · ⬜ not started

## Done in this pass (2026-10-28) 🔧
- **Inline corrections** (HelloTalk's signature feature): hover a partner's text message → ✏️ **Correct** → edit their sentence, add an optional tip, live word-diff preview → they get a card with ~~wrong~~ / **right** and **Got it · +5 XP**. Giving one earns +3 XP. Stored as `Message.type = CORRECTION` (original via `replyToId`, note/acceptedAt in the new `Message.metadata` JSON column). Migration `20261028150000_add_chat_corrections` (additive).
- **Unread counts are real**: `GET /chat` now returns `unreadCount`, and reading a message moves `lastReadAt` forward (before, chats stayed "unread" forever).
- **"Seen" receipts**: live update when the partner reads; fixed own messages always showing blue "read" ticks (the server stores the sender's own receipt).
- **Socket fixes**: typing indicator and other handlers no longer use a stale chat id after switching conversations; incoming voice notes (`voice:message:new`) now appear live; `correction:accepted` syncs both sides.
- **Older history**: "load older messages" works (`before` cursor); previously only the latest 50 messages could ever be seen.
- **Crash fixes** in components not yet wired in: VoiceMessage (non-existent icons, `duration` used before declaration), ChatSearch (missing `useDebounce`), six files importing types as values; `@speakbetter/types` now resolves (missing `index.ts`, Vite alias + tsconfig path).

## Learning features, second pass (2026-10-28) 🔧
- **🔊 Listen** on any text message or correction (browser speech, prefers natural English voices; Shift+click = slow). `lib/speech.ts`.
- **📖 Select a word or phrase** in a message → popup with definition, phonetics, part of speech and an example (free dictionaryapi.dev, single words; only the selected word is sent), pronounce normal/slow, and **Save to flashcards** with the chat sentence as context. `components/chat/WordLookup.tsx`. The server now creates the `Language` row if missing, so saving the first English card can't fail.
- **🟢 Active now / Last seen 5 min ago** in the chat header (`Profile.lastActive` updated on disconnect; returned with chat participants).
- **⭐ XP for chatting**: 1 XP per message, capped at 20 XP/day, and it keeps the streak alive (`ActivityService.recordCappedActivity`, `XpReason.CHAT_MESSAGE`, migration `20261028170000_add_chat_message_xp`).
- **Dashboard** counts and "Learned from the community" now include corrections from 1:1 chat, not just voice rooms.
- **💬 Conversation starters** in empty conversations (tap to send).
- **📋 Paste an image** into the message box to send it.
- Fixed: **sending voice notes was broken** — a lucide `File` icon import shadowed the browser `File` constructor used for the upload.

## Next ⬜
1. Wire in the ready-made components the page doesn't use yet: **ChatSearch** (in-chat search), **ChatSettings** (mute/pin/wallpaper), **VoiceMessage** (rich voice-note player), **TypingIndicator**, **ReadReceipts** (who read in groups).
2. **Save corrections to the practice journal** and show them on the dashboard's "Learned from the community" card (currently voice-room corrections only).
3. **Tap-to-translate** messages (needs a translation API key) and **transliteration / pronunciation** for words.
4. **Last seen** and **"active now"** in the chat header from presence events.
5. **Paste or drag images** straight into the message box; link previews.
6. **ThreadView**: needs thread hooks/endpoints (`useThread`, `useThreadMessages`, `useSendThreadMessage`) before it can be used.
