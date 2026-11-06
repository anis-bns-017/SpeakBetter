import { isRating, NEW_CARD, RATINGS, sanitizeEase } from './srs';

describe('ratings', () => {
  it('accepts only the four answers', () => {
    expect(RATINGS).toEqual(['again', 'hard', 'good', 'easy']);
    expect(isRating('good')).toBe(true);
    expect(isRating('medium')).toBe(false);
    expect(isRating(undefined)).toBe(false);
  });
});

describe('legacy ease', () => {
  it('fixes the odd ease values older reviews stored (0, 2, 4)', () => {
    expect(sanitizeEase(0)).toBe(2.5);
    expect(sanitizeEase(NaN)).toBe(2.5);
    expect(sanitizeEase(2)).toBe(2);
    expect(sanitizeEase(4)).toBe(3);
  });

  it('starts new review rows unlearned', () => {
    expect(NEW_CARD).toMatchObject({ interval: 0, reviewCount: 0, lapses: 0 });
  });
});
