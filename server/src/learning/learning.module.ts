import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { ActivityService } from './activity.service';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { PrismaService } from '../prisma.service';


@Module({
  controllers: [LearningController, ReviewController],
  providers: [LearningService, ActivityService, ReviewService, PrismaService],
  exports: [LearningService, ActivityService, ReviewService],
})
export class LearningModule {}
