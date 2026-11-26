// apps/web/src/lib/soundCheck.ts
// Judges a short test recording from the loudness of each moment: how loud the voice is, how loud the room is
// between words, and whether the sound hit the top and distorted. Pure, so it can be tested without a microphone.

export type SoundVerdict = "no-sound" | "too-quiet" | "too-loud" | "noisy" | "good";

export interface SoundStats {
  /** How loud speaking was (dBFS, 0 is the loudest possible) */
  voiceDb: number;
  /** How loud the room was between words (dBFS) */
  noiseDb: number;
  /** Voice above the background, in dB: higher is clearer */
  clarityDb: number;
  /** Share of moments that hit the top and distorted */
  clipped: number;
  /** Share of moments with speech in them */
  spoken: number;
}

const toDb = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-6));
const at = (sorted: number[], share: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(share * (sorted.length - 1))))];

/** `rms` and `peaks` hold one value per moment (0 to 1), as measured while recording */
export function soundStats(rms: number[], peaks: number[]): SoundStats {
  if (!rms.length) return { voiceDb: -120, noiseDb: -120, clarityDb: 0, clipped: 0, spoken: 0 };
  const sorted = [...rms].sort((a, b) => a - b);
  const noise = at(sorted, 0.1);
  const voice = at(sorted, 0.9);
  const voiceDb = toDb(voice);
  const noiseDb = toDb(noise);
  // Speech: clearly above the background (about 10 dB)
  const spoken = rms.filter((v) => v > Math.max(noise * 3, 0.003)).length / rms.length;
  const clipped = peaks.length ? peaks.filter((p) => p >= 0.99).length / peaks.length : 0;
  return { voiceDb, noiseDb, clarityDb: voiceDb - noiseDb, clipped, spoken };
}

/** What to tell the learner, worst problem first */
export function soundVerdict(stats: SoundStats): SoundVerdict {
  if (stats.voiceDb < -50 || stats.spoken < 0.05) return "no-sound";
  if (stats.clipped > 0.02) return "too-loud";
  if (stats.voiceDb < -32) return "too-quiet";
  if (stats.clarityDb < 15) return "noisy";
  return "good";
}

/** Root mean square and peak of one block of samples (-1 to 1) */
export function measureBlock(samples: Float32Array): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (const s of samples) {
    sum += s * s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  return { rms: samples.length ? Math.sqrt(sum / samples.length) : 0, peak };
}
