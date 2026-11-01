// server/src/voice/realtime/voice-chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { VoiceService } from '../voice.service';
import { VoiceRoomState } from './voice-room-state';
import { VoiceBroadcaster } from './voice-broadcaster';
import { isSocketInRoom } from './room-access';
import { VOICE_GATEWAY_OPTIONS } from './gateway-options';

/**
 * Room chat: messages, edits, pins, reactions, typing and stage reactions.
 */
@WebSocketGateway(VOICE_GATEWAY_OPTIONS)
export class VoiceChatGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceChatGateway.name);

  constructor(
    private readonly voiceService: VoiceService,
    private readonly state: VoiceRoomState,
    private readonly broadcaster: VoiceBroadcaster,
  ) {}

  @SubscribeMessage('voice:chat')
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      content: string;
      type?: string;
      mediaUrl?: string;
      fileUrl?: string;
      replyToId?: string;
      /** Sender's optimistic id, echoed back so it can swap in the saved message */
      clientId?: string;
    },
  ) {
    const userId = client.data.userId;
    const clientId =
      typeof data?.clientId === 'string'
        ? data.clientId.slice(0, 80)
        : undefined;
    const fail = (message: string) =>
      client.emit('voice:chat-error', { clientId, message });

    if (!userId) return fail('Unauthenticated');

    if (!(await this.state.isInRoom(data.roomId, userId))) {
      return fail('You are not in this room');
    }

    try {
      const message = await this.voiceService.sendVoiceRoomMessage(
        userId,
        data.roomId,
        data.content,
        data.type || 'TEXT',
        data.mediaUrl,
        data.fileUrl,
        data.replyToId,
      );
      await this.broadcaster.broadcastChatMessage(data.roomId, message, clientId);
      this.logger.log(`💬 Message from ${userId} in ${data.roomId}`);
    } catch (error) {
      this.logger.warn(`Voice chat send failed: ${error?.message}`);
      fail(error?.message || 'Failed to send message');
    }
  }

  @SubscribeMessage('voice:typing-start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !isSocketInRoom(client, data?.roomId)) return;

    const userName = (client.data.userName as string) || 'User';
    const roomName = `voice:${data.roomId}`;

    client.to(roomName).emit('voice:typing-start', {
      userId,
      userName,
    });
  }

  @SubscribeMessage('voice:typing-stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !isSocketInRoom(client, data?.roomId)) return;

    const roomName = `voice:${data.roomId}`;
    client.to(roomName).emit('voice:typing-stop', {
      userId,
    });
  }

  @SubscribeMessage('voice:edit-message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; messageId: string; content: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const updated = await this.voiceService.editVoiceRoomMessage(
        userId,
        data.roomId,
        data.messageId,
        data.content,
      );
      this.broadcaster.emitToRoom(data.roomId, 'voice:message-edited', {
        messageId: updated.id,
        content: updated.content,
        isEdited: true,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      this.logger.warn(`Voice chat edit failed: ${error?.message}`);
      client.emit('voice:error', {
        message: error?.message || 'Failed to edit message',
      });
    }
  }

  @SubscribeMessage('voice:pin-message')
  async handlePinMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; messageId: string; pin: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      await this.voiceService.pinVoiceRoomMessage(
        userId,
        data.roomId,
        data.messageId,
        !!data.pin,
      );
      this.broadcaster.emitToRoom(data.roomId, 'voice:message-pinned', {
        messageId: data.messageId,
        pinned: !!data.pin,
        pinnedBy: userId,
      });
    } catch (error) {
      this.logger.warn(`Voice chat pin failed: ${error?.message}`);
      client.emit('voice:error', {
        message: error?.message || 'Failed to pin message',
      });
    }
  }

  @SubscribeMessage('voice:stage-reaction')
  handleStageReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; emoji: string },
  ) {
    const userId = (client.data as any)?.userId;
    const userName = (client.data as any)?.userName;
    if (!userId || !data?.roomId || !data?.emoji) return;
    if (!isSocketInRoom(client, data.roomId)) return;

    // Sanitize — cap emoji length so people can't spam giant strings
    const emoji = String(data.emoji).slice(0, 8);
    if (!emoji) return;

    this.server.to(`voice:${data.roomId}`).emit('voice:stage-reaction', {
      id: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      userName,
      emoji,
      createdAt: Date.now(),
    });
  }

  @SubscribeMessage('voice:react-message')
  async handleReactMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; messageId: string; emoji: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const result = await this.voiceService.toggleVoiceRoomMessageReaction(
        userId,
        data.roomId,
        data.messageId,
        data.emoji,
      );

      this.broadcaster.emitToRoom(
        data.roomId,
        'voice:message-reaction',
        result,
      );
    } catch (error) {
      this.logger.error('Error reacting to message:', error);
      client.emit('voice:error', {
        message: error?.message || 'Failed to react to message',
      });
    }
  }

  @SubscribeMessage('voice:delete-message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; messageId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const result = await this.voiceService.deleteVoiceRoomMessage(
        userId,
        data.roomId,
        data.messageId,
      );
      this.broadcaster.emitToRoom(data.roomId, 'voice:message-deleted', result);
      this.logger.log(`Message ${data.messageId} deleted in ${data.roomId}`);
    } catch (error) {
      this.logger.warn(`Voice chat delete failed: ${error?.message}`);
      client.emit('voice:error', {
        message: error?.message || 'Failed to delete message',
      });
    }
  }

  @SubscribeMessage('voice:fetch-messages')
  async handleFetchMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; limit?: number; before?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const messages = await this.voiceService.getVoiceRoomMessages(
        userId,
        data.roomId,
        data.limit || 50,
        data.before,
      );
      client.emit('voice:messages', messages);
    } catch (error) {
      this.logger.error('Error fetching messages:', error);
      client.emit('voice:error', { message: 'Failed to fetch messages' });
    }
  }
}
