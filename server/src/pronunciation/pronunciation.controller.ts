import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { SubmitAttemptDto } from './dto/pronunciation.dto';
import { PronunciationService } from './pronunciation.service';

@ApiTags('pronunciation')
@Controller('pronunciation')
@UseGuards(JwtAuthGuard)
export class PronunciationController {
  constructor(private pronunciation: PronunciationService) {}

  @Get('practice')
  @ApiOperation({ summary: 'Sounds to practise (with your best scores), sentences for your level, and your own words' })
  practice(@Req() req: any) {
    return this.pronunciation.getPractice(req.user.id);
  }

  @Get('drill')
  @ApiOperation({ summary: "Today's short practice: your weakest sounds, the words you keep missing, and level sentences" })
  drill(@Req() req: any) {
    return this.pronunciation.getDrill(req.user.id);
  }

  @Post('attempts')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'pronunciation-attempt', limit: 40, windowMs: 60_000 })
  @ApiOperation({ summary: 'Score one go at saying something: each word, the score, and tips for the sounds' })
  attempt(@Req() req: any, @Body() body: SubmitAttemptDto) {
    return this.pronunciation.submitAttempt(req.user.id, body);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Your last 30 days: average score, trend, weak sounds and words you keep missing' })
  progress(@Req() req: any) {
    return this.pronunciation.getProgress(req.user.id);
  }
}
