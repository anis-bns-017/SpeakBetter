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
  CARD_COUNT,
  GOALS,
  Goal,
  LEVELS,
  Level,
  RECONNECT_GRACE_MS,
} from './random-call.constants';
import { RandomCallService } from './random-call.service';

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
  /** userId -> timer that ends their call if they do not come back */
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();

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
  }

  onModuleDestroy() {
    this.unsubscribeRevoked?.();
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

  /** Both people see the same conversation card: one flips it, the other follows */
  @SubscribeMessage('rc:card')
  async handleCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string; index?: number },
  ) {
    const userId = client.data.userId as string | undefined;
    if (
      !userId ||
      typeof data?.callId !== 'string' ||
      !Number.isInteger(data.index) ||
      (data.index as number) < 0 ||
      (data.index as number) >= CARD_COUNT
    ) {
      return;
    }
    try {
      const call = await this.calls.getParticipantCall(data.callId, userId);
      if (call.endedAt) return;
      this.broadcaster.emitToUser(this.calls.partnerOf(call, userId), 'rc:card', {
        callId: call.id,
        index: data.index,
      });
    } catch {
      // not a participant: ignore
    }
  }
}
