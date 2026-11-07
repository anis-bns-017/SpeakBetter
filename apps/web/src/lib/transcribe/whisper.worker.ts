/// <reference lib="webworker" />
// apps/web/src/lib/transcribe/whisper.worker.ts
// Speech-to-text on the learner's own device: Whisper (base, multilingual) through transformers.js. Free, no key,
// and the audio never leaves the browser. The library comes from the jsDelivr CDN at a pinned version and the
// model from Hugging Face; the browser caches both, so only the first transcription downloads (about 80 MB).

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
const MODEL = "onnx-community/whisper-base";
/** The two 8-bit model files (23 MB encoder, 54 MB decoder); small config files come on top */
const MODEL_MB = 77;

type AsrOutput = { text?: string } | Array<{ text?: string }>;
type Asr = (audio: Float32Array, options: Record<string, unknown>) => Promise<AsrOutput>;

interface ProgressInfo {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
}

export type WorkerRequest = { id: number; audio: Float32Array };
export type WorkerResponse =
  | { id: number; type: "download"; loadedMb: number; totalMb: number }
  | { id: number; type: "listening" }
  | { id: number; type: "done"; text: string }
  | { id: number; type: "error"; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let model: Promise<Asr> | null = null;
/** Bytes downloaded per model file, for one overall percentage */
const files = new Map<string, { loaded: number; total: number }>();

function load(onProgress: (loadedMb: number, totalMb: number) => void): Promise<Asr> {
  model ??= (async () => {
    const lib = await import(/* @vite-ignore */ TRANSFORMERS_URL);
    lib.env.allowLocalModels = false;
    return (await lib.pipeline("automatic-speech-recognition", MODEL, {
      device: "wasm",
      // 8-bit weights: a quarter of the download, with little loss for short voice messages
      dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
      progress_callback: (info: ProgressInfo) => {
        if (info.status !== "progress" || !info.file || !info.total) return;
        files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        // Megabytes, not a percentage: files start one after another, so a percentage would jump back
        const mb = (bytes: number) => Math.round(bytes / 1e6);
        onProgress(Math.min(mb(loaded), Math.max(mb(total), MODEL_MB)), Math.max(mb(total), MODEL_MB));
      },
    })) as Asr;
  })();
  // A failed download can be tried again next time
  model.catch(() => {
    model = null;
  });
  return model;
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, audio } = event.data;
  const post = (message: WorkerResponse) => scope.postMessage(message);
  try {
    const asr = await load((loadedMb, totalMb) => post({ id, type: "download", loadedMb, totalMb }));
    post({ id, type: "listening" });
    const output = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, task: "transcribe" });
    const text = (Array.isArray(output) ? output.map((o) => o.text ?? "").join(" ") : (output.text ?? "")).replace(/\s+/g, " ").trim();
    post({ id, type: "done", text });
  } catch (error) {
    post({ id, type: "error", message: (error as Error)?.message || "Transcription failed" });
  }
};
