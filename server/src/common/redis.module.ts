import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Injection token for the shared Redis client (null when REALTIME_REDIS_URL is not set) */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * One optional Redis connection for state that must be shared between server
 * instances (who is in a voice room, socket.io fan-out). Without REALTIME_REDIS_URL the
 * app runs exactly as a single instance with everything in memory.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>('REALTIME_REDIS_URL');
        if (!url) return null;
        const logger = new Logger('Redis');
        const client = new Redis(url, { maxRetriesPerRequest: 3 });
        client.on('error', (error) => logger.warn(`Redis error: ${error.message}`));
        client.on('ready', () => logger.log('Redis connected'));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
