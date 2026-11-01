// server/src/voice/services/transcription.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepgramClient } from '@deepgram/sdk';
import { PrismaService } from '../../prisma.service';
import { VoiceBroadcaster } from '../realtime/voice-broadcaster';

@Injectable()
export class TranscriptionService implements OnModuleInit {
  private readonly logger = new Logger(TranscriptionService.name);
  private deepgram: DeepgramClient | null = null;
  private activeConnections: Map<string, any> = new Map();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private voiceBroadcaster: VoiceBroadcaster,
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get('DEEPGRAM_API_KEY');
    if (!apiKey) {
      this.logger.warn('⚠️ Deepgram API key not found. Transcription disabled.');
      return;
    }

    try {
      this.deepgram = new DeepgramClient({ apiKey });
      this.logger.log('✅ Deepgram initialized successfully');
    } catch (error: any) {
      this.logger.error(`❌ Failed to initialize Deepgram: ${error.message}`);
      this.deepgram = null;
    }
  }

  async startTranscription(roomId: string, userId: string, audioStream: any) {
    try {
      if (!this.deepgram) {
        this.logger.warn(
          '⚠️ Deepgram not initialized. Cannot start transcription.',
        );
        return null;
      }

      this.logger.log(`🎙️ Starting transcription for room ${roomId}`);

      const connection = await this.deepgram.listen.v1.connect({
        model: 'nova-2',
        language: 'en-US',
        smart_format: 'true',
        interim_results: 'true',
        diarize: 'true',
        punctuate: 'true',
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
      });

      connection.on('message', async (data: any) => {
        try {
          if (data?.type !== 'Results') {
            return;
          }

          const alternative = data.results?.channels?.[0]?.alternatives?.[0];
          if (!alternative) {
            return;
          }

          const transcript = alternative.transcript?.trim();
          const isFinal = Boolean(data.is_final);
          const speaker = alternative.speaker || 'unknown';
          const confidence = alternative.confidence || 0;

          if (!transcript || transcript.length === 0) {
            return;
          }

          await this.saveTranscription(
            roomId,
            userId,
            transcript,
            isFinal,
            speaker,
            confidence,
          );

          this.voiceBroadcaster.broadcastTranscription(roomId, {
            text: transcript,
            isFinal,
            speaker,
            userId,
            confidence,
          });

          if (isFinal) {
            await this.saveTranscriptionAsMessage(
              roomId,
              userId,
              transcript,
              speaker,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Error processing transcription: ${error.message}`,
          );
        }
      });

      connection.on('error', (error: any) => {
        this.logger.error(`❌ Deepgram error: ${error.message || error}`);
        this.activeConnections.delete(roomId);
      });

      connection.on('close', () => {
        this.logger.log(`🔇 Deepgram connection closed for room ${roomId}`);
        this.activeConnections.delete(roomId);
      });

      connection.connect();
      await connection.waitForOpen();

      this.activeConnections.set(roomId, connection);
      this.logger.log(`✅ Transcription started for room ${roomId}`);

      return connection;
    } catch (error: any) {
      this.logger.error(`❌ Failed to start transcription: ${error.message}`);
      this.activeConnections.delete(roomId);
      throw error;
    }
  }

  async sendAudioChunk(roomId: string, audioChunk: Buffer) {
    const connection = this.activeConnections.get(roomId);
    if (!connection) {
      this.logger.warn(`⚠️ No active connection for room ${roomId}`);
      return;
    }

    try {
      connection.sendMedia(audioChunk as any);
    } catch (error: any) {
      this.logger.error(`❌ Failed to send audio chunk: ${error.message}`);
      if (
        error.message?.includes('closed') ||
        error.message?.includes('destroyed')
      ) {
        this.activeConnections.delete(roomId);
      }
    }
  }

  private async saveTranscription(
    roomId: string,
    userId: string,
    text: string,
    isFinal: boolean,
    speaker: string,
    confidence: number,
  ) {
    try {
      return await this.prisma.voiceTranscription.create({
        data: {
          roomId,
          userId,
          text,
          isFinal,
          speaker,
          confidence: confidence || null,
          language: 'en-US',
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      this.logger.error(`❌ Failed to save transcription: ${error.message}`);
      return null;
    }
  }

  private async saveTranscriptionAsMessage(
    roomId: string,
    userId: string,
    text: string,
    speaker: string,
  ) {
    try {
      const message = await this.prisma.voiceRoomMessage.create({
        data: {
          roomId,
          senderId: userId,
          content: `🗣️ [${speaker}] ${text}`,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      this.voiceBroadcaster.broadcastTranscription(roomId, {
        text: `🗣️ [${speaker}] ${text}`,
        speaker,
        userId,
        type: 'message',
      });
      return message;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to save transcription as message: ${error.message}`,
      );
      return null;
    }
  }

  async stopTranscription(roomId: string) {
    const connection = this.activeConnections.get(roomId);
    if (connection) {
      try {
        connection.close();
        this.activeConnections.delete(roomId);
        this.logger.log(`✅ Transcription stopped for room ${roomId}`);
      } catch (error: any) {
        this.logger.error(`❌ Failed to stop transcription: ${error.message}`);
        this.activeConnections.delete(roomId);
      }
    } else {
      this.logger.warn(`⚠️ No active transcription to stop for room ${roomId}`);
    }
  }

  async stopAllTranscriptions() {
    const rooms = Array.from(this.activeConnections.keys());
    for (const roomId of rooms) {
      await this.stopTranscription(roomId);
    }
    this.logger.log(`✅ Stopped all ${rooms.length} transcriptions`);
  }

  async getRoomTranscriptions(roomId: string, limit = 50) {
    try {
      return await this.prisma.voiceTranscription.findMany({
        where: {
          roomId,
          isFinal: true,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });
    } catch (error: any) {
      this.logger.error(`❌ Failed to get transcriptions: ${error.message}`);
      return [];
    }
  }

  async getTranscriptionStats(roomId: string) {
    try {
      const [total, final, users] = await Promise.all([
        this.prisma.voiceTranscription.count({
          where: { roomId },
        }),
        this.prisma.voiceTranscription.count({
          where: { roomId, isFinal: true },
        }),
        this.prisma.voiceTranscription.groupBy({
          by: ['userId'],
          where: { roomId, isFinal: true },
          _count: true,
        }),
      ]);

      return {
        total,
        final,
        users: users.length,
        topSpeakers: users
          .sort((a, b) => (b._count || 0) - (a._count || 0))
          .slice(0, 5),
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to get transcription stats: ${error.message}`,
      );
      return null;
    }
  }

  async translateTranscription(
    transcriptionId: string,
    targetLanguage: string,
  ) {
    this.logger.log(
      `🌐 Translating transcription ${transcriptionId} to ${targetLanguage}`,
    );
    return null;
  }

  isTranscriptionActive(roomId: string): boolean {
    return this.activeConnections.has(roomId);
  }

  getActiveRooms(): string[] {
    return Array.from(this.activeConnections.keys());
  }
}
