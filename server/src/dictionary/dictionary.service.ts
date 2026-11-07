// server/src/dictionary/dictionary.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActivityService } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';
import { getDictionary, type DictWord } from './dictionary.data';
import {
  TEST_XP,
  buildChecks,
  buildTest,
  commonness,
  findWord,
  linkedWords,
  listWords,
  nextWords,
  scoreTest,
  shortMeaning,
  statusOf,
  wordMap,
  type ListQuery,
  type Progress,
  type StoredTest,
} from './dictionary.engine';

const MAX_SAVE_MANY = 30;

@Injectable()
export class DictionaryService {
  constructor(
    private prisma: PrismaService,
    private review: ReviewService,
    @Optional() private activity?: ActivityService,
  ) {}

  private get dict() {
    try {
      return getDictionary();
    } catch {
      throw new ServiceUnavailableException(
        'The dictionary is not installed on this server yet',
      );
    }
  }

  /** Words you know, and words in My words (and which of those are learned) */
  async progress(userId: string): Promise<Progress> {
    const [known, cards, saved] = await Promise.all([
      this.prisma.knownWord.findMany({
        where: { userId },
        select: { wordId: true },
      }),
      this.prisma.flashcard.findMany({
        where: { userId, kind: 'word' },
        select: {
          front: true,
          reviews: { where: { userId }, select: { interval: true }, take: 1 },
        },
      }),
      this.prisma.voiceSavedWord.findMany({
        where: { userId },
        select: { word: true, interval: true, box: true },
      }),
    ]);
    const progress: Progress = {
      known: new Set(known.map((k) => k.wordId)),
      saved: new Set(),
      learned: new Set(),
    };
    for (const c of cards) {
      const text = c.front.toLowerCase();
      progress.saved.add(text);
      if ((c.reviews[0]?.interval ?? 0) > 0) progress.learned.add(text);
    }
    for (const w of saved) {
      progress.saved.add(w.word.toLowerCase());
      if (w.interval > 0 || w.box > 0)
        progress.learned.add(w.word.toLowerCase());
    }
    return progress;
  }

  private async latestTest(userId: string) {
    return this.prisma.vocabSizeTest.findFirst({
      where: { userId, finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      select: {
        id: true,
        estimate: true,
        level: true,
        bands: true,
        finishedAt: true,
      },
    });
  }

  private card(word: DictWord, progress: Progress) {
    return {
      id: word.id,
      word: word.w,
      level: word.lv,
      rank: word.r,
      pos: word.pos,
      ipa: word.ipa?.us ?? word.ipa?.uk ?? null,
      meaning: shortMeaning(word),
      status: statusOf(word, progress),
    };
  }

  /** Levels and topics with counts, your progress, the latest test, and words to learn next */
  async overview(userId: string) {
    const dict = this.dict;
    const [progress, latest] = await Promise.all([
      this.progress(userId),
      this.latestTest(userId),
    ]);
    const map = wordMap(
      dict,
      progress,
      (latest?.bands as number[] | null) ?? null,
    );
    const known = map.levels.reduce((n, l) => n + l.known, 0);
    const saved = dict.words.filter(
      (w) => statusOf(w, progress) === 'saved',
    ).length;
    return {
      count: dict.words.length,
      levels: map.levels,
      topics: dict.topics,
      sources: dict.sources,
      progress: { known, saved },
      latestTest: latest,
      next: nextWords(
        dict,
        progress,
        (latest?.bands as number[] | null) ?? null,
        8,
      ).map((w) => this.card(w, progress)),
    };
  }

  /** The dictionary entry for a word as heard or read ("went" finds "go"), or null when it has none */
  async find(userId: string, text: unknown) {
    const word = findWord(this.dict, text);
    if (!word) return { word: null };
    const progress = await this.progress(userId);
    return {
      word: { ...this.card(word, progress), commonness: commonness(word.r) },
    };
  }

  async list(userId: string, query: ListQuery) {
    return listWords(this.dict, await this.progress(userId), query);
  }

  /** One word in full, with its status, which mentioned words have pages, and the words before and after it */
  async word(userId: string, id: string) {
    const dict = this.dict;
    const word = dict.byId.get(id);
    if (!word) throw new NotFoundException('Word not found');
    const progress = await this.progress(userId);
    const before = dict.words[word.r - 2];
    const after = dict.words[word.r];
    return {
      word,
      status: statusOf(word, progress),
      commonness: commonness(word.r),
      links: linkedWords(dict, word),
      prev: before ? { id: before.id, word: before.w } : null,
      next: after ? { id: after.id, word: after.w } : null,
    };
  }

  /** Puts a dictionary word into My words, so it comes up in review */
  async save(userId: string, id: string) {
    const word = this.dict.byId.get(id);
    if (!word) throw new NotFoundException('Word not found');
    const progress = await this.progress(userId);
    if (progress.saved.has(word.w.toLowerCase()))
      return { saved: true, added: false };
    const sense = word.s[0];
    const example = word.ex?.[0]?.[0] ?? sense?.x?.[0] ?? null;
    const result = await this.review.addWordCard(userId, {
      source: 'dict',
      sourceId: word.id,
      word: word.w,
      meaning: sense ? `(${sense.p}) ${sense.d}` : word.w,
      example,
    });
    if (!result)
      throw new ServiceUnavailableException(
        "Couldn't save the word. Try again.",
      );
    return { saved: true, added: result.created };
  }

  async saveMany(userId: string, ids: unknown) {
    if (!Array.isArray(ids) || !ids.length)
      throw new BadRequestException('Choose the words to save');
    let added = 0;
    for (const id of ids.slice(0, MAX_SAVE_MANY).map(String)) {
      if (!this.dict.byId.has(id)) continue;
      const result = await this.save(userId, id);
      if (result.added) added++;
    }
    return { added };
  }

  async setKnown(userId: string, id: string, known: unknown) {
    if (!this.dict.byId.has(id)) throw new NotFoundException('Word not found');
    if (known === false) {
      await this.prisma.knownWord.deleteMany({ where: { userId, wordId: id } });
      return { known: false };
    }
    await this.prisma.knownWord.upsert({
      where: { userId_wordId: { userId, wordId: id } },
      create: { userId, wordId: id, source: 'marked' },
      update: {},
    });
    return { known: true };
  }

  // ---------------- vocabulary size test ----------------

  async startTest(userId: string) {
    const items = buildTest(this.dict);
    const test = await this.prisma.vocabSizeTest.create({
      data: { userId, items: { items } as unknown as Prisma.InputJsonValue },
    });
    return {
      id: test.id,
      items: items.map((i) => ({ key: i.key, text: i.text })),
    };
  }

  private async openTest(userId: string, id: string) {
    const test = await this.prisma.vocabSizeTest.findFirst({
      where: { id, userId },
    });
    if (!test) throw new NotFoundException('Test not found');
    if (test.finishedAt)
      throw new BadRequestException('This test is finished. Start a new one.');
    return { test, stored: test.items as unknown as StoredTest };
  }

  /** Step 2: the words you said you know; returns meaning questions for some of them */
  async answerTest(userId: string, id: string, known: unknown) {
    const { stored } = await this.openTest(userId, id);
    const keys = new Set(stored.items.map((i) => i.key));
    const claimed = Array.isArray(known)
      ? [...new Set(known.map(String))].filter((k) => keys.has(k))
      : [];
    const checks = buildChecks(this.dict, stored.items, new Set(claimed));
    await this.prisma.vocabSizeTest.update({
      where: { id },
      data: {
        items: {
          ...stored,
          claimed,
          checks,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      checks: checks.map((c) => ({
        key: c.key,
        word: stored.items.find((i) => i.key === c.key)!.text,
        options: c.options,
      })),
    };
  }

  /** Step 3: the meaning answers; marks the test and the words you showed you know */
  async finishTest(userId: string, id: string, answers: unknown) {
    const { stored } = await this.openTest(userId, id);
    if (!stored.claimed)
      throw new BadRequestException('Answer the word list first');
    const result = scoreTest(
      stored,
      answers && typeof answers === 'object'
        ? (answers as Record<string, unknown>)
        : {},
    );
    await this.prisma.$transaction([
      this.prisma.vocabSizeTest.update({
        where: { id },
        data: {
          estimate: result.estimate,
          level: result.level,
          bands: result.bands,
          finishedAt: new Date(),
        },
      }),
      this.prisma.knownWord.createMany({
        data: result.knownIds.map((wordId) => ({
          userId,
          wordId,
          source: 'test',
        })),
        skipDuplicates: true,
      }),
    ]);
    // XP for the first test each day
    await this.activity?.recordCappedActivity(
      userId,
      TEST_XP,
      'VOCAB_TEST',
      TEST_XP,
    );
    const progress = await this.progress(userId);
    return {
      ...result,
      knownMarked: result.knownIds.length,
      next: nextWords(this.dict, progress, result.bands, 10).map((w) =>
        this.card(w, progress),
      ),
    };
  }

  async tests(userId: string) {
    return this.prisma.vocabSizeTest.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        estimate: true,
        level: true,
        bands: true,
        finishedAt: true,
      },
    });
  }

  async map(userId: string) {
    const dict = this.dict;
    const [progress, latest] = await Promise.all([
      this.progress(userId),
      this.latestTest(userId),
    ]);
    const bands = (latest?.bands as number[] | null) ?? null;
    return {
      ...wordMap(dict, progress, bands),
      latestTest: latest,
      next: nextWords(dict, progress, bands, 20).map((w) =>
        this.card(w, progress),
      ),
    };
  }
}
