import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { BadgesService } from '../gamification/badges.service';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import { SCENARIOS, SCENARIO_BY_ID, SCENARIO_LEVELS, type ScenarioLevel } from './roleplay.content';

/** XP the first time you finish a scenario */
export const ROLEPLAY_XP = 8;

/**
 * The average of the scores you got for the replies you said aloud. Scores come from the pronunciation
 * checker on the page; anything that is not a number from 0 to 100 counts as not said.
 */
export function averageSpoken(scores: unknown, turns: number): { spoken: number; average: number | null } {
  const list = Array.isArray(scores) ? scores.slice(0, turns) : [];
  const said = list.filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s >= 0 && s <= 100);
  return { spoken: said.length, average: said.length ? Math.round(said.reduce((a, b) => a + b, 0) / said.length) : null };
}

@Injectable()
export class RoleplayService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    @Optional() private badges?: BadgesService,
  ) {}

  /** Every scenario with your progress, and your level so the page can start there */
  async list(userId: string) {
    const [profile, progress] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.prisma.roleplayProgress.findMany({ where: { userId } }),
    ]);
    const byId = new Map(progress.map((p) => [p.scenarioId, p]));
    const level = practiceLevel(profile?.level) as ScenarioLevel;
    const scenarios = SCENARIOS.map((s) => {
      const p = byId.get(s.id);
      return {
        id: s.id,
        level: s.level,
        title: s.title,
        setting: s.setting,
        icon: s.icon,
        partner: s.partner,
        turns: s.exchanges.length,
        done: !!p,
        bestScore: p?.bestScore ?? null,
        times: p?.completions ?? 0,
      };
    });
    return {
      level,
      levels: SCENARIO_LEVELS.map((lv) => ({ level: lv, total: scenarios.filter((s) => s.level === lv).length, done: scenarios.filter((s) => s.level === lv && s.done).length })),
      scenarios,
      done: scenarios.filter((s) => s.done).length,
    };
  }

  /** One scenario, the whole script */
  async get(userId: string, id: string) {
    const scenario = SCENARIO_BY_ID.get(id);
    if (!scenario) throw new NotFoundException('Scenario not found');
    const progress = await this.prisma.roleplayProgress.findUnique({ where: { userId_scenarioId: { userId, scenarioId: id } } });
    const index = SCENARIOS.findIndex((s) => s.id === id);
    const next = SCENARIOS[index + 1];
    return {
      ...scenario,
      progress: progress ? { bestScore: progress.bestScore, times: progress.completions } : null,
      next: next ? { id: next.id, title: next.title } : null,
    };
  }

  /** Saves a finished conversation. The first finish of each scenario earns XP. */
  async finish(userId: string, id: string, scores: unknown) {
    const scenario = SCENARIO_BY_ID.get(id);
    if (!scenario) throw new NotFoundException('Scenario not found');
    if (scores !== undefined && !Array.isArray(scores)) throw new BadRequestException('Send the scores as a list');
    const { spoken, average } = averageSpoken(scores, scenario.exchanges.length);

    const existing = await this.prisma.roleplayProgress.findUnique({ where: { userId_scenarioId: { userId, scenarioId: id } } });
    const best = average === null ? (existing?.bestScore ?? null) : Math.max(existing?.bestScore ?? 0, average);
    await this.prisma.roleplayProgress.upsert({
      where: { userId_scenarioId: { userId, scenarioId: id } },
      create: { userId, scenarioId: id, bestScore: best, completions: 1 },
      update: { bestScore: best, completions: { increment: 1 } },
    });

    const firstTime = !existing;
    if (firstTime) await this.activity.recordActivity(userId, ROLEPLAY_XP, 'LESSON_COMPLETED');
    void this.badges?.evaluate(userId);
    return { firstTime, xp: firstTime ? ROLEPLAY_XP : 0, spoken, turns: scenario.exchanges.length, average, best };
  }
}
