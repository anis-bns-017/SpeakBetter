import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../prisma.service';
import { FriendChallengesController } from './friend-challenges.controller';
import { FriendChallengesService } from './friend-challenges.service';

@Module({
  imports: [NotificationsModule, LearningModule],
  controllers: [FriendChallengesController],
  providers: [FriendChallengesService, PrismaService],
  exports: [FriendChallengesService],
})
export class FriendChallengesModule {}
