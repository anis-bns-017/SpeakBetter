import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShadowingService } from './shadowing.service';

@ApiTags('shadowing')
@Controller('shadowing')
@UseGuards(JwtAuthGuard)
export class ShadowingController {
  constructor(private shadowing: ShadowingService) {}

  @Get()
  @ApiOperation({ summary: 'The shadowing course: tracks, lessons, your progress and what to do next' })
  overview(@Req() req: any) {
    return this.shadowing.overview(req.user.id);
  }

  // Declared before :id so "daily" is not read as a lesson id
  @Get('daily')
  @ApiOperation({ summary: 'A quick mixed set at your level; ?round= for a different set' })
  daily(@Req() req: any, @Query('round') round?: string) {
    return this.shadowing.daily(req.user.id, round);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One lesson: lines with stress, linking, weak forms, tune and build-up steps' })
  lesson(@Req() req: any, @Param('id') id: string) {
    return this.shadowing.lesson(req.user.id, id);
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'Save a finished lesson: { startedAt } (scores are read from your pronunciation attempts)' })
  finish(@Req() req: any, @Param('id') id: string, @Body() body: { startedAt?: unknown }) {
    return this.shadowing.finish(req.user.id, id, body?.startedAt);
  }
}
