import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import { hearSounds, type SoundStage } from '../lib/phonemes/onDevice';

export type SoundKey = 'TH' | 'V_W' | 'V_B' | 'R_L' | 'I_EE' | 'A_E' | 'S_SH' | 'Z_S' | 'F_P' | 'U_OO';

export interface SoundSet {
  key: SoundKey;
  label: string;
  ipa: string;
  tip: string;
  pairs: Array<[string, string]>;
  sentences: string[];
  attempts: number;
  best: number | null;
}

export interface PracticeData {
  level: string;
  sounds: SoundSet[];
  sentences: string[];
  myWords: string[];
}

export interface WordResult {
  text: string;
  word: string;
  status: 'good' | 'close' | 'missed';
  heard: string | null;
}

export interface AttemptResult {
  id: string;
  score: number;
  verdict: 'great' | 'good' | 'try-again';
  heard: string;
  words: WordResult[];
  issues: Array<{ word: string; heard: string | null; sound: SoundKey | null; tip: string }>;
  sound: SoundKey | null;
  /** How fast a sentence was said (null for single words or when too little was heard) */
  pace: { wordsPerMinute: number; verdict: 'slow' | 'natural' | 'fast'; tip: string } | null;
  /** Words that just went into your review deck */
  addedToReview: string[];
}

export interface DrillItem {
  target: string;
  source: 'sound' | 'sentence' | 'word';
  sound?: SoundKey;
  avoid?: string;
}

export interface Drill {
  items: DrillItem[];
  sounds: Array<{ key: SoundKey; label: string; weak: boolean }>;
  troubleWords: string[];
  level: string;
}

export interface PronunciationProgress {
  days: number;
  attempts: number;
  average: number | null;
  last7: number | null;
  prev7: number | null;
  sounds: Array<{ key: SoundKey; label: string; attempts: number; average: number; best: number }>;
  troubleWords: Array<{ word: string; count: number; heardAs: string | null }>;
  /** Single sounds that keep going wrong, weakest first (filled in once sound checking has been used) */
  weakPhones?: Array<{ p: string; ipa: string; hint: string; tries: number; accuracy: number; heardAs: string | null }>;
  recent: Array<{ target: string; score: number; sound: SoundKey | null; createdAt: string }>;
}

export const usePronunciationPractice = () =>
  useQuery({
    queryKey: ['pronunciation-practice'],
    queryFn: async () => (await apiClient.get<PracticeData>('/pronunciation/practice')).data,
    staleTime: 60_000,
  });

export const usePronunciationDrill = () =>
  useQuery({
    queryKey: ['pronunciation-drill'],
    queryFn: async () => (await apiClient.get<Drill>('/pronunciation/drill')).data,
    staleTime: 5 * 60_000,
  });

export const usePronunciationProgress = (enabled = true) =>
  useQuery({
    queryKey: ['pronunciation-progress'],
    queryFn: async () => (await apiClient.get<PronunciationProgress>('/pronunciation/progress')).data,
    enabled,
    staleTime: 30_000,
  });

export const useSubmitAttempt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      target: string;
      heard: string[];
      confidence?: number;
      sound?: SoundKey;
      source: 'sound' | 'sentence' | 'word';
      durationMs?: number;
    }) => (await apiClient.post<AttemptResult>('/pronunciation/attempts', vars)).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pronunciation-progress'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-practice'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-drill'] });
      queryClient.invalidateQueries({ queryKey: ['learning-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['quests'] });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      if (result.addedToReview.length) queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });
};

// ---------- listening once, with several guesses ----------

interface Alternative {
  transcript: string;
  confidence: number;
}
interface RecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: Alternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const canListen = () => getCtor() !== null;

export interface Heard {
  /** The recogniser's guesses, best first */
  alternatives: string[];
  confidence: number | null;
  /** From the first sound to the end of speech, for the pace; null when the browser did not say */
  durationMs: number | null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in the address bar, then try again.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in the address bar, then try again.',
  'audio-capture': 'No microphone was found. Plug one in or check your sound settings.',
  network: 'Speech recognition needs an internet connection.',
  'no-speech': 'We did not hear anything. Press the microphone and speak a little louder.',
};

/**
 * Listens for one thing said, then stops by itself after a pause. Gives back up to five guesses so the
 * scorer can pick the one you meant. Uses the browser's own recognition (Chrome and Edge).
 */
export function useListenOnce() {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const listen = useCallback((): Promise<Heard | null> => {
    const Ctor = getCtor();
    if (!Ctor) return Promise.resolve(null);
    recognitionRef.current?.abort();
    setError(null);
    setInterim('');

    return new Promise((resolve) => {
      const recognition = new Ctor();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognitionRef.current = recognition;

      const finals: Alternative[][] = [];
      let partial = '';
      let speechStart: number | null = null;
      let speechEnd: number | null = null;
      let lastResult: number | null = null;
      recognition.onspeechstart = () => {
        speechStart ??= performance.now();
      };
      recognition.onspeechend = () => {
        speechEnd = performance.now();
      };
      recognition.onresult = (event) => {
        lastResult = performance.now();
        partial = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const options: Alternative[] = [];
            for (let k = 0; k < result.length; k++) options.push(result[k]);
            finals.push(options);
          } else {
            partial += result[0]?.transcript ?? '';
          }
        }
        setInterim([...finals.map((f) => f[0]?.transcript ?? ''), partial].join(' ').trim());
      };
      recognition.onerror = (event) => {
        if (event.error !== 'aborted') setError(ERRORS[event.error] ?? 'Speech recognition stopped. Try again.');
      };
      recognition.onend = () => {
        setListening(false);
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        // A phrase can arrive as several results: join the first guesses, and offer each result's other
        // guesses with the rest kept as heard
        if (!finals.length && !partial.trim()) return resolve(null);
        const first = finals.map((f) => f[0]?.transcript ?? '');
        const alternatives = [[...first, partial].join(' ').trim()];
        finals.forEach((options, i) =>
          options.slice(1).forEach((o) => {
            const variant = [...first.slice(0, i), o.transcript, ...first.slice(i + 1), partial].join(' ').trim();
            if (!alternatives.includes(variant)) alternatives.push(variant);
          }),
        );
        const confidence = finals.length === 1 && finals[0][0]?.confidence ? finals[0][0].confidence : null;
        // The end of speech is the better end point; the last result can come a moment after it
        const end = speechEnd ?? lastResult;
        const durationMs = speechStart !== null && end !== null && end > speechStart ? Math.round(end - speechStart) : null;
        resolve({ alternatives: alternatives.slice(0, 5), confidence, durationMs });
      };

      try {
        recognition.start();
        setListening(true);
      } catch {
        setError('Could not start the microphone. Try again.');
        resolve(null);
      }
    });
  }, []);

  /** Stops listening now; what was heard so far is still scored */
  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return { listening, interim, error, listen, stop };
}

// ---------- recording your voice, with a live level ----------

interface LiveRecording {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  context: AudioContext | null;
  /** The animation frame that updates the level */
  frame: number;
  /** The loudest moment so far, 0-1 */
  peak: number;
}

export const canRecord = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/**
 * Records the microphone while you speak, so you can play yourself back next to the model voice, and shows
 * how loud you are while recording. It runs next to speech recognition and is optional: if the browser will
 * not record, practice still works without playback.
 */
export function useRecorder() {
  const [url, setUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const urlRef = useRef<string | null>(null);
  const live = useRef<LiveRecording | null>(null);

  const release = useCallback(() => {
    const current = live.current;
    if (!current) return;
    cancelAnimationFrame(current.frame);
    current.stream.getTracks().forEach((t) => t.stop());
    void current.context?.close().catch(() => undefined);
    live.current = null;
    setLevel(0);
  }, []);

  useEffect(
    () => () => {
      if (live.current?.recorder.state === 'recording') live.current.recorder.stop();
      release();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [release],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (!canRecord() || live.current) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };

      const state: LiveRecording = { stream, recorder, chunks, context: null, frame: 0, peak: 0 };
      live.current = state;
      try {
        const context = new AudioContext();
        state.context = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const v of samples) sum += ((v - 128) / 128) ** 2;
          // Loudness as 0-1, stretched so normal speech fills most of the bar
          const value = Math.min(1, Math.sqrt(sum / samples.length) * 4);
          state.peak = Math.max(state.peak, value);
          setLevel(value);
          state.frame = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* no level meter, recording still works */
      }

      recorder.start();
      return true;
    } catch {
      release();
      return false;
    }
  }, [release]);

  /** Stops recording. Gives the loudest moment (0-1) so a too-quiet microphone can be pointed out. */
  const stop = useCallback(async (): Promise<{ url: string; peak: number } | null> => {
    const current = live.current;
    if (!current) return null;
    if (current.recorder.state !== 'recording') {
      release();
      return null;
    }
    const done = new Promise<void>((resolve) => {
      current.recorder.onstop = () => resolve();
    });
    current.recorder.stop();
    await done;
    const peak = current.peak;
    release();
    if (!current.chunks.length) return null;
    const blob = new Blob(current.chunks, { type: current.recorder.mimeType || 'audio/webm' });
    const next = URL.createObjectURL(blob);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setUrl(next);
    return { url: next, peak };
  }, [release]);

  /** Forgets the last recording (for the next word) */
  const clear = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
  }, []);

  return { url, level, start, stop, clear };
}

// ---------- checking each sound, on this device ----------

export interface SoundPhone {
  /** The sound expected, and how it is written for learners ("iː") */
  p: string;
  ipa: string;
  status: 'good' | 'close' | 'wrong' | 'missing';
  /** What it sounded like instead */
  heard?: string;
  heardIpa?: string;
}

export interface SoundWord {
  word: string;
  /** The word as written in the sentence */
  text: string;
  /** Null when we do not know how this word should sound */
  phones: SoundPhone[] | null;
  score: number | null;
}

export interface SoundTip {
  sound: SoundKey | null;
  expected: string;
  heard: string | null;
  expectedHint: string;
  heardHint: string | null;
  words: string[];
  tip: string;
}

export interface SoundCheck {
  score: number;
  judged: number;
  words: SoundWord[];
  tips: SoundTip[];
}

export type SoundCheckState =
  | { status: 'idle' }
  | { status: 'working'; stage: SoundStage }
  | { status: 'done'; result: SoundCheck }
  /** The recording could not be lined up with the words */
  | { status: 'none' }
  | { status: 'error'; message: string };

/**
 * Checks every sound of an attempt: the recording is listened to in this browser (it is never uploaded),
 * and the server says which sounds were off. Only the latest run counts, so a slow check of an earlier
 * try never overwrites a newer one.
 */
export function useSoundCheck() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SoundCheckState>({ status: 'idle' });
  const latest = useRef(0);

  const run = useCallback(
    async (attemptId: string, recordingUrl: string) => {
      const mine = ++latest.current;
      const current = () => latest.current === mine;
      setState({ status: 'working', stage: { stage: 'audio' } });
      try {
        const frames = await hearSounds(recordingUrl, (stage) => {
          if (current()) setState({ status: 'working', stage });
        });
        if (!current()) return;
        const { data } = await apiClient.post<{ sounds: SoundCheck | null }>(`/pronunciation/attempts/${attemptId}/sounds`, { frames });
        if (!current()) return;
        setState(data.sounds ? { status: 'done', result: data.sounds } : { status: 'none' });
        if (data.sounds) queryClient.invalidateQueries({ queryKey: ['pronunciation-progress'] });
      } catch (error) {
        if (!current()) return;
        const fromServer = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
        const message = typeof fromServer === 'string' ? fromServer : (error as Error)?.message || 'Could not check the sounds';
        setState({ status: 'error', message });
      }
    },
    [queryClient],
  );

  /** Forgets the last check (for the next word, or a new try) */
  const reset = useCallback(() => {
    latest.current++;
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset };
}
