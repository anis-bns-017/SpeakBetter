import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { parse as parseCookie } from 'cookie';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma.service';

@WebSocketGateway({
  cors: {
    origin: /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
    ],
  },
  namespace: 'chat',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets: Map<string, string[]> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();
  private readonly CONNECTION_TIMEOUT = 30000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  // ==========================
  // CONNECTION / DISCONNECTION
  // ==========================

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`🟡 New connection attempt: ${client.id}`);

      // Set connection timeout
      const timeout = setTimeout(() => {
        if (!client.data.userId) {
          this.logger.warn(`⏱️ Connection timeout for ${client.id}`);
          client.disconnect();
        }
      }, this.CONNECTION_TIMEOUT);

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

        this.logger.log(`📡 Token from cookies: ${!!token}`);
      }

      // 2. Try auth object
      if (!token && client.handshake.auth?.token) {
        token = client.handshake.auth.token as string;

        this.logger.log(`📡 Token from auth: ${!!token}`);
      }

      // 3. Try query params
      if (!token && client.handshake.query?.token) {
        token = client.handshake.query.token as string;

        this.logger.log(`📡 Token from query: ${!!token}`);
      }

      // 4. Try headers
      if (!token && client.handshake.headers?.authorization) {
        const authHeader = client.handshake.headers.authorization as string;

        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);

          this.logger.log(`📡 Token from authorization header: ${!!token}`);
        }
      }

      if (!token) {
        this.logger.warn('❌ No token found anywhere, disconnecting');

        clearTimeout(timeout);

        client.emit('error', {
          message: 'Authentication required',
        });

        client.disconnect();

        return;
      }

      this.logger.log(`🔑 Token present`);

      try {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
        });

        const userId = payload.sub || payload.userId;

        if (!userId) {
          throw new Error('No user ID in token');
        }

        client.data.userId = userId;
        client.data.token = token;

        clearTimeout(timeout);

        this.logger.log(
          `✅ User ${userId} authenticated via socket ${client.id}`,
        );

        // Store socket
        const sockets = this.userSockets.get(userId) || [];

        sockets.push(client.id);

        this.userSockets.set(userId, sockets);

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

            client.to(roomId).emit('user:online', { userId });
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

            client.to(roomId).emit('user:online', { userId });
          }

          this.logger.log(
            `✅ User ${userId} fully connected with ${chats.length} chat rooms and ${communities.length} communities`,
          );

          // Send initial online users list
          const onlineUsers = Array.from(this.userSockets.keys());

          client.emit('users:online', {
            users: onlineUsers,
          });
        } catch (dbError) {
          this.logger.error('Database error during connection:', dbError);

          client.emit('warning', {
            message: 'Some features may be unavailable',
          });
        }
      } catch (jwtError) {
        this.logger.error('❌ JWT verification failed:', jwtError);

        clearTimeout(timeout);

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
      // Remove from typing users
      for (const [roomId, users] of this.typingUsers.entries()) {
        if (users.has(userId)) {
          users.delete(userId);

          if (users.size === 0) {
            this.typingUsers.delete(roomId);
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

      // Remove socket
      const sockets = this.userSockets.get(userId) || [];

      const index = sockets.indexOf(client.id);

      if (index > -1) {
        sockets.splice(index, 1);

        if (sockets.length === 0) {
          this.userSockets.delete(userId);

          this.logger.log(`👤 User ${userId} is now offline`);

          // Notify chat rooms
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
              client.to(`chat:${chat.id}`).emit('user:offline', { userId });
            }

            const communities = await this.prisma.communityMember.findMany({
              where: { userId },
              select: { communityId: true },
            });

            for (const member of communities) {
              client
                .to(`community:${member.communityId}`)
                .emit('user:offline', { userId });
            }
          } catch (error) {
            this.logger.error('Error notifying offline status:', error);
          }
        } else {
          this.userSockets.set(userId, sockets);
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
  // MESSAGE - SEND
  // ==========================

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chatId?: string;
      communityId?: string;
      content?: string;
      type?: string;
      mediaUrl?: string;
      fileUrl?: string;
      replyToId?: string;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('message:error', {
        message: 'Unauthenticated',
      });

      return;
    }

    if (!data.content && !data.mediaUrl && !data.fileUrl) {
      client.emit('message:error', {
        message: 'Message content is required',
      });

      return;
    }

    if (!data.chatId && !data.communityId) {
      client.emit('message:error', {
        message: 'chatId or communityId is required',
      });

      return;
    }

    try {
      const message = await this.chatService.sendMessage(userId, {
        chatId: data.chatId,
        communityId: data.communityId,
        content: data.content || '',
        type: data.type || 'TEXT',
        mediaUrl: data.mediaUrl,
        fileUrl: data.fileUrl,
        replyToId: data.replyToId,
      });

      let roomId: string | null = null;

      if (data.chatId) {
        roomId = `chat:${data.chatId}`;
      } else if (data.communityId) {
        roomId = `community:${data.communityId}`;
      }

      if (roomId) {
        this.server.to(roomId).emit('message:new', message);

        client.emit('message:sent', message);

        this.logger.log(`📤 Message sent to ${roomId} by user ${userId}`);
      }
    } catch (error: any) {
      this.logger.error('Error sending message:', error);

      client.emit('message:error', {
        error: error.message || 'Failed to send message',
      });
    }
  }

  // ==========================
  // VOICE MESSAGE
  // ==========================

  @SubscribeMessage('voice:message:send')
  async handleVoiceMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chatId?: string;
      communityId?: string;
      audioUrl: string;
      duration: number;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('message:error', {
        message: 'Unauthenticated',
      });

      return;
    }

    if (!data.chatId && !data.communityId) {
      client.emit('message:error', {
        message: 'chatId or communityId is required',
      });

      return;
    }

    try {
      const message = await this.chatService.sendMessage(userId, {
        chatId: data.chatId,
        communityId: data.communityId,
        content: '🎤 Voice message',
        type: 'VOICE_NOTE',
        mediaUrl: data.audioUrl,
      });

      let roomId: string | null = null;

      if (data.chatId) {
        roomId = `chat:${data.chatId}`;
      } else if (data.communityId) {
        roomId = `community:${data.communityId}`;
      }

      if (roomId) {
        this.server.to(roomId).emit('voice:message:new', message);

        client.emit('voice:message:sent', message);

        this.logger.log(`🎤 Voice message sent to ${roomId} by user ${userId}`);
      }
    } catch (error: any) {
      this.logger.error('Error sending voice message:', error);

      client.emit('message:error', {
        error: error.message || 'Failed to send voice message',
      });
    }
  }

  // ==========================
  // MESSAGE - DELETE
  // ==========================

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('message:error', {
        message: 'Unauthenticated',
      });

      return;
    }

    try {
      const message = await this.chatService.deleteMessage(
        userId,
        data.messageId,
      );

      if (message) {
        let roomId: string | null = null;

        if (message.chatId) {
          roomId = `chat:${message.chatId}`;
        } else if (message.communityId) {
          roomId = `community:${message.communityId}`;
        }

        if (roomId) {
          this.server.to(roomId).emit('message:deleted', {
            messageId: data.messageId,
            userId,
            chatId: message.chatId,
            communityId: message.communityId,
          });

          client.emit('message:deleted', {
            messageId: data.messageId,
            success: true,
          });
        }
      }
    } catch (error: any) {
      this.logger.error('Error deleting message:', error);

      client.emit('message:error', {
        error: error.message || 'Failed to delete message',
      });
    }
  }

  // ==========================
  // MESSAGE - EDIT
  // ==========================

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      messageId: string;
      content: string;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('message:error', {
        message: 'Unauthenticated',
      });

      return;
    }

    if (!data.content) {
      client.emit('message:error', {
        message: 'Content is required',
      });

      return;
    }

    try {
      const message = await this.chatService.editMessage(
        userId,
        data.messageId,
        data.content,
      );

      if (message) {
        let roomId: string | null = null;

        if (message.chatId) {
          roomId = `chat:${message.chatId}`;
        } else if (message.communityId) {
          roomId = `community:${message.communityId}`;
        }

        if (roomId) {
          this.server.to(roomId).emit('message:edited', message);

          client.emit('message:edited', message);
        }
      }
    } catch (error: any) {
      this.logger.error('Error editing message:', error);

      client.emit('message:error', {
        error: error.message || 'Failed to edit message',
      });
    }
  }

  // ==========================
  // TYPING INDICATORS
  // ==========================

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chatId?: string;
      communityId?: string;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) return;

    const roomId = data.chatId
      ? `chat:${data.chatId}`
      : data.communityId
        ? `community:${data.communityId}`
        : null;

    if (!roomId) return;

    if (!this.typingUsers.has(roomId)) {
      this.typingUsers.set(roomId, new Set());
    }

    this.typingUsers.get(roomId)!.add(userId);

    client.to(roomId).emit('typing:start', {
      userId,
      chatId: data.chatId,
      communityId: data.communityId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chatId?: string;
      communityId?: string;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) return;

    const roomId = data.chatId
      ? `chat:${data.chatId}`
      : data.communityId
        ? `community:${data.communityId}`
        : null;

    if (!roomId) return;

    const users = this.typingUsers.get(roomId);

    if (users) {
      users.delete(userId);

      if (users.size === 0) {
        this.typingUsers.delete(roomId);
      }
    }

    client.to(roomId).emit('typing:stop', {
      userId,
      chatId: data.chatId,
      communityId: data.communityId,
    });
  }

  // ==========================
  // READ RECEIPTS
  // ==========================

  @SubscribeMessage('message:read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chatId: string;
      messageId: string;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('error', {
        message: 'Unauthenticated',
      });

      return;
    }

    try {
      await this.chatService.markMessageRead(
        userId,
        data.chatId,
        data.messageId,
      );

      client.to(`chat:${data.chatId}`).emit('message:read', {
        userId,
        messageId: data.messageId,
        chatId: data.chatId,
      });
    } catch (error) {
      this.logger.error('Error marking message as read:', error);

      client.emit('error', {
        message: 'Failed to mark message as read',
      });
    }
  }

  // ==========================
  // REACTIONS
  // ==========================

  @SubscribeMessage('reaction:add')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      messageId: string;
      emoji: string;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('reaction:error', {
        message: 'Unauthenticated',
      });

      return;
    }

    try {
      const reaction = await this.chatService.addReaction(
        userId,
        data.messageId,
        data.emoji,
      );

      const message = await this.prisma.message.findUnique({
        where: {
          id: data.messageId,
        },
        select: {
          chatId: true,
          communityId: true,
        },
      });

      if (message) {
        let roomId: string | null = null;

        if (message.chatId) {
          roomId = `chat:${message.chatId}`;
        } else if (message.communityId) {
          roomId = `community:${message.communityId}`;
        }

        if (roomId) {
          this.server.to(roomId).emit('reaction:new', reaction);
        }
      }
    } catch (error: any) {
      this.logger.error('Error adding reaction:', error);

      client.emit('reaction:error', {
        error: error.message || 'Failed to add reaction',
      });
    }
  }

  @SubscribeMessage('reaction:remove')
  async handleRemoveReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      messageId: string;
      emoji: string;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('reaction:error', {
        message: 'Unauthenticated',
      });

      return;
    }

    try {
      await this.chatService.removeReaction(userId, data.messageId, data.emoji);

      const message = await this.prisma.message.findUnique({
        where: {
          id: data.messageId,
        },
        select: {
          chatId: true,
          communityId: true,
        },
      });

      if (message) {
        let roomId: string | null = null;

        if (message.chatId) {
          roomId = `chat:${message.chatId}`;
        } else if (message.communityId) {
          roomId = `community:${message.communityId}`;
        }

        if (roomId) {
          this.server.to(roomId).emit('reaction:removed', {
            messageId: data.messageId,
            userId,
            emoji: data.emoji,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error removing reaction:', error);

      client.emit('reaction:error', {
        error: 'Failed to remove reaction',
      });
    }
  }

  // ==========================
  // CHAT HISTORY / MESSAGES FETCH
  // ==========================

  @SubscribeMessage('messages:fetch')
  async handleFetchMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chatId?: string;
      communityId?: string;
      limit?: number;
      before?: string;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('message:error', {
        message: 'Unauthenticated',
      });

      return;
    }

    try {
      let messages;

      if (data.chatId) {
        const participant = await this.prisma.chatParticipant.findUnique({
          where: {
            chatId_userId: {
              chatId: data.chatId,
              userId,
            },
          },
        });

        if (!participant) {
          client.emit('message:error', {
            message: 'You are not a participant in this chat',
          });

          return;
        }

        messages = await this.chatService.getMessages(userId, {
          chatId: data.chatId,
          limit: data.limit ? String(data.limit) : '50',
          before: data.before,
        });
      } else if (data.communityId) {
        const member = await this.prisma.communityMember.findUnique({
          where: {
            communityId_userId: {
              communityId: data.communityId,
              userId,
            },
          },
        });

        if (!member) {
          client.emit('message:error', {
            message: 'You are not a member of this community',
          });

          return;
        }

        messages = await this.chatService.getCommunityMessages(
          userId,
          data.communityId,
          data.limit || 50,
          data.before,
        );
      } else {
        client.emit('message:error', {
          message: 'chatId or communityId is required',
        });

        return;
      }

      client.emit('messages:list', messages);
    } catch (error: any) {
      this.logger.error('Error fetching messages:', error);

      client.emit('message:error', {
        error: error.message || 'Failed to fetch messages',
      });
    }
  }

  // ==========================
  // PIN MESSAGES
  // ==========================

  @SubscribeMessage('message:pin')
  async handlePinMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      messageId: string;
      pinned: boolean;
    },
  ) {
    const userId = client.data.userId;

    if (!userId) {
      client.emit('error', {
        message: 'Unauthenticated',
      });

      return;
    }

    try {
      const message = await this.chatService.pinMessage(
        userId,
        data.messageId,
        data.pinned,
      );

      if (message) {
        let roomId: string | null = null;

        if (message.chatId) {
          roomId = `chat:${message.chatId}`;
        } else if (message.communityId) {
          roomId = `community:${message.communityId}`;
        }

        if (roomId) {
          this.server.to(roomId).emit('message:pinned', {
            messageId: data.messageId,
            pinned: data.pinned,
            userId,
          });

          client.emit('message:pinned', {
            messageId: data.messageId,
            pinned: data.pinned,
            success: true,
          });
        }
      }
    } catch (error: any) {
      this.logger.error('Error pinning message:', error);

      client.emit('error', {
        error: error.message || 'Failed to pin message',
      });
    }
  }

  // ==========================
  // ONLINE USERS
  // ==========================

  @SubscribeMessage('users:getOnline')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUsers = Array.from(this.userSockets.keys());

    client.emit('users:online', {
      users: onlineUsers,
    });
  }
}
