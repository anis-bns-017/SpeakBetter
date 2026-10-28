import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma.service';


@Module({
  controllers: [LearningController],
  providers: [LearningService, ActivityService, PrismaService],
  exports: [LearningService, ActivityService],
})
export class LearningModule {}
