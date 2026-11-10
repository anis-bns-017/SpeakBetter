import { NotFoundException } from '@nestjs/common';
import { BADGES } from '../gamification/badges.catalog';
import { earnedBadges, PublicProfileService, SHOWCASE_SIZE } from './public-profile.service';

const day = (n: number) => new Date(Date.UTC(2026, 10, n));

describe('earnedBadges', () => {
  it('puts the best tier first, then the newest, and skips badges that no longer exist', () => {
    const bronze = BADGES.find((b) => b.tier === 'BRONZE')!.key;
    const gold = BADGES.find((b) => b.tier === 'GOLD')!.key;
    const silverKeys = BADGES.filter((b) => b.tier === 'SILVER').map((b) => b.key);
    const out = earnedBadges([
      { badgeId: bronze, earnedAt: day(4) },
      { badgeId: 'retired-badge', earnedAt: day(4) },
      { badgeId: silverKeys[0], earnedAt: day(1) },
      { badgeId: silverKeys[1], earnedAt: day(3) },
      { badgeId: gold, earnedAt: day(2) },
    ]);
    expect(out.map((b) => b.key)).toEqual([gold, silverKeys[1], silverKeys[0], bronze]);
  });

  it('shows pinned badges first, in the order they were pinned, whatever their tier', () => {
    const bronze = BADGES.find((b) => b.tier === 'BRONZE')!.key;
    const gold = BADGES.find((b) => b.tier === 'GOLD')!.key;
    const silver = BADGES.find((b) => b.tier === 'SILVER')!.key;
    const out = earnedBadges([
      { badgeId: gold, earnedAt: day(2) },
      { badgeId: silver, earnedAt: day(3), pinnedAt: day(9) },
      { badgeId: bronze, earnedAt: day(1), pinnedAt: day(8) },
    ]);
    expect(out.map((b) => b.key)).toEqual([bronze, silver, gold]);
    expect(out.map((b) => b.pinned)).toEqual([true, true, false]);
  });
});

interface Setup {
  user?: any;
  blocked?: boolean;
  friend?: boolean;
  request?: 'sent' | 'received' | null;
  following?: boolean;
}

function setup(o: Setup = {}) {
  const user =
    o.user === undefined
      ? {
          id: 'bob',
          name: 'Bob',
          avatarUrl: null,
          createdAt: day(1),
          profile: {
            username: null,
            displayName: null,
            bio: 'Hello',
            avatarUrl: null,
            country: 'BD',
            nativeLanguage: 'bn',
            learningLanguages: ['en'],
            interests: ['music'],
            level: 'B1',
            isVerified: false,
            lastActive: day(3),
          },
          settings: { showProfilePublic: true, showOnlineStatus: true },
        }
      : o.user;
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    block: { findFirst: jest.fn().mockResolvedValue(o.blocked ? { id: 'b' } : null) },
    follow: {
      count: jest.fn(async ({ where }: any) => (where.followerId === 'amy' && where.followingId === 'bob' ? (o.following ? 1 : 0) : 3)),
    },
    friend: {
      findFirst: jest.fn().mockResolvedValue(o.friend ? { id: 'f' } : null),
      count: jest.fn().mockResolvedValue(2),
    },
    friendRequest: {
      findFirst: jest.fn().mockResolvedValue(o.request ? { fromUserId: o.request === 'sent' ? 'amy' : 'bob' } : null),
    },
    xpTransaction: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 340 } }) },
    streak: { findUnique: jest.fn().mockResolvedValue({ currentStreak: 5, longestStreak: 9, lastActivityDate: new Date(), freezes: 0 }) },
    userBadge: { findMany: jest.fn().mockResolvedValue([{ badgeId: 'streak-3', earnedAt: day(2) }]) },
    leagueProfile: { findUnique: jest.fn().mockResolvedValue({ tier: 2, bestTier: 3 }) },
    grammarProgress: { count: jest.fn().mockResolvedValue(4) },
    libraryProgress: { count: jest.fn().mockResolvedValue(6) },
    challengeEntry: { count: jest.fn().mockResolvedValue(8) },
  };
  return { service: new PublicProfileService(prisma), prisma };
}

describe('PublicProfileService', () => {
  it('shows a public profile with stats, league, badges and how you are connected', async () => {
    const { service } = setup({ following: true, request: 'sent' });
    const p: any = await service.get('amy', 'bob');
    expect(p).toMatchObject({
      id: 'bob',
      private: false,
      name: 'Bob',
      level: 'B1',
      country: 'BD',
      stats: { xp: 340, streak: 5, longestStreak: 9, lessonsPassed: 4, textsRead: 6, challengeAnswers: 8, followers: 3, friends: 2 },
      league: { index: 2, name: 'Gold', best: 'Sapphire' },
      relationship: { isMe: false, following: true, isFriend: false, friendRequest: 'sent' },
    });
    expect(p.badges.earned).toBe(1);
    expect(p.badges.showcase).toHaveLength(1);
    expect(p.badges.total).toBe(BADGES.length);
    expect(p.lastActive).toEqual(day(3));
  });

  it('never leaks contact details or private fields', async () => {
    const { service, prisma } = setup();
    const p = JSON.stringify(await service.get('amy', 'bob'));
    expect(p).not.toMatch(/email|dateOfBirth|timezone|password/i);
    const select = prisma.user.findUnique.mock.calls[0][0].select;
    expect(select.email).toBeUndefined();
    expect(select.profile.select.dateOfBirth).toBeUndefined();
    expect(select.profile.select.timezone).toBeUndefined();
  });

  it('prefers the display name and hides last seen when online status is off', async () => {
    const { service } = setup({
      user: {
        id: 'bob',
        name: 'Bob',
        avatarUrl: 'u.png',
        createdAt: day(1),
        profile: { displayName: 'Bobby', avatarUrl: null, learningLanguages: [], interests: [], lastActive: day(3) },
        settings: { showProfilePublic: true, showOnlineStatus: false },
      },
    });
    const p: any = await service.get('amy', 'bob');
    expect(p.name).toBe('Bobby');
    expect(p.avatarUrl).toBe('u.png');
    expect(p.lastActive).toBeNull();
  });

  it('shows only a name and photo when the profile is private', async () => {
    const hidden = { id: 'bob', name: 'Bob', avatarUrl: null, createdAt: day(1), profile: null, settings: { showProfilePublic: false, showOnlineStatus: true } };
    const stranger: any = await setup({ user: hidden }).service.get('amy', 'bob');
    expect(stranger).toEqual({ id: 'bob', name: 'Bob', avatarUrl: null, private: true, relationship: expect.objectContaining({ isFriend: false }) });
    expect(stranger.stats).toBeUndefined();
  });

  it('shows a private profile to friends and to its owner', async () => {
    const hidden = { id: 'bob', name: 'Bob', avatarUrl: null, createdAt: day(1), profile: null, settings: { showProfilePublic: false, showOnlineStatus: true } };
    const friend: any = await setup({ user: hidden, friend: true }).service.get('amy', 'bob');
    expect(friend.private).toBe(false);
    expect(friend.relationship.isFriend).toBe(true);
    const owner: any = await setup({ user: hidden }).service.get('bob', 'bob');
    expect(owner.private).toBe(false);
    expect(owner.relationship.isMe).toBe(true);
  });

  it('treats people who are not found, or blocked either way, as not found', async () => {
    await expect(setup({ user: null }).service.get('amy', 'bob')).rejects.toThrow(NotFoundException);
    await expect(setup({ blocked: true }).service.get('amy', 'bob')).rejects.toThrow(NotFoundException);
  });

  it('caps the showcase and keeps the full list', async () => {
    const { service, prisma } = setup();
    prisma.userBadge.findMany.mockResolvedValue(BADGES.slice(0, 9).map((b, i) => ({ badgeId: b.key, earnedAt: day(i + 1) })));
    const p: any = await service.get('amy', 'bob');
    expect(p.badges.showcase).toHaveLength(SHOWCASE_SIZE);
    expect(p.badges.all).toHaveLength(9);
  });
});
