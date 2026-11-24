import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { getDictionary } from '../dictionary/dictionary.data';
import { localParts } from '../notifications/daily-reminder.engine';
import { practiceLevel } from '../pronunciation/pronunciation.service';
import {
  SCRAMBLE_PASS,
  SCRAMBLE_ROUND,
  SCRAMBLE_XP,
  WORDLE_GUESSES,
  WORDLE_LENGTH,
  isScrambleRight,
  pickScramble,
  playWordle,
  wordleAnswerFor,
  wordleXp,
} from './games.engine';

@Injectable()
export class GamesService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  private async context(userId: string, now: Date) {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true, timezone: true } });
    return { level: practiceLevel(profile?.level), day: localParts(now, profile?.timezone).day };
  }

  /** What to show on the games page: today's state of each game and your totals */
  async today(userId: string, now = new Date()) {
    const { day } = await this.context(userId, now);
    const [todays, played, won] = await Promise.all([
      this.prisma.gameResult.findMany({ where: { userId, day }, select: { game: true, won: true, score: true } }),
      this.prisma.gameResult.count({ where: { userId, game: 'wordle' } }),
      this.prisma.gameResult.count({ where: { userId, game: 'wordle', won: true } }),
    ]);
    const todayOf = (game: string) => todays.find((t) => t.game === game) ?? null;
    return {
      day,
      wordle: { length: WORDLE_LENGTH, maxGuesses: WORDLE_GUESSES, done: !!todayOf('wordle'), won: todayOf('wordle')?.won ?? false, played, wins: won },
      scramble: { round: SCRAMBLE_ROUND, pass: SCRAMBLE_PASS, done: !!todayOf('scramble'), score: todayOf('scramble')?.score ?? null },
    };
  }

  /**
   * Marks the guesses the page has so far. When the game ends (solved, or the sixth guess), the result is saved
   * and the first game of the day earns XP; the answer is only revealed then.
   */
  async checkWordle(userId: string, guesses: unknown, now = new Date()) {
    if (!Array.isArray(guesses) || !guesses.length) throw new BadRequestException('Send your guesses');
    if (guesses.length > WORDLE_GUESSES) throw new BadRequestException('Too many guesses');
    const dict = getDictionary();
    const { day } = await this.context(userId, now);
    const answer = wordleAnswerFor(dict, day);
    const outcome = playWordle(dict, answer.w, guesses.map(String));
    if ('error' in outcome) throw new BadRequestException(outcome.error);

    let xp = 0;
    if (outcome.over) {
      const already = await this.prisma.gameResult.count({ where: { userId, game: 'wordle', day } });
      if (!already) {
        await this.prisma.gameResult.create({ data: { userId, game: 'wordle', day, won: outcome.solved, score: outcome.rows.length } });
        if (outcome.solved) {
          xp = wordleXp(outcome.rows.length);
          await this.activity.recordActivity(userId, xp, 'BONUS');
        }
      }
    }
    return {
      ...outcome,
      xp,
      reveal: outcome.over ? this.reveal(answer) : null,
    };
  }

  private reveal(w: ReturnType<typeof wordleAnswerFor>) {
    const sense = w.s[0];
    return {
      id: w.id,
      word: w.w,
      level: w.lv,
      pos: sense?.p ?? w.pos[0] ?? '',
      meaning: sense?.d ?? '',
      example: sense?.x?.[0] ?? w.ex?.[0]?.[0] ?? '',
      ipa: w.ipa?.us ?? w.ipa?.uk ?? '',
    };
  }

  /** Five scrambled words at your level; `round` gives a different set for extra practice (no XP after the first) */
  async scrambleRound(userId: string, round: unknown, now = new Date()) {
    const { level, day } = await this.context(userId, now);
    const r = Math.max(0, Math.min(999, Math.floor(Number(round)) || 0));
    const dict = getDictionary();
    const items = pickScramble(dict, level, `${userId}:${day}:${r}`);
    // The word itself stays on the server: the page only gets letters and a clue
    return { level, round: r, items: items.map(({ id, letters, hint, pos }) => ({ id, letters, hint, pos, length: letters.length })) };
  }

  async checkScramble(userId: string, round: unknown, answers: unknown, now = new Date()) {
    if (!answers || typeof answers !== 'object') throw new BadRequestException('Send your answers');
    const { level, day } = await this.context(userId, now);
    const r = Math.max(0, Math.min(999, Math.floor(Number(round)) || 0));
    const dict = getDictionary();
    const items = pickScramble(dict, level, `${userId}:${day}:${r}`);
    const given = answers as Record<string, unknown>;
    const results = items.map((item) => {
      const typed = typeof given[item.id] === 'string' ? (given[item.id] as string).slice(0, 20) : '';
      return { id: item.id, word: item.word, typed, right: isScrambleRight(dict, item.word, typed) };
    });
    const score = results.filter((x) => x.right).length;
    const won = score >= SCRAMBLE_PASS;

    let xp = 0;
    const already = await this.prisma.gameResult.count({ where: { userId, game: 'scramble', day } });
    if (!already) {
      await this.prisma.gameResult.create({ data: { userId, game: 'scramble', day, won, score } });
      if (won) {
        xp = SCRAMBLE_XP;
        await this.activity.recordActivity(userId, xp, 'BONUS');
      }
    }
    return { score, total: results.length, won, xp, results };
  }
}
