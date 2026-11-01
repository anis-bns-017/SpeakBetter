
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { VoiceBroadcaster } from '../realtime/voice-broadcaster';

@Injectable()
export class ClapService {
  private readonly logger = new Logger(ClapService.name);
  private cooldowns: Map<string, Date> = new Map();

  constructor(
    private prisma: PrismaService,
    private voiceBroadcaster: VoiceBroadcaster,
  ) {}

  async addClap(roomId: string, userId: string, targetUserId?: string) {
    // Check cooldown (5 seconds)
    const cooldownKey = `${roomId}-${userId}`;
    const lastClap = this.cooldowns.get(cooldownKey);
    if (lastClap && Date.now() - lastClap.getTime() < 5000) {
      throw new BadRequestException('Please wait before clapping again');
    }

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

    // Create clap
    const clap = await this.prisma.voiceClap.create({
      data: {
        roomId,
        userId,
        targetUserId: targetUserId || userId,
      },
    });

    // Update cooldown
    this.cooldowns.set(cooldownKey, new Date());

    // Update room total claps
    await this.prisma.voiceRoom.update({
      where: { id: roomId },
      data: {
        trendScore: {
          increment: 1,
        },
      },
    });

    // Broadcast to room
    this.voiceBroadcaster.broadcastClap(roomId, {
      userId,
      targetUserId: targetUserId || userId,
      clapCount: clap.clapCount,
      timestamp: new Date().toISOString(),
    });

    // Update analytics
    await this.updateRoomAnalytics(roomId);

    // Check for achievements
    await this.checkAchievements(userId, roomId);

    return clap;
  }

  async getRoomClaps(roomId: string) {
    const [totalClaps, topSpeakers, recentClaps] = await Promise.all([
      this.prisma.voiceClap.count({
        where: { roomId },
      }),
      this.prisma.voiceClap.groupBy({
        by: ['targetUserId'],
        where: { roomId },
        _count: {
          targetUserId: true,
        },
        orderBy: {
          _count: {
            targetUserId: 'desc',
          },
        },
        take: 10,
      }),
      this.prisma.voiceClap.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    // Get speaker details
    const speakerIds = topSpeakers
      .map((s) => s.targetUserId)
      .filter((id): id is string => Boolean(id));
    const speakers = await this.prisma.user.findMany({
      where: {
        id: {
          in: speakerIds,
        },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    const topSpeakersWithDetails = topSpeakers.map((s) => ({
      user: speakers.find((u) => u.id === s.targetUserId),
      claps: s._count.targetUserId,
    }));

    return {
      totalClaps,
      topSpeakers: topSpeakersWithDetails,
      recentClaps,
    };
  }

  private async updateRoomAnalytics(roomId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const analytics = await this.prisma.voiceRoomAnalytics.findFirst({
      where: {
        roomId,
        timestamp: {
          gte: today,
        },
      },
    });

    if (analytics) {
      await this.prisma.voiceRoomAnalytics.update({
        where: { id: analytics.id },
        data: {
          totalClaps: {
            increment: 1,
          },
        },
      });
    } else {
      await this.prisma.voiceRoomAnalytics.create({
        data: {
          roomId,
          totalClaps: 1,
        },
      });
    }
  }

  private async checkAchievements(userId: string, roomId: string) {
    // Check if user has clapped 100 times
    const totalClaps = await this.prisma.voiceClap.count({
      where: { userId },
    });

    if (totalClaps === 100) {
      // Award "Clap Master" badge
      await this.awardBadge(userId, 'CLAP_MASTER');
    }

    if (totalClaps === 1000) {
      await this.awardBadge(userId, 'CLAP_LEGEND');
    }

    // Check if user received 100 claps in a room
    const roomClaps = await this.prisma.voiceClap.count({
      where: {
        roomId,
        targetUserId: userId,
      },
    });

    if (roomClaps === 100) {
      await this.awardBadge(userId, 'ROOM_STAR');
    }
  }

  private async awardBadge(userId: string, badgeId: string) {
    try {
      await this.prisma.userBadge.create({
        data: {
          userId,
          badgeId,
        },
      });
      this.logger.log(`Awarded badge ${badgeId} to user ${userId}`);
    } catch (error) {
      // Badge already exists or error
      this.logger.error(`Failed to award badge: ${error.message}`);
    }
  }
}