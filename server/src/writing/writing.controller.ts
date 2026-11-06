import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { WritingService } from './writing.service';

interface TextBody {
  text?: string;
  variant?: 'en-GB' | 'en-US';
}

@ApiTags('writing')
@Controller('writing')
@UseGuards(JwtAuthGuard)
export class WritingController {
  constructor(private writing: WritingService) {}

  @Get()
  @ApiOperation({ summary: "Writing tasks for every level, today's task, your recent writing and totals" })
  overview(@Req() req: any) {
    return this.writing.overview(req.user.id);
  }

  @Post('pieces')
  @ApiOperation({ summary: 'Start writing a task ({ promptId }, or "free"); returns the open draft if there is one' })
  start(@Req() req: any, @Body() body: { promptId?: string }) {
    return this.writing.start(req.user.id, body?.promptId);
  }

  @Get('pieces/:id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.writing.get(req.user.id, id);
  }

  @Put('pieces/:id')
  @ApiOperation({ summary: 'Autosave the draft' })
  save(@Req() req: any, @Param('id') id: string, @Body() body: TextBody) {
    return this.writing.save(req.user.id, id, body ?? {});
  }

  @Post('pieces/:id/check')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'writing-check', limit: 8, windowMs: 60_000 })
  @ApiOperation({ summary: 'Check grammar, spelling, punctuation and style' })
  check(@Req() req: any, @Param('id') id: string, @Body() body: TextBody) {
    return this.writing.check(req.user.id, id, body ?? {});
  }

  @Post('pieces/:id/finish')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'writing-finish', limit: 6, windowMs: 60_000 })
  @ApiOperation({ summary: 'Finish the piece: score, XP and review cards from your mistakes' })
  finish(@Req() req: any, @Param('id') id: string, @Body() body: TextBody) {
    return this.writing.finish(req.user.id, id, body ?? {});
  }

  @Delete('pieces/:id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.writing.remove(req.user.id, id);
  }
}
