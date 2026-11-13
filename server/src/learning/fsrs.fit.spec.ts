import { intervalFor, nextMemory, W, type Weights } from './fsrs';
import { buildHistories, calibrationError, countLessons, fitLearner, logLoss, MIN_LESSONS, type LogRow } from './fsrs.fit';
import { scaled, simulate } from './fsrs.simulate';

/** Days until a new card first answered "good" comes back at a 90% target */
const firstGap = (w: Weights) => intervalFor(w[2], 0.9);
/** ...and the gap after one more "good", at the moment it was due */
const secondGap = (w: Weights) => {
  const m = nextMemory(null, 1, 'good', w);
  const after = nextMemory(m, 0.9, 'good', w);
  return intervalFor(after.stability, 0.9);
};


describe('buildHistories', () => {
  const at = (day: number) => new Date(Date.UTC(2026, 0, 1 + day));
  it('groups by card, keeps only cards whose whole life is logged, and needs two answers', () => {
    const rows: LogRow[] = [
      { itemType: 'card', itemId: 'a', rating: 'good', reviewedAt: at(3), elapsedDays: 3 },
      { itemType: 'card', itemId: 'a', rating: 'good', reviewedAt: at(0), elapsedDays: null },
      { itemType: 'word', itemId: 'a', rating: 'good', reviewedAt: at(0), elapsedDays: null },
      { itemType: 'card', itemId: 'old', rating: 'good', reviewedAt: at(1), elapsedDays: 9 },
      { itemType: 'card', itemId: 'old', rating: 'again', reviewedAt: at(5), elapsedDays: 4 },
      { itemType: 'card', itemId: 'x', rating: 'weird', reviewedAt: at(0), elapsedDays: null },
    ];
    const histories = buildHistories(rows);
    expect(histories).toEqual([[{ rating: 'good', at: at(0).getTime() }, { rating: 'good', at: at(3).getTime() }]]);
    expect(countLessons(histories)).toBe(1);
  });
});

describe('fitLearner', () => {
  const run = async (truth: Weights, seed: number) => {
    const fit = await fitLearner(buildHistories(simulate(truth, { seed, cards: 160, days: 150 })));
    if (process.env.FIT_DEBUG && fit) console.log(JSON.stringify({ ...fit, weights: fit.weights.map((x) => +x.toFixed(2)), first: [firstGap(W), firstGap(fit.weights)], second: [secondGap(W), secondGap(fit.weights)] }));
    return fit;
  };

  it('waits until there is enough history', async () => {
    const rows = simulate(W, { seed: 1, cards: 10, days: 30 });
    expect(countLessons(buildHistories(rows))).toBeLessThan(MIN_LESSONS);
    expect(await fitLearner(buildHistories(rows))).toBeNull();
  });

  it('learns that a fast forgetter needs reviews sooner, and predicts them better', async () => {
    // Forgets new cards about three times faster, and memories grow more slowly
    const truth = scaled({ 0: 0.35, 1: 0.35, 2: 0.35, 3: 0.35, 8: 0.7 });
    const fit = await run(truth, 7);
    expect(fit).not.toBeNull();
    expect(fit!.adopted).toBe(true);
    expect(fit!.fittedLoss).toBeLessThan(fit!.defaultLoss);
    expect(fit!.fittedError).toBeLessThan(fit!.defaultError);
    expect(firstGap(fit!.weights)).toBeLessThan(firstGap(W) * 0.75);
    expect(secondGap(fit!.weights)).toBeLessThan(secondGap(W));
  }, 120_000);

  it('learns that a strong memory can wait longer', async () => {
    const truth = scaled({ 0: 2.5, 1: 2.5, 2: 2.5, 3: 2.5, 8: 1.25 });
    const fit = await run(truth, 11);
    expect(fit!.adopted).toBe(true);
    expect(fit!.fittedLoss).toBeLessThan(fit!.defaultLoss);
    expect(firstGap(fit!.weights)).toBeGreaterThan(firstGap(W) * 1.3);
    expect(secondGap(fit!.weights)).toBeGreaterThan(secondGap(W));
  }, 120_000);

  it('stays close to the defaults for a learner they already describe', async () => {
    const fit = await run(W, 23);
    expect(fit).not.toBeNull();
    // Either it keeps the defaults, or what it found schedules much the same
    const ratio = firstGap(fit!.weights) / firstGap(W);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.6);
    expect(fit!.fittedLoss).toBeLessThanOrEqual(fit!.defaultLoss + 0.01);
  }, 120_000);
});

describe('logLoss and calibrationError', () => {
  it('score the true weights better than wrong ones on the data they made', () => {
    const truth = scaled({ 0: 0.35, 1: 0.35, 2: 0.35, 3: 0.35 });
    const histories = buildHistories(simulate(truth, { seed: 3, cards: 120, days: 120 }));
    expect(logLoss(histories, truth).loss).toBeLessThan(logLoss(histories, W).loss);
    expect(calibrationError(histories, truth)).toBeLessThan(calibrationError(histories, W));
  });
});
