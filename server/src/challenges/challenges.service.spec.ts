import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CHALLENGE_XP, ChallengesService } from './challenges.service';
import { promptFor } from './challenge.prompts';
import { dayKey } from '../insights/plan.engine';

const TRANSCRIPT =
  'Last year I went on a trip to the mountains with my family. We stayed in a small hotel near a lake and we visited ' +
  'a beautiful old village. The best part was walking in the forest every morning. I really enjoyed the holiday.';

function setup() {
  const entries: any[] = [];
  const reactions: any[] = [];
  const withIncludes = (e: any) =>
    e && { ...e, user: { id: e.userId, name: `Name ${e.userId}`, avatarUrl: null }, reactions: reactions.filter((r) => r.entryId === e.id) };
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level: 'A2' }) },
    challengeEntry: {
      findUnique: jest.fn(async ({ where }) => {
        const e = where.id ? entries.find((x) => x.id === where.id) : entries.find((x) => x.userId === where.userId_day.userId && x.day === where.userId_day.day);
        return withIncludes(e) ?? null;
      }),
      findMany: jest.fn(async ({ where, select }) => {
        let list = entries.filter((e) => (!where.day || e.day === where.day) && (!where.visibility || e.visibility === where.visibility));
        if (where.userId?.not) list = list.filter((e) => e.userId !== where.userId.not);
        else if (typeof where.userId === 'string') list = list.filter((e) => e.userId === where.userId);
        return select ? list.map((e) => ({ day: e.day })) : list.map(withIncludes);
      }),
      create: jest.fn(async ({ data }) => {
        const e = { id: `e${entries.length + 1}`, createdAt: new Date(), ...data };
        entries.push(e);
        return e;
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(entries.find((e) => e.id === where.id), data)),
      deleteMany: jest.fn(async ({ where }) => {
        const before = entries.length;
        for (let i = entries.length - 1; i >= 0; i--) if (entries[i].userId === where.userId && entries[i].day === where.day) entries.splice(i, 1);
        return { count: before - entries.length };
      }),
    },
    challengeReaction: {
      deleteMany: jest.fn(async ({ where }) => {
        for (let i = reactions.length - 1; i >= 0; i--) {
          if (reactions[i].entryId === where.entryId && (!where.userId || reactions[i].userId === where.userId)) reactions.splice(i, 1);
        }
        return { count: 0 };
      }),
      upsert: jest.fn(async ({ where, create, update }) => {
        const r = reactions.find((x) => x.entryId === where.entryId_userId.entryId && x.userId === where.entryId_userId.userId);
        if (r) Object.assign(r, update);
        else reactions.push({ ...create });
        return r ?? create;
      }),
      findMany: jest.fn(async ({ where }) => reactions.filter((r) => r.entryId === where.entryId)),
    },
    user: { findUnique: jest.fn(async ({ where }) => ({ id: where.id, name: `Name ${where.id}`, avatarUrl: null })) },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const notifications: any = { notify: jest.fn().mockResolvedValue(1) };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  return { service: new ChallengesService(prisma, activity, notifications, badges), entries, reactions, activity, notifications, badges };
}

const todayPrompt = (level: 'A2' | 'B1' = 'A2') => promptFor(level, new Date()).id;
const answer = (extra: Record<string, unknown> = {}) => ({
  promptId: todayPrompt(),
  audioUrl: 'https://res.cloudinary.com/demo/video/upload/answer.mp3',
  transcript: TRANSCRIPT,
  durationSec: 50,
  ...extra,
});

describe('ChallengesService', () => {
  it("shows today's prompt for your level and every level's title", async () => {
    const { service } = setup();
    const today = await service.today('me');
    expect(today).toMatchObject({ level: 'A2', ownLevel: 'A2', mine: null, feed: [], streak: 0, total: 0, day: dayKey(new Date()) });
    expect(today.prompt.id).toBe(todayPrompt());
    expect(today.levels).toHaveLength(5);
    expect((await service.today('me', 'B1')).prompt.level).toBe('B1');
  });

  it('saves an answer with scores, gives XP once, and replaces it when you record again', async () => {
    const { service, activity, badges, entries } = setup();
    const first = await service.submit('me', answer());
    expect(first).toMatchObject({ firstToday: true, xp: CHALLENGE_XP });
    expect(first.entry?.stats.score).toBeGreaterThan(0);
    expect(activity.recordActivity).toHaveBeenCalledWith('me', CHALLENGE_XP, 'CHALLENGE_COMPLETED');
    expect(badges.evaluate).toHaveBeenCalledWith('me');

    const again = await service.submit('me', answer({ durationSec: 40, visibility: 'private' }));
    expect(again).toMatchObject({ firstToday: false, xp: 0 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ durationSec: 40, visibility: 'private' });
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('only accepts real, recorded answers to a prompt of today', async () => {
    const { service } = setup();
    await expect(service.submit('me', answer({ promptId: 'a2-999' }))).rejects.toThrow(BadRequestException);
    await expect(service.submit('me', answer({ audioUrl: 'javascript:alert(1)' }))).rejects.toThrow(/Record/);
    await expect(service.submit('me', answer({ durationSec: 2 }))).rejects.toThrow(/seconds/);
    // A prompt for another level today is fine
    await expect(service.submit('me', answer({ promptId: todayPrompt('B1') }))).resolves.toMatchObject({ firstToday: true });
  });

  it("lists others' public answers, most cheered first, and counts your streak", async () => {
    const { service } = setup();
    await service.submit('a', answer());
    await service.submit('b', answer());
    await service.submit('hidden', answer({ visibility: 'private' }));
    await service.react('me', 'e2', '🔥');
    await service.submit('me', answer());
    const today = await service.today('me');
    expect(today.feed.map((e) => e.user.id)).toEqual(['b', 'a']);
    expect(today.feed[0]).toMatchObject({ reactions: { '🔥': 1 }, myReaction: '🔥', isMine: false });
    expect(today.mine?.isMine).toBe(true);
    expect(today.streak).toBe(1);
  });

  it('reacts, tells the author once, and lets you take it back', async () => {
    const { service, notifications } = setup();
    await service.submit('author', answer());
    expect(await service.react('me', 'e1', '👏')).toMatchObject({ reactions: { '👏': 1 }, myReaction: '👏' });
    expect(notifications.notify).toHaveBeenCalledWith(
      ['author'],
      expect.objectContaining({ type: 'CHALLENGE_REACTION', dedupeKey: 'challenge-react:e1:me', preference: 'challenges' }),
    );
    expect(await service.react('me', 'e1', '❤️')).toMatchObject({ reactions: { '❤️': 1 }, totalReactions: 1 });
    expect(await service.react('me', 'e1', null)).toMatchObject({ totalReactions: 0, myReaction: null });
  });

  it("won't react to your own answer, a private one, or with an unknown emoji", async () => {
    const { service } = setup();
    await service.submit('me', answer());
    await service.submit('shy', answer({ visibility: 'private' }));
    await service.submit('other', answer());
    await expect(service.react('me', 'e1', '👏')).rejects.toThrow(ForbiddenException);
    await expect(service.react('me', 'e2', '👏')).rejects.toThrow(NotFoundException);
    await expect(service.react('me', 'e3', '💩')).rejects.toThrow(/Unknown/);
  });

  it("deletes today's answer", async () => {
    const { service, entries } = setup();
    await service.submit('me', answer());
    await service.removeMine('me');
    expect(entries).toHaveLength(0);
    await expect(service.removeMine('me')).rejects.toThrow(NotFoundException);
  });
});
