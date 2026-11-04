import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BadgesService } from './badges.service';
import { LeaguesService } from './leagues.service';

@ApiTags('gamification')
@Controller()
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(
    private badges: BadgesService,
    private leagues: LeaguesService,
  ) {}

  @Get('achievements')
  @ApiOperation({ summary: 'Every badge, which ones you have, and how close you are to the rest' })
  achievements(@Req() req: any) {
    return this.badges.list(req.user.id);
  }

  @Get('leagues/current')
  @ApiOperation({ summary: "Your league this week: your group ranked by XP, and last week's result" })
  league(@Req() req: any) {
    return this.leagues.current(req.user.id);
  }

  @Get('leagues/friends')
  @ApiOperation({ summary: "This week's XP among you, your friends and the people you follow" })
  friends(@Req() req: any) {
    return this.leagues.friends(req.user.id);
  }

  @Get('celebrations')
  @ApiOperation({ summary: "New badges and last week's league result that you haven't seen yet" })
  celebrations(@Req() req: any) {
    return this.leagues.celebrations(req.user.id);
  }

  @Post('celebrations/seen')
  @ApiOperation({ summary: 'Mark celebrations as seen: { badges: true } and/or { league: true }' })
  celebrated(@Req() req: any, @Body() body: { badges?: boolean; league?: boolean }) {
    return this.leagues.markCelebrated(req.user.id, body ?? {});
  }
}
