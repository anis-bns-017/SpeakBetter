import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { HttpException, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { parse as parseCookie } from 'cookie';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { socketCorsOrigin } from '../common/socket-origin';
import { MatchQueue } from './match-queue';
import { MatchmakerService } from './matchmaker.service';
import { RandomCallBroadcaster, callUserRoom } from './random-call.broadcaster';
import {
  CAPTION_MAX_CHARS,
  GOALS,
  Goal,
  LEVELS,
  Level,
  MAX_NOTES_PER_CALL,
  NOTE_MAX_CHARS,
  REACTIONS,
  RECONNECT_GRACE_MS,
  levelIndex,
} from './random-call.constants';
import { CARD_KINDS, CardKind, drawCard, getCard } from './conversation-cards';
import { RandomCallService } from './random-call.service';

/** A person may draw a random card this often */
const DRAW_COOLDOWN_MS = 700;
/** Minimum gap between messages of each kind from one person */
const MIN_GAP_MS = { caption: 120, reaction: 350, note: 2500 } as const;
/** How long a call's membership is remembered before it is checked again */
const MEMBERSHIP_TTL_MS = 5_000;

@WebSocketGateway({
  cors: { origin: socketCorsOrigin, credentials: true },
  namespace: 'call',
})
export class RandomCallGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RandomCallGateway.name);
  private unsubscribeRevoked?: () => void;
  private unsubscribeEnded?: () => void;
  /** userId -> timer that ends their call if they do not come back */
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();
  /** userId -> when they last drew a random card (stops button mashing) */
  private readonly lastDraw = new Map<string, number>();
  /** `${userId}:${kind}` -> when they last sent that kind of message */
  private readonly lastSent = new Map<string, number>();
  /** `${userId}:${callId}` -> the partner, remembered briefly so captions need no database trip */
  private readonly memberships = new Map<string, { partnerId: string; at: number }>();
  /** `${callId}:${userId}` -> notes sent in this call */
  private readonly noteCounts = new Map<string, number>();

  constructor(
    private readonly authService: AuthService,
    private readonly calls: RandomCallService,
    private readonly matchmaker: MatchmakerService,
    private readonly queue: MatchQueue,
    private readonly broadcaster: RandomCallBroadcaster,
  ) {}

  onModuleInit() {
    this.unsubscribeRevoked = this.authService.onSessionRevoked((event) => {
      void this.closeRevokedSockets(event);
    });
    // An ended call stops relaying at once (other instances catch up within the TTL)
    this.unsubscribeEnded = this.broadcaster.onCallEnded((callId) => {
      for (const key of this.memberships.keys()) {
        if (key.endsWith(`:${callId}`)) this.memberships.delete(key);
      }
    });
  }

  onModuleDestroy() {
    this.unsubscribeRevoked?.();
    this.unsubscribeEnded?.();
    for (const timer of this.graceTimers.values()) clearTimeout(timer);
  }

  private async closeRevokedSockets(event: { userId: string; familyId: string | null }) {
    try {
      for (const socket of (await this.server?.fetchSockets()) ?? []) {
        if (socket.data.userId !== event.userId) continue;
        if (event.familyId && socket.data.familyId && socket.data.familyId !== event.familyId) {
          continue;
        }
        socket.disconnect(true);
      }
    } catch (error) {
      this.logger.warn(`Could not close revoked sockets: ${(error as Error)?.message}`);
    }
  }

  /** Runs before a connection is accepted, so every event has a known user */
  afterInit(server: Server) {
    this.broadcaster.attach(server);
    server.use((socket, next) => {
      this.authenticateSocket(socket).then(
        (ok) => next(ok ? undefined : new Error('Unauthorized')),
        () => next(new Error('Unauthorized')),
      );
    });
  }

  private async authenticateSocket(client: Socket): Promise<boolean> {
    let token: string | null = null;
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookie(String(cookieHeader)) as Record<string, string>;
      token = cookies['accessToken'] || null;
    }
    if (!token && client.handshake.auth?.token) token = client.handshake.auth.token as string;
    if (!token && client.handshake.query?.token) token = client.handshake.query.token as string;
    if (!token && client.handshake.headers?.authorization) {
      const header = client.handshake.headers.authorization;
      if (header.startsWith('Bearer ')) token = header.substring(7);
    }
    if (!token || typeof token !== 'string') return false;

    const authed = await this.authService.authenticateAccessToken(token);
    if (!authed) return false;
    client.data.userId = authed.user.id;
    client.data.sessionId = authed.sessionId;
    client.data.familyId = authed.familyId;
    return true;
  }

  async handleConnection(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      client.disconnect();
      return;
    }
    await client.join(callUserRoom(userId));

    // Back within the grace period: the call carries on
    const pending = this.graceTimers.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.graceTimers.delete(userId);
    }

    try {
      const active = await this.calls.activeCallFor(userId);
      if (active) {
        client.emit('rc:resume', await this.calls.buildCallPayload(active, userId));
        return;
      }
      const status = await this.calls.getStatus(userId);
      client.emit('rc:ready', {
        ...status,
        queued: await this.queue.has(userId),
      });
    } catch (error) {
      this.logger.warn(`Connect state failed for ${userId}: ${(error as Error).message}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    try {
      // Only when their last tab / device is gone (on any instance)
      if ((await this.broadcaster.socketCount(userId)) > 0) return;
      await this.matchmaker.leave(userId);
      this.lastDraw.delete(userId);
      for (const kind of Object.keys(MIN_GAP_MS)) this.lastSent.delete(`${userId}:${kind}`);

      const active = await this.calls.activeCallFor(userId);
      if (!active || this.graceTimers.has(userId)) return;
      this.graceTimers.set(
        userId,
        setTimeout(() => {
          this.graceTimers.delete(userId);
          void (async () => {
            if ((await this.broadcaster.socketCount(userId)) > 0) return;
            const still = await this.calls.activeCallFor(userId);
            if (still) await this.calls.endCall(still.id, null, 'DISCONNECTED');
          })();
        }, RECONNECT_GRACE_MS),
      );
    } catch (error) {
      this.logger.warn(`Disconnect cleanup failed: ${(error as Error).message}`);
    }
  }

  private fail(client: Socket, error: unknown, fallback: string) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const body = typeof response === 'object' ? (response as Record<string, unknown>) : {};
      client.emit('rc:error', {
        code: (body.code as string) ?? 'ERROR',
        message: (body.message as string) ?? error.message,
      });
      return;
    }
    this.logger.error(`${fallback}: ${(error as Error)?.message}`);
    client.emit('rc:error', { code: 'ERROR', message: fallback });
  }

  @SubscribeMessage('rc:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { level?: string; goal?: string; language?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    const level = (LEVELS as readonly string[]).includes(data?.level ?? '')
      ? (data.level as Level)
      : 'intermediate';
    const goal = (GOALS as readonly string[]).includes(data?.goal ?? '')
      ? (data.goal as Goal)
      : 'casual';
    const language =
      typeof data?.language === 'string' && data.language.trim()
        ? data.language.trim().slice(0, 40)
        : 'English';
    try {
      await this.matchmaker.join(userId, { level, goal, language });
    } catch (error) {
      this.fail(client, error, 'Could not start looking for a partner');
    }
  }

  @SubscribeMessage('rc:leave')
  async handleLeave(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    await this.matchmaker.leave(userId);
    client.emit('rc:left', {});
  }

  @SubscribeMessage('rc:end')
  async handleEnd(@ConnectedSocket() client: Socket, @MessageBody() data: { callId?: string }) {
    const userId = client.data.userId as string | undefined;
    if (!userId || typeof data?.callId !== 'string') return;
    try {
      await this.calls.getParticipantCall(data.callId, userId);
      await this.calls.endCall(data.callId, userId, 'LEFT');
    } catch (error) {
      this.fail(client, error, 'Could not end the call');
    }
  }

  @SubscribeMessage('rc:extend')
  async handleExtend(@ConnectedSocket() client: Socket, @MessageBody() data: { callId?: string }) {
    const userId = client.data.userId as string | undefined;
    if (!userId || typeof data?.callId !== 'string') return;
    try {
      await this.calls.requestExtend(data.callId, userId);
    } catch (error) {
      this.fail(client, error, 'Could not extend the call');
    }
  }

  /** Flipping to a card: the partner is shown the same one */
  @SubscribeMessage('rc:card')
  async handleCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string; cardId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const card = getCard(data?.cardId);
    if (!userId || typeof data?.callId !== 'string' || !card) return;
    try {
      const call = await this.calls.getParticipantCall(data.callId, userId);
      if (call.endedAt) return;
      // The full card travels along, so a card drawn at random is shown even
      // if the partner's deck never had it
      this.broadcaster.emitToUser(this.calls.partnerOf(call, userId), 'rc:card', {
        callId: call.id,
        card,
      });
    } catch {
      // not a participant: ignore
    }
  }

  /** The random question generator: both people get the same fresh card */
  @SubscribeMessage('rc:draw')
  async handleDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string; kind?: string; exclude?: unknown },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId || typeof data?.callId !== 'string') return;

    const last = this.lastDraw.get(userId) ?? 0;
    if (Date.now() - last < DRAW_COOLDOWN_MS) return;
    this.lastDraw.set(userId, Date.now());

    try {
      const call = await this.calls.getParticipantCall(data.callId, userId);
      if (call.endedAt) return;
      const kind = (CARD_KINDS as readonly string[]).includes(data.kind ?? '')
        ? (data.kind as CardKind)
        : undefined;
      const exclude = Array.isArray(data.exclude)
        ? data.exclude.filter((id): id is string => typeof id === 'string').slice(0, 120)
        : [];
      const lower: Level =
        levelIndex(call.levelA as Level) <= levelIndex(call.levelB as Level)
          ? (call.levelA as Level)
          : (call.levelB as Level);
      const card = drawCard({ goal: call.goal as Goal, level: lower, kind, excludeIds: exclude });
      for (const id of [call.userAId, call.userBId]) {
        this.broadcaster.emitToUser(id, 'rc:card', { callId: call.id, card, drawn: true });
      }
    } catch {
      // not a participant: ignore
    }
  }

  // ==========================
  // DURING THE CALL: captions, reactions, notes
  // ==========================

  /** The other person in an ongoing call, or null (not in it, or it ended) */
  private async activePartner(userId: string, callId: unknown): Promise<string | null> {
    if (typeof callId !== 'string') return null;
    const key = `${userId}:${callId}`;
    const cached = this.memberships.get(key);
    if (cached && Date.now() - cached.at < MEMBERSHIP_TTL_MS) return cached.partnerId;
    try {
      const call = await this.calls.getParticipantCall(callId, userId);
      if (call.endedAt) {
        this.memberships.delete(key);
        return null;
      }
      const partnerId = this.calls.partnerOf(call, userId);
      if (this.memberships.size > 2000) this.memberships.clear();
      this.memberships.set(key, { partnerId, at: Date.now() });
      return partnerId;
    } catch {
      return null;
    }
  }

  /** True if this kind of message is not being sent too fast */
  private allowed(userId: string, kind: keyof typeof MIN_GAP_MS): boolean {
    const key = `${userId}:${kind}`;
    const now = Date.now();
    if (now - (this.lastSent.get(key) ?? 0) < MIN_GAP_MS[kind]) return false;
    if (this.lastSent.size > 5000) this.lastSent.clear();
    this.lastSent.set(key, now);
    return true;
  }

  /** What you say, as text, for your partner to read (only if you turned captions on) */
  @SubscribeMessage('rc:caption')
  async handleCaption(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string; text?: string; final?: boolean },
  ) {
    const userId = client.data.userId as string | undefined;
    const text = typeof data?.text === 'string' ? data.text.trim().slice(0, CAPTION_MAX_CHARS) : '';
    if (!userId || !text) return;
    // interim captions arrive fast and may be skipped; final ones always go through
    if (!data.final && !this.allowed(userId, 'caption')) return;
    const partnerId = await this.activePartner(userId, data.callId);
    if (!partnerId) return;
    this.broadcaster.emitToUser(partnerId, 'rc:caption', {
      callId: data.callId,
      text,
      final: data.final === true,
    });
  }

  @SubscribeMessage('rc:reaction')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string; emoji?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !(REACTIONS as readonly string[]).includes(data?.emoji ?? '')) return;
    if (!this.allowed(userId, 'reaction')) return;
    const partnerId = await this.activePartner(userId, data.callId);
    if (!partnerId) return;
    this.broadcaster.emitToUser(partnerId, 'rc:reaction', { callId: data.callId, emoji: data.emoji });
  }

  /** A friendly correction ("I went" instead of "I goed"): shown to the partner and kept in their recap */
  @SubscribeMessage('rc:note')
  async handleNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string; text?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const text = typeof data?.text === 'string' ? data.text.trim().slice(0, NOTE_MAX_CHARS) : '';
    if (!userId || text.length < 2) return;
    if (!this.allowed(userId, 'note')) {
      client.emit('rc:error', { code: 'SLOW_DOWN', message: 'Give your partner a moment before the next tip.' });
      return;
    }
    const partnerId = await this.activePartner(userId, data.callId);
    if (!partnerId) return;
    const countKey = `${data.callId}:${userId}`;
    const sent = this.noteCounts.get(countKey) ?? 0;
    if (sent >= MAX_NOTES_PER_CALL) {
      client.emit('rc:error', { code: 'TOO_MANY_NOTES', message: 'That is plenty of tips for one call.' });
      return;
    }
    if (this.noteCounts.size > 2000) this.noteCounts.clear();
    this.noteCounts.set(countKey, sent + 1);
    this.broadcaster.emitToUser(partnerId, 'rc:note', { callId: data.callId, text });
    client.emit('rc:note-sent', { callId: data.callId, text });
  }
}
