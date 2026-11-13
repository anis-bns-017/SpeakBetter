import { intervalFor, review, W } from './fsrs';
import { MIN_LESSONS, REFIT_EVERY, type LogRow } from './fsrs.fit';
import { scaled, simulate } from './fsrs.simulate';
import { MemoryModelService } from './memory-model.service';
import { ReviewService } from './review.service';

const FAST = scaled({ 0: 0.35, 1: 0.35, 2: 0.35, 3: 0.35, 8: 0.7 });

/** A database with one learner's review log and (maybe) their memory model */
function setup(rows: LogRow[] = []) {
  let model: any = null;
  const prisma: any = {
    reviewLog: {
      count: jest.fn(async ({ where }) => rows.filter((r) => !where.elapsedDays || (r.elapsedDays ?? 0) >= where.elapsedDays.gte).length),
      findMany: jest.fn(async ({ take }) => [...rows].sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime()).slice(0, take)),
    },
    memoryModel: {
      findUnique: jest.fn(async () => model),
      upsert: jest.fn(async ({ create, update }) => (model = model ? { ...model, ...update } : { ...create })),
    },
  };
  return { service: new MemoryModelService(prisma), prisma, rows, model: () => model };
}

describe('MemoryModelService', () => {
  it('uses the standard weights until a fit is adopted, or when the model cannot be read', async () => {
    const { service, prisma } = setup();
    expect(await service.weightsFor('u1')).toBe(W);
    prisma.memoryModel.findUnique.mockResolvedValueOnce({ active: false, weights: FAST });
    expect(await service.weightsFor('u1')).toBe(W);
    prisma.memoryModel.findUnique.mockResolvedValueOnce({ active: true, weights: FAST });
    expect(await service.weightsFor('u1')).toEqual(FAST);
    prisma.memoryModel.findUnique.mockResolvedValueOnce({ active: true, weights: [1, 2] });
    expect(await service.weightsFor('u1')).toBe(W);
    prisma.memoryModel.findUnique.mockRejectedValueOnce(new Error('no table'));
    expect(await service.weightsFor('u1')).toBe(W);
  });

  it('does not fit with too little history', async () => {
    const { service, prisma } = setup(simulate(FAST, { seed: 1, cards: 10, days: 20 }));
    expect(await service.refitIfDue('u1')).toBe(false);
    expect(prisma.memoryModel.upsert).not.toHaveBeenCalled();
    const summary = await service.summary('u1');
    expect(summary).toMatchObject({ personal: false, needed: MIN_LESSONS, defaultError: null });
    expect(summary.lessons).toBeLessThan(MIN_LESSONS);
  });

  it('fits a learner with enough history, uses the result, and waits for more reviews before fitting again', async () => {
    const { service, rows, model } = setup(simulate(FAST, { seed: 7, cards: 160, days: 150 }));
    expect(await service.refitIfDue('u1')).toBe(true);
    expect(model()).toMatchObject({ userId: 'u1', active: true, logCount: rows.length });
    expect(model().fittedError).toBeLessThan(model().defaultError);

    const weights = await service.weightsFor('u1');
    // This learner forgets fast, so a new card answered "good" comes back sooner than the standard schedule says
    expect(intervalFor(weights[2], 0.9)).toBeLessThan(intervalFor(W[2], 0.9));
    expect(await service.summary('u1')).toMatchObject({ personal: true, lessons: model().lessons });

    expect(await service.refitIfDue('u1')).toBe(false);
    const last = rows[rows.length - 1];
    for (let i = 0; i < REFIT_EVERY; i++) rows.push({ ...last, itemId: `extra${i}`, elapsedDays: null });
    expect(await service.refitIfDue('u1')).toBe(true);
  }, 60_000);

  it('only checks now and then', () => {
    const { service } = setup();
    const due = jest.spyOn(service, 'refitIfDue').mockResolvedValue(false);
    for (let i = 0; i < 25; i++) service.noteAnswer('u1');
    expect(due).toHaveBeenCalledTimes(3);
  });
});

describe('ReviewService with a personal memory model', () => {
  it("schedules with the learner's own weights", async () => {
    const prisma: any = {
      settings: { findUnique: jest.fn().mockResolvedValue(null) },
      flashcard: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) },
      flashcardReview: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => data),
      },
      reviewLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const activity: any = { recordCappedActivity: jest.fn() };
    const memory: any = { weightsFor: jest.fn().mockResolvedValue(FAST), noteAnswer: jest.fn() };
    const service = new ReviewService(prisma, activity, memory);

    const result = await service.answer('u1', { type: 'card', id: 'c1', rating: 'good' });
    // The standard weights bring a new "good" card back in 4 days; this learner's sooner
    const fresh = { memory: null, lastReviewedAt: null, reviewCount: 0, lapses: 0, interval: 0 };
    expect(result.intervalDays).toBe(review(fresh, 'good', new Date(), 0.9, FAST).interval);
    expect(result.intervalDays).toBeLessThan(review(fresh, 'good', new Date(), 0.9, W).interval);
    expect(memory.noteAnswer).toHaveBeenCalledWith('u1');
  });
});
