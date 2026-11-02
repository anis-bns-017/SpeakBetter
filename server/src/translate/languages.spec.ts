import { isEnglish, LOOKUP_LANGUAGES, resolveLanguage } from './languages';

describe('resolveLanguage', () => {
  it('understands names, codes and aliases in any case', () => {
    expect(resolveLanguage('Bengali')?.code).toBe('bn');
    expect(resolveLanguage('bangla')?.code).toBe('bn');
    expect(resolveLanguage(' BN ')?.code).toBe('bn');
    expect(resolveLanguage('Español')?.code).toBe('es');
    expect(resolveLanguage('Mandarin')?.code).toBe('zh-CN');
  });

  it('uses the language part of a regional code', () => {
    expect(resolveLanguage('pt-BR')?.code).toBe('pt');
    expect(resolveLanguage('es_MX')?.code).toBe('es');
    expect(resolveLanguage('Portuguese (Brazil)')?.code).toBe('pt');
  });

  it('gives null for English, blanks and unknown input', () => {
    expect(resolveLanguage('en')).toBeNull();
    expect(resolveLanguage('English')).toBeNull();
    expect(resolveLanguage('')).toBeNull();
    expect(resolveLanguage('   ')).toBeNull();
    expect(resolveLanguage('Klingon')).toBeNull();
    expect(resolveLanguage(undefined)).toBeNull();
    expect(resolveLanguage('x'.repeat(100))).toBeNull();
  });

  it('knows which inputs mean English', () => {
    expect(isEnglish('en')).toBe(true);
    expect(isEnglish('English')).toBe(true);
    expect(isEnglish('en-GB')).toBe(true);
    expect(isEnglish('bn')).toBe(false);
    expect(isEnglish(null)).toBe(false);
  });

  it('has no duplicate codes', () => {
    const codes = LOOKUP_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
