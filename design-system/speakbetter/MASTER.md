# SpeakBetter design system (Master)

The single source of truth for how SpeakBetter looks and moves. Page files in `pages/` may override a rule for one
page; otherwise this file wins. The tokens live in `apps/web/src/index.css` (`@theme`), so a change there reaches
every page.

How this was chosen (UI UX Pro Max): the generator's two whole-product suggestions did not fit (one was built for
children's apps, one for luxury fashion), so the system is assembled from verified focused searches: the
"Language Learning App" colour profile, the "Soft UI Evolution" and "Dimensional Layering" styles, and the Outfit /
Plus Jakarta Sans type pairing.

## Product

Social English-learning app for teens and adults: live voice rooms, random calls, chat, review (FSRS), dictionary,
writing, quests. Daily-habit product used on phones and laptops. Tone: warm, confident, encouraging; never childish.

## Style: Soft UI Evolution, with dimensional layering

- Surfaces are clean white (light) or a lifted slate/navy (dark) on a slightly cool page background.
- Depth comes from soft, layered shadows (4 levels), not from heavy borders or gradients everywhere.
- Colour is used with intent: indigo for the main action and the current place, green for progress, amber for
  streaks and attention, rose for live and errors. Each section of the app keeps its accent (Home indigo, Speak rose,
  Learn emerald).
- Gradients only on hero moments (one per screen at most): the main call to action, a level-up, a result.
- Avoid: glass everywhere, neon glows, emoji as icons, more than one primary button per screen, grey text on grey.

## Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | #4F46E5 (indigo-600) | #818CF8 (indigo-400) | main action, links, current item |
| `primary-hover` | #4338CA | #A5B4FC | hover/pressed |
| `on-primary` | #FFFFFF | #0B1020 | text on primary |
| `success` / progress | #16A34A | #4ADE80 | learned, correct, streak kept |
| `warning` | #D97706 | #FBBF24 | due, attention, streak |
| `danger` | #DC2626 | #F87171 | errors, live, destructive |
| `background` | #F6F7FB | slate-900 (navy: #12264C) | page |
| `surface` | #FFFFFF | white 3-7% over page | cards, panels |
| `foreground` | #0F172A | #F1F5F9 | body text |
| `muted-foreground` | #475569 | #94A3B8 | secondary text (both pass 4.5:1) |
| `border` | #E2E8F0 | white 7-10% | dividers, card edges |
| `ring` | #6366F1 | #818CF8 | focus ring |

Rules: text contrast 4.5:1 (3:1 only for large text and icons); never colour alone (add a word or icon);
the theme switcher (light, dark, navy, auto) must look right in all four.

## Typography

- Headings and big numbers: **Outfit** (600-800), tracking -0.015em, balanced wrapping.
- Everything else: **Plus Jakarta Sans** (400 body, 500 labels, 600-700 emphasis).
- Scale (px): 12 caption, 13 small, 14 UI, 16 body, 18 lead, 20 h4, 24 h3, 30 h2, 36-48 h1/hero.
- Body line height 1.5-1.6; lines 60-75 characters on desktop.
- Numbers that change (XP, counts, timers): `tabular-nums`.

## Spacing, radius, elevation

- Spacing: 4 px grid (Tailwind scale). Card padding 16-24; section gap 16-24; page gutter 16 (phone) to 32.
- Radius: 8 chips and small controls; 12 buttons and inputs; 16 small cards; 24 cards and panels; full for pills.
- Elevation (shadow tokens, cool slate tint): xs hairline, sm resting card, md raised/hover, lg popovers and
  sheets, xl dialogs. Dark mode leans on borders and lighter surfaces, with deeper but subtler shadows.
- Layers (z-index): content 0, sticky 10, sidebar 50, toasts 100, dialogs 150-200.

## Interaction and motion

- Hover 150 ms, state changes 200-250 ms, entrances 300-400 ms with a spring; exits faster than entrances.
- Press feedback: scale 0.97-0.98; never shift layout.
- Focus: always visible, 2 px indigo ring with 2 px offset.
- Every clickable thing shows a pointer cursor; touch targets at least 44 px on phones.
- Respect `prefers-reduced-motion`: animations become instant fades.

## Components

- Page header: icon tile (section colour, 48 px, radius 16) + h1 + one-line subtitle + at most one primary action.
- Card: `surface`, radius 24, border, shadow-sm; hover shadow-md when the card is clickable.
- Button: primary (indigo fill), secondary (outline), ghost (text); height 40 (44 on phones), radius 12.
- Chip / filter: pill, 32 px high; selected = indigo fill.
- Empty state: icon tile + one sentence + one action.
- Charts: one hue per series, legend for 2+ series, tooltip, a hidden table for screen readers.
