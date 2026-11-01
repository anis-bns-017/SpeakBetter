// server/src/chat/realtime/chat-engagement.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from '../chat.service';
import { PrismaService } from '../../prisma.service';
import { ChatPrivacyService } from '../chat-privacy.service';
import { ChatRealtimeState } from './chat-realtime-state';
import { ChatBroadcaster } from './chat-broadcaster';
import { CHAT_GATEWAY_OPTIONS } from './chat-gateway-options';

/**
 * Signals around messages: typing indicators, read receipts and reactions.
 */
@WebSocketGateway(CHAT_GATEWAY_OPTIONS)
export class ChatEngagementGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatEngagementGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
    private readonly privacy: ChatPrivacyService,
    private readonly state: ChatRealtimeState,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

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

    if (!this.state.typingUsers.has(roomId)) {
      this.state.typingUsers.set(roomId, new Set());
    }

    this.state.typingUsers.get(roomId)!.add(userId);

    const payload = { userId, chatId: data.chatId, communityId: data.communityId };
    void this.privacy.get(userId).then(async (mine) => {
      // Typing indicator off: nobody sees you typing (and you don't see others)
      if (!mine.showTypingIndicator) return;
      if (data.chatId) {
        await this.broadcaster.emitToMembersWho(data.chatId, userId, 'showTypingIndicator', 'typing:start', payload);
      } else {
        client.to(roomId).emit('typing:start', payload);
      }
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

    const users = this.state.typingUsers.get(roomId);

    if (users) {
      users.delete(userId);

      if (users.size === 0) {
        this.state.typingUsers.delete(roomId);
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
      const receipt = await this.chatService.markMessageRead(
        userId,
        data.chatId,
        data.messageId,
      );

      // null = this user turned read receipts off
      if (receipt) {
        await this.broadcaster.emitToMembersWho(data.chatId, userId, 'sendReadReceipts', 'message:read', {
          userId,
          messageId: data.messageId,
          chatId: data.chatId,
        });
      }
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

          client.emit('reaction:new', reaction);
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
      const updatedMessage = await this.chatService.removeReaction(
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
          const payload = {
            messageId: data.messageId,
            userId,
            emoji: data.emoji,
            message: updatedMessage?.message || updatedMessage,
          };

          this.server.to(roomId).emit('reaction:removed', payload);
          client.emit('reaction:removed', payload);
        }
      }
    } catch (error) {
      this.logger.error('Error removing reaction:', error);

      client.emit('reaction:error', {
        error: 'Failed to remove reaction',
      });
    }
  }
}
