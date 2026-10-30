import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from '../prisma.service';
import { LearningModule } from '../learning/learning.module';
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
  ],
  controllers: [ChatController, ChatFeaturesController],
  providers: [
    ChatService,
    ChatGateway,
    PrismaService,
    ChatPrivacyService,
    ChatFeaturesService,
    LinkPreviewService,
    ChatSchedulerService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
