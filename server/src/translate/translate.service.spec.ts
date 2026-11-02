import { BadRequestException } from '@nestjs/common';
import { DictionaryEntry, LookupProvider, LookupQuotaError } from './lookup.provider';
import { cleanLookupText, TranslateService } from './translate.service';

class FakeProvider extends LookupProvider {
  translate = jest.fn<Promise<string | null>, [string, string]>(async (text) => `T(${text})`);
  define = jest.fn<Promise<DictionaryEntry | null>, [string]>(async () => ({
    phonetic: '/x/',
    audioUrl: null,
    meanings: [{ partOfSpeech: 'noun', definition: 'a thing', example: null }],
    synonyms: ['item'],
    antonyms: [],
  }));
}

function setup(nativeLanguage: string | null = 'Bengali') {
  const prisma: any = { profile: { findUnique: jest.fn().mockResolvedValue({ nativeLanguage }) } };
  const provider = new FakeProvider();
  return { service: new TranslateService(prisma, provider), provider, prisma };
}

describe('cleanLookupText', () => {
  it('trims, collapses spaces and straightens quotes', () => {
    expect(cleanLookupText('  “don’t   go,”  ')).toBe("don't go");
    expect(cleanLookupText('(hello)')).toBe('hello');
    expect(cleanLookupText(42)).toBe('');
  });
});

describe('TranslateService.lookup', () => {
  it('translates a word into the native language and adds the dictionary entry', async () => {
    const { service, provider } = setup();
    const result = await service.lookup('u1', { text: 'House' });
    expect(provider.translate).toHaveBeenCalledWith('House', 'bn');
    expect(provider.define).toHaveBeenCalledWith('house');
    expect(result).toMatchObject({
      text: 'House',
      kind: 'word',
      target: { code: 'bn', name: 'Bengali' },
      translation: 'T(House)',
      phonetic: '/x/',
      notice: null,
    });
    expect(result.meanings).toHaveLength(1);
  });

  it('passes on synonyms, and looks up the base form of a word with no entry of its own', async () => {
    const { service, provider } = setup();
    const entry = await provider.define('x');
    provider.define.mockImplementation(async (word) => (word === 'go' ? entry : null));
    const result = await service.lookup('u1', { text: 'went' });
    expect(provider.define.mock.calls.map((c) => c[0]).slice(-2)).toEqual(['went', 'go']);
    expect(result.baseForm).toBe('go');
    expect(result.synonyms).toEqual(['item']);
    expect(result.meanings).toHaveLength(1);
    // The translation is still of the word as it was written
    expect(provider.translate).toHaveBeenCalledWith('went', 'bn');
  });

  it('gives up after a few guesses and leaves baseForm empty', async () => {
    const { service, provider } = setup();
    provider.define.mockResolvedValue(null);
    const result = await service.lookup('u1', { text: 'stories' });
    expect(provider.define.mock.calls.length).toBeLessThanOrEqual(4);
    expect(result).toMatchObject({ baseForm: null, meanings: [] });
  });

  it('treats several words as a phrase and skips the dictionary', async () => {
    const { service, provider } = setup();
    const result = await service.lookup('u1', { text: 'break the ice' });
    expect(result.kind).toBe('phrase');
    expect(provider.define).not.toHaveBeenCalled();
    expect(result.translation).toBe('T(break the ice)');
  });

  it('lets an explicit language override the profile, and English means no translation', async () => {
    const { service, provider, prisma } = setup('Bengali');
    expect((await service.lookup('u1', { text: 'house', target: 'Spanish' })).target?.code).toBe('es');
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
    provider.translate.mockClear();
    const english = await service.lookup('u1', { text: 'house', target: 'English' });
    expect(english.target).toBeNull();
    expect(provider.translate).not.toHaveBeenCalled();
    expect(english.meanings).toHaveLength(1);
  });

  it('asks for a language when the profile has none we recognise, but still defines the word', async () => {
    const { service, provider } = setup('en');
    const result = await service.lookup('u1', { text: 'house' });
    expect(result.notice).toBe('no-language');
    expect(result.translation).toBeNull();
    expect(provider.translate).not.toHaveBeenCalled();
    expect(result.meanings).toHaveLength(1);
  });

  it('rejects an unsupported language, empty text and very long text', async () => {
    const { service } = setup();
    await expect(service.lookup('u1', { text: 'house', target: 'Klingon' })).rejects.toThrow(BadRequestException);
    await expect(service.lookup('u1', { text: '   ' })).rejects.toThrow(/Select/);
    await expect(service.lookup('u1', { text: '1234' })).rejects.toThrow(/Select/);
    await expect(service.lookup('u1', { text: 'a '.repeat(200) })).rejects.toThrow(/at most/);
  });

  it('does not repeat a lookup it has already answered', async () => {
    const { service, provider } = setup();
    await service.lookup('u1', { text: 'house' });
    await service.lookup('u2', { text: 'HOUSE' });
    expect(provider.translate).toHaveBeenCalledTimes(1);
    expect(provider.define).toHaveBeenCalledTimes(1);
  });

  it('asks again sooner about a word that had no dictionary entry', async () => {
    jest.useFakeTimers({ now: Date.now() });
    try {
      const { service, provider } = setup();
      provider.define.mockResolvedValue(null);
      await service.lookup('u1', { text: 'zzqxv' });
      await service.lookup('u1', { text: 'zzqxv' });
      expect(provider.define).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(11 * 60 * 1000);
      await service.lookup('u1', { text: 'zzqxv' });
      expect(provider.define).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('drops a translation that only repeats the word', async () => {
    const { service, provider } = setup();
    provider.translate.mockResolvedValueOnce('house');
    expect((await service.lookup('u1', { text: 'house' })).translation).toBeNull();
  });

  it('stops asking the free service for a while after its allowance runs out', async () => {
    const { service, provider } = setup();
    provider.translate.mockRejectedValueOnce(new LookupQuotaError());
    const first = await service.lookup('u1', { text: 'house' });
    expect(first.notice).toBe('limit');
    expect(first.meanings).toHaveLength(1);

    const second = await service.lookup('u1', { text: 'garden' });
    expect(second.notice).toBe('limit');
    expect(provider.translate).toHaveBeenCalledTimes(1);
    // The dictionary still works
    expect(second.meanings).toHaveLength(1);
  });

  it('keeps going when a service is down, and does not remember the gap', async () => {
    const { service, provider } = setup();
    provider.translate.mockRejectedValueOnce(new Error('offline'));
    provider.define.mockRejectedValueOnce(new Error('offline'));
    const down = await service.lookup('u1', { text: 'house' });
    expect(down).toMatchObject({ notice: 'unavailable', translation: null, meanings: [] });

    const back = await service.lookup('u1', { text: 'house' });
    expect(back.translation).toBe('T(house)');
    expect(back.notice).toBeNull();
  });
});
