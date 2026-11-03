import { Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { FollowService } from './follow.service';
import { RoomRemindersService } from './room-reminders.service';

@ApiTags('social')
@Controller()
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(
    private follows: FollowService,
    private reminders: RoomRemindersService,
  ) {}

  @Get('users/:id/follow')
  @ApiOperation({ summary: 'Whether you follow this person, whether they follow you, and their counts' })
  followStatus(@Req() req: any, @Param('id') id: string) {
    return this.follows.status(req.user.id, id);
  }

  @Post('users/:id/follow')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'follow', limit: 60, windowMs: 60_000 })
  @ApiOperation({ summary: 'Follow someone: hear when they go live or schedule a room' })
  follow(@Req() req: any, @Param('id') id: string) {
    return this.follows.follow(req.user.id, id);
  }

  @Delete('users/:id/follow')
  @ApiOperation({ summary: 'Stop following someone' })
  unfollow(@Req() req: any, @Param('id') id: string) {
    return this.follows.unfollow(req.user.id, id);
  }

  @Get('voice/upcoming')
  @ApiOperation({ summary: 'Scheduled rooms you can join, soonest first' })
  upcoming(@Req() req: any) {
    return this.reminders.upcoming(req.user.id);
  }

  @Get('voice/interests')
  @ApiOperation({ summary: 'For room cards: reminder counts and yours (ids=a,b,c)' })
  interests(@Req() req: any, @Query('ids') ids?: string) {
    return this.reminders.interestsFor(req.user.id, (ids ?? '').split(',').filter(Boolean));
  }

  @Post('voice/rooms/:id/interest')
  @ApiOperation({ summary: 'Remind me when this scheduled room starts' })
  remind(@Req() req: any, @Param('id') id: string) {
    return this.reminders.setInterest(req.user.id, id, true);
  }

  @Delete('voice/rooms/:id/interest')
  @ApiOperation({ summary: 'No reminder for this room' })
  forget(@Req() req: any, @Param('id') id: string) {
    return this.reminders.setInterest(req.user.id, id, false);
  }
}
