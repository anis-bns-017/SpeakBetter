/**
 * The daily plan: a few tasks that fit into the minutes a learner has, picked from what is useful today.
 * Pure functions, so the choice can be tested without a database.
 */

export const GOAL_OPTIONS = [5, 10, 20, 30] as const;
export const DEFAULT_GOAL_MINUTES = 10;

export type PlanTaskKind = 'LEVEL' | 'REVIEW' | 'PRONUNCIATION' | 'SPEAK' | 'CHALLENGE' | 'READ' | 'WRITE' | 'CORRECTION' | 'WORDS' | 'EXERCISE';

export interface PlanTask {
  id: string;
  kind: PlanTaskKind;
  title: string;
  detail: string;
  /** Where to go to do it */
  to: string;
  /** How much counts as done, in `unit` */
  target: number;
  unit: 'test' | 'cards' | 'tries' | 'minutes' | 'answers' | 'texts' | 'pieces' | 'corrections' | 'words' | 'exercises';
  /** Estimated time */
  minutes: number;
}

export interface PlanSignals {
  goalMinutes: number;
  hasLevel: boolean;
  /** Cards and saved words due now */
  dueCards: number;
  /** The mistake type that keeps coming back, if any */
  weakPattern: { key: string; label: string } | null;
  /** The pronunciation sound with the lowest average, if any */
  weakSound: { key: string; label: string } | null;
  correctionsGivenThisWeek: number;
  wordsSavedThisWeek: number;
}

/** Rough minutes each unit of work takes, used for the plan and for "minutes practised" */
export const MINUTES_PER = {
  card: 0.4,
  pronunciationTry: 0.5,
  aiTurn: 0.5,
  chatMessage: 0.3,
  exercise: 3,
  correction: 1.5,
  savedWord: 0.7,
  levelTest: 8,
} as const;

export const normalizeGoal = (value: unknown): number =>
  (GOAL_OPTIONS as readonly number[]).includes(Number(value)) ? Number(value) : DEFAULT_GOAL_MINUTES;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Picks the tasks: finding your level first (it tunes everything else), then due reviews, the pronunciation
 * drill and speaking, filled up with small tasks until the time is used. Always 2 to 5 tasks.
 */
export function buildPlan(s: PlanSignals): PlanTask[] {
  const goal = normalizeGoal(s.goalMinutes);
  const tasks: PlanTask[] = [];
  let left = goal;
  const add = (task: PlanTask) => {
    tasks.push(task);
    left -= task.minutes;
  };

  if (!s.hasLevel && goal >= 10) {
    add({
      id: 'level',
      kind: 'LEVEL',
      title: 'Find your English level',
      detail: 'A short test that tunes rooms, calls and practice to you',
      to: '/placement',
      target: 1,
      unit: 'test',
      minutes: MINUTES_PER.levelTest,
    });
  }

  if (s.dueCards > 0) {
    const wanted = Math.max(3, Math.round((goal * 0.35) / MINUTES_PER.card));
    const cards = Math.min(s.dueCards, wanted, 40);
    add({
      id: 'review',
      kind: 'REVIEW',
      title: `Review ${plural(cards, 'card')}`,
      detail: s.weakPattern ? `Includes your ${s.weakPattern.label.toLowerCase()} mistakes` : 'Lock in what you learned before you forget it',
      to: s.weakPattern ? `/flashcards?pattern=${encodeURIComponent(s.weakPattern.key)}` : '/flashcards',
      target: cards,
      unit: 'cards',
      minutes: Math.max(1, Math.ceil(cards * MINUTES_PER.card)),
    });
  }

  const tries = goal <= 5 ? 4 : goal <= 10 ? 6 : goal <= 20 ? 8 : 10;
  add({
    id: 'pronunciation',
    kind: 'PRONUNCIATION',
    title: "Today's pronunciation drill",
    detail: s.weakSound ? `Say ${tries} things · focus on ${s.weakSound.label}` : `Say ${tries} things out loud and get a score`,
    to: '/pronunciation',
    target: tries,
    unit: 'tries',
    minutes: Math.ceil(tries * MINUTES_PER.pronunciationTry),
  });

  if (goal >= 10 && left >= 3) {
    const minutes = Math.max(3, Math.min(Math.round(goal * 0.35), left));
    add({
      id: 'speak',
      kind: 'SPEAK',
      title: `Speak for ${plural(minutes, 'minute')}`,
      detail: 'In a voice room, a random call or with your AI partner',
      to: '/voice',
      target: minutes,
      unit: 'minutes',
      minutes,
    });
  }

  // Small tasks to fill the rest of the time
  const fillers: PlanTask[] = [
    {
      id: 'challenge',
      kind: 'CHALLENGE',
      title: "Answer today's speaking challenge",
      detail: 'One question, about a minute, out loud',
      to: '/challenge',
      target: 1,
      unit: 'answers',
      minutes: 2,
    },
    {
      id: 'read',
      kind: 'READ',
      title: 'Read and listen to one story',
      detail: 'A short text for your level, then three quick questions',
      to: '/library',
      target: 1,
      unit: 'texts',
      minutes: 3,
    },
    {
      id: 'write',
      kind: 'WRITE',
      title: 'Write a short piece',
      detail: "Today's writing task, with grammar and spelling checked as you go",
      to: '/writing',
      target: 1,
      unit: 'pieces',
      minutes: 6,
    },
  ];
  if (s.correctionsGivenThisWeek === 0) {
    fillers.push({
      id: 'correction',
      kind: 'CORRECTION',
      title: "Correct someone's English",
      detail: 'Helping others is one of the best ways to learn',
      to: '/voice',
      target: 1,
      unit: 'corrections',
      minutes: 2,
    });
  }
  if (s.wordsSavedThisWeek < 5) {
    fillers.push({
      id: 'words',
      kind: 'WORDS',
      title: 'Learn 3 new words',
      detail: 'Save a word pack, or select a word in a chat',
      to: '/packs',
      target: 3,
      unit: 'words',
      minutes: 2,
    });
  }
  fillers.push({
    id: 'exercise',
    kind: 'EXERCISE',
    title: 'Practise one grammar lesson',
    detail: 'A short rule and six quick exercises',
    to: '/grammar',
    target: 1,
    unit: 'exercises',
    minutes: MINUTES_PER.exercise,
  });

  for (const filler of fillers) {
    if (tasks.length >= 5) break;
    if (tasks.length >= 2 && left < Math.min(filler.minutes, 2)) break;
    add(filler);
  }
  return tasks;
}

/** YYYY-MM-DD for the day `date` falls on, in the server's time zone (the same days as streaks) */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Days in a row a plan was finished: counting back from today, or from yesterday when today's plan is
 * not finished yet (so the streak is not "lost" in the morning).
 */
export function planStreak(completedDays: Iterable<string>, today: Date): number {
  const done = new Set(completedDays);
  const cursor = new Date(today);
  cursor.setHours(12, 0, 0, 0);
  if (!done.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (done.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
