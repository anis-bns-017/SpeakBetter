// server/src/admin/admin-bootstrap.service.ts
// The first admins: every account whose email is in ADMIN_EMAILS (comma-separated, in server/.env) is made an
// admin when the server starts. After that, admins can promote others from the admin section. Removing an email
// from the list does not demote anyone; use the admin section for that.

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

export const adminEmailsFrom = (value: string | undefined): string[] =>
  [...new Set((value ?? '').split(',').map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))];

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const emails = adminEmailsFrom(this.config.get<string>('ADMIN_EMAILS'));
    if (!emails.length) return;
    try {
      const promoted = await this.prisma.user.updateMany({
        where: { email: { in: emails, mode: 'insensitive' }, role: { not: 'ADMIN' } },
        data: { role: 'ADMIN' },
      });
      if (promoted.count) this.logger.log(`Made ${promoted.count} account(s) admin from ADMIN_EMAILS`);
    } catch (error) {
      this.logger.warn(`Could not apply ADMIN_EMAILS: ${(error as Error)?.message}`);
    }
  }
}
