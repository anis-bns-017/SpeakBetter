// server/src/voice/participant-select.ts
// The parts of a member's profile that the room shows next to their avatar: the country flag and their languages.
// Country and languages live on Profile (not User), so every query that loads a room member's `user` must also ask
// for the profile, or the tiles have nothing to show.
export const PARTICIPANT_PROFILE = {
  select: { country: true, nativeLanguage: true, learningLanguages: true },
} as const;
