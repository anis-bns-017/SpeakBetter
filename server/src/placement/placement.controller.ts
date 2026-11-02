import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlacementService } from './placement.service';
import { AnswerPlacementDto, SpeakingSampleDto } from './dto/placement.dto';

@ApiTags('placement')
@Controller('placement')
@UseGuards(JwtAuthGuard)
export class PlacementController {
  constructor(private placement: PlacementService) {}

  @Get('me')
  @ApiOperation({ summary: 'My CEFR level, latest result and any unfinished test' })
  status(@Req() req: any) {
    return this.placement.getStatus(req.user.id);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start the placement test, or resume the unfinished one' })
  start(@Req() req: any) {
    return this.placement.start(req.user.id);
  }

  @Post(':id/answer')
  @ApiOperation({ summary: 'Answer the current question; returns the next one or the final level' })
  answer(@Req() req: any, @Param('id') id: string, @Body() body: AnswerPlacementDto) {
    return this.placement.answer(req.user.id, id, body.itemId, body.skip ? null : (body.choice ?? null), body.ms);
  }

  @Post(':id/speaking')
  @ApiOperation({ summary: 'Add an optional spoken sample to a finished test' })
  speaking(@Req() req: any, @Param('id') id: string, @Body() body: SpeakingSampleDto) {
    return this.placement.addSpeaking(req.user.id, id, body.transcript, body.seconds);
  }
}
