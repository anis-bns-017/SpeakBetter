// server/src/voice/voice.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { parse } from 'cookie';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { VoiceService } from './voice.service';
import { PrismaService } from '../prisma.service';
import { CoachService } from './coach/coach.service';
import { VOICE_GATEWAY_OPTIONS } from './realtime/gateway-options';
import { VoiceRoomState } from './realtime/voice-room-state';
import { userRoom } from './realtime/room-access';
import { VoiceBroadcaster } from './realtime/voice-broadcaster';
import { VoiceCoachSession } from './realtime/voice-coach-session';

/**
 * The voice namespace's front door: authentication, connect / disconnect (with
 * the reconnect grace period), join and leave. The rest of the voice events
 * live in realtime/ (chat, moderation, coach) on the same namespace.
 */
@WebSocketGateway(VOICE_GATEWAY_OPTIONS)
export class VoiceGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private unsubscribeRevoked?: () => void;
  /** How long a dropped connection may come back before it counts as leaving */
  private static readonly RECONNECT_GRACE_MS = 15_000;

  constructor(
    private authService: AuthService,
    private voiceService: VoiceService,
    private prisma: PrismaService,
    private coach: CoachService,
    private state: VoiceRoomState,
    private broadcaster: VoiceBroadcaster,
    private coachSession: VoiceCoachSession,
  ) {}

  onModuleInit() {
    this.unsubscribeRevoked = this.authService.onSessionRevoked((event) => {
      void this.closeRevokedSockets(event);
    });
  }

  /**
   * socket.io runs this before it accepts a connection, so by the time the
   * client can emit anything (it usually sends voice:join the instant it is
   * connected) its identity is already on `client.data`. A socket that fails
   * here never connects; the client sees a connect_error.
   */
  afterInit(server: Server) {
    this.broadcaster.attach(server);
    server.use((socket, next) => {
      this.authenticateSocket(socket).then(
        (ok) => next(ok ? undefined : new Error('Unauthorized')),
        (error) => {
          this.logger.error('VoiceGateway auth error:', error);
          next(new Error('Unauthorized'));
        },
      );
    });
  }

  private async authenticateSocket(client: Socket): Promise<boolean> {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      this.logger.warn('No cookie header, refusing connection');
      return false;
    }

    const token = parse(cookieHeader)['accessToken'];
    if (!token) {
      this.logger.warn('No access token, refusing connection');
      return false;
    }

    // Signature, expiry, live session and existing user: same rules as HTTP
    const authed = await this.authService.authenticateAccessToken(token);
    if (!authed) {
      this.logger.warn(
        'Invalid token, revoked session or unknown user, refusing connection',
      );
      return false;
    }

    client.data.userId = authed.user.id;
    client.data.userName = authed.user.name;
    client.data.sessionId = authed.sessionId;
    client.data.familyId = authed.familyId;
    return true;
  }

  handleConnection(client: Socket) {
    try {
      const userId = client.data.userId as string | undefined;
      if (!userId) {
        // The auth middleware only lets authenticated sockets through
        client.disconnect();
        return;
      }

      void client.join(userRoom(userId));

      this.logger.log(`✅ User ${userId} connected to voice socket`);
    } catch (error) {
      this.logger.error('VoiceGateway auth error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    // The rooms this socket joined on this instance (the room list itself may
    // live in Redis and be shared)
    const joined = (client.data.voiceRoomIds as Set<string> | undefined) ?? [];
    for (const roomId of joined) {
      if (!(await this.state.isInRoom(roomId, userId))) continue;

      // Still connected to this room from another tab or device: nothing changes
      const remaining = await this.server.in(`voice:${roomId}`).fetchSockets();
      if (remaining.some((s) => s.data?.userId === userId)) continue;

      // Probably a network blip: show "reconnecting" and wait before treating it as leaving
      const key = `${roomId}:${userId}`;
      if (this.state.pendingLeaves.has(key)) continue;
      this.server
        .to(`voice:${roomId}`)
        .emit('voice:presence', { userId, status: 'reconnecting' });
      this.state.pendingLeaves.set(
        key,
        setTimeout(() => {
          this.state.pendingLeaves.delete(key);
          void this.removeFromRoom(roomId, userId);
        }, VoiceGateway.RECONNECT_GRACE_MS),
      );
    }

    this.logger.log(`User ${userId} disconnected from voice`);
  }

  /** Called when the grace period ends without the user coming back */
  private async removeFromRoom(roomId: string, userId: string) {
    this.coachSession.flushSpeaking(roomId, userId);
    const { wasPresent, remaining } = await this.state.removeParticipant(
      roomId,
      userId,
    );
    if (!wasPresent) return;

    if (remaining.length > 0 && (await this.state.getHost(roomId)) === userId) {
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: roomId },
        select: { creatorId: true },
      });

      if (room && room.creatorId === userId) {
        const newHost = remaining[0];
        if (newHost) {
          await this.state.setHost(roomId, newHost);
          this.server.to(`voice:${roomId}`).emit('voice:host-changed', {
            newHostId: newHost,
          });
        }
      }
    }
    this.server.to(`voice:${roomId}`).emit('participant:left', { userId });
    void this.coachSession.finishCoachSession(roomId, userId);
    this.logger.log(`User ${userId} left room ${roomId} (did not reconnect)`);
  }

  /** A returning user cancels their pending removal; returns true if they were reconnecting */
  private cancelPendingLeave(roomId: string, userId: string): boolean {
    const key = `${roomId}:${userId}`;
    const timer = this.state.pendingLeaves.get(key);
    if (!timer) return false;
    clearTimeout(timer);
    this.state.pendingLeaves.delete(key);
    return true;
  }

  @SubscribeMessage('voice:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      // ✅ Ensure room exists in database
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
        include: {
          participants: {
            where: { leftAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
          messages: {
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      if (room.status === 'ENDED') {
        client.emit('voice:error', { message: 'Room has ended' });
        return;
      }

      if (await this.voiceService.isBanned(data.roomId, userId)) {
        client.emit('voice:error', {
          message: 'You were removed from this room by the host.',
        });
        return;
      }

      // ✅ Use consistent room name format
      const roomName = `voice:${data.roomId}`;

      // Check if user is already a participant
      const existingParticipant = await this.prisma.voiceParticipant.findUnique(
        {
          where: {
            roomId_userId: {
              roomId: data.roomId,
              userId,
            },
          },
        },
      );

      if (!existingParticipant) {
        // A private room only admits people who were invited (they have a row)
        if (room.type === 'PRIVATE' && room.creatorId !== userId) {
          client.emit('voice:error', {
            message: 'This room is private. Ask the host for an invite.',
          });
          return;
        }
        await this.prisma.voiceParticipant.create({
          data: {
            roomId: data.roomId,
            userId,
            role: userId === room.creatorId ? 'MODERATOR' : 'LISTENER',
          },
        });
      } else if (existingParticipant.leftAt) {
        await this.prisma.voiceParticipant.update({
          where: {
            roomId_userId: {
              roomId: data.roomId,
              userId,
            },
          },
          data: {
            leftAt: null,
            joinedAt: new Date(),
          },
        });
      }

      // Join socket room
      await client.join(roomName);

      // Track participant in memory
      await this.state.addParticipant(data.roomId, userId);
      const joined = (client.data.voiceRoomIds ??= new Set<string>()) as Set<string>;
      joined.add(data.roomId);

      // Back within the grace period: keep their place (and host role) and clear "reconnecting"
      if (this.cancelPendingLeave(data.roomId, userId)) {
        client
          .to(roomName)
          .emit('voice:presence', { userId, status: 'online' });
        this.logger.log(`User ${userId} reconnected to room ${data.roomId}`);
      }

      await this.state.setHostIfAbsent(data.roomId, room.creatorId);

      // Send current participants
      const participants = await this.state.participantIds(data.roomId);

      const participantDetails = await this.prisma.voiceParticipant.findMany({
        where: {
          roomId: data.roomId,
          leftAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      client.emit('voice:participants', {
        participants: participantDetails,
        participantIds: participants,
      });

      const hostId = (await this.state.getHost(data.roomId)) || room.creatorId;
      client.emit('voice:host', { hostId });

      const userName = (client.data.userName as string) || 'User';
      const me = participantDetails.find((p) => p.userId === userId);

      client.to(roomName).emit('participant:joined', {
        userId,
        userName,
        user: me?.user,
        role: me?.role,
        raisedHand: me?.raisedHand ?? false,
        canSpeak: this.voiceService.canSpeakInRoom(room, userId, me?.role),
      });

      // Corrections made earlier in this room (survive refreshes, visible to late joiners)
      try {
        client.emit(
          'voice:corrections-history',
          await this.voiceService.getRoomCorrections(data.roomId),
        );
      } catch (error) {
        this.logger.warn(
          `Could not load corrections history: ${error?.message}`,
        );
      }

      // Coach: start tracking this person and catch them up on the mission / airtime
      try {
        this.coach.join(data.roomId, userId, userName);
        const mission = this.coach.assignLate(data.roomId, userId, userName);
        if (mission)
          this.broadcaster.emitToUser(userId, 'voice:mission-word', mission);
        client.emit(
          'voice:coach-state',
          await this.coachSession.buildCoachState(data.roomId, userId),
        );
        this.coachSession.scheduleAirtime(data.roomId);
      } catch (error) {
        this.logger.warn(
          `Could not start coach for ${userId}: ${error?.message}`,
        );
      }

      // Send message history
      const allMessages = await this.prisma.voiceRoomMessage.findMany({
        where: {
          roomId: data.roomId,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          replyTo: {
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      client.emit('voice:message-history', allMessages.reverse());

      this.logger.log(`User ${userId} joined voice room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error joining voice room:', error);
      client.emit('voice:error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('voice:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    this.coachSession.flushSpeaking(data.roomId, userId);

    try {
      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId },
        },
        data: { leftAt: new Date() },
      });

      const roomName = `voice:${data.roomId}`;
      await client.leave(roomName);

      (client.data.voiceRoomIds as Set<string> | undefined)?.delete(data.roomId);
      const { wasPresent, remaining } = await this.state.removeParticipant(
        data.roomId,
        userId,
      );
      if (
        wasPresent &&
        remaining.length > 0 &&
        (await this.state.getHost(data.roomId)) === userId
      ) {
        const room = await this.prisma.voiceRoom.findUnique({
          where: { id: data.roomId },
          select: { creatorId: true },
        });

        if (room && room.creatorId === userId) {
          const newHost = remaining[0];
          if (newHost) {
            await this.state.setHost(data.roomId, newHost);
            this.server.to(roomName).emit('voice:host-changed', {
              newHostId: newHost,
            });
          }
        }
      }

      client.to(roomName).emit('participant:left', { userId });
      void this.coachSession.finishCoachSession(data.roomId, userId);

      this.logger.log(`User ${userId} left voice room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error leaving voice room:', error);
      client.emit('voice:error', { message: 'Failed to leave room' });
    }
  }

  /** Closes the sockets opened by a login that was just revoked (logout, reuse, ...) */
  private async closeRevokedSockets(event: {
    userId: string;
    familyId: string | null;
  }) {
    try {
      // fetchSockets() works on a namespace and, with an adapter, across instances
      for (const socket of (await this.server?.fetchSockets()) ?? []) {
        if (socket.data.userId !== event.userId) continue;
        // A socket without a family came from a pre-session token: close it too
        if (
          event.familyId &&
          socket.data.familyId &&
          socket.data.familyId !== event.familyId
        ) {
          continue;
        }
        socket.disconnect(true);
      }
    } catch (error) {
      this.logger.warn(`Could not close revoked sockets: ${error?.message}`);
    }
  }

  onModuleDestroy() {
    this.unsubscribeRevoked?.();
  }
}
