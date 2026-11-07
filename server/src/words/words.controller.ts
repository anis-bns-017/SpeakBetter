import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { isItemType, type BankItemType } from './words.engine';
import { WordsService } from './words.service';

interface AuthedRequest {
  user: { id: string };
}

interface WordBody {
  word?: string;
  meaning?: string;
  example?: string;
}

const itemType = (value: string): BankItemType => {
  if (!isItemType(value)) throw new BadRequestException('Unknown kind of word');
  return value;
};

@ApiTags('words')
@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordsController {
  constructor(private words: WordsService) {}

  @Get()
  @ApiOperation({
    summary:
      'My words: every saved word (packs, word of the day, rooms, your own) with recall and stage',
  })
  list(@Req() req: AuthedRequest) {
    return this.words.list(req.user.id);
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'words-add', limit: 30, windowMs: 60_000 })
  @ApiOperation({
    summary:
      'Add a word of your own ({ word, meaning, example? }); it goes into review',
  })
  add(@Req() req: AuthedRequest, @Body() body: WordBody) {
    return this.words.add(req.user.id, body ?? {});
  }

  @Put(':type/:id')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'words-edit', limit: 60, windowMs: 60_000 })
  @ApiOperation({
    summary:
      'Change a word’s meaning or example ({ meaning, example? }); type is card or word',
  })
  update(
    @Req() req: AuthedRequest,
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: WordBody,
  ) {
    return this.words.update(req.user.id, itemType(type), id, body ?? {});
  }

  @Delete(':type/:id')
  @ApiOperation({ summary: 'Remove a word from My words and from review' })
  remove(
    @Req() req: AuthedRequest,
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.words.remove(req.user.id, itemType(type), id);
  }
}
