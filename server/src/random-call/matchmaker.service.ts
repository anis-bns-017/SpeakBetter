import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MatchQueue } from './match-queue';
import { findPairs } from './matching';
import { RandomCallBroadcaster } from './random-call.broadcaster';
import { RandomCallService } from './random-call.service';
import { Goal, Level, QUEUE_TIMEOUT_MS } from './random-call.constants';

const TICK_MS = 2000;
/** Overdue-call sweep and "N people waiting" updates run every few ticks */
const SWEEP_EVERY_TICKS = 3;

/**
 * Pairs people waiting for a random call. Every instance runs this loop; the
 * queue's atomic `claim` makes sure a person is only ever paired once.
 */
@Injectable()
export class MatchmakerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchmakerService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private tickCount = 0;

  constructor(
    private readonly queue: MatchQueue,
    private readonly calls: RandomCallService,
    private readonly broadcaster: RandomCallBroadcaster,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async join(userId: string, prefs: { level: Level; goal: Goal; language: string }) {
    await this.calls.assertEligible(userId);
    const entry = await this.calls.buildEntry(userId, prefs);
    // joining again (new level / goal) replaces the old place in the queue
    await this.queue.claim(userId);
    await this.queue.add(entry);
    this.broadcaster.emitToUser(userId, 'rc:queued', { waiting: await this.queue.size() });
    await this.tick();
  }

  leave(userId: string) {
    return this.queue.claim(userId);
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      this.tickCount++;
      const now = Date.now();
      let entries = await this.queue.list();

      // Nobody found in time: free the place and let the client offer alternatives
      for (const entry of entries) {
        if (now - entry.joinedAt > QUEUE_TIMEOUT_MS && (await this.queue.claim(entry.userId))) {
          this.broadcaster.emitToUser(entry.userId, 'rc:timeout', {
            waitedSeconds: Math.round((now - entry.joinedAt) / 1000),
          });
        }
      }
      entries = entries.filter((e) => now - e.joinedAt <= QUEUE_TIMEOUT_MS);

      for (const [a, b] of findPairs(entries, now)) {
        if (!(await this.queue.claim(a.userId))) continue;
        if (!(await this.queue.claim(b.userId))) {
          await this.queue.add(a); // someone else took b: a keeps waiting
          continue;
        }
        try {
          await this.calls.createCall(a, b);
        } catch (error) {
          this.logger.error(`Could not start a call: ${(error as Error).message}`);
        }
      }

      if (this.tickCount % SWEEP_EVERY_TICKS === 0) {
        await this.calls.endOverdueCalls();
        const remaining = await this.queue.list();
        for (const entry of remaining) {
          this.broadcaster.emitToUser(entry.userId, 'rc:queued', { waiting: remaining.length });
        }
      }
    } catch (error) {
      this.logger.error(`Matchmaking tick failed: ${(error as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }
}
