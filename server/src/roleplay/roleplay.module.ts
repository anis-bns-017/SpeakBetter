import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningModule } from '../learning/learning.module';
import { PrismaService } from '../prisma.service';
import { RoleplayController } from './roleplay.controller';
import { RoleplayService } from './roleplay.service';

@Module({
  imports: [LearningModule, GamificationModule],
  controllers: [RoleplayController],
  providers: [RoleplayService, PrismaService],
})
export class RoleplayModule {}
