import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CheckerMatch, SpellingVariant } from './writing.engine';

/** The free public server; set LANGUAGETOOL_URL to use your own (docker run -p 8010:8010 erikvl87/languagetool) */
const PUBLIC_URL = 'https://api.languagetool.org';
/** The public server allows about 20 requests a minute per IP, for the whole app; stay a little under */
const PUBLIC_PER_MINUTE = 18;
const SELF_HOSTED_PER_MINUTE = 600;
const TIMEOUT_MS = 15_000;
const CACHE_SIZE = 300;

/** Too many checks right now (ours or the checker's limit) */
export class CheckerBusyError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('The grammar checker is busy');
  }
}

/** The checker could not be reached or answered badly */
export class CheckerUnavailableError extends Error {}

/**
 * Talks to a LanguageTool server. Same text, same answer: results are cached, so checking again after a
 * small edit elsewhere only costs one request, and pressing Finish on checked text costs none.
 */
@Injectable()
export class LanguageToolClient {
  private readonly logger = new Logger(LanguageToolClient.name);
  private readonly base: string;
  private readonly perMinute: number;
  private readonly cache = new Map<string, CheckerMatch[]>();
  private sent: number[] = [];

  constructor(config: ConfigService) {
    const configured = config.get<string>('LANGUAGETOOL_URL')?.trim().replace(/\/+$/, '');
    this.base = configured || PUBLIC_URL;
    this.perMinute = Number(config.get('LANGUAGETOOL_PER_MINUTE')) || (configured ? SELF_HOSTED_PER_MINUTE : PUBLIC_PER_MINUTE);
  }

  /** Whether the free public server is in use (the page mentions it, since text leaves the app) */
  get usesPublicServer(): boolean {
    return this.base === PUBLIC_URL;
  }

  async check(text: string, variant: SpellingVariant): Promise<CheckerMatch[]> {
    const key = `${variant}:${createHash('sha1').update(text).digest('hex')}`;
    const cached = this.cache.get(key);
    if (cached) {
      // Keep recently used results at the end, so the oldest are dropped first
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    this.reserve();
    let response: Response;
    try {
      response = await fetch(`${this.base}/v2/check`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text, language: variant }),
      });
    } catch (error) {
      this.logger.warn(`Grammar checker unreachable: ${(error as Error)?.message}`);
      throw new CheckerUnavailableError('The grammar checker could not be reached');
    }
    if (response.status === 429) throw new CheckerBusyError(30);
    if (!response.ok) {
      this.logger.warn(`Grammar checker answered ${response.status}`);
      throw new CheckerUnavailableError(`The grammar checker answered ${response.status}`);
    }
    const body = (await response.json()) as { matches?: CheckerMatch[] };
    const matches = Array.isArray(body.matches) ? body.matches : [];

    this.cache.set(key, matches);
    if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value as string);
    return matches;
  }

  /** One request from the shared budget, or CheckerBusyError with how long to wait */
  private reserve() {
    const now = Date.now();
    this.sent = this.sent.filter((t) => now - t < 60_000);
    if (this.sent.length >= this.perMinute) {
      const wait = Math.ceil((60_000 - (now - this.sent[0])) / 1000);
      throw new CheckerBusyError(Math.max(1, wait));
    }
    this.sent.push(now);
  }
}
