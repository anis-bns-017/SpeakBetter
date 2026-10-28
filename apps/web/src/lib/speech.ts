// apps/web/src/lib/speech.ts
// Text-to-speech for pronunciation practice, using the browser's built-in voices (no API key).

export const canSpeak = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/** Prefer natural-sounding English voices (Google/Microsoft "Natural"), then any en-US/en-GB */
function pickEnglishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter((v) => /^en[-_]/i.test(v.lang));
  return (
    english.find((v) => /natural|neural|google/i.test(v.name) && /en[-_](US|GB)/i.test(v.lang)) ??
    english.find((v) => /en[-_]US/i.test(v.lang)) ??
    english.find((v) => /en[-_]GB/i.test(v.lang)) ??
    english[0]
  );
}

// Voices load asynchronously in Chrome; warm the list up once
if (canSpeak()) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
}

/** Speaks `text` (stopping anything already playing). Resolves when finished or stopped. */
export function speak(text: string, options: { rate?: number } = {}): Promise<void> {
  if (!canSpeak() || !text.trim()) return Promise.resolve();
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickEnglishVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-US";
    utterance.rate = options.rate ?? 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
