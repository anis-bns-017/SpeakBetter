// server/src/friends/friend-suggestions.ts
//
// Ranking for "people you could practice with". Kept free of Prisma so it can be
// tested on its own; FriendsService does the fetching and the exclusions.

export interface SuggestionProfile {
  nativeLanguage?: string | null;
  learningLanguages?: string[] | null;
  interests?: string[] | null;
  lastActive?: Date | string | null;
}

export interface SuggestionCandidate {
  id: string;
  name: string;
  avatarUrl?: string | null;
  profile?: (SuggestionProfile & {
    country?: string | null;
    level?: string | null;
  }) | null;
}

export interface RankedSuggestion extends SuggestionCandidate {
  /** Higher is a better match; only meaningful relative to other suggestions */
  matchScore: number;
  /** One short line explaining why this person was suggested */
  reason: string;
  sharedInterests: string[];
  isRequested: false;
}

export const SUGGESTION_WEIGHTS = {
  /** They speak natively the language I'm learning */
  theyTeachMe: 5,
  /** They're learning my native language — they can practice with me */
  iTeachThem: 4,
  /** We're learning the same language */
  sharedLearning: 2,
  sharedInterest: 1,
  maxSharedInterests: 3,
  activeToday: 1.5,
  activeThisWeek: 0.75,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const norm = (s: string) => s.trim().toLowerCase();
const set = (list?: string[] | null) => new Set((list ?? []).filter(Boolean).map(norm));

/** Case-insensitive language/interest lists, keeping the candidate's own spelling */
function overlap(mine: Set<string>, theirs?: string[] | null): string[] {
  return (theirs ?? []).filter((x) => x && mine.has(norm(x)));
}

export function scoreSuggestion(
  me: SuggestionProfile | null | undefined,
  candidate: SuggestionCandidate,
  now: number = Date.now(),
): RankedSuggestion {
  const w = SUGGESTION_WEIGHTS;
  const their = candidate.profile ?? {};
  const myLearning = set(me?.learningLanguages);
  const myNative = me?.nativeLanguage ? norm(me.nativeLanguage) : null;

  const theirNative = their.nativeLanguage ?? null;
  const theyTeachMe = !!theirNative && myLearning.has(norm(theirNative));
  const iTeachThem = !!myNative && set(their.learningLanguages).has(myNative);
  const sharedLearning = overlap(myLearning, their.learningLanguages);
  const sharedInterests = overlap(set(me?.interests), their.interests).slice(0, w.maxSharedInterests);

  let score = 0;
  if (theyTeachMe) score += w.theyTeachMe;
  if (iTeachThem) score += w.iTeachThem;
  score += sharedLearning.length * w.sharedLearning;
  score += sharedInterests.length * w.sharedInterest;

  const last = their.lastActive ? new Date(their.lastActive).getTime() : NaN;
  const idle = Number.isFinite(last) ? now - last : Infinity;
  if (idle <= DAY_MS) score += w.activeToday;
  else if (idle <= 7 * DAY_MS) score += w.activeThisWeek;

  let reason: string;
  if (theyTeachMe && iTeachThem) {
    reason = `Perfect language exchange — ${theirNative} for ${me?.nativeLanguage}`;
  } else if (theyTeachMe) {
    reason = `Native ${theirNative} speaker — you're learning it`;
  } else if (iTeachThem) {
    reason = `Learning ${me?.nativeLanguage} — your native language`;
  } else if (sharedLearning.length) {
    reason = `Also learning ${sharedLearning[0]}`;
  } else if (sharedInterests.length) {
    reason = `Also into ${sharedInterests.join(", ")}`;
  } else if (idle <= DAY_MS) {
    reason = "Active today";
  } else {
    reason = "New to practice with";
  }

  return {
    ...candidate,
    matchScore: Math.round(score * 100) / 100,
    reason,
    sharedInterests,
    isRequested: false,
  };
}

/** Best matches first; ties go to whoever was active most recently */
export function rankSuggestions(
  me: SuggestionProfile | null | undefined,
  candidates: SuggestionCandidate[],
  limit: number,
  now: number = Date.now(),
): RankedSuggestion[] {
  const lastActive = (c: SuggestionCandidate) => {
    const t = c.profile?.lastActive ? new Date(c.profile.lastActive).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };
  return candidates
    .map((c) => scoreSuggestion(me, c, now))
    .sort((a, b) => b.matchScore - a.matchScore || lastActive(b) - lastActive(a))
    .slice(0, limit);
}
