import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VoiceModule } from '../voice/voice.module';
import { PrismaService } from '../prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminContentService } from './admin-content.service';
import { AdminReportsService } from './admin-reports.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.roles';
import { AdminService } from './admin.service';

/** The admin section (src/admin): moderation, users, content, billing, announcements, audit log, system health */
@Module({
  imports: [AuthModule, NotificationsModule, VoiceModule],
  controllers: [AdminController],
  providers: [
    PrismaService,
    AdminGuard,
    AdminAuditService,
    AdminBootstrapService,
    AdminUsersService,
    AdminContentService,
    AdminReportsService,
    AdminService,
  ],
})
export class AdminModule {}
