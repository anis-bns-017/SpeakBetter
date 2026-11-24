/**
 * Small answer sounds (Settings > Sound effects). They are drawn with the Web Audio API, so there are no sound
 * files to download. Silent until the account's setting has loaded, so someone who turned sounds off never hears one.
 */

export type Sfx = "good" | "bad" | "win";

/** Each note: frequency in Hz */
export const SFX_NOTES: Record<Sfx, number[]> = {
  good: [660, 880],
  bad: [240, 180],
  win: [523, 659, 784, 1047],
};

const NOTE_SECONDS = 0.09;
const VOLUME = 0.05;

let enabled = false;
let context: AudioContext | null = null;

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
};

export const isSoundEnabled = () => enabled;

export function playSfx(kind: Sfx) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    const ctx = context;
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime + 0.01;
    SFX_NOTES[kind].forEach((frequency, i) => {
      const at = start + i * NOTE_SECONDS;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      // A quick fade in and out, so the note doesn't click
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(VOLUME, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_SECONDS * 1.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + NOTE_SECONDS * 1.7);
    });
  } catch {
    // Sound is a nicety: never let it break the lesson
  }
}
