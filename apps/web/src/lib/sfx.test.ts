import { afterEach, describe, expect, it, vi } from "vitest";
import { SFX_NOTES, isSoundEnabled, playSfx, setSoundEnabled } from "./sfx";

function fakeAudio() {
  const oscillators: Array<{ frequency: { value: number } }> = [];
  class FakeContext {
    currentTime = 0;
    state = "running";
    destination = {};
    resume = vi.fn();
    createOscillator() {
      const osc = { type: "", frequency: { value: 0 }, connect: (node: unknown) => node, start: vi.fn(), stop: vi.fn() };
      oscillators.push(osc);
      return osc;
    }
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: (node: unknown) => node,
      };
    }
  }
  vi.stubGlobal("AudioContext", FakeContext);
  return oscillators;
}

afterEach(() => {
  setSoundEnabled(false);
  vi.unstubAllGlobals();
});

describe("sound effects", () => {
  it("stays silent until the setting says otherwise", () => {
    const oscillators = fakeAudio();
    expect(isSoundEnabled()).toBe(false);
    playSfx("good");
    expect(oscillators).toHaveLength(0);
  });

  it("plays the notes of the sound when turned on", () => {
    const oscillators = fakeAudio();
    setSoundEnabled(true);
    playSfx("win");
    expect(oscillators.map((o) => o.frequency.value)).toEqual(SFX_NOTES.win);
  });

  it("goes quiet again when turned off", () => {
    const oscillators = fakeAudio();
    setSoundEnabled(true);
    setSoundEnabled(false);
    playSfx("bad");
    expect(oscillators).toHaveLength(0);
  });

  it("never throws, even if audio is broken", () => {
    vi.stubGlobal("AudioContext", undefined);
    setSoundEnabled(true);
    expect(() => playSfx("good")).not.toThrow();
  });
});
