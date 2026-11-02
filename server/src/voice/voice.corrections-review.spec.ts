import { VoiceService } from './voice.service';

/** A correction made in a room becomes a flashcard for the person corrected */
function makeService(withReview = true) {
  const prisma: any = {
    voiceParticipant: { findUnique: jest.fn(async () => ({ id: 'p1' })) },
    voiceCorrection: {
      create: jest.fn(async ({ data }) => ({
        ...data,
        status: 'pending',
        createdAt: new Date(),
        author: { id: data.authorId, name: 'Ana' },
        targetUser: { id: data.targetUserId, name: 'Ben' },
      })),
      findUnique: jest.fn(async () => ({ roomId: 'r1', targetUserId: 'ben' })),
      update: jest.fn(async ({ data }) => ({
        id: 'corr-1',
        roomId: 'r1',
        authorId: 'ana',
        targetUserId: 'ben',
        original: 'a',
        corrected: 'b',
        category: 'grammar',
        createdAt: new Date(),
        ...data,
      })),
    },
  };
  const activity: any = { recordActivity: jest.fn(async () => undefined) };
  const review: any = { addCorrectionCard: jest.fn(async () => ({ created: true })), removeCorrectionCard: jest.fn(async () => undefined) };
  const service = new VoiceService(prisma, {} as any, activity, withReview ? review : undefined);
  return { service, prisma, review };
}

const correction = {
  roomId: 'r1',
  id: 'corr-abc123',
  targetUserId: 'ben',
  original: 'I go yesterday',
  corrected: 'I went yesterday',
  note: 'Past tense',
  category: 'grammar',
};

describe('voice corrections feed the review deck', () => {
  it('makes a card for the person who was corrected, not the person who corrected', async () => {
    const { service, review } = makeService();
    await service.createCorrection('ana', correction);
    expect(review.addCorrectionCard).toHaveBeenCalledTimes(1);
    expect(review.addCorrectionCard).toHaveBeenCalledWith('ben', {
      source: 'voice',
      sourceId: 'corr-abc123',
      original: 'I go yesterday',
      corrected: 'I went yesterday',
      note: 'Past tense',
      category: 'grammar',
    });
  });

  it('makes no card for a correction that is rejected', async () => {
    const { service, review } = makeService();
    await expect(service.createCorrection('ana', { ...correction, targetUserId: 'ana' })).rejects.toThrow();
    await expect(service.createCorrection('ana', { ...correction, original: '' })).rejects.toThrow();
    expect(review.addCorrectionCard).not.toHaveBeenCalled();
  });

  it('removes the card when the correction is dismissed, and keeps it when accepted', async () => {
    const { service, review } = makeService();
    await service.resolveCorrection('ben', 'r1', 'corr-1', 'accepted');
    expect(review.removeCorrectionCard).not.toHaveBeenCalled();
    await service.resolveCorrection('ben', 'r1', 'corr-1', 'dismissed');
    expect(review.removeCorrectionCard).toHaveBeenCalledWith('ben', 'voice', 'corr-1');
  });

  it('still works when the review service is not available', async () => {
    const { service } = makeService(false);
    await expect(service.createCorrection('ana', correction)).resolves.toMatchObject({ id: 'corr-abc123' });
    await expect(service.resolveCorrection('ben', 'r1', 'corr-1', 'dismissed')).resolves.toBeDefined();
  });
});
