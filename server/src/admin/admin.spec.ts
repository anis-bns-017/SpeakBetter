import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertNotSuspended, isPermanentSuspension, isSuspended, PERMANENT_SUSPENSION, suspensionMessage } from '../common/suspension';
import { adminEmailsFrom } from './admin-bootstrap.service';
import { AdminUsersService } from './admin-users.service';
import { hasRole, permissionsFor, type Actor } from './admin.roles';

const ADMIN: Actor = { id: 'admin1', name: 'Ada', role: 'ADMIN' };
const MOD: Actor = { id: 'mod1', name: 'Mo', role: 'MODERATOR' };

describe('roles', () => {
  it('ranks roles and lists what each may do', () => {
    expect(hasRole('ADMIN', 'MODERATOR')).toBe(true);
    expect(hasRole('MODERATOR', 'ADMIN')).toBe(false);
    expect(hasRole('USER', 'MODERATOR')).toBe(false);
    expect(hasRole(undefined, 'MODERATOR')).toBe(false);
    expect(permissionsFor('USER')).toEqual([]);
    expect(permissionsFor('MODERATOR')).toContain('reports');
    expect(permissionsFor('MODERATOR')).not.toContain('users.delete');
    expect(permissionsFor('ADMIN')).toContain('system');
  });

  it('reads ADMIN_EMAILS', () => {
    expect(adminEmailsFrom(' A@x.com, b@y.org ,nope,, a@x.com')).toEqual(['a@x.com', 'b@y.org']);
    expect(adminEmailsFrom(undefined)).toEqual([]);
  });
});

describe('suspension', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  it('knows when an account is suspended and says why', () => {
    expect(isSuspended({ suspendedUntil: null }, now)).toBe(false);
    expect(isSuspended({ suspendedUntil: new Date('2026-11-10T00:00:00Z') }, now)).toBe(false);
    expect(isSuspended({ suspendedUntil: new Date('2026-11-12T00:00:00Z') }, now)).toBe(true);
    expect(isPermanentSuspension(PERMANENT_SUSPENSION)).toBe(true);
    expect(suspensionMessage({ suspendedUntil: PERMANENT_SUSPENSION, suspensionReason: 'spam' })).toBe(
      'Your account has been closed by our moderators. Reason: spam',
    );
    expect(() => assertNotSuspended({ suspendedUntil: PERMANENT_SUSPENSION })).toThrow(ForbiddenException);
    expect(() => assertNotSuspended({ suspendedUntil: null })).not.toThrow();
  });
});

function setup(users: Record<string, { id: string; name: string; role: string; suspendedUntil?: Date | null; email?: string }>) {
  const audit = { record: jest.fn(), forTarget: jest.fn().mockResolvedValue([]) };
  const auth = { logoutAll: jest.fn().mockResolvedValue({ success: true, revokedFamilies: 2 }) };
  const notifications = { notify: jest.fn().mockResolvedValue(1) };
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }) => {
        const u = users[where.id];
        return u ? { suspendedUntil: null, email: `${u.id}@example.test`, createdAt: new Date(), ...u } : null;
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(users[where.id], data)),
      count: jest.fn(async ({ where }) => Object.values(users).filter((u) => u.role === where.role).length),
      delete: jest.fn(async ({ where }) => delete users[where.id]),
    },
    moderationLog: { create: jest.fn() },
    subscription: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
  };
  const service = new AdminUsersService(prisma, audit as any, auth as any, notifications as any);
  return { service, prisma, audit, auth, notifications, users };
}

describe('AdminUsersService', () => {
  it('suspends a user, ends their sessions and logs it', async () => {
    const { service, users, auth, audit, prisma } = setup({ u1: { id: 'u1', name: 'Sam', role: 'USER' } });
    const result = await service.suspend(MOD, 'u1', { days: 7, reason: 'spam in chat' });
    expect(users.u1.suspendedUntil!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(result.suspendedUntil).toEqual(users.u1.suspendedUntil);
    expect(auth.logoutAll).toHaveBeenCalledWith('u1', 'suspended');
    expect(prisma.moderationLog.create).toHaveBeenCalled();
    expect(audit.record.mock.calls[0][1]).toMatchObject({ action: 'user.suspend', targetId: 'u1' });
  });

  it('keeps moderators within their limits', async () => {
    const { service } = setup({ u1: { id: 'u1', name: 'Sam', role: 'USER' }, m2: { id: 'm2', name: 'Other mod', role: 'MODERATOR' } });
    await expect(service.suspend(MOD, 'u1', { days: 31, reason: 'too long' })).rejects.toThrow(ForbiddenException);
    await expect(service.suspend(MOD, 'u1', { permanent: true, reason: 'forever' })).rejects.toThrow(ForbiddenException);
    await expect(service.suspend(MOD, 'm2', { days: 1, reason: 'other mod' })).rejects.toThrow(ForbiddenException);
    await expect(service.suspend(MOD, 'mod1', { days: 1, reason: 'myself' })).rejects.toThrow(BadRequestException);
    await expect(service.suspend(MOD, 'u1', { days: 1, reason: 'x' })).rejects.toThrow(BadRequestException);
  });

  it('never suspends an admin, and lets only admins close accounts for good', async () => {
    const { service, users } = setup({ a2: { id: 'a2', name: 'Other admin', role: 'ADMIN' }, u1: { id: 'u1', name: 'Sam', role: 'USER' } });
    await expect(service.suspend(ADMIN, 'a2', { days: 1, reason: 'admins are safe' })).rejects.toThrow(ForbiddenException);
    await service.suspend(ADMIN, 'u1', { permanent: true, reason: 'repeated harassment' });
    expect(isPermanentSuspension(users.u1.suspendedUntil)).toBe(true);
    await expect(service.unsuspend(MOD, 'u1')).rejects.toThrow(ForbiddenException);
    await service.unsuspend(ADMIN, 'u1', 'appeal accepted');
    expect(users.u1.suspendedUntil).toBeNull();
  });

  it('changes roles safely: admins only, not your own, never the last admin', async () => {
    const { service, users } = setup({ admin1: { id: 'admin1', name: 'Ada', role: 'ADMIN' }, u1: { id: 'u1', name: 'Sam', role: 'USER' } });
    await expect(service.setRole(MOD, 'u1', 'MODERATOR')).rejects.toThrow(ForbiddenException);
    await expect(service.setRole(ADMIN, 'admin1', 'USER')).rejects.toThrow(BadRequestException);
    await service.setRole(ADMIN, 'u1', 'ADMIN');
    expect(users.u1.role).toBe('ADMIN');
    await service.setRole({ ...ADMIN, id: 'u1' }, 'admin1', 'USER');
    expect(users.admin1.role).toBe('USER');
    await expect(service.setRole({ ...ADMIN, id: 'x' }, 'u1', 'USER')).rejects.toThrow('at least one admin');
  });

  it('deletes an account only when its email is typed back', async () => {
    const { service, users, prisma } = setup({ u1: { id: 'u1', name: 'Sam', role: 'USER' } });
    await expect(service.remove(ADMIN, 'u1', 'wrong@example.test', 'spam account')).rejects.toThrow(BadRequestException);
    await service.remove(ADMIN, 'u1', 'U1@example.test', 'spam account');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(users.u1).toBeUndefined();
  });

  it('gives Pro on top of any Pro time left', async () => {
    const { service, prisma } = setup({ u1: { id: 'u1', name: 'Sam', role: 'USER' } });
    const later = new Date(Date.now() + 10 * 86_400_000);
    prisma.subscription.findUnique.mockResolvedValueOnce({ plan: 'PRO', endDate: later });
    const { endDate } = await service.grantPro(ADMIN, 'u1', { days: 30 });
    expect(endDate.getTime()).toBe(later.getTime() + 30 * 86_400_000);
    await expect(service.grantPro(MOD, 'u1', { days: 30 })).rejects.toThrow(ForbiddenException);
  });
});
