import { readOnboarding } from './onboarding';

describe('readOnboarding', () => {
  it('keeps valid answers', () => {
    expect(
      readOnboarding({ nativeLanguage: ' BN ', goals: ['work', 'exam', 'work'], selfLevel: 'basic', dailyGoalMinutes: 20, interfaceLanguage: 'bn' }),
    ).toEqual({ nativeLanguage: 'bn', goals: ['work', 'exam'], selfLevel: 'basic', dailyGoalMinutes: 20, interfaceLanguage: 'bn' });
  });

  it('drops what it does not know, so a skipped or odd step changes nothing', () => {
    expect(readOnboarding({ nativeLanguage: '<script>', goals: ['hack'], selfLevel: 'expert', dailyGoalMinutes: 7, interfaceLanguage: 'xx' })).toEqual({
      nativeLanguage: null,
      goals: null,
      selfLevel: null,
      dailyGoalMinutes: null,
      interfaceLanguage: null,
    });
    expect(readOnboarding({})).toMatchObject({ nativeLanguage: null, goals: null });
    expect(readOnboarding({ nativeLanguage: 'other' }).nativeLanguage).toBe('other');
  });
});
