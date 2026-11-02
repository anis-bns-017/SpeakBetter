import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewService } from './review.service';
import { AnswerReviewDto, GetReviewQueueDto } from './dto/review.dto';

@ApiTags('review')
@Controller('review')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private review: ReviewService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Cards and saved words to review now (add all=1 for everything)' })
  queue(@Req() req: any, @Query() query: GetReviewQueueDto) {
    return this.review.getQueue(req.user.id, {
      all: query.all === '1' || query.all === 'true',
      kind: query.kind,
      pattern: query.pattern,
      language: query.language,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Post('answer')
  @ApiOperation({ summary: 'Say how well you knew a card: again, hard, good or easy' })
  answer(@Req() req: any, @Body() body: AnswerReviewDto) {
    return this.review.answer(req.user.id, body);
  }

  @Get('mistakes')
  @ApiOperation({ summary: 'The kinds of mistake that keep coming back, from your recent corrections' })
  mistakes(@Req() req: any, @Query('days') days?: string) {
    return this.review.getMistakesReport(req.user.id, days ? Number(days) : undefined);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Turn corrections from the last 90 days into cards (safe to repeat)' })
  sync(@Req() req: any) {
    return this.review.syncHistory(req.user.id);
  }
}
