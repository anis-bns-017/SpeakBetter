import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

const MINUTE_MS = 60_000;
const FIRST_RUN_DELAY_MS = MINUTE_MS;

/**
 * Deletes expired sessions in the background.
 *
 * Every instance runs this timer, which is safe: AuthService.pruneSessions()
 * takes a transaction-scoped Postgres advisory lock, so while one instance is
 * pruning the others return at once ("skipped") instead of doing duplicate
 * work. A run is never started while the previous one on this instance is
 * still going, and each wait is jittered so instances do not fire together.
 *
 *   AUTH_SESSION_PRUNE_ENABLED           "false" turns it off (default on)
 *   AUTH_SESSION_PRUNE_INTERVAL_MINUTES  default 60
 */
@Injectable()
export class SessionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Under jest the timer would keep the process alive and touch the database
    if (
      process.env.NODE_ENV === 'test' ||
      this.config.get('AUTH_SESSION_PRUNE_ENABLED') === 'false'
    ) {
      return;
    }
    this.schedule(FIRST_RUN_DELAY_MS);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** One pass. Public so it can be triggered directly (and tested). */
  async runOnce() {
    if (this.running) return null;
    this.running = true;
    try {
      const result = await this.auth.pruneSessions();
      if (result.skipped) {
        this.logger.debug(
          'Session prune skipped: another instance is running it',
        );
      } else if (result.deleted > 0) {
        this.logger.log(`Pruned ${result.deleted} expired session(s)`);
      }
      return result;
    } catch (error: any) {
      // Retried at the next interval; a failed prune never affects logins
      this.logger.error(`Session prune failed: ${error?.message || error}`);
      return null;
    } finally {
      this.running = false;
    }
  }

  private intervalMs() {
    const minutes = Number(
      this.config.get('AUTH_SESSION_PRUNE_INTERVAL_MINUTES'),
    );
    return (
      (Number.isFinite(minutes) && minutes >= 1 ? minutes : 60) * MINUTE_MS
    );
  }

  private schedule(delayMs: number) {
    if (this.stopped) return;
    const jitter = 1 + (Math.random() - 0.5) * 0.2; // ±10%
    this.timer = setTimeout(
      () => {
        void this.runOnce().finally(() => this.schedule(this.intervalMs()));
      },
      Math.round(delayMs * jitter),
    );
    // Never the reason the process stays up
    this.timer.unref?.();
  }
}
