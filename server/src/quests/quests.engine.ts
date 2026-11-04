/**
 * Weekly quests: three goals a week, sized to how much the learner practised last week and to the days left
 * when the week's quests are made. Every quest pays a little XP; doing all three opens a chest with bonus XP
 * and a streak freeze. Pure functions, so the rules are easy to test.
 */

export type QuestKind = 'XP' | 'DAYS' | 'PLAN' | 'SPEAK' | 'REVIEW' | 'READ' | 'CHALLENGE' | 'PRONUNCIATION' | 'CORRECTION';

export interface Quest {
  id: string;
  kind: QuestKind;
  target: number;
  xp: number;
}

/** XP for each quest done */
export const QUEST_XP = 20;
/** Bonus XP in the chest when all three are done */
export const CHEST_XP = 50;
/** Freezes a learner can hold at once */
export const MAX_FREEZES = 2;
/** What a freeze costs in the shop */
export const FREEZE_PRICE = 200;

/** Habit quests reward showing up; one of these is always in the week */
const HABIT: QuestKind[] = ['XP', 'DAYS', 'PLAN'];
/** Activity quests point at a part of the app; two of these each week */
const ACTIVITY: QuestKind[] = ['SPEAK', 'REVIEW', 'READ', 'CHALLENGE', 'PRONUNCIATION', 'CORRECTION'];
/** These can only go up by one a day, so they never ask for more than the days left */
const ONCE_A_DAY = new Set<QuestKind>(['DAYS', 'PLAN', 'CHALLENGE']);

/** Full-week targets for a light, regular and keen learner */
const TARGETS: Record<QuestKind, [number, number, number]> = {
  XP: [150, 350, 700],
  DAYS: [3, 5, 6],
  PLAN: [2, 4, 6],
  SPEAK: [10, 20, 40],
  REVIEW: [20, 50, 100],
  READ: [2, 3, 5],
  CHALLENGE: [2, 4, 6],
  PRONUNCIATION: [10, 20, 40],
  CORRECTION: [3, 6, 10],
};

/** Large targets are rounded to tidy numbers */
const STEP: Partial<Record<QuestKind, number>> = { XP: 10, REVIEW: 5, SPEAK: 5, PRONUNCIATION: 5 };

/** 0 light, 1 regular, 2 keen, from last week's XP */
export function intensity(lastWeekXp: number): 0 | 1 | 2 {
  if (lastWeekXp >= 500) return 2;
  if (lastWeekXp >= 150) return 1;
  return 0;
}

/** Days left in the week counting today: Monday 7, Sunday 1 */
export function daysLeftInWeek(now: Date, weekStart: Date): number {
  const elapsed = Math.floor((now.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
  return Math.min(7, Math.max(1, 7 - elapsed));
}

/** The target for one quest, scaled to the days left */
export function targetFor(kind: QuestKind, level: 0 | 1 | 2, daysLeft: number): number {
  const base = TARGETS[kind][level];
  if (ONCE_A_DAY.has(kind)) return Math.max(1, Math.min(base, daysLeft));
  const step = STEP[kind] ?? 1;
  const scaled = (base * daysLeft) / 7;
  return Math.max(step, Math.round(scaled / step) * step);
}

/** A small deterministic hash, so the same learner gets the same quests all week */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let state = hash(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface QuestSignals {
  lastWeekXp: number;
  daysLeft: number;
  /** userId:week, so each learner's week is different but stable */
  seed: string;
  /** Kinds to leave out this week (for example the ones in last week's quests) */
  avoid?: QuestKind[];
}

/** One habit quest and two activity quests */
export function buildQuests({ lastWeekXp, daysLeft, seed, avoid = [] }: QuestSignals): Quest[] {
  const level = intensity(lastWeekXp);
  const pick = (pool: QuestKind[], count: number, salt: string) => {
    const fresh = pool.filter((k) => !avoid.includes(k));
    // If avoiding leaves too few, fall back to the whole pool
    return shuffled(fresh.length >= count ? fresh : pool, `${seed}:${salt}`).slice(0, count);
  };
  const kinds = [...pick(ACTIVITY, 2, 'activity'), ...pick(HABIT, 1, 'habit')];
  return kinds.map((kind) => ({ id: kind.toLowerCase(), kind, target: targetFor(kind, level, daysLeft), xp: QUEST_XP }));
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the learner reads, and where the quest takes them */
export function questText(kind: QuestKind, target: number): { title: string; to: string | null } {
  switch (kind) {
    case 'XP':
      return { title: `Earn ${target} XP`, to: null };
    case 'DAYS':
      return { title: `Practise on ${plural(target, 'different day')}`, to: null };
    case 'PLAN':
      return { title: `Finish your daily plan on ${plural(target, 'day')}`, to: null };
    case 'SPEAK':
      return { title: `Speak for ${plural(target, 'minute')}`, to: '/voice' };
    case 'REVIEW':
      return { title: `Review ${plural(target, 'card')}`, to: '/flashcards' };
    case 'READ':
      return { title: `Read ${plural(target, 'text')} in the library`, to: '/library' };
    case 'CHALLENGE':
      return { title: `Answer ${plural(target, 'daily challenge')}`, to: '/challenge' };
    case 'PRONUNCIATION':
      return { title: `Do ${plural(target, 'pronunciation try', 'pronunciation tries')}`, to: '/pronunciation' };
    case 'CORRECTION':
      return { title: `Give ${plural(target, 'correction')}`, to: '/chat' };
  }
}

/** The bits of `mask` newly set by quests that are now done */
export function newlyDone(quests: Quest[], values: number[], mask: number): { mask: number; indexes: number[] } {
  let next = mask;
  const indexes: number[] = [];
  quests.forEach((q, i) => {
    const bit = 1 << i;
    if ((mask & bit) === 0 && (values[i] ?? 0) >= q.target) {
      next |= bit;
      indexes.push(i);
    }
  });
  return { mask: next, indexes };
}
