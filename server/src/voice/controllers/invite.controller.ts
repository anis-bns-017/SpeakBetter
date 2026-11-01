
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma.service';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('voice-invites')
@Controller('voice/invites')
@UseGuards(JwtAuthGuard)
export class InviteController {
  constructor(private prisma: PrismaService) {}

  @Post(':roomId')
  @ApiOperation({ summary: 'Generate room invite' })
  @ApiResponse({ status: 200, description: 'Invite generated' })
  async generateInvite(
    @Param('roomId') roomId: string,
    @Body('maxUses') maxUses: number,
    @Body('expiresInHours') expiresInHours: number,
    @Req() req: any,
  ) {
    const userId = req.user.id;

    // Check if user is host or moderator
    const participant = await this.prisma.voiceParticipant.findFirst({
      where: {
        roomId,
        userId,
        leftAt: null,
        role: {
          in: ['SPEAKER', 'MODERATOR'],
        },
      },
    });

    if (!participant) {
      throw new Error('Insufficient permissions');
    }

    // Generate a unique code for the invite
    const code = this.generateInviteCode();

    const invite = await this.prisma.voiceRoomInvite.create({
      data: {
        id: uuidv4(),
        code: code, // ← ADD THIS - the code field is required!
        roomId,
        createdById: userId,
        maxUses: maxUses || 10,
        expiresAt: expiresInHours
          ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
          : null,
      },
    });

    return {
      inviteId: invite.id,
      code: invite.code,
      url: `${process.env.APP_URL || 'http://localhost:3000'}/join/${invite.code}`,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
    };
  }

  // Helper method to generate a readable invite code
  private generateInviteCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  @Get('validate/:code')
  @ApiOperation({ summary: 'Validate invite code' })
  @ApiResponse({ status: 200, description: 'Invite validated' })
  async validateInvite(@Param('code') code: string) {
    const invite = await this.prisma.voiceRoomInvite.findUnique({
      where: { code },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            description: true,
            creator: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!invite) {
      throw new Error('Invalid invite code');
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new Error('Invite has expired');
    }

    if (invite.uses >= invite.maxUses) {
      throw new Error('Invite has reached maximum uses');
    }

    return {
      isValid: true,
      room: invite.room,
      createdBy: invite.createdBy,
      uses: invite.uses,
      maxUses: invite.maxUses,
    };
  }

  @Post('use/:code')
  @ApiOperation({ summary: 'Use invite code to join room' })
  @ApiResponse({ status: 200, description: 'Joined room via invite' })
  async useInvite(
    @Param('code') code: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;

    const invite = await this.prisma.voiceRoomInvite.findUnique({
      where: { code },
    });

    if (!invite) {
      throw new Error('Invalid invite code');
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new Error('Invite has expired');
    }

    if (invite.uses >= invite.maxUses) {
      throw new Error('Invite has reached maximum uses');
    }

    // Someone the host removed cannot come back through an invite either
    const banned = await this.prisma.voiceRoomBan.findUnique({
      where: { roomId_userId: { roomId: invite.roomId, userId } },
      select: { id: true },
    });
    if (banned) {
      throw new ForbiddenException('You were removed from this room by the host.');
    }

    // Check if user is already in room
    const existingParticipant = await this.prisma.voiceParticipant.findFirst({
      where: {
        roomId: invite.roomId,
        userId,
        leftAt: null,
      },
    });

    if (existingParticipant) {
      throw new Error('Already in room');
    }

    // Join room
    await this.prisma.$transaction([
      this.prisma.voiceRoomInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
      this.prisma.voiceParticipant.create({
        data: {
          roomId: invite.roomId,
          userId,
          role: 'LISTENER',
        },
      }),
    ]);

    return {
      roomId: invite.roomId,
      message: 'Successfully joined room',
    };
  }

  @Delete(':inviteId')
  @ApiOperation({ summary: 'Delete invite' })
  @ApiResponse({ status: 200, description: 'Invite deleted' })
  async deleteInvite(
    @Param('inviteId') inviteId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;

    const invite = await this.prisma.voiceRoomInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new Error('Invite not found');
    }

    // Check if user is the creator
    if (invite.createdById !== userId) {
      throw new Error('Unauthorized');
    }

    await this.prisma.voiceRoomInvite.delete({
      where: { id: inviteId },
    });

    return { success: true };
  }
}