import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfileModule } from './profile/profile.module';
import { SettingsModule } from './settings/settings.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaService } from './prisma.service';
import { VoiceModule } from './voice/voice.module';
import { ChatModule } from './chat/chat.module';
import { LearningModule } from './learning/learning.module';
import { CommunitiesModule } from './communities/communities.module';
import { FriendsModule } from './friends/friends.module';
import { UploadModule } from './upload/upload.module';
import { RedisModule } from './common/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    SettingsModule,
    LearningModule,
    FriendsModule,
    ChatModule,
    UploadModule,
    VoiceModule,
    CommunitiesModule,
  ],
  providers: [PrismaService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
