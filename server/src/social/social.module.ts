import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../prisma.service';
import { FollowService } from './follow.service';
import { RoomRemindersService } from './room-reminders.service';
import { SocialController } from './social.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [SocialController],
  providers: [FollowService, RoomRemindersService, PrismaService],
  exports: [FollowService, RoomRemindersService],
})
export class SocialModule {}
