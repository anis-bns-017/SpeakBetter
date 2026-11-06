import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { LanguageToolClient } from './language-tool.client';
import { WritingController } from './writing.controller';
import { WritingService } from './writing.service';

@Module({
  imports: [LearningModule, GamificationModule],
  controllers: [WritingController],
  providers: [WritingService, LanguageToolClient, PrismaService],
})
export class WritingModule {}
