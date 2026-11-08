/**
 * Every badge a learner can earn, and the rule for each. Kept in code (and copied into the Badge table at
 * start-up) so a badge's wording can change without a migration. Rules read a snapshot of the learner's
 * numbers, so they are pure and easy to test.
 */

import { GRAMMAR } from '../grammar/grammar.content';
import { PACKS } from '../vocab-packs/packs.content';
import { SCENARIOS } from '../roleplay/roleplay.content';
import { LESSONS as SHADOW_LESSONS } from '../shadowing/shadowing.content';

export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
export type BadgeCategory = 'STREAK' | 'LEARNING' | 'SPEAKING' | 'VOCABULARY' | 'COMMUNITY' | 'SPECIAL';

/** What the rules look at */
export interface LearnerStats {
  totalXp: number;
  longestStreak: number;
  speakingMinutes: number;
  reviews: number;
  wordsSaved: number;
  pronunciationTries: number;
  perfectPronunciations: number;
  correctionsGiven: number;
  correctionsAccepted: number;
  plansCompleted: number;
  bestPlanStreak: number;
  levelTests: number;
  /** Levels climbed between the first and the latest level test (A2 → B1 is 1) */
  levelsGained: number;
  followers: number;
  friends: number;
  leaguePromotions: number;
  leaguePodiums: number;
  /** Highest league reached, 0 = the first */
  bestLeagueTier: number;
  /** Daily speaking challenge answers */
  challenges: number;
  /** Reactions others gave to your challenge answers */
  reactionsReceived: number;
  /** Library texts finished */
  textsRead: number;
  /** Library texts at B2 or above with every question right */
  hardTextsPerfect: number;
  /** Role-play scenarios finished (each counts once) */
  scenariosDone: number;
  /** Shadowing lessons finished (each counts once) */
  shadowingLessons: number;
  /** Listening dictations finished */
  dictations: number;
  /** Dictations with every word right */
  perfectDictations: number;
  /** Vocabulary packs whose quiz was passed */
  packsPassed: number;
  /** Words from vocabulary packs in the flashcard review */
  packWordsSaved: number;
  /** Grammar lessons passed */
  lessonsPassed: number;
  /** Grammar lessons finished with every exercise right */
  perfectLessons: number;
  /** Weeks with every weekly quest done */
  questWeeks: number;
  /** Days a streak freeze covered */
  freezesUsed: number;
  /** Finished pieces in the Writing studio */
  piecesWritten: number;
  /** Finished pieces of 80+ words that scored 95 or more */
  polishedPieces: number;
}

export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  /** A lucide icon name the web app knows */
  icon: string;
  /** The number the rule compares, and the target it needs */
  measure: (s: LearnerStats) => number;
  target: number;
}

const at = (key: keyof LearnerStats) => (s: LearnerStats) => s[key];

export const BADGES: BadgeDef[] = [
  // Showing up
  { key: 'streak-3', name: 'Warming up', description: 'Practise 3 days in a row', category: 'STREAK', tier: 'BRONZE', icon: 'Flame', measure: at('longestStreak'), target: 3 },
  { key: 'streak-7', name: 'One full week', description: 'Practise 7 days in a row', category: 'STREAK', tier: 'SILVER', icon: 'Flame', measure: at('longestStreak'), target: 7 },
  { key: 'streak-30', name: 'Habit formed', description: 'Practise 30 days in a row', category: 'STREAK', tier: 'GOLD', icon: 'Flame', measure: at('longestStreak'), target: 30 },
  { key: 'streak-100', name: 'Unstoppable', description: 'Practise 100 days in a row', category: 'STREAK', tier: 'DIAMOND', icon: 'Flame', measure: at('longestStreak'), target: 100 },
  { key: 'plan-1', name: 'Plan done', description: 'Finish a daily plan', category: 'STREAK', tier: 'BRONZE', icon: 'CalendarCheck', measure: at('plansCompleted'), target: 1 },
  { key: 'plan-streak-7', name: 'Planner', description: 'Finish your daily plan 7 days in a row', category: 'STREAK', tier: 'GOLD', icon: 'CalendarCheck', measure: at('bestPlanStreak'), target: 7 },

  // XP
  { key: 'xp-100', name: 'First 100', description: 'Earn 100 XP', category: 'LEARNING', tier: 'BRONZE', icon: 'Zap', measure: at('totalXp'), target: 100 },
  { key: 'xp-1000', name: 'Thousand club', description: 'Earn 1,000 XP', category: 'LEARNING', tier: 'SILVER', icon: 'Zap', measure: at('totalXp'), target: 1000 },
  { key: 'xp-5000', name: 'Serious learner', description: 'Earn 5,000 XP', category: 'LEARNING', tier: 'GOLD', icon: 'Zap', measure: at('totalXp'), target: 5000 },
  { key: 'xp-20000', name: 'Legend', description: 'Earn 20,000 XP', category: 'LEARNING', tier: 'PLATINUM', icon: 'Zap', measure: at('totalXp'), target: 20000 },
  { key: 'level-test', name: 'Know your level', description: 'Take the level test', category: 'LEARNING', tier: 'BRONZE', icon: 'Target', measure: at('levelTests'), target: 1 },
  { key: 'level-up', name: 'Level up', description: 'Reach a higher level in a later level test', category: 'LEARNING', tier: 'GOLD', icon: 'TrendingUp', measure: at('levelsGained'), target: 1 },

  // Speaking
  { key: 'speak-10', name: 'First words', description: 'Speak for 10 minutes in rooms and calls', category: 'SPEAKING', tier: 'BRONZE', icon: 'Mic', measure: at('speakingMinutes'), target: 10 },
  { key: 'speak-60', name: 'Chatterbox', description: 'Speak for 1 hour in total', category: 'SPEAKING', tier: 'SILVER', icon: 'Mic', measure: at('speakingMinutes'), target: 60 },
  { key: 'speak-300', name: 'Fluent talker', description: 'Speak for 5 hours in total', category: 'SPEAKING', tier: 'GOLD', icon: 'Mic', measure: at('speakingMinutes'), target: 300 },
  { key: 'pron-1', name: 'Say it out loud', description: 'Try your first pronunciation practice', category: 'SPEAKING', tier: 'BRONZE', icon: 'AudioLines', measure: at('pronunciationTries'), target: 1 },
  { key: 'pron-perfect', name: 'Crystal clear', description: 'Score 100 on a full sentence', category: 'SPEAKING', tier: 'SILVER', icon: 'AudioLines', measure: at('perfectPronunciations'), target: 1 },
  { key: 'challenge-1', name: 'Daily speaker', description: 'Answer a daily speaking challenge', category: 'SPEAKING', tier: 'BRONZE', icon: 'Mic', measure: at('challenges'), target: 1 },
  { key: 'challenge-7', name: 'Week of voices', description: 'Answer 7 daily speaking challenges', category: 'SPEAKING', tier: 'SILVER', icon: 'Mic', measure: at('challenges'), target: 7 },
  { key: 'challenge-30', name: 'On the mic', description: 'Answer 30 daily speaking challenges', category: 'SPEAKING', tier: 'GOLD', icon: 'Mic', measure: at('challenges'), target: 30 },
  { key: 'pron-100', name: 'Sound master', description: 'Practise pronunciation 100 times', category: 'SPEAKING', tier: 'GOLD', icon: 'AudioLines', measure: at('pronunciationTries'), target: 100 },

  // Reading and listening
  { key: 'read-1', name: 'Bookworm', description: 'Finish a story in the library', category: 'VOCABULARY', tier: 'BRONZE', icon: 'BookOpen', measure: at('textsRead'), target: 1 },
  { key: 'read-10', name: 'Avid reader', description: 'Finish 10 library texts', category: 'VOCABULARY', tier: 'SILVER', icon: 'BookOpen', measure: at('textsRead'), target: 10 },
  { key: 'read-perfect', name: 'Sharp reader', description: 'Get every question right on a B2 or C1 text', category: 'VOCABULARY', tier: 'GOLD', icon: 'Target', measure: at('hardTextsPerfect'), target: 1 },
  { key: 'roleplay-1', name: 'In character', description: 'Finish a role-play conversation', category: 'SPEAKING', tier: 'BRONZE', icon: 'Drama', measure: at('scenariosDone'), target: 1 },
  { key: 'roleplay-all', name: 'Ready for anything', description: 'Finish every role-play scenario', category: 'SPEAKING', tier: 'GOLD', icon: 'Drama', measure: at('scenariosDone'), target: SCENARIOS.length },
  { key: 'shadow-1', name: 'Echo', description: 'Finish a shadowing lesson', category: 'SPEAKING', tier: 'BRONZE', icon: 'Repeat2', measure: at('shadowingLessons'), target: 1 },
  { key: 'shadow-10', name: 'In sync', description: 'Finish 10 shadowing lessons', category: 'SPEAKING', tier: 'SILVER', icon: 'Repeat2', measure: at('shadowingLessons'), target: 10 },
  { key: 'shadow-all', name: 'Second voice', description: 'Finish every shadowing lesson', category: 'SPEAKING', tier: 'GOLD', icon: 'Repeat2', measure: at('shadowingLessons'), target: SHADOW_LESSONS.length },
  { key: 'dictation-1', name: 'Good ears', description: 'Finish a listening dictation', category: 'LEARNING', tier: 'BRONZE', icon: 'Headphones', measure: at('dictations'), target: 1 },
  { key: 'dictation-10', name: 'Sharp ears', description: 'Finish 10 listening dictations', category: 'LEARNING', tier: 'SILVER', icon: 'Headphones', measure: at('dictations'), target: 10 },
  { key: 'dictation-perfect', name: 'Every word', description: 'Get every word right in a dictation', category: 'LEARNING', tier: 'GOLD', icon: 'Headphones', measure: at('perfectDictations'), target: 1 },
  { key: 'pack-1', name: 'Word collector', description: 'Pass a vocabulary pack quiz', category: 'VOCABULARY', tier: 'BRONZE', icon: 'BookOpen', measure: at('packsPassed'), target: 1 },
  { key: 'pack-5', name: 'Wordsmith', description: 'Pass 5 vocabulary pack quizzes', category: 'VOCABULARY', tier: 'SILVER', icon: 'BookOpen', measure: at('packsPassed'), target: 5 },
  { key: 'pack-words-50', name: 'Word garden', description: 'Add 50 words from packs to your review', category: 'VOCABULARY', tier: 'SILVER', icon: 'Layers', measure: at('packWordsSaved'), target: 50 },
  { key: 'pack-all', name: 'Lexicon', description: 'Pass 100 vocabulary pack quizzes', category: 'VOCABULARY', tier: 'GOLD', icon: 'Layers', measure: at('packsPassed'), target: Math.min(100, PACKS.length) },
  { key: 'grammar-1', name: 'Rule learner', description: 'Pass a grammar lesson', category: 'LEARNING', tier: 'BRONZE', icon: 'GraduationCap', measure: at('lessonsPassed'), target: 1 },
  { key: 'grammar-6', name: 'Grammar fan', description: 'Pass 6 grammar lessons', category: 'LEARNING', tier: 'SILVER', icon: 'GraduationCap', measure: at('lessonsPassed'), target: 6 },
  { key: 'grammar-perfect', name: 'Spot on', description: 'Get every exercise right in a grammar lesson', category: 'LEARNING', tier: 'SILVER', icon: 'Target', measure: at('perfectLessons'), target: 1 },
  { key: 'grammar-all', name: 'Grammar graduate', description: 'Pass every grammar lesson', category: 'LEARNING', tier: 'GOLD', icon: 'GraduationCap', measure: at('lessonsPassed'), target: GRAMMAR.length },
  { key: 'quest-1', name: 'Quest complete', description: 'Finish all three weekly quests', category: 'STREAK', tier: 'BRONZE', icon: 'Gift', measure: at('questWeeks'), target: 1 },
  { key: 'quest-4', name: 'Month of quests', description: 'Finish your weekly quests in 4 different weeks', category: 'STREAK', tier: 'SILVER', icon: 'Gift', measure: at('questWeeks'), target: 4 },
  { key: 'quest-12', name: 'Quest master', description: 'Finish your weekly quests in 12 different weeks', category: 'STREAK', tier: 'GOLD', icon: 'Gift', measure: at('questWeeks'), target: 12 },
  { key: 'freeze-1', name: 'Saved by the ice', description: 'A streak freeze kept your streak alive', category: 'STREAK', tier: 'BRONZE', icon: 'Snowflake', measure: at('freezesUsed'), target: 1 },
  { key: 'write-1', name: 'First draft', description: 'Finish a piece in the Writing studio', category: 'LEARNING', tier: 'BRONZE', icon: 'PenLine', measure: at('piecesWritten'), target: 1 },
  { key: 'write-10', name: 'Wordsmith', description: 'Finish 10 pieces of writing', category: 'LEARNING', tier: 'SILVER', icon: 'PenLine', measure: at('piecesWritten'), target: 10 },
  { key: 'write-polished', name: 'Polished', description: 'Score 95 or more on a piece of at least 80 words', category: 'LEARNING', tier: 'GOLD', icon: 'Sparkles', measure: at('polishedPieces'), target: 1 },

  // Words and review
  { key: 'review-50', name: 'Memory builder', description: 'Review 50 cards', category: 'VOCABULARY', tier: 'BRONZE', icon: 'Layers', measure: at('reviews'), target: 50 },
  { key: 'review-500', name: 'Steel trap', description: 'Review 500 cards', category: 'VOCABULARY', tier: 'SILVER', icon: 'Layers', measure: at('reviews'), target: 500 },
  { key: 'words-25', name: 'Word collector', description: 'Save 25 words', category: 'VOCABULARY', tier: 'BRONZE', icon: 'BookOpen', measure: at('wordsSaved'), target: 25 },
  { key: 'words-100', name: 'Walking dictionary', description: 'Save 100 words', category: 'VOCABULARY', tier: 'SILVER', icon: 'BookOpen', measure: at('wordsSaved'), target: 100 },

  // Helping and people
  { key: 'help-1', name: 'Helping hand', description: "Correct someone's English", category: 'COMMUNITY', tier: 'BRONZE', icon: 'Wand2', measure: at('correctionsGiven'), target: 1 },
  { key: 'help-25', name: 'Teacher at heart', description: 'Give 25 corrections', category: 'COMMUNITY', tier: 'SILVER', icon: 'Wand2', measure: at('correctionsGiven'), target: 25 },
  { key: 'learn-10', name: 'Open mind', description: 'Accept 10 corrections from others', category: 'COMMUNITY', tier: 'SILVER', icon: 'CheckCircle2', measure: at('correctionsAccepted'), target: 10 },
  { key: 'followers-1', name: 'First fan', description: 'Get your first follower', category: 'COMMUNITY', tier: 'BRONZE', icon: 'UserPlus', measure: at('followers'), target: 1 },
  { key: 'cheers-10', name: 'Crowd favourite', description: 'Get 10 reactions on your challenge answers', category: 'COMMUNITY', tier: 'SILVER', icon: 'Users', measure: at('reactionsReceived'), target: 10 },
  { key: 'friends-5', name: 'Study circle', description: 'Have 5 friends', category: 'COMMUNITY', tier: 'SILVER', icon: 'Users', measure: at('friends'), target: 5 },

  // Leagues
  { key: 'league-up', name: 'Moving up', description: 'Get promoted to a higher league', category: 'SPECIAL', tier: 'SILVER', icon: 'ArrowUpCircle', measure: at('leaguePromotions'), target: 1 },
  { key: 'league-podium', name: 'On the podium', description: 'Finish a league week in the top 3', category: 'SPECIAL', tier: 'GOLD', icon: 'Medal', measure: at('leaguePodiums'), target: 1 },
  { key: 'league-diamond', name: 'Diamond', description: 'Reach the Diamond league', category: 'SPECIAL', tier: 'DIAMOND', icon: 'Gem', measure: at('bestLeagueTier'), target: 9 },
];

export const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]));

/** Badges whose rule is met now, that the learner does not have yet */
export function newlyEarned(stats: LearnerStats, owned: Iterable<string>): BadgeDef[] {
  const have = new Set(owned);
  return BADGES.filter((b) => !have.has(b.key) && b.measure(stats) >= b.target);
}

/** How close a badge is, for the progress bar (capped at the target) */
export function progressOf(badge: BadgeDef, stats: LearnerStats) {
  return { value: Math.min(badge.target, Math.max(0, Math.floor(badge.measure(stats)))), target: badge.target };
}

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Steps climbed from the first level-test result to the latest ("A2" then "B1" → 1) */
export function levelsGained(levels: Array<string | null | undefined>): number {
  const steps = levels.map((l) => CEFR.indexOf(String(l ?? '').toUpperCase())).filter((i) => i >= 0);
  if (steps.length < 2) return 0;
  return Math.max(0, steps[steps.length - 1] - steps[0]);
}
