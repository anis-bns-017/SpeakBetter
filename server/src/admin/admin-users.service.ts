// server/src/admin/admin-users.service.ts
// Everyone's account, for the team: search, a full picture of one person, and what can be done to an account.
// Rules that keep this safe:
//   - nobody acts on their own account (no self-suspension, self-demotion or self-deletion)
//   - moderators act on normal users only, and suspend for at most 30 days
//   - admins can act on moderators; another admin can only be demoted, never suspended or deleted, and the last
//     admin can't be demoted
// Every action goes to the audit log; warnings and suspensions also go to the older ModerationLog table.

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isPermanentSuspension, isSuspended, PERMANENT_SUSPENSION } from '../common/suspension';
import { AdminAuditService } from './admin-audit.service';
import { MODERATOR_MAX_SUSPENSION_DAYS, type Actor, type PlatformRoleName } from './admin.roles';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 25;
const MAX_REASON = 300;
const MAX_PRO_DAYS = 3650;

export type UserStatusFilter = 'all' | 'active' | 'suspended' | 'new' | 'staff';
export type UserSort = 'newest' | 'oldest' | 'active' | 'xp' | 'name';

const cleanReason = (value: unknown, what = 'a reason') => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_REASON) : '';
  if (text.length < 3) throw new BadRequestException(`Write ${what} (at least 3 characters)`);
  return text;
};

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AdminAuditService,
    private auth: AuthService,
    private notifications: NotificationsService,
  ) {}

  // ---------------- reading ----------------

  async list(query: { q?: string; status?: string; role?: string; sort?: string; page?: number }) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const now = new Date();
    const q = (query.q ?? '').trim().slice(0, 80);
    const status = (query.status ?? 'all') as UserStatusFilter;
    const sort = (query.sort ?? 'newest') as UserSort;

    const where: Prisma.UserWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { id: q },
            ],
          }
        : {}),
      ...(query.role && ['USER', 'MODERATOR', 'ADMIN'].includes(query.role) ? { role: query.role as PlatformRoleName } : {}),
      ...(status === 'suspended' ? { suspendedUntil: { gt: now } } : {}),
      ...(status === 'active' ? { profile: { lastActive: { gte: new Date(now.getTime() - 7 * DAY_MS) } } } : {}),
      ...(status === 'new' ? { createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } : {}),
      ...(status === 'staff' ? { role: { in: ['MODERATOR', 'ADMIN'] as PlatformRoleName[] } } : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput =
      sort === 'oldest'
        ? { createdAt: 'asc' }
        : sort === 'active'
          ? { profile: { lastActive: 'desc' } }
          : sort === 'xp'
            ? { profile: { xp: 'desc' } }
            : sort === 'name'
              ? { name: 'asc' }
              : { createdAt: 'desc' };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          suspendedUntil: true,
          googleId: true,
          profile: { select: { lastActive: true, xp: true, level: true, country: true } },
          subscriptions: { select: { plan: true, status: true, endDate: true }, take: 1 },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const ids = rows.map((r) => r.id);
    const [appReports, callReports] = ids.length
      ? await Promise.all([
          this.prisma.report.groupBy({ by: ['targetId'], where: { targetType: 'USER', targetId: { in: ids } }, _count: { _all: true } }),
          this.prisma.randomCallReport.groupBy({ by: ['reportedId'], where: { reportedId: { in: ids } }, _count: { _all: true } }),
        ])
      : [[], []];
    const reports = new Map<string, number>();
    for (const r of appReports) reports.set(r.targetId, (reports.get(r.targetId) ?? 0) + r._count._all);
    for (const r of callReports) reports.set(r.reportedId, (reports.get(r.reportedId) ?? 0) + r._count._all);

    return {
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      total,
      items: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        role: u.role,
        createdAt: u.createdAt,
        lastActive: u.profile?.lastActive ?? null,
        xp: u.profile?.xp ?? 0,
        level: u.profile?.level ?? null,
        country: u.profile?.country ?? null,
        signIn: u.googleId ? 'google' : 'password',
        plan: this.planOf(u.subscriptions[0]),
        suspended: isSuspended(u, now),
        suspendedUntil: u.suspendedUntil,
        reportsAgainst: reports.get(u.id) ?? 0,
      })),
    };
  }

  async get(id: string) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        subscriptions: { take: 1 },
        randomCallProfile: { select: { restrictedUntil: true, permanentlyBanned: true, restrictionCount: true, restrictionReason: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const [
      xpTotal,
      xp30,
      messages,
      rooms,
      flashcards,
      friends,
      sessions,
      appReportsAgainst,
      callReportsAgainst,
      reportsMade,
      history,
      payments,
    ] = await Promise.all([
      this.prisma.xpTransaction.aggregate({ where: { userId: id }, _sum: { amount: true } }),
      this.prisma.xpTransaction.aggregate({ where: { userId: id, createdAt: { gte: since30 } }, _sum: { amount: true } }),
      this.prisma.message.count({ where: { senderId: id } }),
      this.prisma.voiceParticipant.count({ where: { userId: id } }),
      this.prisma.flashcard.count({ where: { userId: id } }),
      this.prisma.friend.count({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
      this.prisma.session.findMany({
        where: { userId: id, revokedAt: null, rotatedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, createdAt: true, lastUsedAt: true, ip: true, userAgent: true, expiresAt: true },
      }),
      this.prisma.report.findMany({
        where: { targetType: 'USER', targetId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { reportedBy: { select: { id: true, name: true } } },
      }),
      this.prisma.randomCallReport.findMany({
        where: { reportedId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { reporter: { select: { id: true, name: true } } },
      }),
      this.prisma.report.count({ where: { reportedById: id } }),
      this.audit.forTarget(id, 25),
      this.prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);

    const { passwordHash: _secret, subscriptions, randomCallProfile, profile, ...account } = user;
    return {
      ...account,
      signIn: user.googleId ? 'google' : 'password',
      suspended: isSuspended(user, now),
      permanent: isPermanentSuspension(user.suspendedUntil),
      profile: profile
        ? {
            level: profile.level,
            xp: profile.xp,
            country: profile.country,
            nativeLanguage: profile.nativeLanguage,
            lastActive: profile.lastActive,
          }
        : null,
      plan: this.planOf(subscriptions[0]),
      subscription: subscriptions[0] ?? null,
      randomCall: randomCallProfile,
      stats: {
        xpTotal: xpTotal._sum.amount ?? 0,
        xp30: xp30._sum.amount ?? 0,
        messages,
        rooms,
        flashcards,
        friends,
        reportsMade,
      },
      sessions,
      reportsAgainst: [
        ...appReportsAgainst.map((r) => ({
          id: r.id,
          source: 'app' as const,
          reason: r.reason,
          details: r.description,
          status: r.status,
          createdAt: r.createdAt,
          reporter: r.reportedBy,
        })),
        ...callReportsAgainst.map((r) => ({
          id: r.id,
          source: 'random-call' as const,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt,
          reporter: r.reporter,
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      payments,
      history,
    };
  }

  // ---------------- actions ----------------

  async warn(actor: Actor, id: string, message: unknown) {
    const target = await this.target(actor, id, 'warn');
    const text = cleanReason(message, 'the message');
    await this.notifications.notify([id], {
      type: 'SYSTEM',
      title: 'A message from the SpeakBetter team',
      message: text,
      data: { kind: 'moderation-warning' },
    });
    await this.moderationLog(actor, id, 'WARN', text);
    await this.audit.record(actor, {
      action: 'user.warn',
      targetType: 'user',
      targetId: id,
      summary: `Warned ${target.name}: ${text}`,
    });
    return { ok: true };
  }

  async suspend(actor: Actor, id: string, input: { days?: unknown; permanent?: unknown; reason?: unknown }) {
    const target = await this.target(actor, id, 'suspend');
    if (target.role === 'ADMIN') throw new ForbiddenException('Admins can’t be suspended. Change their role first.');
    const reason = cleanReason(input.reason);
    const permanent = input.permanent === true;
    const days = Math.floor(Number(input.days));
    if (!permanent && !(days >= 1 && days <= 3650)) throw new BadRequestException('Choose how many days (1 or more)');
    if (actor.role !== 'ADMIN' && (permanent || days > MODERATOR_MAX_SUSPENSION_DAYS)) {
      throw new ForbiddenException(`Moderators can suspend for up to ${MODERATOR_MAX_SUSPENSION_DAYS} days`);
    }
    const until = permanent ? PERMANENT_SUSPENSION : new Date(Date.now() + days * DAY_MS);

    await this.prisma.user.update({ where: { id }, data: { suspendedUntil: until, suspensionReason: reason } });
    // Every open session ends now (sockets included), not when its token runs out
    await this.auth.logoutAll(id, 'suspended');
    await this.moderationLog(actor, id, permanent ? 'BAN' : 'SUSPEND', reason);
    await this.audit.record(actor, {
      action: permanent ? 'user.ban' : 'user.suspend',
      targetType: 'user',
      targetId: id,
      summary: permanent ? `Closed ${target.name}'s account: ${reason}` : `Suspended ${target.name} for ${days} day${days === 1 ? '' : 's'}: ${reason}`,
      details: { until: until.toISOString(), days: permanent ? null : days, reason },
    });
    return { ok: true, suspendedUntil: until };
  }

  async unsuspend(actor: Actor, id: string, note?: unknown) {
    const target = await this.target(actor, id, 'unsuspend');
    if (!target.suspendedUntil) throw new BadRequestException('This account is not suspended');
    if (isPermanentSuspension(target.suspendedUntil) && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only an admin can reopen a closed account');
    }
    await this.prisma.user.update({ where: { id }, data: { suspendedUntil: null, suspensionReason: null } });
    const why = typeof note === 'string' && note.trim() ? `: ${note.trim().slice(0, MAX_REASON)}` : '';
    await this.audit.record(actor, { action: 'user.unsuspend', targetType: 'user', targetId: id, summary: `Lifted ${target.name}'s suspension${why}` });
    return { ok: true };
  }

  async signOut(actor: Actor, id: string) {
    const target = await this.target(actor, id, 'sign out');
    const result = await this.auth.logoutAll(id, 'signed_out_by_admin');
    await this.audit.record(actor, {
      action: 'user.signout',
      targetType: 'user',
      targetId: id,
      summary: `Signed ${target.name} out everywhere (${result.revokedFamilies} session${result.revokedFamilies === 1 ? '' : 's'})`,
    });
    return { ok: true, sessions: result.revokedFamilies };
  }

  async setRole(actor: Actor, id: string, role: unknown) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Only admins can change roles');
    if (id === actor.id) throw new BadRequestException('You can’t change your own role');
    if (!['USER', 'MODERATOR', 'ADMIN'].includes(String(role))) throw new BadRequestException('Unknown role');
    const next = role as PlatformRoleName;
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, suspendedUntil: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === next) return { ok: true, role: next };
    if (next !== 'USER' && isSuspended(target)) throw new BadRequestException('Lift the suspension before giving this person a team role');
    if (target.role === 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw new BadRequestException('There must always be at least one admin');
    }
    await this.prisma.user.update({ where: { id }, data: { role: next } });
    await this.audit.record(actor, {
      action: 'user.role',
      targetType: 'user',
      targetId: id,
      summary: `Changed ${target.name}'s role from ${target.role.toLowerCase()} to ${next.toLowerCase()}`,
      details: { from: target.role, to: next },
    });
    return { ok: true, role: next };
  }

  /** Gives Pro for `days` (added to any Pro time they already have). No payment is made. */
  async grantPro(actor: Actor, id: string, input: { days?: unknown; note?: unknown }) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Only admins can give Pro');
    const days = Math.floor(Number(input.days));
    if (!(days >= 1 && days <= MAX_PRO_DAYS)) throw new BadRequestException('Choose how many days of Pro (1 or more)');
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!target) throw new NotFoundException('User not found');

    const now = new Date();
    const current = await this.prisma.subscription.findUnique({ where: { userId: id } });
    const base = current?.plan === 'PRO' && current.endDate && current.endDate > now ? current.endDate : now;
    const endDate = new Date(base.getTime() + days * DAY_MS);
    await this.prisma.subscription.upsert({
      where: { userId: id },
      create: { userId: id, plan: 'PRO', status: 'ACTIVE', startDate: now, endDate, provider: 'admin', cancelAtPeriodEnd: true },
      update: { plan: 'PRO', status: 'ACTIVE', endDate, provider: 'admin', cancelAtPeriodEnd: true, canceledAt: null },
    });
    const note = typeof input.note === 'string' && input.note.trim() ? `: ${input.note.trim().slice(0, MAX_REASON)}` : '';
    await this.audit.record(actor, {
      action: 'user.pro',
      targetType: 'user',
      targetId: id,
      summary: `Gave ${target.name} ${days} day${days === 1 ? '' : 's'} of Pro${note}`,
      details: { days, endDate: endDate.toISOString() },
    });
    await this.notifications.notify([id], {
      type: 'SYSTEM',
      title: 'You have SpeakBetter Pro',
      message: `The SpeakBetter team gave you ${days} day${days === 1 ? '' : 's'} of Pro. Enjoy!`,
      actionUrl: '/premium',
    });
    return { ok: true, endDate };
  }

  /** Deletes the account and everything it owns. The email must be typed again to confirm. */
  async remove(actor: Actor, id: string, confirmEmail: unknown, reason: unknown) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Only admins can delete accounts');
    if (id === actor.id) throw new BadRequestException('You can’t delete your own account here');
    const why = cleanReason(reason);
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'ADMIN') throw new ForbiddenException('Admins can’t be deleted. Change their role first.');
    if (typeof confirmEmail !== 'string' || confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
      throw new BadRequestException('Type the account’s email address to confirm');
    }
    await this.auth.logoutAll(id, 'deleted_by_admin');
    await this.prisma.user.delete({ where: { id } });
    await this.audit.record(actor, {
      action: 'user.delete',
      targetType: 'user',
      targetId: id,
      summary: `Deleted ${target.name}'s account (${target.email}): ${why}`,
      details: { email: target.email, name: target.name, joined: target.createdAt.toISOString(), reason: why },
    });
    return { ok: true };
  }

  // ---------------- helpers ----------------

  /** The account to act on, after checking the actor may act on it */
  private async target(actor: Actor, id: string, verb: string) {
    if (id === actor.id) throw new BadRequestException(`You can’t ${verb} your own account`);
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, suspendedUntil: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (actor.role !== 'ADMIN' && target.role !== 'USER') throw new ForbiddenException('Moderators can only act on normal accounts');
    return target;
  }

  private async moderationLog(actor: Actor, targetId: string, action: 'WARN' | 'SUSPEND' | 'BAN', reason: string) {
    try {
      await this.prisma.moderationLog.create({ data: { moderatorId: actor.id, targetId, action, reason } });
    } catch {
      /* the audit log has it too */
    }
  }

  private planOf(sub?: { plan: string; status: string; endDate: Date | null } | null): 'FREE' | 'PRO' {
    if (!sub || sub.plan === 'FREE') return 'FREE';
    if (sub.endDate && sub.endDate.getTime() <= Date.now()) return 'FREE';
    return sub.status === 'ACTIVE' || sub.status === 'TRIALING' ? 'PRO' : 'FREE';
  }
}
