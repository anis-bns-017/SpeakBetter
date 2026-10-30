import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  SendFriendRequestDto,
  RespondFriendRequestDto,
  CancelFriendRequestDto,
  BlockUserDto,
} from './dto/friend-request.dto';
import { SearchUsersDto } from './dto/search-friends.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  // ============ FRIEND REQUESTS ============

  @Post('requests')
  async sendFriendRequest(@Request() req, @Body() dto: SendFriendRequestDto) {
    return this.friendsService.sendFriendRequest(req.user.id, dto);
  }

  @Put('requests/respond')
  async respondFriendRequest(
    @Request() req,
    @Body() dto: RespondFriendRequestDto,
  ) {
    return this.friendsService.respondFriendRequest(req.user.id, dto);
  }

  @Delete('requests/:requestId')
  async cancelFriendRequest(
    @Request() req,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.cancelFriendRequest(req.user.id, requestId);
  }

  @Get('requests/incoming')
  async getIncomingRequests(@Request() req) {
    return this.friendsService.getFriendRequests(req.user.id);
  }

  @Get('requests/outgoing')
  async getOutgoingRequests(@Request() req) {
    return this.friendsService.getSentFriendRequests(req.user.id);
  }

  // ============ FRIENDS ============

  @Get()
  async getFriends(@Request() req) {
    return this.friendsService.getFriends(req.user.id);
  }

  @Get('count')
  async getFriendCount(@Request() req) {
    return this.friendsService.getFriendCount(req.user.id);
  }

  // ============ BLOCKING ============

  @Post('block')
  async blockUser(@Request() req, @Body() dto: BlockUserDto) {
    return this.friendsService.blockUser(req.user.id, dto);
  }

  @Delete('block/:userId')
  async unblockUser(@Request() req, @Param('userId') userId: string) {
    return this.friendsService.unblockUser(req.user.id, userId);
  }

  @Get('blocked')
  async getBlockedUsers(@Request() req) {
    return this.friendsService.getBlockedUsers(req.user.id);
  }

  // ============ SUGGESTIONS ============

  @Get('suggestions')
  async getSuggestions(@Request() req, @Query('limit') limit?: string) {
    return this.friendsService.getSuggestions(
      req.user.id,
      limit ? Number(limit) : undefined,
    );
  }

  // ============ SEARCH ============

  @Get('search')
  async searchUsers(@Request() req, @Query('query') query: string) {
    if (!query || query.length < 2) {
      return [];
    }
    return this.friendsService.searchUsers(req.user.id, query);
  }

  // ============ ONLINE STATUS ============

  @Get('online/:userId')
  async getOnlineStatus(@Param('userId') userId: string) {
    return this.friendsService.getOnlineStatus(userId);
  }

  @Post('online/update')
  @HttpCode(HttpStatus.OK)
  async updateLastActive(@Request() req) {
    return this.friendsService.updateLastActive(req.user.id);
  }

  // ============ UTILITY ============

  @Get('check/:userId')
  async checkFriendship(@Request() req, @Param('userId') userId: string) {
    return this.friendsService.checkFriendship(req.user.id, userId);
  }
}
