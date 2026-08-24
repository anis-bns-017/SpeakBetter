// server/src/voice/voice.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { VoiceService } from './voice.service';
import { LiveKitService } from './livekit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscoverRoomsDto } from './dto/discovery.dto';
import {
  CreateVoiceRoomDto,
  UpdateVoiceRoomDto,
  StageActionDto,
  RaiseHandDto,
  SendVoiceMessageDto,
} from './dto/voice.dto';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);

  constructor(
    private voiceService: VoiceService,
    private liveKitService: LiveKitService,
  ) {}

  // ============ ROOMS ============

  @Get('rooms')
  async getRooms(
    @Request() req,
    @Query() query: { type?: string; status?: string },
  ) {
    return this.voiceService.getRooms(req.user.id, query);
  }

  @Get('rooms/:roomId')
  async getRoom(@Request() req, @Param('roomId') roomId: string) {
    return this.voiceService.getRoomById(roomId, req.user.id);
  }

  @Post('rooms')
  async createRoom(@Request() req, @Body() dto: CreateVoiceRoomDto) {
    return this.voiceService.createRoom(req.user.id, dto);
  }

  @Put('rooms/:roomId')
  async updateRoom(
    @Request() req,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateVoiceRoomDto,
  ) {
    return this.voiceService.updateRoom(req.user.id, roomId, dto);
  }

  @Post('rooms/:roomId/end')
  @HttpCode(HttpStatus.OK)
  async endRoom(@Request() req, @Param('roomId') roomId: string) {
    return this.voiceService.endRoom(req.user.id, roomId);
  }

  // ============ PARTICIPANTS ============

  @Post('rooms/:roomId/join')
  async joinRoom(@Request() req, @Param('roomId') roomId: string) {
    try {
      const userId = req.user.id;
      this.logger.log(`User ${userId} joining room ${roomId}`);

      const result = await this.voiceService.joinRoom(userId, roomId);

      // ✅ Check if result has room data
      if (!result.room) {
        this.logger.error(`❌ No room data returned for room ${roomId}`);
        throw new HttpException(
          {
            success: false,
            message: 'Failed to get room information',
            error: 'ROOM_DATA_MISSING',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Check if LiveKit is available
      if (!this.liveKitService.isAvailable()) {
        this.logger.warn(`⚠️ LiveKit not available for room ${roomId}`);
        throw new HttpException(
          {
            success: false,
            message:
              'Voice service is currently unavailable. Please try again later.',
            error: 'LIVEKIT_UNAVAILABLE',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Generate LiveKit token
      try {
        const liveKitRoomId = result.room.liveKitRoomId || roomId;
        this.logger.log(
          `Generating token for room ${liveKitRoomId}, user ${userId}`,
        );

        const token = await this.liveKitService.generateToken(
          liveKitRoomId,
          userId,
        );

        // Validate token is not mock
        if (token.startsWith('mock-')) {
          this.logger.error(
            `❌ Mock token generated for user ${userId} in room ${roomId}`,
          );
          throw new HttpException(
            {
              success: false,
              message:
                'Voice service is currently unavailable. Please try again later.',
              error: 'INVALID_TOKEN',
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        this.logger.log(
          `✅ Token generated successfully for user ${userId} in room ${roomId}`,
        );

        return {
          success: true,
          data: {
            token,
            wsUrl: this.liveKitService.getWebSocketUrl(),
            room: {
              id: result.room.id,
              name: result.room.name,
              liveKitRoomId: result.room.liveKitRoomId,
            },
            participant: result.participant,
          },
        };
      } catch (error) {
        this.logger.error(
          `❌ Failed to generate LiveKit token: ${error.message}`,
        );
        throw new HttpException(
          {
            success: false,
            message: 'Failed to connect to voice service. Please try again.',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Join room error: ${error.message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to join room',
          error: 'JOIN_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms/:roomId/leave')
  @HttpCode(HttpStatus.OK)
  async leaveRoom(@Request() req, @Param('roomId') roomId: string) {
    try {
      const userId = req.user.id;
      this.logger.log(`User ${userId} leaving room ${roomId}`);
      return await this.voiceService.leaveRoom(userId, roomId);
    } catch (error) {
      this.logger.error(`❌ Leave room error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to leave room',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rooms/:roomId/participants')
  async getRoomParticipants(@Request() req, @Param('roomId') roomId: string) {
    try {
      return await this.voiceService.getRoomParticipants(roomId, req.user.id);
    } catch (error) {
      this.logger.error(`❌ Get participants error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to get participants',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('rooms/:roomId/role/:userId')
  async updateRole(
    @Request() req,
    @Param('roomId') roomId: string,
    @Param('userId') targetUserId: string,
    @Body('role') role: string,
  ) {
    try {
      return await this.voiceService.updateParticipantRole(
        req.user.id,
        roomId,
        targetUserId,
        role,
      );
    } catch (error) {
      this.logger.error(`❌ Update role error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to update role',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============ ROOM DISCOVERY ============

  @Get('discover')
  async discoverRooms(@Request() req, @Query() dto: DiscoverRoomsDto) {
    return this.voiceService.discoverRooms(req.user.id, dto);
  }

  @Get('trending')
  async getTrendingRooms(@Request() req, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.voiceService.getTrendingRooms(req.user.id, parsedLimit);
  }

  @Get('categories')
  async getRoomCategories() {
    return this.voiceService.getRoomCategories();
  }

  @Get('live-count')
  async getLiveRoomsCount() {
    return this.voiceService.getLiveRoomsCount();
  }

  @Get('recommended')
  async getRecommendedRooms(@Request() req, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.voiceService.getRecommendedRooms(req.user.id, parsedLimit);
  }

  // ============ HOST PROMOTION ============

  @Post('rooms/:roomId/promote-host/:userId')
  @HttpCode(HttpStatus.OK)
  async promoteHost(
    @Request() req,
    @Param('roomId') roomId: string,
    @Param('userId') newHostId: string,
  ) {
    try {
      return await this.voiceService.promoteHost(
        req.user.id,
        roomId,
        newHostId,
      );
    } catch (error) {
      this.logger.error(`❌ Promote host error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to promote host',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============ STAGE ============

  @Post('rooms/:roomId/stage/add/:userId')
  async addToStage(
    @Request() req,
    @Param('roomId') roomId: string,
    @Param('userId') targetUserId: string,
  ) {
    try {
      return await this.voiceService.addToStage(
        req.user.id,
        roomId,
        targetUserId,
      );
    } catch (error) {
      this.logger.error(`❌ Add to stage error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to add to stage',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms/:roomId/stage/remove/:userId')
  async removeFromStage(
    @Request() req,
    @Param('roomId') roomId: string,
    @Param('userId') targetUserId: string,
  ) {
    try {
      return await this.voiceService.removeFromStage(
        req.user.id,
        roomId,
        targetUserId,
      );
    } catch (error) {
      this.logger.error(`❌ Remove from stage error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to remove from stage',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============ RECORDINGS ============

  @Get('rooms/:roomId/recordings')
  async getRecordings(@Request() req, @Param('roomId') roomId: string) {
    try {
      return await this.voiceService.getRecordings(roomId, req.user.id);
    } catch (error) {
      this.logger.error(`❌ Get recordings error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to get recordings',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms/:roomId/recordings/start')
  @HttpCode(HttpStatus.OK)
  async startRecording(@Request() req, @Param('roomId') roomId: string) {
    try {
      // Check if LiveKit is available for recording
      if (!this.liveKitService.isAvailable()) {
        throw new HttpException(
          {
            success: false,
            message: 'Recording service is currently unavailable',
            error: 'RECORDING_UNAVAILABLE',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      return await this.voiceService.startRecording(req.user.id, roomId);
    } catch (error) {
      this.logger.error(`❌ Start recording error: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to start recording',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms/:roomId/recordings/stop')
  @HttpCode(HttpStatus.OK)
  async stopRecording(@Request() req, @Param('roomId') roomId: string) {
    try {
      return await this.voiceService.stopRecording(req.user.id, roomId);
    } catch (error) {
      this.logger.error(`❌ Stop recording error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to stop recording',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============ CHAT MESSAGES ============

  @Get('rooms/:roomId/messages')
  async getRoomMessages(
    @Request() req,
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    try {
      return await this.voiceService.getVoiceRoomMessages(
        req.user.id,
        roomId,
        limit ? parseInt(limit, 10) : 50,
        before,
      );
    } catch (error) {
      this.logger.error(`❌ Get messages error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to get messages',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms/:roomId/messages')
  async sendRoomMessage(
    @Request() req,
    @Param('roomId') roomId: string,
    @Body() dto: SendVoiceMessageDto,
  ) {
    try {
      return await this.voiceService.sendVoiceRoomMessage(
        req.user.id,
        roomId,
        dto.content,
        dto.type || 'TEXT',
        dto.mediaUrl,
        dto.fileUrl,
        dto.replyToId,
      );
    } catch (error) {
      this.logger.error(`❌ Send message error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to send message',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('rooms/:roomId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async deleteRoomMessage(
    @Request() req,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
  ) {
    try {
      return await this.voiceService.deleteVoiceRoomMessage(
        req.user.id,
        roomId,
        messageId,
      );
    } catch (error) {
      this.logger.error(`❌ Delete message error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to delete message',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============ RAISE HAND ============

  @Post('rooms/:roomId/raise-hand')
  @HttpCode(HttpStatus.OK)
  async raiseHand(
    @Request() req,
    @Param('roomId') roomId: string,
    @Body() dto: RaiseHandDto,
  ) {
    try {
      // ✅ Fix: Use dto.raise instead of dto.raised
      await this.voiceService.handleRaiseHand(req.user.id, roomId, dto.raise);
      return {
        success: true,
        message: dto.raise ? 'Hand raised' : 'Hand lowered',
      };
    } catch (error) {
      this.logger.error(`❌ Raise hand error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to raise hand',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============ LIVEKIT STATUS ============

  @Get('status')
  async getLiveKitStatus() {
    try {
      const status = this.liveKitService.getStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error(`❌ Get status error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get service status',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============ CHECK USER STATUS ============

  @Get('rooms/:roomId/status')
  async checkUserStatus(@Request() req, @Param('roomId') roomId: string) {
    try {
      const isInRoom = await this.voiceService.isUserInRoom(
        roomId,
        req.user.id,
      );
      return {
        success: true,
        data: { inRoom: isInRoom },
      };
    } catch (error) {
      this.logger.error(`❌ Check status error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to check user status',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rooms/:roomId/active-participants')
  async getActiveParticipants(@Request() req, @Param('roomId') roomId: string) {
    try {
      return await this.voiceService.getActiveParticipants(roomId);
    } catch (error) {
      this.logger.error(`❌ Get active participants error: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to get active participants',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
