// apps/web/src/hooks/useVoiceEffects.ts
/**
 * useVoiceEffects — real-time Web Audio processing for the local mic track.
 *
 * Chain: source → highpass → bassEQ → trebleEQ → radioFilter → delay → reverb → gain → destination
 *
 * Produces an output MediaStreamTrack ready to be published to LiveKit.
 * Safe to update any knob in real-time — no restart required.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceEffectsState {
  bypass: boolean;
  /** Low-shelf EQ gain in dB (-15..+15) */
  bass: number;
  /** High-shelf EQ gain in dB (-15..+15) */
  treble: number;
  /** Wet amount for reverb (0..1) */
  reverb: number;
  /** Echo delay amount (0..1) */
  delay: number;
  /** Radio/bandpass filter (0..1) — 0 = off, 1 = full radio */
  radio: number;
  /** Overall output gain (0.5..1.5) */
  gain: number;
  /** Preset name for UI hinting */
  preset:
    | "custom"
    | "clean"
    | "bass"
    | "radio"
    | "cave"
    | "cathedral"
    | "robot";
}

export const DEFAULT_EFFECTS: VoiceEffectsState = {
  bypass: true,
  bass: 0,
  treble: 0,
  reverb: 0,
  delay: 0,
  radio: 0,
  gain: 1,
  preset: "clean",
};

export const PRESETS: Record<
  Exclude<VoiceEffectsState["preset"], "custom">,
  Partial<VoiceEffectsState>
> = {
  clean: {
    bypass: true,
    bass: 0,
    treble: 0,
    reverb: 0,
    delay: 0,
    radio: 0,
    gain: 1,
  },
  bass: {
    bypass: false,
    bass: 10,
    treble: -2,
    reverb: 0,
    delay: 0,
    radio: 0,
    gain: 1,
  },
  radio: {
    bypass: false,
    bass: -8,
    treble: 6,
    reverb: 0,
    delay: 0,
    radio: 0.9,
    gain: 1,
  },
  cave: {
    bypass: false,
    bass: 3,
    treble: -4,
    reverb: 0.55,
    delay: 0.15,
    radio: 0,
    gain: 1,
  },
  cathedral: {
    bypass: false,
    bass: 2,
    treble: -3,
    reverb: 0.85,
    delay: 0.25,
    radio: 0,
    gain: 1,
  },
  robot: {
    bypass: false,
    bass: -6,
    treble: 8,
    reverb: 0.2,
    delay: 0.5,
    radio: 0.6,
    gain: 1,
  },
};

interface UseVoiceEffectsOptions {
  /** The current LiveKit mic MediaStreamTrack, or null when muted */
  inputTrack: MediaStreamTrack | null;
  /** Called with the processed output track — publish this to LiveKit */
  onOutputTrack?: (track: MediaStreamTrack | null) => void;
}

export const useVoiceEffects = ({
  inputTrack,
  onOutputTrack,
}: UseVoiceEffectsOptions) => {
  const [state, setState] = useState<VoiceEffectsState>(DEFAULT_EFFECTS);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chainRef = useRef<{
    highpass: BiquadFilterNode;
    bassEQ: BiquadFilterNode;
    trebleEQ: BiquadFilterNode;
    radioEQ: BiquadFilterNode;
    delayNode: DelayNode;
    delayFeedback: GainNode;
    delayWet: GainNode;
    convolver: ConvolverNode;
    reverbWet: GainNode;
    dryGain: GainNode;
    masterGain: GainNode;
    destination: MediaStreamAudioDestinationNode;
  } | null>(null);

  // ----------------------------------------------------------
  // Build the audio graph when we have an input track
  // ----------------------------------------------------------
  useEffect(() => {
    if (!inputTrack) {
      onOutputTrack?.(null);
      return;
    }

    let ctx: AudioContext | null = null;

    try {
      ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const source = ctx.createMediaStreamSource(
        new MediaStream([inputTrack]),
      );

      // Node chain
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 60;

      const bassEQ = ctx.createBiquadFilter();
      bassEQ.type = "lowshelf";
      bassEQ.frequency.value = 250;
      bassEQ.gain.value = 0;

      const trebleEQ = ctx.createBiquadFilter();
      trebleEQ.type = "highshelf";
      trebleEQ.frequency.value = 4000;
      trebleEQ.gain.value = 0;

      const radioEQ = ctx.createBiquadFilter();
      radioEQ.type = "bandpass";
      radioEQ.frequency.value = 1500;
      radioEQ.Q.value = 0.6;
      radioEQ.gain.value = 0; // start transparent (uses wet/dry mix)

      // Delay (echo)
      const delayNode = ctx.createDelay(1.0);
      delayNode.delayTime.value = 0.22;

      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.35;

      const delayWet = ctx.createGain();
      delayWet.gain.value = 0;

      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayNode.connect(delayWet);

      // Reverb (convolution with synthetic impulse)
      const convolver = ctx.createConvolver();
      convolver.buffer = makeImpulseResponse(ctx, 2.4, 2.6);

      const reverbWet = ctx.createGain();
      reverbWet.gain.value = 0;

      // Dry path
      const dryGain = ctx.createGain();
      dryGain.gain.value = 1;

      // Master
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1;

      const destination = ctx.createMediaStreamDestination();

      // Wire the chain
      source.connect(highpass);
      highpass.connect(bassEQ);
      bassEQ.connect(trebleEQ);
      trebleEQ.connect(radioEQ);

      // Radio wet path (bandpass filter)
      radioEQ.connect(dryGain);

      // Delay send
      radioEQ.connect(delayNode);
      delayWet.connect(dryGain);

      // Reverb send
      radioEQ.connect(convolver);
      convolver.connect(reverbWet);
      reverbWet.connect(dryGain);

      dryGain.connect(masterGain);
      masterGain.connect(destination);

      // Store refs
      ctxRef.current = ctx;
      sourceRef.current = source;
      chainRef.current = {
        highpass,
        bassEQ,
        trebleEQ,
        radioEQ,
        delayNode,
        delayFeedback,
        delayWet,
        convolver,
        reverbWet,
        dryGain,
        masterGain,
        destination,
      };

      // Hand the processed track to the caller
      const outputTrack = destination.stream.getAudioTracks()[0];
      onOutputTrack?.(outputTrack);
    } catch (err) {
      console.warn("Voice effects setup failed:", err);
      onOutputTrack?.(inputTrack); // fallback to raw
    }

    return () => {
      try {
        sourceRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        chainRef.current?.destination.disconnect();
      } catch {
        /* ignore */
      }
      chainRef.current = null;
      sourceRef.current = null;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputTrack]);

  // ----------------------------------------------------------
  // Apply state changes to live nodes
  // ----------------------------------------------------------
  useEffect(() => {
    const chain = chainRef.current;
    if (!chain) return;

    const { bypass, bass, treble, reverb, delay, radio, gain } = state;

    // Bypass → flatten everything to neutral
    if (bypass) {
      chain.bassEQ.gain.value = 0;
      chain.trebleEQ.gain.value = 0;
      chain.radioEQ.gain.value = 0;
      chain.delayWet.gain.value = 0;
      chain.reverbWet.gain.value = 0;
      chain.masterGain.gain.value = 1;
      chain.dryGain.gain.value = 1;
      return;
    }

    chain.bassEQ.gain.value = bass;
    chain.trebleEQ.gain.value = treble;
    chain.radioEQ.gain.value = radio * 12; // higher Q effect
    chain.radioEQ.Q.value = 0.6 + radio * 4;
    chain.delayWet.gain.value = delay * 0.5;
    chain.reverbWet.gain.value = reverb * 0.8;
    chain.masterGain.gain.value = gain;
    chain.dryGain.gain.value = 1 - (reverb * 0.3 + delay * 0.2);
  }, [state]);

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  const update = useCallback((patch: Partial<VoiceEffectsState>) => {
    setState((prev) => ({ ...prev, ...patch, preset: "custom" }));
  }, []);

  const applyPreset = useCallback(
    (preset: keyof typeof PRESETS) => {
      setState({
        ...DEFAULT_EFFECTS,
        ...PRESETS[preset],
        preset,
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setState(DEFAULT_EFFECTS);
  }, []);

  return {
    state,
    update,
    applyPreset,
    reset,
    isActive: !state.bypass,
  };
};

// ------------------------------------------------------------
// Impulse response generator for reverb
// ------------------------------------------------------------
function makeImpulseResponse(
  ctx: AudioContext,
  durationSec: number,
  decay: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Exponential decay noise = smooth tail
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}

export default useVoiceEffects;