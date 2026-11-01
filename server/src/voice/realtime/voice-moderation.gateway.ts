// server/src/voice/realtime/voice-moderation.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { HttpException, Logger } from '@nestjs/common';
import { VoiceService } from '../voice.service';
import { PrismaService } from '../../prisma.service';
import { VoiceRoomState } from './voice-room-state';
import { userRoom } from './room-access';
import { VoiceBroadcaster } from './voice-broadcaster';
import { VOICE_GATEWAY_OPTIONS } from './gateway-options';

/**
 * Host and moderator controls and each person's own state in the room: kick,
 * mute, roles, stage, raised hands.
 */
@WebSocketGateway(VOICE_GATEWAY_OPTIONS)
export class VoiceModerationGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceModerationGateway.name);

  constructor(
    private readonly voiceService: VoiceService,
    private readonly prisma: PrismaService,
    private readonly state: VoiceRoomState,
    private readonly broadcaster: VoiceBroadcaster,
  ) {}

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
      // Host check, ban and removal from the room in one step (see VoiceService)
      const room = await this.voiceService.kickParticipant(
        userId,
        data.roomId,
        data.userId,
      );

      await this.state.removeParticipant(data.roomId, data.userId);

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:kicked', {
        userId: data.userId,
        kickedBy: userId,
      });

      // Tell each of their open tabs, then take them out of the room so they
      // stop receiving (and being allowed to send) its events. Their personal
      // room holds every tab on every server instance.
      this.server.to(userRoom(data.userId)).emit('voice:kicked', {
        roomId: data.roomId,
        reason: 'You were removed from this room by the host',
      });
      this.server.in(userRoom(data.userId)).socketsLeave(roomName);

      // ...and out of the audio room, or they could keep listening and talking
      await this.voiceService.removeFromAudio(room.liveKitRoomId, data.userId);

      this.logger.log(`User ${data.userId} kicked from room ${data.roomId}`);
    } catch (error) {
      if (error instanceof HttpException) {
        // Not allowed / not found: say so instead of a generic failure
        client.emit('voice:error', { message: error.message });
        return;
      }
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

      // New host gets full control; the previous host stays on stage as a speaker
      const newHost = await this.voiceService.applyParticipantRole(
        data.roomId,
        data.userId,
        'MODERATOR',
      );
      const oldHost = await this.voiceService.applyParticipantRole(
        data.roomId,
        userId,
        'SPEAKER',
      );
      this.broadcaster.broadcastRoleChange(
        data.roomId,
        data.userId,
        'MODERATOR',
        newHost.canSpeak,
        userId,
      );
      this.broadcaster.broadcastRoleChange(
        data.roomId,
        userId,
        'SPEAKER',
        oldHost.canSpeak,
        userId,
      );

      await this.state.setHost(data.roomId, data.userId);

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
      // Checks host/moderator rights, saves the flag and mutes the LiveKit track
      await this.voiceService.muteParticipant(userId, data.roomId, data.userId);

      const roomName = `voice:${data.roomId}`;
      this.server.to(roomName).emit('voice:muted', {
        userId: data.userId,
        mutedBy: userId,
      });

      this.logger.log(`User ${data.userId} muted in room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Error muting user:', error);
      client.emit('voice:error', {
        message: error?.message || 'Failed to mute user',
      });
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
      await this.voiceService.unmuteParticipant(
        userId,
        data.roomId,
        data.userId,
      );

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

      const { canSpeak } = await this.voiceService.applyParticipantRole(
        data.roomId,
        data.userId,
        'MODERATOR',
      );
      this.broadcaster.broadcastRoleChange(
        data.roomId,
        data.userId,
        'MODERATOR',
        canSpeak,
        userId,
      );

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

      const { canSpeak } = await this.voiceService.applyParticipantRole(
        data.roomId,
        data.userId,
        'LISTENER',
      );
      this.broadcaster.broadcastRoleChange(
        data.roomId,
        data.userId,
        'LISTENER',
        canSpeak,
        userId,
      );

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

  /** Host/moderator invites someone (usually with a raised hand) onto the stage */
  @SubscribeMessage('voice:promote-speaker')
  async handlePromoteSpeaker(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const actorId = client.data.userId;
    if (!actorId || !data?.roomId || !data?.userId) return;

    try {
      if (!(await this.voiceService.isRoomManager(data.roomId, actorId))) {
        client.emit('voice:error', {
          message: 'Only the host or a moderator can invite speakers',
        });
        return;
      }

      const { participant, canSpeak } =
        await this.voiceService.applyParticipantRole(
          data.roomId,
          data.userId,
          'SPEAKER',
        );

      const roomName = `voice:${data.roomId}`;
      this.broadcaster.broadcastRoleChange(
        data.roomId,
        data.userId,
        participant.role,
        canSpeak,
        actorId,
      );
      this.server.to(roomName).emit('voice:promoted-to-speaker', {
        userId: data.userId,
        by: actorId,
      });
      this.server.to(roomName).emit('voice:hand-raised', {
        userId: data.userId,
        raised: false,
      });
    } catch (error) {
      this.logger.error('Error promoting speaker:', error);
      client.emit('voice:error', { message: 'Failed to invite speaker' });
    }
  }

  /** Back to the audience: a speaker stepping down, or a host moving someone off the stage */
  @SubscribeMessage('voice:move-to-audience')
  async handleMoveToAudience(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const actorId = client.data.userId;
    if (!actorId || !data?.roomId || !data?.userId) return;

    try {
      const isSelf = actorId === data.userId;
      if (
        !isSelf &&
        !(await this.voiceService.isRoomManager(data.roomId, actorId))
      ) {
        client.emit('voice:error', {
          message: 'Only the host or a moderator can move speakers',
        });
        return;
      }

      const room = await this.prisma.voiceRoom.findUnique({
        where: { id: data.roomId },
        select: { creatorId: true },
      });
      if (room?.creatorId === data.userId) {
        client.emit('voice:error', {
          message: 'The host always stays on stage',
        });
        return;
      }

      const { participant, canSpeak } =
        await this.voiceService.applyParticipantRole(
          data.roomId,
          data.userId,
          'LISTENER',
        );

      this.broadcaster.broadcastRoleChange(
        data.roomId,
        data.userId,
        participant.role,
        canSpeak,
        actorId,
      );
    } catch (error) {
      this.logger.error('Error moving participant to audience:', error);
      client.emit('voice:error', { message: 'Failed to move to audience' });
    }
  }

  @SubscribeMessage('voice:lower-hand')
  async handleLowerHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const actorId = client.data.userId;
    if (!actorId || !data?.roomId || !data?.userId) return;

    const isSelf = actorId === data.userId;
    if (
      !isSelf &&
      !(await this.voiceService.isRoomManager(data.roomId, actorId))
    ) {
      client.emit('voice:error', {
        message: "Only the host or a moderator can lower someone's hand",
      });
      return;
    }

    try {
      await this.prisma.voiceParticipant.update({
        where: {
          roomId_userId: { roomId: data.roomId, userId: data.userId },
        },
        data: { raisedHand: false },
      });
    } catch (error) {
      this.logger.warn(`Could not save lowered hand: ${error}`);
    }

    this.server.to(`voice:${data.roomId}`).emit('voice:hand-raised', {
      userId: data.userId,
      raised: false,
    });
  }

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
      const current = await this.prisma.voiceParticipant.findUnique({
        where: { roomId_userId: { roomId: data.roomId, userId } },
        select: { mutedByHost: true },
      });

      // A host mute holds: only the host or a moderator can lift it
      if (current?.mutedByHost && !data.muted) {
        client.emit('voice:error', {
          message: 'You were muted by the host. Ask them to unmute you.',
        });
        client.emit('voice:self-muted', { userId, muted: true });
        return;
      }

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
}
