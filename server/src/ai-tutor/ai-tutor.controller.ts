import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AiTutorService } from './ai-tutor.service';
import { StartTutorSessionDto, TutorTurnDto } from './dto/ai-tutor.dto';

@ApiTags('ai-tutor')
@Controller('ai-tutor')
@UseGuards(JwtAuthGuard)
export class AiTutorController {
  constructor(private tutor: AiTutorService) {}

  @Get('status')
  @ApiOperation({ summary: 'Is the AI partner available, my level, turns left today, and any unfinished conversation' })
  status(@Req() req: any) {
    return this.tutor.getStatus(req.user.id);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Start a conversation; returns the partner\'s opening line' })
  start(@Req() req: any, @Body() body: StartTutorSessionDto) {
    return this.tutor.startSession(req.user.id, body.scenario, body.level);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'A conversation with all its messages (to resume it, or look back)' })
  get(@Req() req: any, @Param('id') id: string) {
    return this.tutor.getSession(req.user.id, id);
  }

  @Post('sessions/:id/turn')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'ai-tutor-turn', limit: 30, windowMs: 60_000 })
  @ApiOperation({ summary: 'Say something; returns the partner\'s reply plus corrections on what you said' })
  turn(@Req() req: any, @Param('id') id: string, @Body() body: TutorTurnDto) {
    return this.tutor.turn(req.user.id, id, body.text);
  }

  @Post('sessions/:id/end')
  @ApiOperation({ summary: 'Finish the conversation and get the recap' })
  end(@Req() req: any, @Param('id') id: string) {
    return this.tutor.endSession(req.user.id, id);
  }
}
