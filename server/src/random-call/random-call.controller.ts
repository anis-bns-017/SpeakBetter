import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { REPORT_REASONS } from './random-call.constants';
import { RandomCallService } from './random-call.service';

class RateCallDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsBoolean()
  keepInTouch: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  talkSeconds?: number;
}

class ReportCallDto {
  @IsIn(REPORT_REASONS as unknown as string[])
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

class ResolveReportDto {
  @IsIn(['UPHOLD', 'DISMISS'])
  action: 'UPHOLD' | 'DISMISS';
}

class ConfirmAgeDto {
  @IsBoolean()
  confirm18: boolean;
}

@Controller('random-call')
@UseGuards(RateLimitGuard)
export class RandomCallController {
  constructor(private readonly calls: RandomCallService) {}

  private requireAdmin(userId: string) {
    if (!this.calls.isAdmin(userId)) {
      throw new ForbiddenException('Moderators only');
    }
  }

  @Get('status')
  status(@Request() req) {
    return this.calls.getStatus(req.user.id);
  }

  @Post('consent')
  @HttpCode(HttpStatus.OK)
  async consent(@Request() req, @Body() dto: ConfirmAgeDto) {
    if (!dto.confirm18) throw new ForbiddenException('You must be 18 or older');
    await this.calls.confirmAge(req.user.id);
    return { ok: true };
  }

  @Get('history')
  history(@Request() req) {
    return this.calls.history(req.user.id);
  }

  @Post('calls/:id/rate')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'rc-rate', limit: 60, windowMs: 60 * 60_000 })
  rate(@Request() req, @Param('id') id: string, @Body() dto: RateCallDto) {
    return this.calls.rate(id, req.user.id, dto);
  }

  @Post('calls/:id/report')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'rc-report', limit: 20, windowMs: 60 * 60_000 })
  report(@Request() req, @Param('id') id: string, @Body() dto: ReportCallDto) {
    return this.calls.report(id, req.user.id, dto);
  }

  @Post('calls/:id/block')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'rc-block', limit: 60, windowMs: 60 * 60_000 })
  block(@Request() req, @Param('id') id: string) {
    return this.calls.block(id, req.user.id);
  }

  // ---- Moderators (RANDOM_CALL_ADMIN_IDS) ----

  @Get('admin/reports')
  adminReports(@Request() req, @Query('status') status?: string) {
    this.requireAdmin(req.user.id);
    return this.calls.listReports(status);
  }

  @Post('admin/reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  adminResolve(@Request() req, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    this.requireAdmin(req.user.id);
    return this.calls.resolveReport(id, req.user.id, dto.action);
  }

  @Post('admin/users/:id/lift')
  @HttpCode(HttpStatus.OK)
  adminLift(@Request() req, @Param('id') id: string) {
    this.requireAdmin(req.user.id);
    return this.calls.liftRestriction(id);
  }
}
