import { categoryCounts, inCategory, matchesQuery, recommendationScore, sameLanguage, sortRooms, trendOf, type DiscoverableRoom } from './discovery';

const room = (over: Partial<DiscoverableRoom> & { people?: number }): DiscoverableRoom => {
  const { people = 0, ...rest } = over;
  return {
    name: 'Room',
    creatorId: 'host',
    createdAt: new Date('2026-11-20T10:00:00Z'),
    participants: Array.from({ length: people }, (_, i) => ({ userId: `p${i}` })),
    ...rest,
  };
};

describe('finding rooms', () => {
  it('treats a language code and its name as the same language', () => {
    expect(sameLanguage('en', 'English')).toBe(true);
    expect(sameLanguage('EN', 'english')).toBe(true);
    expect(sameLanguage('bn', 'English')).toBe(false);
    expect(sameLanguage(null, 'English')).toBe(false);
  });

  it('searches names, descriptions, topics, tags and languages', () => {
    const r = room({ name: 'Morning chat', description: 'Coffee talk', topics: ['IELTS'], tags: ['beginners'], language: 'en' });
    for (const q of ['morning', 'COFFEE', 'ielts', 'beginner', 'english']) expect(matchesQuery(r, q)).toBe(true);
    expect(matchesQuery(r, 'gaming')).toBe(false);
    expect(matchesQuery(r, '  ')).toBe(true);
  });

  it('finds a room by the topics the create form fills in', () => {
    expect(inCategory(room({ topics: ['Study'] }), 'study')).toBe(true);
    expect(inCategory(room({ categories: ['Music'] }), 'Music')).toBe(true);
    expect(inCategory(room({ topics: ['Study'] }), 'Music')).toBe(false);
  });

  it('counts each label once per room and leaves out labels with no room', () => {
    const counts = categoryCounts([room({ topics: ['Study', 'study'], categories: ['Study'] }), room({ topics: ['Study', 'Music'] })]);
    expect(counts).toEqual([
      { name: 'Study', roomCount: 2 },
      { name: 'Music', roomCount: 1 },
    ]);
    expect(categoryCounts([room({})])).toEqual([]);
  });

  it('ranks a full room above an empty one that only has old claps', () => {
    const busy = room({ name: 'busy', people: 3 });
    const clapped = room({ name: 'clapped', trendScore: 12 });
    expect(trendOf(busy)).toBeGreaterThan(trendOf(clapped));
    expect(sortRooms([clapped, busy], 'trending').map((r) => r.name)).toEqual(['busy', 'clapped']);
  });

  it('sorts by people in the room and by newest', () => {
    const a = room({ name: 'a', people: 1, createdAt: new Date('2026-11-22T10:00:00Z') });
    const b = room({ name: 'b', people: 4, createdAt: new Date('2026-11-21T10:00:00Z') });
    expect(sortRooms([a, b], 'popular').map((r) => r.name)).toEqual(['b', 'a']);
    expect(sortRooms([b, a], 'newest').map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('recommends your language, people you know and your interests, never an empty room first', () => {
    const me = { learningLanguages: ['en'], interests: ['travel'], knownPeople: new Set(['friend']) };
    const match = room({ name: 'match', language: 'English', topics: ['Travel'], people: 2 });
    const other = room({ name: 'other', language: 'French', people: 2 });
    const friendHost = room({ name: 'friend', language: 'French', creatorId: 'friend', people: 2 });
    const empty = room({ name: 'empty', language: 'English', topics: ['Travel'] });
    expect(recommendationScore(match, me)).toBeGreaterThan(recommendationScore(friendHost, me));
    expect(recommendationScore(friendHost, me)).toBeGreaterThan(recommendationScore(other, me));
    expect(sortRooms([empty, other, friendHost, match], 'recommended', me)[0].name).toBe('match');
    expect(recommendationScore(empty, me)).toBeLessThan(recommendationScore(match, me));
  });
});
