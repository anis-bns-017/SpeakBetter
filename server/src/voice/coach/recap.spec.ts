import { CoachService } from './coach.service';
import { recapTip, topPattern } from './recap';

const stats = (over: Partial<Parameters<typeof recapTip>[0]> = {}) => ({ speakingSec: 300, words: 400, fillerCount: 2, wpm: 120, topFillers: [], ...over });

describe('recap tip', () => {
  it('leads with the mistake you got corrected on most, when it came up at least twice', () => {
    const articles = [
      { original: 'I have a apple', corrected: 'I have an apple' },
      { original: 'She is teacher', corrected: 'She is a teacher' },
      { original: 'I go yesterday', corrected: 'I went yesterday' },
    ];
    expect(topPattern(articles)).toBe('ARTICLE');
    const tip = recapTip(stats(), articles);
    expect(tip.kind).toBe('mistake');
    expect(tip.title).toBe('Watch your articles (a, an, the)');
    // one of each is not a pattern yet
    expect(topPattern([articles[0], articles[2]])).toBeNull();
  });

  it('asks a quiet learner to speak more', () => {
    expect(recapTip(stats({ speakingSec: 10, words: 12 }), []).kind).toBe('speak-more');
  });

  it('points out filler words when they get in the way', () => {
    const tip = recapTip(stats({ words: 100, fillerCount: 9, topFillers: [{ word: 'um', count: 6 }] }), []);
    expect(tip).toMatchObject({ kind: 'fillers', title: 'Fewer "um"s' });
    // a few fillers in a long session are fine
    expect(recapTip(stats({ words: 600, fillerCount: 6 }), []).kind).toBe('keep-going');
  });

  it('comments on pace only with enough words to judge', () => {
    expect(recapTip(stats({ wpm: 70 }), []).kind).toBe('pace-slow');
    expect(recapTip(stats({ wpm: 190 }), []).kind).toBe('pace-fast');
    expect(recapTip(stats({ wpm: 70, words: 20 }), []).kind).toBe('keep-going');
    expect(recapTip(stats({ wpm: null }), []).kind).toBe('keep-going');
  });
});

describe('CoachService.getRecap', () => {
  const report = {
    roomName: 'Morning chat',
    updatedAt: new Date('2026-11-05T09:30:00Z'),
    createdAt: new Date('2026-11-05T09:00:00Z'),
    durationSec: 1500,
    speakingSec: 240,
    words: 380,
    uniqueWords: 160,
    wpm: 115,
    fluencyScore: 72,
    fillerCount: 4,
    topFillers: [{ word: 'um', count: 3 }],
    richWords: ['comfortable'],
    missionsCompleted: 1,
    correctionsGiven: 2,
  };

  function setup(found = true) {
    const prisma: any = {
      voiceSessionReport: { findUnique: jest.fn().mockResolvedValue(found ? report : null) },
      voiceParticipant: {
        findUnique: jest.fn().mockResolvedValue({ joinedAt: new Date('2026-11-05T08:58:00Z') }),
        findMany: jest.fn().mockResolvedValue([{ user: { id: 'sam', name: 'Sam', avatarUrl: null } }]),
      },
      voiceCorrection: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', original: 'I have a apple', corrected: 'I have an apple', note: null, category: 'grammar', author: { id: 'sam', name: 'Sam', avatarUrl: null } },
        ]),
      },
      voiceSavedWord: { findMany: jest.fn().mockResolvedValue([{ word: 'comfortable', meaning: 'feeling relaxed', sentence: null }]) },
    };
    return { service: new CoachService(prisma, {} as any, {} as any), prisma };
  }

  it('gathers the report, corrections, saved words, people and a tip', async () => {
    const { service, prisma } = setup();
    const recap: any = await service.getRecap('r1', 'u1');
    expect(recap).toMatchObject({
      roomId: 'r1',
      roomName: 'Morning chat',
      speakingSec: 240,
      fluencyScore: 72,
      topFillers: [{ word: 'um', count: 3 }],
      corrections: [{ original: 'I have a apple', corrected: 'I have an apple', author: { name: 'Sam' } }],
      savedWords: [{ word: 'comfortable' }],
      people: [{ id: 'sam', name: 'Sam' }],
    });
    expect(recap.tip.kind).toBe('keep-going');
    // only corrections for you that you did not dismiss, and words saved in this room since you joined
    expect(prisma.voiceCorrection.findMany.mock.calls[0][0].where).toEqual({ roomId: 'r1', targetUserId: 'u1', status: { not: 'dismissed' } });
    expect(prisma.voiceSavedWord.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', roomName: 'Morning chat', createdAt: { gte: new Date('2026-11-05T08:58:00Z') } });
    expect(prisma.voiceParticipant.findMany.mock.calls[0][0].where).toEqual({ roomId: 'r1', userId: { not: 'u1' } });
  });

  it('returns nothing before a report exists', async () => {
    const { service } = setup(false);
    expect(await service.getRecap('r1', 'u1')).toBeNull();
  });
});
