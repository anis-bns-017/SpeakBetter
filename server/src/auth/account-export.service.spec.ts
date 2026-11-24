import { NotFoundException } from '@nestjs/common';
import { AccountExportService, EXPORT_ROW_LIMIT } from './account-export.service';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

function makePrisma(overrides: Record<string, unknown> = {}) {
  const list = jest.fn().mockResolvedValue(rows(2));
  const one = jest.fn().mockResolvedValue({ userId: 'u1' });
  const model = { findMany: list, findUnique: one };
  const names = [
    'profile', 'settings', 'streak', 'xpTransaction', 'userBadge', 'flashcard', 'reviewLog', 'voiceSavedWord', 'knownWord',
    'writingPiece', 'pronunciationAttempt', 'placementAttempt', 'vocabSizeTest', 'dailyPlan', 'challengeEntry',
    'libraryProgress', 'grammarProgress', 'vocabPackProgress', 'dictationResult', 'gameResult', 'roleplayProgress',
    'shadowingProgress', 'message', 'follow',
  ];
  const prisma: Record<string, unknown> = Object.fromEntries(names.map((n) => [n, model]));
  prisma.user = {
    findUnique: jest.fn().mockResolvedValue({
      id: 'u1', email: 'a@b.c', name: 'A', avatarUrl: null, createdAt: new Date('2026-01-01'), googleId: null, ...overrides,
    }),
  };
  return { prisma, list };
}

describe('AccountExportService', () => {
  it('collects the account and every list, and says when it was made', async () => {
    const { prisma } = makePrisma();
    const out = (await new AccountExportService(prisma as never).build('u1', new Date('2026-11-22T10:00:00Z'))) as Record<string, any>;
    expect(out.exportedAt).toBe('2026-11-22T10:00:00.000Z');
    expect(out.account).toMatchObject({ id: 'u1', email: 'a@b.c', signsInWithGoogle: false });
    expect(out.flashcards).toHaveLength(2);
    expect(out.wordGames).toHaveLength(2);
    expect(out.unavailable).toBeUndefined();
  });

  it('never includes the password hash or sign-in secrets', async () => {
    const { prisma } = makePrisma({ passwordHash: 'secret-hash', googleId: 'g-1' });
    const text = JSON.stringify(await new AccountExportService(prisma as never).build('u1'));
    expect(text).not.toContain('secret-hash');
    expect(text).not.toContain('g-1');
    expect(JSON.parse(text).account.signsInWithGoogle).toBe(true);
  });

  it('only asks for the owner\'s rows, with a cap on each list', async () => {
    const { prisma, list } = makePrisma();
    await new AccountExportService(prisma as never).build('u1');
    for (const [arg] of list.mock.calls) {
      expect(JSON.stringify(arg.where)).toContain('u1');
      expect(arg.take).toBe(EXPORT_ROW_LIMIT);
    }
  });

  it('still exports the rest when one list fails, and names the one that failed', async () => {
    const { prisma } = makePrisma();
    (prisma.flashcard as { findMany: jest.Mock }) = { findMany: jest.fn().mockRejectedValue(new Error('db')) };
    const out = (await new AccountExportService(prisma as never).build('u1')) as Record<string, any>;
    expect(out.unavailable).toEqual(['flashcards']);
    expect(out.writing).toHaveLength(2);
  });

  it('refuses an unknown account', async () => {
    const { prisma } = makePrisma();
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
    await expect(new AccountExportService(prisma as never).build('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
