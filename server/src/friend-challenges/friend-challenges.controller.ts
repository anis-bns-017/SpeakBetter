import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { FriendChallengesService } from './friend-challenges.service';

@ApiTags('friend-challenges')
@Controller('friend-challenges')
@UseGuards(JwtAuthGuard)
export class FriendChallengesController {
  constructor(private challenges: FriendChallengesService) {}

  @Get()
  @ApiOperation({ summary: 'Challenges you received and sent' })
  list(@Req() req: any) {
    return this.challenges.list(req.user.id);
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'friend-challenge', limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Challenge a friend to beat your best: { friendId, kind: grammar|pack|dictation, refId }' })
  create(@Req() req: any, @Body() body: { friendId?: string; kind?: string; refId?: string }) {
    return this.challenges.create(req.user.id, body ?? {});
  }
}
