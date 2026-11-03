import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Your notifications, newest first (pass before=<createdAt> for older ones)' })
  list(@Req() req: any, @Query('before') before?: string, @Query('limit') limit?: string) {
    return this.notifications.list(req.user.id, { before, limit: limit ? Number(limit) : undefined });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'How many notifications you have not read' })
  async unread(@Req() req: any) {
    return { unread: await this.notifications.unreadCount(req.user.id) };
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark notifications read: { ids: [...] } or { all: true }' })
  read(@Req() req: any, @Body() body: { ids?: string[]; all?: boolean }) {
    return this.notifications.markRead(req.user.id, body ?? {});
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Which kinds of notification you get' })
  preferences(@Req() req: any) {
    return this.notifications.getPreferences(req.user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Switch kinds of notification on or off' })
  updatePreferences(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.notifications.updatePreferences(req.user.id, body ?? {});
  }
}
