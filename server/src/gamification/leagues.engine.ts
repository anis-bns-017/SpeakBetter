/**
 * Weekly leagues, the way language apps run them: everyone who earns XP in a week is put in a group of up
 * to 30 people in their league. When the week ends, the top of each group moves up a league and the bottom
 * moves down. Pure functions; the service does the storing.
 */

export const LEAGUES = [
  { name: 'Bronze', color: '#b4733c' },
  { name: 'Silver', color: '#8a94a6' },
  { name: 'Gold', color: '#d4a017' },
  { name: 'Sapphire', color: '#2f6fdb' },
  { name: 'Ruby', color: '#d03a4f' },
  { name: 'Emerald', color: '#1a9e63' },
  { name: 'Amethyst', color: '#8b52d9' },
  { name: 'Pearl', color: '#c58ea8' },
  { name: 'Obsidian', color: '#3d3a4b' },
  { name: 'Diamond', color: '#2bb3d9' },
] as const;

export const TOP_TIER = LEAGUES.length - 1;
export const GROUP_SIZE = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const clampTier = (tier: number) => Math.min(TOP_TIER, Math.max(0, Math.floor(tier) || 0));

/** Monday 00:00 of the week `date` falls in, in the server's time zone */
export function weekStartOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export const weekEndOf = (start: Date) => new Date(start.getTime() + 7 * DAY_MS);

/** YYYY-MM-DD of a week's Monday: the key a week is stored under */
export function weekKey(date: Date): string {
  const d = weekStartOf(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The Monday a week key stands for, at local midnight */
export function weekFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * How many move up and down in a group of `size`. A full group of 30 sends 7 up and 5 down; small groups
 * scale that down, and nobody is demoted from a group of fewer than 5 (losing to two people is no fun).
 */
export function zoneSizes(size: number, tier: number): { promote: number; demote: number } {
  if (size <= 1) return { promote: tier < TOP_TIER ? size : 0, demote: 0 };
  const promote = tier < TOP_TIER ? Math.max(1, Math.round((size * 7) / GROUP_SIZE)) : 0;
  const demote = tier > 0 && size >= 5 ? Math.max(1, Math.round((size * 5) / GROUP_SIZE)) : 0;
  // Never let the zones overlap in a small group
  return { promote, demote: Math.min(demote, Math.max(0, size - promote - 1)) };
}

export interface Standing {
  userId: string;
  xp: number;
  /** When they joined the group, to break ties (earlier wins) */
  joinedAt: Date;
}

export type Zone = 'promote' | 'stay' | 'demote';

export interface Ranked extends Standing {
  rank: number;
  zone: Zone;
}

/**
 * Orders a group by XP (ties: who joined first) and marks who would move. Someone with no XP never moves
 * up, and in a league above the first, finishing the week with no XP always means moving down.
 */
export function rankGroup(members: Standing[], tier: number): Ranked[] {
  const sorted = [...members].sort((a, b) => b.xp - a.xp || a.joinedAt.getTime() - b.joinedAt.getTime());
  const { promote, demote } = zoneSizes(sorted.length, tier);
  return sorted.map((m, i) => {
    let zone: Zone = 'stay';
    if (i < promote && m.xp > 0) zone = 'promote';
    else if (tier > 0 && (i >= sorted.length - demote || m.xp === 0)) zone = 'demote';
    return { ...m, rank: i + 1, zone };
  });
}

/** The league someone plays in next week */
export function nextTier(tier: number, zone: Zone): number {
  return clampTier(zone === 'promote' ? tier + 1 : zone === 'demote' ? tier - 1 : tier);
}
