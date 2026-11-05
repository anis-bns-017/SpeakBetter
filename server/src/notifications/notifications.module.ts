import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PushModule } from '../push/push.module';
import { DailyReminderService } from './daily-reminder.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  // AuthService: session-aware socket authentication
  imports: [AuthModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, DailyReminderService, PrismaService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
