// server/src/voice/coach/recap.ts
/**
 * The one tip a session recap leads with: the thing most worth working on next time. Pure, so the choice can
 * be tested without a room.
 */

import { MISTAKE_PATTERNS, patternFor, type MistakePattern } from '../../learning/mistakes';

export interface RecapStats {
  speakingSec: number;
  words: number;
  fillerCount: number;
  wpm: number | null;
  topFillers: Array<{ word: string; count: number }>;
}

export interface Tip {
  /** What the tip is about, so the page can pick an icon */
  kind: 'mistake' | 'fillers' | 'pace-slow' | 'pace-fast' | 'speak-more' | 'keep-going';
  title: string;
  text: string;
}

/** Fillers per 100 words above which they get in the way */
const FILLERS_PER_100 = 4;

/** The kind of mistake that came up most among the corrections, if any came up at least twice */
export function topPattern(corrections: Array<{ original: string; corrected: string; category?: string | null }>): MistakePattern | null {
  const counts = new Map<MistakePattern, number>();
  for (const c of corrections) {
    const p = patternFor(c.original, c.corrected, c.category);
    if (p === 'OTHER') continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

export function recapTip(stats: RecapStats, corrections: Array<{ original: string; corrected: string; category?: string | null }>): Tip {
  const pattern = topPattern(corrections);
  if (pattern) {
    return { kind: 'mistake', title: `Watch your ${MISTAKE_PATTERNS[pattern].label.toLowerCase()}`, text: MISTAKE_PATTERNS[pattern].tip };
  }
  if (stats.speakingSec < 30) {
    return {
      kind: 'speak-more',
      title: 'Say a little more next time',
      text: 'Listening helps, but speaking is where you improve fastest. Next time, raise your hand early and say just two or three sentences.',
    };
  }
  if (stats.words >= 40 && stats.fillerCount >= 5 && (stats.fillerCount / stats.words) * 100 >= FILLERS_PER_100) {
    const worst = stats.topFillers[0]?.word;
    return {
      kind: 'fillers',
      title: worst ? `Fewer "${worst}"s` : 'Fewer filler words',
      text: 'When you need time to think, pause silently instead. A short pause sounds more confident than a filler word.',
    };
  }
  if (stats.wpm !== null && stats.words >= 50 && stats.wpm < 90) {
    return { kind: 'pace-slow', title: 'Try to keep talking', text: 'You spoke quite slowly. Practise a few phrases you use often until they come out in one go.' };
  }
  if (stats.wpm !== null && stats.words >= 50 && stats.wpm > 170) {
    return { kind: 'pace-fast', title: 'Slow down a little', text: 'You spoke fast, which can make you harder to follow. Take a breath between ideas.' };
  }
  return {
    kind: 'keep-going',
    title: 'Great session',
    text: 'Next time, try to use one of the new words you heard or saved today.',
  };
}
