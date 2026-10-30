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

## Activity engine & dashboard (2026-10-28)
- `ActivityService` (server/src/learning/activity.service.ts) is the one place that awards XP and keeps the daily streak (practising on consecutive days grows it; a missed day restarts it). Before this, streaks were never updated and speaking time was never recorded.
- XP: speaking 1 XP / 15 s (tracked server-side from `voice:speaking` turns into `VoiceSpeakerStats`), giving a correction +3, accepting one +5, flashcard review +2, exercise +10. Daily goal: 50 XP.
- Migration `20261028120000_add_activity_xp_reasons` adds `VOICE_SPEAKING`, `CORRECTION_GIVEN`, `CORRECTION_ACCEPTED` to `XpReason` (additive).
- `GET /learning/dashboard` returns streak, XP (today / this week / last week), 84-day activity, words, cards due, speaking minutes, rooms joined and recent corrections. The dashboard page is built entirely on it (no placeholder numbers).

## Room Coach (2026-10-30)
A coach built into the room itself — the thing other language apps don't have. Open it from the 🎯 button in the room tool rail.
- **Live fluency coach (private)** — from each learner's final captions the server measures pace (words/min vs. a 100–150 comfort band), smoothness (fillers like "um", "like", "you know", plus restarts such as "I I think") and variety. A gentle tip appears at most once every 20 s; a 0–100 fluency score and a trend versus the last session are shown. Only the speaker sees it. Browser speech recognition often drops "um/uh", so "like", "you know", "basically" and restarts are the most reliable signals.
- **Secret-word missions** — host/moderator starts a round (level A1–C1, 3/5/10 min). Everyone gets a *private* word with meaning and example; using it in a final caption completes it (any inflection, phrases supported). Points = level base (5–12) + speed bonus for the first three (+5/+3/+1); XP goes through `ActivityService` (`MISSION_COMPLETED`, capped at 60 XP/day). One free swap per round; late joiners get a word; the leaderboard reveals every word when the round ends (stopped or timed out).
- **Airtime balance + spotlight** — the room sees a "conversation balance" meter (entropy of speaking time); hosts also see who is quiet. **Spotlight** aims a topic card (30 cards, A1–C1: daily life, opinion, story, role-play, fun; follow-ups and useful phrases included) at the quietest speaker — or push a card to everyone.
- **Session reports** — saved whenever someone leaves (`VoiceSessionReport`, one row per room per learner): speaking time, words, fillers, pace, fluency, missions, corrections given/received, strong words. The leave dialog shows the recap first. REST: `GET /voice/coach/reports/me`, `GET /voice/coach/reports/room/:roomId` (404 until there is one), `GET /voice/coach/cards`.
<<<<<<< HEAD
- **In the room itself (round 2):** live **captions** at the bottom of the stage (CC toggle, remembered) where every finished word is tappable → **word bank** (`VoiceSavedWord`, Leitner boxes 1/2/4/8/16/32 days, sentence + speaker + room saved with it, flip-card review in the coach panel's *Words* tab, +2 XP per remembered review capped at 20/day, 500-word limit; `POST/GET /voice/coach/words`, `POST /voice/coach/words/:id/review`, `DELETE …/:id`); an always-visible **coach HUD** (fluency ring, pace, fillers, latest tip); a **mission bar** (countdown, your word blurred until you tap it, progress) plus a **celebration** for the whole room when someone completes theirs; **badges on participant cards** (🤫 quiet — hosts only, 🎯 mission done, 🔦 spotlight). Variety is now the share of distinct words in your last 50 (short talks were wrongly penalised before). Migration `20261030180000_add_voice_saved_words` (additive).
=======
>>>>>>> 2112bb78e7a1183ce9019860e0879b2b233dd4cf
- Code: `server/src/voice/coach/` (pure engine + data + service + controller, 48 unit tests), gateway events `voice:coach*`, `voice:mission-*`, `voice:airtime`, `voice:spotlight`; client `useRoomCoach`, `RoomCoachPanel`, `SpotlightBanner`. Migration `20261030120000_add_voice_session_reports` (additive).
- Limits to know: missions and coaching read the browser captions, which the client can fake — fine for practice, don't use for prizes. In-room state is in memory (like the rest of the gateway) so a server restart ends a running round; saved reports survive.
- Verified: unit tests, a 37-check live socket run (permissions, secrecy, bonuses, no double payout, airtime, spotlight, reports), and the panel/banner/leave dialog in a browser. **Not verified:** the full room page, because LiveKit (Docker) wasn't running here.

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
