
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { VoiceBroadcaster } from '../realtime/voice-broadcaster';

@Injectable()
export class SpeakerQueueService {
  private readonly logger = new Logger(SpeakerQueueService.name);
  private queuePositions: Map<string, number> = new Map();

  constructor(
    private prisma: PrismaService,
    private voiceBroadcaster: VoiceBroadcaster,
  ) {}

  async addToQueue(roomId: string, userId: string, invitedBy?: string) {
    // Check if user is in room
    const participant = await this.prisma.voiceParticipant.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null,
      },
    });

    if (!participant) {
      throw new BadRequestException('You are not in this room');
    }

    // Check if already in queue
    const existing = await this.prisma.voiceSpeakerQueue.findFirst({
      where: {
        roomId,
        userId,
        status: {
          in: ['PENDING', 'INVITED'],
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Already in queue');
    }

    // Check if already a speaker
    if (participant.role === 'SPEAKER' || participant.role === 'STAGE_SPEAKER') {
      throw new BadRequestException('You are already a speaker');
    }

    // Get current max position
    const maxPosition = await this.prisma.voiceSpeakerQueue.aggregate({
      where: { roomId },
      _max: { position: true },
    });

    const position = (maxPosition._max.position || 0) + 1;

    // Create queue entry
    const queueEntry = await this.prisma.voiceSpeakerQueue.create({
      data: {
        roomId,
        userId,
        position,
        status: invitedBy ? 'INVITED' : 'PENDING',
        invitedBy: invitedBy,
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

    // Broadcast queue update
    this.broadcastQueue(roomId);

    this.logger.log(`User ${userId} added to queue at position ${position} in room ${roomId}`);
    return queueEntry;
  }

  async removeFromQueue(roomId: string, userId: string) {
    const queueEntry = await this.prisma.voiceSpeakerQueue.findFirst({
      where: {
        roomId,
        userId,
        status: {
          in: ['PENDING', 'INVITED'],
        },
      },
    });

    if (!queueEntry) {
      throw new BadRequestException('Not in queue');
    }

    await this.prisma.voiceSpeakerQueue.delete({
      where: { id: queueEntry.id },
    });

    // Reorder positions
    await this.reorderQueue(roomId);

    // Broadcast queue update
    this.broadcastQueue(roomId);

    this.logger.log(`User ${userId} removed from queue in room ${roomId}`);
  }

  async promoteToSpeaker(roomId: string, userId: string, moderatorId: string) {
    // Check moderator permissions
    await this.checkModeratorPermissions(roomId, moderatorId);

    const queueEntry = await this.prisma.voiceSpeakerQueue.findFirst({
      where: {
        roomId,
        userId,
        status: {
          in: ['PENDING', 'INVITED'],
        },
      },
    });

    if (!queueEntry) {
      throw new BadRequestException('User is not in queue');
    }

    // Remove from queue
    await this.prisma.voiceSpeakerQueue.delete({
      where: { id: queueEntry.id },
    });

    // Promote to speaker
    await this.prisma.voiceParticipant.update({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
      data: {
        role: 'SPEAKER',
      },
    });

    // Reorder queue
    await this.reorderQueue(roomId);

    // Broadcast updates
    this.broadcastQueue(roomId);
    this.voiceBroadcaster.broadcastParticipantUpdate(roomId, {
      userId,
      role: 'SPEAKER',
    });

    this.logger.log(`User ${userId} promoted to speaker in room ${roomId} by ${moderatorId}`);
  }

  async getQueue(roomId: string) {
    const queue = await this.prisma.voiceSpeakerQueue.findMany({
      where: {
        roomId,
        status: {
          in: ['PENDING', 'INVITED'],
        },
      },
      orderBy: { position: 'asc' },
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

    return queue;
  }

  async inviteToStage(roomId: string, userId: string, moderatorId: string) {
    await this.checkModeratorPermissions(roomId, moderatorId);

    const participant = await this.prisma.voiceParticipant.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null,
      },
    });

    if (!participant) {
      throw new BadRequestException('User is not in room');
    }

    // Add to queue as invited
    return this.addToQueue(roomId, userId, moderatorId);
  }

  private async reorderQueue(roomId: string) {
    const queue = await this.prisma.voiceSpeakerQueue.findMany({
      where: {
        roomId,
        status: {
          in: ['PENDING', 'INVITED'],
        },
      },
      orderBy: { position: 'asc' },
    });

    // Reorder positions
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].position !== i + 1) {
        await this.prisma.voiceSpeakerQueue.update({
          where: { id: queue[i].id },
          data: { position: i + 1 },
        });
      }
    }
  }

  private async checkModeratorPermissions(roomId: string, userId: string) {
    const participant = await this.prisma.voiceParticipant.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null,
      },
    });

    if (!participant || (participant.role !== 'MODERATOR' && participant.role !== 'SPEAKER')) {
      throw new BadRequestException('Insufficient permissions');
    }

    // Check if room is active
    const room = await this.prisma.voiceRoom.findFirst({
      where: { id: roomId },
    });

    if (!room || room.status !== 'ACTIVE') {
      throw new BadRequestException('Room is not active');
    }
  }

  private async broadcastQueue(roomId: string) {
    const queue = await this.getQueue(roomId);
    this.voiceBroadcaster.broadcastQueueUpdate(roomId, queue);
  }
}