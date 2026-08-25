// server/src/voice/voice.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CreateVoiceRoomDto, UpdateVoiceRoomDto } from './dto/voice.dto';
import {
  DiscoverRoomsDto,
  RoomSortType,
  RoomFilterType,
} from './dto/discovery.dto';
import { PrismaService } from '../prisma.service';
import { LiveKitService } from './livekit.service';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private prisma: PrismaService,
    private liveKitService: LiveKitService,
  ) {}

  // ============ ROOM CRUD ============

  async getRooms(userId: string, query: { type?: string; status?: string }) {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    return this.prisma.voiceRoom.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true },
        },
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoomById(roomId: string, userId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true },
        },
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        recordings: true,
        stages: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async createRoom(userId: string, dto: CreateVoiceRoomDto) {
    const {
      name,
      description,
      type,
      scheduledFor,
      maxParticipants,
      invitedUserIds,
      language,
      topics,
      categories,
      tags,
    } = dto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const room = await this.prisma.voiceRoom.create({
      data: {
        name,
        description,
        type,
        maxParticipants: maxParticipants || 50,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        language: language || null,
        topics: topics || [],
        categories: categories || [],
        tags: tags || [],
        creatorId: userId,
        status: 'WAITING',
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Add creator as participant with MODERATOR role
    await this.prisma.voiceParticipant.create({
      data: {
        roomId: room.id,
        userId: userId,
        role: 'MODERATOR',
      },
    });

    if (invitedUserIds && invitedUserIds.length > 0) {
      for (const invitedUserId of invitedUserIds) {
        if (invitedUserId !== userId) {
          await this.prisma.voiceParticipant.create({
            data: {
              roomId: room.id,
              userId: invitedUserId,
              role: 'LISTENER',
            },
          });
        }
      }
    }

    return room;
  }

  async updateRoom(userId: string, roomId: string, dto: UpdateVoiceRoomDto) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isCreator = room.creatorId === userId;
    const isModerator = room.participants.some(
      (p) => p.userId === userId && p.role === 'MODERATOR',
    );

    if (!isCreator && !isModerator) {
      throw new ForbiddenException(
        'You are not authorized to update this room',
      );
    }

    const {
      name,
      description,
      maxParticipants,
      isRecording,
      language,
      topics,
      categories,
      tags,
    } = dto;

    const updatedRoom = await this.prisma.voiceRoom.update({
      where: { id: roomId },
      data: {
        name,
        description,
        maxParticipants,
        isRecording: isRecording !== undefined ? isRecording : room.isRecording,
        language: language !== undefined ? language : room.language,
        topics: topics !== undefined ? topics : room.topics,
        categories: categories !== undefined ? categories : room.categories,
        tags: tags !== undefined ? tags : room.tags,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return updatedRoom;
  }

  async endRoom(userId: string, roomId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.creatorId !== userId) {
      const participant = await this.prisma.voiceParticipant.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
      });

      if (!participant || participant.role !== 'MODERATOR') {
        throw new ForbiddenException(
          'Only the creator or a moderator can end this room',
        );
      }
    }

    const updatedRoom = await this.prisma.voiceRoom.update({
      where: { id: roomId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    if (room.liveKitRoomId) {
      try {
        await this.liveKitService.endRoom(room.liveKitRoomId);
        this.logger.log(`✅ LiveKit room ended: ${room.liveKitRoomId}`);
      } catch (error) {
        this.logger.error(`Failed to end LiveKit room: ${error.message}`);
      }
    }

    return updatedRoom;
  }

  // ============ PARTICIPANTS ============

  async joinRoom(userId: string, roomId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.status === 'ENDED') {
      throw new BadRequestException('This room has ended');
    }

    /*
     * Find the user's existing participant record.
     */
    const existingParticipant = await this.prisma.voiceParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    /*
     * ============================================================
     * CASE 1: USER IS ALREADY IN THE ROOM
     * ============================================================
     *
     * Do NOT return 409.
     *
     * React development mode / StrictMode can cause the join
     * effect to execute more than once.
     *
     * If the participant is already active, simply return a
     * fresh LiveKit token.
     */
    if (existingParticipant && !existingParticipant.leftAt) {
      this.logger.log(
        `ℹ️ User ${userId} is already in room ${roomId}; reusing participant`,
      );

      let liveKitRoomId = room.liveKitRoomId;

      /*
       * Make sure the room has a LiveKit room ID.
       */
      if (!liveKitRoomId) {
        liveKitRoomId = `voice-${room.id}`;

        await this.prisma.voiceRoom.update({
          where: {
            id: roomId,
          },
          data: {
            liveKitRoomId,
            status: 'ACTIVE',
            startedAt: room.startedAt || new Date(),
          },
        });
      }

      /*
       * Generate a REAL LiveKit token.
       */
      const token = await this.liveKitService.getParticipantToken(
        liveKitRoomId,
        userId,
        userId,
      );

      return {
        room: {
          id: room.id,
          name: room.name,
          liveKitRoomId,
        },

        participant: existingParticipant,

        token,

        liveKitRoomId,
      };
    }

    /*
     * ============================================================
     * CASE 2: USER PREVIOUSLY LEFT
     * ============================================================
     */
    if (existingParticipant && existingParticipant.leftAt) {
      const participant = await this.prisma.voiceParticipant.update({
        where: {
          id: existingParticipant.id,
        },
        data: {
          leftAt: null,
          joinedAt: new Date(),
        },
      });

      let liveKitRoomId = room.liveKitRoomId;

      if (!liveKitRoomId) {
        liveKitRoomId = `voice-${room.id}`;

        await this.prisma.voiceRoom.update({
          where: {
            id: roomId,
          },
          data: {
            liveKitRoomId,
            status: 'ACTIVE',
            startedAt: room.startedAt || new Date(),
          },
        });
      }

      const token = await this.liveKitService.getParticipantToken(
        liveKitRoomId,
        userId,
        userId,
      );

      return {
        room: {
          id: room.id,
          name: room.name,
          liveKitRoomId,
        },

        participant,

        token,

        liveKitRoomId,
      };
    }

    /*
     * ============================================================
     * CASE 3: BRAND NEW PARTICIPANT
     * ============================================================
     */

    const participantCount = await this.prisma.voiceParticipant.count({
      where: {
        roomId,
        leftAt: null,
      },
    });

    if (participantCount >= room.maxParticipants) {
      throw new BadRequestException('This room is full');
    }

    /*
     * The first real participant starts
     * the room.
     */
    const isFirstJoin = room.status === 'WAITING';

    let liveKitRoomId = room.liveKitRoomId;

    if (!liveKitRoomId) {
      liveKitRoomId = `voice-${room.id}`;
    }

    /*
     * Activate the room BEFORE generating
     * the LiveKit token.
     */
    if (isFirstJoin || !room.liveKitRoomId) {
      await this.prisma.voiceRoom.update({
        where: {
          id: roomId,
        },
        data: {
          status: 'ACTIVE',
          startedAt: room.startedAt || new Date(),
          liveKitRoomId,
        },
      });
    }

    /*
     * Generate the LiveKit token.
     */
    const token = await this.liveKitService.getParticipantToken(
      liveKitRoomId,
      userId,
      userId,
    );

    /*
     * Create participant.
     */
    const participant = await this.prisma.voiceParticipant.create({
      data: {
        roomId,
        userId,

        role: isFirstJoin ? 'MODERATOR' : 'LISTENER',
      },
    });

    this.logger.log(`✅ User ${userId} joined room ${roomId}`);

    return {
      room: {
        id: room.id,
        name: room.name,
        liveKitRoomId,
      },

      participant,

      token,

      liveKitRoomId,
    };
  }

  async leaveRoom(userId: string, roomId: string) {
    const participant = await this.prisma.voiceParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('User is not in this room');
    }

    return this.prisma.voiceParticipant.update({
      where: { id: participant.id },
      data: {
        leftAt: new Date(),
      },
    });
  }

  async getRoomParticipants(roomId: string, userId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.prisma.voiceParticipant.findMany({
      where: { roomId, leftAt: null },
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
  }

  async updateParticipantRole(
    userId: string,
    roomId: string,
    targetUserId: string,
    role: string,
  ) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isCreator = room.creatorId === userId;
    const isModerator = await this.prisma.voiceParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!isCreator && (!isModerator || isModerator.role !== 'MODERATOR')) {
      throw new ForbiddenException(
        'Only the creator or a moderator can update roles',
      );
    }

    return this.prisma.voiceParticipant.update({
      where: {
        roomId_userId: {
          roomId,
          userId: targetUserId,
        },
      },
      data: {
        role: role as any,
      },
    });
  }

  // ============ ROOM DISCOVERY ============

  async discoverRooms(userId: string, dto: DiscoverRoomsDto) {
    const {
      query,
      sort = RoomSortType.TRENDING,
      filter,
      language,
      category,
      page = 1,
      limit = 20,
    } = dto;

    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE',
    };

    // Search query
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Filter by type using RoomFilterType
    if (filter) {
      switch (filter) {
        case RoomFilterType.OPEN:
          where.type = 'OPEN';
          break;
        case RoomFilterType.PRIVATE:
          where.type = 'PRIVATE';
          break;
        case RoomFilterType.STAGE:
          where.type = 'STAGE';
          break;
        case RoomFilterType.SCHEDULED:
          where.type = 'SCHEDULED';
          break;
        case RoomFilterType.LANGUAGE:
          if (language) {
            where.language = language;
          }
          break;
        case RoomFilterType.ALL:
        default:
          break;
      }
    }

    // Category filter
    if (category) {
      where.categories = { has: category };
    }

    // Language filter (if not already handled by filter)
    if (language && filter !== RoomFilterType.LANGUAGE) {
      where.language = language;
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };

    switch (sort) {
      case RoomSortType.TRENDING:
        orderBy = { trendScore: 'desc' };
        break;
      case RoomSortType.POPULAR:
        orderBy = { participants: { _count: 'desc' } };
        break;
      case RoomSortType.NEWEST:
        orderBy = { createdAt: 'desc' };
        break;
      case RoomSortType.NEARBY:
        // For nearby, we'd need location data - fallback to trending
        orderBy = { trendScore: 'desc' };
        break;
      case RoomSortType.RECOMMENDED:
        // For recommended, we'd need ML - fallback to trending
        orderBy = { trendScore: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [rooms, total] = await Promise.all([
      this.prisma.voiceRoom.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
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
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.voiceRoom.count({ where }),
    ]);

    // Transform rooms to include participant count
    const transformedRooms = rooms.map((room) => ({
      ...room,
      participantCount: room.participants.length,
      peakParticipantCount: room.participants.length,
      messageCount: 0,
      speakingHours: 0,
      isLive: room.status === 'ACTIVE',
    }));

    return {
      rooms: transformedRooms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTrendingRooms(userId: string, limit: number = 10) {
    return this.prisma.voiceRoom.findMany({
      where: { status: 'ACTIVE' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
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
      },
      orderBy: { trendScore: 'desc' },
      take: limit,
    });
  }

  async getRoomCategories() {
    return [
      { name: 'Conversation', icon: '💬', color: '#6366F1', roomCount: 0 },
      { name: 'Language Learning', icon: '📚', color: '#8B5CF6', roomCount: 0 },
      { name: 'Music', icon: '🎵', color: '#EC4899', roomCount: 0 },
      { name: 'Gaming', icon: '🎮', color: '#8B5CF6', roomCount: 0 },
      { name: 'Social', icon: '👥', color: '#06B6D4', roomCount: 0 },
      { name: 'Casual', icon: '☕', color: '#F59E0B', roomCount: 0 },
      { name: 'Podcast', icon: '🎙️', color: '#6366F1', roomCount: 0 },
      { name: 'Study', icon: '📖', color: '#10B981', roomCount: 0 },
      { name: 'Interview', icon: '🎤', color: '#EF4444', roomCount: 0 },
      { name: 'Panel', icon: '🎭', color: '#8B5CF6', roomCount: 0 },
    ];
  }

  async getLiveRoomsCount() {
    return this.prisma.voiceRoom.count({
      where: { status: 'ACTIVE' },
    });
  }

  async getRecommendedRooms(userId: string, limit: number = 10) {
    return this.prisma.voiceRoom.findMany({
      where: { status: 'ACTIVE' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
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
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ============ HOST PROMOTION ============

  async promoteHost(userId: string, roomId: string, newHostId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can promote a new host');
    }

    const participant = await this.prisma.voiceParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: newHostId,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('User is not in this room');
    }

    const updatedRoom = await this.prisma.voiceRoom.update({
      where: { id: roomId },
      data: {
        creatorId: newHostId,
      },
    });

    await this.prisma.voiceParticipant.update({
      where: {
        roomId_userId: {
          roomId,
          userId: newHostId,
        },
      },
      data: {
        role: 'MODERATOR',
      },
    });

    await this.prisma.voiceParticipant.update({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
      data: {
        role: 'MODERATOR',
      },
    });

    return updatedRoom;
  }

  // ============ STAGE ============

  async addToStage(userId: string, roomId: string, targetUserId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      include: { stages: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isAuthorized =
      room.creatorId === userId ||
      (
        await this.prisma.voiceParticipant.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId,
            },
          },
        })
      )?.role === 'MODERATOR';

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Only the creator or a moderator can add to stage',
      );
    }

    let stage = room.stages[0];
    if (!stage) {
      stage = await this.prisma.stage.create({
        data: {
          roomId,
          name: 'Main Stage',
        },
      });
    }

    const updatedStage = await this.prisma.stage.update({
      where: { id: stage.id },
      data: {
        speakers: {
          push: targetUserId,
        },
      },
    });

    return updatedStage;
  }

  async removeFromStage(userId: string, roomId: string, targetUserId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      include: { stages: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isAuthorized =
      room.creatorId === userId ||
      (
        await this.prisma.voiceParticipant.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId,
            },
          },
        })
      )?.role === 'MODERATOR';

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Only the creator or a moderator can remove from stage',
      );
    }

    const stage = room.stages[0];
    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    const updatedStage = await this.prisma.stage.update({
      where: { id: stage.id },
      data: {
        speakers: {
          set: stage.speakers.filter((id) => id !== targetUserId),
        },
      },
    });

    return updatedStage;
  }

  // ============ RECORDINGS ============

  async getRecordings(roomId: string, userId: string) {
    return this.prisma.recording.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async startRecording(userId: string, roomId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isAuthorized =
      room.creatorId === userId ||
      (
        await this.prisma.voiceParticipant.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId,
            },
          },
        })
      )?.role === 'MODERATOR';

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Only the creator or a moderator can start recording',
      );
    }

    // Check if LiveKit is available
    if (!this.liveKitService.isAvailable()) {
      throw new HttpException(
        {
          message: 'Recording service is currently unavailable',
          error: 'RECORDING_UNAVAILABLE',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const updatedRoom = await this.prisma.voiceRoom.update({
      where: { id: roomId },
      data: {
        isRecording: true,
      },
    });

    if (room.liveKitRoomId) {
      try {
        await this.liveKitService.startRecording(room.liveKitRoomId);
        this.logger.log(`✅ Recording started for room ${roomId}`);
      } catch (error) {
        this.logger.error(
          `Failed to start LiveKit recording: ${error.message}`,
        );
        throw new HttpException(
          {
            message: 'Failed to start recording',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    return updatedRoom;
  }

  async stopRecording(userId: string, roomId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isAuthorized =
      room.creatorId === userId ||
      (
        await this.prisma.voiceParticipant.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId,
            },
          },
        })
      )?.role === 'MODERATOR';

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Only the creator or a moderator can stop recording',
      );
    }

    const updatedRoom = await this.prisma.voiceRoom.update({
      where: { id: roomId },
      data: {
        isRecording: false,
      },
    });

    if (room.liveKitRoomId) {
      try {
        await this.liveKitService.stopRecording(room.liveKitRoomId);
        this.logger.log(`✅ Recording stopped for room ${roomId}`);
      } catch (error) {
        this.logger.error(`Failed to stop LiveKit recording: ${error.message}`);
      }
    }

    return updatedRoom;
  }

  // ============ CHAT MESSAGES ============

  async getVoiceRoomMessages(
    userId: string,
    roomId: string,
    limit: number = 50,
    before?: string,
  ) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const where: any = { roomId };
    if (before) {
      where.id = { lt: before };
    }

    return this.prisma.voiceRoomMessage.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async sendVoiceRoomMessage(
    userId: string,
    roomId: string,
    content: string,
    type: string = 'TEXT',
    mediaUrl?: string,
    fileUrl?: string,
    replyToId?: string,
  ) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const participant = await this.prisma.voiceParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!participant || participant.leftAt !== null) {
      throw new ForbiddenException('You must be in the room to send messages');
    }

    let validReplyToId: string | undefined = undefined;

    if (replyToId) {
      const replyMessage = await this.prisma.voiceRoomMessage.findUnique({
        where: {
          id: replyToId,
        },
        select: {
          id: true,
          roomId: true,
        },
      });

      if (!replyMessage) {
        throw new BadRequestException(
          'The message you are trying to reply to does not exist',
        );
      }

      if (replyMessage.roomId !== roomId) {
        throw new BadRequestException(
          'You cannot reply to a message from another room',
        );
      }

      validReplyToId = replyMessage.id;
    }

    return this.prisma.voiceRoomMessage.create({
      data: {
        roomId,
        senderId: userId,
        content: content.trim(),
        type,
        mediaUrl: mediaUrl || undefined,
        fileUrl: fileUrl || undefined,
        replyToId: validReplyToId,
      },
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
  }

  async deleteVoiceRoomMessage(
    userId: string,
    roomId: string,
    messageId: string,
  ) {
    const message = await this.prisma.voiceRoomMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const isAuthorized =
      message.senderId === userId ||
      (
        await this.prisma.voiceParticipant.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId,
            },
          },
        })
      )?.role === 'MODERATOR';

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Only the sender or a moderator can delete this message',
      );
    }

    return this.prisma.voiceRoomMessage.update({
      where: { id: messageId },
      data: {
        content: 'This message was deleted',
      },
    });
  }

  // ============ RAISE HAND ============

  async handleRaiseHand(userId: string, roomId: string, raised: boolean) {
    const participant = await this.prisma.voiceParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('User is not in this room');
    }

    return this.prisma.voiceParticipant.update({
      where: { id: participant.id },
      data: {
        raisedHand: raised,
      },
    });
  }

  // ============ UTILITY ============

  async isUserInRoom(roomId: string, userId: string) {
    const participant = await this.prisma.voiceParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    return !!participant && !participant.leftAt;
  }

  async getActiveParticipants(roomId: string) {
    return this.prisma.voiceParticipant.findMany({
      where: {
        roomId,
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
  }
}
