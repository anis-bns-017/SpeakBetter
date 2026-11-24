import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { PrismaService } from '../prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService, PrismaService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
