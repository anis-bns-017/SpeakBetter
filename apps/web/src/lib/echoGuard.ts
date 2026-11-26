// apps/web/src/lib/echoGuard.ts
/**
 * Echo guard: the browser's echo canceller removes most of what your speakers play back into your microphone, but
 * not all of it, and with several voices at once the leftovers add up into the "everyone echoes" sound. Phone apps
 * like WhatsApp clean this up by turning your microphone down while others talk and you are quiet. This is that
 * rule, as a pure step function so it can be tested; the audio graph in useVoiceEffects runs it every few ms.
 */

export const ECHO_GUARD = {
  /** How far your microphone is turned down while others talk and you are quiet (about -18 dB) */
  duckGain: 0.12,
  /** Loudness (RMS, 0-1) that always counts as you speaking */
  speakAbove: 0.035,
  /** You speaking also means well above your own background */
  overFloor: 4,
  /** Someone else is talking when what you hear is at least this loud */
  othersAbove: 0.01,
  /** After you stop, the microphone stays fully open this long, so the ends of words are not cut */
  holdMs: 300,
} as const;

export interface EchoGuardState {
  /** Your background loudness, learned while nobody is talking */
  floor: number;
  /** Until when the microphone stays fully open */
  openUntil: number;
  /** The gain to apply now (1 = untouched) */
  gain: number;
}

export const initialEchoGuard = (): EchoGuardState => ({ floor: 0.005, openUntil: 0, gain: 1 });

/**
 * One step. `local` is your microphone's loudness, `others` the loudest voice being played to you (both RMS, 0-1),
 * `now` in milliseconds.
 */
export function echoGuardStep(state: EchoGuardState, local: number, others: number, now: number): EchoGuardState {
  const othersTalking = others > ECHO_GUARD.othersAbove;
  // The background is only learned while nobody else is talking, so their echo is never mistaken for it
  let floor = state.floor;
  if (!othersTalking) floor = local < floor ? local : floor + (local - floor) * 0.01;
  floor = Math.min(Math.max(floor, 0.0005), 0.05);

  const speaking = local > Math.max(ECHO_GUARD.speakAbove, floor * ECHO_GUARD.overFloor);
  const openUntil = speaking ? now + ECHO_GUARD.holdMs : state.openUntil;
  const gain = othersTalking && now >= openUntil ? ECHO_GUARD.duckGain : 1;
  return { floor, openUntil, gain };
}
