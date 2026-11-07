// server/src/chat/transcript.helpers.ts
// Voice-message transcripts. With a Deepgram key the server transcribes; without one, the app transcribes on the
// listener's own device (Whisper in the browser, free) and sends the text along when it wants a translation.

import { resolveLanguage, type LookupLanguage } from '../translate/languages';

/** Tells the app to transcribe on the device instead (no server speech-to-text is set up) */
export const ON_DEVICE_CODE = 'TRANSCRIBE_ON_DEVICE';

/** Longest transcript the app may send for translation */
export const MAX_TRANSCRIPT_CHARS = 2000;

/** MyMemory (the free translator) takes about 500 bytes per request, so long text goes in sentence-sized pieces */
export const TRANSLATE_PIECE_CHARS = 450;

export const cleanTranscript = (value: unknown): string =>
  typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSCRIPT_CHARS)
    : '';

/**
 * Splits text into pieces of at most `max` characters, breaking after sentences where it can, then at spaces,
 * and only mid-word for a single word longer than `max`.
 */
export function splitForTranslation(
  text: string,
  max = TRANSLATE_PIECE_CHARS,
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [clean];
  const pieces: string[] = [];
  let current = '';
  const push = () => {
    if (current.trim()) pieces.push(current.trim());
    current = '';
  };
  for (const sentence of sentences) {
    if ((current + sentence).length <= max) {
      current += sentence;
      continue;
    }
    push();
    if (sentence.length <= max) {
      current = sentence;
      continue;
    }
    // One very long sentence: break at spaces
    for (const word of sentence.split(' ')) {
      if (!word) continue;
      if ((current ? `${current} ${word}` : word).length <= max) {
        current = current ? `${current} ${word}` : word;
      } else {
        push();
        for (let i = 0; i < word.length; i += max) {
          const part = word.slice(i, i + max);
          if (part.length === max) pieces.push(part);
          else current = part;
        }
      }
    }
  }
  push();
  return pieces;
}

/**
 * The language to translate into: the one the app asked for (the learner's pick in word lookups), else the
 * native language on their profile. Null when neither names a language other than English.
 */
export function translationTarget(
  requested: unknown,
  profileLanguage: unknown,
): LookupLanguage | null {
  return resolveLanguage(requested) ?? resolveLanguage(profileLanguage);
}
