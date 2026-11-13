/// <reference lib="webworker" />
// apps/web/src/lib/phonemes/phoneme.worker.ts
// Hears the single sounds in a recording, on the learner's own device: a wav2vec2 phone recogniser for English
// run through transformers.js. Free, no key, and the audio never leaves the browser; only its guesses at the
// sounds do. The library comes from the jsDelivr CDN at a pinned version and the model from Hugging Face; the
// browser caches both, so only the first check downloads (about 90 MB).

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
/**
 * Labels English speech with IPA symbols, 20 ms at a time (bookbot/wav2vec2-ljspeech-gruut, Apache 2.0).
 * A smaller many-language model was tried first and heard a correct "think" as "sink", so it was dropped.
 */
const MODEL = "onnx-community/wav2vec2-ljspeech-gruut-ONNX";
const MODEL_MB = 90;
/** Labels that are not sounds: padding (the "nothing new here" label), the word gap, and unknowns */
const PADDING = ["[PAD]", "<pad>"];
const NOT_SOUNDS = new Set([...PADDING, "|", "[UNK]", "<unk>", "<s>", "</s>"]);
/** Guesses kept for each frame, and the least sure one worth sending */
const TOP = 4;
const MIN_PROBABILITY = 0.02;
/** A frame this sure of "nothing new here" is sent as silence */
const SILENT = 0.99;

interface ProgressInfo {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
}

interface Tensor {
  dims: number[];
  data: Float32Array;
}

interface Loaded {
  extractor: (audio: Float32Array) => Promise<Record<string, unknown>>;
  model: (inputs: Record<string, unknown>) => Promise<{ logits: Tensor }>;
  /** The label of each output, by position */
  labels: string[];
}

/** A number is that many silent frames; a list is one frame: [blank, label, probability, label, probability, ...] */
export type PhoneFrames = Array<number | Array<number | string>>;

export type WorkerRequest = { id: number; audio: Float32Array };
export type WorkerResponse =
  | { id: number; type: "download"; loadedMb: number; totalMb: number }
  | { id: number; type: "listening" }
  | { id: number; type: "done"; frames: PhoneFrames }
  | { id: number; type: "error"; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let loaded: Promise<Loaded> | null = null;
/** Bytes downloaded per model file, for one overall figure */
const files = new Map<string, { loaded: number; total: number }>();

function load(onProgress: (loadedMb: number, totalMb: number) => void): Promise<Loaded> {
  loaded ??= (async () => {
    const lib = await import(/* @vite-ignore */ TRANSFORMERS_URL);
    lib.env.allowLocalModels = false;
    const progress_callback = (info: ProgressInfo) => {
      if (info.status !== "progress" || !info.file || !info.total) return;
      files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
      let done = 0;
      let total = 0;
      for (const f of files.values()) {
        done += f.loaded;
        total += f.total;
      }
      const mb = (bytes: number) => Math.round(bytes / 1e6);
      onProgress(Math.min(mb(done), Math.max(mb(total), MODEL_MB)), Math.max(mb(total), MODEL_MB));
    };
    const [extractor, model, vocab] = await Promise.all([
      lib.AutoFeatureExtractor.from_pretrained(MODEL, { progress_callback }),
      lib.AutoModelForCTC.from_pretrained(MODEL, { dtype: "q4", device: "wasm", progress_callback }),
      fetch(`https://huggingface.co/${MODEL}/resolve/main/vocab.json`).then((r) => {
        if (!r.ok) throw new Error("Couldn't load the list of sounds");
        return r.json() as Promise<Record<string, number>>;
      }),
    ]);
    const labels: string[] = [];
    for (const [label, index] of Object.entries(vocab)) labels[index] = label;
    return { extractor, model, labels } as Loaded;
  })();
  // A failed download can be tried again next time
  loaded.catch(() => {
    loaded = null;
  });
  return loaded;
}

/** Turns the model's raw scores into the few likeliest sounds per frame */
function toFrames(logits: Tensor, labels: string[]): PhoneFrames {
  const steps = logits.dims[logits.dims.length - 2];
  const size = logits.dims[logits.dims.length - 1];
  const data = logits.data;
  const frames: PhoneFrames = [];
  const round = (p: number) => Math.round(p * 100) / 100;
  const padding = labels.findIndex((l) => PADDING.includes(l));
  const gap = labels.indexOf("|");
  let silent = 0;

  for (let t = 0; t < steps; t++) {
    const start = t * size;
    let max = -Infinity;
    for (let i = 0; i < size; i++) if (data[start + i] > max) max = data[start + i];
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Math.exp(data[start + i] - max);

    // A pause between words says as little about a sound as padding does
    const at = (i: number) => (i >= 0 ? Math.exp(data[start + i] - max) / sum : 0);
    const blank = Math.min(1, at(padding) + at(gap));
    if (blank >= SILENT) {
      silent++;
      continue;
    }
    const best: Array<[number, number]> = [];
    for (let i = 0; i < size; i++) {
      if (NOT_SOUNDS.has(labels[i])) continue;
      const p = at(i);
      if (p < MIN_PROBABILITY) continue;
      best.push([i, p]);
    }
    best.sort((a, b) => b[1] - a[1]);
    if (silent) {
      frames.push(silent);
      silent = 0;
    }
    const frame: Array<number | string> = [round(blank)];
    for (const [i, p] of best.slice(0, TOP)) frame.push(labels[i] ?? "", round(p));
    frames.push(frame);
  }
  if (silent) frames.push(silent);
  return frames;
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, audio } = event.data;
  const post = (message: WorkerResponse) => scope.postMessage(message);
  try {
    const { extractor, model, labels } = await load((loadedMb, totalMb) => post({ id, type: "download", loadedMb, totalMb }));
    post({ id, type: "listening" });
    const { logits } = await model(await extractor(audio));
    post({ id, type: "done", frames: toFrames(logits, labels) });
  } catch (error) {
    post({ id, type: "error", message: (error as Error)?.message || "Could not check the sounds" });
  }
};
