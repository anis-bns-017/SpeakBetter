// server/src/profile/speaking-effects.ts
// The speaking effects someone can pick for their avatar in voice rooms. The web app draws them and keeps the same
// list (apps/web/src/components/voice/effects/speakingEffects.ts): add an effect in both places.

export const SPEAKING_EFFECT_IDS = [
  'classic',
  'cat-ears',
  'butterflies',
  'bee',
  'songbirds',
  'koi',
  'lion-mane',
  'dragon',
  'foxfire',
  'penguins',
  'crown',
  'laurel',
  'sun-king',
  'royal-velvet',
  'mughal',
  'pharaoh',
  'jade-emperor',
  'sakura',
  'borsha',
  'aurora',
  'galaxy',
] as const;

export type SpeakingEffectId = (typeof SPEAKING_EFFECT_IDS)[number];

const KNOWN = new Set<string>(SPEAKING_EFFECT_IDS);

export const isSpeakingEffect = (value: unknown): value is SpeakingEffectId =>
  typeof value === 'string' && KNOWN.has(value);

/** What to store: classic is the default, so it is kept as null */
export const storedSpeakingEffect = (
  effect: SpeakingEffectId,
): string | null => (effect === 'classic' ? null : effect);
