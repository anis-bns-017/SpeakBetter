import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../prisma.service';
import { BadgesService } from './badges.service';
import { GamificationController } from './gamification.controller';
import { LeaguesService } from './leagues.service';

@Module({
  imports: [NotificationsModule],
  controllers: [GamificationController],
  providers: [BadgesService, LeaguesService, PrismaService],
  exports: [BadgesService],
})
export class GamificationModule {}
