import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { PlanService } from './plan.service';

@Module({
  imports: [LearningModule],
  controllers: [InsightsController],
  providers: [PlanService, InsightsService, PrismaService],
})
export class InsightsModule {}
