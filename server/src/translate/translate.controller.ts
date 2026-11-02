import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { LookupQueryDto } from './dto/lookup.dto';
import { TranslateService } from './translate.service';

@ApiTags('translate')
@Controller('translate')
@UseGuards(JwtAuthGuard)
export class TranslateController {
  constructor(private translate: TranslateService) {}

  @Get('lookup')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'translate-lookup', limit: 60, windowMs: 60_000 })
  @ApiOperation({ summary: 'What a word or short phrase means, in your own language, with the English definition' })
  lookup(@Req() req: any, @Query() query: LookupQueryDto) {
    return this.translate.lookup(req.user.id, query);
  }

  @Get('languages')
  @ApiOperation({ summary: 'Languages meanings can be shown in' })
  languages() {
    return this.translate.languages();
  }
}
