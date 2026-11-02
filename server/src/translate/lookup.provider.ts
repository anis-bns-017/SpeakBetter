import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DictionaryMeaning {
  partOfSpeech: string;
  definition: string;
  example: string | null;
}

export interface DictionaryEntry {
  phonetic: string | null;
  audioUrl: string | null;
  meanings: DictionaryMeaning[];
  synonyms: string[];
  antonyms: string[];
}

/** The free translation service says today's allowance is used up */
export class LookupQuotaError extends Error {
  constructor() {
    super('The free translation allowance is used up for now');
  }
}

/** Where meanings come from. Abstract so tests (and a paid service later) can replace it. */
export abstract class LookupProvider {
  /** English → `target`. Null when the service has no answer. Throws LookupQuotaError when out of allowance. */
  abstract translate(text: string, target: string): Promise<string | null>;
  /**
   * English dictionary entry for one word. Null when the word is unknown.
   * `preferPos` puts that part of speech first (for a form like "went", which is a verb).
   */
  abstract define(word: string, preferPos?: string): Promise<DictionaryEntry | null>;
}

const REQUEST_TIMEOUT_MS = 5000;
/** Definitions kept per part of speech, and in all */
const PER_PART_OF_SPEECH = 2;
const MAX_MEANINGS = 6;
const DICTIONARY_RETRIES = 2;
const MAX_SYNONYMS = 8;
const MAX_ANTONYMS = 5;

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

const decodeEntities = (text: string) =>
  text
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d{1,6});/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)));

const MAX_WORD_TRANSLATIONS = 3;

const bare = (text: string) => text.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const tokens = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * MyMemory is a pool of human translations, and for a single word its top answer is sometimes a stray
 * phrase ("house" → a lease term). So for one word, take the shortest answers among the matches that are
 * really for that word, best first.
 */
function wordTranslations(matches: unknown, word: string): string[] {
  if (!Array.isArray(matches)) return [];
  const key = bare(word);
  const candidates: Array<{ text: string; match: number }> = [];
  for (const m of matches as Array<Record<string, unknown>>) {
    if (typeof m?.segment !== 'string' || typeof m?.translation !== 'string') continue;
    if (bare(m.segment) !== key) continue;
    const text = decodeEntities(m.translation).replace(/[\s\p{P}]+$/gu, '').trim();
    if (text) candidates.push({ text, match: Number(m.match) || 0 });
  }
  const short = candidates.filter((c) => tokens(c.text) <= 2);
  const pool = short.length ? short : candidates;
  pool.sort((a, b) => tokens(a.text) - tokens(b.text) || b.match - a.match);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of pool) {
    const k = c.text.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c.text);
    if (out.length === MAX_WORD_TRANSLATIONS) break;
  }
  return out;
}

/**
 * Reads a MyMemory response. Pass `word` when the text was one word, to pick from all of the matches.
 * Pure so it can be tested without the network.
 */
export function parseMyMemory(json: unknown, word?: string): string | null {
  const body = json as {
    responseStatus?: number | string;
    responseData?: { translatedText?: unknown };
    matches?: unknown;
  } | null;
  const text = typeof body?.responseData?.translatedText === 'string' ? body.responseData.translatedText : '';
  const status = Number(body?.responseStatus);
  if (status === 429 || /MYMEMORY WARNING/i.test(text)) throw new LookupQuotaError();
  if (status !== 200 || !text.trim()) return null;
  if (/^(PLEASE SELECT|INVALID|NO QUERY)/i.test(text)) return null;
  if (word) {
    const picked = wordTranslations(body?.matches, word);
    if (picked.length) return picked.join(' · ');
  }
  return decodeEntities(text).trim();
}

const asWords = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && /^[\p{L}][\p{L} '-]{0,29}$/u.test(v)) : [];

interface Sense {
  partOfSpeech: string;
  meanings: DictionaryMeaning[];
  synonyms: string[];
  antonyms: string[];
}

/**
 * Reads a dictionaryapi.dev response (an array of entries, or an object when the word is unknown).
 * `preferPos` is the part of speech the reader most likely means ("went" → verb): those senses come first,
 * and the similar and opposite words are taken from them alone.
 */
export function parseDictionary(json: unknown, preferPos?: string): DictionaryEntry | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  let phonetic: string | null = null;
  let audioUrl: string | null = null;
  const senses: Sense[] = [];

  for (const entry of json as any[]) {
    phonetic ??= typeof entry?.phonetic === 'string' && entry.phonetic ? entry.phonetic : null;
    for (const p of Array.isArray(entry?.phonetics) ? entry.phonetics : []) {
      phonetic ??= typeof p?.text === 'string' && p.text ? p.text : null;
      if (!audioUrl && typeof p?.audio === 'string' && /^https:\/\//.test(p.audio)) audioUrl = p.audio;
    }
    for (const m of Array.isArray(entry?.meanings) ? entry.meanings : []) {
      const partOfSpeech = typeof m?.partOfSpeech === 'string' ? m.partOfSpeech : '';
      const sense: Sense = { partOfSpeech, meanings: [], synonyms: asWords(m?.synonyms), antonyms: asWords(m?.antonyms) };
      for (const d of Array.isArray(m?.definitions) ? m.definitions : []) {
        if (typeof d?.definition !== 'string' || !d.definition.trim()) continue;
        sense.synonyms.push(...asWords(d?.synonyms));
        sense.antonyms.push(...asWords(d?.antonyms));
        if (sense.meanings.length >= PER_PART_OF_SPEECH) continue;
        sense.meanings.push({
          partOfSpeech,
          definition: d.definition.trim(),
          example: typeof d.example === 'string' && d.example.trim() ? d.example.trim() : null,
        });
      }
      if (sense.meanings.length) senses.push(sense);
    }
  }

  const preferred = preferPos ? senses.filter((s) => s.partOfSpeech === preferPos) : [];
  const ordered = preferred.length ? [...preferred, ...senses.filter((s) => !preferred.includes(s))] : senses;
  const related = preferred.length ? preferred : senses;
  const unique = (lists: string[][], max: number) => [...new Set(lists.flat().map((w) => w.toLowerCase()))].slice(0, max);

  const meanings = ordered.flatMap((s) => s.meanings).slice(0, MAX_MEANINGS);
  if (!meanings.length && !phonetic) return null;
  return {
    phonetic,
    audioUrl,
    meanings,
    synonyms: unique(related.map((s) => s.synonyms), MAX_SYNONYMS),
    antonyms: unique(related.map((s) => s.antonyms), MAX_ANTONYMS),
  };
}

/** MyMemory (translation) and dictionaryapi.dev (English definitions): both free and need no key */
@Injectable()
export class FreeLookupProvider extends LookupProvider {
  private readonly logger = new Logger(FreeLookupProvider.name);

  constructor(private config: ConfigService) {
    super();
  }

  async translate(text: string, target: string): Promise<string | null> {
    // An email address raises MyMemory's free daily allowance from 5,000 to 50,000 characters
    const email = this.config.get<string>('MYMEMORY_EMAIL');
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
      `&langpair=${encodeURIComponent(`en|${target}`)}` +
      (email ? `&de=${encodeURIComponent(email)}` : '');
    const single = /^[\p{L}][\p{L}'’-]*$/u.test(text);
    return parseMyMemory(await this.getJson(url), single ? text : undefined);
  }

  async define(word: string, preferPos?: string): Promise<DictionaryEntry | null> {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    // The service sometimes answers 502 for a word it does know, so ask a couple more times before
    // taking that as "no entry" (it also answers 502 for words it has never heard of)
    for (let attempt = 0; ; attempt++) {
      try {
        return parseDictionary(await this.getJson(url), preferPos);
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if (status === 404) return null;
        if (status === 502) {
          if (attempt >= DICTIONARY_RETRIES) return null;
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
  }

  private async getJson(url: string): Promise<unknown> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    // MyMemory reports its own status inside a 200 body, so only a plain 429 is handled here
    if (response.status === 429) throw new LookupQuotaError();
    if (!response.ok) {
      this.logger.debug(`Lookup request failed with ${response.status}`);
      throw Object.assign(new Error(`Lookup request failed (${response.status})`), { status: response.status });
    }
    return response.json();
  }
}
