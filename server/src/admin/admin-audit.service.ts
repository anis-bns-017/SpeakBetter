// server/src/admin/admin-audit.service.ts
// The admin audit log: one line for every action taken in the admin section. Writing never throws (a logging
// problem must not undo a moderation decision), and nothing ever edits or deletes a line.

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { Actor } from './admin.roles';

export interface AuditEntry {
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

const PAGE = 40;

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private prisma: PrismaService) {}

  async record(actor: Actor, entry: AuditEntry) {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.name,
          action: entry.action,
          summary: entry.summary.slice(0, 500),
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Could not write the audit log (${entry.action}): ${(error as Error)?.message}`);
    }
  }

  async list(query: { action?: string; actorId?: string; targetId?: string; q?: string; page?: number }) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.q ? { summary: { contains: query.q.slice(0, 80), mode: 'insensitive' } } : {}),
    };
    const [items, total, actions] = await Promise.all([
      this.prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE }),
      this.prisma.adminAuditLog.count({ where }),
      this.prisma.adminAuditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { action: 'asc' } }),
    ]);
    return {
      items,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      total,
      actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
    };
  }

  /** The latest lines about one thing (a user's history on their page) */
  forTarget(targetId: string, take = 20) {
    return this.prisma.adminAuditLog.findMany({ where: { targetId }, orderBy: { createdAt: 'desc' }, take });
  }
}
