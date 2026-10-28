// apps/web/src/lib/xpLevels.ts
// One XP → level curve for the whole app (profile, sidebar, progress).

const LEVEL_THRESHOLDS = [0, 500, 1000, 2000, 3000, 4000, 5000, 6500, 8000, 10000];

export const getXpLevel = (xp: number): number => {
  let level = 1;
  LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (xp >= threshold) level = index + 1;
  });
  return level;
};

/** Percent (0–100) of the way from the current level to the next */
export const getLevelProgress = (xp: number): number => {
  const level = getXpLevel(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? currentThreshold + 2000;

  if (nextThreshold <= currentThreshold) return 100;

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100),
    ),
  );
};

/** XP total needed to reach the next level (the current XP when maxed out) */
export const getNextLevelXp = (xp: number): number => {
  const level = getXpLevel(xp);
  return LEVEL_THRESHOLDS[level] ?? xp;
};
