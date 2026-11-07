import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { ChatFeaturesService } from './chat-features.service';
import {
  ON_DEVICE_CODE,
  cleanTranscript,
  splitForTranslation,
  translationTarget,
} from './transcript.helpers';

describe('transcript helpers', () => {
  it('keeps short text in one piece and splits long text after sentences', () => {
    expect(splitForTranslation('Hello there. How are you?')).toEqual([
      'Hello there. How are you?',
    ]);
    const sentence = 'This sentence is about forty characters. ';
    const pieces = splitForTranslation(sentence.repeat(30), 100);
    expect(pieces.length).toBeGreaterThan(1);
    for (const p of pieces) {
      expect(p.length).toBeLessThanOrEqual(100);
      expect(p.endsWith('.')).toBe(true);
    }
    expect(pieces.join(' ')).toBe(sentence.repeat(30).trim());
  });

  it('breaks one very long sentence at spaces, and a giant word into parts', () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const pieces = splitForTranslation(long, 50);
    expect(pieces.every((p) => p.length <= 50)).toBe(true);
    expect(pieces.join(' ')).toBe(long);
    expect(
      splitForTranslation('x'.repeat(120), 50).map((p) => p.length),
    ).toEqual([50, 50, 20]);
    expect(splitForTranslation('   ')).toEqual([]);
  });

  it('cleans and caps text the app sends', () => {
    expect(cleanTranscript('  hi \n there ')).toBe('hi there');
    expect(cleanTranscript(42)).toBe('');
    expect(cleanTranscript('a'.repeat(3000))).toHaveLength(2000);
  });

  it('translates into the language picked in lookups, else the profile language, never English', () => {
    expect(translationTarget('bn', 'Spanish')?.name).toBe('Bengali');
    expect(translationTarget('', 'Spanish')?.name).toBe('Spanish');
    expect(translationTarget(undefined, 'en')).toBeNull();
    expect(translationTarget('english', null)).toBeNull();
  });
});

describe('voice message transcripts', () => {
  const voiceMessage = (meta: Record<string, unknown> = {}) => ({
    id: 'm1',
    chatId: 'c1',
    type: MessageType.VOICE_NOTE,
    mediaUrl: 'https://res.cloudinary.com/demo/video/upload/v1/voice.webm',
    metadata: meta,
    isDeleted: false,
    expiresAt: null,
    chat: { participants: [{ userId: 'u1' }] },
  });

  const setup = (
    env: Record<string, string> = {},
    translate = jest.fn().mockResolvedValue('Hola'),
  ) => {
    const prisma = {
      message: {
        findUnique: jest.fn().mockResolvedValue(voiceMessage()),
        update: jest.fn().mockResolvedValue({}),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({ nativeLanguage: 'en' }),
      },
    };
    const config = { get: (key: string) => env[key] };
    const lookup = { translate, define: jest.fn() };
    const service = new ChatFeaturesService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      config as any,
      lookup,
    );
    return { prisma, lookup, service };
  };

  it('asks the app to transcribe on the device when no Deepgram key is set', async () => {
    const { service } = setup();
    const error = await service.transcribe('u1', 'm1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: ON_DEVICE_CODE,
    });
  });

  it('still returns a transcript stored on the server', async () => {
    const { prisma, service } = setup();
    prisma.message.findUnique.mockResolvedValue(
      voiceMessage({ transcript: { text: 'hello', language: 'en' } }),
    );
    await expect(service.transcribe('u1', 'm1')).resolves.toEqual({
      messageId: 'm1',
      text: 'hello',
      language: 'en',
    });
  });

  it('translates a device transcript with the free translator, without storing it', async () => {
    const { prisma, lookup, service } = setup();
    const result = await service.translateTranscript('u1', 'm1', {
      text: 'Hello friend.',
      target: 'es',
    });
    expect(lookup.translate).toHaveBeenCalledWith('Hello friend.', 'es');
    expect(result).toEqual({
      messageId: 'm1',
      language: 'Spanish',
      text: 'Hola',
    });
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('caches translations of a stored transcript, and needs a language other than English', async () => {
    const { prisma, service } = setup();
    prisma.message.findUnique.mockResolvedValue(
      voiceMessage({ transcript: { text: 'Hello friend.' } }),
    );
    await service.translateTranscript('u1', 'm1', { target: 'Spanish' });
    expect(
      prisma.message.update.mock.calls[0][0].data.metadata
        .transcriptTranslations,
    ).toEqual({ Spanish: 'Hola' });

    await expect(
      service.translateTranscript('u1', 'm1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('needs a transcript to translate, and reports a failed translation', async () => {
    const { service } = setup({}, jest.fn().mockResolvedValue(null));
    await expect(
      service.translateTranscript('u1', 'm1', { target: 'es' }),
    ).rejects.toThrow('Transcribe the voice message first');
    await expect(
      service.translateTranscript('u1', 'm1', { text: 'Hi.', target: 'es' }),
    ).rejects.toThrow("Couldn't translate it right now");
  });
});
