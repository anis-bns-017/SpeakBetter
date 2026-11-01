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
import { parse as parseCookie } from 'cookie';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { socketCorsOrigin } from '../common/socket-origin';
import { PrismaService } from '../prisma.service';
import { ChatFeaturesService } from './chat-features.service';
import { ChatRealtimeState } from './realtime/chat-realtime-state';
import { ChatBroadcaster } from './realtime/chat-broadcaster';
import { userRoom } from './realtime/room-access';
import { CHAT_GATEWAY_OPTIONS } from './realtime/chat-gateway-options';

/**
 * The chat namespace's front door: authentication, connect / disconnect with
 * presence, and joining or leaving chat and community rooms. Messages and
 * signals live in the gateways under ./realtime, on the same namespace.
 */
@WebSocketGateway(CHAT_GATEWAY_OPTIONS)
export class ChatGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private unsubscribeRevoked?: () => void;

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly features: ChatFeaturesService,
    private readonly state: ChatRealtimeState,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

  onModuleInit() {
    // A logout / revoked login closes the sockets it opened
    this.unsubscribeRevoked = this.authService.onSessionRevoked((event) => {
      void this.closeRevokedSockets(event);
    });
  }

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


  // ==========================
  // CONNECTION / DISCONNECTION
  // ==========================

  /**
   * socket.io runs this before it accepts a connection, so by the time the
   * client can emit anything (it usually sends chat:join the instant it is
   * connected) its identity is already on `client.data`. A socket that fails
   * here never connects; the client sees a connect_error.
   */
  afterInit(server: Server) {
    this.broadcaster.attach(server);
    server.use((socket, next) => {
      this.authenticateSocket(socket).then(
        (ok) => next(ok ? undefined : new Error('Unauthorized')),
        (error) => {
          this.logger.error('❌ Chat auth error:', error);
          next(new Error('Unauthorized'));
        },
      );
    });
  }

  private async authenticateSocket(client: Socket): Promise<boolean> {
    // Try multiple places for token
    let token: string | null = null;

    // 1. Try cookies
    const cookieHeader = client.handshake.headers.cookie;

    if (cookieHeader) {
      const cookies = parseCookie(String(cookieHeader)) as Record<
        string,
        string
      >;

      token = cookies['accessToken'] || null;
    }

    // 2. Try auth object
    if (!token && client.handshake.auth?.token) {
      token = client.handshake.auth.token as string;
    }

    // 3. Try query params
    if (!token && client.handshake.query?.token) {
      token = client.handshake.query.token as string;
    }

    // 4. Try headers
    if (!token && client.handshake.headers?.authorization) {
      const authHeader = client.handshake.headers.authorization as string;

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token || typeof token !== 'string') {
      this.logger.warn('❌ No token found anywhere, refusing connection');
      return false;
    }

    // Signature, expiry, live session and existing user: same rules as HTTP
    const authed = await this.authService.authenticateAccessToken(token);
    if (!authed) {
      this.logger.warn('❌ Invalid token, revoked session or unknown user, refusing connection');
      return false;
    }

    client.data.userId = authed.user.id;
    client.data.token = token;
    client.data.sessionId = authed.sessionId;
    client.data.familyId = authed.familyId;
    return true;
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`🟡 New connection: ${client.id}`);

      try {
        const userId = client.data.userId as string | undefined;

        if (!userId) {
          // The auth middleware only lets authenticated sockets through
          throw new Error('Socket reached the connection handler unauthenticated');
        }

        this.logger.log(
          `✅ User ${userId} authenticated via socket ${client.id}`,
        );

        // Every tab / device of a user shares one personal room, on any instance
        await client.join(userRoom(userId));

        // Send connection confirmation
        client.emit('connection:established', {
          userId,
          socketId: client.id,
          message: 'Connected to chat server',
        });

        // Join all chat rooms
        try {
          const chats = await this.prisma.chat.findMany({
            where: {
              participants: {
                some: { userId },
              },
            },
            select: { id: true },
          });

          for (const chat of chats) {
            const roomId = `chat:${chat.id}`;

            await client.join(roomId);

            this.logger.log(`📚 User ${userId} joined room ${roomId}`);
          }

          // Join community rooms
          const communities = await this.prisma.communityMember.findMany({
            where: { userId },
            select: { communityId: true },
          });

          for (const member of communities) {
            const roomId = `community:${member.communityId}`;

            await client.join(roomId);

            this.logger.log(`📚 User ${userId} joined community ${roomId}`);
          }

          // Only the first device announces "online"
          if ((await this.broadcaster.socketCount(userId)) === 1) {
            await this.broadcaster.broadcastPresence(
              userId,
              true,
              chats.map((c) => c.id),
              communities.map((m) => m.communityId),
            );
          }

          this.logger.log(
            `✅ User ${userId} fully connected with ${chats.length} chat rooms and ${communities.length} communities`,
          );

          // Send initial online users list (respecting everyone's privacy)
          client.emit('users:online', {
            users: await this.broadcaster.visibleOnlineUsers(userId),
          });

          // This device can now receive: messages waiting for it are "delivered"
          const delivered = await this.features.markDeliveredFor(userId);
          for (const chatId of delivered.chatIds) {
            this.broadcaster.emitToChat(chatId, 'messages:delivered', { chatId, at: delivered.at });
          }
        } catch (dbError) {
          this.logger.error('Database error during connection:', dbError);

          client.emit('warning', {
            message: 'Some features may be unavailable',
          });
        }
      } catch (jwtError) {
        this.logger.error('❌ Chat connection setup failed:', jwtError);

        client.emit('error', {
          message: 'Invalid token',
        });

        client.disconnect();

        return;
      }
    } catch (error) {
      this.logger.error('❌ WebSocket connection error:', error);

      client.emit('error', {
        message: 'Connection failed',
      });

      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    this.logger.log(
      `🔴 Client ${client.id} disconnected (User: ${userId || 'unknown'})`,
    );

    if (userId) {
      // "Last seen" for chat headers
      this.prisma.profile
        .updateMany({ where: { userId }, data: { lastActive: new Date() } })
        .catch(() => undefined);

      // Remove from typing users
      for (const [roomId, users] of this.state.typingUsers.entries()) {
        if (users.has(userId)) {
          users.delete(userId);

          if (users.size === 0) {
            this.state.typingUsers.delete(roomId);
          }

          this.server.to(roomId).emit('typing:stop', {
            userId,
            chatId: roomId.startsWith('chat:')
              ? roomId.replace('chat:', '')
              : undefined,
            communityId: roomId.startsWith('community:')
              ? roomId.replace('community:', '')
              : undefined,
          });
        }
      }

      // This socket has already left its rooms; offline once no other tab /
      // device (on any instance) is left
      {
        if ((await this.broadcaster.socketCount(userId)) === 0) {
          this.logger.log(`👤 User ${userId} is now offline`);

          // Notify chat partners (respecting everyone's privacy)
          try {
            const chats = await this.prisma.chat.findMany({
              where: {
                participants: {
                  some: { userId },
                },
              },
              select: { id: true },
            });

            const communities = await this.prisma.communityMember.findMany({
              where: { userId },
              select: { communityId: true },
            });

            await this.broadcaster.broadcastPresence(
              userId,
              false,
              chats.map((c) => c.id),
              communities.map((m) => m.communityId),
            );
          } catch (error) {
            this.logger.error('Error notifying offline status:', error);
          }
        }
      }
    }
  }


  // ==========================
  // ROOM MEMBERSHIP
  // ==========================

  @SubscribeMessage('chat:join')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = client.data.userId;

    if (!userId || !data?.chatId) {
      client.emit('error', {
        message: 'Invalid request',
      });

      return;
    }

    try {
      const participant = await this.prisma.chatParticipant.findUnique({
        where: {
          chatId_userId: {
            chatId: data.chatId,
            userId,
          },
        },
      });

      if (!participant) {
        client.emit('error', {
          message: 'You are not a participant in this chat',
        });

        return;
      }

      await client.join(`chat:${data.chatId}`);

      this.logger.log(`User ${userId} joined chat ${data.chatId}`);

      client.emit('chat:joined', {
        chatId: data.chatId,
      });

      client.to(`chat:${data.chatId}`).emit('user:online', { userId });
    } catch (error) {
      this.logger.error('Error joining chat:', error);

      client.emit('error', {
        message: 'Failed to join chat',
      });
    }
  }

  @SubscribeMessage('chat:leave')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!data?.chatId) return;

    await client.leave(`chat:${data.chatId}`);

    this.logger.log(`User ${client.data.userId} left chat ${data.chatId}`);

    client.emit('chat:left', {
      chatId: data.chatId,
    });

    client.to(`chat:${data.chatId}`).emit('user:offline', {
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('community:join')
  async handleJoinCommunity(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { communityId: string },
  ) {
    const userId = client.data.userId;

    if (!userId || !data?.communityId) {
      client.emit('error', {
        message: 'Invalid request',
      });

      return;
    }

    try {
      const member = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: data.communityId,
            userId,
          },
        },
      });

      if (!member) {
        client.emit('error', {
          message: 'You are not a member of this community',
        });

        return;
      }

      await client.join(`community:${data.communityId}`);

      client
        .to(`community:${data.communityId}`)
        .emit('user:online', { userId });

      this.logger.log(`User ${userId} joined community ${data.communityId}`);

      client.emit('community:joined', {
        communityId: data.communityId,
      });
    } catch (error) {
      this.logger.error('Error joining community:', error);

      client.emit('error', {
        message: 'Failed to join community',
      });
    }
  }

  @SubscribeMessage('community:leave')
  async handleLeaveCommunity(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { communityId: string },
  ) {
    if (!data?.communityId) return;

    await client.leave(`community:${data.communityId}`);

    this.logger.log(
      `User ${client.data.userId} left community ${data.communityId}`,
    );

    client.emit('community:left', {
      communityId: data.communityId,
    });

    client.to(`community:${data.communityId}`).emit('user:offline', {
      userId: client.data.userId,
    });
  }

  // ==========================
  // ONLINE USERS
  // ==========================

  @SubscribeMessage('users:getOnline')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    client.emit('users:online', {
      users: await this.broadcaster.visibleOnlineUsers(userId),
    });
  }
}
