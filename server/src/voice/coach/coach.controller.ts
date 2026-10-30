import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
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

  @Post('words')
  @ApiOperation({ summary: 'Save a word tapped in the live captions to my word bank' })
  saveWord(
    @Req() req: any,
    @Body() body: { word?: string; sentence?: string; meaning?: string; speakerName?: string; roomId?: string },
  ) {
    return this.coach.saveWord(req.user.id, body ?? {});
  }

  @Get('words')
  @ApiOperation({ summary: 'My saved words (add ?due=1 for the ones ready to review)' })
  listWords(@Req() req: any, @Query('due') due?: string, @Query('limit') limit?: string) {
    return this.coach.listWords(req.user.id, {
      dueOnly: due === '1' || due === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('words/:id/review')
  @ApiOperation({ summary: 'Record whether I remembered a saved word' })
  reviewWord(@Req() req: any, @Param('id') id: string, @Body() body: { knew?: boolean }) {
    return this.coach.reviewWord(req.user.id, id, body?.knew === true);
  }

  @Delete('words/:id')
  @ApiOperation({ summary: 'Remove a saved word' })
  deleteWord(@Req() req: any, @Param('id') id: string) {
    return this.coach.deleteWord(req.user.id, id);
  }

  @Get('cards')
  @ApiOperation({ summary: 'Topic cards a host can push to the room' })
  getCards() {
    return TOPIC_CARDS;
  }
}
