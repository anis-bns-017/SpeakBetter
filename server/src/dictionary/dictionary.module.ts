import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';

@Module({
  imports: [LearningModule],
  controllers: [DictionaryController],
  providers: [DictionaryService, PrismaService],
})
export class DictionaryModule {}
