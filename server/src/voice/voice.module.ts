// server/src/voice/voice.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { VoiceGateway } from './voice.gateway';
import { VoiceChatGateway } from './realtime/voice-chat.gateway';
import { VoiceModerationGateway } from './realtime/voice-moderation.gateway';
import { VoiceCoachGateway } from './realtime/voice-coach.gateway';
import { VoiceRoomState } from './realtime/voice-room-state';
import { VoiceBroadcaster } from './realtime/voice-broadcaster';
import { VoiceCoachSession } from './realtime/voice-coach-session';
import { LiveKitService } from './livekit.service';
import { PrismaService } from '../prisma.service';
import { LearningModule } from '../learning/learning.module';
import { AuthModule } from '../auth/auth.module';
import { TranslateModule } from '../translate/translate.module';
import { SocialModule } from '../social/social.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Import new services
import { TranscriptionService } from './services/transcription.service';
import { TranslationService } from './services/translation.service';
import { ClapService } from './services/clap.service';
import { SpeakerQueueService } from './services/queue.service';
import { AnalyticsService } from './services/analytics.service';
import { CoachService } from './coach/coach.service';
import { CoachController } from './coach/coach.controller';

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
    // ActivityService: XP + streaks for speaking and corrections
    LearningModule,
    // AuthService: session-aware socket authentication
    AuthModule,
    // Free translation for room messages when no paid key is set
    TranslateModule,
    // Scheduled and live room announcements, and the notifications they send
    SocialModule,
    NotificationsModule,
  ],
  controllers: [
    VoiceController,
    TranscriptionController,
    ClapController,
    QueueController,
    InviteController,
    AnalyticsController,
    CoachController,
  ],
  providers: [
    VoiceService,
    // The voice namespace: one front-door gateway plus feature gateways on
    // the same namespace, sharing room state and one broadcaster
    VoiceGateway,
    VoiceChatGateway,
    VoiceModerationGateway,
    VoiceCoachGateway,
    VoiceRoomState,
    VoiceBroadcaster,
    VoiceCoachSession,
    LiveKitService,
    PrismaService,
    TranscriptionService,
    TranslationService,
    ClapService,
    SpeakerQueueService,
    AnalyticsService,
    CoachService,
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
