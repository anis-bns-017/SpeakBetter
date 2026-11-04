import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningModule } from '../learning/learning.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../prisma.service';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [LearningModule, NotificationsModule, GamificationModule],
  controllers: [ChallengesController],
  providers: [ChallengesService, PrismaService],
})
export class ChallengesModule {}
