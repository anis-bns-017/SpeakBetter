// server/src/chat/realtime/chat-messages.gateway.ts
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
import { ChatBroadcaster } from './chat-broadcaster';
import { CHAT_GATEWAY_OPTIONS } from './chat-gateway-options';

/**
 * Messages: send, voice notes, edit, delete, pin, history and corrections.
 */
@WebSocketGateway(CHAT_GATEWAY_OPTIONS)
export class ChatMessagesGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatMessagesGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

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
      metadata?: Record<string, unknown>;
      isViewOnce?: boolean;
      attachments?: Array<{ url: string; type: 'IMAGE' | 'VIDEO'; filename: string; mimeType?: string; size: number }>;
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
        metadata: data.metadata,
        isViewOnce: data.isViewOnce,
        attachments: Array.isArray(data.attachments)
          ? data.attachments.filter((a) => typeof a?.url === 'string' && a.url.startsWith('https://'))
          : undefined,
      }).then((sent) => this.broadcaster.deliverIfOnline(sent));

      this.broadcaster.emitLinkPreview(message);

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
          this.server.to(roomId).emit('message:deleted', message);

          client.emit('message:deleted', {
            ...message,
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

    const content = data.content?.trim();

    if (!content) {
      client.emit('message:error', {
        message: 'Content is required',
      });

      return;
    }

    try {
      const message = await this.chatService.editMessage(
        userId,
        data.messageId,
        content,
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
  // CORRECTIONS
  // ==========================

  /** The corrected person taps "Got it" on a correction; both sides see it accepted */
  @SubscribeMessage('correction:accept')
  async handleAcceptCorrection(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.messageId) return;

    try {
      const result = await this.chatService.acceptCorrection(userId, data.messageId);
      this.server.to(`chat:${result.chatId}`).emit('correction:accepted', result);
    } catch (error: any) {
      client.emit('message:error', {
        error: error?.message || 'Could not accept correction',
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
          this.server.to(roomId).emit('message:pinned', message);

          client.emit('message:pinned', {
            ...message,
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
}
