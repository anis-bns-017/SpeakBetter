import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SpeakingEffectDto } from './dto/speaking-effect.dto';
import {
  SPEAKING_EFFECT_IDS,
  isSpeakingEffect,
  storedSpeakingEffect,
} from './speaking-effects';

describe('speaking effects', () => {
  it('offers the classic glow plus 20 more, each once', () => {
    expect(SPEAKING_EFFECT_IDS[0]).toBe('classic');
    expect(new Set(SPEAKING_EFFECT_IDS).size).toBe(21);
  });

  it('knows its own effects and nothing else', () => {
    expect(isSpeakingEffect('crown')).toBe(true);
    expect(isSpeakingEffect('unicorn')).toBe(false);
    expect(isSpeakingEffect(undefined)).toBe(false);
  });

  it('matches the list the web app draws', () => {
    const web = readFileSync(
      join(
        __dirname,
        '../../../apps/web/src/components/voice/effects/speakingEffects.ts',
      ),
      'utf8',
    );
    const list = web.slice(
      web.indexOf('SPEAKING_EFFECT_IDS = ['),
      web.indexOf('] as const'),
    );
    const ids = [...list.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([...SPEAKING_EFFECT_IDS]);
  });

  it('stores the default as null', () => {
    expect(storedSpeakingEffect('classic')).toBeNull();
    expect(storedSpeakingEffect('koi')).toBe('koi');
  });

  it('accepts only known effects in the request', async () => {
    const ok = await validate(
      plainToInstance(SpeakingEffectDto, { effect: 'mughal' }),
    );
    const bad = await validate(
      plainToInstance(SpeakingEffectDto, { effect: '<script>' }),
    );
    const missing = await validate(plainToInstance(SpeakingEffectDto, {}));
    expect(ok).toHaveLength(0);
    expect(bad.length).toBeGreaterThan(0);
    expect(missing.length).toBeGreaterThan(0);
  });
});
