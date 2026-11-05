import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DictationService } from './dictation.service';

@ApiTags('dictation')
@Controller('dictation')
@UseGuards(JwtAuthGuard)
export class DictationController {
  constructor(private dictation: DictationService) {}

  @Get('session')
  @ApiOperation({ summary: "Today's next dictation: six sentences at your level" })
  session(@Req() req: any) {
    return this.dictation.session(req.user.id);
  }

  @Get('shadowing')
  @ApiOperation({ summary: 'Six sentences to listen to and say back (round=0,1,2... for a new set)' })
  shadowing(@Req() req: any, @Query('round') round?: string) {
    return this.dictation.shadowing(req.user.id, round);
  }

  @Post('check')
  @ApiOperation({ summary: 'Mark one sentence now: { id, typed }. Saves nothing.' })
  check(@Body() body: { id?: string; typed?: string }) {
    return this.dictation.check(String(body?.id ?? ''), body?.typed);
  }

  @Post('finish')
  @ApiOperation({ summary: 'Mark and save the whole dictation: { answers: { "<id>": "what you typed" } }' })
  finish(@Req() req: any, @Body() body: { answers?: Record<string, string> }) {
    return this.dictation.finish(req.user.id, body?.answers);
  }
}
