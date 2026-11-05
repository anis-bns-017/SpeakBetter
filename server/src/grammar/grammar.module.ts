import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningModule } from '../learning/learning.module';
import { FriendChallengesModule } from '../friend-challenges/friend-challenges.module';
import { PrismaService } from '../prisma.service';
import { GrammarController } from './grammar.controller';
import { GrammarService } from './grammar.service';

@Module({
  imports: [LearningModule, GamificationModule, FriendChallengesModule],
  controllers: [GrammarController],
  providers: [GrammarService, PrismaService],
})
export class GrammarModule {}
