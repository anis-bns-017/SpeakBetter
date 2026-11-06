import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { ShadowingController } from './shadowing.controller';
import { ShadowingService } from './shadowing.service';

@Module({
  imports: [LearningModule, GamificationModule],
  controllers: [ShadowingController],
  providers: [ShadowingService, PrismaService],
})
export class ShadowingModule {}
