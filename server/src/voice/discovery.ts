// server/src/voice/discovery.ts
/**
 * Finding rooms: search, filters, the orders on the Discover page and what to recommend. Pure functions over
 * rooms already fetched, so the choices can be tested without a database.
 */

import { languageName } from '../friends/friend-suggestions';

export interface DiscoverableRoom {
  name: string;
  description?: string | null;
  language?: string | null;
  topics?: string[] | null;
  tags?: string[] | null;
  categories?: string[] | null;
  trendScore?: number | null;
  creatorId: string;
  createdAt: Date | string;
  /** The people in the room right now */
  participants: Array<{ userId: string }>;
}

export interface RecommendationContext {
  learningLanguages: string[];
  interests: string[];
  /** Friends and people you follow */
  knownPeople: Set<string>;
}

/** How much one person in the room counts against one clap when ranking what is trending */
const TREND_PER_PERSON = 10;

const norm = (value: string) => value.trim().toLowerCase();

export const sameLanguage = (a?: string | null, b?: string | null) =>
  !!a && !!b && norm(languageName(a)) === norm(languageName(b));

/** The labels a room can be found under. The create form fills in topics; older rooms may have categories. */
const labelsOf = (room: DiscoverableRoom) => [...(room.categories ?? []), ...(room.topics ?? [])].filter(Boolean);

export const inCategory = (room: DiscoverableRoom, category: string) =>
  labelsOf(room).some((label) => norm(label) === norm(category));

/** Search covers everything the search box promises: name, description, topics, tags and language */
export function matchesQuery(room: DiscoverableRoom, query: string) {
  const q = norm(query);
  if (!q) return true;
  const fields = [room.name, room.description, room.language, room.language ? languageName(room.language) : null, ...labelsOf(room), ...(room.tags ?? [])];
  return fields.some((field) => !!field && norm(field).includes(q));
}

/** People in the room now count most; claps show which rooms people enjoyed */
export const trendOf = (room: DiscoverableRoom) => room.participants.length * TREND_PER_PERSON + (room.trendScore ?? 0);

const newest = (a: DiscoverableRoom, b: DiscoverableRoom) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export function recommendationScore(room: DiscoverableRoom, me: RecommendationContext) {
  let score = 0;
  if (me.learningLanguages.some((language) => sameLanguage(language, room.language))) score += 4;
  if (me.knownPeople.has(room.creatorId)) score += 3;
  score += Math.min(2, room.participants.filter((p) => me.knownPeople.has(p.userId)).length) * 2;
  const interests = new Set(me.interests.map(norm));
  score += Math.min(3, labelsOf(room).filter((label) => interests.has(norm(label))).length);
  // A room with people in it is worth joining; an empty one is not, however well it matches
  score += Math.min(5, room.participants.length) * 0.5;
  if (!room.participants.length) score -= 5;
  return score;
}

export function sortRooms<T extends DiscoverableRoom>(rooms: T[], sort: string, me?: RecommendationContext | null): T[] {
  const list = [...rooms];
  switch (sort) {
    case 'newest':
      return list.sort(newest);
    case 'popular':
      return list.sort((a, b) => b.participants.length - a.participants.length || newest(a, b));
    case 'recommended':
      if (me) return list.sort((a, b) => recommendationScore(b, me) - recommendationScore(a, me) || trendOf(b) - trendOf(a) || newest(a, b));
      return list.sort((a, b) => trendOf(b) - trendOf(a) || newest(a, b));
    default:
      return list.sort((a, b) => trendOf(b) - trendOf(a) || newest(a, b));
  }
}

/** The filter chips: only labels that have a room right now, with how many */
export function categoryCounts(rooms: DiscoverableRoom[]): Array<{ name: string; roomCount: number }> {
  const counts = new Map<string, { name: string; rooms: number }>();
  for (const room of rooms) {
    const seen = new Set<string>();
    for (const label of labelsOf(room)) {
      const key = norm(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key) ?? { name: label.trim(), rooms: 0 };
      entry.rooms++;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.rooms - a.rooms || a.name.localeCompare(b.name))
    .slice(0, 20)
    .map((c) => ({ name: c.name, roomCount: c.rooms }));
}
