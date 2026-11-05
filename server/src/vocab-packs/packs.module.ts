import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { VocabPacksController } from './packs.controller';
import { VocabPacksService } from './packs.service';

@Module({
  imports: [LearningModule, GamificationModule],
  controllers: [VocabPacksController],
  providers: [VocabPacksService, PrismaService],
})
export class VocabPacksModule {}
