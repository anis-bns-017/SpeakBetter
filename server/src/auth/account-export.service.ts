// server/src/auth/account-export.service.ts
// "Download my data": everything the account owns, as one JSON file, so people can keep a copy or take it elsewhere.
// Never included: password hash, sign-in tokens, device push keys, other people's private data. Each list is
// capped, so one very busy account cannot use up the server's memory.

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const EXPORT_ROW_LIMIT = 5000;

type Source = { key: string; run: () => Promise<unknown> };

@Injectable()
export class AccountExportService {
  constructor(private prisma: PrismaService) {}

  async build(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, googleId: true },
    });
    if (!user) throw new NotFoundException('Account not found');

    const p = this.prisma;
    const mine = { where: { userId }, take: EXPORT_ROW_LIMIT };
    const newest = { ...mine, orderBy: { createdAt: 'desc' as const } };

    const sources: Source[] = [
      { key: 'profile', run: () => p.profile.findUnique({ where: { userId } }) },
      { key: 'settings', run: () => p.settings.findUnique({ where: { userId } }) },
      { key: 'streak', run: () => p.streak.findUnique({ where: { userId } }) },
      { key: 'xp', run: () => p.xpTransaction.findMany(newest) },
      { key: 'badges', run: () => p.userBadge.findMany(mine) },
      { key: 'flashcards', run: () => p.flashcard.findMany(mine) },
      { key: 'reviewHistory', run: () => p.reviewLog.findMany(mine) },
      { key: 'savedWordsFromRooms', run: () => p.voiceSavedWord.findMany(mine) },
      { key: 'knownWords', run: () => p.knownWord.findMany(mine) },
      { key: 'writing', run: () => p.writingPiece.findMany(newest) },
      { key: 'pronunciation', run: () => p.pronunciationAttempt.findMany(newest) },
      { key: 'levelTests', run: () => p.placementAttempt.findMany(mine) },
      { key: 'vocabularySizeTests', run: () => p.vocabSizeTest.findMany(mine) },
      { key: 'dailyPlans', run: () => p.dailyPlan.findMany(mine) },
      { key: 'dailyChallenges', run: () => p.challengeEntry.findMany(mine) },
      { key: 'libraryProgress', run: () => p.libraryProgress.findMany(mine) },
      { key: 'grammarProgress', run: () => p.grammarProgress.findMany(mine) },
      { key: 'wordPackProgress', run: () => p.vocabPackProgress.findMany(mine) },
      { key: 'dictation', run: () => p.dictationResult.findMany(newest) },
      { key: 'wordGames', run: () => p.gameResult.findMany(newest) },
      { key: 'rolePlay', run: () => p.roleplayProgress.findMany(mine) },
      { key: 'shadowing', run: () => p.shadowingProgress.findMany(mine) },
      {
        key: 'messagesIWrote',
        run: () =>
          p.message.findMany({
            where: { senderId: userId, deletedAt: null },
            select: { id: true, chatId: true, content: true, type: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: EXPORT_ROW_LIMIT,
          }),
      },
      {
        key: 'following',
        run: () => p.follow.findMany({ where: { followerId: userId }, select: { followingId: true, createdAt: true }, take: EXPORT_ROW_LIMIT }),
      },
    ];

    const settled = await Promise.allSettled(sources.map((s) => s.run()));
    const data: Record<string, unknown> = {};
    const unavailable: string[] = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') data[sources[i].key] = r.value;
      else unavailable.push(sources[i].key);
    });

    return {
      about: 'Your SpeakBetter data. Sign-in secrets and other people\'s private details are not included.',
      exportedAt: now.toISOString(),
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        signsInWithGoogle: !!user.googleId,
      },
      limitPerList: EXPORT_ROW_LIMIT,
      ...(unavailable.length ? { unavailable } : {}),
      ...data,
    };
  }
}
