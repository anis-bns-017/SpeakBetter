import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { SpeakingExamService } from './speaking-exam.service';

@ApiTags('speaking-exam')
@Controller('speaking-exam')
@UseGuards(JwtAuthGuard)
export class SpeakingExamController {
  constructor(private exam: SpeakingExamService) {}

  @Get('paper')
  @ApiOperation({ summary: 'A speaking mock test: Part 1 questions, a Part 2 cue card and Part 3 follow-ups (?id= repeats one)' })
  paper(@Query('id') id?: string) {
    return this.exam.paper(id);
  }

  @Post('score')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'speaking-exam-score', limit: 6, windowMs: 60_000 })
  @ApiOperation({ summary: 'Score a finished test from the transcripts: { parts: [{ part, question, transcript, seconds }] }' })
  score(@Body() body: { parts?: unknown }) {
    return this.exam.score(body ?? {});
  }
}
