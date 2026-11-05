import {
  ALLOW_REPEAT_AFTER_MS,
  Goal,
  Level,
  WIDEN_TO_ANY_AFTER_MS,
  WIDEN_TO_ONE_AFTER_MS,
  levelIndex,
} from './random-call.constants';

export interface QueueEntry {
  userId: string;
  level: Level;
  goal: Goal;
  language: string;
  joinedAt: number;
  /** People either side blocked: never matched together */
  blocked: string[];
  /** People met in the last couple of hours: skipped unless the wait is long */
  recent: string[];
  /** Average rating from other people (1-5), null while there are too few */
  reputation: number | null;
  /** Profile interests, lower case (older queue entries may not have them) */
  interests?: string[];
  /** People this person rated 4 or 5 stars in an earlier call */
  liked?: string[];
}

/** Interests two people share (compared without case) */
export function sharedInterests(a: string[] | undefined, b: string[] | undefined): string[] {
  const theirs = new Set((b ?? []).map((i) => i.trim().toLowerCase()).filter(Boolean));
  return [...new Set((a ?? []).map((i) => i.trim().toLowerCase()).filter((i) => theirs.has(i)))];
}

/** The most shared interests that still raise a match's score */
export const MAX_INTEREST_BONUS = 3;
/** Bonus for someone either of you rated highly before */
export const LIKED_BONUS = 2;

/** How far apart two levels may be, given how long the longer wait has been */
export function maxLevelGap(waitedMs: number): number {
  if (waitedMs >= WIDEN_TO_ANY_AFTER_MS) return 2;
  if (waitedMs >= WIDEN_TO_ONE_AFTER_MS) return 1;
  return 0;
}

export function compatible(a: QueueEntry, b: QueueEntry, now: number): boolean {
  if (a.userId === b.userId) return false;
  if (a.language.toLowerCase() !== b.language.toLowerCase()) return false;
  if (a.blocked.includes(b.userId) || b.blocked.includes(a.userId)) return false;

  const waited = Math.max(now - a.joinedAt, now - b.joinedAt);
  const metRecently = a.recent.includes(b.userId) || b.recent.includes(a.userId);
  if (metRecently && waited < ALLOW_REPEAT_AFTER_MS) return false;

  const gap = Math.abs(levelIndex(a.level) - levelIndex(b.level));
  return gap <= maxLevelGap(waited);
}

/**
 * Higher is a better match: same goal, same level, similar reputation, things in common, and people you
 * enjoyed talking to before.
 */
export function matchScore(a: QueueEntry, b: QueueEntry): number {
  let score = 0;
  if (a.goal === b.goal) score += 3;
  score += Math.min(MAX_INTEREST_BONUS, sharedInterests(a.interests, b.interests).length);
  if ((a.liked ?? []).includes(b.userId) || (b.liked ?? []).includes(a.userId)) score += LIKED_BONUS;
  score -= 2 * Math.abs(levelIndex(a.level) - levelIndex(b.level));
  if (a.reputation !== null && b.reputation !== null) {
    score -= Math.abs(a.reputation - b.reputation);
  }
  return score;
}

/**
 * Pairs people waiting in the queue. Whoever has waited longest picks first,
 * and gets the best compatible partner still available.
 */
export function findPairs(
  entries: QueueEntry[],
  now: number,
): Array<[QueueEntry, QueueEntry]> {
  const waiting = [...entries].sort((x, y) => x.joinedAt - y.joinedAt);
  const taken = new Set<string>();
  const pairs: Array<[QueueEntry, QueueEntry]> = [];

  for (const entry of waiting) {
    if (taken.has(entry.userId)) continue;
    let best: QueueEntry | null = null;
    let bestScore = -Infinity;
    for (const other of waiting) {
      if (other === entry || taken.has(other.userId)) continue;
      if (!compatible(entry, other, now)) continue;
      const score = matchScore(entry, other);
      if (score > bestScore) {
        best = other;
        bestScore = score;
      }
    }
    if (best) {
      taken.add(entry.userId);
      taken.add(best.userId);
      pairs.push([entry, best]);
    }
  }
  return pairs;
}
