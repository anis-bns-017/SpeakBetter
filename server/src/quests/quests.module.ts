import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';

@Module({
  imports: [LearningModule, GamificationModule],
  controllers: [QuestsController],
  providers: [QuestsService, PrismaService],
})
export class QuestsModule {}
