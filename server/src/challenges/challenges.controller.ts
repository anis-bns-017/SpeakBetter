import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { ChallengesService } from './challenges.service';

@ApiTags('challenges')
@Controller('challenges')
@UseGuards(JwtAuthGuard)
export class ChallengesController {
  constructor(private challenges: ChallengesService) {}

  @Get('today')
  @ApiOperation({ summary: "Today's speaking challenge for your level (or ?level=B2), your answer and everyone's answers" })
  today(@Req() req: any, @Query('level') level?: string) {
    return this.challenges.today(req.user.id, level);
  }

  @Post('entries')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'challenge-entry', limit: 10, windowMs: 60_000 })
  @ApiOperation({ summary: "Save your answer to today's challenge (recording again replaces it)" })
  submit(
    @Req() req: any,
    @Body() body: { promptId?: string; audioUrl?: string; transcript?: string; durationSec?: number; visibility?: string },
  ) {
    return this.challenges.submit(req.user.id, body ?? {});
  }

  @Delete('entries/mine')
  @ApiOperation({ summary: "Delete your answer to today's challenge" })
  removeMine(@Req() req: any) {
    return this.challenges.removeMine(req.user.id);
  }

  @Post('entries/:id/react')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'challenge-react', limit: 60, windowMs: 60_000 })
  @ApiOperation({ summary: 'React to an answer: { emoji: "👏" }, or { emoji: null } to take it back' })
  react(@Req() req: any, @Param('id') id: string, @Body() body: { emoji?: string | null }) {
    return this.challenges.react(req.user.id, id, body?.emoji ?? null);
  }
}
