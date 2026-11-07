// apps/web/src/lib/transcribe/onDevice.ts
// Transcribes a voice message in this browser (see whisper.worker.ts). Used when the server has no paid
// speech-to-text key. Results are remembered on this device, so a message is only transcribed once.

import type { WorkerRequest, WorkerResponse } from "./whisper.worker";

/** Whisper listens to 16 kHz mono audio */
const SAMPLE_RATE = 16000;
/** Longer recordings would take minutes on a slow computer */
export const MAX_SECONDS = 10 * 60;
const CACHE_PREFIX = "sb.transcript.";

export type OnDeviceStage = { stage: "audio" } | { stage: "download"; loadedMb: number; totalMb: number } | { stage: "listening" };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (text: string) => void; reject: (e: Error) => void; onStage: (s: OnDeviceStage) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    const job = pending.get(msg.id);
    if (!job) return;
    if (msg.type === "download") job.onStage({ stage: "download", loadedMb: msg.loadedMb, totalMb: msg.totalMb });
    else if (msg.type === "listening") job.onStage({ stage: "listening" });
    else {
      pending.delete(msg.id);
      if (msg.type === "done") job.resolve(msg.text);
      else job.reject(new Error(msg.message));
    }
  };
  worker.onerror = (event) => {
    for (const job of pending.values()) job.reject(new Error(event.message || "Transcription stopped"));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export const canTranscribeOnDevice = (): boolean =>
  typeof window !== "undefined" && typeof Worker !== "undefined" && typeof OfflineAudioContext !== "undefined" && typeof WebAssembly !== "undefined";

/** Media links from the API may be relative to it */
function absolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const api = (import.meta.env.VITE_API_URL as string | undefined) ?? window.location.origin;
  return new URL(url, api.endsWith("/") ? api : `${api}/`).toString();
}

/** Downloads the recording and turns it into 16 kHz mono samples */
async function decode(url: string): Promise<Float32Array> {
  const response = await fetch(absolute(url));
  if (!response.ok) throw new Error("Couldn't load the recording");
  const bytes = await response.arrayBuffer();
  // decodeAudioData resamples to the context's rate
  const buffer = await new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE).decodeAudioData(bytes);
  if (buffer.duration > MAX_SECONDS) throw new Error("This recording is too long to transcribe here (10 minutes at most)");
  // A copy, so its memory can be handed to the worker
  if (buffer.numberOfChannels === 1) return new Float32Array(buffer.getChannelData(0));
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < channel.length; i++) mono[i] += channel[i] / buffer.numberOfChannels;
  }
  return mono;
}

export async function transcribeOnDevice(mediaUrl: string, onStage: (s: OnDeviceStage) => void = () => {}): Promise<string> {
  if (!canTranscribeOnDevice()) throw new Error("This browser can't transcribe voice messages");
  onStage({ stage: "audio" });
  const audio = await decode(mediaUrl);
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onStage });
    const request: WorkerRequest = { id, audio };
    getWorker().postMessage(request, [audio.buffer]);
  });
}

export function cachedTranscript(messageId: string): string | null {
  try {
    return localStorage.getItem(CACHE_PREFIX + messageId);
  } catch {
    return null;
  }
}

export function rememberTranscript(messageId: string, text: string) {
  try {
    localStorage.setItem(CACHE_PREFIX + messageId, text);
  } catch {
    /* it just won't be remembered */
  }
}
