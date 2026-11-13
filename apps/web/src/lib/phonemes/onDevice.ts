// apps/web/src/lib/phonemes/onDevice.ts
// Listens to a recording for its single sounds, in this browser (see phoneme.worker.ts). The recording stays
// here; what comes back is the recogniser's guesses at the sound in every 20 ms, which the server lines up
// with the words to say which sounds were off.

import type { PhoneFrames, WorkerRequest, WorkerResponse } from "./phoneme.worker";

export type { PhoneFrames };

/** The recogniser listens to 16 kHz mono audio */
const SAMPLE_RATE = 16000;
/** A practice sentence is a few seconds; anything past this is cut off rather than made to wait */
const MAX_SECONDS = 20;
/** The one-time download, for telling the learner before it starts */
export const SOUND_CHECK_MB = 90;
const PREFERENCE = "sb.soundCheck";

export type SoundStage = { stage: "audio" } | { stage: "download"; loadedMb: number; totalMb: number } | { stage: "listening" };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (frames: PhoneFrames) => void; reject: (e: Error) => void; onStage: (s: SoundStage) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./phoneme.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    const job = pending.get(msg.id);
    if (!job) return;
    if (msg.type === "download") job.onStage({ stage: "download", loadedMb: msg.loadedMb, totalMb: msg.totalMb });
    else if (msg.type === "listening") job.onStage({ stage: "listening" });
    else {
      pending.delete(msg.id);
      if (msg.type === "done") job.resolve(msg.frames);
      else job.reject(new Error(msg.message));
    }
  };
  worker.onerror = (event) => {
    for (const job of pending.values()) job.reject(new Error(event.message || "The sound check stopped"));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export const canCheckSounds = (): boolean =>
  typeof window !== "undefined" && typeof Worker !== "undefined" && typeof OfflineAudioContext !== "undefined" && typeof WebAssembly !== "undefined";

/** Checking sounds needs a 90 MB download, so it is the learner's choice, remembered on this device */
export function soundCheckIsOn(): boolean {
  try {
    return localStorage.getItem(PREFERENCE) === "on";
  } catch {
    return false;
  }
}

export function setSoundCheck(on: boolean) {
  try {
    if (on) localStorage.setItem(PREFERENCE, "on");
    else localStorage.removeItem(PREFERENCE);
  } catch {
    /* it just won't be remembered */
  }
}

/** Turns a recording (a blob: link from the recorder) into 16 kHz mono samples */
async function decode(url: string): Promise<Float32Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Couldn't read the recording");
  const bytes = await response.arrayBuffer();
  // decodeAudioData resamples to the context's rate
  const buffer = await new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE).decodeAudioData(bytes);
  const length = Math.min(buffer.length, MAX_SECONDS * SAMPLE_RATE);
  // A copy, so its memory can be handed to the worker
  const mono = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += channel[i] / buffer.numberOfChannels;
  }
  return mono;
}

/** What the recogniser heard in the recording, frame by frame */
export async function hearSounds(recordingUrl: string, onStage: (s: SoundStage) => void = () => {}): Promise<PhoneFrames> {
  if (!canCheckSounds()) throw new Error("This browser can't check single sounds");
  onStage({ stage: "audio" });
  const audio = await decode(recordingUrl);
  if (audio.length < SAMPLE_RATE / 4) throw new Error("The recording is too short to check");
  const id = nextId++;
  return new Promise<PhoneFrames>((resolve, reject) => {
    pending.set(id, { resolve, reject, onStage });
    const request: WorkerRequest = { id, audio };
    getWorker().postMessage(request, [audio.buffer]);
  });
}
