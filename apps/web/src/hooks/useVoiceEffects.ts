// apps/web/src/hooks/useVoiceEffects.ts
/**
 * useVoiceEffects — real-time voice effects that everyone in the room hears.
 *
 * Runs as a LiveKit audio TrackProcessor on the published mic track:
 * LiveKit hands us the raw mic, we return the processed track, and LiveKit sends
 * that to the room. Turning effects off removes the processor and restores the clean mic.
 *
 * Chain: source → highpass → bassEQ → trebleEQ → radioFilter → (dry + delay + reverb) → gain → destination
 *
 * Also controls browser noise suppression for the mic (on by default, "studio" = off).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  AudioProcessorOptions,
  LocalAudioTrack,
  Track,
  TrackProcessor,
} from "livekit-client";

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

const NOISE_SUPPRESSION_KEY = "speakbetter-noise-suppression";

// ------------------------------------------------------------
// Audio graph
// ------------------------------------------------------------

interface EffectsChain {
  ctx: AudioContext;
  ownsContext: boolean;
  source: MediaStreamAudioSourceNode;
  bassEQ: BiquadFilterNode;
  trebleEQ: BiquadFilterNode;
  radioEQ: BiquadFilterNode;
  delayNode: DelayNode;
  delayWet: GainNode;
  reverbWet: GainNode;
  dryGain: GainNode;
  masterGain: GainNode;
  destination: MediaStreamAudioDestinationNode;
}

function buildChain(track: MediaStreamTrack, sharedCtx?: AudioContext): EffectsChain {
  const ownsContext = !sharedCtx;
  const ctx =
    sharedCtx ??
    new (window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();

  const source = ctx.createMediaStreamSource(new MediaStream([track]));

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 60;

  const bassEQ = ctx.createBiquadFilter();
  bassEQ.type = "lowshelf";
  bassEQ.frequency.value = 250;

  const trebleEQ = ctx.createBiquadFilter();
  trebleEQ.type = "highshelf";
  trebleEQ.frequency.value = 4000;

  const radioEQ = ctx.createBiquadFilter();
  radioEQ.type = "peaking";
  radioEQ.frequency.value = 1500;
  radioEQ.Q.value = 0.6;

  // Echo
  const delayNode = ctx.createDelay(1.0);
  delayNode.delayTime.value = 0.22;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.35;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0;
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayNode.connect(delayWet);

  // Reverb (convolution with a synthetic impulse)
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulseResponse(ctx, 2.4, 2.6);
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;

  const dryGain = ctx.createGain();
  const masterGain = ctx.createGain();
  const destination = ctx.createMediaStreamDestination();

  source.connect(highpass);
  highpass.connect(bassEQ);
  bassEQ.connect(trebleEQ);
  trebleEQ.connect(radioEQ);

  radioEQ.connect(dryGain);
  radioEQ.connect(delayNode);
  delayWet.connect(masterGain);
  radioEQ.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(masterGain);
  dryGain.connect(masterGain);
  masterGain.connect(destination);

  return { ctx, ownsContext, source, bassEQ, trebleEQ, radioEQ, delayNode, delayWet, reverbWet, dryGain, masterGain, destination };
}

function applyState(chain: EffectsChain, state: VoiceEffectsState) {
  const { bypass, bass, treble, reverb, delay, radio, gain } = state;
  const t = chain.ctx.currentTime;
  // Short ramps avoid clicks while dragging sliders
  const set = (param: AudioParam, value: number) => param.setTargetAtTime(value, t, 0.02);

  if (bypass) {
    set(chain.bassEQ.gain, 0);
    set(chain.trebleEQ.gain, 0);
    set(chain.radioEQ.gain, 0);
    set(chain.delayWet.gain, 0);
    set(chain.reverbWet.gain, 0);
    set(chain.dryGain.gain, 1);
    set(chain.masterGain.gain, 1);
    return;
  }

  set(chain.bassEQ.gain, bass);
  set(chain.trebleEQ.gain, treble);
  set(chain.radioEQ.gain, radio * 12);
  set(chain.radioEQ.Q, 0.6 + radio * 4);
  set(chain.delayWet.gain, delay * 0.5);
  set(chain.reverbWet.gain, reverb * 0.8);
  set(chain.dryGain.gain, 1 - (reverb * 0.3 + delay * 0.2));
  set(chain.masterGain.gain, gain);
}

function teardown(chain: EffectsChain) {
  try {
    chain.source.disconnect();
    chain.masterGain.disconnect();
  } catch {
    /* already disconnected */
  }
  chain.destination.stream.getTracks().forEach((t) => t.stop());
  if (chain.ownsContext && chain.ctx.state !== "closed") {
    chain.ctx.close().catch(() => {});
  }
}

/** LiveKit processor: LiveKit gives us the raw mic, publishes `processedTrack` */
function createEffectsProcessor(
  getState: () => VoiceEffectsState,
  onChainChange: (chain: EffectsChain | null) => void,
): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  let chain: EffectsChain | null = null;

  const processor: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
    name: "speakbetter-voice-effects",
    processedTrack: undefined,
    async init(opts) {
      chain = buildChain(opts.track, opts.audioContext);
      applyState(chain, getState());
      processor.processedTrack = chain.destination.stream.getAudioTracks()[0];
      onChainChange(chain);
    },
    async restart(opts) {
      if (chain) teardown(chain);
      await processor.init(opts);
    },
    async destroy() {
      if (chain) teardown(chain);
      chain = null;
      processor.processedTrack = undefined;
      onChainChange(null);
    },
  };
  return processor;
}

// ------------------------------------------------------------
// Hook
// ------------------------------------------------------------

interface UseVoiceEffectsOptions {
  /** The published LiveKit microphone track, or null when not publishing */
  localTrack: LocalAudioTrack | null;
}

export const useVoiceEffects = ({ localTrack }: UseVoiceEffectsOptions) => {
  const [state, setState] = useState<VoiceEffectsState>(DEFAULT_EFFECTS);
  /** True while the processed audio is what the room hears */
  const [isLive, setIsLive] = useState(false);
  const [noiseSuppression, setNoiseSuppressionState] = useState(() => {
    try {
      return window.localStorage.getItem(NOISE_SUPPRESSION_KEY) !== "0";
    } catch {
      return true;
    }
  });

  const stateRef = useRef(state);
  const chainRef = useRef<EffectsChain | null>(null);
  useEffect(() => {
    stateRef.current = state;
  });

  const effectsOn = !state.bypass;

  // Attach the processor while effects are on; detaching restores the clean mic
  useEffect(() => {
    if (!localTrack || !effectsOn) return;

    let active = true;
    const processor = createEffectsProcessor(
      () => stateRef.current,
      (chain) => {
        chainRef.current = chain;
        if (active) setIsLive(Boolean(chain));
      },
    );

    localTrack.setProcessor(processor).catch((err: unknown) => {
      console.warn("Voice effects could not start:", err);
      if (!active) return;
      toast.error("Voice effects aren't supported in this browser");
      setState(DEFAULT_EFFECTS);
    });

    return () => {
      active = false;
      setIsLive(false);
      if (localTrack.getProcessor() === processor) {
        localTrack.stopProcessor().catch(() => {});
      }
    };
  }, [localTrack, effectsOn]);

  // Slider/preset changes apply instantly to the running graph
  useEffect(() => {
    if (chainRef.current) applyState(chainRef.current, state);
  }, [state]);

  // Re-apply a saved "noise suppression off" choice whenever a new mic track is published
  useEffect(() => {
    if (!localTrack || noiseSuppression) return;
    localTrack
      .restartTrack({ noiseSuppression: false, autoGainControl: false, echoCancellation: true })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new track
  }, [localTrack]);

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  const update = useCallback((patch: Partial<VoiceEffectsState>) => {
    setState((prev) => ({ ...prev, ...patch, preset: "custom" }));
  }, []);

  const applyPreset = useCallback((preset: keyof typeof PRESETS) => {
    setState({
      ...DEFAULT_EFFECTS,
      ...PRESETS[preset],
      preset,
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_EFFECTS);
  }, []);

  /**
   * Noise suppression + auto gain on (default, best for talking) or off ("studio",
   * best for singing/music). Echo cancellation always stays on to avoid feedback.
   */
  const setNoiseSuppression = useCallback(
    async (on: boolean) => {
      setNoiseSuppressionState(on);
      try {
        window.localStorage.setItem(NOISE_SUPPRESSION_KEY, on ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
      if (!localTrack) return;
      try {
        await localTrack.restartTrack({
          noiseSuppression: on,
          autoGainControl: on,
          echoCancellation: true,
        });
        toast.success(on ? "Noise suppression on" : "Studio mode — natural sound, no noise filtering");
      } catch {
        toast.error("Couldn't change microphone settings");
      }
    },
    [localTrack],
  );

  return {
    state,
    update,
    applyPreset,
    reset,
    isActive: effectsOn,
    /** Effects are on and the room is hearing the processed voice */
    isLive,
    /** You need to be publishing a mic for effects to reach the room */
    canApply: Boolean(localTrack),
    noiseSuppression,
    setNoiseSuppression,
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
