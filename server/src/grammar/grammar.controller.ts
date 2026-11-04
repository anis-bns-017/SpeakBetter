import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GrammarService } from './grammar.service';

@ApiTags('grammar')
@Controller('grammar')
@UseGuards(JwtAuthGuard)
export class GrammarController {
  constructor(private grammar: GrammarService) {}

  @Get('lessons')
  @ApiOperation({ summary: 'Every grammar lesson with your progress and the one to do next' })
  list(@Req() req: any) {
    return this.grammar.list(req.user.id);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'One lesson: the rules, common mistakes and exercises' })
  get(@Req() req: any, @Param('id') id: string) {
    return this.grammar.get(req.user.id, id);
  }

  @Post('lessons/:id/check')
  @ApiOperation({ summary: 'Mark one exercise now: { exerciseId, answer }. Saves nothing.' })
  check(@Req() req: any, @Param('id') id: string, @Body() body: { exerciseId?: string; answer?: unknown }) {
    return this.grammar.check(req.user.id, id, String(body?.exerciseId ?? ''), body?.answer);
  }

  @Post('lessons/:id/finish')
  @ApiOperation({ summary: 'Mark the whole lesson: { answers: { q1: 2, q4: ["Are","you"...], q5: "are" } }' })
  finish(@Req() req: any, @Param('id') id: string, @Body() body: { answers?: Record<string, unknown> }) {
    return this.grammar.finish(req.user.id, id, body?.answers);
  }
}
