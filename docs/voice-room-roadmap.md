# Voice Room Roadmap

Goal: the best voice room for English learners, ahead of Clubhouse, HelloTalk and Hilokal.
We build **one item at a time**: build → test in the browser → commit → next.

Status: ✅ done · 🔧 in progress · ⬜ not started

## Where we stand (audit, 2026-10-28)

| Feature | State | Problem |
|---|---|---|
| Join / leave / mute, LiveKit audio | Works | Fixed: multi-speaker audio, mic meter, Leave/Share buttons |
| Room chat | Works | Redesigned (ChatPanel); needs a browser test |
| Stage (speakers vs listeners) | Built (item 1) | Was cosmetic: every token had `canPublish: true` |
| Raise hand / speaker queue | Built (item 1) | Approving a hand now really grants the mic |
| Corrections | Built (item 2) | Were relayed but never saved; now stored with history on join |
| Practice journal | Partial | Stored in the browser only (`localStorage`) |
| Live captions | Partial | Browser speech recognition, Chrome/Edge only; no `DEEPGRAM_API_KEY` on the server |
| Translation | Off | No translation key; Translate button hidden until wired |
| AI co-host | Heuristics only | No AI backend (`VITE_AI_COHOST_URL` unset) |
| Voice effects | Built (item 3) | Were local only; now published through a LiveKit processor |
| Recording | Unknown | Endpoints exist; needs LiveKit Egress to work |
| Speaking-time stats | Works (local) | Not saved after the session |

## Phase 1 — Make the core rock-solid
1. 🔧 **Real stage roles** — built, waiting for a browser test.
   - STAGE rooms: listeners join with `canPublish: false`; the control bar shows **Raise hand** instead of a mic.
   - Host/moderators: **Invite to speak** (grants the mic live via LiveKit `updateParticipant`) and **Move to audience** (revokes it) from the queue or a participant's card.
   - Speakers can **Leave stage**; promoted speakers start muted and unmute themselves.
   - Participants list splits into **On stage** / **Audience**, raised hands first.
   - New socket event `voice:role-changed` keeps every client's roles in sync; join payload now carries role.
   - OPEN/PRIVATE/SCHEDULED rooms stay open-mic.
   - Also fixed: 7 events (stage reactions, promote, lower hand, captions, corrections) were broadcast to the wrong socket room and never arrived; host mute now passes the real track ID to LiveKit; the room creator is always host on join; previous host stays on stage as a speaker after handing over.
2. 🔧 **Corrections that persist** — built, waiting for a browser test.
   - New `VoiceCorrection` table (migration `20261028014500_add_voice_corrections`, additive only).
   - Every correction is saved before it's broadcast; the room's history is sent on join (`voice:corrections-history`), so refreshes and late joiners keep them.
   - Only the corrected person can accept or dismiss (previously anyone could).
   - Invalid corrections (empty, self-correction, target not in room) are rejected with `voice:correction-failed` and the optimistic copy is removed.
   - REST: `GET /voice/corrections/me?status=accepted` (for the journal/progress pages) and `GET /voice/rooms/:roomId/corrections`.
   - Client: fixed a stale-state bug that could stop accepted corrections reaching the practice journal.
   - Next step (later item): sync the practice journal from `/voice/corrections/me` instead of browser-only storage.
3. 🔧 **Voice effects heard by everyone** — built, waiting for a browser test.
   - Effects now run as a LiveKit audio `TrackProcessor` on the published mic: LiveKit feeds the raw mic in and sends the processed voice to the room. Turning effects off removes the processor and restores the clean mic.
   - Previously the processed audio was thrown away (`onOutputTrack` was a no-op), so only the effects UI changed.
   - Sliders change smoothly (short ramps, no clicks); the old "radio" filter was a bandpass that ignored its gain and is now a proper peaking filter.
   - `localTrack` now follows mic publish/unpublish, so effects also work after being invited on stage.
   - New **Noise suppression** switch (on = talking, off = "studio mode" for singing/music); echo cancellation always stays on; the choice is remembered.
   - Panel shows "Live — everyone hears this" while active.
4. 🔧 **Reconnect & presence** — built, waiting for a browser test.
   - Server: a dropped connection gets a **15-second grace period** (`voice:presence` → "reconnecting"); coming back keeps your place and the host role. Before, any blip removed you and could hand host control to someone else permanently.
   - Server: closing one of two tabs no longer removes you from the room.
   - Client (LiveKit): tracks `connecting / connected / reconnecting / disconnected`; when LiveKit's own resume gives up, the room re-joins automatically with back-off (2s → 30s, 5 tries) and immediately when the browser comes back online.
   - Joining from another tab shows "You joined this room from another tab or device" with a **Use this tab** button instead of failing silently.
   - Fixed the flood of `voice:speaking` events: only changes are sent, as volatile messages that are dropped while offline (before: dozens queued and burst on reconnect); "stopped speaking" is now sent too.
   - UI: reconnect banner with **Retry now**, "📶 Reconnecting…" on people whose connection dropped, and the control bar's reconnecting indicator is wired up.

## Phase 2 — Learning features (beat HelloTalk / Hilokal)
5. ⬜ **Room level & language tags** — CEFR level (A1–C2), topic, accent; filter rooms by them.
6. ⬜ **Topic cards for hosts** — conversation prompts and role-plays pushed to the stage.
7. ⬜ **Save words from the room** — tap a word in chat/captions → vocabulary & flashcards (existing pages).
8. ⬜ **Live captions for everyone** — server captions (Deepgram) with browser fallback; per-speaker lines.
9. ⬜ **Tap-to-translate** for chat and captions.
10. ⬜ **Real AI co-host (Claude)** — live summary, new-word list, gentle correction suggestions, silence-breaker prompts.
11. ⬜ **Post-session report** — speaking time, corrections received, new words, saved to profile/progress.

## Phase 3 — Social & growth (beat Clubhouse)
12. ⬜ **Scheduled rooms + reminders** (`VoiceRoom.scheduledFor` already exists).
13. ⬜ **Follow & "friend is live" notifications**, wave/invite a friend into a room.
14. ⬜ **Recording, replays and clips** (LiveKit Egress).
15. ⬜ **Gifts & host rewards**.
16. ⬜ **Safety** — report, block, auto-moderation of chat, host tools log.

## Keys and services needed later
- `ANTHROPIC_API_KEY` (AI co-host, item 10)
- `DEEPGRAM_API_KEY` (server captions, item 8)
- A translation API key (item 9)
- LiveKit Egress + storage (item 14)
