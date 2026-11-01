import { Inject, Injectable, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis.module';

/** Room membership entries expire if a crashed instance never cleaned them up */
const ROOM_TTL_SECONDS = 12 * 60 * 60;

/**
 * Who is in each voice room and who hosts it. With REALTIME_REDIS_URL this lives in
 * Redis so every server instance agrees; without it, it is an in-memory map
 * (rebuilt as clients reconnect). The rest is tied to a socket on this
 * instance and stays local. Shared by the voice gateways.
 */
@Injectable()
export class VoiceRoomState {
  private readonly participants = new Map<string, Set<string>>();
  private readonly hosts = new Map<string, string>();

  /** userId -> display name of this instance's connected sockets */
  readonly userNames = new Map<string, string>();
  /** `${roomId}:${userId}` -> timer that removes someone whose connection dropped */
  readonly pendingLeaves = new Map<string, NodeJS.Timeout>();
  /** `${roomId}:${userId}` -> when their current speaking turn started (ms) */
  readonly speakingSince = new Map<string, number>();
  /** roomId -> timer for the next airtime update (batches bursts of speaking turns) */
  readonly airtimeTimers = new Map<string, NodeJS.Timeout>();

  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis | null) {}

  private pKey = (roomId: string) => `sb:voice:room:${roomId}:members`;
  private hKey = (roomId: string) => `sb:voice:room:${roomId}:host`;

  async hasRoom(roomId: string): Promise<boolean> {
    if (this.redis) return (await this.redis.scard(this.pKey(roomId))) > 0;
    return this.participants.has(roomId);
  }

  async participantIds(roomId: string): Promise<string[]> {
    if (this.redis) return this.redis.smembers(this.pKey(roomId));
    return Array.from(this.participants.get(roomId) ?? []);
  }

  async isInRoom(roomId: string, userId: string): Promise<boolean> {
    if (this.redis) return (await this.redis.sismember(this.pKey(roomId), userId)) === 1;
    return this.participants.get(roomId)?.has(userId) ?? false;
  }

  async addParticipant(roomId: string, userId: string): Promise<void> {
    if (this.redis) {
      await this.redis.multi().sadd(this.pKey(roomId), userId).expire(this.pKey(roomId), ROOM_TTL_SECONDS).exec();
      return;
    }
    if (!this.participants.has(roomId)) this.participants.set(roomId, new Set());
    this.participants.get(roomId)!.add(userId);
  }

  /**
   * Takes someone out of the room. `wasPresent` is false when they were not
   * in it; `remaining` are the people left (the host entry is dropped once
   * the room is empty).
   */
  async removeParticipant(
    roomId: string,
    userId: string,
  ): Promise<{ wasPresent: boolean; remaining: string[] }> {
    if (this.redis) {
      const removed = await this.redis.srem(this.pKey(roomId), userId);
      const remaining = await this.redis.smembers(this.pKey(roomId));
      if (remaining.length === 0) await this.redis.del(this.hKey(roomId));
      return { wasPresent: removed === 1, remaining };
    }
    const set = this.participants.get(roomId);
    const wasPresent = set?.delete(userId) ?? false;
    const remaining = Array.from(set ?? []);
    if (set && set.size === 0) {
      this.participants.delete(roomId);
      this.hosts.delete(roomId);
    }
    return { wasPresent, remaining };
  }

  async getHost(roomId: string): Promise<string | undefined> {
    if (this.redis) return (await this.redis.get(this.hKey(roomId))) ?? undefined;
    return this.hosts.get(roomId);
  }

  async setHost(roomId: string, userId: string): Promise<void> {
    if (this.redis) {
      await this.redis.set(this.hKey(roomId), userId, 'EX', ROOM_TTL_SECONDS);
      return;
    }
    this.hosts.set(roomId, userId);
  }

  /** Sets the host only if the room has none yet (the first person in decides) */
  async setHostIfAbsent(roomId: string, userId: string): Promise<void> {
    if (this.redis) {
      await this.redis.set(this.hKey(roomId), userId, 'EX', ROOM_TTL_SECONDS, 'NX');
      return;
    }
    if (!this.hosts.has(roomId)) this.hosts.set(roomId, userId);
  }
}
