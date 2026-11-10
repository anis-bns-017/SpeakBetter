# SpeakBetter design system

One source of truth for how the web app looks and behaves. Tokens live in `src/index.css` (`@theme`), shared
components in `src/components/ui/index.tsx`. Change a token and every page follows. This replaces
`design-system/speakbetter/MASTER.md`, which described the earlier indigo/Outfit direction.

Built with the UI UX Pro Max skill. Its whole-product suggestion for "language learning" was Claymorphism with
Baloo 2 + Comic Neue (a children's look), which does not fit teens and adults. The system below keeps the skill's
verified building blocks (Soft UI Evolution depth, the Language Learning colour profile's "learning blue + progress
green" logic, WCAG 2.2 rules) and gives them a distinct identity.

## 1. What the app is

A daily-habit English-learning product for teens and adults, used on phones and laptops: voice rooms, calls,
chat, flashcards, dictionary (13,000 words), word packs, writing, quests, leagues. Tone: warm, confident,
encouraging. Never childish, never "AI startup template".

## 2. Style: "Paper and Ink", Soft UI Evolution

- A warm paper page (`#F7F5F1`) with white surfaces, hairline warm borders and soft, warm-tinted shadows.
  Depth comes from layering, not from glow, blur or neon.
- One brand colour, **Lapis** (a deep ink blue), used with intent: the main action, the current place, links.
- Gradients are rare: one quiet Lapis wash for a hero card (`<Card tone="tint">`), and the XP bar. No
  cyan-to-violet gradients, no glass-on-glass, no coloured glow shadows.
- Section accents stay: Home = lapis, Speak = rose, Learn = emerald, streak/attention = amber (saffron).
- Icons: Lucide only, one stroke weight, never emoji as an icon.
- Dark and Navy are designed together with light (see section 4), not inverted from it.

## 3. Colour

All colours are Tailwind utilities backed by tokens. Never write a raw hex in a component.

| Role | Token / class | Light | Dark | Use |
|---|---|---|---|---|
| Brand | `indigo-600` (Lapis) | #3B4FB2 | `indigo-400` #8EA3E8 for text, `indigo-500` #4F66C8 for fills | primary button, active item, links (`indigo-700` text on light, `indigo-300` on dark) |
| Brand scale | `indigo-50 … 950` | #EEF1FB … #121A3B | same | tints, chips, focus ring (`indigo-500`) |
| Iris | `violet-*` / `purple-*` | muted, next to Lapis | | second stop of legacy gradients only |
| Page | `bg-page` | #F7F5F1 | slate-900 (Navy: #12264C) | the page behind everything |
| Surface | `bg-surface` | #FFFFFF | slate-900 + 6% white | cards, panels, inputs |
| Line | `border-line` | #E3E0D9 | white 9% | card edges, dividers |
| Ink | `slate-900` → `slate-600` | #1A1916 → #4B4943 | slate-100 → slate-400 | text (600 and darker for anything you must read) |
| Muted | `slate-500` | #5E5B53 (6.2:1 on page) | slate-400 | secondary text |
| Faint | `slate-400` | #716E65 (4.7:1 on page) | slate-500 | captions, placeholders, icons; the lightest text allowed |
| Success | `emerald` | 700 text on 50 | 200 text on 400/15% | learned, correct |
| Warning | `amber` | 800/900 text on 50 | 200 on 400/15% | due, streak |
| Danger | `red` | 700 text on 50 | 200 on 400/15% | errors, destructive, live |

Light-mode neutrals (`slate-*`, `gray-*`) are remapped to a warm "stone" scale in `:root:not(.dark)`; Dark keeps
Tailwind's slate and Navy swaps in its own scale (`[data-theme="navy"]`). Components use the same classes in
every theme.

Contrast (measured): white on `indigo-600` 7.1:1; `indigo-600` on page 6.5:1; `slate-600` on page 8.3:1;
`slate-500` on page 6.2:1; `slate-400` on page 4.7:1. In light mode the status 600 steps (amber, orange, emerald, green, teal, cyan, sky, rose, pink, red) are remapped to their
700 values in `index.css`, because the stock 600s are only 3.2-4.1:1 as small text. In dark and navy, `slate-500` and
`indigo-400` are lifted for the same reason. Rules: body text 4.5:1, large text and UI icons 3:1; status is always a word or icon
plus colour (`<Badge>`).

## 4. Themes

`light`, `dark`, `navy`, `system` (see `src/lib/theme.ts`; unchanged). `dark` class on `<html>` enables every
`dark:` utility; `data-theme="navy"` swaps the slate scale. New code uses the semantic tokens (`bg-page`,
`bg-surface`, `border-line`) so it needs few or no `dark:` classes. Check every new screen in all three.

## 5. Typography

- **Fraunces** (variable serif, 500-700): page titles (`h1`), big numbers (`.font-display`, `<Stat>`), the auth
  headline. Optical sizing on, tracking -0.02em.
- **Plus Jakarta Sans**: everything else. 400 body, 500 labels, 600-700 emphasis and section titles.
- Scale (px): 11 eyebrow/caption (`.t-eyebrow`, uppercase, +0.12em), 12-13 small, 14 UI, 15 field text, 16 body,
  18 lead, 24 h3, 26/32 page title (mobile/desktop), 40-60 hero.
- Body line-height 1.5-1.6, measure 60-75 characters. Numbers that change use `tabular-nums`.
- Inputs are 16px on phones (prevents iOS zoom), 14px from `sm` up.

## 6. Spacing, radius, elevation

- Spacing: 4px grid (Tailwind scale). Card padding 20 (16 on phones). Gap between cards 16-20. Section gap 24-32.
  Page gutter 16 / 24 / 32 at phone / tablet / desktop. Content max-width 1152 (`max-w-6xl`) for browsing
  pages, 672-768 for reading and forms.
- Radius: **8** chips and badges (`rounded-md`), **12** buttons and inputs (`rounded-xl`), **16** icon tiles and
  small cards (`rounded-2xl`), **20** cards and panels (`rounded-3xl`), full for pills and avatars.
- Elevation (warm-tinted tokens): `shadow-xs` hairline, `shadow-sm` resting card, `shadow-md` hover/raised,
  `shadow-lg` popovers, `shadow-xl` dialogs. Dark mode relies on borders and lighter surfaces.
- Z-index: content 0, sticky 10, floating bell 40, sidebar 50, toast 100, dialogs 150-200, skip link 300.

## 7. Components (`src/components/ui`)

`Button` (primary, secondary, soft, ghost, danger; sm/md/lg), `IconButton` (44px, label required), `Card`
(default, tint, inset), `PageHeader` (section label in the section colour, a 34/46px serif title, one line of context, actions on the right, closed by a hairline),
`SectionHeader`, `EmptyState`, `Field` + `Input` / `Textarea` / `Select` (visible label, helper or error tied
with `aria-describedby`), `Chip` (filter pill, `aria-pressed`), `Tabs` (arrow-key navigation), `Badge`, `Stat`,
`Skeleton`. Frame for sign-in screens: `components/common/AuthShell.tsx`.

Rules: one primary button per screen; every input has a visible label; empty states say what to do next;
destructive actions use `danger` and ask first; loading buttons use `loading` (disabled + spinner + `aria-busy`).

### Shell rules

- Sidebar: calm and flat. No ambient blobs, light beams or shimmer. The active item is a white pill with a hairline
  and a flat tile in its section colour (Home lapis, Speak rose, Learn emerald). One solid lapis "Start speaking" button.
- Page start: always `PageHeader`. Hero panels (Dashboard today, Progress, Writing, Pronunciation, Recap, Packs "start
  here") are solid `bg-indigo-900` with a white-on-lapis hairline ring, never a multi-colour gradient.
- Filter chips: selected = lapis fill, unselected = `border-line bg-surface`. Dashboard numbers sit in one divided
  strip, not six separate cards.

## 8. Interaction and motion

- Hover 150ms, state changes 180-250ms, entrances 300-400ms with ease-out; exits faster than entrances.
- Press: scale 0.98, never moves layout. Focus: 2px Lapis ring with 2px offset on every interactive element.
- Only `transform` and `opacity` are animated. `prefers-reduced-motion` stops decorative motion
  (already handled globally in `index.css`).
- Pointer cursor on everything clickable; `touch-manipulation` on buttons.

## 9. Responsive

Mobile first. Breakpoints 375 / 640 (`sm`) / 768 / 1024 (`lg`: sidebar appears) / 1280. Below `lg` the sidebar
becomes the bottom tab bar (`--tabbar-h`). No horizontal page scroll at 375px. Use `min-h-dvh`, not `100vh`.
Cards stack to one column on phones; filter rows scroll horizontally rather than wrap.

## 10. Accessibility checklist (WCAG 2.2 AA)

- Skip link to `#main` (in `AppLayout`); focus moves to `<main>` after a route change.
- Touch targets: 24px minimum everywhere; on touch screens every button, tab and block-style link also gets an
  invisible 44 x 44 hit area (`@media (pointer: coarse)` rule in `index.css`, opt out with `tap-none`). Shared
  components are also 40-44px tall on phones.
- Icon-only controls have an `aria-label`; decorative icons are `aria-hidden`.
- Form errors sit under the field (`role="alert"`) and are linked with `aria-describedby`.
- Colour is never the only signal. Charts need a legend and a text alternative.
- Check light, dark and navy for contrast independently; keyboard-tab every new screen once.

## 11. Using it

```tsx
import { PageHeader, Card, Button, Chip, Tabs, Field, Input, Stat, Badge } from "../components/ui";

<PageHeader icon={BookA} tone="sky" title="Dictionary" subtitle="13,000 words" actions={<Button>Take the test</Button>} />
<Card tone="tint">…</Card>
```

Page wrapper: `min-h-screen bg-page py-8 px-4 sm:px-6 lg:px-8` then `max-w-6xl mx-auto space-y-5`.

## 12. Voice room "stage"

The room is the product's showpiece, so it is the most animated screen. All motion lives in `src/styles/voice-stage.css`
and uses only `transform` and `opacity`; every animation stops under `prefers-reduced-motion` (the light stays, the
movement goes). Colours are `--vr-*` variables, so light, dark and navy all work.

- **Backdrop** (`RoomBackdrop`): three slow aurora orbs (Lapis, Orchid, a touch of Saffron), twelve rising motes, film
  grain and a vignette. It brightens while anyone is speaking.
- **Panels** (`RoomCard`): deep glass with a conic edge of light that travels around the border (`.vr-edge`, 16s loop).
- **Entrance:** header, stage and dock rise in one after another (`.vr-enter`, 700ms, staggered 120ms).
- **Speakers:** a breathing aura, a turning conic ring and two ripples that follow the live voice level
  (`.vr-halo-*`). People on stage get 104px avatars, the audience 56px.
- **Dock:** a glass capsule. The mic is a 56px hero button with a breathing aura while you are live (`.vr-aura`).
- **Small touches:** a calm expanding live dot (`.vr-live-dot`), a tiny equalizer beside "speaking", a sheen on the Clap
  button, springy reaction emoji, all with labels for screen readers.
- Rules: nothing animates layout properties; ambient motion stays below the content (z-order); no emoji as status text.

## 13. Voice lobby

The lobby (`/voice`) is the doorway to the stage, so it shares the room's light (`LobbyBackdrop`: the same slow aurora
orbs, softened and faded out toward the bottom) and its entrance (`.vr-enter`: header, hero and stats rise in turn).

- **Header:** live pill, 34/46px serif title, one line of context. Primary action is the solid Lapis "Create room"; "Random call" is the quiet secondary.
- **Hero:** the busiest live room (or an invitation to start one) on a 28px panel with the travelling edge of light (`.vr-edge`). Its Join button takes the room type's colour; with no live room, the solid Lapis "Create a room".
- **Stats:** one divided strip with serif numbers, like the dashboard, not four separate cards.
- **Room cards:** 24px radius, a faint wash in the room type's colour, a 3px accent line, serif room title, 44px join and share buttons. Pin star is 40px.
- **Filters:** selected state is Lapis (`COLORS.primary`, `--lobby-primary`: indigo-600 in light, indigo-300 in dark and navy). Search and selects are 44px tall.
- **Colours:** the lobby and room read the `--sx-*` stage palette. Light is the warm paper set (`#F7F5F1` page, white cards, warm ink); dark and navy use the Lapis family. Light accents are mixed 62% toward black so white-ish text on them and tinted pills clear 4.5:1.
