// server/src/voice/voice.gateway.ts

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
import { parse } from 'cookie';
import { Logger } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { PrismaService } from '../prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: 'voice',
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private roomParticipants: Map<string, Set<string>> = new Map();
  private roomHosts: Map<string, string> = new Map();
  private userSockets: Map<string, string[]> = new Map();
  private userNames: Map<string, string> = new Map();

  constructor(
    private jwtService: JwtService,
    private voiceService: VoiceService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) {
        this.logger.warn('No cookie header, disconnecting');
        client.disconnect();
        return;
      }

      const cookies = parse(cookieHeader);
      const token = cookies['accessToken'];
      if (!token) {
        this.logger.warn('No access token, disconnecting');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      const userId = payload.sub;
      client.data.userId = userId;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      if (user) {
        client.data.userName = user.name;
        this.userNames.set(userId, user.name);
      }

      const sockets = this.userSockets.get(userId) || [];
      sockets.push(client.id);
      this.userSockets.set(userId, sockets);

      this.logger.log(`✅ User ${userId} connected to voice socket`);
    } catch (error) {
      this.logger.error('VoiceGateway auth error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const sockets = this.userSockets.get(userId) || [];
    const index = sockets.indexOf(client.id);
    if (index > -1) {
      sockets.splice(index, 1);
      if (sockets.length === 0) {
        this.userSockets.delete(userId);
        this.userNames.delete(userId);
      } else {
        this.userSockets.set(userId, sockets);
      }
    }

    for (const [roomId, participants] of this.roomParticipants) {
      if (participants.has(userId)) {
        participants.delete(userId);
        if (participants.size === 0) {
          this.roomParticipants.delete(roomId);
          this.roomHosts.delete(roomId);
        } else {
          if (this.roomHosts.get(roomId) === userId) {
            const room = await this.prisma.voiceRoom.findUnique({
              where: { id: roomId },
              select: { creatorId: true },
            });

            if (room && room.creatorId === userId) {
              const newHost = Array.from(participants)[0];
              if (newHost) {
                this.roomHosts.set(roomId, newHost);
                this.server.to(`voice:${roomId}`).emit('voice:host-changed', {
                  newHostId: newHost,
                });
              }
            }
          }
        }
        this.server.to(`voice:${roomId}`).emit('participant:left', { userId });
      }
    }

    this.logger.log(`User ${userId} disconnected from voice`);
  }

  // ============ JOIN / LEAVE ============

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
      if (!this.roomParticipants.has(data.roomId)) {
        this.roomParticipants.set(data.roomId, new Set());
      }
      this.roomParticipants.get(data.roomId)!.add(userId);

      if (!this.roomHosts.has(data.roomId)) {
        this.roomHosts.set(data.roomId, room.creatorId);
      }

      // Send current participants
      const participants = Array.from(
        this.roomParticipants.get(data.roomId) || [],
      );

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

      const hostId = this.roomHosts.get(data.roomId) || room.creatorId;
      client.emit('voice:host', { hostId });

      const userName = this.userNames.get(userId) || 'User';

      client.to(roomName).emit('participant:joined', {
        userId,
        userName,
      });

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

  broadcastTranscription(roomId: string, data: any) {
    this.server.to(`voice:${roomId}`).emit('transcription', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastClap(roomId: string, data: any) {
    this.server.to(`voice:${roomId}`).emit('clap-received', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastQueueUpdate(roomId: string, queue: any[]) {
    this.server.to(`voice:${roomId}`).emit('queue-updated', {
      queue,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantUpdate(roomId: string, data: any) {
    this.server.to(`voice:${roomId}`).emit('participant-updated', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantJoined(roomId: string, participant: any) {
    this.server.to(`voice:${roomId}`).emit('participant-joined', {
      participant,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantLeft(roomId: string, data: any) {
    this.server.to(`voice:${roomId}`).emit('participant-left', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantMuted(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('participant-muted', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantUnmuted(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('participant-unmuted', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastHandRaised(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('hand-raised', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastHandLowered(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('hand-lowered', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastRecordingStarted(roomId: string) {
    this.server.to(`voice:${roomId}`).emit('recording-started', {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastRecordingStopped(roomId: string) {
    this.server.to(`voice:${roomId}`).emit('recording-stopped', {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastParticipantKicked(roomId: string, userId: string) {
    this.server.to(`voice:${roomId}`).emit('participant-kicked', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastMuteAll(roomId: string) {
    this.server.to(`voice:${roomId}`).emit('mute-all', {
      timestamp: new Date().toISOString(),
    });
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

    try {
      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId },
        },
        data: { leftAt: new Date() },
      });

      const roomName = `voice:${data.roomId}`;
      await client.leave(roomName);

      const participants = this.roomParticipants.get(data.roomId);
      if (participants) {
        participants.delete(userId);
        if (participants.size === 0) {
          this.roomParticipants.delete(data.roomId);
          this.roomHosts.delete(data.roomId);
        } else {
          if (this.roomHosts.get(data.roomId) === userId) {
            const room = await this.prisma.voiceRoom.findUnique({
              where: { id: data.roomId },
              select: { creatorId: true },
            });

            if (room && room.creatorId === userId) {
              const newHost = Array.from(participants)[0];
              if (newHost) {
                this.roomHosts.set(data.roomId, newHost);
                this.server.to(roomName).emit('voice:host-changed', {
                  newHostId: newHost,
                });
              }
            }
          }
        }
      }

      client.to(roomName).emit('participant:left', { userId });

      this.logger.log(`User ${userId} left voice room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error leaving voice room:', error);
      client.emit('voice:error', { message: 'Failed to leave room' });
    }
  }

  // ============ SPEAKING STATUS ============

  @SubscribeMessage('voice:speaking')
  async handleSpeaking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isSpeaking: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const roomName = `voice:${data.roomId}`;
    this.server.to(roomName).emit('voice:speaking-status', {
      userId,
      isSpeaking: data.isSpeaking,
    });

    this.logger.log(`🎤 User ${userId} speaking: ${data.isSpeaking}`);
  }

  // ============ CHAT MESSAGES ============

  @SubscribeMessage('voice:chat')
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      content: string;
      replyToId?: string;
    },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      // ✅ Check if user is in the room
      const participants = this.roomParticipants.get(data.roomId);
      if (!participants || !participants.has(userId)) {
        client.emit('voice:error', { message: 'You are not in this room' });
        return;
      }

      // ✅ Save to database
      const messageData: any = {
        roomId: data.roomId,
        senderId: userId,
        content: data.content,
      };

      if (data.replyToId) {
        messageData.replyToId = data.replyToId;
      }

      const message = await this.prisma.voiceRoomMessage.create({
        data: messageData,
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

      const hostId = this.roomHosts.get(data.roomId);
      const isHost = hostId === userId;

      const messageWithHost = {
        ...message,
        isHost,
        isPinned: false,
        isDeleted: false,
        type: 'TEXT',
      };

      // ✅ Broadcast to ALL clients in the room (including sender)
      const roomName = `voice:${data.roomId}`;

      // ✅ FIX: Use room name consistently
      this.server.to(roomName).emit('voice:chat', messageWithHost);

      this.logger.log(`💬 Message from ${userId} in ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error sending voice room chat:', error);
      client.emit('voice:error', { message: 'Failed to send message' });
    }
  }
  // ============ TYPING INDICATOR ============

  @SubscribeMessage('voice:typing-start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const userName = this.userNames.get(userId) || 'User';
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
    if (!userId) return;

    const roomName = `voice:${data.roomId}`;
    client.to(roomName).emit('voice:typing-stop', {
      userId,
    });
  }

  // ============ HOST CONTROLS ============

  @SubscribeMessage('voice:kick')
  async handleKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      if (room.creatorId !== userId) {
        client.emit('voice:error', {
          message: 'Only the host can kick members',
        });
        return;
      }

      if (room.creatorId === data.userId) {
        client.emit('voice:error', { message: 'Cannot kick the host' });
        return;
      }

      await this.prisma.voiceParticipant.delete({
        where: {
          roomId_userId: { roomId: data.roomId, userId: data.userId },
        },
      });

      const participants = this.roomParticipants.get(data.roomId);
      if (participants) {
        participants.delete(data.userId);
      }

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:kicked', {
        userId: data.userId,
        kickedBy: userId,
      });

      const kickedUserSockets = this.userSockets.get(data.userId);
      if (kickedUserSockets) {
        for (const socketId of kickedUserSockets) {
          const socket = this.server.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('voice:kicked', {
              roomId: data.roomId,
              reason: 'You were kicked by the host',
            });
            socket.leave(roomName);
          }
        }
      }

      this.logger.log(`User ${data.userId} kicked from room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error kicking user:', error);
      client.emit('voice:error', { message: 'Failed to kick user' });
    }
  }

  @SubscribeMessage('voice:promote-host')
  async handlePromoteHost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      if (room.creatorId !== userId) {
        client.emit('voice:error', {
          message: 'Only the host can promote another host',
        });
        return;
      }

      if (room.creatorId === data.userId) {
        client.emit('voice:error', { message: 'User is already the host' });
        return;
      }

      await this.prisma.voiceRoom.update({
        where: { id: data.roomId },
        data: { creatorId: data.userId },
      });

      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId: data.userId },
        },
        data: { role: 'MODERATOR' },
      });

      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId },
        },
        data: { role: 'LISTENER' },
      });

      this.roomHosts.set(data.roomId, data.userId);

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:host-changed', {
        newHostId: data.userId,
        oldHostId: userId,
      });

      this.logger.log(
        `Host changed from ${userId} to ${data.userId} in room ${data.roomId}`,
      );
    } catch (error) {
      this.logger.error('Error promoting host:', error);
      client.emit('voice:error', { message: 'Failed to promote host' });
    }
  }

  @SubscribeMessage('voice:mute-user')
  async handleMuteUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      if (room.creatorId !== userId) {
        client.emit('voice:error', {
          message: 'Only the host can mute members',
        });
        return;
      }

      if (room.creatorId === data.userId) {
        client.emit('voice:error', { message: 'Cannot mute the host' });
        return;
      }

      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId: data.userId },
        },
        data: { isMuted: true },
      });

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:muted', {
        userId: data.userId,
        mutedBy: userId,
      });

      this.logger.log(`User ${data.userId} muted in room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error muting user:', error);
      client.emit('voice:error', { message: 'Failed to mute user' });
    }
  }

  @SubscribeMessage('voice:unmute-user')
  async handleUnmuteUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      if (room.creatorId !== userId) {
        client.emit('voice:error', {
          message: 'Only the host can unmute members',
        });
        return;
      }

      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId: data.userId },
        },
        data: { isMuted: false },
      });

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:unmuted', {
        userId: data.userId,
        unmutedBy: userId,
      });

      this.logger.log(`User ${data.userId} unmuted in room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error unmuting user:', error);
      client.emit('voice:error', { message: 'Failed to unmute user' });
    }
  }

  @SubscribeMessage('voice:promote')
  async handlePromote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      if (room.creatorId !== userId) {
        client.emit('voice:error', {
          message: 'Only the host can promote members to moderator',
        });
        return;
      }

      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId: data.userId },
        },
        data: { role: 'MODERATOR' },
      });

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:promoted', {
        userId: data.userId,
        promotedBy: userId,
      });

      this.logger.log(
        `User ${data.userId} promoted to moderator in room ${data.roomId}`,
      );
    } catch (error) {
      this.logger.error('Error promoting user:', error);
      client.emit('voice:error', { message: 'Failed to promote user' });
    }
  }

  @SubscribeMessage('voice:demote')
  async handleDemote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      if (room.creatorId !== userId) {
        client.emit('voice:error', {
          message: 'Only the host can demote members',
        });
        return;
      }

      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId: data.userId },
        },
        data: { role: 'LISTENER' },
      });

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:demoted', {
        userId: data.userId,
        demotedBy: userId,
      });

      this.logger.log(`User ${data.userId} demoted in room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error demoting user:', error);
      client.emit('voice:error', { message: 'Failed to demote user' });
    }
  }

  // ============ RAISE HAND ============

  @SubscribeMessage('voice:raise-hand')
  async handleRaiseHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; raise: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId },
        },
        data: { raisedHand: data.raise },
      });

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:hand-raised', {
        userId,
        raised: data.raise,
      });

      this.logger.log(
        `User ${userId} ${data.raise ? 'raised' : 'lowered'} hand in ${data.roomId}`,
      );
    } catch (error) {
      this.logger.error('Error raising hand:', error);
      client.emit('voice:error', { message: 'Failed to raise hand' });
    }
  }

  // ============ DELETE MESSAGE ============

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
      const message = await this.prisma.voiceRoomMessage.findUnique({
        where: { id: data.messageId },
        select: { senderId: true },
      });

      if (!message) {
        client.emit('voice:error', { message: 'Message not found' });
        return;
      }

      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
        select: { creatorId: true },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      const isHost = room.creatorId === userId;
      const isOwner = message.senderId === userId;

      if (!isHost && !isOwner) {
        client.emit('voice:error', {
          message: 'You do not have permission to delete this message',
        });
        return;
      }

      await this.prisma.voiceRoomMessage.delete({
        where: { id: data.messageId },
      });

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:message-deleted', {
        messageId: data.messageId,
        deletedBy: userId,
      });

      this.logger.log(`Message ${data.messageId} deleted in ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error deleting message:', error);
      client.emit('voice:error', { message: 'Failed to delete message' });
    }
  }

  // ============ MUTE SELF ============

  @SubscribeMessage('voice:mute-self')
  async handleMuteSelf(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; muted: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('voice:error', { message: 'Unauthenticated' });
      return;
    }

    try {
      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId },
        },
        data: { isMuted: data.muted },
      });

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:self-muted', {
        userId,
        muted: data.muted,
      });

      this.logger.log(
        `User ${userId} ${data.muted ? 'muted' : 'unmuted'} self in ${data.roomId}`,
      );
    } catch (error) {
      this.logger.error('Error muting self:', error);
      client.emit('voice:error', { message: 'Failed to mute self' });
    }
  }

  // ============ FETCH MESSAGE HISTORY ============

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
      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
      });

      if (!room) {
        client.emit('voice:error', { message: 'Room not found' });
        return;
      }

      const where: any = {
        roomId: data.roomId,
      };

      if (data.before) {
        const beforeMessage = await this.prisma.voiceRoomMessage.findUnique({
          where: { id: data.before },
          select: { createdAt: true },
        });
        if (beforeMessage) {
          where.createdAt = { lt: beforeMessage.createdAt };
        }
      }

      const messages = await this.prisma.voiceRoomMessage.findMany({
        where,
        take: data.limit || 50,
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

      client.emit('voice:messages', messages.reverse());
    } catch (error) {
      this.logger.error('Error fetching messages:', error);
      client.emit('voice:error', { message: 'Failed to fetch messages' });
    }
  }
}
