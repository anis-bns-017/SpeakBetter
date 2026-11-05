import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningModule } from '../learning/learning.module';
import { FriendChallengesModule } from '../friend-challenges/friend-challenges.module';
import { PrismaService } from '../prisma.service';
import { DictationController } from './dictation.controller';
import { DictationService } from './dictation.service';

@Module({
  imports: [LearningModule, GamificationModule, FriendChallengesModule],
  controllers: [DictationController],
  providers: [DictationService, PrismaService],
})
export class DictationModule {}
