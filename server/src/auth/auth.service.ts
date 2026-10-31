import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';

import { PrismaService } from '../prisma.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Where a login / refresh came from. Used to tell a tab race from a stolen token. */
export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

/** Machine-readable reason attached to a refresh 401 so clients can react to it. */
export type AuthFailureCode =
  | 'REFRESH_INVALID'
  | 'REFRESH_EXPIRED'
  | 'REFRESH_REVOKED'
  | 'REFRESH_REUSED'
  | 'REFRESH_RACE';

interface RefreshPayload {
  sub: string;
  email: string;
  sid?: string;
}

type Db = Pick<Prisma.TransactionClient, 'session'>;

type SessionRow = NonNullable<
  Awaited<ReturnType<PrismaService['session']['findUnique']>>
>;

/**
 * Called after a login (session family) has been revoked, so live connections
 * that were authenticated with it can be closed. `familyId` is null when every
 * login of the user is meant.
 */
export type SessionRevokedListener = (event: {
  userId: string;
  familyId: string | null;
  reason: string;
}) => void;

type RotationOutcome =
  | { kind: 'ok'; user: any; accessToken: string; refreshToken: string }
  | { kind: 'invalid' | 'expired' | 'revoked' | 'race' }
  | { kind: 'user_gone'; userId: string; familyId: string }
  | { kind: 'reuse'; userId: string; familyId: string; reasons: string[] };

/**
 * Sessions: one `Session` row per refresh token, grouped into families.
 *
 *  - A login starts a family; each refresh rotates to a new row in that family.
 *  - Only the SHA-256 of a refresh token is stored (the legacy raw `token`
 *    column is only read, for rows written by not-yet-upgraded instances).
 *  - Refresh and logout take a per-family Postgres advisory lock, so a logout
 *    can never race with an in-flight refresh and keep the login alive.
 *  - A rotated token that is shown again is either a harmless double refresh
 *    (two tabs) or a leaked token. Only a double refresh that is recent, from
 *    the same client, and not yet superseded is tolerated; and even then it is
 *    never issued new tokens. Anything else revokes the whole family.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly revokeListeners = new Set<SessionRevokedListener>();

  /** A replay of a just-rotated token inside this window may be a tab race */
  private readonly reuseGraceMs: number;
  /** Max tolerated replays per rotated token, even inside the grace window */
  private static readonly MAX_RACE_HITS = 3;
  private static readonly META_MAX_LENGTH = 255;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const graceSeconds = Number(
      this.configService.get('REFRESH_REUSE_GRACE_SECONDS') ?? 10,
    );
    this.reuseGraceMs =
      (Number.isFinite(graceSeconds) && graceSeconds >= 0 ? graceSeconds : 10) *
      1000;
  }

  async register(dto: RegisterDto, meta?: SessionMeta) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,

        profile: {
          create: {
            nativeLanguage: dto.nativeLanguage || 'en',

            learningLanguages: dto.learningLanguages || ['en'],
          },
        },
      },

      include: {
        profile: true,
      },
    });

    const tokens = await this.startSession(user, meta);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto, meta?: SessionMeta) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },

      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Please use social login');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.profile.update({
      where: {
        userId: user.id,
      },

      data: {
        lastActive: new Date(),
      },
    });

    const tokens = await this.startSession(user, meta);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ===============================
  // GOOGLE LOGIN
  // ===============================

  async googleLogin(
    googleUser: {
      email: string;
      name: string;
      googleId: string;
      avatarUrl?: string;
    },
    meta?: SessionMeta,
  ) {
    const { email, name, googleId, avatarUrl } = googleUser;

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          googleId,
          avatarUrl, // ✅ matches schema
          profile: {
            create: {
              nativeLanguage: 'en',
              learningLanguages: ['en'],
            },
          },
        },
        include: { profile: true },
      });
    } else if (!user.googleId) {
      // Existing email user signing in with Google for the first time
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatarUrl: avatarUrl ?? user.avatarUrl },
        include: { profile: true },
      });
    }

    // ✅ Explicit non-null guard — satisfies TS
    if (!user) {
      throw new UnauthorizedException('Failed to create or fetch user');
    }

    const tokens = await this.startSession(user, meta);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ===============================
  // REFRESH (rotation + reuse detection)
  // ===============================

  async refreshToken(refreshToken: string, meta?: SessionMeta) {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch (error) {
      throw this.failure(
        error?.name === 'TokenExpiredError'
          ? 'REFRESH_EXPIRED'
          : 'REFRESH_INVALID',
      );
    }

    const tokenHash = this.hashToken(refreshToken);

    // Unlocked probe, only to learn which family to lock. Everything that
    // decides the outcome is re-read inside the locked transaction.
    const probe = await this.findSessionByToken(refreshToken, tokenHash);
    if (
      !probe ||
      probe.userId !== payload.sub ||
      (payload.sid && payload.sid !== probe.id)
    ) {
      throw this.failure('REFRESH_INVALID');
    }

    const outcome = await this.prisma.$transaction(
      (tx) => this.rotate(tx, probe.id, probe.familyId, meta),
      { timeout: 10_000, maxWait: 5_000 },
    );

    switch (outcome.kind) {
      case 'ok':
        return {
          user: this.sanitizeUser(outcome.user),
          accessToken: outcome.accessToken,
          refreshToken: outcome.refreshToken,
        };
      case 'race':
        // Benign concurrent refresh: the winner's cookies are already on the
        // way, so the caller should retry with them. No tokens are issued here.
        throw this.failure('REFRESH_RACE', 'Refresh already in progress');
      case 'reuse':
        this.notifyRevoked(outcome.userId, outcome.familyId, 'reuse_detected');
        this.logger.warn(
          `Refresh token reuse for user ${outcome.userId}; revoked session family ${outcome.familyId} (${outcome.reasons.join(', ')})`,
        );
        throw this.failure('REFRESH_REUSED', 'Refresh token reuse detected');
      case 'expired':
        throw this.failure('REFRESH_EXPIRED');
      case 'user_gone':
        this.notifyRevoked(
          outcome.userId,
          outcome.familyId,
          'user_unavailable',
        );
        throw this.failure('REFRESH_REVOKED');
      case 'revoked':
        throw this.failure('REFRESH_REVOKED');
      default:
        throw this.failure('REFRESH_INVALID');
    }
  }

  /** Runs inside a transaction that holds the family lock */
  private async rotate(
    tx: Prisma.TransactionClient,
    sessionId: string,
    familyId: string,
    meta?: SessionMeta,
  ): Promise<RotationOutcome> {
    await this.lockFamily(tx, familyId);

    const row = await tx.session.findUnique({ where: { id: sessionId } });
    const now = new Date();

    if (!row) return { kind: 'invalid' };
    if (row.revokedAt) return { kind: 'revoked' };
    if (row.expiresAt <= now) return { kind: 'expired' };
    if (row.rotatedAt) return this.handleReplay(tx, row, now, meta);

    const user = await tx.user.findUnique({
      where: { id: row.userId },
      include: { profile: true },
    });

    if (!user || !this.canAuthenticate(user)) {
      await this.revokeFamilyInTx(tx, familyId, 'user_unavailable', now);
      return { kind: 'user_gone', userId: row.userId, familyId };
    }

    // Claim the token. Under the family lock this always succeeds; the
    // conditional update stays as a second line of defense.
    const claimed = await tx.session.updateMany({
      where: { id: row.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: now, lastUsedAt: now },
    });
    if (claimed.count !== 1) return { kind: 'race' };

    const issued = await this.issueSession(tx, user, { familyId, meta });
    await tx.session.update({
      where: { id: row.id },
      data: { replacedById: issued.sessionId },
    });

    return {
      kind: 'ok',
      user,
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    };
  }

  /**
   * A rotated token was presented again. It is a tab race only if ALL hold:
   * recent, from the same client, its replacement was not used yet, and it has
   * not been replayed too often. Otherwise the whole family is revoked.
   */
  private async handleReplay(
    tx: Prisma.TransactionClient,
    row: SessionRow,
    now: Date,
    meta?: SessionMeta,
  ): Promise<RotationOutcome> {
    const reasons: string[] = [];

    const ageMs = now.getTime() - (row.rotatedAt?.getTime() ?? 0);
    if (ageMs > this.reuseGraceMs) reasons.push('outside_grace');

    const child = row.replacedById
      ? await tx.session.findUnique({ where: { id: row.replacedById } })
      : null;
    if (!child) reasons.push('no_replacement');
    else if (child.rotatedAt || child.revokedAt) {
      reasons.push('replacement_already_used');
    }

    if (row.reuseHits >= AuthService.MAX_RACE_HITS) {
      reasons.push('too_many_replays');
    }
    if (this.contextMismatch(row, meta)) reasons.push('client_mismatch');

    if (reasons.length > 0) {
      await this.revokeFamilyInTx(tx, row.familyId, 'reuse_detected', now);
      return {
        kind: 'reuse',
        userId: row.userId,
        familyId: row.familyId,
        reasons,
      };
    }

    await tx.session.update({
      where: { id: row.id },
      data: { reuseHits: { increment: 1 } },
    });
    return { kind: 'race' };
  }

  // ===============================
  // LOGOUT
  // ===============================

  /**
   * Ends the login that `refreshToken` belongs to (the whole family, so an
   * in-flight refresh cannot keep it alive). Without a refresh token this is
   * a no-op: an access token alone does not say which login to end. Use
   * logoutSession / logoutAll when the session id or user is known.
   * Idempotent: unknown, expired or already revoked tokens still succeed.
   */
  async logout(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      return { success: true };
    }

    await this.revokeByToken(refreshToken, userId);
    return { success: true };
  }

  /** Works without a valid access token, e.g. when it has already expired */
  async logoutByRefreshToken(refreshToken: string) {
    const userId = await this.revokeByToken(refreshToken);
    return { success: true, userId };
  }

  /** Ends the login that owns `sessionId` (the `sid` claim of an access token) */
  async logoutSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (session && session.userId === userId) {
      await this.revokeFamily(userId, session.familyId, 'logout');
    }
    return { success: true };
  }

  /**
   * Ends the login an access token belongs to. The token may already be
   * expired (its signature still proves which session it was), so a client
   * whose access cookie lapsed can still log out. Unknown tokens are ignored.
   */
  async logoutByAccessToken(accessToken: string) {
    const claims = this.verifyAccessToken(accessToken, true);
    if (claims?.sid) {
      await this.logoutSession(claims.sub, claims.sid);
    }
    return { success: true };
  }

  /** Ends every login of a user. Service-level only; no endpoint uses it yet. */
  async logoutAll(userId: string, reason = 'logout_all') {
    const families = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      distinct: ['familyId'],
      select: { familyId: true },
      orderBy: { familyId: 'asc' },
    });

    // One family at a time under its lock. Refreshes inside these families are
    // covered by the lock; logins that start meanwhile are new, legitimate ones.
    for (const { familyId } of families) {
      await this.revokeFamily(userId, familyId, reason);
    }
    return { success: true, revokedFamilies: families.length };
  }

  // ===============================
  // SESSION VALIDATION (shared by HTTP and sockets)
  // ===============================

  /**
   * Returns the user (with profile) when the access-token claims belong to a
   * live session of an existing user, otherwise null.
   * Tokens issued before session ids existed carry no `sid`; they are accepted
   * while AUTH_ALLOW_LEGACY_ACCESS is not "false", and expire on their own.
   */
  async authenticateSession(claims: { sub: string; sid?: string }) {
    return (await this.resolveSession(claims))?.user ?? null;
  }

  /**
   * Verifies an access token (signature and expiry, with the same secret the
   * HTTP strategy uses) and its session. Used by the socket gateways. Returns
   * null for anything that must not be let in; `familyId` lets a gateway tie
   * a connection to its login so a logout can close it.
   */
  async authenticateAccessToken(accessToken: string) {
    const claims = this.verifyAccessToken(accessToken);
    if (!claims) return null;

    const resolved = await this.resolveSession(claims);
    if (!resolved) return null;
    return {
      user: resolved.user,
      sessionId: resolved.session?.id ?? null,
      familyId: resolved.session?.familyId ?? null,
    };
  }

  private verifyAccessToken(accessToken: string, ignoreExpiration = false) {
    try {
      const claims = this.jwtService.verify<{ sub?: string; sid?: string }>(
        accessToken,
        { ignoreExpiration },
      );
      return claims?.sub ? { sub: claims.sub, sid: claims.sid } : null;
    } catch {
      return null;
    }
  }

  private async resolveSession(claims: { sub: string; sid?: string }) {
    if (!claims?.sub) return null;

    if (!claims.sid) {
      if (this.configService.get('AUTH_ALLOW_LEGACY_ACCESS') === 'false') {
        return null;
      }
      const legacyUser = await this.prisma.user.findUnique({
        where: { id: claims.sub },
        include: { profile: true },
      });
      return legacyUser && this.canAuthenticate(legacyUser)
        ? { user: legacyUser, session: null }
        : null;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      include: { user: { include: { profile: true } } },
    });

    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !this.canAuthenticate(session.user)
    ) {
      return null;
    }
    return { user: session.user, session };
  }

  // ===============================
  // CLEANUP
  // ===============================

  /**
   * Deletes sessions whose refresh token has expired. Rotated and revoked rows
   * are kept until then, because they are what reuse detection looks up.
   * Safe to call from every instance: a transaction-scoped advisory lock lets
   * one run at a time, and the others return immediately with `skipped`.
   */
  async pruneSessions(
    options: { batchSize?: number; maxBatches?: number } = {},
  ) {
    const batchSize = options.batchSize ?? 1000;
    const maxBatches = options.maxBatches ?? 50;

    return this.prisma.$transaction(
      async (tx) => {
        const lock = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtextextended('auth:session-prune', 0)) AS locked`;
        if (!lock[0]?.locked) return { skipped: true, deleted: 0 };

        let deleted = 0;
        for (let i = 0; i < maxBatches; i++) {
          const expired = await tx.session.findMany({
            where: { expiresAt: { lt: new Date() } },
            select: { id: true },
            orderBy: { expiresAt: 'asc' },
            take: batchSize,
          });
          if (expired.length === 0) break;

          const result = await tx.session.deleteMany({
            where: { id: { in: expired.map((s) => s.id) } },
          });
          deleted += result.count;
          if (expired.length < batchSize) break;
        }
        return { skipped: false, deleted };
      },
      { timeout: 30_000, maxWait: 5_000 },
    );
  }

  // ===============================
  // ME
  // ===============================

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  // ===============================
  // INTERNALS
  // ===============================

  /** Starts a new login (new family) */
  private startSession(
    user: { id: string; email: string },
    meta?: SessionMeta,
  ) {
    return this.issueSession(this.prisma, user, { meta }).then(
      ({ accessToken, refreshToken }) => ({ accessToken, refreshToken }),
    );
  }

  /**
   * Signs the token pair and stores the refresh token's hash. Both tokens
   * carry the session id (`sid`); the refresh token also gets a random `jti`,
   * so two tokens issued in the same second can never be identical.
   * Nothing is returned to the caller if the insert fails.
   */
  private async issueSession(
    db: Db,
    user: { id: string; email: string },
    options: { familyId?: string; meta?: SessionMeta } = {},
  ) {
    const sessionId = randomUUID();
    const claims = { sub: user.id, email: user.email, sid: sessionId };

    const refreshToken = await this.jwtService.signAsync(
      { ...claims, jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.getOrThrow<'30d'>('REFRESH_EXPIRES_IN'),
      },
    );
    const accessToken = await this.jwtService.signAsync(claims);

    // Row expiry follows the token's own exp, so the two can never disagree
    const exp = this.jwtService.decode<{ exp: number }>(refreshToken)?.exp;
    if (!exp) throw new Error('Refresh token has no expiry');

    await db.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId: options.familyId ?? randomUUID(),
        expiresAt: new Date(exp * 1000),
        userAgent: this.clean(options.meta?.userAgent),
        ip: this.clean(options.meta?.ip),
      },
    });

    return { sessionId, accessToken, refreshToken };
  }

  /** Hash first; fall back to the legacy raw column for rows written by old instances */
  private async findSessionByToken(token: string, tokenHash: string) {
    const byHash = await this.prisma.session.findUnique({
      where: { tokenHash },
    });
    if (byHash) return byHash;

    const legacy = await this.prisma.session.findUnique({ where: { token } });
    if (legacy && !legacy.tokenHash) {
      // Lazy backfill. Losing this race against another request is harmless.
      await this.prisma.session
        .update({ where: { id: legacy.id }, data: { tokenHash } })
        .catch(() => undefined);
    }
    return legacy;
  }

  /** Returns the token's owner, or null if the token is unknown or not `onlyUserId`'s */
  private async revokeByToken(token: string, onlyUserId?: string) {
    const session = await this.findSessionByToken(token, this.hashToken(token));
    if (!session) return null;
    if (onlyUserId && session.userId !== onlyUserId) {
      this.logger.warn(
        `logout for ${onlyUserId} got a refresh token of another user`,
      );
      return null;
    }
    await this.revokeFamily(session.userId, session.familyId, 'logout');
    return session.userId;
  }

  private async revokeFamily(userId: string, familyId: string, reason: string) {
    await this.prisma.$transaction(
      async (tx) => {
        await this.lockFamily(tx, familyId);
        await this.revokeFamilyInTx(tx, familyId, reason, new Date());
      },
      { timeout: 10_000, maxWait: 5_000 },
    );
    // After the commit, so listeners never act on a revocation that rolled back
    this.notifyRevoked(userId, familyId, reason);
  }

  /** Subscribe to revocations (gateways use it to close live sockets). Returns an unsubscribe function. */
  onSessionRevoked(listener: SessionRevokedListener) {
    this.revokeListeners.add(listener);
    return () => {
      this.revokeListeners.delete(listener);
    };
  }

  private notifyRevoked(
    userId: string,
    familyId: string | null,
    reason: string,
  ) {
    for (const listener of this.revokeListeners) {
      try {
        listener({ userId, familyId, reason });
      } catch (error) {
        this.logger.warn(`Session revoked listener failed: ${error?.message}`);
      }
    }
  }

  private revokeFamilyInTx(
    tx: Prisma.TransactionClient,
    familyId: string,
    reason: string,
    now: Date,
  ) {
    return tx.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
  }

  /**
   * Serializes refresh / logout / reuse handling of one family across all
   * instances. Released automatically when the transaction ends.
   */
  private async lockFamily(tx: Prisma.TransactionClient, familyId: string) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`auth:family:${familyId}`}, 0))`;
  }

  /** Only a difference counts: a missing value on either side is unknown, not a mismatch */
  private contextMismatch(row: SessionRow, meta?: SessionMeta) {
    const ua = this.clean(meta?.userAgent);
    const ip = this.clean(meta?.ip);
    return (
      (!!ua && !!row.userAgent && ua !== row.userAgent) ||
      (!!ip && !!row.ip && ip !== row.ip)
    );
  }

  /**
   * The one place that decides whether a user may hold a session. The User
   * model has no active / banned / deleted flag today, so existence is the
   * whole check; add the flag here when one is introduced.
   */
  private canAuthenticate(_user: { id: string }) {
    return true;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, AuthService.META_MAX_LENGTH) : null;
  }

  private failure(code: AuthFailureCode, message = 'Invalid refresh token') {
    return new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      message,
      code,
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...safeUser } = user;

    return safeUser;
  }
}
