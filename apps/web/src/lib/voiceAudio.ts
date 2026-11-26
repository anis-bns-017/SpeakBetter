// apps/web/src/lib/voiceAudio.ts
// The one set of audio settings for talking: voice rooms, random calls and the sound check all use it, so what you
// hear in the sound check is what other people hear from you.
import { AudioPresets, type AudioCaptureOptions, type RoomOptions } from "livekit-client";

/**
 * The microphone as it is captured. Echo cancellation must stay on and the mic must be mono: the browser's echo
 * canceller is tuned for one voice channel, and stereo capture lets room echo through.
 */
export const SPEECH_CAPTURE: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

/** The same settings as plain browser constraints, for recording outside LiveKit */
export const SPEECH_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

/** A LiveKit room for speech: the speech preset (mono, about 24 kbps) and silence suppression */
export const speechRoomOptions = (overrides: Partial<RoomOptions> = {}): RoomOptions => ({
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: SPEECH_CAPTURE,
  publishDefaults: {
    audioPreset: AudioPresets.speech,
    dtx: true,
  },
  ...overrides,
});
