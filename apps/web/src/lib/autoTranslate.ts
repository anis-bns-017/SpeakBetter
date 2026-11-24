/**
 * Settings > Auto-translate messages: a translation under the messages you receive. One request at a time and only
 * for messages on screen, because the free translation service has a daily allowance shared by the whole server.
 */
import { apiClient } from "./api/client";

const MAX_CHARS = 200;
const NO_TRANSLATION = "en";

let enabled = false;
/** The free allowance ran out: stop asking until the page is reloaded */
let stopped = false;
let tail: Promise<unknown> = Promise.resolve();
const cache = new Map<string, string | null>();

export const setAutoTranslate = (on: boolean) => {
  enabled = on;
};

export const isAutoTranslateOn = () => enabled;

/** Only real sentences or words of a sensible length are worth a request */
export const canAutoTranslate = (text: string | null | undefined): text is string => {
  const clean = text?.trim() ?? "";
  return clean.length >= 2 && clean.length <= MAX_CHARS && /\p{L}/u.test(clean) && !/https?:\/\//i.test(clean);
};

export const cachedTranslation = (text: string) => cache.get(text.trim()) ?? null;

const chosenLanguage = (): string | null => {
  try {
    return localStorage.getItem("sb.lookup.lang");
  } catch {
    return null;
  }
};

async function fetchTranslation(text: string): Promise<string | null> {
  const target = chosenLanguage();
  if (target === NO_TRANSLATION || stopped) return null;
  try {
    const { data } = await apiClient.get<{ translation: string | null; notice: string | null }>("/translate/lookup", {
      params: { text, ...(target ? { target } : {}) },
    });
    if (data.notice === "limit") stopped = true;
    const out = data.translation?.trim() || null;
    // A translation identical to the message adds nothing
    return out && out.toLowerCase() !== text.toLowerCase() ? out : null;
  } catch {
    return null;
  }
}

export function translateForChat(raw: string): Promise<string | null> {
  const text = raw.trim();
  if (!enabled || !canAutoTranslate(text)) return Promise.resolve(null);
  if (cache.has(text)) return Promise.resolve(cache.get(text) ?? null);
  const job = tail.then(async () => {
    if (cache.has(text)) return cache.get(text) ?? null;
    const out = await fetchTranslation(text);
    cache.set(text, out);
    return out;
  });
  tail = job.catch(() => null);
  return job;
}
