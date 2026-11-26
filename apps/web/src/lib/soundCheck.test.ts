import { describe, expect, it } from "vitest";
import { measureBlock, soundStats, soundVerdict } from "./soundCheck";

/** A recording: `quiet` moments of background, then `loud` moments of speech */
const recording = (background: number, voice: number, quiet = 40, loud = 160, peak = voice * 2) => ({
  rms: [...Array(quiet).fill(background), ...Array(loud).fill(voice)],
  peaks: [...Array(quiet).fill(background * 2), ...Array(loud).fill(peak)],
});

describe("sound check", () => {
  it("says a clear voice in a quiet room is good", () => {
    const { rms, peaks } = recording(0.002, 0.1);
    const stats = soundStats(rms, peaks);
    expect(stats.clarityDb).toBeGreaterThan(30);
    expect(soundVerdict(stats)).toBe("good");
  });

  it("notices a microphone that hears nothing", () => {
    const { rms, peaks } = recording(0.0005, 0.0006);
    expect(soundVerdict(soundStats(rms, peaks))).toBe("no-sound");
    expect(soundVerdict(soundStats([], []))).toBe("no-sound");
  });

  it("says when the voice is too quiet", () => {
    const { rms, peaks } = recording(0.0004, 0.015);
    expect(soundVerdict(soundStats(rms, peaks))).toBe("too-quiet");
  });

  it("says when the sound distorts", () => {
    const { rms, peaks } = recording(0.002, 0.4, 40, 160, 1);
    expect(soundVerdict(soundStats(rms, peaks))).toBe("too-loud");
  });

  it("says when background noise is close to the voice", () => {
    const { rms, peaks } = recording(0.03, 0.1);
    expect(soundVerdict(soundStats(rms, peaks))).toBe("noisy");
  });

  it("measures a block of samples", () => {
    const block = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    expect(measureBlock(block)).toEqual({ rms: 0.5, peak: 0.5 });
    expect(measureBlock(new Float32Array(0))).toEqual({ rms: 0, peak: 0 });
  });
});
