import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { GamesService } from './games.service';

@ApiTags('games')
@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private games: GamesService) {}

  @Get('today')
  @ApiOperation({ summary: "Today's state of each word game and your totals" })
  today(@Req() req: any) {
    return this.games.today(req.user.id);
  }

  @Post('wordle/check')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'games-wordle', limit: 40, windowMs: 60_000 })
  @ApiOperation({ summary: 'Mark your Word Guess guesses so far: { guesses: ["table", ...] }' })
  wordle(@Req() req: any, @Body() body: { guesses?: unknown }) {
    return this.games.checkWordle(req.user.id, body?.guesses);
  }

  @Get('scramble')
  @ApiOperation({ summary: 'Five scrambled words at your level (round=0,1,2... for another set)' })
  scramble(@Req() req: any, @Query('round') round?: string) {
    return this.games.scrambleRound(req.user.id, round);
  }

  @Post('scramble/check')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'games-scramble', limit: 30, windowMs: 60_000 })
  @ApiOperation({ summary: 'Mark a round: { round, answers: { "<id>": "word" } }' })
  scrambleCheck(@Req() req: any, @Body() body: { round?: unknown; answers?: unknown }) {
    return this.games.checkScramble(req.user.id, body?.round, body?.answers);
  }
}
