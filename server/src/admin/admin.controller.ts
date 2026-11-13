import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminContentService } from './admin-content.service';
import { AdminReportsService } from './admin-reports.service';
import { AdminUsersService } from './admin-users.service';
import { AdminService } from './admin.service';
import { actorOf, AdminGuard, permissionsFor, RequireRole } from './admin.roles';
import {
  BroadcastDto,
  DeleteUserDto,
  GrantProDto,
  HideCommunityDto,
  OptionalNoteDto,
  ReasonDto,
  ResolveReportDto,
  RoleDto,
  SuspendDto,
  WarnDto,
} from './dto/admin.dto';

/**
 * The admin section's API. Every route needs a signed-in moderator or admin (AdminGuard); the admin-only ones
 * say @RequireRole('ADMIN'). Actions are rate limited so a stuck button or script can't do a thousand at once.
 */
@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private admin: AdminService,
    private users: AdminUsersService,
    private reports: AdminReportsService,
    private content: AdminContentService,
    private audit: AdminAuditService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Your role in the admin section and what it lets you do' })
  me(@Req() req: any) {
    return { id: req.user.id, name: req.user.name, role: req.user.role, permissions: permissionsFor(req.user.role) };
  }

  @Get('overview')
  @ApiOperation({ summary: 'Users, activity, rooms, reports, Pro and 30-day charts' })
  overview() {
    return this.admin.overview();
  }

  // ---------------- users ----------------

  @Get('users')
  listUsers(@Query() query: { q?: string; status?: string; role?: string; sort?: string; page?: string }) {
    return this.users.list({ ...query, page: Number(query.page) || 1 });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post('users/:id/warn')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'admin-action', limit: 60, windowMs: 60_000 })
  warn(@Req() req: any, @Param('id') id: string, @Body() body: WarnDto) {
    return this.users.warn(actorOf(req.user), id, body.message);
  }

  @Post('users/:id/suspend')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'admin-action', limit: 60, windowMs: 60_000 })
  suspend(@Req() req: any, @Param('id') id: string, @Body() body: SuspendDto) {
    return this.users.suspend(actorOf(req.user), id, body);
  }

  @Post('users/:id/unsuspend')
  unsuspend(@Req() req: any, @Param('id') id: string, @Body() body: OptionalNoteDto) {
    return this.users.unsuspend(actorOf(req.user), id, body.note);
  }

  @Post('users/:id/sign-out')
  signOut(@Req() req: any, @Param('id') id: string) {
    return this.users.signOut(actorOf(req.user), id);
  }

  @Put('users/:id/role')
  @RequireRole('ADMIN')
  setRole(@Req() req: any, @Param('id') id: string, @Body() body: RoleDto) {
    return this.users.setRole(actorOf(req.user), id, body.role);
  }

  @Post('users/:id/pro')
  @RequireRole('ADMIN')
  grantPro(@Req() req: any, @Param('id') id: string, @Body() body: GrantProDto) {
    return this.users.grantPro(actorOf(req.user), id, body);
  }

  @Delete('users/:id')
  @RequireRole('ADMIN')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'admin-delete', limit: 10, windowMs: 60_000 })
  removeUser(@Req() req: any, @Param('id') id: string, @Body() body: DeleteUserDto) {
    return this.users.remove(actorOf(req.user), id, body.confirmEmail, body.reason);
  }

  // ---------------- reports ----------------

  @Get('reports')
  listReports(@Query() query: { state?: string; source?: string; page?: string }) {
    return this.reports.list({ ...query, page: Number(query.page) || 1 });
  }

  @Post('reports/:source/:id/resolve')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'admin-action', limit: 60, windowMs: 60_000 })
  resolveReport(@Req() req: any, @Param('source') source: string, @Param('id') id: string, @Body() body: ResolveReportDto) {
    return this.reports.resolve(actorOf(req.user), source, id, body);
  }

  // ---------------- content ----------------

  @Get('rooms')
  rooms(@Query() query: { state?: string; q?: string; page?: string }) {
    return this.content.rooms({ ...query, page: Number(query.page) || 1 });
  }

  @Post('rooms/:id/close')
  closeRoom(@Req() req: any, @Param('id') id: string, @Body() body: ReasonDto) {
    return this.content.closeRoom(actorOf(req.user), id, body.reason);
  }

  @Get('communities')
  communities(@Query() query: { state?: string; q?: string; page?: string }) {
    return this.content.communities({ ...query, page: Number(query.page) || 1 });
  }

  @Put('communities/:id/hidden')
  hideCommunity(@Req() req: any, @Param('id') id: string, @Body() body: HideCommunityDto) {
    return this.content.setCommunityHidden(actorOf(req.user), id, body.hidden, body.reason);
  }

  @Delete('messages/:kind/:id')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'admin-action', limit: 60, windowMs: 60_000 })
  deleteMessage(@Req() req: any, @Param('kind') kind: string, @Param('id') id: string, @Body() body: ReasonDto) {
    return this.content.deleteMessage(actorOf(req.user), kind, id, body.reason);
  }

  // ---------------- admin only ----------------

  @Get('broadcast')
  @RequireRole('ADMIN')
  async broadcastInfo() {
    const [audiences, history] = await Promise.all([this.content.audienceSizes(), this.content.announcements()]);
    return { audiences, history };
  }

  @Post('broadcast')
  @RequireRole('ADMIN')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'admin-broadcast', limit: 5, windowMs: 60 * 60_000 })
  broadcast(@Req() req: any, @Body() body: BroadcastDto) {
    return this.content.broadcast(actorOf(req.user), body);
  }

  @Get('billing')
  @RequireRole('ADMIN')
  billing(@Query('page') page?: string) {
    return this.content.billing({ page: Number(page) || 1 });
  }

  @Get('system')
  @RequireRole('ADMIN')
  system() {
    return this.admin.system();
  }

  // ---------------- audit ----------------

  @Get('audit')
  auditLog(@Query() query: { action?: string; actorId?: string; targetId?: string; q?: string; page?: string }) {
    return this.audit.list({ ...query, page: Number(query.page) || 1 });
  }
}
