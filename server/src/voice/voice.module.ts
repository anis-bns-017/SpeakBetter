// server/src/voice/voice.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VoiceController } from './voice.controller';
import { UploadController } from '../upload/upload.controller';
import { VoiceService } from './voice.service';
import { VoiceGateway } from './voice.gateway';
import { LiveKitService } from './livekit.service';
import { PrismaService } from '../prisma.service';

// Import new services
import { TranscriptionService } from './services/transcription.service';
import { TranslationService } from './services/translation.service';
import { ClapService } from './services/clap.service';
import { SpeakerQueueService } from './services/queue.service';
import { AnalyticsService } from './services/analytics.service';

// Import new controllers
import { TranscriptionController } from './controllers/transcription.controller';
import { ClapController } from './controllers/clap.controller';
import { QueueController } from './controllers/queue.controller';
import { InviteController } from './controllers/invite.controller';
import { AnalyticsController } from './controllers/analytics.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    VoiceController,
    UploadController,
    TranscriptionController,
    ClapController,
    QueueController,
    InviteController,
    AnalyticsController,
  ],
  providers: [
    VoiceService,
    VoiceGateway,
    LiveKitService,
    PrismaService,
    TranscriptionService,
    TranslationService,
    ClapService,
    SpeakerQueueService,
    AnalyticsService,
  ],
  exports: [
    VoiceService,
    LiveKitService,
    TranscriptionService,
    TranslationService,
    ClapService,
    SpeakerQueueService,
    AnalyticsService,
  ],
})
export class VoiceModule {}
