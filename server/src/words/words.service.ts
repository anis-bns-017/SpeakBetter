// server/src/words/words.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReviewService } from '../learning/review.service';
import {
  MAX_EXAMPLE,
  MAX_LIST,
  cleanText,
  fromCard,
  fromSavedWord,
  normalWord,
  summarize,
  validateMeaning,
  validateNewWord,
  type BankItem,
  type BankItemType,
} from './words.engine';

const REVIEW_FIELDS = {
  stability: true,
  difficulty: true,
  easeFactor: true,
  interval: true,
  reviewCount: true,
  lapses: true,
  lastReviewedAt: true,
  dueAt: true,
} as const;

@Injectable()
export class WordsService {
  constructor(
    private prisma: PrismaService,
    private review: ReviewService,
  ) {}

  /** Every saved word, newest first, with totals for the tiles and filters */
  async list(userId: string, now = new Date()) {
    const [cards, words] = await Promise.all([
      this.prisma.flashcard.findMany({
        where: { userId, kind: 'word' },
        include: {
          reviews: { where: { userId }, select: REVIEW_FIELDS, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_LIST,
      }),
      this.prisma.voiceSavedWord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: MAX_LIST,
      }),
    ]);
    const items = [
      ...cards.map((c) => fromCard(c, now)),
      ...words.map((w) => fromSavedWord(w, now)),
    ].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    return { items, summary: summarize(items, now) };
  }

  /** Adds a word of your own. It goes straight into review, like any saved word. */
  async add(
    userId: string,
    body: { word?: unknown; meaning?: unknown; example?: unknown },
  ): Promise<BankItem> {
    const input = validateNewWord(body);
    if (!input.ok) throw new BadRequestException(input.error);
    const key = normalWord(input.word);

    const [card, saved] = await Promise.all([
      this.prisma.flashcard.findFirst({
        where: {
          userId,
          kind: 'word',
          front: { equals: input.word, mode: 'insensitive' },
        },
        select: { id: true },
      }),
      this.prisma.voiceSavedWord.findFirst({
        where: { userId, word: key },
        select: { id: true },
      }),
    ]);
    if (card || saved)
      throw new ConflictException(`“${input.word}” is already in your words`);

    const result = await this.review.addWordCard(userId, {
      source: 'mine',
      sourceId: key,
      word: input.word,
      meaning: input.meaning,
      example: input.example,
    });
    if (!result)
      throw new ServiceUnavailableException(
        "Couldn't save the word. Try again.",
      );
    if (!result.created)
      throw new ConflictException(`“${input.word}” is already in your words`);

    const created = await this.prisma.flashcard.findFirst({
      where: { userId, source: 'mine', sourceId: key },
      include: {
        reviews: { where: { userId }, select: REVIEW_FIELDS, take: 1 },
      },
    });
    if (!created)
      throw new ServiceUnavailableException(
        "Couldn't save the word. Try again.",
      );
    return fromCard(created, new Date());
  }

  /** Changes what a word means or its example (words heard in rooms often have no meaning yet) */
  async update(
    userId: string,
    type: BankItemType,
    id: string,
    body: { meaning?: unknown; example?: unknown },
  ): Promise<BankItem> {
    const meaning = validateMeaning(body?.meaning);
    if (!meaning.ok) throw new BadRequestException(meaning.error);
    const example = cleanText(body?.example, MAX_EXAMPLE + 1);
    if (example.length > MAX_EXAMPLE)
      throw new BadRequestException(
        `Keep the example under ${MAX_EXAMPLE} characters`,
      );
    const now = new Date();

    if (type === 'card') {
      const { count } = await this.prisma.flashcard.updateMany({
        where: { id, userId, kind: 'word' },
        data: { back: meaning.value, note: example || null },
      });
      if (!count) throw new NotFoundException('Word not found');
      const card = await this.prisma.flashcard.findFirst({
        where: { id, userId },
        include: {
          reviews: { where: { userId }, select: REVIEW_FIELDS, take: 1 },
        },
      });
      if (!card) throw new NotFoundException('Word not found');
      return fromCard(card, now);
    }

    const { count } = await this.prisma.voiceSavedWord.updateMany({
      where: { id, userId },
      data: { meaning: meaning.value, sentence: example || null },
    });
    if (!count) throw new NotFoundException('Word not found');
    const word = await this.prisma.voiceSavedWord.findFirst({
      where: { id, userId },
    });
    if (!word) throw new NotFoundException('Word not found');
    return fromSavedWord(word, now);
  }

  /** Takes a word out of your words and out of review */
  async remove(userId: string, type: BankItemType, id: string) {
    const { count } =
      type === 'card'
        ? await this.prisma.flashcard.deleteMany({
            where: { id, userId, kind: 'word' },
          })
        : await this.prisma.voiceSavedWord.deleteMany({
            where: { id, userId },
          });
    if (!count) throw new NotFoundException('Word not found');
    return { removed: true };
  }
}
