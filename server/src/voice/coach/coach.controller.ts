import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CoachService } from './coach.service';
import { TOPIC_CARDS } from './coach.data';

@ApiTags('voice-coach')
@Controller('voice/coach')
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private coach: CoachService) {}

  @Get('reports/me')
  @ApiOperation({ summary: 'My recent voice room session reports (newest first)' })
  getMyReports(@Req() req: any, @Query('limit') limit?: string) {
    return this.coach.getMyReports(req.user.id, limit ? Number(limit) : 20);
  }

  @Get('reports/room/:roomId')
  @ApiOperation({ summary: 'My report for one voice room' })
  async getRoomReport(@Req() req: any, @Param('roomId') roomId: string) {
    const report = await this.coach.getRoomReport(roomId, req.user.id);
    if (!report) throw new NotFoundException('No report for this room yet');
    return report;
  }

  @Get('cards')
  @ApiOperation({ summary: 'Topic cards a host can push to the room' })
  getCards() {
    return TOPIC_CARDS;
  }
}
