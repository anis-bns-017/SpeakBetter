import { rankSuggestions, scoreSuggestion } from './friend-suggestions';
import { FriendsService } from './friends.service';

const NOW = new Date('2026-10-30T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000);

// I speak Spanish and I'm learning English and Japanese
const me = { nativeLanguage: 'Spanish', learningLanguages: ['English', 'Japanese'], interests: ['travel', 'music', 'cooking'] };

const person = (id: string, profile: Record<string, unknown>) => ({ id, name: id, avatarUrl: null, profile: profile as any });

describe('friend suggestion ranking', () => {
  it('puts a two-way language exchange first', () => {
    const ranked = rankSuggestions(me, [
      person('sameLearner', { nativeLanguage: 'French', learningLanguages: ['English'], lastActive: hoursAgo(1) }),
      person('exchange', { nativeLanguage: 'English', learningLanguages: ['Spanish'], lastActive: hoursAgo(200) }),
      person('teacher', { nativeLanguage: 'Japanese', learningLanguages: ['German'], lastActive: hoursAgo(1) }),
    ], 10, NOW);

    expect(ranked.map((r) => r.id)).toEqual(['exchange', 'teacher', 'sameLearner']);
    expect(ranked[0].reason).toBe('Perfect language exchange — English for Spanish');
    expect(ranked[1].reason).toBe("Native Japanese speaker — you're learning it");
    expect(ranked[2].reason).toBe('Also learning English');
  });

  it('matches languages and interests regardless of case and caps shared interests', () => {
    const s = scoreSuggestion(me, person('a', {
      nativeLanguage: 'english',
      learningLanguages: [],
      interests: ['Travel', 'MUSIC', 'cooking', 'chess'],
    }), NOW);
    expect(s.reason).toBe("Native english speaker — you're learning it");
    expect(s.sharedInterests).toEqual(['Travel', 'MUSIC', 'cooking']);
    expect(s.matchScore).toBe(5 + 3);
  });

  it('breaks ties by recent activity and rewards being active', () => {
    const ranked = rankSuggestions(me, [
      person('lastMonth', { lastActive: hoursAgo(24 * 30) }),
      person('thisWeek', { lastActive: hoursAgo(48) }),
      person('today', { lastActive: hoursAgo(2) }),
    ], 10, NOW);
    expect(ranked.map((r) => r.id)).toEqual(['today', 'thisWeek', 'lastMonth']);
    expect(ranked[0].reason).toBe('Active today');
    expect(ranked[2].reason).toBe('New to practice with');
  });

  it('copes with people (or me) without a profile and respects the limit', () => {
    const ranked = rankSuggestions(null, [
      { id: 'x', name: 'x', profile: null },
      person('y', { nativeLanguage: 'English' }),
    ], 1, NOW);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].isRequested).toBe(false);
  });
});

describe('FriendsService.getSuggestions', () => {
  const makeService = () => {
    const prisma: any = {
      profile: { findUnique: jest.fn().mockResolvedValue(me) },
      friend: { findMany: jest.fn().mockResolvedValue([{ fromUserId: 'me', toUserId: 'friend' }]) },
      friendRequest: { findMany: jest.fn().mockResolvedValue([{ fromUserId: 'asker', toUserId: 'me' }, { fromUserId: 'me', toUserId: 'asked' }]) },
      block: { findMany: jest.fn().mockResolvedValue([{ blockerId: 'blocker', blockedId: 'me' }, { blockerId: 'me', blockedId: 'pest' }]) },
      user: {
        findMany: jest.fn().mockResolvedValue([
          person('teacher', { nativeLanguage: 'English', learningLanguages: [], lastActive: new Date() }),
          person('stranger', { nativeLanguage: 'Korean', learningLanguages: [], lastActive: new Date(0) }),
        ]),
      },
    };
    return { service: new FriendsService(prisma), prisma };
  };

  it('leaves out me, friends, pending requests both ways and blocks both ways', async () => {
    const { service, prisma } = makeService();
    await service.getSuggestions('me');
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(new Set(where.id.notIn)).toEqual(new Set(['me', 'friend', 'asker', 'asked', 'blocker', 'pest']));
    // Only people who allow friend requests and keep a public profile (or never changed settings)
    expect(where.OR).toEqual([
      { settings: { is: null } },
      { settings: { is: { allowFriendRequests: true, showProfilePublic: true } } },
    ]);
    expect(prisma.friendRequest.findMany.mock.calls[0][0].where.status).toBe('PENDING');
  });

  it('returns the best match first with a reason, and clamps the limit', async () => {
    const { service } = makeService();
    const result = await service.getSuggestions('me', 500);
    expect(result[0]).toMatchObject({ id: 'teacher', reason: "Native English speaker — you're learning it", isRequested: false });
    expect(result).toHaveLength(2);
  });
});
