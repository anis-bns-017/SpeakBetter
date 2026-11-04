import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuestsService } from './quests.service';

@ApiTags('quests')
@Controller()
@UseGuards(JwtAuthGuard)
export class QuestsController {
  constructor(private quests: QuestsService) {}

  @Get('quests')
  @ApiOperation({ summary: "This week's three quests with progress; quests done since the last look pay out" })
  get(@Req() req: any) {
    return this.quests.get(req.user.id);
  }

  @Post('quests/seen')
  @ApiOperation({ summary: 'Mark news as seen: { chest: true } and/or { saved: true }' })
  seen(@Req() req: any, @Body() body: { chest?: boolean; saved?: boolean }) {
    return this.quests.markSeen(req.user.id, body ?? {});
  }

  @Get('streak')
  @ApiOperation({ summary: 'Your streak, the freezes you hold, and the freeze shop' })
  streak(@Req() req: any) {
    return this.quests.streak(req.user.id);
  }

  @Post('streak/freezes')
  @ApiOperation({ summary: 'Buy a streak freeze with XP' })
  buy(@Req() req: any) {
    return this.quests.buyFreeze(req.user.id);
  }
}
