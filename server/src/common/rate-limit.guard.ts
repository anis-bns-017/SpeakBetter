import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** Separates the counters of different routes */
  name: string;
  /** Requests allowed per window, per client IP */
  limit: number;
  windowMs: number;
  /**
   * Also count per value of this body field (e.g. "email"), so one account
   * cannot be hammered from many addresses. Compared case-insensitively.
   */
  byBodyField?: { field: string; limit: number };
}

/** Marks a route as rate limited. Add RateLimitGuard to its @UseGuards. */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 10_000;

/**
 * Fixed-window rate limit, kept in this process's memory. Good against
 * password guessing and signup spam from one place; with several server
 * instances each keeps its own counters, so the effective limit is per
 * instance (move the store to Redis if you need it exact).
 *
 * The client IP is req.ip: behind a reverse proxy set TRUST_PROXY (see
 * main.ts), otherwise every visitor shares the proxy's address and one
 * person's attempts would lock everyone out.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const now = Date.now();

    this.sweep(now);

    const checks: Array<[string, number]> = [
      [`${options.name}:ip:${req.ip ?? 'unknown'}`, options.limit],
    ];
    const raw = options.byBodyField
      ? req.body?.[options.byBodyField.field]
      : undefined;
    if (options.byBodyField && typeof raw === 'string' && raw.trim()) {
      checks.push([
        `${options.name}:${options.byBodyField.field}:${raw.trim().toLowerCase().slice(0, 200)}`,
        options.byBodyField.limit,
      ]);
    }

    let retryAfterMs = 0;
    for (const [key, limit] of checks) {
      let bucket = this.buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + options.windowMs };
        this.buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (bucket.count > limit) {
        retryAfterMs = Math.max(retryAfterMs, bucket.resetAt - now);
      }
    }

    if (retryAfterMs > 0) {
      const seconds = Math.ceil(retryAfterMs / 1000);
      res.setHeader?.('Retry-After', String(seconds));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Too many attempts. Try again in ${seconds} seconds.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds: seconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /** Drops finished windows so memory stays bounded */
  private sweep(now: number) {
    if (this.buckets.size < MAX_BUCKETS) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    // Still full of live windows (an attack): start over rather than grow
    if (this.buckets.size >= MAX_BUCKETS) this.buckets.clear();
  }
}
