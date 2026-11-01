import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatMessagesGateway } from './realtime/chat-messages.gateway';
import { ChatEngagementGateway } from './realtime/chat-engagement.gateway';
import { ChatRealtimeState } from './realtime/chat-realtime-state';
import { ChatBroadcaster } from './realtime/chat-broadcaster';
import { PrismaService } from '../prisma.service';
import { LearningModule } from '../learning/learning.module';
import { AuthModule } from '../auth/auth.module';
import { ChatFeaturesController } from './chat-features.controller';
import { ChatPrivacyService } from './chat-privacy.service';
import { ChatFeaturesService } from './chat-features.service';
import { LinkPreviewService } from './link-preview.service';
import { ChatSchedulerService } from './chat-scheduler.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    // ActivityService: XP for giving and accepting corrections
    LearningModule,
    // AuthService: session-aware socket authentication
    AuthModule,
  ],
  controllers: [ChatController, ChatFeaturesController],
  providers: [
    ChatService,
    // The chat namespace: one front-door gateway plus feature gateways on the
    // same namespace, sharing connection state and one broadcaster
    ChatGateway,
    ChatMessagesGateway,
    ChatEngagementGateway,
    ChatRealtimeState,
    ChatBroadcaster,
    PrismaService,
    ChatPrivacyService,
    ChatFeaturesService,
    LinkPreviewService,
    ChatSchedulerService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
