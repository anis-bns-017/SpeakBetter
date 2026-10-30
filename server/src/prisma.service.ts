import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Kept as a field so it can be closed on shutdown. $disconnect() only
  // detaches Prisma — it does not end a pool that we created ourselves.
  private readonly pool: Pool;

  constructor() {
    // Create a PostgreSQL connection pool using the DATABASE_URL
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    // Create the Prisma adapter
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}