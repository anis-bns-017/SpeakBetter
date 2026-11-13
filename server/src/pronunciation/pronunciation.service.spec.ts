import { BadRequestException, NotFoundException } from '@nestjs/common';
import { practiceLevel, PronunciationService } from './pronunciation.service';

function setup(options: { level?: string | null; pastMisses?: number } = {}) {
  const created: any[] = [];
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level: options.level ?? 'B1' }) },
    flashcard: { findMany: jest.fn().mockResolvedValue([{ front: 'perspective' }, { front: 'a very long phrase with far too many words in it to say' }]) },
    voiceSavedWord: { findMany: jest.fn().mockResolvedValue([{ word: 'Perspective' }, { word: 'thorough' }]) },
    pronunciationAttempt: {
      create: jest.fn(async ({ data }) => {
        const row = { id: `a${created.length + 1}`, createdAt: new Date(), ...data };
        created.push(row);
        return row;
      }),
      count: jest.fn().mockResolvedValue(options.pastMisses ?? 1),
      findMany: jest.fn(async () => created),
      findFirst: jest.fn(async ({ where }) => created.find((a) => a.id === where.id && a.userId === where.userId) ?? null),
      update: jest.fn(async ({ where, data }) => Object.assign(created.find((a) => a.id === where.id), data)),
    },
  };
  const activity: any = { recordCappedActivity: jest.fn().mockResolvedValue(undefined) };
  const review: any = { addCorrectionCard: jest.fn().mockResolvedValue({ created: true }) };
  return { service: new PronunciationService(prisma, activity, review), prisma, activity, review, created };
}

describe('practiceLevel', () => {
  it('reads CEFR codes and older level words', () => {
    expect(practiceLevel('B2')).toBe('B2');
    expect(practiceLevel('c2')).toBe('C1');
    expect(practiceLevel('beginner')).toBe('A1');
    expect(practiceLevel('INTERMEDIATE')).toBe('B1');
    expect(practiceLevel(null)).toBe('A2');
  });
});

describe('PronunciationService', () => {
  it('offers the sounds, sentences for the level and your own short words', async () => {
    const { service } = setup({ level: 'B1' });
    const practice = await service.getPractice('u1');
    expect(practice.level).toBe('B1');
    expect(practice.sounds).toHaveLength(10);
    expect(practice.sounds[0]).toMatchObject({ key: 'TH', attempts: 0, best: null });
    expect(practice.sentences.length).toBeGreaterThan(3);
    // Duplicates (any case) and long phrases are left out
    expect(practice.myWords).toEqual(['perspective', 'thorough']);
  });

  it('scores an attempt, saves it and gives XP for a decent score', async () => {
    const { service, prisma, activity } = setup();
    const result = await service.submitAttempt('u1', { target: 'I think so', heard: ['I think so'], confidence: 0.9 });
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(prisma.pronunciationAttempt.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      target: 'I think so',
      source: 'sentence',
      missedWords: [],
    });
    expect(activity.recordCappedActivity).toHaveBeenCalledWith('u1', 2, 'PRONUNCIATION_PRACTICE', 30);
  });

  it('gives no XP for a poor attempt, and notes the sound that was mixed up', async () => {
    const { service, prisma, activity } = setup();
    const result = await service.submitAttempt('u1', { target: 'think', heard: ['sink'], source: 'word' });
    expect(result.score).toBe(0);
    expect(result.sound).toBe('TH');
    expect(prisma.pronunciationAttempt.create.mock.calls[0][0].data).toMatchObject({ sound: 'TH', missedWords: ['think'] });
    expect(activity.recordCappedActivity).not.toHaveBeenCalled();
  });

  it('keeps the sound you were practising even when another one slipped', async () => {
    const { service } = setup();
    const result = await service.submitAttempt('u1', { target: 'very', heard: ['wary'], sound: 'V_B' });
    expect(result.sound).toBe('V_B');
  });

  it('puts a word in the review deck once you have missed it twice', async () => {
    const once = setup({ pastMisses: 1 });
    expect((await once.service.submitAttempt('u1', { target: 'think', heard: ['sink'] })).addedToReview).toEqual([]);
    expect(once.review.addCorrectionCard).not.toHaveBeenCalled();

    const twice = setup({ pastMisses: 2 });
    const result = await twice.service.submitAttempt('u1', { target: 'think', heard: ['sink'] });
    expect(result.addedToReview).toEqual(['think']);
    expect(twice.review.addCorrectionCard).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ source: 'pronunciation', sourceId: 'word:think', original: 'sink', corrected: 'think', category: 'pronunciation' }),
    );
  });

  it('does not make a card for a word that was simply not heard', async () => {
    const { service, review } = setup({ pastMisses: 5 });
    await service.submitAttempt('u1', { target: 'my name is Sam', heard: ['my name Sam'] });
    expect(review.addCorrectionCard).not.toHaveBeenCalled();
  });

  it('works out the pace of a sentence that was mostly heard, and stores it', async () => {
    const { service, prisma } = setup();
    const result = await service.submitAttempt('u1', {
      target: 'I would like a cup of coffee please',
      heard: ['I would like a cup of coffee please'],
      durationMs: 4000,
    });
    expect(result.pace).toMatchObject({ wordsPerMinute: 120, verdict: 'natural' });
    expect(prisma.pronunciationAttempt.create.mock.calls[0][0].data.result.pace).toMatchObject({ wordsPerMinute: 120 });

    const garbled = await service.submitAttempt('u1', { target: 'I would like a cup of coffee please', heard: ['hello'], durationMs: 4000 });
    expect(garbled.pace).toBeNull();
  });

  it("builds today's drill from your weakest sounds and the words you keep missing", async () => {
    const { service } = setup({ level: 'B1' });
    await service.submitAttempt('u1', { target: 'think', heard: ['sink'], sound: 'TH' });
    await service.submitAttempt('u1', { target: 'think', heard: ['sink'], sound: 'TH' });
    await service.submitAttempt('u1', { target: 'very', heard: ['very'], sound: 'V_W' });
    const drill = await service.getDrill('u1');

    // TH is weak; V_W is fine, so the second sound is one not tried yet
    expect(drill.sounds[0]).toEqual({ key: 'TH', label: expect.any(String), weak: true });
    expect(drill.sounds).toHaveLength(2);
    expect(drill.sounds[1].key).not.toBe('V_W');
    expect(drill.sounds[1].weak).toBe(false);

    const thWords = drill.items.filter((i) => i.sound === 'TH' && !i.target.includes(' '));
    expect(thWords).toHaveLength(2);
    expect(thWords[0].avoid).toBeTruthy();
    // "think" is a trouble word, either already in the TH pairs or added on its own
    expect(drill.troubleWords).toEqual(['think']);
    expect(drill.items.some((i) => i.target === 'think')).toBe(true);
    expect(drill.items.filter((i) => i.source === 'sentence')).toHaveLength(2);
    expect(drill.level).toBe('B1');
  });

  it('gives a beginner a drill of untried sounds and level sentences', async () => {
    const { service } = setup({ level: null });
    const drill = await service.getDrill('u1');
    expect(drill.sounds.every((s) => !s.weak)).toBe(true);
    expect(drill.items.length).toBe(2 * 3 + 2);
    expect(drill.troubleWords).toEqual([]);
  });

  it('rejects an empty target', async () => {
    const { service } = setup();
    await expect(service.submitAttempt('u1', { target: '  ', heard: ['x'] })).rejects.toThrow(BadRequestException);
    await expect(service.submitAttempt('u1', { target: '123', heard: ['x'] })).rejects.toThrow(BadRequestException);
  });

  it('sums up progress: average, weakest sound first, and words missed again and again', async () => {
    const { service } = setup();
    await service.submitAttempt('u1', { target: 'think', heard: ['sink'] });
    await service.submitAttempt('u1', { target: 'think', heard: ['sink'] });
    await service.submitAttempt('u1', { target: 'very', heard: ['very'], sound: 'V_W' });
    const progress = await service.getProgress('u1');
    expect(progress.attempts).toBe(3);
    expect(progress.average).toBe(33);
    expect(progress.sounds.map((s) => s.key)).toEqual(['TH', 'V_W']);
    expect(progress.troubleWords).toEqual([{ word: 'think', count: 2, heardAs: 'sink' }]);
    expect(progress.recent).toHaveLength(3);
  });

  /** What the device reports for a recording: one clear frame per label, with silence between */
  const heardAs = (...labels: string[]) => [3, ...labels.flatMap((label) => [[0.05, label, 0.93], 2])];

  it('judges each sound of an attempt from what the device heard, and keeps it with the attempt', async () => {
    const { service, prisma, created } = setup();
    const attempt = await service.submitAttempt('u1', { target: 'I think.', heard: ['I sink'] });
    const { sounds } = await service.checkSounds('u1', attempt.id, heardAs('aɪ', 's', 'ɪ', 'ŋ', 'k'));

    expect(sounds?.words.map((w) => w.text)).toEqual(['I', 'think.']);
    expect(sounds?.words[0].score).toBe(100);
    expect(sounds?.words[1].phones?.[0]).toMatchObject({ p: 'θ', status: 'wrong', heard: 's' });
    expect(sounds?.tips[0]).toMatchObject({ sound: 'TH', words: ['think'] });
    expect(prisma.pronunciationAttempt.update).toHaveBeenCalledTimes(1);
    // The word-level result is still there next to the new one
    expect(created[0].result.words).toHaveLength(2);
    expect(created[0].result.sounds.score).toBe(sounds?.score);
  });

  it('only checks your own attempts, and needs some speech', async () => {
    const { service } = setup();
    const attempt = await service.submitAttempt('u1', { target: 'think', heard: ['think'] });
    await expect(service.checkSounds('someone-else', attempt.id, heardAs('θ'))).rejects.toThrow(NotFoundException);
    await expect(service.checkSounds('u1', 'nope', heardAs('θ'))).rejects.toThrow(NotFoundException);
    await expect(service.checkSounds('u1', attempt.id, [5])).rejects.toThrow(BadRequestException);
    await expect(service.checkSounds('u1', attempt.id, 'junk')).rejects.toThrow(BadRequestException);
  });

  it('says nothing when the recording cannot be matched to the words', async () => {
    const { service, prisma } = setup();
    const attempt = await service.submitAttempt('u1', { target: 'I think three of them are thirsty', heard: ['x'] });
    expect(await service.checkSounds('u1', attempt.id, heardAs('θ'))).toEqual({ sounds: null });
    expect(prisma.pronunciationAttempt.update).not.toHaveBeenCalled();
  });

  it('lists the single sounds that keep going wrong in progress', async () => {
    const { service } = setup();
    for (let i = 0; i < 5; i++) {
      const attempt = await service.submitAttempt('u1', { target: 'think', heard: ['sink'] });
      await service.checkSounds('u1', attempt.id, heardAs('s', 'ɪ', 'ŋ', 'k'));
    }
    const progress = await service.getProgress('u1');
    expect(progress.weakPhones).toEqual([
      { p: 'θ', ipa: 'θ', hint: 'th as in think', tries: 5, accuracy: 0, heardAs: 's as in see' },
    ]);
  });
});
