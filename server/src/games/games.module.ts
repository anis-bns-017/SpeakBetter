import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [LearningModule],
  controllers: [GamesController],
  providers: [GamesService, PrismaService],
})
export class GamesModule {}
