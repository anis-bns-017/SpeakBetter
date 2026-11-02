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
  Optional,
} from '@nestjs/common';
import { CreateVoiceRoomDto, UpdateVoiceRoomDto } from './dto/voice.dto';
import {
  DiscoverRoomsDto,
  RoomSortType,
  RoomFilterType,
} from './dto/discovery.dto';
import { ParticipantRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { LiveKitService } from './livekit.service';
import { ActivityService, XP_REWARDS } from '../learning/activity.service';
import { ReviewService } from '../learning/review.service';

/** Soft-deleted chat messages keep their row (so replies still resolve) with this type */
export const DELETED_MESSAGE_TYPE = 'DELETED';
export const MAX_CHAT_MESSAGE_LENGTH = 2000;
const SENDABLE_MESSAGE_TYPES = new Set([
  'TEXT',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'FILE',
  'VOICE_NOTE',
  'GIF',
  'STICKER',
]);

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private prisma: PrismaService,
    private liveKitService: LiveKitService,
    private activity: ActivityService,
    // Turns corrections into flashcards; optional so rooms keep working (and tests stay simple) without it
    @Optional() private review?: ReviewService,
  ) {}

  // ============ PRIVATE ROOM ACCESS ============
  //
  // A PRIVATE room belongs to its creator and the people invited to it. Being
  // invited (by id when the room was created, or by invite code) is what puts a
  // participant row in the table, so "has a row" is the access rule. Everything
  // below that exposes a room's details, people or chat goes through it.

  /** Prisma filter: rooms this person may see in a list */
  private visibleRoomsWhere(userId: string) {
    return {
      OR: [
        { type: { not: 'PRIVATE' as const } },
        { creatorId: userId },
        { participants: { some: { userId } } },
      ],
    };
  }

  /** Throws "not found" (so a private room's existence is not leaked) unless the person may see the room */
  async assertRoomAccess(
    room: { id: string; type?: string | null; creatorId: string },
    userId: string,
  ) {
    if (room.type !== 'PRIVATE' || room.creatorId === userId) return;
    const row = await this.prisma.voiceParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Room not found');
  }

  /** Same rule, looked up by id */
  async assertRoomAccessById(roomId: string, userId: string) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      select: { id: true, type: true, creatorId: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    await this.assertRoomAccess(room, userId);
  }

  /** Drops someone out of the LiveKit (audio) room. Best effort: a failure is logged, never thrown. */
  async removeFromAudio(liveKitRoomId: string | null, userId: string) {
    if (!liveKitRoomId) return;
    try {
      await this.liveKitService.removeParticipant(liveKitRoomId, userId);
    } catch (error) {
      this.logger.warn(
        `Could not remove ${userId} from audio room ${liveKitRoomId}: ${error?.message}`,
      );
    }
  }

  // ============ KICK BANS ============
  //
  // Kicking someone bans them from the room: they cannot join again by room id,
  // over the socket, or with an invite code, until the host lifts the ban.

  async isBanned(roomId: string, userId: string) {
    const ban = await this.prisma.voiceRoomBan.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { id: true },
    });
    return !!ban;
  }

  async assertNotBanned(roomId: string, userId: string) {
    if (await this.isBanned(roomId, userId)) {
      throw new ForbiddenException('You were removed from this room by the host.');
    }
  }

  /**
   * Host-only. Removes the person from the room and bans them in one step, so
   * there is no moment in which they could slip back in. Works even if they
   * already left (the ban is what matters).
   */
  async kickParticipant(
    actorId: string,
    roomId: string,
    targetUserId: string,
    reason?: string,
  ) {
    const room = await this.prisma.voiceRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorId !== actorId) {
      throw new ForbiddenException('Only the host can kick members');
    }
    if (room.creatorId === targetUserId) {
      throw new ForbiddenException('Cannot kick the host');
    }

    await this.prisma.$transaction([
      this.prisma.voiceRoomBan.upsert({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        create: {
          roomId,
          userId: targetUserId,
          bannedById: actorId,
          reason: reason?.slice(0, 200) || null,
        },
        update: {},
      }),
      this.prisma.voiceParticipant.deleteMany({
        where: { roomId, userId: targetUserId },
      }),
    ]);

    return room;
  }

  /** Host or moderator: who is banned from this room */
  async listBans(actorId: string, roomId: string) {
    if (!(await this.isRoomManager(roomId, actorId))) {
      throw new ForbiddenException('Only the host or a moderator can see the ban list');
    }
    const bans = await this.prisma.voiceRoomBan.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return bans.map((ban) => ({
      id: ban.id,
      userId: ban.userId,
      user: ban.user,
      bannedById: ban.bannedById,
      reason: ban.reason,
      createdAt: ban.createdAt,
    }));
  }

  /** Host or moderator: lets someone back in (they still have to join again) */
  async unbanParticipant(actorId: string, roomId: string, targetUserId: string) {
    if (!(await this.isRoomManager(roomId, actorId))) {
      throw new ForbiddenException('Only the host or a moderator can lift a ban');
    }
    await this.prisma.voiceRoomBan.deleteMany({
      where: { roomId, userId: targetUserId },
    });
    return { success: true };
  }

  // ============ SPEAKING TIME ============

  /**
   * Adds a finished speaking turn to the speaker's stats and awards XP for every
   * full 15 seconds spoken in this room (turns accumulate, so short turns still count).
   */
  async recordSpeakingTime(roomId: string, userId: string, seconds: number) {
    if (seconds <= 0) return;
    const existing = await this.prisma.voiceSpeakerStats.findFirst({
      where: { roomId, userId },
      select: { id: true, speakingTime: true },
    });
    const before = existing?.speakingTime ?? 0;
    const after = before + seconds;

    if (existing) {
      await this.prisma.voiceSpeakerStats.update({
        where: { id: existing.id },
        data: { speakingTime: { increment: seconds }, timesSpoken: { increment: 1 } },
      });
    } else {
      await this.prisma.voiceSpeakerStats.create({
        data: { roomId, userId, speakingTime: seconds, timesSpoken: 1 },
      });
    }

    const xp = (Math.floor(after / 15) - Math.floor(before / 15)) * XP_REWARDS.speakingPer15s;
    await this.activity.recordActivity(userId, xp, 'VOICE_SPEAKING');
  }

  // ============ ROOM CRUD ============

  async getRooms(userId: string, query: { type?: string; status?: string }) {
    const where: any = { AND: [this.visibleRoomsWhere(userId)] };
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

    await this.assertRoomAccess(room, userId);

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

    await this.prisma.voiceParticipant.create({
      data: {
        roomId: room.id,
        userId: userId,
        role: 'MODERATOR',
      },
    });

    if (invitedUserIds && invitedUserIds.length > 0) {
      // Only people who exist (an unknown id would fail the whole request), once each
      const wanted = [...new Set(invitedUserIds)].filter((id) => id !== userId);
      const people = await this.prisma.user.findMany({
        where: { id: { in: wanted } },
        select: { id: true },
      });
      if (people.length > 0) {
        await this.prisma.voiceParticipant.createMany({
          data: people.map((person) => ({
            roomId: room.id,
            userId: person.id,
            role: 'LISTENER' as const,
          })),
          skipDuplicates: true,
        });
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

    await this.assertNotBanned(roomId, userId);

    if (room.type === 'PRIVATE' && room.creatorId !== userId) {
      const invited = await this.prisma.voiceParticipant.findUnique({
        where: { roomId_userId: { roomId, userId } },
        select: { id: true },
      });
      if (!invited) {
        throw new ForbiddenException(
          'This room is private. Ask the host for an invite.',
        );
      }
    }

    let liveKitRoomId = room.liveKitRoomId;

    if (!liveKitRoomId) {
      liveKitRoomId = `voice-${room.id}`;

      try {
        await this.liveKitService.createRoom(liveKitRoomId);
        this.logger.log(`✅ LiveKit room created: ${liveKitRoomId}`);
      } catch (error) {
        this.logger.error(`❌ Failed to create LiveKit room: ${error.message}`);
        throw new HttpException(
          {
            success: false,
            message: 'Failed to create voice room. Please try again.',
            error: 'LIVEKIT_CREATE_FAILED',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await this.prisma.voiceRoom.update({
        where: { id: roomId },
        data: {
          liveKitRoomId,
          status: 'ACTIVE',
          startedAt: room.startedAt || new Date(),
        },
      });
    }

    const existingParticipant = await this.prisma.voiceParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (existingParticipant && !existingParticipant.leftAt) {
      this.logger.log(
        `ℹ️ User ${userId} is already in room ${roomId}; reusing participant`,
      );

      const token = await this.liveKitService.getParticipantToken(
        liveKitRoomId,
        userId,
        userId,
        {
          canPublish:
            this.canSpeakInRoom(room, userId, existingParticipant.role) &&
            !existingParticipant.mutedByHost,
        },
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

    if (existingParticipant && existingParticipant.leftAt) {
      const participant = await this.prisma.voiceParticipant.update({
        where: {
          id: existingParticipant.id,
        },
        data: {
          leftAt: null,
          joinedAt: new Date(),
          raisedHand: false,
        },
      });

      const token = await this.liveKitService.getParticipantToken(
        liveKitRoomId,
        userId,
        userId,
        {
          canPublish:
            this.canSpeakInRoom(room, userId, participant.role) &&
            !participant.mutedByHost,
        },
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

    const participantCount = await this.prisma.voiceParticipant.count({
      where: {
        roomId,
        leftAt: null,
      },
    });

    if (participantCount >= room.maxParticipants) {
      throw new BadRequestException('This room is full');
    }

    const isFirstJoin = room.status === 'WAITING';
    const role =
      isFirstJoin || room.creatorId === userId ? 'MODERATOR' : 'LISTENER';

    const token = await this.liveKitService.getParticipantToken(
      liveKitRoomId,
      userId,
      userId,
      { canPublish: this.canSpeakInRoom(room, userId, role) },
    );

    const participant = await this.prisma.voiceParticipant.create({
      data: {
        roomId,
        userId,
        role,
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

    await this.assertRoomAccess(room, userId);

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

  // ============ MUTE/UNMUTE ============

  async muteParticipant(userId: string, roomId: string, targetUserId: string) {
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
        'Only the creator or a moderator can mute participants',
      );
    }

    if (room.creatorId === targetUserId) {
      throw new ForbiddenException('Cannot mute the host');
    }

    const updated = await this.prisma.voiceParticipant.update({
      where: {
        roomId_userId: {
          roomId,
          userId: targetUserId,
        },
      },
      data: {
        isMuted: true,
        mutedByHost: true,
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

    if (room.liveKitRoomId) {
      // Muting the track is not enough: the person could switch it back on.
      // Taking away the permission to publish is what actually holds.
      await this.liveKitService.setCanPublish(
        room.liveKitRoomId,
        targetUserId,
        false,
      );
      try {
        await this.liveKitService.muteParticipant(
          room.liveKitRoomId,
          targetUserId,
        );
        this.logger.log(`🔇 Muted ${targetUserId} in LiveKit room ${roomId}`);
      } catch (error) {
        this.logger.warn(`LiveKit mute failed: ${error.message}`);
      }
    }

    return updated;
  }

  async unmuteParticipant(
    userId: string,
    roomId: string,
    targetUserId: string,
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
        'Only the creator or a moderator can unmute participants',
      );
    }

    const updated = await this.prisma.voiceParticipant.update({
      where: {
        roomId_userId: {
          roomId,
          userId: targetUserId,
        },
      },
      data: {
        isMuted: false,
        mutedByHost: false,
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

    if (room.liveKitRoomId) {
      // Give back what the room type allows (listeners on a stage stay listeners)
      await this.liveKitService.setCanPublish(
        room.liveKitRoomId,
        targetUserId,
        this.canSpeakInRoom(room, targetUserId, updated.role),
      );
      try {
        await this.liveKitService.unmuteParticipant(
          room.liveKitRoomId,
          targetUserId,
        );
        this.logger.log(`🔊 Unmuted ${targetUserId} in LiveKit room ${roomId}`);
      } catch (error) {
        this.logger.warn(`LiveKit unmute failed: ${error.message}`);
      }
    }

    return updated;
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

    const { participant } = await this.applyParticipantRole(
      roomId,
      targetUserId,
      role as ParticipantRole,
    );
    return participant;
  }

  // ============ STAGE ROLES ============

  /** Stage rooms are listen-only unless you're the host, a moderator or a speaker; other rooms are open-mic */
  canSpeakInRoom(
    room: { type: string; creatorId: string },
    userId: string,
    role?: string | null,
  ): boolean {
    if (room.type !== 'STAGE') return true;
    if (room.creatorId === userId) return true;
    return role === 'MODERATOR' || role === 'SPEAKER' || role === 'STAGE_SPEAKER';
  }

  /** True for the room creator and moderators */
  async isRoomManager(roomId: string, userId: string): Promise<boolean> {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      select: { creatorId: true },
    });
    if (!room) return false;
    if (room.creatorId === userId) return true;
    const participant = await this.prisma.voiceParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { role: true },
    });
    return participant?.role === 'MODERATOR';
  }

  /**
   * Saves a participant's role and syncs their LiveKit mic permission.
   * Moving onto the stage also clears a raised hand.
   */
  async applyParticipantRole(
    roomId: string,
    targetUserId: string,
    role: ParticipantRole,
  ) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) throw new NotFoundException('Room not found');

    const participant = await this.prisma.voiceParticipant.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: {
        role,
        ...(role !== 'LISTENER' ? { raisedHand: false } : {}),
      },
    });

    const canSpeak = this.canSpeakInRoom(room, targetUserId, role);
    if (room.type === 'STAGE' && room.liveKitRoomId) {
      await this.liveKitService.setCanPublish(
        room.liveKitRoomId,
        targetUserId,
        // a person the host muted stays unable to publish whatever their role
        canSpeak && !participant.mutedByHost,
      );
    }

    return { participant, canSpeak, room };
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
      AND: [this.visibleRoomsWhere(userId)],
    };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

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

    if (category) {
      where.categories = { has: category };
    }

    if (language && filter !== RoomFilterType.LANGUAGE) {
      where.language = language;
    }

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
      case RoomSortType.RECOMMENDED:
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
      where: { status: 'ACTIVE', AND: [this.visibleRoomsWhere(userId)] },
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
      where: { status: 'ACTIVE', AND: [this.visibleRoomsWhere(userId)] },
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
    await this.assertRoomAccessById(roomId, userId);
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
  //
  // REST and the socket gateway both go through these methods, so permissions and the
  // message shape are the same whichever path a client uses. Deleted messages stay as
  // tombstones (type DELETED) so replies to them still resolve.

  private readonly chatMessageInclude = {
    sender: { select: { id: true, name: true, avatarUrl: true } },
    replyTo: {
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    },
    reactions: { select: { emoji: true, userId: true } },
  } as const;

  /** Room creator or a MODERATOR participant */
  async canModerateVoiceRoom(userId: string, roomId: string): Promise<boolean> {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      select: { creatorId: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.creatorId === userId) return true;
    const participant = await this.prisma.voiceParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { role: true },
    });
    return participant?.role === 'MODERATOR';
  }

  /** Shape sent to clients: deleted messages lose their content and attachments */
  presentVoiceRoomMessage<
    T extends {
      type: string;
      content: string;
      mediaUrl?: string | null;
      fileUrl?: string | null;
      replyTo?: any;
    },
  >(message: T) {
    const isDeleted = message.type === DELETED_MESSAGE_TYPE;
    const replyTo = message.replyTo
      ? {
          ...message.replyTo,
          isDeleted: message.replyTo.type === DELETED_MESSAGE_TYPE,
          content:
            message.replyTo.type === DELETED_MESSAGE_TYPE
              ? ''
              : message.replyTo.content,
        }
      : message.replyTo;
    return {
      ...message,
      isDeleted,
      content: isDeleted ? '' : message.content,
      mediaUrl: isDeleted ? null : message.mediaUrl,
      fileUrl: isDeleted ? null : message.fileUrl,
      replyTo,
    };
  }

  private async findRoomMessage(roomId: string, messageId: string) {
    const message = await this.prisma.voiceRoomMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.roomId !== roomId) {
      throw new NotFoundException('Message not found');
    }
    if (message.type === DELETED_MESSAGE_TYPE) {
      throw new BadRequestException('This message was deleted');
    }
    return message;
  }

  async getVoiceRoomMessages(
    userId: string,
    roomId: string,
    limit: number = 50,
    before?: string,
  ) {
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: roomId },
      select: { id: true, type: true, creatorId: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    await this.assertRoomAccess(room, userId);

    const where: any = { roomId };
    if (before) {
      const cursor = await this.prisma.voiceRoomMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (cursor) where.createdAt = { lt: cursor.createdAt };
    }

    const messages = await this.prisma.voiceRoomMessage.findMany({
      where,
      include: this.chatMessageInclude,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit || 50, 1), 100),
    });

    return messages.reverse().map((m) => this.presentVoiceRoomMessage(m));
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
    const text = (content ?? '').trim();
    const messageType = SENDABLE_MESSAGE_TYPES.has(type) ? type : 'TEXT';

    if (!text && !mediaUrl && !fileUrl) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (text.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Messages can be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`,
      );
    }

    const participant = await this.prisma.voiceParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { leftAt: true },
    });

    if (!participant || participant.leftAt !== null) {
      throw new ForbiddenException('You must be in the room to send messages');
    }

    let validReplyToId: string | undefined = undefined;
    if (replyToId) {
      const replyMessage = await this.prisma.voiceRoomMessage.findUnique({
        where: { id: replyToId },
        select: { id: true, roomId: true },
      });
      if (!replyMessage || replyMessage.roomId !== roomId) {
        throw new BadRequestException(
          'The message you are replying to is not in this room',
        );
      }
      validReplyToId = replyMessage.id;
    }

    const message = await this.prisma.voiceRoomMessage.create({
      data: {
        roomId,
        senderId: userId,
        content: text,
        type: messageType,
        mediaUrl: mediaUrl || undefined,
        fileUrl: fileUrl || undefined,
        replyToId: validReplyToId,
      },
      include: this.chatMessageInclude,
    });

    return this.presentVoiceRoomMessage(message);
  }

  /** Sender or a moderator; leaves a tombstone and clears pins and reactions */
  async deleteVoiceRoomMessage(
    userId: string,
    roomId: string,
    messageId: string,
  ) {
    const message = await this.findRoomMessage(roomId, messageId);

    if (
      message.senderId !== userId &&
      !(await this.canModerateVoiceRoom(userId, roomId))
    ) {
      throw new ForbiddenException(
        'Only the sender or a moderator can delete this message',
      );
    }

    await this.prisma.$transaction([
      this.prisma.voiceRoomMessageReaction.deleteMany({ where: { messageId } }),
      this.prisma.voiceRoomMessage.update({
        where: { id: messageId },
        data: {
          type: DELETED_MESSAGE_TYPE,
          content: '',
          mediaUrl: null,
          fileUrl: null,
          isPinned: false,
        },
      }),
    ]);

    return { messageId, deletedBy: userId };
  }

  /** Only the sender can change what they wrote */
  async editVoiceRoomMessage(
    userId: string,
    roomId: string,
    messageId: string,
    content: string,
  ) {
    const text = (content ?? '').trim();
    if (!text) {
      throw new BadRequestException('Message content cannot be empty');
    }
    if (text.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Messages can be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`,
      );
    }

    const message = await this.findRoomMessage(roomId, messageId);
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const updated = await this.prisma.voiceRoomMessage.update({
      where: { id: messageId },
      data: { content: text, isEdited: true, editedAt: new Date() },
      include: this.chatMessageInclude,
    });
    return this.presentVoiceRoomMessage(updated);
  }

  /** Toggles one emoji for the user and returns the full emoji → userIds map */
  async toggleVoiceRoomMessageReaction(
    userId: string,
    roomId: string,
    messageId: string,
    emoji: string,
  ) {
    const value = (emoji ?? '').trim();
    if (!value || value.length > 16) {
      throw new BadRequestException('A single emoji is required');
    }

    await this.findRoomMessage(roomId, messageId);

    const existing = await this.prisma.voiceRoomMessageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji: value } },
    });

    if (existing) {
      await this.prisma.voiceRoomMessageReaction.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.voiceRoomMessageReaction.create({
        data: { messageId, userId, emoji: value },
      });
    }

    const allReactions = await this.prisma.voiceRoomMessageReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });

    const reactions: Record<string, string[]> = {};
    for (const reaction of allReactions) {
      (reactions[reaction.emoji] ??= []).push(reaction.userId);
    }

    return { messageId, reactions };
  }

  async pinVoiceRoomMessage(
    userId: string,
    roomId: string,
    messageId: string,
    pinned: boolean,
  ) {
    await this.findRoomMessage(roomId, messageId);

    if (!(await this.canModerateVoiceRoom(userId, roomId))) {
      throw new ForbiddenException(
        'Only the host or a moderator can pin messages',
      );
    }

    const updated = await this.prisma.voiceRoomMessage.update({
      where: { id: messageId },
      data: { isPinned: pinned },
      include: this.chatMessageInclude,
    });
    return this.presentVoiceRoomMessage(updated);
  }

  /** Files a moderation report for a room message; one open report per user and message */
  async reportVoiceRoomMessage(
    userId: string,
    roomId: string,
    messageId: string,
    reason: string,
    description?: string,
  ) {
    const message = await this.findRoomMessage(roomId, messageId);
    if (message.senderId === userId) {
      throw new BadRequestException("You can't report your own message");
    }

    const trimmedReason = (reason ?? '').trim().slice(0, 100);
    if (!trimmedReason) throw new BadRequestException('Pick a reason');

    const already = await this.prisma.report.findFirst({
      where: {
        reportedById: userId,
        targetId: messageId,
        targetType: 'MESSAGE',
        status: 'PENDING',
      },
      select: { id: true },
    });
    if (already) return { ok: true, alreadyReported: true };

    await this.prisma.report.create({
      data: {
        reportedById: userId,
        targetId: messageId,
        targetType: 'MESSAGE',
        reason: trimmedReason,
        description:
          [`Voice room ${roomId}`, description?.trim().slice(0, 1000)]
            .filter(Boolean)
            .join(' — ') || null,
      },
    });
    return { ok: true, alreadyReported: false };
  }

  /** Text of a message plus the language the reader wants it in (their native language) */
  async getVoiceRoomMessageForTranslation(
    userId: string,
    roomId: string,
    messageId: string,
    targetLanguage?: string,
  ) {
    const message = await this.findRoomMessage(roomId, messageId);
    if (!message.content.trim()) {
      throw new BadRequestException('Nothing to translate');
    }
    let language = targetLanguage?.trim();
    if (!language) {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        select: { nativeLanguage: true },
      });
      language = profile?.nativeLanguage || 'English';
    }
    return {
      messageId,
      text: message.content,
      language,
      version: (message.editedAt ?? message.createdAt).getTime(),
    };
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

  async getActiveParticipants(roomId: string, viewerId?: string) {
    if (viewerId) await this.assertRoomAccessById(roomId, viewerId);
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

  // ============ CORRECTIONS ============

  private static readonly CORRECTION_CATEGORIES = new Set([
    'grammar',
    'vocabulary',
    'pronunciation',
    'word-choice',
    'spelling',
    'other',
  ]);

  private readonly correctionInclude = {
    author: { select: { id: true, name: true, avatarUrl: true } },
    targetUser: { select: { id: true, name: true } },
  } as const;

  /** Shape sent to clients (timestamps in ms, names flattened) */
  private toCorrectionPayload(c: any) {
    return {
      id: c.id,
      roomId: c.roomId,
      targetUserId: c.targetUserId,
      targetUserName: c.targetUser?.name || 'Someone',
      authorId: c.authorId,
      authorName: c.author?.name || 'Someone',
      authorAvatarUrl: c.author?.avatarUrl || undefined,
      original: c.original,
      corrected: c.corrected,
      note: c.note || undefined,
      category: c.category,
      status: c.status,
      createdAt: new Date(c.createdAt).getTime(),
      resolvedAt: c.resolvedAt ? new Date(c.resolvedAt).getTime() : undefined,
    };
  }

  async createCorrection(
    authorId: string,
    data: {
      roomId: string;
      id?: string;
      targetUserId: string;
      original: string;
      corrected: string;
      note?: string;
      category?: string;
    },
  ) {
    const original = String(data.original || '').trim().slice(0, 300);
    const corrected = String(data.corrected || '').trim().slice(0, 300);
    if (!original || !corrected) {
      throw new BadRequestException('Both the original and the correction are required');
    }
    if (data.targetUserId === authorId) {
      throw new BadRequestException("You can't correct yourself here — try the practice journal");
    }

    const target = await this.prisma.voiceParticipant.findUnique({
      where: { roomId_userId: { roomId: data.roomId, userId: data.targetUserId } },
      select: { id: true },
    });
    if (!target) {
      throw new BadRequestException('That person is not in this room');
    }

    const category = VoiceService.CORRECTION_CATEGORIES.has(String(data.category))
      ? String(data.category)
      : 'other';
    // Keep the client's optimistic id when it looks like ours, so its local copy merges cleanly
    const id =
      typeof data.id === 'string' && /^corr-[a-z0-9-]{4,60}$/i.test(data.id)
        ? data.id
        : `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const saved = await this.prisma.voiceCorrection.create({
      data: {
        id,
        roomId: data.roomId,
        authorId,
        targetUserId: data.targetUserId,
        original,
        corrected,
        note: data.note ? String(data.note).trim().slice(0, 200) || null : null,
        category,
      },
      include: this.correctionInclude,
    });
    // Helping someone else learn is rewarded too
    await this.activity.recordActivity(authorId, XP_REWARDS.correctionGiven, 'CORRECTION_GIVEN');
    // The person corrected gets it as a flashcard to review later (never throws, so it can't hold up the room)
    void this.review?.addCorrectionCard(data.targetUserId, {
      source: 'voice',
      sourceId: saved.id,
      original,
      corrected,
      note: saved.note,
      category,
    });
    return this.toCorrectionPayload(saved);
  }

  /** Only the person who was corrected may accept or dismiss it */
  async resolveCorrection(
    userId: string,
    roomId: string,
    correctionId: string,
    status: 'accepted' | 'dismissed',
  ) {
    if (status !== 'accepted' && status !== 'dismissed') {
      throw new BadRequestException('Invalid status');
    }
    const existing = await this.prisma.voiceCorrection.findUnique({
      where: { id: correctionId },
      select: { roomId: true, targetUserId: true },
    });
    if (!existing || existing.roomId !== roomId) {
      throw new NotFoundException('Correction not found');
    }
    if (existing.targetUserId !== userId) {
      throw new ForbiddenException('Only the person who was corrected can do that');
    }

    const updated = await this.prisma.voiceCorrection.update({
      where: { id: correctionId },
      data: { status, resolvedAt: new Date() },
      include: this.correctionInclude,
    });
    if (status === 'accepted') {
      await this.activity.recordActivity(userId, XP_REWARDS.correctionAccepted, 'CORRECTION_ACCEPTED');
    } else {
      // Not a mistake you want to practise
      void this.review?.removeCorrectionCard(userId, 'voice', correctionId);
    }
    return this.toCorrectionPayload(updated);
  }

  async getRoomCorrections(roomId: string, limit = 100, viewerId?: string) {
    if (viewerId) await this.assertRoomAccessById(roomId, viewerId);
    const rows = await this.prisma.voiceCorrection.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: this.correctionInclude,
    });
    return rows.reverse().map((c) => this.toCorrectionPayload(c));
  }

  /** Corrections a user received across all rooms — feeds the journal and progress pages */
  async getMyCorrections(userId: string, status?: string, limit = 100) {
    const rows = await this.prisma.voiceCorrection.findMany({
      where: {
        targetUserId: userId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: {
        ...this.correctionInclude,
        room: { select: { id: true, name: true } },
      },
    });
    return rows.map((c) => ({
      ...this.toCorrectionPayload(c),
      roomName: c.room?.name,
    }));
  }
}