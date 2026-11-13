import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { words } from '../learning/mistakes';
import { isSoundKey, LEVELS, SENTENCES, SOUND_KEYS, SOUNDS, type PracticeLevel, type SoundKey } from './pronunciation.data';
import { paceOf, scoreAttempt, type Pace, type PronunciationIssue, type WordResult } from './pronunciation.score';
import { getDictionary } from '../dictionary/dictionary.data';
import { checkSounds, readFrames, type SoundCheck } from './phoneme.align';
import { pronunciationsOf } from './phoneme.lexicon';
import { PHONE_LABEL } from './phonemes';

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_TARGET_CHARS = 200;
/** XP for a decent attempt, and the most a day of pronunciation practice can earn */
const XP_PER_ATTEMPT = 2;
const XP_DAILY_CAP = 30;
const XP_MIN_SCORE = 50;
/** Missing the same word this many times in two weeks puts it in your review deck */
const TROUBLE_AFTER = 2;
const TROUBLE_WINDOW_DAYS = 14;
const PROGRESS_DAYS = 30;
const MY_WORDS = 12;

export type AttemptSource = 'sound' | 'sentence' | 'word';
const SOURCES: AttemptSource[] = ['sound', 'sentence', 'word'];

interface AttemptResult {
  words: WordResult[];
  issues: PronunciationIssue[];
  pace?: Pace | null;
  /** Each sound of each word, when the learner's device checked the recording */
  sounds?: SoundCheck | null;
}

/** A sound needs this many tries before it is called weak, and to be right less often than this */
const WEAK_PHONE_MIN_TRIES = 5;
const WEAK_PHONE_BELOW = 80;

export interface DrillItem {
  target: string;
  source: AttemptSource;
  sound?: SoundKey;
  /** The word it tends to be heard as */
  avoid?: string;
}

/** Sounds averaging below this still need work */
const WEAK_SOUND_BELOW = 90;
const DRILL_SOUNDS = 2;
const DRILL_PAIRS_PER_SOUND = 2;
const DRILL_TROUBLE_WORDS = 4;
const DRILL_SENTENCES = 2;

/** Picks `count` items from `list`, starting at a place that moves on each day, so the drill changes daily */
function rotate<T>(list: readonly T[], count: number, day: number): T[] {
  if (!list.length) return [];
  const start = day % list.length;
  return [...list.slice(start), ...list.slice(0, start)].slice(0, count);
}

const cleanText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** The level's sentences to offer: a CEFR code from the level test, or an older word such as "beginner" */
export function practiceLevel(level: string | null | undefined): PracticeLevel {
  const value = String(level ?? '').trim().toUpperCase();
  if (value === 'C2') return 'C1';
  if ((LEVELS as readonly string[]).includes(value)) return value as PracticeLevel;
  if (/BEGIN|ELEMENT/.test(value)) return 'A1';
  if (/INTER/.test(value)) return 'B1';
  if (/ADVAN|FLUENT|NATIVE/.test(value)) return 'C1';
  return 'A2';
}

@Injectable()
export class PronunciationService {
  private readonly logger = new Logger(PronunciationService.name);

  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private review: ReviewService,
  ) {}

  /** Everything to practise: the sounds (with your best score on each), sentences for your level, your own words */
  async getPractice(userId: string) {
    const since = new Date(Date.now() - PROGRESS_DAYS * DAY_MS);
    const [profile, attempts, cards, saved] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.prisma.pronunciationAttempt.findMany({
        where: { userId, createdAt: { gte: since }, sound: { not: null } },
        select: { sound: true, score: true },
        take: 1000,
      }),
      this.prisma.flashcard.findMany({
        where: { userId, kind: 'word' },
        orderBy: { createdAt: 'desc' },
        select: { front: true },
        take: MY_WORDS * 2,
      }),
      this.prisma.voiceSavedWord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { word: true },
        take: MY_WORDS * 2,
      }),
    ]);

    const bySound = new Map<string, { attempts: number; best: number }>();
    for (const a of attempts) {
      const s = bySound.get(a.sound as string) ?? { attempts: 0, best: 0 };
      s.attempts++;
      s.best = Math.max(s.best, a.score);
      bySound.set(a.sound as string, s);
    }

    const level = practiceLevel(profile?.level);
    const mine = new Map<string, string>();
    for (const text of [...cards.map((c) => c.front), ...saved.map((w) => w.word)]) {
      const clean = cleanText(text, 60);
      // Only things short enough to say in one go, with at least one letter
      if (!clean || !/\p{L}/u.test(clean) || clean.split(' ').length > 8) continue;
      const key = clean.toLowerCase();
      if (!mine.has(key)) mine.set(key, clean);
      if (mine.size >= MY_WORDS) break;
    }

    return {
      level,
      sounds: SOUND_KEYS.map((key) => {
        const set = SOUNDS[key];
        const stats = bySound.get(key);
        return { ...set, attempts: stats?.attempts ?? 0, best: stats?.best ?? null };
      }),
      sentences: SENTENCES[level],
      myWords: [...mine.values()],
    };
  }

  async submitAttempt(
    userId: string,
    input: {
      target?: unknown;
      heard?: unknown;
      confidence?: unknown;
      sound?: unknown;
      source?: unknown;
      /** How long the speaking took, from the first sound to the last word */
      durationMs?: unknown;
    },
  ) {
    const target = cleanText(input.target, MAX_TARGET_CHARS);
    if (!target || !/\p{L}/u.test(target)) throw new BadRequestException('Nothing to practise');
    const alternatives = (Array.isArray(input.heard) ? input.heard : [input.heard])
      .map((h) => cleanText(h, 400))
      .filter(Boolean)
      .slice(0, 5);
    const confidence = typeof input.confidence === 'number' && Number.isFinite(input.confidence) ? input.confidence : null;
    const source: AttemptSource = SOURCES.includes(input.source as AttemptSource) ? (input.source as AttemptSource) : 'sentence';

    const scored = scoreAttempt(target, alternatives, confidence);
    const practised: SoundKey | null = isSoundKey(input.sound) ? input.sound : null;
    const sound = practised ?? scored.issues.find((i) => i.sound)?.sound ?? null;
    const missedWords = [...new Set(scored.words.filter((w) => w.status !== 'good').map((w) => w.word))];
    // Pace only means something when most of the sentence was actually heard
    const durationMs = typeof input.durationMs === 'number' ? input.durationMs : null;
    const pace = scored.score >= 50 ? paceOf(scored.words.length, durationMs) : null;

    const attempt = await this.prisma.pronunciationAttempt.create({
      data: {
        userId,
        target,
        heard: scored.heard,
        score: scored.score,
        sound,
        source,
        missedWords,
        result: { words: scored.words, issues: scored.issues, pace } as any,
      },
    });

    if (scored.score >= XP_MIN_SCORE) {
      await this.activity.recordCappedActivity(userId, XP_PER_ATTEMPT, 'PRONUNCIATION_PRACTICE', XP_DAILY_CAP);
    }
    const addedToReview = await this.trackTroubleWords(userId, scored.issues);

    return { id: attempt.id, ...scored, sound, pace, addedToReview };
  }

  /**
   * Judges every sound of an attempt from what the learner's device heard in the recording (frame by frame
   * guesses at the sound; the audio itself never leaves the device). Saved with the attempt, so progress
   * can show which sounds need work. Gives `sounds: null` when the recording could not be matched.
   */
  async checkSounds(userId: string, attemptId: string, rawFrames: unknown) {
    const attempt = await this.prisma.pronunciationAttempt.findFirst({ where: { id: attemptId, userId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    const frames = readFrames(rawFrames);
    if (!frames) throw new BadRequestException('No speech was found in the recording');

    const stored = (attempt.result ?? {}) as unknown as AttemptResult;
    const targets = Array.isArray(stored.words) && stored.words.length
      ? stored.words.map((w) => ({ text: w.text, word: w.word }))
      : words(attempt.target).map((word) => ({ text: word, word }));

    let sounds: SoundCheck | null = null;
    try {
      const dict = getDictionary();
      sounds = checkSounds(targets.map((t) => ({ word: t.word, variants: pronunciationsOf(dict, t.word) })), frames);
    } catch (error) {
      this.logger.warn(`Could not check the sounds of attempt ${attemptId}: ${(error as Error)?.message}`);
    }
    if (!sounds) return { sounds: null };

    await this.prisma.pronunciationAttempt.update({
      where: { id: attempt.id },
      data: { result: { ...stored, sounds } as any },
    });
    return { sounds: { ...sounds, words: sounds.words.map((w, i) => ({ ...w, text: targets[i]?.text ?? w.word })) } };
  }

  /**
   * A short practice made for you today: the two sounds you find hardest (or two you have not tried yet),
   * the words you keep missing, and a couple of sentences for your level. It changes from day to day.
   */
  async getDrill(userId: string) {
    const now = Date.now();
    const day = Math.floor(now / DAY_MS);
    const [profile, attempts] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { level: true } }),
      this.prisma.pronunciationAttempt.findMany({
        where: { userId, createdAt: { gte: new Date(now - PROGRESS_DAYS * DAY_MS) } },
        select: { sound: true, score: true, missedWords: true, result: true },
        take: 1000,
      }),
    ]);

    const bySound = new Map<SoundKey, number[]>();
    const missed = new Map<string, { count: number; heardAs: string | null }>();
    for (const a of attempts) {
      if (isSoundKey(a.sound)) bySound.set(a.sound, [...(bySound.get(a.sound) ?? []), a.score]);
      const issues = ((a.result as unknown as AttemptResult | null)?.issues ?? []) as PronunciationIssue[];
      for (const word of a.missedWords) {
        const m = missed.get(word) ?? { count: 0, heardAs: null };
        m.count++;
        m.heardAs ??= issues.find((i) => i.word === word)?.heard ?? null;
        missed.set(word, m);
      }
    }

    const averageOf = (scores: number[]) => scores.reduce((x, y) => x + y, 0) / scores.length;
    const weak = [...bySound.entries()]
      .map(([key, scores]) => ({ key, average: averageOf(scores) }))
      .filter((s) => s.average < WEAK_SOUND_BELOW)
      .sort((a, b) => a.average - b.average)
      .map((s) => s.key);
    // Not enough weak sounds yet: fill up with ones you have never practised, a different pair each day
    const untried = SOUND_KEYS.filter((k) => !bySound.has(k));
    const sounds = [...weak, ...rotate(untried, DRILL_SOUNDS, day)].slice(0, DRILL_SOUNDS);

    const items: DrillItem[] = [];
    for (const key of sounds) {
      const set = SOUNDS[key];
      for (const [target, avoid] of rotate(set.pairs, DRILL_PAIRS_PER_SOUND, day)) {
        items.push({ target, avoid, sound: key, source: 'sound' });
      }
      items.push({ target: rotate(set.sentences, 1, day)[0], sound: key, source: 'sound' });
    }

    const trouble = [...missed.entries()]
      .filter(([, m]) => m.count >= TROUBLE_AFTER)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, DRILL_TROUBLE_WORDS);
    for (const [word, m] of trouble) {
      if (!items.some((i) => i.target.toLowerCase() === word)) items.push({ target: word, avoid: m.heardAs ?? undefined, source: 'word' });
    }

    const level = practiceLevel(profile?.level);
    for (const target of rotate(SENTENCES[level], DRILL_SENTENCES, day)) items.push({ target, source: 'sentence' });

    return {
      items,
      sounds: sounds.map((key) => ({ key, label: SOUNDS[key].label, weak: weak.includes(key) })),
      troubleWords: trouble.map(([word]) => word),
      level,
    };
  }

  /**
   * A word you keep saying so that it is heard as another word becomes a review card ("sink" → "think"),
   * so it comes back in the Review deck with the tip for its sound.
   */
  private async trackTroubleWords(userId: string, issues: PronunciationIssue[]): Promise<string[]> {
    const added: string[] = [];
    const since = new Date(Date.now() - TROUBLE_WINDOW_DAYS * DAY_MS);
    for (const issue of issues) {
      // Only real swaps: a word not heard at all is more often a recording problem than a sound problem
      if (!issue.heard || words(issue.heard).join('') === issue.word) continue;
      try {
        const times = await this.prisma.pronunciationAttempt.count({
          where: { userId, createdAt: { gte: since }, missedWords: { has: issue.word } },
        });
        if (times < TROUBLE_AFTER) continue;
        const card = await this.review.addCorrectionCard(userId, {
          source: 'pronunciation',
          sourceId: `word:${issue.word}`,
          original: issue.heard,
          corrected: issue.word,
          note: issue.sound ? `${SOUNDS[issue.sound].label}: ${issue.tip}` : issue.tip,
          category: 'pronunciation',
        });
        if (card?.created) added.push(issue.word);
      } catch (error) {
        this.logger.warn(`Could not track a trouble word for ${userId}: ${(error as Error)?.message}`);
      }
    }
    return added;
  }

  /** How you are doing over the last 30 days: average, trend, the sounds and words that give you trouble */
  async getProgress(userId: string) {
    const now = Date.now();
    const attempts = await this.prisma.pronunciationAttempt.findMany({
      where: { userId, createdAt: { gte: new Date(now - PROGRESS_DAYS * DAY_MS) } },
      orderBy: { createdAt: 'desc' },
      select: { target: true, score: true, sound: true, missedWords: true, createdAt: true, result: true },
      take: 1000,
    });

    const average = (list: number[]) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);
    const last7 = attempts.filter((a) => now - a.createdAt.getTime() < 7 * DAY_MS).map((a) => a.score);
    const prev7 = attempts
      .filter((a) => {
        const age = now - a.createdAt.getTime();
        return age >= 7 * DAY_MS && age < 14 * DAY_MS;
      })
      .map((a) => a.score);

    const sounds = new Map<string, number[]>();
    const missed = new Map<string, { count: number; heardAs: Map<string, number> }>();
    const phones = new Map<string, { tries: number; right: number; heardAs: Map<string, number> }>();
    for (const a of attempts) {
      if (a.sound) sounds.set(a.sound, [...(sounds.get(a.sound) ?? []), a.score]);
      for (const word of (a.result as unknown as AttemptResult | null)?.sounds?.words ?? []) {
        for (const phone of word.phones ?? []) {
          const p = phones.get(phone.p) ?? { tries: 0, right: 0, heardAs: new Map<string, number>() };
          p.tries++;
          if (phone.status === 'good') p.right++;
          else if (phone.status === 'close') p.right += 0.6;
          if (phone.heard && phone.status === 'wrong') p.heardAs.set(phone.heard, (p.heardAs.get(phone.heard) ?? 0) + 1);
          phones.set(phone.p, p);
        }
      }
      const issues = ((a.result as unknown as AttemptResult | null)?.issues ?? []) as PronunciationIssue[];
      for (const word of a.missedWords) {
        const m = missed.get(word) ?? { count: 0, heardAs: new Map<string, number>() };
        m.count++;
        const heard = issues.find((i) => i.word === word)?.heard;
        if (heard) m.heardAs.set(heard, (m.heardAs.get(heard) ?? 0) + 1);
        missed.set(word, m);
      }
    }

    return {
      days: PROGRESS_DAYS,
      attempts: attempts.length,
      average: average(attempts.map((a) => a.score)),
      last7: average(last7),
      prev7: average(prev7),
      // Weakest first, so the page can say what to work on
      sounds: [...sounds.entries()]
        .filter(([key]) => isSoundKey(key))
        .map(([key, scores]) => ({
          key: key as SoundKey,
          label: SOUNDS[key as SoundKey].label,
          attempts: scores.length,
          average: average(scores) as number,
          best: Math.max(...scores),
        }))
        .sort((a, b) => a.average - b.average),
      troubleWords: [...missed.entries()]
        .filter(([, m]) => m.count >= TROUBLE_AFTER)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([word, m]) => ({
          word,
          count: m.count,
          heardAs: [...m.heardAs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        })),
      // Single sounds that keep going wrong, weakest first (only when sound checking was used)
      weakPhones: [...phones.entries()]
        .filter(([key, p]) => PHONE_LABEL[key] && p.tries >= WEAK_PHONE_MIN_TRIES)
        .map(([key, p]) => {
          const heard = [...p.heardAs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          return {
            p: key,
            ipa: PHONE_LABEL[key].ipa,
            hint: PHONE_LABEL[key].hint,
            tries: p.tries,
            accuracy: Math.round((100 * p.right) / p.tries),
            heardAs: heard && PHONE_LABEL[heard] ? PHONE_LABEL[heard].hint : null,
          };
        })
        .filter((p) => p.accuracy < WEAK_PHONE_BELOW)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 6),
      recent: attempts.slice(0, 10).map((a) => ({ target: a.target, score: a.score, sound: a.sound, createdAt: a.createdAt })),
    };
  }
}
