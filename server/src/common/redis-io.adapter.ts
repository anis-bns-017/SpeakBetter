import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

/**
 * socket.io over Redis pub/sub: room broadcasts, fetchSockets() and
 * socketsLeave() then reach clients connected to any server instance.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly adapterFactory: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication, redis: Redis) {
    super(app);
    const pub = redis.duplicate();
    const sub = redis.duplicate();
    // a failing connection is reported by the shared client; don't crash on these
    pub.on('error', () => undefined);
    sub.on('error', () => undefined);
    this.adapterFactory = createAdapter(pub, sub);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterFactory);
    return server;
  }
}
