import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { WordsController } from './words.controller';
import { WordsService } from './words.service';

@Module({
  imports: [LearningModule],
  controllers: [WordsController],
  providers: [WordsService, PrismaService],
})
export class WordsModule {}
