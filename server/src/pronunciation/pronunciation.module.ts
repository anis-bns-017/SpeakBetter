import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { PronunciationController } from './pronunciation.controller';
import { PronunciationService } from './pronunciation.service';

@Module({
  imports: [LearningModule],
  controllers: [PronunciationController],
  providers: [PronunciationService, PrismaService],
})
export class PronunciationModule {}
