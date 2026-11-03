import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // Tells people about new friend requests
  imports: [NotificationsModule],
  controllers: [FriendsController],
  providers: [FriendsService, PrismaService],
  exports: [FriendsService],
})
export class FriendsModule {}
