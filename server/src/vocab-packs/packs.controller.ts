import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VocabPacksService } from './packs.service';

@ApiTags('vocab-packs')
@Controller('vocab-packs')
@UseGuards(JwtAuthGuard)
export class VocabPacksController {
  constructor(private packs: VocabPacksService) {}

  @Get()
  @ApiOperation({ summary: 'Every vocabulary pack with your progress and the one to start next' })
  list(@Req() req: any) {
    return this.packs.list(req.user.id);
  }

  @Get('today')
  @ApiOperation({ summary: 'Word of the day for your level: the word, its meaning and example, three meanings to choose from' })
  today(@Req() req: any) {
    return this.packs.today(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One pack: its words, which you saved, and this attempt\'s quiz' })
  get(@Req() req: any, @Param('id') id: string) {
    return this.packs.get(req.user.id, id);
  }

  @Post(':id/save')
  @ApiOperation({ summary: 'Save words to your flashcard review: { wordIds?: ["w1", ...] } (all when omitted)' })
  save(@Req() req: any, @Param('id') id: string, @Body() body: { wordIds?: string[] }) {
    return this.packs.save(req.user.id, id, body?.wordIds);
  }

  @Post(':id/check')
  @ApiOperation({ summary: 'Mark one quiz answer now: { questionId, answer }. Saves nothing.' })
  check(@Req() req: any, @Param('id') id: string, @Body() body: { questionId?: string; answer?: unknown }) {
    return this.packs.check(req.user.id, id, String(body?.questionId ?? ''), body?.answer);
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'Mark the whole quiz: { answers: { "w3:meaning": 2, ... } } (position of the option as shown)' })
  finish(@Req() req: any, @Param('id') id: string, @Body() body: { answers?: Record<string, unknown> }) {
    return this.packs.finish(req.user.id, id, body?.answers);
  }
}
