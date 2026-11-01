import { Inject, Injectable, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.module';
import { QueueEntry } from './matching';

const ENTRIES_KEY = 'sb:rc:entries';
const ORDER_KEY = 'sb:rc:queue';

/**
 * The people waiting for a random call. In memory for one server; with
 * REALTIME_REDIS_URL it lives in Redis so every instance sees one queue.
 *
 * `claim` is the important operation: it removes someone and says whether
 * *this* caller was the one who removed them, so two instances can never pair
 * the same person twice.
 */
@Injectable()
export class MatchQueue {
  private readonly entries = new Map<string, QueueEntry>();

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis | null,
  ) {}

  async add(entry: QueueEntry): Promise<void> {
    if (this.redis) {
      await this.redis
        .multi()
        .hset(ENTRIES_KEY, entry.userId, JSON.stringify(entry))
        .zadd(ORDER_KEY, String(entry.joinedAt), entry.userId)
        .exec();
      return;
    }
    this.entries.set(entry.userId, entry);
  }

  async has(userId: string): Promise<boolean> {
    if (this.redis) return (await this.redis.zscore(ORDER_KEY, userId)) !== null;
    return this.entries.has(userId);
  }

  async list(): Promise<QueueEntry[]> {
    if (this.redis) {
      const ids = await this.redis.zrange(ORDER_KEY, 0, -1);
      if (ids.length === 0) return [];
      const raw = await this.redis.hmget(ENTRIES_KEY, ...ids);
      const entries: QueueEntry[] = [];
      for (const item of raw) {
        if (!item) continue;
        try {
          entries.push(JSON.parse(item) as QueueEntry);
        } catch {
          // a corrupt entry is dropped by the next claim/cleanup
        }
      }
      return entries;
    }
    return [...this.entries.values()];
  }

  async size(): Promise<number> {
    if (this.redis) return this.redis.zcard(ORDER_KEY);
    return this.entries.size;
  }

  /** Removes the person; true only for the caller that actually removed them */
  async claim(userId: string): Promise<boolean> {
    if (this.redis) {
      const removed = await this.redis.zrem(ORDER_KEY, userId);
      if (removed === 1) await this.redis.hdel(ENTRIES_KEY, userId);
      return removed === 1;
    }
    return this.entries.delete(userId);
  }
}
