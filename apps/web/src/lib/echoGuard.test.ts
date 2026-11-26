import { describe, expect, it } from "vitest";
import { ECHO_GUARD, echoGuardStep, initialEchoGuard, type EchoGuardState } from "./echoGuard";

/** Runs the guard over a list of [local, others] moments, 20 ms apart */
const run = (moments: Array<[number, number]>, start: EchoGuardState = initialEchoGuard()) => {
  let state = start;
  const gains: number[] = [];
  moments.forEach(([local, others], i) => {
    state = echoGuardStep(state, local, others, i * 20);
    gains.push(state.gain);
  });
  return { state, gains };
};
const repeat = (n: number, moment: [number, number]) => Array.from({ length: n }, () => moment);

describe("echo guard", () => {
  it("leaves your microphone alone when nobody else is talking", () => {
    const { gains } = run([...repeat(20, [0.003, 0]), ...repeat(20, [0.1, 0])]);
    expect(gains.every((g) => g === 1)).toBe(true);
  });

  it("turns down the echo of others while you are quiet", () => {
    // Someone talks; what reaches your microphone is just their quiet echo
    const { gains } = run(repeat(30, [0.012, 0.15]));
    expect(gains.at(-1)).toBe(ECHO_GUARD.duckGain);
  });

  it("lets you talk over someone", () => {
    const { gains } = run([...repeat(10, [0.012, 0.15]), ...repeat(10, [0.12, 0.15])]);
    expect(gains.at(-1)).toBe(1);
  });

  it("keeps the ends of your words before turning down again", () => {
    const talk = repeat(10, [0.12, 0.15]);
    const after = repeat(30, [0.01, 0.15]);
    const { gains } = run([...talk, ...after]);
    const holdSteps = ECHO_GUARD.holdMs / 20;
    expect(gains.slice(10, 10 + holdSteps - 1).every((g) => g === 1)).toBe(true);
    expect(gains.at(-1)).toBe(ECHO_GUARD.duckGain);
  });

  it("does not learn others' echo as your background", () => {
    const { state } = run(repeat(200, [0.03, 0.2]));
    expect(state.floor).toBeLessThan(0.01);
  });

  it("copes with a noisy room: your voice must stand out from your own background", () => {
    // A loud fan (0.02) learned while quiet, then others talk: the fan alone must not hold the mic open
    const { gains } = run([...repeat(300, [0.02, 0]), ...repeat(30, [0.02, 0.15])]);
    expect(gains.at(-1)).toBe(ECHO_GUARD.duckGain);
  });
});
