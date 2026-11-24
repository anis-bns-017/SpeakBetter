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
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateChannelDto,
  UpdateChannelDto,
  CreateThreadDto,
  CreateReplyDto,
  UpdateThreadDto,
  ReportPostDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  BanMemberDto,
  CreateInviteDto,
} from './dto/community.dto';

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class CommunitiesController {
  constructor(private communitiesService: CommunitiesService) {}

  // ============ COMMUNITIES ============

  @Get()
  async getCommunities(@Request() req) {
    return this.communitiesService.getCommunities(req.user.id);
  }

  @Get(':communityId')
  async getCommunity(
    @Request() req,
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.getCommunityById(communityId, req.user.id);
  }

  @Post()
  @UseGuards(VerifiedEmailGuard, RateLimitGuard)
  @RateLimit({ name: 'community-create', limit: 10, windowMs: 60 * 60_000 })
  async createCommunity(@Request() req, @Body() dto: CreateCommunityDto) {
    return this.communitiesService.createCommunity(req.user.id, dto);
  }

  @Put(':communityId')
  async updateCommunity(
    @Request() req,
    @Param('communityId') communityId: string,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communitiesService.updateCommunity(
      req.user.id,
      communityId,
      dto,
    );
  }

  @Delete(':communityId')
  async deleteCommunity(
    @Request() req,
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.deleteCommunity(req.user.id, communityId);
  }

  // ============ CHANNELS ============

  @Post(':communityId/channels')
  async createChannel(
    @Request() req,
    @Param('communityId') communityId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.communitiesService.createChannel(req.user.id, communityId, dto);
  }

  @Put(':communityId/channels/:channelId')
  async updateChannel(
    @Request() req,
    @Param('communityId') communityId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.communitiesService.updateChannel(
      req.user.id,
      communityId,
      channelId,
      dto,
    );
  }

  @Delete(':communityId/channels/:channelId')
  async deleteChannel(
    @Request() req,
    @Param('communityId') communityId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.communitiesService.deleteChannel(
      req.user.id,
      communityId,
      channelId,
    );
  }

  // ============ THREADS ============

  @Post('channels/:channelId/threads')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'community-post', limit: 15, windowMs: 60_000 })
  async createThread(
    @Request() req,
    @Param('channelId') channelId: string,
    @Body() dto: CreateThreadDto,
  ) {
    return this.communitiesService.createThread(req.user.id, channelId, dto);
  }

  @Get('channels/:channelId/threads')
  async getThreads(@Request() req, @Param('channelId') channelId: string) {
    return this.communitiesService.getThreads(channelId, req.user.id);
  }

  @Get('threads/:threadId')
  async getThread(@Request() req, @Param('threadId') threadId: string) {
    return this.communitiesService.getThreadById(threadId, req.user.id);
  }

  @Post('threads/:threadId/messages')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'community-reply', limit: 30, windowMs: 60_000 })
  async replyToThread(
    @Request() req,
    @Param('threadId') threadId: string,
    @Body() dto: CreateReplyDto,
  ) {
    return this.communitiesService.replyToThread(req.user.id, threadId, dto);
  }

  @Post('threads/:threadId/report')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'community-report', limit: 20, windowMs: 60 * 60_000 })
  async reportThread(
    @Request() req,
    @Param('threadId') threadId: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.communitiesService.reportPost(req.user.id, 'thread', threadId, dto);
  }

  @Post('threads/messages/:messageId/report')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'community-report', limit: 20, windowMs: 60 * 60_000 })
  async reportReply(
    @Request() req,
    @Param('messageId') messageId: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.communitiesService.reportPost(req.user.id, 'reply', messageId, dto);
  }

  @Put('threads/:threadId')
  async updateThread(
    @Request() req,
    @Param('threadId') threadId: string,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.communitiesService.updateThread(req.user.id, threadId, dto);
  }

  @Delete('threads/:threadId')
  async deleteThread(@Request() req, @Param('threadId') threadId: string) {
    return this.communitiesService.deleteThread(req.user.id, threadId);
  }

  @Delete('threads/messages/:messageId')
  async deleteReply(@Request() req, @Param('messageId') messageId: string) {
    return this.communitiesService.deleteReply(req.user.id, messageId);
  }

  // ============ MEMBERS ============

  @Post(':communityId/join')
  async joinCommunity(
    @Request() req,
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.joinCommunity(req.user.id, communityId);
  }

  @Post(':communityId/leave')
  @HttpCode(HttpStatus.OK)
  async leaveCommunity(
    @Request() req,
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.leaveCommunity(req.user.id, communityId);
  }

  @Post(':communityId/members')
  async addMember(
    @Request() req,
    @Param('communityId') communityId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.communitiesService.addMember(req.user.id, communityId, dto);
  }

  @Put(':communityId/members/:userId/role')
  async updateMemberRole(
    @Request() req,
    @Param('communityId') communityId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.communitiesService.updateMemberRole(
      req.user.id,
      communityId,
      targetUserId,
      dto,
    );
  }

  @Delete(':communityId/members/:userId')
  async removeMember(
    @Request() req,
    @Param('communityId') communityId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.communitiesService.removeMember(
      req.user.id,
      communityId,
      targetUserId,
    );
  }

  // ============ ROLES ============

  @Post(':communityId/roles')
  async createRole(
    @Request() req,
    @Param('communityId') communityId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.communitiesService.createRole(req.user.id, communityId, dto);
  }

  @Put(':communityId/roles/:roleId')
  async updateRole(
    @Request() req,
    @Param('communityId') communityId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.communitiesService.updateRole(
      req.user.id,
      communityId,
      roleId,
      dto,
    );
  }

  @Delete(':communityId/roles/:roleId')
  async deleteRole(
    @Request() req,
    @Param('communityId') communityId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.communitiesService.deleteRole(req.user.id, communityId, roleId);
  }

  // ============ BANS ============

  @Post(':communityId/bans')
  async banMember(
    @Request() req,
    @Param('communityId') communityId: string,
    @Body() dto: BanMemberDto,
  ) {
    return this.communitiesService.banMember(req.user.id, communityId, dto);
  }

  @Delete(':communityId/bans/:userId')
  async unbanMember(
    @Request() req,
    @Param('communityId') communityId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.communitiesService.unbanMember(
      req.user.id,
      communityId,
      targetUserId,
    );
  }

  // ============ INVITES ============

  @Get(':communityId/invites')
  async getInvites(
    @Request() req,
    @Param('communityId') communityId: string,
  ) {
    return this.communitiesService.getInvites(req.user.id, communityId);
  }

  @Delete(':communityId/invites/:inviteId')
  async revokeInvite(
    @Request() req,
    @Param('communityId') communityId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.communitiesService.revokeInvite(
      req.user.id,
      communityId,
      inviteId,
    );
  }

  @Post(':communityId/invites')
  async createInvite(
    @Request() req,
    @Param('communityId') communityId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.communitiesService.createInvite(req.user.id, communityId, dto);
  }

  @Post('join/:code')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'community-invite', limit: 20, windowMs: 60_000 })
  async joinByInvite(@Request() req, @Param('code') code: string) {
    return this.communitiesService.joinByInvite(req.user.id, code);
  }
}
