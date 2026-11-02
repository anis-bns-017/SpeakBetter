import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { isEnglish, LOOKUP_LANGUAGES, resolveLanguage } from './languages';
import { baseForms, partOfSpeechHint } from './inflections';
import { DictionaryEntry, DictionaryMeaning, LookupProvider, LookupQuotaError } from './lookup.provider';

export const MAX_LOOKUP_CHARS = 300;
const CACHE_MAX = 2000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A word with no dictionary entry is asked again sooner, in case the dictionary was only down */
const CACHE_TTL_NO_ENTRY_MS = 10 * 60 * 1000;
/** After the free service says it is out of allowance, do not ask again for a while */
const QUOTA_PAUSE_MS = 30 * 60 * 1000;
/** Spellings tried when a word has no entry of its own */
const BASE_FORM_TRIES = 3;

export type LookupNotice =
  /** No language to translate into: pick one */
  | 'no-language'
  /** The free translation allowance is used up for now */
  | 'limit'
  /** The translation service could not be reached */
  | 'unavailable'
  | null;

export interface LookupResult {
  text: string;
  kind: 'word' | 'phrase';
  target: { code: string; name: string } | null;
  translation: string | null;
  phonetic: string | null;
  audioUrl: string | null;
  meanings: DictionaryMeaning[];
  synonyms: string[];
  antonyms: string[];
  /** When the word is a form of another ("went"), the word the meanings are for ("go") */
  baseForm: string | null;
  notice: LookupNotice;
}

interface CacheEntry {
  at: number;
  ttl: number;
  result: LookupResult;
}

/** One word, with apostrophes and hyphens inside it ("don't", "well-known") */
const SINGLE_WORD = /^[\p{L}][\p{L}'’-]*$/u;

export function cleanLookupText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .trim();
}

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private quotaPausedUntil = 0;

  constructor(
    private prisma: PrismaService,
    private provider: LookupProvider,
  ) {}

  languages() {
    return LOOKUP_LANGUAGES.map(({ code, name }) => ({ code, name }));
  }

  /**
   * What a word or short phrase means: its translation into the reader's own language, plus (for a single
   * word) the English dictionary entry. `target` overrides the language on the reader's profile.
   */
  async lookup(userId: string, input: { text?: unknown; target?: unknown }): Promise<LookupResult> {
    const text = cleanLookupText(input.text);
    if (!text || !/\p{L}/u.test(text)) throw new BadRequestException('Select a word or a short phrase');
    if (text.length > MAX_LOOKUP_CHARS) {
      throw new BadRequestException(`Select at most ${MAX_LOOKUP_CHARS} characters`);
    }

    const target = await this.targetFor(userId, input.target);
    const kind: LookupResult['kind'] = SINGLE_WORD.test(text) ? 'word' : 'phrase';
    const key = `${kind}|${target?.code ?? '-'}|${text.toLowerCase()}`;

    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < hit.ttl) {
      // Re-insert so the least recently used entry is the one that gets dropped
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit.result;
    }

    let notice: LookupNotice = target ? null : 'no-language';
    let translation: string | null = null;
    let entry: DictionaryEntry | null = null;
    let baseForm: string | null = null;
    let failed = false;

    const translating = target && Date.now() >= this.quotaPausedUntil;
    if (target && !translating) notice = 'limit';

    const [translated, defined] = await Promise.allSettled([
      translating ? this.provider.translate(text, target.code) : Promise.resolve(null),
      kind === 'word' ? this.provider.define(text.toLowerCase()) : Promise.resolve(null),
    ]);

    if (translated.status === 'fulfilled') {
      // A service that just echoes the word back has nothing to say about it
      const value = translated.value?.trim() ?? '';
      translation = value && value.toLowerCase() !== text.toLowerCase() ? value : null;
    } else if (translated.reason instanceof LookupQuotaError) {
      this.quotaPausedUntil = Date.now() + QUOTA_PAUSE_MS;
      notice = 'limit';
    } else {
      this.logger.warn(`Translation failed: ${(translated.reason as Error)?.message}`);
      notice = 'unavailable';
      failed = true;
    }
    if (defined.status === 'fulfilled') {
      entry = defined.value;
      if (!entry && kind === 'word') {
        // "went", "running", "stories": look for the word they come from
        const hint = partOfSpeechHint(text);
        for (const base of baseForms(text).slice(0, BASE_FORM_TRIES)) {
          try {
            entry = await this.provider.define(base, hint);
          } catch {
            break;
          }
          if (entry) {
            baseForm = base;
            break;
          }
        }
      }
    } else {
      this.logger.warn(`Dictionary lookup failed: ${(defined.reason as Error)?.message}`);
      failed = true;
    }

    const result: LookupResult = {
      text,
      kind,
      target,
      translation,
      phonetic: entry?.phonetic ?? null,
      audioUrl: entry?.audioUrl ?? null,
      meanings: entry?.meanings ?? [],
      synonyms: entry?.synonyms ?? [],
      antonyms: entry?.antonyms ?? [],
      baseForm,
      notice,
    };
    // Only remember complete answers, so a hiccup does not stick for a week
    if (!failed && notice !== 'limit') this.remember(key, result);
    return result;
  }

  private async targetFor(userId: string, requested: unknown): Promise<LookupResult['target']> {
    // An explicit choice wins, including "English" meaning "no translation"
    if (typeof requested === 'string' && requested.trim()) {
      if (isEnglish(requested)) return null;
      const chosen = resolveLanguage(requested);
      if (chosen) return { code: chosen.code, name: chosen.name };
      throw new BadRequestException('That language is not supported yet');
    }
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { nativeLanguage: true } });
    const own = resolveLanguage(profile?.nativeLanguage);
    return own ? { code: own.code, name: own.name } : null;
  }

  private remember(key: string, result: LookupResult) {
    const ttl = result.kind === 'word' && result.meanings.length === 0 ? CACHE_TTL_NO_ENTRY_MS : CACHE_TTL_MS;
    this.cache.set(key, { at: Date.now(), ttl, result });
    if (this.cache.size > CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
  }
}
