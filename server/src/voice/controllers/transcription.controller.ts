import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TranscriptionService } from '../services/transcription.service';
import { TranslationService } from '../services/translation.service';
import { VoiceBroadcaster } from '../realtime/voice-broadcaster';

@ApiTags('voice-transcription')
@Controller('voice/transcription')
@UseGuards(JwtAuthGuard)
export class TranscriptionController {
  constructor(
    private transcriptionService: TranscriptionService,
    private translationService: TranslationService,
    private voiceBroadcaster: VoiceBroadcaster,
  ) {}

  @Post('start/:roomId')
  @ApiOperation({ summary: 'Start voice transcription' })
  @ApiResponse({ status: 200, description: 'Transcription started' })
  async startTranscription(@Param('roomId') roomId: string, @Req() req: any) {
    const userId = req.user.id;
    // Audio stream will be handled via WebSocket
    return this.transcriptionService.startTranscription(roomId, userId, null);
  }

  @Post('stop/:roomId')
  @ApiOperation({ summary: 'Stop voice transcription' })
  @ApiResponse({ status: 200, description: 'Transcription stopped' })
  async stopTranscription(@Param('roomId') roomId: string) {
    await this.transcriptionService.stopTranscription(roomId);
    return { success: true };
  }

  @Get(':roomId')
  @ApiOperation({ summary: 'Get room transcriptions' })
  @ApiResponse({ status: 200, description: 'Transcriptions retrieved' })
  async getTranscriptions(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: number,
  ) {
    return this.transcriptionService.getRoomTranscriptions(roomId, limit);
  }

  @Post('translate/:transcriptionId')
  @ApiOperation({ summary: 'Translate a transcription' })
  @ApiResponse({ status: 200, description: 'Transcription translated' })
  async translateTranscription(
    @Param('transcriptionId') transcriptionId: string,
    @Body('targetLanguage') targetLanguage: string,
  ) {
    return this.translationService.translateTranscription(
      transcriptionId,
      targetLanguage,
    );
  }

  @Get('translate/:roomId/:targetLanguage')
  @ApiOperation({ summary: 'Get translated transcriptions for a room' })
  @ApiResponse({
    status: 200,
    description: 'Translated transcriptions retrieved',
  })
  async getTranslatedTranscriptions(
    @Param('roomId') roomId: string,
    @Param('targetLanguage') targetLanguage: string,
  ) {
    return this.translationService.getTranslatedTranscriptions(
      roomId,
      targetLanguage,
    );
  }
}
