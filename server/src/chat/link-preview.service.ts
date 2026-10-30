import { Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const MAX_HTML_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const CACHE_MS = 6 * 60 * 60_000;
const CACHE_MAX = 500;

/** First http(s) link in a message, without trailing punctuation */
export function firstUrl(text?: string | null): string | null {
  const match = text?.match(URL_PATTERN);
  return match ? match[0].replace(/[).,!?;:'"]+$/, '') : null;
}

/** Loopback, private, link-local, CGNAT and multicast ranges — never fetched */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
const decode = (text: string) =>
  text
    .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Builds link-preview cards (Open Graph title/description/image) for links in
 * chat messages. Only public http(s) hosts are fetched, so a message can't make
 * the server request internal addresses.
 */
@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private cache = new Map<string, { value: LinkPreview | null; at: number }>();

  async preview(rawUrl: string): Promise<LinkPreview | null> {
    const hit = this.cache.get(rawUrl);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    let value: LinkPreview | null = null;
    try {
      value = await this.fetchPreview(rawUrl);
    } catch (error: any) {
      this.logger.debug(`No preview for ${rawUrl}: ${error?.message || error}`);
    }

    if (this.cache.size >= CACHE_MAX) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    this.cache.set(rawUrl, { value, at: Date.now() });
    return value;
  }

  private async assertPublicUrl(raw: string): Promise<URL> {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported protocol');
    if (url.port && url.port !== '80' && url.port !== '443') throw new Error('Unsupported port');
    if (url.username || url.password) throw new Error('Credentials in URL');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
      throw new Error('Private address');
    }
    return url;
  }

  private async fetchPreview(rawUrl: string): Promise<LinkPreview | null> {
    let url = await this.assertPublicUrl(rawUrl);
    let response: Response | null = null;

    // Follow redirects by hand so every hop is checked
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SpeakBetterLinkPreview/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        url = await this.assertPublicUrl(new URL(location, url).toString());
        continue;
      }
      break;
    }

    if (!response?.ok) return null;
    if (!(response.headers.get('content-type') || '').includes('html')) return null;

    const html = await this.readLimited(response);
    const meta = new Map<string, string>();
    for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
      const attrs = new Map<string, string>();
      for (const [, name, , dq, sq] of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
        attrs.set(name.toLowerCase(), dq ?? sq ?? '');
      }
      const key = (attrs.get('property') || attrs.get('name') || '').toLowerCase();
      const content = attrs.get('content');
      if (key && content && !meta.has(key)) meta.set(key, decode(content));
    }

    const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
    const title = meta.get('og:title') || meta.get('twitter:title') || (titleTag ? decode(titleTag) : '');
    const description = meta.get('og:description') || meta.get('twitter:description') || meta.get('description');
    let image = meta.get('og:image') || meta.get('twitter:image');
    if (image) {
      try {
        const resolved = new URL(image, url);
        image = resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.toString() : undefined;
      } catch {
        image = undefined;
      }
    }

    if (!title && !description) return null;
    return {
      url: rawUrl,
      title: title?.slice(0, 200) || undefined,
      description: description?.slice(0, 300) || undefined,
      image: image?.slice(0, 1000),
      siteName: (meta.get('og:site_name') || url.hostname.replace(/^www\./, '')).slice(0, 100),
    };
  }

  private async readLimited(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => undefined);
    return Buffer.concat(chunks).toString('utf8');
  }
}
