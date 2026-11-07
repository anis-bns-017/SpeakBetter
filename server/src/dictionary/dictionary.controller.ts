import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { DictionaryService } from './dictionary.service';

interface AuthedRequest {
  user: { id: string };
}

@ApiTags('dictionary')
@Controller('dictionary')
@UseGuards(JwtAuthGuard)
export class DictionaryController {
  constructor(private dictionary: DictionaryService) {}

  @Get()
  @ApiOperation({
    summary:
      'The 10,000-word dictionary: levels, topics, your progress, latest size test, next words',
  })
  overview(@Req() req: AuthedRequest) {
    return this.dictionary.overview(req.user.id);
  }

  @Get('words')
  @ApiOperation({
    summary:
      'Browse or search words (?q, level, topic, status=new|saved|known, sort=rank|az, page, rankFrom, rankTo)',
  })
  list(@Req() req: AuthedRequest, @Query() query: Record<string, string>) {
    return this.dictionary.list(req.user.id, {
      ...query,
      page: Number(query.page) || 1,
      rankFrom: query.rankFrom ? Number(query.rankFrom) : undefined,
      rankTo: query.rankTo ? Number(query.rankTo) : undefined,
    });
  }

  @Get('find')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'dictionary-find', limit: 120, windowMs: 60_000 })
  @ApiOperation({
    summary:
      'Find the dictionary entry for a word as heard or read (?word=went finds go); { word: null } if none',
  })
  find(@Req() req: AuthedRequest, @Query('word') word: string) {
    return this.dictionary.find(req.user.id, word);
  }

  @Get('words/:id')
  @ApiOperation({
    summary:
      'One word in full: pronunciation, meanings, examples, forms, family, your status',
  })
  word(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.dictionary.word(req.user.id, id);
  }

  @Post('words/:id/save')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'dictionary-save', limit: 60, windowMs: 60_000 })
  @ApiOperation({ summary: 'Put the word into My words (and review)' })
  save(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.dictionary.save(req.user.id, id);
  }

  @Post('save')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'dictionary-save-many', limit: 10, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Put several words into My words ({ ids }, up to 30)',
  })
  saveMany(@Req() req: AuthedRequest, @Body() body: { ids?: string[] }) {
    return this.dictionary.saveMany(req.user.id, body?.ids);
  }

  @Put('words/:id/known')
  @ApiOperation({
    summary:
      'Mark a word as one you know ({ known: true }) or not ({ known: false })',
  })
  known(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { known?: boolean },
  ) {
    return this.dictionary.setKnown(req.user.id, id, body?.known);
  }

  @Get('map')
  @ApiOperation({
    summary:
      'Word map: the 10,000 words in cells of 100, by band and level, and your next words',
  })
  map(@Req() req: AuthedRequest) {
    return this.dictionary.map(req.user.id);
  }

  @Get('tests')
  @ApiOperation({ summary: 'Your last 10 vocabulary size tests' })
  tests(@Req() req: AuthedRequest) {
    return this.dictionary.tests(req.user.id);
  }

  @Post('tests')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'dictionary-test', limit: 6, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Start a vocabulary size test: 60 words to answer yes or no',
  })
  startTest(@Req() req: AuthedRequest) {
    return this.dictionary.startTest(req.user.id);
  }

  @Post('tests/:id/answers')
  @ApiOperation({
    summary:
      'Step 2: { known: [keys] } the words you know; returns meaning questions',
  })
  answer(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { known?: string[] },
  ) {
    return this.dictionary.answerTest(req.user.id, id, body?.known);
  }

  @Post('tests/:id/finish')
  @ApiOperation({
    summary:
      'Step 3: { answers: { key: optionIndex } }; returns your estimated vocabulary size',
  })
  finish(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { answers?: Record<string, number> },
  ) {
    return this.dictionary.finishTest(req.user.id, id, body?.answers);
  }
}
