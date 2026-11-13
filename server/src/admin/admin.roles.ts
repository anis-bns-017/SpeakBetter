// server/src/admin/admin.roles.ts
// Who may do what in the admin section. Two roles above a normal user:
//   MODERATOR: keeps the community safe (reports, users, rooms, communities, messages; suspensions up to 30 days)
//   ADMIN:     everything, plus roles, Pro, account deletion, announcements, billing and system health
// Every admin route needs a signed-in user (JwtAuthGuard) and AdminGuard, which reads @RequireRole (MODERATOR if
// not set).

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type PlatformRoleName = 'USER' | 'MODERATOR' | 'ADMIN';
export type StaffRole = Exclude<PlatformRoleName, 'USER'>;

const RANK: Record<PlatformRoleName, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

export const hasRole = (role: unknown, needed: StaffRole): boolean =>
  typeof role === 'string' && role in RANK && RANK[role as PlatformRoleName] >= RANK[needed];

export const isStaff = (role: unknown): role is StaffRole => hasRole(role, 'MODERATOR');

/** Moderators can suspend for at most this long; longer and permanent suspensions are for admins */
export const MODERATOR_MAX_SUSPENSION_DAYS = 30;

export const PERMISSIONS = [
  'overview',
  'users.view',
  'users.warn',
  'users.suspend',
  'users.signout',
  'users.role',
  'users.pro',
  'users.delete',
  'reports',
  'content',
  'audit',
  'billing',
  'broadcast',
  'system',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_ONLY = new Set<Permission>(['users.role', 'users.pro', 'users.delete', 'billing', 'broadcast', 'system']);

/** What a role may do, for the web app to show or hide controls (the server checks each route itself) */
export function permissionsFor(role: unknown): Permission[] {
  if (!isStaff(role)) return [];
  return PERMISSIONS.filter((p) => role === 'ADMIN' || !ADMIN_ONLY.has(p));
}

export const ADMIN_ROLE_KEY = 'adminRole';
export const RequireRole = (role: StaffRole) => SetMetadata(ADMIN_ROLE_KEY, role);

/** The signed-in staff member, as the admin services need them */
export interface Actor {
  id: string;
  name: string;
  role: StaffRole;
}

export const actorOf = (user: { id: string; name?: string | null; role?: unknown }): Actor => ({
  id: user.id,
  name: user.name || 'Unknown',
  role: user.role === 'ADMIN' ? 'ADMIN' : 'MODERATOR',
});

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const needed =
      this.reflector.getAllAndOverride<StaffRole>(ADMIN_ROLE_KEY, [context.getHandler(), context.getClass()]) ?? 'MODERATOR';
    const user = context.switchToHttp().getRequest<{ user?: { role?: unknown } }>().user;
    if (!user || !hasRole(user.role, needed)) {
      throw new ForbiddenException(needed === 'ADMIN' ? 'Only admins can do this' : 'Only the SpeakBetter team can open this');
    }
    return true;
  }
}
