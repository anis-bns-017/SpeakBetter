import { CARD_POOL, buildDeck, drawCard, getCard } from './conversation-cards';
import { MatchQueue } from './match-queue';
import { LIKED_BONUS, MAX_INTEREST_BONUS, QueueEntry, compatible, findPairs, matchScore, maxLevelGap, sharedInterests } from './matching';
import { CARD_COUNT } from './random-call.constants';

const NOW = 1_000_000;
const entry = (userId: string, over: Partial<QueueEntry> = {}): QueueEntry => ({
  userId,
  level: 'intermediate',
  goal: 'casual',
  language: 'English',
  joinedAt: NOW,
  blocked: [],
  recent: [],
  reputation: null,
  ...over,
});

describe('matching: who is the better partner', () => {
  it('finds shared interests without caring about case or spaces', () => {
    expect(sharedInterests(['Music', ' travel', 'football'], ['music', 'Travel ', 'cooking'])).toEqual(['music', 'travel']);
    expect(sharedInterests(undefined, ['music'])).toEqual([]);
    expect(sharedInterests(['music', 'music'], ['music'])).toEqual(['music']);
  });

  it('prefers someone with interests in common, up to a limit', () => {
    const me = entry('me', { interests: ['music', 'travel', 'football', 'films', 'food'] });
    const stranger = entry('a', { interests: ['cars'] });
    const twoInCommon = entry('b', { interests: ['music', 'travel'] });
    const fiveInCommon = entry('c', { interests: ['music', 'travel', 'football', 'films', 'food'] });
    expect(matchScore(me, twoInCommon) - matchScore(me, stranger)).toBe(2);
    expect(matchScore(me, fiveInCommon) - matchScore(me, stranger)).toBe(MAX_INTEREST_BONUS);
  });

  it('prefers someone either of you rated highly before', () => {
    const me = entry('me', { liked: ['old-friend'] });
    expect(matchScore(me, entry('old-friend')) - matchScore(me, entry('new'))).toBe(LIKED_BONUS);
    // it works whichever side gave the rating
    expect(matchScore(entry('x'), entry('y', { liked: ['x'] })) - matchScore(entry('x'), entry('y'))).toBe(LIKED_BONUS);
  });

  it('still lets the hard rules win: a liked partner met minutes ago is not matched', () => {
    const me = entry('me', { liked: ['old-friend'], recent: ['old-friend'] });
    expect(compatible(me, entry('old-friend'), NOW)).toBe(false);
  });

  it('pairs the waiting person with the partner who shares more', () => {
    const pairs = findPairs(
      [
        entry('first', { joinedAt: NOW - 5_000, interests: ['music', 'travel'] }),
        entry('cars-fan', { joinedAt: NOW - 1_000, interests: ['cars'] }),
        entry('music-fan', { joinedAt: NOW - 1_000, interests: ['music', 'travel'] }),
      ],
      NOW,
    );
    expect(pairs.map(([a, b]) => [a.userId, b.userId])).toEqual([['first', 'music-fan']]);
  });

  it('copes with queue entries saved before interests existed', () => {
    const legacy = entry('old');
    delete (legacy as Partial<QueueEntry>).interests;
    delete (legacy as Partial<QueueEntry>).liked;
    expect(Number.isFinite(matchScore(legacy, entry('new', { interests: ['music'] })))).toBe(true);
  });
});

describe('matching: who may talk to whom', () => {
  it('matches the same level straight away', () => {
    expect(compatible(entry('a'), entry('b'), NOW)).toBe(true);
  });

  it('never matches someone with themselves', () => {
    expect(compatible(entry('a'), entry('a'), NOW)).toBe(false);
  });

  it('widens the level gap the longer someone waits', () => {
    expect(maxLevelGap(0)).toBe(0);
    expect(maxLevelGap(10_000)).toBe(1);
    expect(maxLevelGap(30_000)).toBe(2);

    const beginner = entry('a', { level: 'beginner' });
    const intermediate = entry('b', { level: 'intermediate' });
    const advanced = entry('c', { level: 'advanced' });
    expect(compatible(beginner, intermediate, NOW)).toBe(false);
    expect(compatible(beginner, intermediate, NOW + 10_000)).toBe(true);
    expect(compatible(beginner, advanced, NOW + 10_000)).toBe(false);
    expect(compatible(beginner, advanced, NOW + 30_000)).toBe(true);
  });

  it('only matches people practising the same language', () => {
    expect(compatible(entry('a'), entry('b', { language: 'Spanish' }), NOW)).toBe(false);
    expect(compatible(entry('a'), entry('b', { language: 'english' }), NOW)).toBe(true);
  });

  it('never matches across a block, from either side', () => {
    expect(compatible(entry('a', { blocked: ['b'] }), entry('b'), NOW)).toBe(false);
    expect(compatible(entry('a'), entry('b', { blocked: ['a'] }), NOW)).toBe(false);
  });

  it('skips people met recently, until the wait gets long', () => {
    const a = entry('a', { recent: ['b'] });
    const b = entry('b');
    expect(compatible(a, b, NOW + 5_000)).toBe(false);
    expect(compatible(a, b, NOW + 60_000)).toBe(true);
  });
});

describe('matching: pairing a queue', () => {
  it('prefers the same goal and level', () => {
    const waiting = [
      entry('a', { goal: 'interview', joinedAt: NOW - 3000 }),
      entry('b', { goal: 'travel', joinedAt: NOW - 2000 }),
      entry('c', { goal: 'interview', joinedAt: NOW - 1000 }),
    ];
    const pairs = findPairs(waiting, NOW);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].map((e) => e.userId).sort()).toEqual(['a', 'c']);
  });

  it('lets whoever waited longest choose first, and uses each person once', () => {
    const waiting = [entry('a'), entry('b'), entry('c'), entry('d')].map((e, i) => ({
      ...e,
      joinedAt: NOW - (4 - i) * 1000,
    }));
    const pairs = findPairs(waiting, NOW);
    const used = pairs.flat().map((e) => e.userId);
    expect(pairs).toHaveLength(2);
    expect(new Set(used).size).toBe(4);
  });

  it('leaves an odd person waiting', () => {
    const pairs = findPairs([entry('a'), entry('b'), entry('c')], NOW);
    expect(pairs).toHaveLength(1);
  });

  it('pairs nobody when everyone is blocked from everyone', () => {
    const pairs = findPairs(
      [entry('a', { blocked: ['b'] }), entry('b')],
      NOW,
    );
    expect(pairs).toEqual([]);
  });
});

describe('conversation cards', () => {
  const GOAL_NAMES = ['casual', 'interview', 'work', 'travel', 'fun'] as const;

  it('has a complete, unique pool for every goal', () => {
    expect(new Set(CARD_POOL.map((c) => c.id)).size).toBe(CARD_POOL.length);
    for (const goal of GOAL_NAMES) {
      const own = CARD_POOL.filter((c) => c.goal === goal);
      expect(own.length).toBeGreaterThanOrEqual(10);
      // every depth is covered so each level has something to start with
      expect(new Set(own.map((c) => c.depth))).toEqual(new Set([1, 2, 3]));
    }
    for (const card of CARD_POOL) {
      expect(card.question.length).toBeGreaterThan(10);
      expect(card.followUps.length).toBeGreaterThanOrEqual(2);
      expect(card.phrases.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives both people the same deck for a call', () => {
    expect(buildDeck('call-1', 'travel', 'intermediate')).toEqual(
      buildDeck('call-1', 'travel', 'intermediate'),
    );
  });

  it('differs between calls and always has a full, unique deck with two wild cards', () => {
    const one = buildDeck('call-1', 'casual', 'intermediate');
    const two = buildDeck('call-2', 'casual', 'intermediate');
    expect(one.map((c) => c.id)).not.toEqual(two.map((c) => c.id));
    expect(one).toHaveLength(CARD_COUNT);
    expect(new Set(one.map((c) => c.id)).size).toBe(one.length);
    expect(one.filter((c) => c.goal === 'wild')).toHaveLength(2);
    expect(one.filter((c) => c.goal === 'casual')).toHaveLength(CARD_COUNT - 2);
  });

  it('starts beginners with easy cards and advanced speakers with deep ones', () => {
    const easy = buildDeck('call-3', 'interview', 'beginner');
    const hard = buildDeck('call-3', 'interview', 'advanced');
    expect(easy[0].depth).toBe(1);
    expect(hard[0].depth).toBe(3);
  });

  it('can find a card by id, and ignores anything else', () => {
    const card = CARD_POOL[5];
    expect(getCard(card.id)).toBe(card);
    expect(getCard('nope')).toBeUndefined();
    expect(getCard(42)).toBeUndefined();
  });

  describe('the random question generator', () => {
    it('never repeats a card that was already used', () => {
      const used = new Set<string>();
      for (let i = 0; i < 25; i++) {
        const card = drawCard({ goal: 'travel', level: 'intermediate', excludeIds: [...used] });
        expect(used.has(card.id)).toBe(false);
        used.add(card.id);
      }
    });

    it('respects the kind the person picked', () => {
      for (const kind of ['question', 'story', 'opinion', 'game'] as const) {
        for (let i = 0; i < 10; i++) {
          expect(drawCard({ goal: 'casual', level: 'advanced', kind }).kind).toBe(kind);
        }
      }
    });

    it('does not hand beginners the deepest cards', () => {
      for (let i = 0; i < 60; i++) {
        expect(drawCard({ goal: 'work', level: 'beginner' }).depth).toBeLessThanOrEqual(2);
      }
    });

    it('leans toward the goal of the call (plus wild cards)', () => {
      for (let i = 0; i < 40; i++) {
        const card = drawCard({ goal: 'interview', level: 'advanced' });
        expect(['interview', 'wild']).toContain(card.goal);
      }
    });

    it('starts over when every card has been used', () => {
      const every = CARD_POOL.map((c) => c.id);
      const card = drawCard({ goal: 'fun', level: 'advanced', excludeIds: every });
      expect(CARD_POOL).toContain(card);
    });

    it('is random: different draws give different cards', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) seen.add(drawCard({ goal: 'casual', level: 'intermediate' }).id);
      expect(seen.size).toBeGreaterThan(5);
    });
  });
});

describe('the queue: one claim per person', () => {
  it('lets exactly one caller claim a person', async () => {
    const queue = new MatchQueue();
    await queue.add(entry('a'));
    const results = await Promise.all([queue.claim('a'), queue.claim('a'), queue.claim('a')]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await queue.has('a')).toBe(false);
  });

  it('lists and counts who is waiting', async () => {
    const queue = new MatchQueue();
    await queue.add(entry('a'));
    await queue.add(entry('b'));
    expect(await queue.size()).toBe(2);
    expect((await queue.list()).map((e) => e.userId).sort()).toEqual(['a', 'b']);
  });
});
