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
import { RandomCallModule } from './random-call/random-call.module';
import { PlacementModule } from './placement/placement.module';
import { AiTutorModule } from './ai-tutor/ai-tutor.module';
import { TranslateModule } from './translate/translate.module';
import { PronunciationModule } from './pronunciation/pronunciation.module';
import { InsightsModule } from './insights/insights.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SocialModule } from './social/social.module';
import { GamificationModule } from './gamification/gamification.module';
import { ChallengesModule } from './challenges/challenges.module';
import { LibraryModule } from './library/library.module';
import { GrammarModule } from './grammar/grammar.module';
import { VocabPacksModule } from './vocab-packs/packs.module';
import { PushModule } from './push/push.module';
import { DictationModule } from './dictation/dictation.module';
import { RoleplayModule } from './roleplay/roleplay.module';
import { ShadowingModule } from './shadowing/shadowing.module';
import { FriendChallengesModule } from './friend-challenges/friend-challenges.module';
import { QuestsModule } from './quests/quests.module';
import { WritingModule } from './writing/writing.module';
import { BillingModule } from './billing/billing.module';

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
    RandomCallModule,
    PlacementModule,
    AiTutorModule,
    TranslateModule,
    PronunciationModule,
    InsightsModule,
    NotificationsModule,
    SocialModule,
    GamificationModule,
    ChallengesModule,
    LibraryModule,
    GrammarModule,
    VocabPacksModule,
    PushModule,
    DictationModule,
    RoleplayModule,
    ShadowingModule,
    FriendChallengesModule,
    QuestsModule,
    WritingModule,
    BillingModule,
    CommunitiesModule,
  ],
  providers: [PrismaService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
