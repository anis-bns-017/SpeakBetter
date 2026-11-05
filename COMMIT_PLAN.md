# Commit plan (drafted 2026-11-05)

One commit per feature, oldest first. Messages follow the repo's `feat:` / `fix:` style.
Delete this file when you are done (don't commit it).

**Shared files.** Several files were touched by more than one feature (listed under "Shared" at the end).
For perfectly separate commits, use VS Code's *Stage Selected Ranges* on those files. If that is too fiddly,
stage each shared file whole in the first commit below that lists it; the final code is the same either way,
only the middle commits mix a little.

---

## 1. fix: show toast messages

```
fix: show toast messages

No <Toaster /> was ever mounted, so every toast() in the app was silently
dropped. Mount sonner's Toaster once in App.
```

Files: `apps/web/src/App.tsx`

---

## 2. fix: leave hints out of grammar answers

```
fix: leave hints out of grammar answers

Typed grammar exercises kept their "(a / an)" hint inside the corrected
sentence shown in results and on flashcards.
```

Files: `server/src/grammar/grammar.engine.ts`, `server/src/grammar/grammar.spec.ts`

---

## 3. feat: add public profile pages

```
feat: add public profile pages

GET /users/:id/profile and a /u/:userId page: level, streak, league, badge
showcase, learning counts, follow and friend actions. Respects "show my
profile publicly" (private profiles show only name and photo, except to
friends) and blocks. Names in leagues, challenges, friends and suggestions
link to it.
```

Files:
- new: `server/src/profile/public-profile.service.ts`, `public-profile.controller.ts`, `public-profile.spec.ts`
- `server/src/profile/profile.module.ts`
- new: `apps/web/src/hooks/usePublicProfile.ts`, `apps/web/src/pages/PublicProfilePage.tsx`
- `apps/web/src/pages/LeaguesPage.tsx`, `ChallengePage.tsx`, `SuggestionsPage.tsx`, `FriendsPage.tsx`, `ProfilePage.tsx`
- shared: `routes/index.tsx`

---

## 4. feat: add vocabulary packs

```
feat: add vocabulary packs

10 themed packs of 12 words (A1-C1) with meanings, examples and an
8-question quiz that changes each attempt. Saved and missed words become
flashcards. Pass gives 8 XP once. Adds pack badges and points the plan's
"learn new words" task at the packs.
```

Files:
- new: `server/src/vocab-packs/` (content, engine, service, controller, module, spec)
- new: `server/prisma/migrations/20261105120000_add_vocab_pack_progress/`
- `server/src/learning/review.service.ts` (addWordCard), `server/src/insights/plan.engine.ts`
- new: `apps/web/src/hooks/useVocabPacks.ts`, `components/packs/packIcons.ts`, `pages/PacksPage.tsx`, `pages/PackPage.tsx`
- shared: `schema.prisma`, `app.module.ts`, badge catalog/service and the two gamification specs, `routes/index.tsx`, `Sidebar.tsx`, `DashboardPage.tsx`

---

## 5. feat: make the app installable and add push notifications

```
feat: make the app installable and add push notifications

Web app manifest, icons, service worker (offline page, asset cache, push
display and click handling) and an install/alerts card in Settings plus a
one-time dashboard banner. Server: Web Push via the web-push library
(VAPID keys from the environment), PushSubscription table, /push routes,
every in-app notification also pushed, and a daily practice reminder at
the user's chosen time on their own clock. Signing out removes the
device's subscription.

Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in server/.env.
```

Files:
- new: `apps/web/public/manifest.webmanifest`, `sw.js`, `offline.html`, `icons/`; changed: `apps/web/public/favicon.svg`, `apps/web/index.html`, `apps/web/src/main.tsx`
- new: `apps/web/src/lib/pwa.ts`, `lib/push.ts`, `hooks/usePush.ts`, `components/settings/AppAlertsCard.tsx`, `components/notifications/EnableAlertsBanner.tsx`
- `apps/web/src/components/settings/SettingsForm.tsx`, `apps/web/src/contexts/AuthContext.tsx`
- new: `server/src/push/`, `server/src/notifications/daily-reminder.engine.ts`, `daily-reminder.service.ts`, `daily-reminder.spec.ts`
- new: `server/prisma/migrations/20261105150000_add_push_subscriptions/`
- `server/src/notifications/notifications.service.ts`, `notifications.service.spec.ts`, `notifications.module.ts`
- `server/package.json`, `pnpm-lock.yaml` (web-push)
- shared: `schema.prisma`, `app.module.ts`, `routes/index.tsx`, `DashboardPage.tsx`
- **not committed:** `server/.env` (holds the keys)

---

## 6. feat: add word of the day

```
feat: add word of the day

One word per level per day from the word packs (no repeats until the list
runs out), on the learner's own calendar day. Dashboard card with a
guess-the-meaning check and save-to-review; the evening reminder now
teaches the day's word.
```

Files:
- new: `server/src/vocab-packs/word-of-day.ts`, `word-of-day.spec.ts`, `apps/web/src/components/packs/WordOfDayCard.tsx`
- `server/src/vocab-packs/packs.service.ts`, `packs.controller.ts`, `server/src/notifications/daily-reminder.*`
- shared: `useVocabPacks.ts`, `DashboardPage.tsx`

---

## 7. fix: stop the dashboard overflowing on phones

```
fix: stop the dashboard overflowing on phones

The two lg:grid-cols-5 rows had no mobile column, so wide cards stretched
the page past the screen. Add grid-cols-1.
```

Files: `apps/web/src/pages/DashboardPage.tsx` (the two grid lines only)

---

## 8. feat: add listening dictation and shadowing

```
feat: add listening dictation and shadowing

Dictation: six level sentences read aloud, typed back, marked word by word
(right, spelling slip, wrong, missing, extra). First one each day gives
6 XP; missed sentences become flashcards. Shadowing: listen and say it
back, scored by the pronunciation checker. Adds dictation badges.
```

Files:
- new: `server/src/dictation/`, `server/prisma/migrations/20261105180000_add_dictation_results/`
- new: `apps/web/src/hooks/useDictation.ts`, `pages/DictationPage.tsx`, `pages/ShadowingPage.tsx`
- shared: `schema.prisma`, `app.module.ts`, `review.service.ts`, badge catalog/service/specs, `BadgeIcon.tsx`, `routes/index.tsx`, `Sidebar.tsx`, `DashboardPage.tsx`

---

## 9. feat: add guided role-play conversations

```
feat: add guided role-play conversations

Nine everyday scenarios (A1-C1): the app speaks the other person's lines,
the learner picks a reply and says it aloud for a score, with useful
phrases and an "I said it" option without a mic. First finish gives 8 XP.
```

Files:
- new: `server/src/roleplay/`, `server/prisma/migrations/20261105200000_add_roleplay_progress/`
- new: `apps/web/src/hooks/useRoleplay.ts`, `components/roleplay/scenarioIcons.ts`, `pages/RoleplayListPage.tsx`, `pages/RoleplayPage.tsx`
- shared: `schema.prisma`, `app.module.ts`, badge catalog/service/specs, `BadgeIcon.tsx`, `routes/index.tsx`, `Sidebar.tsx`, `DashboardPage.tsx`

---

## 10. feat: add friend challenges

```
feat: add friend challenges

Challenge a friend to beat your best on a grammar lesson, pack quiz or
dictation. The score to beat is read from the database; the challenge
settles when the friend finishes the same activity, both get notified,
and beating it gives 5 XP. Dashboard card and result-screen buttons.
```

Files:
- new: `server/src/friend-challenges/`, `server/prisma/migrations/20261105210000_add_friend_challenges/`
- `server/src/grammar/grammar.service.ts`, `grammar.module.ts`, `server/src/vocab-packs/packs.module.ts`, `server/src/dictation/dictation.module.ts`
- new: `apps/web/src/hooks/useFriendChallenges.ts`, `components/challenges/`
- `apps/web/src/hooks/useGrammar.ts`, `useDictation.ts`, `pages/GrammarLessonPage.tsx`, `pages/PackPage.tsx`, `pages/DictationPage.tsx`, `components/notifications/NotificationBell.tsx`
- shared: `schema.prisma`, `app.module.ts`, `packs.service.ts`, `dictation.service.ts`, `useVocabPacks.ts`, `SettingsForm.tsx` (label), `DashboardPage.tsx`

---

## 11. feat: add voice session recaps

```
feat: add voice session recaps

After leaving a voice room, show a recap built from the saved session
report: time spoken, fluency, corrections received, words saved, people
in the room and one tip for next time. "My sessions" lists past recaps.
```

Files:
- new: `server/src/voice/coach/recap.ts`, `recap.spec.ts`
- `server/src/voice/coach/coach.service.ts`, `coach.controller.ts`
- new: `apps/web/src/hooks/useSessionRecap.ts`, `pages/SessionRecapPage.tsx`, `pages/SessionsPage.tsx`
- `apps/web/src/pages/VoicePage.tsx`
- shared: `routes/index.tsx`, `Sidebar.tsx`

---

## 12. feat: match random-call partners by shared interests

```
feat: match random-call partners by shared interests

Matching now favours shared interests and partners the person rated 4 or 5
before (the existing safety rules still apply first). The call screen
shows what the two people have in common.
```

Files: `server/src/random-call/matching.ts`, `matching.spec.ts`, `random-call.service.ts`, `apps/web/src/components/call/useRandomCall.ts`, `CallScreens.tsx`

---

## 13. feat: add offline mode

```
feat: add offline mode

The service worker keeps the last good copy of learning content (library,
grammar, word packs, account) and of the app shell, so they open offline.
"Save for offline" in Settings downloads everything at once, an offline
bar shows when disconnected, and signing out wipes the saved data.
```

Files:
- new: `apps/web/src/lib/offline.ts`, `components/OfflineBanner.tsx`
- `apps/web/public/sw.js`, `lib/pwa.ts`, `components/settings/AppAlertsCard.tsx`, `contexts/AuthContext.tsx`, `routes/index.tsx`

---

## Shared files (touched by several commits)

`server/prisma/schema.prisma`, `server/src/app.module.ts`, `server/src/gamification/badges.catalog.ts`,
`badges.service.ts`, `gamification.engine.spec.ts`, `gamification.service.spec.ts`,
`server/src/learning/review.service.ts`, `server/src/vocab-packs/packs.service.ts`,
`server/src/dictation/dictation.service.ts`, `server/src/notifications/daily-reminder.*`,
`apps/web/src/routes/index.tsx`, `components/Sidebar.tsx`, `pages/DashboardPage.tsx`,
`components/gamification/BadgeIcon.tsx`, `components/settings/SettingsForm.tsx`,
`components/settings/AppAlertsCard.tsx`, `contexts/AuthContext.tsx`, `lib/pwa.ts`,
`hooks/useVocabPacks.ts`, `apps/web/public/sw.js`

## Also uncommitted, from before this session

If VS Code still shows earlier work as changed (badges and leagues, daily challenge, library, weekly
quests), those need their own commits; they are not covered above.
