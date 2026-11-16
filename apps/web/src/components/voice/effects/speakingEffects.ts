// apps/web/src/components/voice/effects/speakingEffects.ts
// The speaking effects people can pick for their avatar (Settings → Speaking effect). Everyone in a voice room
// sees a speaker's own choice while they talk. Drawn by SpeakingEffect.tsx with styles/speaking-effects.css.
// The server keeps the same list of ids (server/src/profile/speaking-effects.ts): add an effect in both places.
import { msg } from "../../../i18n/core";

export const SPEAKING_EFFECT_IDS = [
  "classic",
  // Animals
  "cat-ears",
  "butterflies",
  "bee",
  "songbirds",
  "koi",
  "lion-mane",
  "dragon",
  "foxfire",
  "penguins",
  // Imperial
  "crown",
  "laurel",
  "sun-king",
  "royal-velvet",
  "mughal",
  "pharaoh",
  "jade-emperor",
  // Nature and magic
  "sakura",
  "borsha",
  "aurora",
  "galaxy",
] as const;

export type SpeakingEffectId = (typeof SPEAKING_EFFECT_IDS)[number];

export const DEFAULT_SPEAKING_EFFECT: SpeakingEffectId = "classic";

export type SpeakingEffectGroup = "classic" | "animals" | "imperial" | "nature";

export interface SpeakingEffectInfo {
  id: SpeakingEffectId;
  group: SpeakingEffectGroup;
  /** English, shown through tr() */
  name: string;
  description: string;
}

export const SPEAKING_EFFECT_GROUPS: { id: SpeakingEffectGroup; label: string }[] = [
  { id: "classic", label: msg("Classic") },
  { id: "animals", label: msg("Animals") },
  { id: "imperial", label: msg("Imperial") },
  { id: "nature", label: msg("Nature and magic") },
];

export const SPEAKING_EFFECTS: SpeakingEffectInfo[] = [
  { id: "classic", group: "classic", name: msg("Classic glow"), description: msg("A soft glow, a turning ring and ripples.") },

  { id: "cat-ears", group: "animals", name: msg("Cat Ears"), description: msg("Twitching cat ears, a swaying tail and a little bell.") },
  { id: "butterflies", group: "animals", name: msg("Butterfly Waltz"), description: msg("Butterflies flutter in circles around you.") },
  { id: "bee", group: "animals", name: msg("Busy Bee"), description: msg("A honeycomb ring and a bee buzzing loops round you.") },
  { id: "songbirds", group: "animals", name: msg("Songbirds"), description: msg("Two little birds sit on a flowering vine and sing.") },
  { id: "koi", group: "animals", name: msg("Koi Pond"), description: msg("Koi swim round a pond ring beside a lotus.") },
  { id: "lion-mane", group: "animals", name: msg("Lion's Mane"), description: msg("A golden mane that grows as you speak louder.") },
  { id: "dragon", group: "animals", name: msg("Little Dragon"), description: msg("Dragon wings beat behind you as flames flicker round.") },
  { id: "foxfire", group: "animals", name: msg("Foxfire"), description: msg("Nine fox tails fan out as blue spirit flames circle.") },
  { id: "penguins", group: "animals", name: msg("Penguin Parade"), description: msg("Two penguins and an ice ring, with snow falling.") },

  { id: "crown", group: "imperial", name: msg("Imperial Crown"), description: msg("A jewelled crown and a gem-set ring of gold.") },
  { id: "laurel", group: "imperial", name: msg("Caesar's Laurel"), description: msg("A golden Roman laurel wreath sways around you.") },
  { id: "sun-king", group: "imperial", name: msg("Sun King"), description: msg("Golden sun rays turn slowly behind you.") },
  { id: "royal-velvet", group: "imperial", name: msg("Royal Velvet"), description: msg("Purple velvet with pearls, gold and a fleur-de-lis.") },
  { id: "mughal", group: "imperial", name: msg("Mughal Darbar"), description: msg("A Mughal palace arch with gold lattice and marigolds.") },
  { id: "pharaoh", group: "imperial", name: msg("Pharaoh's Gold"), description: msg("A winged sun disk and a jewelled collar of gold and lapis.") },
  { id: "jade-emperor", group: "imperial", name: msg("Jade Emperor"), description: msg("A red and gold ring with clouds and a flying phoenix.") },

  { id: "sakura", group: "nature", name: msg("Sakura Storm"), description: msg("A blossoming cherry branch with petals drifting down.") },
  { id: "borsha", group: "nature", name: msg("Borsha Rain"), description: msg("Monsoon rain on a pond of blooming shapla.") },
  { id: "aurora", group: "nature", name: msg("Aurora"), description: msg("Northern-lights colours wave around your ring.") },
  { id: "galaxy", group: "nature", name: msg("Galaxy Orbit"), description: msg("Little planets and stars orbit around you.") },
];

const KNOWN = new Set<string>(SPEAKING_EFFECT_IDS);

/** Any stored or received value as an effect; unknown or missing values are the classic glow */
export function readSpeakingEffect(value: unknown): SpeakingEffectId {
  return typeof value === "string" && KNOWN.has(value) ? (value as SpeakingEffectId) : DEFAULT_SPEAKING_EFFECT;
}

export const speakingEffectInfo = (id: SpeakingEffectId): SpeakingEffectInfo =>
  SPEAKING_EFFECTS.find((e) => e.id === id) ?? SPEAKING_EFFECTS[0];
